import {
  TransformNode,
  type AbstractMesh,
  type Mesh,
  Vector3,
  PhysicsShapeConvexHull,
  PhysicsShapeContainer,
  PhysicsBody,
  PhysicsMotionType
} from '@babylonjs/core';

import type { World } from '../main';
import type { Player } from '../state';
import { Tank } from './tank';
import { Shell } from './shell';

export class EnemyTank extends Tank {
  constructor(world: World, state: Player, rootMesh: AbstractMesh, spawn: Vector3) {
    super(world, state);

    this.setTransform(rootMesh, spawn);
    this.setPhysics(rootMesh as Mesh);

    this.observers.push(this.world.scene.onBeforeStepObservable.add(this.beforeStep.bind(this)));
  }
  static async create(world: World, state: Player, rootMesh: AbstractMesh, spawn: Vector3) {
    const cloned = rootMesh.clone(`${rootMesh.name.replace(':Ref', '')}:${state.sid}`, null)!;
    const newTank = new EnemyTank(world, state, cloned, spawn);
    await newTank.init();
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
  private beforeStep() {
    this.animate();
  }

  fire() {
    this.loadedDummyShell.fire();
    this.particleSystems['muzzle']?.start();
    this.sounds['cannon']?.play();
    Shell.create(this).then((shell) => (this.loadedDummyShell = shell));
  }
}
