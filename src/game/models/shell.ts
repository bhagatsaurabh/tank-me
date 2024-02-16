import {
  StandardMaterial,
  type Mesh,
  Scene,
  Texture,
  Color3,
  MeshBuilder,
  Vector3,
  Quaternion,
  Axis,
  Space,
  PhysicsAggregate,
  PhysicsShapeType,
  Sound,
  type IPhysicsCollisionEvent,
  ParticleSystem,
  LockConstraint,
  PhysicsBody,
  Observer
} from '@babylonjs/core';
import { v4 as uuid } from 'uuid';

import { AssetLoader } from '../loader';
import { TankMe } from '../main';
import { Debug } from '../debug';

export class Shell {
  private static refShell: Mesh;
  private static refShellMaterial: StandardMaterial;
  private mesh!: Mesh;
  private playerId: string;
  private explosionSound!: Sound;
  private isSpent: boolean = false;
  private particleSystem!: ParticleSystem;
  private lock!: LockConstraint;
  private energy = 0.015;
  private debugTrajectory: Vector3[] = [];
  private debug = false;
  private observers: Observer<any>[] = [];

  private constructor(
    public tank: Mesh,
    public scene: Scene,
    public barrel: Mesh
  ) {
    this.playerId = tank.name;
    this.loadAndSetTransform(barrel.position, barrel.absoluteRotationQuaternion);
    this.setPhysics(barrel.physicsBody!);

    this.observers.push(TankMe.physicsPlugin.onCollisionObservable.add((ev) => this.onCollide(ev)));
    this.observers.push(this.scene.onBeforeRenderObservable.add(this.checkBounds.bind(this)));
  }

  private loadAndSetTransform(spawn: Vector3, absoluteRotation: Quaternion) {
    this.mesh = Shell.refShell.clone(`Shell:${uuid()}`);
    this.mesh.position.z = 4.8;
    this.mesh.rotationQuaternion = absoluteRotation.clone();
    this.mesh.isVisible = false;
    this.mesh.material = Shell.refShellMaterial;
    this.mesh.parent = this.barrel;
  }
  private async loadSound() {
    return new Promise<boolean>((resolve) => {
      this.explosionSound = new Sound(
        'explosion',
        '/assets/game/audio/explosion.mp3',
        this.scene,
        () => resolve(true),
        {
          loop: false,
          autoplay: false,
          spatialSound: true,
          maxDistance: 150
        }
      );
    });
  }
  private setPhysics(barrelPB: PhysicsBody) {
    new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.SPHERE,
      { mass: 0.0001, restitution: 0 },
      this.scene
    ).body.setCollisionCallbackEnabled(true);

    this.lock = new LockConstraint(
      new Vector3(0, 0, 4.8),
      Vector3.Zero(),
      Vector3.Forward(),
      Vector3.Forward(),
      this.scene
    );
    barrelPB.addConstraint(this.mesh.physicsBody!, this.lock);
  }
  private unlock() {
    this.lock.isEnabled = false;
  }

  private onCollide(event: IPhysicsCollisionEvent) {
    if (!this.isSpent || event.collider.transformNode.name !== this.mesh.name) return;
    console.log(event.collidedAgainst.transformNode.name);

    const explosionOrigin = this.mesh.position.clone();
    this.dispose();
    this.explosionSound.setPosition(explosionOrigin);
    this.explosionSound.onEndedObservable.add(() => this.explosionSound.dispose());
    this.explosionSound.play();

    // showExplosion(blastOrigin);
    if (event.collidedAgainst.transformNode.name !== 'ground') {
      event.collidedAgainst.applyImpulse(
        event.collider.transformNode
          .getDirection(new Vector3(0, 0, 1))
          .normalize()
          .scale(1),
        explosionOrigin
      );
    }
  }
  private checkBounds() {
    if (this.debug && this.isSpent) {
      this.debugTrajectory.push(this.mesh.absolutePosition.clone());
    }
    if (
      Math.abs(this.mesh.position.x) > 300 ||
      Math.abs(this.mesh.position.y) > 300 ||
      Math.abs(this.mesh.position.z) > 300
    ) {
      this.dispose();
    }
  }
  private dispose() {
    if (this.debug) {
      Debug.drawLine(`${this.mesh.name}:Trajectory`, this.debugTrajectory);
    }

    this.observers.forEach((observer) => observer.remove());
    this.mesh.physicsBody?.dispose();
    this.mesh.dispose();
  }

  public fire() {
    this.unlock();
    this.isSpent = true;
    this.mesh.isVisible = true;

    // TODO: Bullet Trail ?
    // this.particleSystem.start();

    this.mesh.physicsBody?.applyImpulse(
      this.mesh
        .getDirection(new Vector3(0, 0, 1))
        .normalize()
        .scale(this.energy),
      this.mesh.getAbsolutePosition()
    );
  }

  private static setRefShell(scene: Scene) {
    if (Shell.refShell) return;

    Shell.refShellMaterial = new StandardMaterial('fire', scene);
    const texture = new Texture(AssetLoader.assets['/assets/game/textures/explosion.jpg'] as string, scene);
    texture.uScale = texture.vScale = 10;
    Shell.refShellMaterial.diffuseTexture = texture;
    Shell.refShellMaterial.specularColor = Color3.Black();
    Shell.refShellMaterial.emissiveColor = Color3.Yellow();

    Shell.refShell = MeshBuilder.CreateSphere('Shell:Ref', { diameter: 0.1, segments: 1 }, scene);
    Shell.refShell.isVisible = false;
  }
  static async create(tank: Mesh, scene: Scene, barrel: Mesh): Promise<Shell> {
    Shell.setRefShell(scene);
    const newShell = new Shell(tank, scene, barrel);
    await newShell.loadSound();
    return newShell;
  }
}
