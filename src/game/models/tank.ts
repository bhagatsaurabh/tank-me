import { Observer, Ray } from '@babylonjs/core';
import { Sound } from '@babylonjs/core/Audio';
import { Space, Axis, Quaternion } from '@babylonjs/core/Maths';
import { AbstractMesh, TransformNode } from '@babylonjs/core/Meshes';
import { PBRMaterial, Texture } from '@babylonjs/core/Materials';
import { type IBasePhysicsCollisionEvent, PhysicsEventType } from '@babylonjs/core/Physics';

import { Shell } from './shell';
import { randInRange } from '@/utils/utils';
import { PSExhaust } from '../particle-systems/exhaust';
import { PSDust } from '../particle-systems/dust';
import { PSMuzzle } from '../particle-systems/muzzle';
import { PSTankExplosion } from '../particle-systems/tank-explosion';
import type { Player } from '../state';
import { type TankSounds, type TankSoundType } from '@/types/types';
import { World } from '../main';
import type { PlayerTank } from './player';
import type { EnemyTank } from './enemy';

export class Tank {
  protected isPlayer = false;
  mesh!: AbstractMesh;
  body!: TransformNode;
  barrel!: AbstractMesh;
  barrelTip!: TransformNode;
  turret!: AbstractMesh;
  protected leftTrack!: AbstractMesh;
  protected rightTrack!: AbstractMesh;
  protected leftExhaust!: AbstractMesh;
  protected rightExhaust!: AbstractMesh;
  protected leftWheels: AbstractMesh[] = [];
  protected rightWheels: AbstractMesh[] = [];

  // Actual shell with physics enabled just for effects, the server is still the authority
  protected loadedDummyShell!: Shell;
  protected sounds: TankSounds = {};
  protected particleSystems: {
    muzzle?: PSMuzzle;
    'exhaust-left'?: PSExhaust;
    'exhaust-right'?: PSExhaust;
    'dust-left'?: PSDust;
    'dust-right'?: PSDust;
    explosion?: PSTankExplosion;
  } = {};
  private isStuck = false;
  protected observers: Observer<any>[] = [];
  health: number = 100.0;

  protected constructor(
    public world: World,
    public state: Player
  ) {
    this.setParticleSystems();
  }
  protected async init() {
    // eslint-disable-next-line no-empty-pattern
    [[], this.loadedDummyShell] = await Promise.all([this.setSoundSources(), Shell.create(this)]);

    // this.sounds['idle']?.play();
    this.particleSystems['exhaust-left']?.start();
    this.particleSystems['exhaust-right']?.start();
  }

  protected trigger(event: IBasePhysicsCollisionEvent) {
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
  protected animate(leftTrackSpeed?: number, rightTrackSpeed?: number) {
    const leftSpeed = leftTrackSpeed ?? this.state.leftSpeed;
    const rightSpeed = rightTrackSpeed ?? this.state.rightSpeed;

    if (leftSpeed !== 0) {
      ((this.leftTrack.material as PBRMaterial).albedoTexture as Texture).vOffset += leftSpeed * 0.0009;
      this.leftWheels.forEach((wheel) => wheel.rotate(Axis.X, leftSpeed * 0.0095, Space.LOCAL));
    }
    if (rightSpeed !== 0) {
      ((this.rightTrack.material as PBRMaterial).albedoTexture as Texture).vOffset += rightSpeed * 0.0009;
      this.rightWheels.forEach((wheel) => wheel.rotate(Axis.X, rightSpeed * 0.0095, Space.LOCAL));
    }

    // Dust trail
    if (leftSpeed === 0 || rightSpeed === 0) {
      this.particleSystems['dust-left']?.stop();
      this.particleSystems['dust-right']?.stop();
    } else {
      this.particleSystems['dust-left']?.start();
      this.particleSystems['dust-right']?.start();
    }
  }

  public explode() {
    this.particleSystems['explosion']?.start();
    this.particleSystems['exhaust-left']?.stop();
    this.particleSystems['exhaust-right']?.stop();
    // TODO
  }
  protected playSounds(isMoving: boolean, isTurretMoving: boolean) {
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
  playSound(type: TankSoundType) {
    if (!this.sounds[type]?.isPlaying) this.sounds[type]?.play();
  }

  sync() {
    if (this.isPlayer) {
      (this as unknown as PlayerTank).reconcile();
    } else {
      (this as unknown as EnemyTank).interpolate();
    }
  }
  protected updateTransform() {
    if (this.isPlayer) {
      (this as unknown as PlayerTank).leftSpeed = this.state.leftSpeed;
      (this as unknown as PlayerTank).rightSpeed = this.state.rightSpeed;
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
