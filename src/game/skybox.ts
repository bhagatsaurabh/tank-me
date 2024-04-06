import { Scene } from '@babylonjs/core';
import { CubeTexture } from '@babylonjs/core/Materials';

export class Skybox {
  private static instance: Skybox;
  cubeTexture!: CubeTexture;

  private constructor(public scene: Scene) {}
  static async create(scene: Scene) {
    let instance = Skybox.instance;
    if (!instance) {
      instance = new Skybox(scene);

      await instance.loadEnv();
      await instance.load();

      const skybox = instance.scene.createDefaultSkybox(instance.cubeTexture, false, 1000, undefined, false);
      skybox!.infiniteDistance = true;
    }
    return instance;
  }

  loadEnv() {
    return new Promise<boolean>((resolve) => {
      this.scene.environmentTexture = new CubeTexture(
        '/assets/game/skybox/environment.env',
        this.scene,
        null,
        undefined,
        null,
        () => resolve(true)
      );
    });
  }
  load() {
    return new Promise<boolean>((resolve) => {
      this.cubeTexture = new CubeTexture(
        '/assets/game/skybox/bluecloud',
        this.scene,
        null,
        undefined,
        null,
        () => resolve(true)
      );
    });
  }
}
