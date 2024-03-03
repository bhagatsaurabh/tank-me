import { type Nullable, Observer, Ray } from '@babylonjs/core';
import { Sound } from '@babylonjs/core/Audio';
import { FollowCamera, FreeCamera } from '@babylonjs/core/Cameras';
import { Vector3, Space, Axis, Quaternion, Scalar } from '@babylonjs/core/Maths';
import { AbstractMesh, Mesh, MeshBuilder, TransformNode } from '@babylonjs/core/Meshes';
import { PBRMaterial, Texture } from '@babylonjs/core/Materials';
import {
  type IBasePhysicsCollisionEvent,
  PhysicsEventType,
  PhysicsShapeConvexHull,
  PhysicsShapeContainer,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeSphere,
  PhysicsAggregate,
  Physics6DoFConstraint,
  PhysicsConstraintAxis,
  PhysicsConstraintMotorType,
  LockConstraint,
  HavokPlugin
} from '@babylonjs/core/Physics';

import { Shell } from './shell';
import { avg, clamp, forwardVector, randInRange } from '@/utils/utils';
import { PSExhaust } from '../particle-systems/exhaust';
import { PSDust } from '../particle-systems/dust';
import { PSMuzzle } from '../particle-systems/muzzle';
import { PSTankExplosion } from '../particle-systems/tank-explosion';
import type { Player } from '../state';
import type { TankSounds, TankSoundType } from '@/types/types';
import type { World } from '../main';

export class Tank {
  private static config = {
    maxEnginePower: 100,
    speedModifier: 10,
    decelerationModifier: 4,
    maxSpeed: 15,
    maxTurningSpeed: 3,
    maxTurretAngle: 1.17, // ~67.5 deg
    maxBarrelAngle: 0.43, // ~25 deg
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
    cooldown: 2500
  };
  private lastFired = 0;
  public mesh!: AbstractMesh;
  public body!: TransformNode;
  public barrel!: AbstractMesh;
  public barrelTip!: TransformNode;
  private turret!: AbstractMesh;
  public leftTrack!: AbstractMesh;
  public rightTrack!: AbstractMesh;
  public leftExhaust!: AbstractMesh;
  public rightExhaust!: AbstractMesh;
  private leftWheels: AbstractMesh[] = [];
  private rightWheels: AbstractMesh[] = [];
  private innerWheels!: AbstractMesh;
  private axleJoints: TransformNode[] = [];
  private axleMotors: Physics6DoFConstraint[] = [];
  private barrelMotor!: Physics6DoFConstraint;
  private turretMotor!: Physics6DoFConstraint;
  private axles: Mesh[] = [];
  // Actual shell with physics enabled just for effects, the server is still the authority
  private loadedDummyShell!: Shell;
  private sounds: TankSounds = {};
  private particleSystems: {
    muzzle?: PSMuzzle;
    'exhaust-left'?: PSExhaust;
    'exhaust-right'?: PSExhaust;
    'dust-left'?: PSDust;
    'dust-right'?: PSDust;
    explosion?: PSTankExplosion;
  } = {};
  private isStuck = false;
  private lastCameraToggle = 0;
  private cameraToggleDelay = 1000;
  private observers: Observer<any>[] = [];
  health: number = 100.0;
  leftSpeed: number = 0;
  rightSpeed: number = 0;

  private constructor(
    public world: World,
    public state: Player,
    rootMesh: AbstractMesh,
    spawn: Vector3,
    public cameras: Nullable<{ tpp: FollowCamera; fpp: FreeCamera }>,
    public isEnemy: boolean = false
  ) {
    if (!isEnemy) {
      this.setTransformPlayer(rootMesh, spawn);
      this.setPhysicsPlayer(rootMesh as Mesh);
    } else {
      this.setTransformEnemy(rootMesh, spawn);
      this.setPhysicsEnemy(rootMesh as Mesh);
    }
    this.setParticleSystems();

    if (!isEnemy && cameras?.tpp && cameras.fpp) {
      cameras.tpp.position = new Vector3(spawn.x + 1, spawn.y + 1, spawn.z + 1);
      cameras.tpp.lockedTarget = this.mesh;
      cameras.fpp.parent = this.barrel;
    }

    this.observers.push(this.world.scene.onBeforeStepObservable.add(this.beforeStep.bind(this)));
    this.observers.push(this.world.scene.onAfterPhysicsObservable.add(this.afterPhysics.bind(this)));
  }
  static async create(
    world: World,
    state: Player,
    rootMesh: AbstractMesh,
    spawn: Vector3,
    cameras: Nullable<{ tpp: FollowCamera; fpp: FreeCamera }>,
    isEnemy: boolean = false
  ) {
    const cloned = rootMesh.clone(`${rootMesh.name.replace(':Ref', '')}:${state.sid}`, null)!;
    const newTank = new Tank(world, state, cloned, spawn, cameras, isEnemy);
    await newTank.setSoundSources();
    newTank.sounds['idle']?.play();
    newTank.particleSystems['exhaust-left']?.start();
    newTank.particleSystems['exhaust-right']?.start();
    newTank.loadedDummyShell = await Shell.create(newTank);
    return newTank;
  }

  private setTransformEnemy(rootMesh: AbstractMesh, spawn: Vector3) {
    this.mesh = rootMesh;
    const body = new TransformNode(`Root:${rootMesh.name}`, this.world.scene);
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
  private setPhysicsEnemy(rootMesh: Mesh) {
    const bodyShapeContainer = new PhysicsShapeContainer(this.world.scene);
    const bodyPB = new PhysicsBody(this.body, PhysicsMotionType.STATIC, false, this.world.scene);
    bodyPB.shape = bodyShapeContainer;
    bodyPB.setMassProperties({ mass: 0 });

    const bodyShape = new PhysicsShapeConvexHull(rootMesh, this.world.scene);
    bodyShapeContainer.addChildFromParent(this.body, bodyShape, rootMesh);

    const turretShape = new PhysicsShapeConvexHull(this.turret as Mesh, this.world.scene);
    const turretPB = new PhysicsBody(this.turret, PhysicsMotionType.STATIC, false, this.world.scene);
    turretPB.shape = turretShape;
    turretPB.setMassProperties({ mass: 0 });

    const barrelShape = new PhysicsShapeConvexHull(this.barrel as Mesh, this.world.scene);
    const barrelPB = new PhysicsBody(this.barrel, PhysicsMotionType.STATIC, false, this.world.scene);
    barrelPB.shape = barrelShape;
    barrelPB.setMassProperties({ mass: 0 });

    bodyPB.disablePreStep = false;
    turretPB.disablePreStep = false;
    barrelPB.disablePreStep = false;
  }
  private setTransformPlayer(rootMesh: AbstractMesh, spawn: Vector3) {
    this.mesh = rootMesh;
    const body = new TransformNode(`Root:${rootMesh.name}`, this.world.scene);
    for (let i = 0; i < Tank.config.noOfWheels; i += 1) {
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
  private setPhysicsPlayer(rootMesh: Mesh) {
    const bodyShape = new PhysicsShapeConvexHull(rootMesh, this.world.scene);
    const bodyShapeContainer = new PhysicsShapeContainer(this.world.scene);
    bodyShapeContainer.addChildFromParent(this.body, bodyShape, rootMesh);
    const bodyPB = new PhysicsBody(this.body, PhysicsMotionType.DYNAMIC, false, this.world.scene);
    bodyShapeContainer.material = {
      friction: Tank.config.bodyFriction,
      restitution: Tank.config.bodyRestitution
    };
    bodyPB.shape = bodyShapeContainer;
    bodyPB.setMassProperties({ mass: Tank.config.bodyMass, centerOfMass: Vector3.Zero() });

    const turretShape = new PhysicsShapeConvexHull(this.turret as Mesh, this.world.scene);
    turretShape.material = { friction: 0, restitution: 0 };
    const turretPB = new PhysicsBody(this.turret, PhysicsMotionType.DYNAMIC, false, this.world.scene);
    turretPB.shape = turretShape;
    turretPB.setMassProperties({ mass: Tank.config.turretMass, centerOfMass: Vector3.Zero() });
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
    barrelPB.setMassProperties({ mass: Tank.config.barrelMass, centerOfMass: Vector3.Zero() });
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
    for (let i = 0; i < Tank.config.noOfWheels; i += 1) {
      const axleJoint = this.axleJoints[i];
      const axle = this.axles[i];

      axle.position = Vector3.Zero();
      axleJoint.parent = this.body;
      axleJoint.position = wheelPositions[i];

      const axleAgg = new PhysicsAggregate(
        axle,
        axleShape,
        {
          mass: Tank.config.wheelMass,
          friction: Tank.config.wheelFriction,
          restitution: Tank.config.wheelRestitution
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
    new PhysicsBody(this.innerWheels, PhysicsMotionType.DYNAMIC, false, this.world.scene);
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
  }
  private trigger(event: IBasePhysicsCollisionEvent) {
    if (
      event.type === PhysicsEventType.TRIGGER_ENTERED &&
      event.collidedAgainst.transformNode.name.includes('Shell')
    ) {
      const ray = new Ray(
        event.collidedAgainst.transformNode.absolutePosition,
        event.collidedAgainst.transformNode.forward.normalize(),
        10
      );
      const info = this.world.scene.pickWithRay(ray, undefined, true);
      if (
        !info?.hit ||
        !info.pickedMesh ||
        (info.pickedMesh && !info.pickedMesh.name.includes(this.state.sid))
      ) {
        this.sounds[`whizz${Math.round(randInRange(1, 2))}` as TankSoundType]?.play();
      }
    }
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
          minLimit: Tank.config.suspensionMinLimit,
          maxLimit: Tank.config.suspensionMaxLimit,
          stiffness: Tank.config.suspensionStiffness,
          damping: Tank.config.suspensionDamping
        },
        { axis: PhysicsConstraintAxis.LINEAR_Z, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Y, minLimit: 0, maxLimit: 0 },
        { axis: PhysicsConstraintAxis.ANGULAR_Z, minLimit: 0, maxLimit: 0 }
      ],
      this.world.scene
    );

    parent.addConstraint(child, _6dofConstraint);
    _6dofConstraint.setAxisFriction(PhysicsConstraintAxis.ANGULAR_X, Tank.config.axleFriction);
    _6dofConstraint.setAxisMotorType(PhysicsConstraintAxis.ANGULAR_X, PhysicsConstraintMotorType.VELOCITY);
    _6dofConstraint.setAxisMotorMaxForce(PhysicsConstraintAxis.ANGULAR_X, Tank.config.maxEnginePower);

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
          minLimit: -Tank.config.maxBarrelAngle,
          maxLimit: Tank.config.maxBarrelAngle
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
          minLimit: -Tank.config.maxTurretAngle,
          maxLimit: Tank.config.maxTurretAngle
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
  private setParticleSystems() {
    this.particleSystems['exhaust-left'] = PSExhaust.create(this.leftExhaust, this.world.scene);
    this.particleSystems['exhaust-right'] = PSExhaust.create(this.rightExhaust, this.world.scene);
    this.particleSystems['dust-left'] = PSDust.create(this.leftTrack, this.world.scene);
    this.particleSystems['dust-right'] = PSDust.create(this.rightTrack, this.world.scene);
    this.particleSystems['muzzle'] = PSMuzzle.create(this.barrelTip, this.world.scene);
    this.particleSystems['explosion'] = PSTankExplosion.create(this.body as AbstractMesh, this.world.scene);
  }
  private async setSoundSources() {
    const promises: Promise<boolean>[] = [];
    promises.push(
      new Promise((resolve) => {
        this.sounds['cannon'] = new Sound(
          'cannon',
          '/assets/game/audio/cannon.mp3',
          this.world.scene,
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
          this.world.scene,
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
          this.world.scene,
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
          this.world.scene,
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
          this.world.scene,
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
    promises.push(
      new Promise((resolve) => {
        this.sounds['turret'] = new Sound(
          'turret',
          '/assets/game/audio/turret.mp3',
          this.world.scene,
          () => resolve(true),
          {
            loop: true,
            autoplay: false,
            spatialSound: false,
            maxDistance: 20
          }
        );
      })
    );
    promises.push(
      new Promise((resolve) => {
        this.sounds['whizz1'] = new Sound(
          'whizz1',
          '/assets/game/audio/whizz1.mp3',
          this.world.scene,
          () => resolve(true),
          {
            loop: false,
            autoplay: false,
            spatialSound: false,
            maxDistance: 10
          }
        );
      })
    );
    promises.push(
      new Promise((resolve) => {
        this.sounds['whizz2'] = new Sound(
          'whizz2',
          '/assets/game/audio/whizz2.mp3',
          this.world.scene,
          () => resolve(true),
          {
            loop: false,
            autoplay: false,
            spatialSound: false,
            maxDistance: 10
          }
        );
      })
    );

    Object.values(this.sounds).forEach((sound) => sound.attachToMesh(this.body));

    return Promise.all(promises);
  }
  private beforeStep() {
    if (this.state.leftSpeed !== 0) {
      ((this.leftTrack.material as PBRMaterial).albedoTexture as Texture).vOffset +=
        this.state.leftSpeed * 0.0009;
      this.leftWheels.forEach((wheel) => wheel.rotate(Axis.X, this.state.leftSpeed * 0.0095, Space.LOCAL));
    }
    if (this.state.rightSpeed !== 0) {
      ((this.rightTrack.material as PBRMaterial).albedoTexture as Texture).vOffset +=
        this.state.rightSpeed * 0.0009;
      this.rightWheels.forEach((wheel) => wheel.rotate(Axis.X, this.state.rightSpeed * 0.0095, Space.LOCAL));
    }

    // Dust trail
    if (this.state.leftSpeed === 0 || this.state.rightSpeed === 0) {
      this.particleSystems['dust-left']?.stop();
      this.particleSystems['dust-right']?.stop();
    } else {
      this.particleSystems['dust-left']?.start();
      this.particleSystems['dust-right']?.start();
    }
  }
  private afterPhysics() {
    if (!this.isEnemy) {
      this.world.scene.onAfterPhysicsObservable.addOnce(() => {
        this.body.physicsBody!.disablePreStep = true;
        this.turret.physicsBody!.disablePreStep = true;
        this.barrel.physicsBody!.disablePreStep = true;
        this.axles.forEach((axle) => (axle.physicsBody!.disablePreStep = true));
        this.innerWheels.physicsBody!.disablePreStep = true;
      });
    }
  }
  private simulateRecoil() {
    const recoilVector = this.turret
      .getDirection(new Vector3(0, 1, -1))
      .normalize()
      .scale(Tank.config.recoilForce);
    const contactPoint = this.body.up
      .normalize()
      .scale(1)
      .add(this.body.position)
      .add(this.turret.forward.normalize().scale(1));
    this.body.physicsBody!.applyImpulse(recoilVector, contactPoint);
  }

  public accelerate(dt: number, turningDirection: -1 | 0 | 1) {
    if (turningDirection !== -1) {
      this.leftSpeed = clamp(
        this.leftSpeed + dt * Tank.config.speedModifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
    }
    if (turningDirection !== 1) {
      this.rightSpeed = clamp(
        this.rightSpeed + dt * Tank.config.speedModifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
    }

    this.axleMotors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  public reverse(dt: number, turningDirection: -1 | 0 | 1) {
    if (turningDirection !== -1) {
      this.leftSpeed = clamp(
        this.leftSpeed - dt * Tank.config.speedModifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
    }
    if (turningDirection !== 1) {
      this.rightSpeed = clamp(
        this.rightSpeed - dt * Tank.config.speedModifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
    }

    this.axleMotors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  public left(dt: number, isAccelerating: boolean) {
    if (!isAccelerating) {
      // If not accelerating, even-out speeds to prevent sudden halt
      this.leftSpeed = clamp(
        this.leftSpeed +
          (this.leftSpeed > -Tank.config.maxTurningSpeed ? -1 : 1) * dt * Tank.config.speedModifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed +
          (this.rightSpeed > Tank.config.maxTurningSpeed ? -1 : 1) * dt * Tank.config.decelerationModifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
    } else {
      // Reduce power of left axle to half of right axle
      this.leftSpeed = Scalar.Lerp(this.leftSpeed, this.rightSpeed / 2, dt * Tank.config.speedModifier);
    }

    this.axleMotors.forEach((motor, idx) => {
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed);
    });
  }
  public right(dt: number, isAccelerating: boolean) {
    if (!isAccelerating) {
      // If not accelerating, even out speeds
      this.leftSpeed = clamp(
        this.leftSpeed +
          (this.leftSpeed > Tank.config.maxTurningSpeed ? -1 : 1) * dt * Tank.config.decelerationModifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed +
          (this.rightSpeed > -Tank.config.maxTurningSpeed ? -1 : 1) * dt * Tank.config.speedModifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
    } else {
      // Reduce power of right axle to half of left axle
      this.rightSpeed = Scalar.Lerp(this.rightSpeed, this.leftSpeed / 2, dt * Tank.config.speedModifier);
    }

    this.axleMotors.forEach((motor, idx) =>
      motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, idx < 5 ? this.leftSpeed : this.rightSpeed)
    );
  }
  public brake(dt: number) {
    this.decelerate(dt, Tank.config.speedModifier);
  }
  public decelerate(dt: number, modifier: number = Tank.config.decelerationModifier) {
    let speed = 0;
    if (this.leftSpeed < 0.001 && this.rightSpeed < 0.001) {
      this.leftSpeed = this.rightSpeed = 0;
      speed = 0;
    } else {
      this.leftSpeed = clamp(
        this.leftSpeed + Math.sign(this.leftSpeed) * -1 * dt * modifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
      this.rightSpeed = clamp(
        this.rightSpeed + Math.sign(this.rightSpeed) * -1 * dt * modifier,
        -Tank.config.maxSpeed,
        Tank.config.maxSpeed
      );
      // Even out while decelerating
      speed = avg([this.leftSpeed, this.rightSpeed]);
    }

    this.axleMotors.forEach((motor) => motor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, speed));
  }
  public turretLeft(dt: number) {
    this.turretMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_Y, -dt * Tank.config.maxTurretSpeed);
  }
  public turretRight(dt: number) {
    this.turretMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_Y, dt * Tank.config.maxTurretSpeed);
  }
  public stopTurret() {
    this.turretMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_Y, 0);
  }
  public barrelUp(dt: number) {
    this.barrelMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, -dt * Tank.config.maxBarrelSpeed);
  }
  public barrelDown(dt: number) {
    this.barrelMotor.setAxisMotorTarget(PhysicsConstraintAxis.ANGULAR_X, dt * Tank.config.maxBarrelSpeed);
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
    if (now - this.lastFired <= Tank.config.cooldown) return false;

    this.loadedDummyShell.fire();
    this.simulateRecoil();
    this.particleSystems['muzzle']?.start();
    this.sounds['cannon']?.play();
    Shell.create(this).then((shell) => (this.loadedDummyShell = shell));

    this.lastFired = now;
    return true;
  }
  public explode() {
    this.particleSystems['explosion']?.start();
    this.particleSystems['exhaust-left']?.stop();
    this.particleSystems['exhaust-right']?.stop();
    // TODO
  }
  public toggleCamera() {
    if (performance.now() - this.lastCameraToggle > this.cameraToggleDelay) {
      if (this.world.scene.activeCamera?.name === 'tpp-cam') {
        this.world.scene.activeCamera = this.cameras?.fpp as FreeCamera;
      } else {
        this.world.scene.activeCamera = this.cameras?.tpp as FollowCamera;
      }
      this.lastCameraToggle = performance.now();
    }
  }
  public playSounds(isMoving: boolean, isTurretMoving: boolean) {
    if (isMoving) {
      if (!this.sounds['move']?.isPlaying) this.sounds['move']?.play();
      if (this.sounds['idle']?.isPlaying) this.sounds['idle']?.pause();
    } else {
      if (this.sounds['move']?.isPlaying) this.sounds['move']?.pause();
      if (!this.sounds['idle']?.isPlaying) this.sounds['idle']?.play();
    }

    if (isTurretMoving) {
      if (!this.sounds['turret']?.isPlaying) this.sounds['turret']?.play();
    } else {
      if (this.sounds['turret']?.isPlaying) this.sounds['turret']?.pause();
    }
  }
  public playSound(type: TankSoundType) {
    if (!this.sounds[type]?.isPlaying) this.sounds[type]?.play();
  }
  update() {
    if (!this.isEnemy) {
      this.body.physicsBody!.disablePreStep = false;
      this.turret.physicsBody!.disablePreStep = false;
      this.barrel.physicsBody!.disablePreStep = false;
      this.axles.forEach((axle) => (axle.physicsBody!.disablePreStep = false));
      this.innerWheels.physicsBody!.disablePreStep = false;
    }

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
  dispose() {
    this.observers.forEach((observer) => observer.remove());
    this.body.dispose();
  }
}
