import {
  AbstractMesh,
  Color4,
  ConeParticleEmitter,
  GPUParticleSystem,
  Scene,
  Texture,
  Vector3
} from '@babylonjs/core';
import { AssetLoader } from '../loader';

export class PSExhaust {
  private particleSystem!: GPUParticleSystem;

  private constructor(
    public id: string,
    public emitter: AbstractMesh,
    public scene: Scene
  ) {
    this.setProperties();
  }
  private setProperties() {
    this.particleSystem = new GPUParticleSystem(
      `PS:Exhaust:${this.id}`,
      { capacity: 300, randomTextureSize: 4096 },
      this.scene
    );

    this.particleSystem.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/Smoke_SpriteSheet_8x8.png'] as string,
      this.scene
    );
    this.particleSystem.isBillboardBased = true;
    this.particleSystem.emitter = this.emitter;
    this.particleSystem.particleEmitterType = new ConeParticleEmitter(0.1, 0.6);
    this.particleSystem.blendMode = GPUParticleSystem.BLENDMODE_STANDARD;
    this.particleSystem.maxActiveParticleCount = 100;
    this.particleSystem.emitRate = 10;
    this.particleSystem.minEmitPower = 0.1;
    this.particleSystem.maxEmitPower = 0.2;
    this.particleSystem.minLifeTime = 2;
    this.particleSystem.maxLifeTime = 3;
    this.particleSystem.minScaleX = 0.1;
    this.particleSystem.maxScaleX = 0.1;
    this.particleSystem.minScaleY = 0.1;
    this.particleSystem.maxScaleY = 0.1;
    this.particleSystem.updateSpeed = 0.1;
    this.particleSystem.addSizeGradient(0, 1);
    this.particleSystem.addSizeGradient(1, 3);
    this.particleSystem.addColorGradient(0, Color4.FromInts(128, 128, 128, 255));
    this.particleSystem.addColorGradient(0.3, Color4.FromInts(77, 77, 77, 200));
    this.particleSystem.addColorGradient(0.7, Color4.FromInts(51, 51, 51, 100));
    this.particleSystem.addColorGradient(1, Color4.FromInts(26, 26, 26, 0));
    this.particleSystem.isAnimationSheetEnabled = true;
    this.particleSystem.startSpriteCellID = 1;
    this.particleSystem.endSpriteCellID = 63;
    this.particleSystem.spriteCellLoop = true;
    this.particleSystem.spriteRandomStartCell = true;
    this.particleSystem.spriteCellWidth = 128;
    this.particleSystem.spriteCellHeight = 128;
    this.particleSystem.spriteCellChangeSpeed = 2.5;
    this.particleSystem.noiseStrength = new Vector3(0.2, 0, 0.15);
    this.particleSystem.preventAutoStart = true;
  }

  public start() {
    this.particleSystem.start();
  }
  public stop() {
    this.particleSystem.stop();
  }

  static create(id: string, emitter: AbstractMesh, scene: Scene) {
    return new PSExhaust(id, emitter, scene);
  }
}
