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
  AbstractMesh,
  PhysicsAggregate,
  PhysicsShapeType,
  Sound,
  type IPhysicsCollisionEvent,
  PointLight,
  ParticleSystem
} from '@babylonjs/core';
import { v4 as uuid } from 'uuid';

import { AssetLoader } from '../loader';
import { TankMe } from '../main';

export class Shell {
  private static refShell: Mesh;
  private static refShellMaterial: StandardMaterial;
  private mesh!: Mesh;
  private playerId: string;
  private explosionSound!: Sound;
  private isSpent: boolean = false;
  private pointLight!: PointLight;
  private particleSystem!: ParticleSystem;

  private constructor(
    id: string,
    public scene: Scene,
    spawn: Vector3,
    public absoluteRotation: Quaternion
  ) {
    this.playerId = id;
    this.loadAndSetTransform(spawn, absoluteRotation);
    this.loadSound();
    this.setPhysics();
    this.setLight();

    TankMe.physicsPlugin.onCollisionObservable.add((ev) => this.onCollide(ev));
    this.mesh.registerBeforeRender((mesh) => this.checkBounds(mesh));
  }

  private loadAndSetTransform(spawn: Vector3, absoluteRotation: Quaternion) {
    this.mesh = Shell.refShell.clone(`shell-${uuid()}`);
    this.mesh.position = new Vector3(spawn.x, spawn.y + 1.75, spawn.z);
    this.mesh.rotationQuaternion = absoluteRotation.clone();
    this.mesh.translate(Axis.Z, 6.5, Space.LOCAL);
    this.mesh.isVisible = false;
    this.mesh.material = Shell.refShellMaterial;
  }
  private loadSound() {
    this.explosionSound = new Sound(
      'explosion',
      AssetLoader.assets['/assets/game/audio/explosion.mp3'] as ArrayBuffer,
      this.scene,
      null,
      {
        loop: false,
        autoplay: false,
        spatialSound: true,
        maxDistance: 70
      }
    );
  }
  private setPhysics() {
    new PhysicsAggregate(
      this.mesh,
      PhysicsShapeType.BOX,
      { mass: 0.01, restitution: 0 },
      this.scene
    ).body.setCollisionCallbackEnabled(true);
  }
  private onCollide(event: IPhysicsCollisionEvent) {
    if (event.collider.transformNode.name !== 'shell') return;

    // shell.physicsImpostor.sleep();
    const explosionOrigin = this.mesh.position;
    this.mesh.dispose();
    this.explosionSound.setPosition(explosionOrigin.clone());
    this.explosionSound.onEndedObservable.add(() => this.explosionSound.dispose());
    this.explosionSound.play();

    // showBlast(blastOrigin);
    if (event.collidedAgainst.transformNode.name !== 'ground') {
      event.collidedAgainst.applyImpulse(
        event.collider.transformNode
          .getDirection(new Vector3(0, 0, 1))
          .normalize()
          .scale(8),
        explosionOrigin
      );
    }
  }
  private checkBounds(mesh: AbstractMesh) {
    if (mesh.position.x > 300 || mesh.position.x < -300 || mesh.position.z > 300 || mesh.position.z < -300) {
      mesh.physicsBody?.setMassProperties({ mass: 0 });
      // mesh.physicsImpostor.sleep();
      mesh.dispose();
    }
  }
  private setLight() {
    this.pointLight = new PointLight(`light-${this.mesh.name}`, new Vector3(0, 0, 0), this.scene);
    this.pointLight.intensity = 3;
    this.pointLight.range = 20;
    this.pointLight.parent = this.mesh;
    this.pointLight.setEnabled(false);
  }

  public fire() {
    this.isSpent = true;

    this.pointLight.setEnabled(true);
    this.particleSystem.start();

    this.mesh.physicsBody?.applyImpulse(
      this.mesh
        .getDirection(new Vector3(0, 0, 1))
        .normalize()
        .scale(1.2),
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

    Shell.refShell = MeshBuilder.CreateBox('shell', { height: 0.1, width: 0.1, depth: 1 }, scene);
  }
  static create(id: string, scene: Scene, spawn: Vector3, absoluteRotation: Quaternion): Shell {
    Shell.setRefShell(scene);
    return new Shell(id, scene, spawn, absoluteRotation);
  }
}
