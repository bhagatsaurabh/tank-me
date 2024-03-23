import { Scene } from '@babylonjs/core';
import { StandardMaterial, Texture } from '@babylonjs/core/Materials';
import { Axis, Color3, Space, Vector3 } from '@babylonjs/core/Maths';
import { MeshBuilder, Mesh, LinesMesh, AbstractMesh } from '@babylonjs/core/Meshes';
import { PhysicsAggregate, type IPhysicsCollisionEvent, PhysicsShapeSphere } from '@babylonjs/core/Physics';
import { Sound } from '@babylonjs/core/Audio';
import { Observer } from '@babylonjs/core/Misc';

import { AssetLoader } from '../loader';
import { Debug } from '../debug';
import type { Tank } from './tank';
import { PSShellExplosion } from '../particle-systems/shell-explosion';
import { forwardVector, luid } from '@/utils/utils';
import type { PlayerTank } from './player';
import type { EnemyAITank } from './enemy-ai';

export class Shell {
  private static refShell: Mesh;
  private static refShellMaterial: StandardMaterial;
  private static refTrailMaterial: StandardMaterial;
  private static refPhysicsShape: PhysicsShapeSphere;
  private impactEnergy = 5;
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
    if (tank.world.vsAI) {
      this.playerId = tank.lid;
    } else {
      this.playerId = tank.state!.sid;
    }
    this.setTransform(mesh);
    this.setParticleSystem();

    this.observers.push(tank.world.physicsPlugin.onCollisionObservable.add((ev) => this.onCollide(ev)));
    this.observers.push(tank.world.scene.onBeforeStepObservable.add(this.beforeStep.bind(this)));
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
    this.tank.barrelTip.rotate(Axis.X, 0, Space.LOCAL);
    mesh.rotationQuaternion = this.tank.barrelTip.rotationQuaternion!.clone();
    mesh.isVisible = false;
    mesh.material = Shell.refShellMaterial;
    mesh.parent = this.tank.barrelTip;

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
    // If this shell is not part of the collision, ignore
    if (
      !this.isSpent ||
      (event.collider !== this.mesh.physicsBody! && event.collidedAgainst !== this.mesh.physicsBody!)
    ) {
      return;
    }

    // Determine which physics body is which, in case two dynamically moving bodies collide
    const shellCollider = event.collider === this.mesh.physicsBody! ? event.collider : event.collidedAgainst;
    const otherCollider = event.collider === shellCollider ? event.collidedAgainst : event.collider;
    if (otherCollider.transformNode.name.includes(this.playerId)) return;
    if (otherCollider.transformNode.name.includes('Panzer')) {
      otherCollider.applyImpulse(
        shellCollider.transformNode.getDirection(forwardVector).normalize().scale(this.impactEnergy),
        this.mesh.absolutePosition.clone()
      );

      if (this.tank.world.vsAI) {
        const hitPlayer = Object.values(this.tank.world.players).find((tank) =>
          (tank as PlayerTank | EnemyAITank).physicsBodies.includes(otherCollider)
        );
        if (hitPlayer?.barrel === otherCollider.transformNode) {
          hitPlayer.damage(10);
        } else if (hitPlayer?.turret === otherCollider.transformNode) {
          hitPlayer.damage(25);
        } else if (hitPlayer?.body === otherCollider.transformNode) {
          hitPlayer.damage(30);
        }
      }
    }

    const explosionOrigin = this.mesh.absolutePosition.clone();
    this.particleSystem.start(explosionOrigin);
    this.explosionSound.setPosition(explosionOrigin);
    this.explosionSound.onEndedObservable.add(() => this.explosionSound.dispose()).unregisterOnNextCall =
      true;
    this.explosionSound.play();

    this.dispose();
  }
  private beforeStep() {
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
  fire() {
    this.mesh.parent = null;
    this.mesh.position = this.tank.barrelTip.absolutePosition.clone();
    this.mesh.rotationQuaternion = this.tank.barrelTip.absoluteRotationQuaternion.clone();
    this.mesh.computeWorldMatrix();

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
