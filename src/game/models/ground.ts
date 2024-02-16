import {
  MeshBuilder,
  type GroundMesh,
  Scene,
  StandardMaterial,
  Texture,
  Color3,
  PhysicsAggregate,
  PhysicsShapeType
} from '@babylonjs/core';

import { AssetLoader } from '../loader';

export class Ground {
  private static instance: Ground;
  static groundMesh: GroundMesh;
  static groundFriction = 1;

  private static createMesh(scene: Scene) {
    return new Promise((resolve) => {
      /* Ground.groundMesh = MeshBuilder.CreateGroundFromHeightMap(
        'ground',
        AssetLoader.assets['/assets/game/map/height.png'] as string,
        {
          width: 500,
          height: 500,
          subdivisions: 250,
          minHeight: 0,
          maxHeight: 14,
          updatable: false,
          onReady: (mesh) => Ground.onGroundCreated(scene, mesh, resolve)
        },
        scene
      ); */
      Ground.groundMesh = MeshBuilder.CreateGround(
        'ground',
        {
          width: 500,
          height: 500,
          subdivisions: 250,
          updatable: false
        },
        scene
      );
      this.onGroundCreated(scene, Ground.groundMesh, resolve);
    });
  }
  private static onGroundCreated(scene: Scene, mesh: GroundMesh, done: (val?: unknown) => void) {
    const groundMaterial = new StandardMaterial('ground', scene);
    groundMaterial.diffuseTexture = new Texture(
      AssetLoader.assets['/assets/game/map/diffuse.png'] as string,
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
    Ground.groundMesh.collisionRetryCount = 5;
    /* groundAgg.body.shape!.filterMembershipMask = 12;
    groundAgg.body.shape!.filterCollideMask = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11; */

    mesh.position.y = 0;
    mesh.receiveShadows = true;
    done();
  }

  static async create(scene: Scene) {
    return Ground.instance ?? (await Ground.createMesh(scene));
  }

  public getGroundMesh() {
    return Ground.groundMesh;
  }
}
