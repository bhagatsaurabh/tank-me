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
      await instance.load();
      instance.scene.createDefaultSkybox(instance.cubeTexture, true, 1000);
    }
    return instance;
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
