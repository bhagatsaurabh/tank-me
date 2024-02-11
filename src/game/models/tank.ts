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
  GPUParticleSystem,
  PhysicsMotionType,
  PhysicsShape,
  PhysicsShapeContainer,
  PhysicsShapeCylinder,
  MeshBuilder,
  StandardMaterial,
  Color3,
  HingeConstraint
} from '@babylonjs/core';

import { Shell } from './shell';
import { PSMuzzleFlash } from '../particle-systems/muzzle-flash';
import { PSTankExplosion } from '../particle-systems/tank-explosion';
import { PSFire } from '../particle-systems/fire';
import { forwardVector } from '@/utils/utils';
import { Debug } from '../debug';

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
    this.turret = this.rootMesh.getChildMeshes()[1];
    this.turret.rotation.y = 0;
  }
  private setPhysics() {
    const wheelMat = new StandardMaterial('wheel-mat', this.scene);
    wheelMat.diffuseColor = new Color3(1, 0, 1);
    wheelMat.specularColor = new Color3(0.5, 0.6, 0.87);
    const axelMat = new StandardMaterial('axel-mat', this.scene);
    axelMat.diffuseColor = new Color3(1, 0, 0);
    axelMat.specularColor = new Color3(0.1, 0.2, 0.2);

    const axel1 = MeshBuilder.CreateCylinder('axel-left-1', { height: 0.6, diameter: 0.1 });
    axel1.material = axelMat;
    axel1.position = new Vector3(-1.475, 0.4, 2);
    axel1.scaling = Vector3.One();
    axel1.rotation = Vector3.Zero();
    axel1.rotate(Axis.Z, Math.PI / 2);
    axel1.parent = this.rootMesh;
    const wheel1 = MeshBuilder.CreateCylinder('wheel-left-1', { height: 0.6, diameter: 0.75 });
    wheel1.material = wheelMat;
    wheel1.position = new Vector3(-1.475, 0.4, 2);
    wheel1.scaling = Vector3.One();
    wheel1.rotation = Vector3.Zero();
    wheel1.rotate(Axis.Z, Math.PI / 2);
    wheel1.parent = this.rootMesh;

    const axel1Agg = new PhysicsAggregate(
      axel1,
      PhysicsShapeType.CYLINDER,
      { mass: 0, restitution: 1 },
      this.scene
    );
    const wheel1Agg = new PhysicsAggregate(
      wheel1,
      PhysicsShapeType.CYLINDER,
      { mass: 1, restitution: 1 },
      this.scene
    );
    const axel = new HingeConstraint(
      new Vector3(0, 0, 0),
      new Vector3(0, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 1, 0),
      this.scene
    );
    axel1Agg.body.addConstraint(wheel1Agg.body, axel);

    const wheel2 = MeshBuilder.CreateCylinder('wheel-left-2', { height: 0.6, diameter: 0.75 });
    wheel2.material = wheelMat;
    wheel2.position = new Vector3(-1.475, 0.4, 1);
    wheel2.scaling = Vector3.One();
    wheel2.rotation = Vector3.Zero();
    wheel2.rotate(Axis.Z, Math.PI / 2);
    wheel2.parent = this.rootMesh;
    const wheel3 = MeshBuilder.CreateCylinder('wheel-left-3', { height: 0.6, diameter: 0.75 });
    wheel3.material = wheelMat;
    wheel3.position = new Vector3(-1.475, 0.4, 0);
    wheel3.scaling = Vector3.One();
    wheel3.rotation = Vector3.Zero();
    wheel3.rotate(Axis.Z, Math.PI / 2);
    wheel3.parent = this.rootMesh;
    const wheel4 = MeshBuilder.CreateCylinder('wheel-left-4', { height: 0.6, diameter: 0.75 });
    wheel4.material = wheelMat;
    wheel4.position = new Vector3(-1.475, 0.4, -1);
    wheel4.scaling = Vector3.One();
    wheel4.rotation = Vector3.Zero();
    wheel4.rotate(Axis.Z, Math.PI / 2);
    wheel4.parent = this.rootMesh;
    const wheel5 = MeshBuilder.CreateCylinder('wheel-left-5', { height: 0.6, diameter: 0.75 });
    wheel5.material = wheelMat;
    wheel5.position = new Vector3(-1.475, 0.4, -2);
    wheel5.scaling = Vector3.One();
    wheel5.rotation = Vector3.Zero();
    wheel5.rotate(Axis.Z, Math.PI / 2);
    wheel5.parent = this.rootMesh;

    const wheel6 = MeshBuilder.CreateCylinder('wheel-right-1', { height: 0.6, diameter: 0.75 });
    wheel6.material = wheelMat;
    wheel6.position = new Vector3(1.475, 0.4, 2);
    wheel6.scaling = Vector3.One();
    wheel6.rotation = Vector3.Zero();
    wheel6.rotate(Axis.Z, Math.PI / 2);
    wheel6.parent = this.rootMesh;
    const wheel7 = MeshBuilder.CreateCylinder('wheel-right-2', { height: 0.6, diameter: 0.75 });
    wheel7.material = wheelMat;
    wheel7.position = new Vector3(1.475, 0.4, 1);
    wheel7.scaling = Vector3.One();
    wheel7.rotation = Vector3.Zero();
    wheel7.rotate(Axis.Z, Math.PI / 2);
    wheel7.parent = this.rootMesh;
    const wheel8 = MeshBuilder.CreateCylinder('wheel-right-3', { height: 0.6, diameter: 0.75 });
    wheel8.material = wheelMat;
    wheel8.position = new Vector3(1.475, 0.4, 0);
    wheel8.scaling = Vector3.One();
    wheel8.rotation = Vector3.Zero();
    wheel8.rotate(Axis.Z, Math.PI / 2);
    wheel8.parent = this.rootMesh;
    const wheel9 = MeshBuilder.CreateCylinder('wheel-right-4', { height: 0.6, diameter: 0.75 });
    wheel9.material = wheelMat;
    wheel9.position = new Vector3(1.475, 0.4, -1);
    wheel9.scaling = Vector3.One();
    wheel9.rotation = Vector3.Zero();
    wheel9.rotate(Axis.Z, Math.PI / 2);
    wheel9.parent = this.rootMesh;
    const wheel10 = MeshBuilder.CreateCylinder('wheel-right-5', { height: 0.6, diameter: 0.75 });
    wheel10.material = wheelMat;
    wheel10.position = new Vector3(1.475, 0.4, -2);
    wheel10.scaling = Vector3.One();
    wheel10.rotation = Vector3.Zero();
    wheel10.rotate(Axis.Z, Math.PI / 2);
    wheel10.parent = this.rootMesh;

    const wheelShape = new PhysicsShapeCylinder(
      new Vector3(0, -0.3, 0),
      new Vector3(0, 0.3, 0),
      0.375,
      this.scene
    );

    const trackShape = new PhysicsShapeContainer(this.scene);
    // trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel1);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel2);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel3);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel4);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel5);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel6);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel7);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel8);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel9);
    trackShape.addChildFromParent(this.rootMesh, wheelShape, wheel10);

    new PhysicsAggregate(
      this.rootMesh,
      trackShape,
      { mass: 10, restitution: 0, friction: 10 },
      this.scene
    ).body.setCollisionCallbackEnabled(true);

    this.rootMesh.physicsBody?.setAngularDamping(10);
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

  public forward(velocity: number) {
    if (this.isStuck || this.rootMesh.physicsBody?.getLinearVelocity().length()! > 10) return;
    this.rootMesh.physicsBody?.applyForce(
      this.rootMesh.getDirection(forwardVector).normalize().scale(3500),
      this.rootMesh.getAbsolutePosition()
    );
  }
  public backward(velocity: number) {
    if (this.isStuck || this.rootMesh.physicsBody?.getLinearVelocity().length()! > 10) return;
    this.rootMesh.physicsBody?.applyForce(
      this.rootMesh.getDirection(forwardVector).normalize().scale(-3500),
      this.rootMesh.getAbsolutePosition()
    );
  }
  public left(velocity: number) {
    if (this.isStuck) return;
    this.rootMesh.physicsBody?.setAngularVelocity(new Vector3(0, -velocity, 0));
  }
  public right(velocity: number) {
    if (this.isStuck) return;
    this.rootMesh.physicsBody?.setAngularVelocity(new Vector3(0, velocity, 0));
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
    newTank.sounds['idle'].play();
    return newTank;
  }
}
