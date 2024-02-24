import { Scene } from '@babylonjs/core';
import { MeshBuilder, type GroundMesh } from '@babylonjs/core/Meshes';
import { PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core/Physics';
import { StandardMaterial, Texture } from '@babylonjs/core/Materials';
import { FurMaterial } from '@babylonjs/materials';
import { Color3, Vector3 } from '@babylonjs/core/Maths';

import { AssetLoader } from '../loader';

export class Ground {
  private static instance: Ground;
  private static isFlat = false;
  static groundMesh: GroundMesh;
  static groundFriction = 1;

  private static createMesh(scene: Scene) {
    return new Promise((resolve) => {
      if (Ground.isFlat) {
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
      } else {
        Ground.groundMesh = MeshBuilder.CreateGroundFromHeightMap(
          'ground',
          AssetLoader.assets['/assets/game/map/desert/height.png'] as string,
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
    Ground.groundMesh.collisionRetryCount = 5;

    mesh.position.y = 0;
    mesh.receiveShadows = true;

    /* const grassMaterial = new FurMaterial('grass', scene);
    grassMaterial.furLength = 0.2;
    grassMaterial.furAngle = 0.1;
    grassMaterial.furColor = Color3.FromInts(136, 104, 35);
    grassMaterial.diffuseTexture = new Texture(
      AssetLoader.assets['/assets/game/textures/grass.png'] as string,
      scene
    );
    grassMaterial.heightTexture = new Texture(
      AssetLoader.assets['/assets/game/map/desert/height.png'] as string,
      scene
    );
    grassMaterial.furTexture = FurMaterial.GenerateTexture('furTexture', scene);
    grassMaterial.furSpacing = 0.6;
    grassMaterial.furDensity = 15;
    grassMaterial.furSpeed = 2000;
    grassMaterial.furGravity = new Vector3(0, -1, 0);

    Ground.groundMesh.material = grassMaterial;
    const grassMesh = FurMaterial.FurifyMesh(Ground.groundMesh, 10); */

    done();
  }

  static async create(scene: Scene) {
    return Ground.instance ?? (await Ground.createMesh(scene));
  }

  public getGroundMesh() {
    return Ground.groundMesh;
  }
}
