import { Scene, type Nullable, Ray } from '@babylonjs/core';
import { Sound } from '@babylonjs/core/Audio';
import { FollowCamera, FreeCamera } from '@babylonjs/core/Cameras';
import { Scalar, Vector3, Space, Axis } from '@babylonjs/core/Maths';
import { AbstractMesh, Mesh, MeshBuilder } from '@babylonjs/core/Meshes';
import { PBRMaterial, Texture } from '@babylonjs/core/Materials';
import {
  PhysicsShapeConvexHull,
  PhysicsConstraintMotorType,
  PhysicsShapeType,
  PhysicsShapeContainer,
  PhysicsMotionType,
  PhysicsConstraintAxis,
  Physics6DoFConstraint,
  PhysicsBody,
  PhysicsAggregate
} from '@babylonjs/core/Physics';

import { Shell } from './shell';
import { avg, clamp } from '@/utils/utils';
import { PSExhaust } from '../particle-systems/exhaust';
import { PSDust } from '../particle-systems/dust';
import { PSMuzzle } from '../particle-systems/muzzle';

export class Tank {
  public barrel!: AbstractMesh;
  private barrelMotor!: Physics6DoFConstraint;
  private turret!: AbstractMesh;
  private turretMotor!: Physics6DoFConstraint;
  public leftTrack!: AbstractMesh;
  public rightTrack!: AbstractMesh;
  public leftExhaust!: AbstractMesh;
  public rightExhaust!: AbstractMesh;
  private axles: Mesh[] = [];
  private motors: Physics6DoFConstraint[] = [];
  private shell!: Shell;
  private body!: Mesh;
  private wheelMeshes: Mesh[] = [];
  private axleMeshes: Mesh[] = [];
  private sounds: Record<string, Sound> = {};
  private particleSystems: Record<string, PSExhaust | PSDust | PSMuzzle> = {};
  private isStuck = false;
  private isCanonReady = true;
  private lastFired = 0;
  private cooldown = 2000;
  private loadCooldown = 1000;
  private lastCameraToggle = 0;
  private cameraToggleDelay = 1000;
  private maxEnginePower = 100;
  private speedModifier = 10;
  private decelerationModifier = 4;
  public leftSpeed = 0;
  public rightSpeed = 0;
  private maxSpeed = 15;
  private maxTurningSpeed = 3;
  private maxTurretAngle = 1.17; // ~67.5 deg
  private maxBarrelAngle = 0.61; // ~35 deg
  private turretSpeed = 14;
  private barrelSpeed = 14;
  private bodyMass = 2;
  private bodyFriction = 1;
  private bodyRestitution = 0;
  private wheelMass = 1;
  private wheelFriction = 0.8;
  private wheelRestitution = 0;
  private turretMass = 0.2;
  private barrelMass = 0.09;
  private axleFriction = 0;
  private suspensionMinLimit = -0.2;
  private suspensionMaxLimit = 0.033;
  private suspensionStiffness = 100;
  private suspensionDamping = 7;
  private noOfWheels = 10;
  private recoilEnergy = 7.5;

  private constructor(
    public rootMesh: AbstractMesh,
    public spawn: Vector3,
    public scene: Scene,
    public cameras: Nullable<{ tpp: FollowCamera; fpp: FreeCamera }>,
    public isEnemy: boolean = false
  ) {
    this.setTransform();
    this.setPhysics();
    this.setParticleSystems();
    this.setLights();

    if (!isEnemy && cameras?.tpp && cameras.fpp) {
      // cameras.tpp.position = new Vector3(spawn.x + 1, spawn.y + 1, spawn.z + 1);
      // cameras.tpp.lockedTarget = rootMesh;
      cameras.fpp.parent = this.barrel;
    }

    this.scene.onAfterStepObservable.add(this.step.bind(this));
  }

  private setTransform() {
    this.body = new Mesh(`Root:${this.rootMesh.name}`, this.scene);
    for (let i = 0; i < this.noOfWheels; i += 1) {
      const wheelMesh = new Mesh(`wheel${i}`, this.scene);
      const axleMesh = MeshBuilder.CreateSphere(
        `axle${i}`,
        { diameterY: 0.6, diameterX: 0.75, diameterZ: 0.75, segments: 5 },
        this.scene
      );
      axleMesh.rotate(Axis.Z, Math.PI / 2, Space.LOCAL);
      axleMesh.bakeCurrentTransformIntoVertices();
      (wheelMesh as AbstractMesh).addChild(axleMesh);
      wheelMesh.isVisible = false;
      axleMesh.isVisible = false;
      this.wheelMeshes.push(wheelMesh);
      this.axleMeshes.push(axleMesh);
    }

    this.rootMesh.position = Vector3.Zero();
    const childMeshes = this.rootMesh.getChildMeshes();
    this.barrel = childMeshes[0];
    this.rightExhaust = childMeshes[1];
    this.leftExhaust = childMeshes[2];
    this.leftTrack = childMeshes[4];
    this.rightTrack = childMeshes[5];
    this.turret = childMeshes[6];
    this.barrel.position.y = -0.51;
    this.barrel.position.z = 1.79;
    this.barrel.parent = this.turret;
    this.rootMesh.parent = this.body;
    this.body.position = this.spawn;

    this.rootMesh.isVisible = true;
    childMeshes.forEach((mesh) => (mesh.isVisible = true));
  }
  private setPhysics() {
    const bodyShape = new PhysicsShapeConvexHull(this.rootMesh as Mesh, this.scene);
    const bodyShapeContainer = new PhysicsShapeContainer(this.scene);
    bodyShapeContainer.addChildFromParent(this.body, bodyShape, this.rootMesh);
    const bodyPB = new PhysicsBody(this.body, PhysicsMotionType.DYNAMIC, false, this.scene);
    bodyShapeContainer.material = { friction: this.bodyFriction, restitution: this.bodyRestitution };
    bodyPB.shape = bodyShapeContainer;
    bodyPB.setMassProperties({ mass: this.bodyMass, centerOfMass: Vector3.Zero() });

    const turretShape = new PhysicsShapeConvexHull(this.turret as Mesh, this.scene);
    turretShape.material = { friction: 0, restitution: 0 };
    const turretPB = new PhysicsBody(this.turret, PhysicsMotionType.DYNAMIC, false, this.scene);
    turretPB.shape = turretShape;
    turretPB.setMassProperties({ mass: this.turretMass, centerOfMass: Vector3.Zero() });
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

    const barrelShape = new PhysicsShapeConvexHull(this.barrel as Mesh, this.scene);
    barrelShape.material = { friction: 0, restitution: 0 };
    const barrelPB = new PhysicsBody(this.barrel, PhysicsMotionType.DYNAMIC, false, this.scene);
    barrelPB.shape = barrelShape;
    barrelPB.setMassProperties({ mass: this.barrelMass, centerOfMass: Vector3.Zero() });
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
    for (let i = 0; i < this.noOfWheels; i += 1) {
      const wheel = this.wheelMeshes[i];
      const axle = this.axleMeshes[i];

      axle.position = Vector3.Zero();
      wheel.parent = this.body;
      wheel.position = wheelPositions[i];

      const axleAgg = new PhysicsAggregate(
        axle,
        PhysicsShapeType.SPHERE,
        {
          mass: this.wheelMass,
          friction: this.wheelFriction,
          restitution: this.wheelRestitution
        },
        this.scene
      );
      axle.collisionRetryCount = 5;

      this.motors.push(this.createWheelConstraint(wheelPositions[i], axle.position, bodyPB, axleAgg.body));
      this.axles.push(axle);
    }

    // Debug
    // this.axles.forEach((axle) => TankMe.physicsViewer.showBody(axle.physicsBody!));
    // this.motors.forEach((motor) => TankMe.physicsViewer.showConstraint(motor));
    // TankMe.physicsViewer.showBody(bodyPB);

    this.cameras!.tpp.position = new Vector3(
      this.wheelMeshes[0].position.x + 0.5,
      this.wheelMeshes[0].position.y + 0.5,
      this.wheelMeshes[0].position.z + 0.5
    );
    this.cameras!.tpp.lockedTarget = this.wheelMeshes[0];
  }
  private setLights() {
    // TODO
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
          minLimit: this.suspensionMinLimit,
          maxLimit: this.suspensionMaxLimit,
          stiffness: this.suspensionStiffness,
          damping: this.suspensionDamping
        },
        { axis: PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      this.scene
    );

    parent.addConstraint(child, _6dofConstraint);
    _6dofConstraint.setAxisFriction(PhysicsConstraintAxis.ANGULAR_X, this.axleFriction);
    _6dofConstraint.setAxisMotorType(PhysicsConstraintAxis.ANGULAR_X, PhysicsConstraintMotorType.VELOCITY);
    _6dofConstraint.setAxisMotorMaxForce(PhysicsConstraintAxis.ANGULAR_X, this.maxEnginePower);

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
          minLimit: -this.maxBarrelAngle,
          maxLimit: this.maxBarrelAngle
        },
        { axis: PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      this.scene
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
          minLimit: -this.maxTurretAngle,
          maxLimit: this.maxTurretAngle
        },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      this.scene
    );

    parent.addConstraint(child, _6dofConstraint);
    _6dofConstraint.setAxisFriction(PhysicsConstraintAxis.ANGULAR_Y, 1);
    _6dofConstraint.setAxisMotorType(PhysicsConstraintAxis.ANGULAR_Y, PhysicsConstraintMotorType.VELOCITY);
    _6dofConstraint.setAxisMotorMaxForce(PhysicsConstraintAxis.ANGULAR_Y, 100);

    return _6dofConstraint;
  }
  private async setSoundSources() {
    const promises: Promise<boolean>[] = [];
    promises.push(
      new Promise((resolve) => {
        this.sounds['cannon'] = new Sound(
          'cannon',
          '/assets/game/audio/cannon.mp3',
          this.scene,
          () => resolve(true),
          {
            loop: false,
            autoplay: false,
            spatialSound: true,
            maxDistance: 250,
            volume: 1
          }
        );
      })
    );
    promises.push(
      new Promise((resolve) => {
        this.sounds['idle'] = new Sound(
          'idle',
          '/assets/game/audio/idle.mp3',
          this.scene,
          () => resolve(true),
          {
            loop: true,
            autoplay: false,
            spatialSound: true,
            maxDistance: 50
          }
        );
      })
    );
    promises.push(
      new Promise((resolve) => {
        this.sounds['move'] = new Sound(
          'move',
          '/assets/game/audio/run.mp3',
          this.scene,
          () => resolve(true),
          {
            loop: true,
            autoplay: false,
            spatialSound: true,
            maxDistance: 70
          }
        );
      })
    );
    promises.push(
      new Promise((resolve) => {
        this.sounds['explode'] = new Sound(
          'explode',
          '/assets/game/audio/explosion.mp3',
          this.scene,
          () => resolve(true),
          {
            loop: false,
            autoplay: false,
            spatialSound: true,
            maxDistance: 160
          }
        );
      })
    );
    promises.push(
      new Promise((resolve) => {
        this.sounds['load'] = new Sound(
          'load',
          '/assets/game/audio/load.mp3',
          this.scene,
          () => resolve(true),
          {
            loop: false,
            autoplay: false,
            spatialSound: false,
            maxDistance: 30
          }
        );
      })
    );

    Object.values(this.sounds).forEach((sound) => sound.attachToMesh(this.rootMesh));

    return Promise.all(promises);
  }
  private async loadCannon(init = false) {
    if (!init) this.sounds['load'].play();
    this.shell = await Shell.create(this);
    this.isCanonReady = true;
  }
  private setParticleSystems() {
    this.particleSystems['exhaust-left'] = PSExhaust.create(this.leftExhaust, this.scene);
    this.particleSystems['exhaust-right'] = PSExhaust.create(this.rightExhaust, this.scene);
    this.particleSystems['dust-left'] = PSDust.create(this.leftTrack, this.scene);
    this.particleSystems['dust-right'] = PSDust.create(this.rightTrack, this.scene);
    this.particleSystems['muzzle'] = PSMuzzle.create(this.barrel, this.scene);
    /* this.particleSystems['tank-explosion'] = PSTankExplosion.create(this.rootMesh, this.scene);
    this.particleSystems['fire'] = PSFire.create(this.rootMesh, this.scene); */
  }
  private step() {
    this.animateTracks();
    this.checkCannon();
  }
  private animateTracks() {
    // Bug: Turning while stationary doesn't seems to visually update the track movements
    if (this.leftSpeed > 0) {
      ((this.leftTrack.material as PBRMaterial).albedoTexture as Texture).vOffset += this.leftSpeed * 0.001;
    }
    if (this.rightSpeed > 0) {
      ((this.rightTrack.material as PBRMaterial).albedoTexture as Texture).vOffset += this.rightSpeed * 0.001;
    }

    // Dust trail
    if (this.leftSpeed === 0 || this.rightSpeed === 0) {
      this.particleSystems['dust-left'].stop();
      this.particleSystems['dust-right'].stop();
    } else {
      this.particleSystems['dust-left'].start();
      this.particleSystems['dust-right'].start();
    }
  }
  private checkCannon() {
    const now = performance.now();
    if (!this.isCanonReady && now - this.lastFired > this.loadCooldown) {
      // Takes few ticks, explicitly setting isCanonReady to prevent multiple loads
      this.loadCannon();
      this.isCanonReady = true;
    }
  }
  private simulateRecoil() {
    const recoilVector = this.turret
      .getDirection(new Vector3(0, 1, -1))
      .normalize()
      .scale(this.recoilEnergy);
    const contactPoint = this.body.up
      .normalize()
      .scale(1)
      .add(this.body.absolutePosition)
      .add(this.turret.forward.normalize().scale(1));
    this.body.physicsBody!.applyImpulse(recoilVector, contactPoint);
  }

  public accelerate(dt: number, turningDirection: -1 | 0 | 1) {
    if (turningDirection !== -1) {
      this.leftSpeed = clamp(this.leftSpeed + dt * this.speedModifier, -this.maxSpeed, this.maxSpeed);
    }
    if (turningDirection !== 1) {
      this.rightSpeed = clamp(this.rightSpeed + dt * this.speedModifier, -this.maxSpeed, this.maxSpeed);
    }

    this.motors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  public reverse(dt: number, turningDirection: -1 | 0 | 1) {
    if (turningDirection !== -1) {
      this.leftSpeed = clamp(this.leftSpeed - dt * this.speedModifier, -this.maxSpeed, this.maxSpeed);
    }
    if (turningDirection !== 1) {
      this.rightSpeed = clamp(this.rightSpeed - dt * this.speedModifier, -this.maxSpeed, this.maxSpeed);
    }

    this.motors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  public left(dt: number, isAccelerating: boolean) {
    if (!isAccelerating) {
      // If not accelerating, even-out speeds to prevent sudden halt
      this.leftSpeed = clamp(
        this.leftSpeed + (this.leftSpeed > -this.maxTurningSpeed ? -1 : 1) * dt * this.speedModifier,
        -this.maxSpeed,
        this.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed + (this.rightSpeed > this.maxTurningSpeed ? -1 : 1) * dt * this.decelerationModifier,
        -this.maxSpeed,
        this.maxSpeed
      );
    } else {
      // Reduce power of left axle to half of right axle
      this.leftSpeed = Scalar.Lerp(this.leftSpeed, this.rightSpeed / 2, dt * this.speedModifier);
    }

    this.motors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  public right(dt: number, isAccelerating: boolean) {
    if (!isAccelerating) {
      // If not accelerating, even out speeds
      this.leftSpeed = clamp(
        this.leftSpeed + (this.leftSpeed > this.maxTurningSpeed ? -1 : 1) * dt * this.decelerationModifier,
        -this.maxSpeed,
        this.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed + (this.rightSpeed > -this.maxTurningSpeed ? -1 : 1) * dt * this.speedModifier,
        -this.maxSpeed,
        this.maxSpeed
      );
    } else {
      // Reduce power of right axle to half of left axle
      this.rightSpeed = Scalar.Lerp(this.rightSpeed, this.leftSpeed / 2, dt * this.speedModifier);
    }

    this.motors.forEach((motor, idx) =>
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed)
    );
  }
  public brake(dt: number) {
    /* if (this.leftSpeed === 0 && this.rightSpeed === 0) return;

    this.leftSpeed = clamp(
      this.leftSpeed + Math.sign(this.leftSpeed) * -1 * dt * this.speedModifier,
      -this.maxSpeed,
      this.maxSpeed
    );
    this.rightSpeed = clamp(
      this.rightSpeed + Math.sign(this.rightSpeed) * -1 * dt * this.speedModifier,
      -this.maxSpeed,
      this.maxSpeed
    );

    this.motors.forEach((motor, idx) =>
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed)
    ); */
    this.decelerate(dt, this.speedModifier);
  }
  public decelerate(dt: number, modifier: number = this.decelerationModifier) {
    let speed = 0;
    if (this.leftSpeed < 0.001 && this.rightSpeed < 0.001) {
      this.leftSpeed = this.rightSpeed = 0;
      speed = 0;
    } else {
      this.leftSpeed = clamp(
        this.leftSpeed + Math.sign(this.leftSpeed) * -1 * dt * modifier,
        -this.maxSpeed,
        this.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed + Math.sign(this.rightSpeed) * -1 * dt * modifier,
        -this.maxSpeed,
        this.maxSpeed
      );
      // Even out while decelerating
      speed = avg([this.leftSpeed, this.rightSpeed]);
    }

    this.motors.forEach((motor) => motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, speed));
  }
  public turretLeft(dt: number) {
    this.turretMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_Y, -dt * this.turretSpeed);
  }
  public turretRight(dt: number) {
    this.turretMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_Y, dt * this.turretSpeed);
  }
  public stopTurret() {
    this.turretMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_Y, 0);
  }
  public barrelUp(dt: number) {
    this.barrelMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, -dt * this.barrelSpeed);
  }
  public barrelDown(dt: number) {
    this.barrelMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, dt * this.barrelSpeed);
  }
  public stopBarrel() {
    this.barrelMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, 0);
  }
  public resetTurret(dt: number) {
    const turretEuler = this.turret.rotationQuaternion!.toEulerAngles();
    const barrelEuler = this.barrel.rotationQuaternion!.toEulerAngles();

    if (Math.abs(turretEuler.y) > 0.01) {
      turretEuler.y < 0 ? this.turretRight(dt) : this.turretLeft(dt);
    }
    if (Math.abs(barrelEuler.x) > 0.01) {
      barrelEuler.x < 0 ? this.barrelDown(dt) : this.barrelUp(dt);
    }
  }
  public fire() {
    const now = performance.now();
    if (now - this.lastFired <= this.cooldown) return;

    this.shell.fire();
    this.simulateRecoil();
    const groundHit = this.scene.pickWithRay(
      new Ray(this.barrel.absolutePosition.add(new Vector3(0, 0, 5)), Vector3.Down(), 10),
      (mesh) => mesh.name === 'ground'
    );
    if (groundHit?.hit && groundHit?.pickedPoint) {
      this.particleSystems['muzzle'].start(groundHit.pickedPoint);
    } else {
      this.particleSystems['muzzle'].start();
    }

    this.sounds['cannon'].play();
    this.lastFired = now;
    this.isCanonReady = false;
  }
  public explode() {
    /* this.particleSystems['tank-explosion'].emitter = this.rootMesh.position.clone();
    this.particleSystems['fire'].emitter = this.rootMesh.position.clone(); */
    this.particleSystems['tank-explosion'].start();
    this.particleSystems['fire'].start();
  }
  public toggleCamera() {
    if (performance.now() - this.lastCameraToggle > this.cameraToggleDelay) {
      if (this.scene.activeCamera?.name === 'tpp-cam') {
        this.scene.activeCamera = this.cameras?.fpp as FreeCamera;
      } else {
        this.scene.activeCamera = this.cameras?.tpp as FollowCamera;
      }
      this.lastCameraToggle = performance.now();
    }
  }
  public checkStuck() {
    if (this.rootMesh.up.y < 0) this.isStuck = true;
    // TODO: Delayed explosion ?
  }
  public playSounds(isMoving: boolean) {
    if (isMoving) {
      if (!this.sounds['move'].isPlaying) this.sounds['move'].play();
      if (this.sounds['idle'].isPlaying) this.sounds['idle'].pause();
    } else {
      if (this.sounds['move'].isPlaying) this.sounds['move'].pause();
      if (!this.sounds['idle'].isPlaying) this.sounds['idle'].play();
    }
  }

  static async create(
    id: string,
    meshes: AbstractMesh[],
    spawn: Vector3,
    scene: Scene,
    cameras: Nullable<{ tpp: FollowCamera; fpp: FreeCamera }>,
    isEnemy: boolean = false
  ) {
    const cloned = meshes[0].clone(`${meshes[0].name.replace(':Ref', '')}:${id}`, null) as AbstractMesh;
    const newTank = new Tank(cloned, spawn, scene, cameras, isEnemy);
    await newTank.setSoundSources();
    await newTank.loadCannon(true);
    newTank.sounds['idle'].play();
    newTank.particleSystems['exhaust-left'].start();
    newTank.particleSystems['exhaust-right'].start();
    return newTank;
  }
}
