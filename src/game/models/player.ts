import { TransformNode, type AbstractMesh, type Mesh, type Nullable, MeshBuilder } from '@babylonjs/core';
import { Vector3, Axis, Space, Scalar, Quaternion } from '@babylonjs/core/Maths';
import {
  PhysicsShapeConvexHull,
  PhysicsShapeContainer,
  PhysicsBody,
  PhysicsMotionType,
  Physics6DoFConstraint,
  PhysicsShapeSphere,
  PhysicsAggregate,
  LockConstraint,
  PhysicsConstraintAxis,
  PhysicsConstraintMotorType,
  HavokPlugin
} from '@babylonjs/core/Physics';
import { type FreeCamera } from '@babylonjs/core/Cameras';
import { Control, Container, Image, Rectangle } from '@babylonjs/gui';

import { World } from '../main';
import type { Player } from '../state';
import { Tank } from './tank';
import { avg, clamp, forwardVector, nzpyVector } from '@/utils/utils';
import { AssetLoader } from '../loader';
import { GameInputType, type PlayerInputs } from '@/types/types';
import { Shell } from './shell';
import { InputManager, type IInputHistory } from '../input';
import { Ground } from './ground';

export class PlayerTank extends Tank {
  private static config = {
    maxEnginePower: 100,
    speedModifier: 10,
    decelerationModifier: 4,
    maxSpeed: 15,
    maxTurningSpeed: 3,
    maxTurretAngle: 1.17, // ~67.5 deg
    maxBarrelAngle: 0.34, // ~20 deg
    maxTurretSpeed: 14,
    maxBarrelSpeed: 14,
    bodyMass: 2,
    bodyFriction: 1,
    bodyRestitution: 0,
    wheelMass: 1,
    wheelFriction: 0.8,
    wheelRestitution: 0,
    turretMass: 0.2,
    barrelMass: 0.09,
    axleFriction: 0,
    suspensionMinLimit: -0.2,
    suspensionMaxLimit: 0.033,
    suspensionStiffness: 100,
    suspensionDamping: 7,
    noOfWheels: 10,
    recoilForce: 7.5,
    // Less than actual cooldown, to avoid sync issues, state.canFire is used together
    cooldown: 5000,
    loadCooldown: 2500
  };
  private axleJoints: TransformNode[] = [];
  axles: Mesh[] = [];
  innerWheels!: AbstractMesh;
  private axleMotors: Physics6DoFConstraint[] = [];
  private barrelMotor!: Physics6DoFConstraint;
  private turretMotor!: Physics6DoFConstraint;
  sights: (Control | Container)[] = [];
  leftSpeed: number = 0;
  rightSpeed: number = 0;
  private lastCameraToggle = 0;
  private cameraToggleDelay = 1000;
  private lastFiredTS = 0;
  physicsBodies: PhysicsBody[] = [];
  isReconciling = false;
  canFire = false;

  constructor(
    world: World,
    state: Player,
    rootMesh: AbstractMesh,
    spawn: Vector3,
    public cameras: { tpp: FreeCamera; fpp: FreeCamera }
  ) {
    super(world, state);

    this.isPlayer = true;
    this.setTransform(rootMesh, spawn);
    this.setPhysics(rootMesh as Mesh);
    this.setGUI();

    cameras.tpp.position = this.body.getDirection(nzpyVector).normalize().scale(15).add(spawn);
    cameras.fpp.parent = this.barrel;

    this.observers.push(this.world.scene.onBeforeStepObservable.add(this.beforeStep.bind(this)));
  }
  static async create(
    world: World,
    state: Player,
    rootMesh: AbstractMesh,
    spawn: Vector3,
    cameras: Nullable<{ tpp: FreeCamera; fpp: FreeCamera }>
  ) {
    const cloned = rootMesh.clone(`${rootMesh.name.replace(':Ref', '')}:${state.sid}`, null)!;
    const newTank = new PlayerTank(world, state, cloned, spawn, cameras!);
    await newTank.init();
    newTank.setPreStep(false);
    return newTank;
  }

  private setTransform(rootMesh: AbstractMesh, spawn: Vector3) {
    this.mesh = rootMesh;
    const body = new TransformNode(`Root:${rootMesh.name}`, this.world.scene);
    for (let i = 0; i < PlayerTank.config.noOfWheels; i += 1) {
      const axleJoint = new TransformNode(`axlejoint${i}`, this.world.scene);
      const axleMesh = MeshBuilder.CreateSphere(
        `axle${i}`,
        { diameterY: 0.6, diameterX: 0.75, diameterZ: 0.75, segments: 5 },
        this.world.scene
      );
      axleMesh.rotate(Axis.Z, Math.PI / 2, Space.LOCAL);
      axleMesh.bakeCurrentTransformIntoVertices();
      axleMesh.parent = axleJoint;
      axleMesh.isVisible = false;
      this.axleJoints.push(axleJoint);
      this.axles.push(axleMesh);
    }
    rootMesh.position = Vector3.Zero();
    const childMeshes = rootMesh.getChildMeshes();
    this.barrel = childMeshes[0];
    this.rightExhaust = childMeshes[1];
    this.leftExhaust = childMeshes[2];
    this.innerWheels = childMeshes[3];
    this.leftTrack = childMeshes[4];
    this.rightTrack = childMeshes[5];
    this.turret = childMeshes[6];
    this.barrel.position.y = -0.51;
    this.barrel.position.z = 1.79;
    this.barrel.parent = this.turret;
    rootMesh.parent = body;
    body.position = spawn;
    this.body = body;
    this.barrelTip = new TransformNode(`Tip:${rootMesh.name}`, this.world.scene);
    this.barrelTip.position.z = 4.656;
    this.barrelTip.parent = this.barrel;

    for (
      let r = childMeshes.length - 1, l = childMeshes.length - 8;
      this.leftWheels.length < 7;
      l -= 1, r -= 1
    ) {
      this.leftWheels.push(childMeshes[l]);
      this.rightWheels.push(childMeshes[r]);
    }

    rootMesh.isVisible = true;
    childMeshes.forEach((mesh) => (mesh.isVisible = true));
  }
  private setPhysics(rootMesh: Mesh) {
    const bodyShape = new PhysicsShapeConvexHull(rootMesh, this.world.scene);
    const bodyShapeContainer = new PhysicsShapeContainer(this.world.scene);
    bodyShapeContainer.addChildFromParent(this.body, bodyShape, rootMesh);
    const bodyPB = new PhysicsBody(this.body, PhysicsMotionType.DYNAMIC, false, this.world.scene);
    bodyShapeContainer.material = {
      friction: PlayerTank.config.bodyFriction,
      restitution: PlayerTank.config.bodyRestitution
    };
    bodyPB.shape = bodyShapeContainer;
    bodyPB.setMassProperties({ mass: PlayerTank.config.bodyMass, centerOfMass: Vector3.Zero() });

    const turretShape = new PhysicsShapeConvexHull(this.turret as Mesh, this.world.scene);
    turretShape.material = { friction: 0, restitution: 0 };
    const turretPB = new PhysicsBody(this.turret, PhysicsMotionType.DYNAMIC, false, this.world.scene);
    turretPB.shape = turretShape;
    turretPB.setMassProperties({ mass: PlayerTank.config.turretMass, centerOfMass: Vector3.Zero() });
    this.turretMotor = this.createTurretConstraint(
      this.turret.position,
      Vector3.Zero(),
      new Vector3(1, 0, 1),
      new Vector3(1, 0, 1),
      new Vector3(0, 1, 0),
      new Vector3(0, 1, 0),
      bodyPB,
      turretPB
    );

    const barrelShape = new PhysicsShapeConvexHull(this.barrel as Mesh, this.world.scene);
    barrelShape.material = { friction: 0, restitution: 0 };
    const barrelPB = new PhysicsBody(this.barrel, PhysicsMotionType.DYNAMIC, false, this.world.scene);
    barrelPB.shape = barrelShape;
    barrelPB.setMassProperties({ mass: PlayerTank.config.barrelMass, centerOfMass: Vector3.Zero() });
    this.barrelMotor = this.createBarrelConstraint(
      this.barrel.position,
      Vector3.Zero(),
      new Vector3(1, 0, 0),
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 1, 0),
      turretPB,
      barrelPB
    );

    const wheelPositions: Vector3[] = [
      new Vector3(-1.475, 0.2, 2),
      new Vector3(-1.475, 0.2, 1),
      new Vector3(-1.475, 0.2, 0),
      new Vector3(-1.475, 0.2, -1),
      new Vector3(-1.475, 0.2, -2),
      new Vector3(1.475, 0.2, 2),
      new Vector3(1.475, 0.2, 1),
      new Vector3(1.475, 0.2, 0),
      new Vector3(1.475, 0.2, -1),
      new Vector3(1.475, 0.2, -2)
    ];

    const axleShape = new PhysicsShapeSphere(Vector3.Zero(), 0.375, this.world.scene);
    for (let i = 0; i < PlayerTank.config.noOfWheels; i += 1) {
      const axleJoint = this.axleJoints[i];
      const axle = this.axles[i];

      axle.position = Vector3.Zero();
      axleJoint.parent = this.body;
      axleJoint.position = wheelPositions[i];

      const axleAgg = new PhysicsAggregate(
        axle,
        axleShape,
        {
          mass: PlayerTank.config.wheelMass,
          friction: PlayerTank.config.wheelFriction,
          restitution: PlayerTank.config.wheelRestitution
        },
        this.world.scene
      );
      (axle as Mesh).collisionRetryCount = 5;

      this.axleMotors.push(
        this.createWheelConstraint(wheelPositions[i], axle.position, bodyPB, axleAgg.body)
      );
      this.axles.push(axle);
    }

    const triggerShape = new PhysicsShapeSphere(Vector3.Zero(), 5, this.world.scene);
    triggerShape.isTrigger = true;
    const refPB = new PhysicsBody(this.innerWheels, PhysicsMotionType.DYNAMIC, false, this.world.scene);
    this.innerWheels.physicsBody!.setMassProperties({ mass: 0.1 });
    this.body.physicsBody!.addConstraint(
      this.innerWheels.physicsBody!,
      new LockConstraint(Vector3.Zero(), Vector3.Zero(), forwardVector, forwardVector, this.world.scene)
    );
    this.innerWheels.physicsBody!.shape = triggerShape;
    this.observers.push(
      (
        this.world.scene.getPhysicsEngine()?.getPhysicsPlugin() as HavokPlugin
      ).onTriggerCollisionObservable.add((event) => this.trigger(event))
    );

    this.physicsBodies.push(
      bodyPB,
      turretPB,
      barrelPB,
      refPB,
      ...this.axles.map((axle) => axle.physicsBody!),
      Ground.mesh.physicsBody!
    );
  }
  private createWheelConstraint(
    pivotA: Vector3,
    pivotB: Vector3,
    parent: PhysicsBody,
    child: PhysicsBody
  ): Physics6DoFConstraint {
    const _6dofConstraint = new Physics6DoFConstraint(
      {
        pivotA,
        pivotB,
        axisA: new Vector3(1, 0, 0),
        axisB: new Vector3(1, 0, 0),
        perpAxisA: new Vector3(0, 1, 0),
        perpAxisB: new Vector3(0, 1, 0)
      },
      [
        { axis: PhysicsConstraintAxis.LINEAR_X, minLimit: 0, maxLimit: 0 },
        {
          axis: PhysicsConstraintAxis.LINEAR_Y,
          minLimit: PlayerTank.config.suspensionMinLimit,
          maxLimit: PlayerTank.config.suspensionMaxLimit,
          stiffness: PlayerTank.config.suspensionStiffness,
          damping: PlayerTank.config.suspensionDamping
        },
        { axis: PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      this.world.scene
    );

    parent.addConstraint(child, _6dofConstraint);
    _6dofConstraint.setAxisFriction(PhysicsConstraintAxis.ANGULAR_X, PlayerTank.config.axleFriction);
    _6dofConstraint.setAxisMotorType(PhysicsConstraintAxis.ANGULAR_X, PhysicsConstraintMotorType.VELOCITY);
    _6dofConstraint.setAxisMotorMaxForce(PhysicsConstraintAxis.ANGULAR_X, PlayerTank.config.maxEnginePower);

    return _6dofConstraint;
  }
  private createBarrelConstraint(
    pivotA: Vector3,
    pivotB: Vector3,
    axisA: Vector3,
    axisB: Vector3,
    perpAxisA: Vector3,
    perpAxisB: Vector3,
    parent: PhysicsBody,
    child: PhysicsBody
  ): Physics6DoFConstraint {
    const _6dofConstraint = new Physics6DoFConstraint(
      {
        pivotA,
        pivotB,
        axisA,
        axisB,
        perpAxisA,
        perpAxisB
      },
      [
        { axis: PhysicsConstraintAxis.LINEAR_X, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.LINEAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
        {
          axis: PhysicsConstraintAxis.ANGULAR_X,
          minLimit: -PlayerTank.config.maxBarrelAngle,
          maxLimit: PlayerTank.config.maxBarrelAngle
        },
        { axis: PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      this.world.scene
    );

    parent.addConstraint(child, _6dofConstraint);
    _6dofConstraint.setAxisFriction(PhysicsConstraintAxis.ANGULAR_X, 1);
    _6dofConstraint.setAxisMotorType(PhysicsConstraintAxis.ANGULAR_X, PhysicsConstraintMotorType.VELOCITY);
    _6dofConstraint.setAxisMotorMaxForce(PhysicsConstraintAxis.ANGULAR_X, 100);

    return _6dofConstraint;
  }
  private createTurretConstraint(
    pivotA: Vector3,
    pivotB: Vector3,
    axisA: Vector3,
    axisB: Vector3,
    perpAxisA: Vector3,
    perpAxisB: Vector3,
    parent: PhysicsBody,
    child: PhysicsBody
  ): Physics6DoFConstraint {
    const _6dofConstraint = new Physics6DoFConstraint(
      {
        pivotA,
        pivotB,
        axisA,
        axisB,
        perpAxisA,
        perpAxisB
      },
      [
        { axis: PhysicsConstraintAxis.LINEAR_X, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.LINEAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_X, minLimit: 0, maxLimit: 0 },
        {
          axis: PhysicsConstraintAxis.ANGULAR_Y,
          minLimit: -PlayerTank.config.maxTurretAngle,
          maxLimit: PlayerTank.config.maxTurretAngle
        },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      this.world.scene
    );

    parent.addConstraint(child, _6dofConstraint);
    _6dofConstraint.setAxisFriction(PhysicsConstraintAxis.ANGULAR_Y, 1);
    _6dofConstraint.setAxisMotorType(PhysicsConstraintAxis.ANGULAR_Y, PhysicsConstraintMotorType.VELOCITY);
    _6dofConstraint.setAxisMotorMaxForce(PhysicsConstraintAxis.ANGULAR_Y, 100);

    return _6dofConstraint;
  }
  private setGUI() {
    const scope = new Image('ads', AssetLoader.assets['/assets/game/gui/ads.png'] as string);
    scope.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    scope.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    scope.autoScale = true;
    scope.width = '50%';
    scope.fixedRatio = 1;
    scope.stretch = Image.STRETCH_FILL;
    scope.shadowBlur = 3;
    scope.shadowColor = '#AFE1AF';
    scope.alpha = 0.8;
    scope.isVisible = false;
    scope.scaleX = 1.5;
    scope.scaleY = 1.5;
    scope.zIndex = -1;
    this.world.gui.addControl(scope);

    const overlay = new Image('overlay', AssetLoader.assets['/assets/game/gui/overlay.png'] as string);
    overlay.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    overlay.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    overlay.height = '100%';
    overlay.fixedRatio = 1;
    overlay.isVisible = false;
    overlay.zIndex = -1;
    this.world.gui.addControl(overlay);

    const padWidth = (this.world.engine.getRenderWidth(true) - this.world.engine.getRenderHeight(true)) / 2;
    const padLeft = new Rectangle('left-pad');
    padLeft.width = `${padWidth}px`;
    padLeft.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    padLeft.color = '#000';
    padLeft.background = '#000';
    padLeft.isVisible = false;
    padLeft.zIndex = -1;
    this.world.gui.addControl(padLeft);
    const padRight = new Rectangle('right-pad');
    padRight.width = `${padWidth}px`;
    padRight.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    padRight.color = '#000';
    padRight.background = '#000';
    padRight.isVisible = false;
    padRight.zIndex = -1;
    this.world.gui.addControl(padRight);

    this.sights.push(scope, overlay, padLeft, padRight);
  }
  private setPreStep(value: boolean) {
    this.body.physicsBody!.disablePreStep = value;
    this.turret.physicsBody!.disablePreStep = value;
    this.barrel.physicsBody!.disablePreStep = value;
    (this as unknown as PlayerTank).innerWheels.physicsBody!.disablePreStep = value;
    (this as unknown as PlayerTank).axles.forEach((axle) => (axle.physicsBody!.disablePreStep = value));
  }
  private beforeStep() {
    const now = performance.now();
    this.canFire = now - this.lastFiredTS > PlayerTank.config.cooldown;
    if (now - this.lastFiredTS > PlayerTank.config.loadCooldown && !this.canFire) {
      this.playSound('load');
    }

    this.animate(this.leftSpeed, this.rightSpeed);

    if (this.world.client.isMatchEnded) return;

    if (InputManager.keys[GameInputType.FIRE]) {
      this.fire(now);
    }
    if (InputManager.keys[GameInputType.CHANGE_PERSPECTIVE]) {
      this.toggleCamera();
      this.sights.forEach((ui) => (ui.isVisible = this.world.scene.activeCamera === this.cameras?.fpp));
    }
  }

  private accelerate(dt: number, turningDirection: -1 | 0 | 1) {
    if (turningDirection !== -1) {
      this.leftSpeed = clamp(
        this.leftSpeed + dt * PlayerTank.config.speedModifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
    }
    if (turningDirection !== 1) {
      this.rightSpeed = clamp(
        this.rightSpeed + dt * PlayerTank.config.speedModifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
    }

    this.axleMotors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  private reverse(dt: number, turningDirection: -1 | 0 | 1) {
    if (turningDirection !== -1) {
      this.leftSpeed = clamp(
        this.leftSpeed - dt * PlayerTank.config.speedModifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
    }
    if (turningDirection !== 1) {
      this.rightSpeed = clamp(
        this.rightSpeed - dt * PlayerTank.config.speedModifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
    }

    this.axleMotors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  private left(dt: number, isAccelerating: boolean) {
    if (!isAccelerating) {
      // If not accelerating, even-out speeds to prevent sudden halt
      this.leftSpeed = clamp(
        this.leftSpeed +
          (this.leftSpeed > -PlayerTank.config.maxTurningSpeed ? -1 : 1) *
            dt *
            PlayerTank.config.speedModifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed +
          (this.rightSpeed > PlayerTank.config.maxTurningSpeed ? -1 : 1) *
            dt *
            PlayerTank.config.decelerationModifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
    } else {
      // Reduce power of left axle to half of right axle
      this.leftSpeed = Scalar.Lerp(this.leftSpeed, this.rightSpeed / 2, dt * PlayerTank.config.speedModifier);
    }

    this.axleMotors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  private right(dt: number, isAccelerating: boolean) {
    if (!isAccelerating) {
      // If not accelerating, even out speeds
      this.leftSpeed = clamp(
        this.leftSpeed +
          (this.leftSpeed > PlayerTank.config.maxTurningSpeed ? -1 : 1) *
            dt *
            PlayerTank.config.decelerationModifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed +
          (this.rightSpeed > -PlayerTank.config.maxTurningSpeed ? -1 : 1) *
            dt *
            PlayerTank.config.speedModifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
    } else {
      // Reduce power of right axle to half of left axle
      this.rightSpeed = Scalar.Lerp(
        this.rightSpeed,
        this.leftSpeed / 2,
        dt * PlayerTank.config.speedModifier
      );
    }

    this.axleMotors.forEach((motor, idx) =>
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed)
    );
  }
  private brake(dt: number) {
    this.decelerate(dt, PlayerTank.config.speedModifier);
  }
  private decelerate(dt: number, modifier: number = PlayerTank.config.decelerationModifier) {
    let speed = 0;
    if (Math.abs(this.leftSpeed) < 0.1 && Math.abs(this.rightSpeed) < 0.1) {
      this.leftSpeed = this.rightSpeed = 0;
      speed = 0;
    } else {
      this.leftSpeed = clamp(
        this.leftSpeed + Math.sign(this.leftSpeed) * -1 * dt * modifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed + Math.sign(this.rightSpeed) * -1 * dt * modifier,
        -PlayerTank.config.maxSpeed,
        PlayerTank.config.maxSpeed
      );
      // Even out while decelerating
      speed = avg([this.leftSpeed, this.rightSpeed]);
    }

    this.axleMotors.forEach((motor) => motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, speed));
  }
  private turretLeft(dt: number) {
    this.turretMotor.setAxisMotorTarget(
      PhysicsConstraintAxis.ANGULAR_Y,
      -dt * PlayerTank.config.maxTurretSpeed
    );
  }
  private turretRight(dt: number) {
    this.turretMotor.setAxisMotorTarget(
      PhysicsConstraintAxis.ANGULAR_Y,
      dt * PlayerTank.config.maxTurretSpeed
    );
  }
  private stopTurret() {
    this.turretMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_Y, 0);
  }
  private barrelUp(dt: number) {
    this.barrelMotor.setAxisMotorTarget(
      PhysicsConstraintAxis.ANGULAR_X,
      -dt * PlayerTank.config.maxBarrelSpeed
    );
  }
  private barrelDown(dt: number) {
    this.barrelMotor.setAxisMotorTarget(
      PhysicsConstraintAxis.ANGULAR_X,
      dt * PlayerTank.config.maxBarrelSpeed
    );
  }
  private stopBarrel() {
    this.barrelMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, 0);
  }
  private resetTurret(dt: number) {
    const turretEuler = this.turret.rotationQuaternion!.toEulerAngles();
    const barrelEuler = this.barrel.rotationQuaternion!.toEulerAngles();

    if (Math.abs(turretEuler.y) > 0.01) {
      turretEuler.y < 0 ? this.turretRight(dt) : this.turretLeft(dt);
    }
    if (Math.abs(barrelEuler.x) > 0.01) {
      barrelEuler.x < 0 ? this.barrelDown(dt) : this.barrelUp(dt);
    }
  }
  private toggleCamera() {
    if (performance.now() - this.lastCameraToggle > this.cameraToggleDelay) {
      if (this.world.scene.activeCamera?.name === 'tpp-cam') {
        this.world.scene.activeCamera = this.cameras.fpp;
      } else {
        this.world.scene.activeCamera = this.cameras.tpp;
      }
      this.lastCameraToggle = performance.now();
    }
  }
  private fire(now: number) {
    if (now - this.lastFiredTS <= PlayerTank.config.cooldown) return false;

    this.loadedDummyShell.fire();
    this.simulateRecoil();
    this.particleSystems['muzzle']?.start();
    this.sounds['cannon']?.play();
    Shell.create(this).then((shell) => (this.loadedDummyShell = shell));

    this.lastFiredTS = now;
    return true;
  }

  reconcile() {
    const lastProcessedInput = this.state.lastProcessedInput;

    if (
      lastProcessedInput.step < 0 ||
      InputManager.history.length === 0 ||
      lastProcessedInput.step < InputManager.history.seek()!.step
    ) {
      return;
    }

    this.isReconciling = true;

    // 1. Accept authoritative state
    this.world.scene.setStepId(lastProcessedInput.step);
    this.updateTransform();
    this.axleMotors.forEach((motor, idx) =>
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed)
    );

    // 2. Discard all historical messages upto last-processed-message
    const startStepId = InputManager.cull(lastProcessedInput);

    // 3. Replay all messages till present (Prediction)
    const historyInfo = InputManager.getHistory();
    if (typeof historyInfo.targetStep !== 'undefined') {
      this.replay(historyInfo.history, startStepId, historyInfo.targetStep);
    }

    this.isReconciling = false;
  }
  private replay(history: Record<number, IInputHistory>, currStepId: number, targetStepId: number) {
    while (currStepId <= targetStepId) {
      this.applyInputs(history[currStepId].message.input);
      this.world.scene._advancePhysicsEngineStep(World.deltaTime);
      if (currStepId !== targetStepId) {
        this.world.scene.setStepId(currStepId);
      }
      currStepId += 1;
    }

    /* // Correction if prediction error is acceptable, < 0.005
    if (history[targetStepId].transform.position.equalsWithEpsilon(this.body.position, 0.005)) {
      this.body.position.copyFrom(history[targetStepId].transform.position.clone());
    }
    if (history[targetStepId].transform.rotation.equalsWithEpsilon(this.body.rotationQuaternion!, 0.005)) {
      this.body.rotationQuaternion?.copyFrom(history[targetStepId].transform.rotation.clone());
    }
    if (
      history[targetStepId].transform.turretRotation.equalsWithEpsilon(this.turret.rotationQuaternion!, 0.005)
    ) {
      this.turret.rotationQuaternion?.copyFrom(history[targetStepId].transform.turretRotation.clone());
    }
    if (
      history[targetStepId].transform.barrelRotation.equalsWithEpsilon(this.barrel.rotationQuaternion!, 0.005)
    ) {
      this.barrel.rotationQuaternion?.copyFrom(history[targetStepId].transform.barrelRotation.clone());
    } */
  }
  private updateTransform() {
    this.leftSpeed = this.state.leftSpeed;
    this.rightSpeed = this.state.rightSpeed;

    this.body.position.set(this.state.position.x, this.state.position.y, this.state.position.z);
    this.body.rotationQuaternion =
      this.body.rotationQuaternion?.set(
        this.state.rotation.x,
        this.state.rotation.y,
        this.state.rotation.z,
        this.state.rotation.w
      ) ??
      new Quaternion(
        this.state.rotation.x,
        this.state.rotation.y,
        this.state.rotation.z,
        this.state.rotation.w
      );

    this.turret.rotationQuaternion =
      this.turret.rotationQuaternion?.set(
        this.state.turretRotation.x,
        this.state.turretRotation.y,
        this.state.turretRotation.z,
        this.state.turretRotation.w
      ) ??
      new Quaternion(
        this.state.turretRotation.x,
        this.state.turretRotation.y,
        this.state.turretRotation.z,
        this.state.turretRotation.w
      );
    this.barrel.rotationQuaternion =
      this.barrel.rotationQuaternion?.set(
        this.state.barrelRotation.x,
        this.state.barrelRotation.y,
        this.state.barrelRotation.z,
        this.state.barrelRotation.w
      ) ??
      new Quaternion(
        this.state.barrelRotation.x,
        this.state.barrelRotation.y,
        this.state.barrelRotation.z,
        this.state.barrelRotation.w
      );
  }

  applyInputs(input: PlayerInputs) {
    let isMoving = false;
    const turningDirection = input[GameInputType.LEFT] ? -1 : input[GameInputType.RIGHT] ? 1 : 0;
    const isAccelerating = input[GameInputType.FORWARD] || input[GameInputType.REVERSE];
    let isTurretMoving = input[GameInputType.TURRET_LEFT] || input[GameInputType.TURRET_RIGHT];
    const isBarrelMoving = input[GameInputType.BARREL_UP] || input[GameInputType.BARREL_DOWN];

    if (input[GameInputType.FORWARD]) {
      this.accelerate(World.deltaTime, turningDirection);
      isMoving = true;
    }
    if (input[GameInputType.REVERSE]) {
      this.reverse(World.deltaTime, turningDirection);
      isMoving = true;
    }
    if (input[GameInputType.LEFT]) {
      this.left(World.deltaTime, !!isAccelerating);
      isMoving = true;
    }
    if (input[GameInputType.RIGHT]) {
      this.right(World.deltaTime, !!isAccelerating);
      isMoving = true;
    }
    if (input[GameInputType.BRAKE]) {
      this.brake(World.deltaTime);
    }
    if (!isMoving) {
      this.decelerate(World.deltaTime);
    }
    if (!isTurretMoving) {
      this.stopTurret();
    }
    if (!isBarrelMoving) {
      this.stopBarrel();
    }
    if (input[GameInputType.TURRET_LEFT]) {
      this.turretLeft(World.deltaTime);
    }
    if (input[GameInputType.TURRET_RIGHT]) {
      this.turretRight(World.deltaTime);
    }
    if (input[GameInputType.BARREL_UP]) {
      this.barrelUp(World.deltaTime);
    }
    if (input[GameInputType.BARREL_DOWN]) {
      this.barrelDown(World.deltaTime);
    }
    if (input[GameInputType.RESET] && !isTurretMoving && !isBarrelMoving) {
      this.resetTurret(World.deltaTime);
      isTurretMoving = true;
    }

    this.playSounds(isMoving, !!isBarrelMoving || !!isTurretMoving);
  }
}
