import { type Nullable, Observer, Ray } from '@babylonjs/core';
import { Sound } from '@babylonjs/core/Audio';
import { FollowCamera, FreeCamera } from '@babylonjs/core/Cameras';
import { Vector3, Space, Axis, Quaternion } from '@babylonjs/core/Maths';
import { AbstractMesh, Mesh, TransformNode } from '@babylonjs/core/Meshes';
import { PBRMaterial, Texture } from '@babylonjs/core/Materials';
import {
  type IBasePhysicsCollisionEvent,
  PhysicsEventType,
  PhysicsShapeConvexHull,
  PhysicsShapeContainer,
  PhysicsBody,
  PhysicsMotionType
} from '@babylonjs/core/Physics';

import { Shell } from './shell';
import { randInRange, throttle } from '@/utils/utils';
import { PSExhaust } from '../particle-systems/exhaust';
import { PSDust } from '../particle-systems/dust';
import { PSMuzzle } from '../particle-systems/muzzle';
import { PSTankExplosion } from '../particle-systems/tank-explosion';
import type { Player } from '../state';
import type { TankSounds, TankSoundType } from '@/types/types';
import type { World } from '../main';

export class Tank {
  private static config = {
    cooldown: 5000
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
  // private debugUpdate = throttle((state: Player) => console.log(state), 1000);

  private constructor(
    public world: World,
    public state: Player,
    rootMesh: AbstractMesh,
    spawn: Vector3,
    public cameras: Nullable<{ tpp: FollowCamera; fpp: FreeCamera }>,
    public isEnemy: boolean = false
  ) {
    this.setTransform(rootMesh, spawn);
    this.setPhysics(rootMesh as Mesh);
    this.setParticleSystems();

    if (!isEnemy && cameras?.tpp && cameras.fpp) {
      cameras.tpp.position = new Vector3(spawn.x + 1, spawn.y + 1, spawn.z + 1);
      cameras.tpp.lockedTarget = this.mesh;
      cameras.fpp.parent = this.barrel;
    }

    this.observers.push(this.world.scene.onAfterStepObservable.add(this.afterStep.bind(this)));
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

  private setTransform(rootMesh: AbstractMesh, spawn: Vector3) {
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
  private setPhysics(rootMesh: Mesh) {
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
  private afterStep() {
    this.animate();
  }
  private animate() {
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

  public fire() {
    const now = performance.now();
    if (now - this.lastFired <= Tank.config.cooldown) return false;

    this.loadedDummyShell.fire();
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
  update(state: Player) {
    this.body.position.set(state.position.x, state.position.y, state.position.z);

    this.body.rotationQuaternion =
      this.body.rotationQuaternion?.set(
        state.rotation.x,
        state.rotation.y,
        state.rotation.z,
        state.rotation.w
      ) ?? new Quaternion(state.rotation.x, state.rotation.y, state.rotation.z, state.rotation.w);

    this.turret.rotationQuaternion =
      this.turret.rotationQuaternion?.set(
        state.turretRotation.x,
        state.turretRotation.y,
        state.turretRotation.z,
        state.turretRotation.w
      ) ??
      new Quaternion(
        state.turretRotation.x,
        state.turretRotation.y,
        state.turretRotation.z,
        state.turretRotation.w
      );

    this.barrel.rotationQuaternion =
      this.barrel.rotationQuaternion?.set(
        state.barrelRotation.x,
        state.barrelRotation.y,
        state.barrelRotation.z,
        state.barrelRotation.w
      ) ??
      new Quaternion(
        state.barrelRotation.x,
        state.barrelRotation.y,
        state.barrelRotation.z,
        state.barrelRotation.w
      );
  }
  dispose() {
    this.observers.forEach((observer) => observer.remove());
    this.body.dispose();
  }
}
