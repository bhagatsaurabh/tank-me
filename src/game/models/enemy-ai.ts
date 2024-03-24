import {
  TransformNode,
  type AbstractMesh,
  type Mesh,
  MeshBuilder,
  Tools,
  FreeCamera,
  Ray
} from '@babylonjs/core';
import { Vector3, Axis, Space, Scalar } from '@babylonjs/core/Maths';
import {
  PhysicsShapeConvexHull,
  PhysicsShapeContainer,
  PhysicsBody,
  PhysicsMotionType,
  Physics6DoFConstraint,
  PhysicsShapeSphere,
  PhysicsAggregate,
  PhysicsConstraintAxis,
  PhysicsConstraintMotorType
} from '@babylonjs/core/Physics';

import { World } from '../main';
import { Tank } from './tank';
import { avg, clamp, forwardVector } from '@/utils/utils';
import { GameInputType, type EnemyAIState, type PlayerInputs } from '@/types/types';
import { Shell } from './shell';
import { Ground } from './ground';

export class EnemyAITank extends Tank {
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
    cooldown: 5000,
    loadCooldown: 2500,
    headingCorrectionCooldown: 1000
  };
  private axleJoints: TransformNode[] = [];
  axles: Mesh[] = [];
  private axleMotors: Physics6DoFConstraint[] = [];
  private barrelMotor!: Physics6DoFConstraint;
  private turretMotor!: Physics6DoFConstraint;
  leftSpeed: number = 0;
  rightSpeed: number = 0;
  private lastFiredTS = 0;
  physicsBodies: PhysicsBody[] = [];
  canFire = false;
  health: number = 100;
  memory: { nextPosition?: Vector3; lastKnownPlayerPosition?: Vector3; lastHeadingCorrectionTS: number } = {
    lastHeadingCorrectionTS: 0
  };
  aiState: EnemyAIState = 'roam';
  camera!: FreeCamera;

  constructor(world: World, rootMesh: AbstractMesh, spawn: Vector3) {
    super(world, null);

    if (world.vsAI) this.lid = 'Enemy';
    this.setTransform(rootMesh, spawn);
    this.setPhysics(rootMesh as Mesh);
    this.setCamera();

    this.observers.push(this.world.scene.onBeforeStepObservable.add(this.beforeStep.bind(this)));
    this.observers.push(this.world.scene.onAfterRenderObservable.add(this.afterRender.bind(this)));
  }
  static async create(world: World, rootMesh: AbstractMesh, spawn: Vector3) {
    const cloned = rootMesh.clone(`${rootMesh.name.replace(':Ref', '')}:Enemy`, null)!;
    const newTank = new EnemyAITank(world, cloned, spawn);
    await newTank.init();
    newTank.setPreStep(true);
    newTank.memory.nextPosition = spawn.clone();

    return newTank;
  }

  private forwardToRefAngle(object: TransformNode, ref: Vector3) {
    const forwardRef = object.getDirection(forwardVector).normalize().scaleInPlace(10);

    const p1 = forwardRef.add(object.position);
    p1.y = object.position.y;
    const p2 = object.position.clone();
    const p3 = ref.clone();
    p3.y = object.position.y;

    // Reference point is to the left or right of object, 0 = exactly to the front
    let toLeftOrRight = ref.subtract(object.position).cross(forwardRef).dot(Vector3.Up());
    if (Math.abs(toLeftOrRight) <= 0.001) {
      toLeftOrRight = 0;
    } else {
      toLeftOrRight = Math.sign(toLeftOrRight);
    }
    return {
      // +1 = Left, -1 = Right, 0 = Front
      orientation: toLeftOrRight,
      angle: Tools.ToDegrees(Math.acos(Vector3.Dot(p1.subtract(p2).normalize(), p3.subtract(p2).normalize())))
    };
  }

  private setTransform(rootMesh: AbstractMesh, spawn: Vector3) {
    this.mesh = rootMesh;
    const body = new TransformNode(`Root:${rootMesh.name}`, this.world.scene);
    for (let i = 0; i < EnemyAITank.config.noOfWheels; i += 1) {
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
      friction: EnemyAITank.config.bodyFriction,
      restitution: EnemyAITank.config.bodyRestitution
    };
    bodyPB.shape = bodyShapeContainer;
    bodyPB.setMassProperties({ mass: EnemyAITank.config.bodyMass, centerOfMass: Vector3.Zero() });

    const turretShape = new PhysicsShapeConvexHull(this.turret as Mesh, this.world.scene);
    turretShape.material = { friction: 0, restitution: 0 };
    const turretPB = new PhysicsBody(this.turret, PhysicsMotionType.DYNAMIC, false, this.world.scene);
    turretPB.shape = turretShape;
    turretPB.setMassProperties({ mass: EnemyAITank.config.turretMass, centerOfMass: Vector3.Zero() });
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
    barrelPB.setMassProperties({ mass: EnemyAITank.config.barrelMass, centerOfMass: Vector3.Zero() });
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
    for (let i = 0; i < EnemyAITank.config.noOfWheels; i += 1) {
      const axleJoint = this.axleJoints[i];
      const axle = this.axles[i];

      axle.position = Vector3.Zero();
      axleJoint.parent = this.body;
      axleJoint.position = wheelPositions[i];

      const axleAgg = new PhysicsAggregate(
        axle,
        axleShape,
        {
          mass: EnemyAITank.config.wheelMass,
          friction: EnemyAITank.config.wheelFriction,
          restitution: EnemyAITank.config.wheelRestitution
        },
        this.world.scene
      );
      (axle as Mesh).collisionRetryCount = 5;

      this.axleMotors.push(
        this.createWheelConstraint(wheelPositions[i], axle.position, bodyPB, axleAgg.body)
      );
      this.axles.push(axle);
    }

    this.physicsBodies.push(
      bodyPB,
      turretPB,
      barrelPB,
      ...this.axles.map((axle) => axle.physicsBody!),
      Ground.mesh.physicsBody!
    );
  }
  private setCamera() {
    this.camera = new FreeCamera('enemy-cam', new Vector3(1, 2, 2), this.world.scene);
    this.camera.parent = this.body;
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
          minLimit: EnemyAITank.config.suspensionMinLimit,
          maxLimit: EnemyAITank.config.suspensionMaxLimit,
          stiffness: EnemyAITank.config.suspensionStiffness,
          damping: EnemyAITank.config.suspensionDamping
        },
        { axis: PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      this.world.scene
    );

    parent.addConstraint(child, _6dofConstraint);
    _6dofConstraint.setAxisFriction(PhysicsConstraintAxis.ANGULAR_X, EnemyAITank.config.axleFriction);
    _6dofConstraint.setAxisMotorType(PhysicsConstraintAxis.ANGULAR_X, PhysicsConstraintMotorType.VELOCITY);
    _6dofConstraint.setAxisMotorMaxForce(PhysicsConstraintAxis.ANGULAR_X, EnemyAITank.config.maxEnginePower);

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
          minLimit: -EnemyAITank.config.maxBarrelAngle,
          maxLimit: EnemyAITank.config.maxBarrelAngle
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
          minLimit: -EnemyAITank.config.maxTurretAngle,
          maxLimit: EnemyAITank.config.maxTurretAngle
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
  private setPreStep(value: boolean) {
    this.body.physicsBody!.disablePreStep = value;
    this.turret.physicsBody!.disablePreStep = value;
    this.barrel.physicsBody!.disablePreStep = value;
    (this as unknown as EnemyAITank).axles.forEach((axle) => (axle.physicsBody!.disablePreStep = value));
  }
  private afterRender() {
    if (this.world.client.isMatchEnded) return;

    if (this.camera.isInFrustum(this.world.player.mesh)) {
      this.memory.lastKnownPlayerPosition = this.world.player.turret.absolutePosition.clone();
      const ray = new Ray(
        this.turret.absolutePosition,
        this.memory.lastKnownPlayerPosition.subtract(this.turret.absolutePosition).normalize(),
        700
      );

      const info = this.world.scene.pickWithRay(
        ray,
        (mesh: AbstractMesh) => mesh.name.includes('Player') || mesh.name.includes('ground')
      );
      this.aiState = info?.hit && info.pickedMesh?.name.includes('Player') ? 'combat' : 'track';
    } else {
      this.aiState = 'track';
    }
  }
  private beforeStep() {
    if (this.world.client.isMatchEnded) return;

    this.applyInputs(this.computeInputs());

    this.animate(this.leftSpeed, this.rightSpeed);

    if (this.world.client.isMatchEnded) return;
  }

  private accelerate(dt: number, turningDirection: -1 | 0 | 1) {
    if (turningDirection !== -1) {
      this.leftSpeed = clamp(
        this.leftSpeed + dt * EnemyAITank.config.speedModifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
    }
    if (turningDirection !== 1) {
      this.rightSpeed = clamp(
        this.rightSpeed + dt * EnemyAITank.config.speedModifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
    }

    this.axleMotors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  private reverse(dt: number, turningDirection: -1 | 0 | 1) {
    if (turningDirection !== -1) {
      this.leftSpeed = clamp(
        this.leftSpeed - dt * EnemyAITank.config.speedModifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
    }
    if (turningDirection !== 1) {
      this.rightSpeed = clamp(
        this.rightSpeed - dt * EnemyAITank.config.speedModifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
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
          (this.leftSpeed > -EnemyAITank.config.maxTurningSpeed ? -1 : 1) *
            dt *
            EnemyAITank.config.speedModifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed +
          (this.rightSpeed > EnemyAITank.config.maxTurningSpeed ? -1 : 1) *
            dt *
            EnemyAITank.config.decelerationModifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
    } else {
      // Reduce power of left axle to half of right axle
      this.leftSpeed = Scalar.Lerp(
        this.leftSpeed,
        this.rightSpeed / 2,
        dt * EnemyAITank.config.speedModifier
      );
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
          (this.leftSpeed > EnemyAITank.config.maxTurningSpeed ? -1 : 1) *
            dt *
            EnemyAITank.config.decelerationModifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed +
          (this.rightSpeed > -EnemyAITank.config.maxTurningSpeed ? -1 : 1) *
            dt *
            EnemyAITank.config.speedModifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
    } else {
      // Reduce power of right axle to half of left axle
      this.rightSpeed = Scalar.Lerp(
        this.rightSpeed,
        this.leftSpeed / 2,
        dt * EnemyAITank.config.speedModifier
      );
    }

    this.axleMotors.forEach((motor, idx) =>
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed)
    );
  }
  private brake(dt: number) {
    this.decelerate(dt, EnemyAITank.config.speedModifier);
  }
  private decelerate(dt: number, modifier: number = EnemyAITank.config.decelerationModifier) {
    let speed = 0;
    if (Math.abs(this.leftSpeed) < 0.1 && Math.abs(this.rightSpeed) < 0.1) {
      this.leftSpeed = this.rightSpeed = 0;
      speed = 0;
    } else {
      this.leftSpeed = clamp(
        this.leftSpeed + Math.sign(this.leftSpeed) * -1 * dt * modifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed + Math.sign(this.rightSpeed) * -1 * dt * modifier,
        -EnemyAITank.config.maxSpeed,
        EnemyAITank.config.maxSpeed
      );
      // Even out while decelerating
      speed = avg([this.leftSpeed, this.rightSpeed]);
    }

    this.axleMotors.forEach((motor) => motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, speed));
  }
  private turretLeft(dt: number) {
    this.turretMotor.setAxisMotorTarget(
      PhysicsConstraintAxis.ANGULAR_Y,
      -dt * EnemyAITank.config.maxTurretSpeed
    );
  }
  private turretRight(dt: number) {
    this.turretMotor.setAxisMotorTarget(
      PhysicsConstraintAxis.ANGULAR_Y,
      dt * EnemyAITank.config.maxTurretSpeed
    );
  }
  private stopTurret() {
    this.turretMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_Y, 0);
  }
  private barrelUp(dt: number) {
    this.barrelMotor.setAxisMotorTarget(
      PhysicsConstraintAxis.ANGULAR_X,
      -dt * EnemyAITank.config.maxBarrelSpeed
    );
  }
  private barrelDown(dt: number) {
    this.barrelMotor.setAxisMotorTarget(
      PhysicsConstraintAxis.ANGULAR_X,
      dt * EnemyAITank.config.maxBarrelSpeed
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
  private fire(now: number) {
    if (now - this.lastFiredTS <= EnemyAITank.config.cooldown) return false;

    this.loadedShell.fire();
    this.simulateRecoil();
    this.particleSystems['muzzle']?.start();
    this.sounds['cannon']?.play();
    Shell.create(this).then((shell) => (this.loadedShell = shell));

    this.lastFiredTS = now;
    return true;
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

  computeInputs(): PlayerInputs {
    const now = performance.now();
    const inputs: PlayerInputs = {};

    if (this.aiState === 'roam' || this.aiState === 'track') {
      // If tracking and player's last known position doesn't exist, switch to roam
      if (this.aiState === 'track' && !this.memory.lastKnownPlayerPosition) {
        this.aiState = 'roam';
        return inputs;
      }

      // Player's last known position if tracking or a random position on map if roaming
      const targetPos =
        this.aiState === 'roam'
          ? this.memory.nextPosition!.clone()
          : this.memory.lastKnownPlayerPosition!.clone();

      // If reached to the target position, switch to next random position on map
      if (Vector3.Distance(this.body.absolutePosition, targetPos) <= 2) {
        // This will also work if in tracking state and player's last known position is reached
        this.memory.nextPosition = Vector3.Random(-230, 230);
        this.memory.nextPosition!.y = Ground.mesh.getHeightAtCoordinates(
          this.memory.nextPosition!.x,
          this.memory.nextPosition!.z
        );
        this.aiState = 'roam';
      }

      const info = this.forwardToRefAngle(this.body, targetPos);

      inputs[GameInputType.FORWARD] = true;
      if (
        now - this.memory.lastHeadingCorrectionTS! > EnemyAITank.config.headingCorrectionCooldown ||
        info.angle > 2.5
      ) {
        if (info.orientation < 0) inputs[GameInputType.RIGHT] = true;
        else if (info.orientation > 0) inputs[GameInputType.LEFT] = true;
        this.memory.lastHeadingCorrectionTS = now;
      }
    } else if (this.aiState === 'combat') {
      // TODO
      // 1. Stop
      // 2. Align body if not aligned
      // 3. Align turret if not aligned
      // 4. Predict barrel alignment
      this.fire(now);
    }

    return inputs;
  }
}
