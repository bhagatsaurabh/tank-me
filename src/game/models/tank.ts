import {
  Matrix,
  type AbstractMesh,
  Vector3,
  BoundingInfo,
  PhysicsAggregate,
  PhysicsShapeType,
  Scene,
  Sound,
  FollowCamera,
  type Nullable,
  FreeCamera,
  Axis,
  Space,
  Quaternion,
  ParticleSystem,
  GPUParticleSystem
} from '@babylonjs/core';

import { Shell } from './shell';
import { PSMuzzleFlash } from '../particle-systems/muzzle-flash';
import { PSTankExplosion } from '../particle-systems/tank-explosion';
import { PSFire } from '../particle-systems/fire';
import { AssetLoader } from '../loader';

export class Tank {
  private turret!: AbstractMesh;
  private sounds: Record<string, Sound> = {};
  private isStuck: boolean = false;
  private lastFired: number = 0;
  private firingDelay: number = 2000;
  private lastCameraToggle = 0;
  private cameraToggleDelay = 1000;
  private shell!: Shell;
  private particleSystems: Record<string, ParticleSystem | GPUParticleSystem | PSFire> = {};

  private constructor(
    public rootMesh: AbstractMesh,
    public spawn: Vector3,
    public scene: Scene,
    public cameras: Nullable<{ tpp: FollowCamera; fpp: FreeCamera }>,
    public isEnemy: boolean = false
  ) {
    this.scaleBoundingBox();
    this.setTransform();
    this.setPhysics();
    this.setSoundSources();
    this.loadCannon();
    this.setParticleSystems();

    if (!isEnemy && cameras?.tpp && cameras.fpp) {
      cameras.tpp.lockedTarget = rootMesh;
      cameras.fpp.parent = this.turret;
    }
  }

  private scaleBoundingBox() {
    let minimum = this.rootMesh.getBoundingInfo().boundingBox.minimum.clone();
    let maximum = this.rootMesh.getBoundingInfo().boundingBox.maximum.clone();
    const scaling = Matrix.Scaling(1, 0.75, 1);
    minimum = Vector3.TransformCoordinates(minimum, scaling);
    maximum = Vector3.TransformCoordinates(maximum, scaling);
    this.rootMesh.setBoundingInfo(new BoundingInfo(minimum, maximum));
    this.rootMesh.computeWorldMatrix(true);
  }
  private setTransform() {
    this.rootMesh.position = this.spawn;
    this.rootMesh.scaling.y = 0.8;
    this.turret = this.rootMesh.getChildMeshes()[1];
    this.turret.rotation.y = 0;
  }
  private setPhysics() {
    new PhysicsAggregate(
      this.rootMesh,
      PhysicsShapeType.CONVEX_HULL,
      { mass: 5, restitution: 0 },
      this.scene
    ).body.setCollisionCallbackEnabled(true);
  }
  private setSoundSources() {
    this.sounds['cannon'] = new Sound(
      'cannon',
      AssetLoader.assets['/assets/game/audio/cannon.mp3'] as ArrayBuffer,
      this.scene,
      null,
      {
        loop: false,
        autoplay: false,
        spatialSound: true,
        maxDistance: 75,
        volume: 1
      }
    );
    this.sounds['idle'] = new Sound(
      'idle',
      AssetLoader.assets['/assets/game/audio/idle.mp3'] as ArrayBuffer,
      this.scene,
      null,
      {
        loop: true,
        autoplay: false,
        spatialSound: true,
        maxDistance: 15
      }
    );
    this.sounds['move'] = new Sound(
      'move',
      AssetLoader.assets['/assets/game/audio/run.mp3'] as ArrayBuffer,
      this.scene,
      null,
      {
        loop: true,
        autoplay: false,
        spatialSound: true,
        maxDistance: 20
      }
    );
    this.sounds['explode'] = new Sound(
      'explode',
      AssetLoader.assets['/assets/game/audio/explosion.mp3'] as ArrayBuffer,
      this.scene,
      null,
      {
        loop: false,
        autoplay: false,
        spatialSound: true,
        maxDistance: 65
      }
    );

    Object.values(this.sounds).forEach((sound) => sound.attachToMesh(this.rootMesh));
    this.sounds['idle'].play();
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

  public forward(amount: number) {
    if (this.isStuck) return;
    this.rootMesh.translate(Axis.Z, amount, Space.LOCAL);
  }
  public backward(amount: number) {
    if (this.isStuck) return;
    this.rootMesh.translate(Axis.Z, amount, Space.LOCAL);
  }
  public left(amount: number) {
    if (this.isStuck) return;
    this.rootMesh.rotate(Axis.Y, amount, Space.LOCAL);
  }
  public right(amount: number) {
    if (this.isStuck) return;
    this.rootMesh.rotate(Axis.Y, amount, Space.LOCAL);
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
      if (!this.sounds['move'].isPlaying) this.sounds['move'].play();
      if (this.sounds['idle'].isPlaying) this.sounds['idle'].pause();
    } else {
      if (this.sounds['move'].isPlaying) this.sounds['move'].pause();
      if (!this.sounds['idle'].isPlaying) this.sounds['idle'].play();
    }
  }

  static create(
    id: string,
    meshes: AbstractMesh[],
    spawn: Vector3,
    scene: Scene,
    cameras: Nullable<{ tpp: FollowCamera; fpp: FreeCamera }>,
    isEnemy: boolean = false
  ) {
    const cloned = meshes[0].clone(`${id}:${meshes[0].name}`, null) as AbstractMesh;
    return new Tank(cloned, spawn, scene, cameras, isEnemy);
  }
}
