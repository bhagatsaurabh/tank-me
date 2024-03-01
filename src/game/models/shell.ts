import { Scene } from '@babylonjs/core';
import { StandardMaterial, Texture } from '@babylonjs/core/Materials';
import { Color3, Quaternion, Vector3 } from '@babylonjs/core/Maths';
import { MeshBuilder, Mesh, LinesMesh, AbstractMesh } from '@babylonjs/core/Meshes';
import { PhysicsAggregate, type IPhysicsCollisionEvent, PhysicsShapeSphere } from '@babylonjs/core/Physics';
import { Sound } from '@babylonjs/core/Audio';
import { Observer } from '@babylonjs/core/Misc';

import { AssetLoader } from '../loader';
import { Debug } from '../debug';
import type { Tank } from './tank';
import { PSShellExplosion } from '../particle-systems/shell-explosion';
import { forwardVector, luid } from '@/utils/utils';

export class Shell {
  private static refShell: Mesh;
  private static refShellMaterial: StandardMaterial;
  private static refTrailMaterial: StandardMaterial;
  private static refPhysicsShape: PhysicsShapeSphere;
  private playerId: string;
  private mesh!: AbstractMesh;
  private explosionSound!: Sound;
  private isSpent: boolean = false;
  private energy = 0.02;
  private debugTrajectory: Vector3[] = [];
  private debug = false;
  private observers: Observer<any>[] = [];
  private trail!: LinesMesh;
  private trailOptions: {
    points: Vector3[];
    updatable: boolean;
    material: StandardMaterial;
    instance?: LinesMesh;
  } = {
    points: [],
    updatable: true,
    material: Shell.refTrailMaterial
  };
  private trailLength = 3;
  private particleSystem!: PSShellExplosion;

  private constructor(
    public tank: Tank,
    mesh: AbstractMesh
  ) {
    this.playerId = tank.state.sid;
    this.setTransform(mesh);
    this.setParticleSystem();

    this.observers.push(tank.world.physicsPlugin.onCollisionObservable.add((ev) => this.onCollide(ev)));
    this.observers.push(tank.world.scene.onAfterStepObservable.add(this.afterStep.bind(this)));
  }
  private static setRefShell(scene: Scene) {
    if (Shell.refShell) return;

    Shell.refShellMaterial = new StandardMaterial('fire', scene);
    const texture = new Texture(AssetLoader.assets['/assets/game/textures/explosion.jpg'] as string, scene);
    texture.uScale = texture.vScale = 10;
    Shell.refShellMaterial.diffuseTexture = texture;
    Shell.refShellMaterial.specularColor = Color3.Black();
    Shell.refShellMaterial.emissiveColor = Color3.Yellow();

    Shell.refTrailMaterial = new StandardMaterial('trail', scene);
    Shell.refTrailMaterial.specularColor = Color3.Black();
    Shell.refTrailMaterial.emissiveColor = Color3.Yellow();

    Shell.refShell = MeshBuilder.CreateSphere('Shell:Ref', { diameter: 0.1, segments: 1 }, scene);
    Shell.refShell.isVisible = false;
    Shell.refPhysicsShape = new PhysicsShapeSphere(Vector3.Zero(), 0.05, scene);
  }
  static async create(tank: Tank): Promise<Shell> {
    Shell.setRefShell(tank.world.scene);
    const mesh = Shell.refShell.clone(`Shell:${luid()}`);
    const newShell = new Shell(tank, mesh);
    await newShell.loadSound();
    return newShell;
  }

  private setTransform(mesh: AbstractMesh) {
    mesh.position.z = 4.8;
    this.tank.barrel.computeWorldMatrix();
    mesh.rotationQuaternion = this.tank.barrel.rotationQuaternion!.clone();
    mesh.isVisible = false;
    mesh.material = Shell.refShellMaterial;
    mesh.parent = this.tank.barrel;

    const initialPos = mesh.absolutePosition.clone();
    this.trailOptions.points = new Array(this.trailLength).fill(null).map(() => initialPos.clone());
    this.trail = MeshBuilder.CreateLines(`Trail:${mesh.name}`, this.trailOptions, this.tank.world.scene);

    this.mesh = mesh;
  }
  private setParticleSystem() {
    this.particleSystem = PSShellExplosion.create(this.tank.world.scene);
  }
  private async loadSound() {
    return new Promise<boolean>((resolve) => {
      this.explosionSound = new Sound(
        'explosion',
        '/assets/game/audio/explosion.mp3',
        this.tank.world.scene,
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
  private setPhysics() {
    new PhysicsAggregate(
      this.mesh,
      Shell.refPhysicsShape,
      { mass: 0.0001, restitution: 0 },
      this.tank.world.scene
    ).body.setCollisionCallbackEnabled(true);
  }
  private onCollide(event: IPhysicsCollisionEvent) {
    if (!this.isSpent || event.collider.transformNode.name !== this.mesh.name) return;
    console.log(event.collidedAgainst.transformNode.name);

    const explosionOrigin = this.mesh.absolutePosition.clone();
    this.particleSystem.start(explosionOrigin);
    this.dispose();
    this.explosionSound.setPosition(explosionOrigin);
    this.explosionSound.onEndedObservable.add(() => this.explosionSound.dispose());
    this.explosionSound.play();

    if (event.collidedAgainst.transformNode.name !== 'ground') {
      event.collidedAgainst.applyImpulse(
        event.collider.transformNode.getDirection(forwardVector).normalize().scale(1),
        explosionOrigin
      );
    }
  }
  private afterStep() {
    if (!this.isSpent) return;

    if (
      Math.abs(this.mesh.position.x) > 750 ||
      Math.abs(this.mesh.position.y) > 750 ||
      Math.abs(this.mesh.position.z) > 750
    ) {
      this.dispose();
      return;
    }

    if (this.trail && !this.trail.isDisposed()) {
      this.trailOptions.instance = this.trail;
      this.trail = MeshBuilder.CreateLines(`Trail:${this.mesh.name}`, this.trailOptions);
      for (let i = 0; i < this.trailLength - 1; i += 1) {
        this.trailOptions.points[i] = this.trailOptions.points[i + 1];
      }
      this.trailOptions.points[this.trailLength - 1] = this.mesh.absolutePosition.clone();
    }
  }
  private dispose() {
    if (this.debug) {
      Debug.drawLine(`${this.mesh.name}:Trajectory`, this.debugTrajectory);
    }

    this.observers.forEach((observer) => observer.remove());
    this.mesh.physicsBody?.dispose();
    this.trail.dispose();
    this.mesh.dispose();
  }
  public fire() {
    // this.tank.barrel.computeWorldMatrix();
    // this.mesh.rotationQuaternion = this.tank.barrel.rotationQuaternion!.clone();
    this.mesh.rotationQuaternion = Quaternion.Identity();
    const firedPos = this.mesh.absolutePosition.clone();
    this.trailOptions.points.forEach((_, idx) => (this.trailOptions.points[idx] = firedPos.clone()));

    this.setPhysics();
    this.mesh.isVisible = true;
    this.mesh.physicsBody?.applyImpulse(
      this.mesh.getDirection(forwardVector).normalize().scale(this.energy),
      this.mesh.getAbsolutePosition()
    );
    this.isSpent = true;
  }
}
