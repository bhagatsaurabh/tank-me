import { Scene } from '@babylonjs/core';
import { AbstractMesh } from '@babylonjs/core/Meshes';
import { Color4, Vector3 } from '@babylonjs/core/Maths';
import { Texture } from '@babylonjs/core/Materials';
import { ParticleSystem } from '@babylonjs/core/Particles';

import { AssetLoader } from '../loader';
import { luid } from '@/utils/utils';

export class PSDust {
  // GPUParticleSystem is not suited (yet?) for intermittent effect
  private particleSystem!: ParticleSystem;

  private constructor(
    public emitter: AbstractMesh,
    public scene: Scene
  ) {
    this.setProperties();
  }
  private setProperties() {
    this.particleSystem = new ParticleSystem(`PS:Dust:${luid()}`, 250, this.scene);

    this.particleSystem.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/smoke_dust_cloud.png'] as string,
      this.scene
    );
    this.particleSystem.isBillboardBased = true;
    this.particleSystem.emitter = this.emitter;
    this.particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.particleSystem.emitRate = 20;
    this.particleSystem.minEmitPower = 0.1;
    this.particleSystem.maxEmitPower = 0.2;
    this.particleSystem.minLifeTime = 3;
    this.particleSystem.maxLifeTime = 4;
    this.particleSystem.minScaleX = 1;
    this.particleSystem.maxScaleX = 1;
    this.particleSystem.minScaleY = 1;
    this.particleSystem.maxScaleY = 1;
    this.particleSystem.minEmitBox = new Vector3(0, -0.3, -3);
    this.particleSystem.maxEmitBox = new Vector3(0, -0.3, 3);
    this.particleSystem.direction1 = new Vector3(-2, 0, -2);
    this.particleSystem.direction2 = new Vector3(2, 2, 2);
    this.particleSystem.updateSpeed = 0.01;
    this.particleSystem.isAnimationSheetEnabled = true;
    this.particleSystem.startSpriteCellID = 1;
    this.particleSystem.endSpriteCellID = 63;
    this.particleSystem.spriteCellLoop = true;
    this.particleSystem.spriteRandomStartCell = true;
    this.particleSystem.spriteCellWidth = 128;
    this.particleSystem.spriteCellHeight = 128;
    this.particleSystem.spriteCellChangeSpeed = 0.1;
    this.particleSystem.preventAutoStart = true;
    this.particleSystem
      .addSizeGradient(0, 2)
      .addSizeGradient(1, 9)
      .addColorGradient(0, Color4.FromInts(178, 153, 110, 0))
      .addColorGradient(0.15, Color4.FromInts(178, 153, 110, 200))
      .addColorGradient(0.7, Color4.FromInts(178, 153, 110, 100))
      .addColorGradient(1, Color4.FromInts(178, 153, 110, 0));
  }

  public start() {
    this.particleSystem.start();
  }
  public stop() {
    this.particleSystem.stop();
  }

  static create(emitter: AbstractMesh, scene: Scene) {
    return new PSDust(emitter, scene);
  }
}
