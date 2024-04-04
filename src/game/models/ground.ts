import { PhysicsAggregate, PhysicsShapeType, Scene } from '@babylonjs/core';
import { MeshBuilder, type GroundMesh } from '@babylonjs/core/Meshes';
import { StandardMaterial, Texture } from '@babylonjs/core/Materials';
import { Color3 } from '@babylonjs/core/Maths';

import { AssetLoader } from '../loader';
import type { World } from '../main';

export class Ground {
  private static instance: Ground;
  private static isFlat = false;
  static mesh: GroundMesh;
  static groundFriction = 1;

  static async create(world: World) {
    return Ground.instance ?? (await Ground.createMesh(world));
  }
  private static createMesh(world: World) {
    return new Promise((resolve) => {
      if (Ground.isFlat) {
        Ground.mesh = MeshBuilder.CreateGround(
          'ground',
          {
            width: 500,
            height: 500,
            subdivisions: world.config.ground.subdivisions,
            updatable: false
          },
          world.scene
        );
        this.onGroundCreated(world.scene, Ground.mesh, resolve);
      } else {
        Ground.mesh = MeshBuilder.CreateGroundFromHeightMap(
          'ground',
          AssetLoader.assets['/assets/game/map/desert/height.png'] as string,
          {
            width: 500,
            height: 500,
            subdivisions: 250,
            minHeight: 0,
            maxHeight: 14,
            updatable: false,
            onReady: (mesh) => Ground.onGroundCreated(world.scene, mesh, resolve)
          },
          world.scene
        );
      }
    });
  }
  private static onGroundCreated(scene: Scene, mesh: GroundMesh, done: (val?: unknown) => void) {
    const groundMaterial = new StandardMaterial('ground', scene);
    groundMaterial.diffuseTexture = new Texture(
      AssetLoader.assets['/assets/game/map/desert/diffuse.png'] as string,
      scene
    );
    groundMaterial.specularColor = new Color3(0, 0, 0);
    groundMaterial.ambientColor = new Color3(1, 1, 1);
    mesh.material = groundMaterial;

    const groundAgg = new PhysicsAggregate(
      mesh,
      PhysicsShapeType.MESH,
      { mass: 0, restitution: 0, friction: Ground.groundFriction },
      scene
    );
    groundAgg.body.setCollisionCallbackEnabled(true);
    mesh.collisionRetryCount = 5;
    mesh.position.y = 0;
    mesh.receiveShadows = true;

    done();
  }

  dispose() {
    Ground.mesh.physicsBody?.dispose();
    Ground.mesh.dispose();
  }
}
