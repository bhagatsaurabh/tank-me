import {
  AbstractMesh,
  Vector3,
  PhysicsAggregate,
  Scene,
  Sound,
  FollowCamera,
  type Nullable,
  FreeCamera,
  Quaternion,
  ParticleSystem,
  GPUParticleSystem,
  PhysicsBody,
  Physics6DoFConstraint,
  PhysicsConstraintAxis,
  PhysicsShapeBox,
  PhysicsMotionType,
  Mesh,
  PhysicsShapeContainer,
  MeshBuilder,
  PhysicsShapeType,
  Axis,
  Space,
  PhysicsConstraintMotorType,
  Scalar
} from '@babylonjs/core';

import { Shell } from './shell';
import { PSMuzzleFlash } from '../particle-systems/muzzle-flash';
import { PSTankExplosion } from '../particle-systems/tank-explosion';
import { PSFire } from '../particle-systems/fire';
import { TankMe } from '../main';
import { avg, clamp } from '@/utils/utils';

export class Tank {
  private turret!: AbstractMesh;
  private axles: Mesh[] = [];
  private motors: Physics6DoFConstraint[] = [];
  private sounds: Record<string, Sound> = {};
  private isStuck: boolean = false;
  private lastFired: number = 0;
  private firingDelay: number = 2000;
  private lastCameraToggle = 0;
  private cameraToggleDelay = 1000;
  private shell!: Shell;
  private particleSystems: Record<string, ParticleSystem | GPUParticleSystem | PSFire> = {};
  private maxEnginePower = 100;
  private speedModifier = 10;
  private decelerationModifier = 4;
  private leftSpeed = 0;
  private rightSpeed = 0;
  private maxSpeed = 15;
  private maxTurningSpeed = 3;
  private bodyMass = 2;
  private bodyFriction = 1;
  private bodyRestitution = 0;
  private wheelMass = 1;
  private wheelFriction = 0.8;
  private wheelRestitution = 0;
  private axleFriction = 0;
  private suspensionMinLimit = -0.2;
  private suspensionMaxLimit = 0.033;
  private suspensionStiffness = 100;
  private suspensionDamping = 20;
  private body!: Mesh;
  private wheelMeshes: Mesh[] = [];
  private axleMeshes: Mesh[] = [];
  private noOfWheels = 10;

  private constructor(
    public rootMesh: AbstractMesh,
    public spawn: Vector3,
    public scene: Scene,
    public cameras: Nullable<{ tpp: FollowCamera; fpp: FreeCamera }>,
    public isEnemy: boolean = false
  ) {
    this.setTransform();
    this.setPhysics();
    this.loadCannon();
    this.setParticleSystems();

    if (!isEnemy && cameras?.tpp && cameras.fpp) {
      // cameras.tpp.position = new Vector3(spawn.x + 1, spawn.y + 1, spawn.z + 1);
      // cameras.tpp.lockedTarget = rootMesh;
      cameras.fpp.parent = this.turret;
    }
  }

  private setTransform() {
    this.body = new Mesh(this.rootMesh.name + ':Root', this.scene);
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
      this.wheelMeshes.push(wheelMesh);
      this.axleMeshes.push(axleMesh);
    }

    this.rootMesh.position = Vector3.Zero();
    this.turret = this.rootMesh.getChildMeshes()[1];
    this.turret.rotation.y = 0;
    this.rootMesh.parent = this.body;
    this.body.position = this.spawn;

    this.rootMesh.isVisible = false;
    this.rootMesh.getChildMeshes().forEach((mesh) => (mesh.isVisible = false));
  }
  private setPhysics() {
    const bodyShapeContainer = new PhysicsShapeContainer(this.scene);
    const bodyShape = new PhysicsShapeBox(
      new Vector3(0, 1, 0),
      Quaternion.Identity(),
      new Vector3(3, 0.5, 5),
      this.scene
    );
    bodyShapeContainer.addChildFromParent(this.body, bodyShape, this.rootMesh);
    const bodyPB = new PhysicsBody(this.body, PhysicsMotionType.DYNAMIC, false, this.scene);
    bodyShapeContainer.material = { friction: this.bodyFriction, restitution: this.bodyRestitution };
    bodyPB.shape = bodyShapeContainer;
    bodyPB.setMassProperties({ mass: this.bodyMass, centerOfMass: Vector3.Zero() });

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

      this.motors.push(this.createConstraint(wheelPositions[i], axle.position, bodyPB, axleAgg.body));
      this.axles.push(axle);
    }

    // Debug
    // this.axles.forEach((axle) => TankMe.physicsViewer.showBody(axle.physicsBody!));
    this.motors.forEach((motor) => TankMe.physicsViewer.showConstraint(motor));
    TankMe.physicsViewer.showBody(bodyPB);

    this.cameras!.tpp.position = new Vector3(
      this.wheelMeshes[0].position.x + 0.5,
      this.wheelMeshes[0].position.y + 0.5,
      this.wheelMeshes[0].position.z + 0.5
    );
    this.cameras!.tpp.lockedTarget = this.wheelMeshes[0];
  }
  private createConstraint(
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

    // Locking axes creates weird results...
    /* _6dofConstraint.setAxisMode(PhysicsConstraintAxis.LINEAR_X, PhysicsConstraintAxisLimitMode.LOCKED);
    _6dofConstraint.setAxisMode(PhysicsConstraintAxis.LINEAR_Y, PhysicsConstraintAxisLimitMode.LOCKED);
    _6dofConstraint.setAxisMode(PhysicsConstraintAxis.LINEAR_Z, PhysicsConstraintAxisLimitMode.LOCKED);
    _6dofConstraint.setAxisMode(PhysicsConstraintAxis.LINEAR_DISTANCE, PhysicsConstraintAxisLimitMode.LOCKED);
    _6dofConstraint.setAxisMode(PhysicsConstraintAxis.ANGULAR_Y, PhysicsConstraintAxisLimitMode.LOCKED);
    _6dofConstraint.setAxisMode(PhysicsConstraintAxis.ANGULAR_Z, PhysicsConstraintAxisLimitMode.LOCKED); */

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
            maxDistance: 75,
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
            maxDistance: 15
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
            maxDistance: 20
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
            maxDistance: 65
          }
        );
      })
    );

    Object.values(this.sounds).forEach((sound) => sound.attachToMesh(this.rootMesh));

    return Promise.all(promises);
  }
  private loadCannon() {
    this.shell = Shell.create(
      this.rootMesh.name,
      this.scene,
      this.rootMesh.position,
      this.turret.absoluteRotationQuaternion
    );
    this.particleSystems['muzzle-flash'] = PSMuzzleFlash.create(this.turret.position.clone(), this.scene);
  }
  private setParticleSystems() {
    this.particleSystems['muzzle-flash'] = PSMuzzleFlash.create(this.turret.position.clone(), this.scene);
    this.particleSystems['tank-explosion'] = PSTankExplosion.create(
      this.rootMesh.position.clone(),
      this.scene
    );
    this.particleSystems['fire'] = PSFire.create(this.rootMesh.position.clone(), this.scene);
  }

  public forward(dt: number, turningDirection: -1 | 0 | 1) {
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
  public backward(dt: number, turningDirection: -1 | 0 | 1) {
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
      // If not accelerating, even out speeds, using decelerationModifier to prevent sudden halt
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
    if (this.leftSpeed === 0 && this.rightSpeed === 0) return;

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
    );
  }
  public decelerate(dt: number) {
    if (this.leftSpeed === 0 && this.rightSpeed === 0) return;

    this.leftSpeed = clamp(
      this.leftSpeed + Math.sign(this.leftSpeed) * -1 * dt * this.decelerationModifier,
      -this.maxSpeed,
      this.maxSpeed
    );
    this.rightSpeed = clamp(
      this.rightSpeed + Math.sign(this.rightSpeed) * -1 * dt * this.decelerationModifier,
      -this.maxSpeed,
      this.maxSpeed
    );

    // Even out while decelerating
    const avgSpeed = avg([this.leftSpeed, this.rightSpeed]);

    this.motors.forEach((motor) => motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, avgSpeed));
  }
  public turretLeft(amount: number) {
    this.turret.rotation.y -= amount;
  }
  public turretRight(amount: number) {
    this.turret.rotation.y += amount;
  }
  public turretUp(amount: number) {
    if (this.turret.rotation.x < 0.05) {
      this.turret.rotation.x += amount;
    }
  }
  public turretDown(amount: number) {
    if (this.turret.rotation.x > -0.1) {
      this.turret.rotation.x -= amount;
    }
  }
  public reset() {
    if (!this.isStuck) return;

    const euler = (this.rootMesh.rotationQuaternion as Quaternion).toEulerAngles();
    euler.z = 0;
    const quaternion = euler.toQuaternion();
    this.rootMesh.rotationQuaternion = new Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
    this.isStuck = false;
  }
  public resetTurret() {
    if (this.turret.rotation.y > -0.001 && this.turret.rotation.y < 0.001) this.turret.rotation.y = 0;

    let degrees = ((this.turret.rotation.y % (2 * Math.PI)) * 180) / Math.PI;
    if (Math.abs(degrees) > 180) {
      if (degrees > 180) {
        degrees = degrees - 360;
      } else if (degrees < -180) {
        degrees = 360 + degrees;
      }
    }
    degrees = (degrees * Math.PI) / 180;
    if (degrees < 0) {
      this.turret.rotation.y = degrees + 0.02;
    } else if (degrees > 0) {
      this.turret.rotation.y = degrees - 0.02;
    }
  }
  public fire() {
    if (performance.now() - this.lastFired <= this.firingDelay) return;

    this.shell.fire();
    this.particleSystems['muzzle-flash'].emitter = this.turret.position.clone();
    this.particleSystems['muzzle-flash'].start();
    this.sounds['cannon'].play();
    this.loadCannon();

    this.lastFired = performance.now();
  }
  public explode() {
    this.particleSystems['tank-explosion'].emitter = this.rootMesh.position.clone();
    this.particleSystems['fire'].emitter = this.rootMesh.position.clone();
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
  }
  public playSounds(isMoving: boolean) {
    if (isMoving) {
      // if (!this.sounds['move'].isPlaying) this.sounds['move'].play();
      if (this.sounds['idle'].isPlaying) this.sounds['idle'].pause();
    } else {
      if (this.sounds['move'].isPlaying) this.sounds['move'].pause();
      // if (!this.sounds['idle'].isPlaying) this.sounds['idle'].play();
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
    const cloned = meshes[0].clone(`${id}:${meshes[0].name}`, null) as AbstractMesh;
    const newTank = new Tank(cloned, spawn, scene, cameras, isEnemy);
    await newTank.setSoundSources();
    // newTank.sounds['idle'].play();
    return newTank;
  }
}
