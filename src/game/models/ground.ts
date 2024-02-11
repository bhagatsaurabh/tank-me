import {
  MeshBuilder,
  type GroundMesh,
  Scene,
  StandardMaterial,
  Texture,
  Color3,
  PhysicsAggregate,
  PhysicsShapeType,
  PhysicsImpostor
} from '@babylonjs/core';

import { AssetLoader } from '../loader';

export class Ground {
  private static instance: Ground;
  static groundMesh: GroundMesh;

  private static createMesh(scene: Scene) {
    return new Promise((resolve) => {
      Ground.groundMesh = MeshBuilder.CreateGroundFromHeightMap(
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
      );
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

    new PhysicsAggregate(
      mesh,
      PhysicsShapeType.MESH,
      { mass: 0, restitution: 0, friction: 10 },
      scene
    ).body.setCollisionCallbackEnabled(true);

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
