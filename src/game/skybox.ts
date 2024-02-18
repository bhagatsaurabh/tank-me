import { Scene } from '@babylonjs/core';
import { CubeTexture } from '@babylonjs/core/Materials';

export class Skybox {
  cubeTexture!: CubeTexture;

  private constructor(public scene: Scene) {}
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

  static async create(scene: Scene) {
    const instance = new Skybox(scene);

    await instance.load();

    return instance.scene.createDefaultSkybox(instance.cubeTexture, true, 1000);
  }
}
