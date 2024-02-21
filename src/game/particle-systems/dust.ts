import { Scene } from '@babylonjs/core';
import { AbstractMesh } from '@babylonjs/core/Meshes';
import { Color4, Vector3 } from '@babylonjs/core/Maths';
import { Texture } from '@babylonjs/core/Materials';
import { GPUParticleSystem, ParticleSystem } from '@babylonjs/core/Particles';

import { AssetLoader } from '../loader';
import { delay, luid } from '@/utils/utils';

export class PSDust {
  private isStarted = false;
  private unsub: (() => void)[] = [];
  private currParticleSystem!: string;
  private particleSystems: Record<string, GPUParticleSystem> = {};

  private constructor(
    public emitter: AbstractMesh,
    public scene: Scene
  ) {
    this.setProperties();
  }
  private setProperties() {
    const particleSystem = new GPUParticleSystem(
      `PS:Dust:${luid()}`,
      { capacity: 250, randomTextureSize: 1024 },
      this.scene
    );

    particleSystem.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/smoke_dust_cloud.png'] as string,
      this.scene
    );
    particleSystem.isBillboardBased = true;
    particleSystem.emitter = this.emitter;
    particleSystem.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    particleSystem.emitRate = 20;
    particleSystem.minEmitPower = 0.1;
    particleSystem.maxEmitPower = 0.2;
    particleSystem.minLifeTime = 3;
    particleSystem.maxLifeTime = 4;
    particleSystem.minScaleX = 1;
    particleSystem.maxScaleX = 1;
    particleSystem.minScaleY = 1;
    particleSystem.maxScaleY = 1;
    particleSystem.minEmitBox = new Vector3(0, -0.3, -3);
    particleSystem.maxEmitBox = new Vector3(0, -0.3, 3);
    particleSystem.direction1 = new Vector3(-2, 0, -2);
    particleSystem.direction2 = new Vector3(2, 2, 2);
    particleSystem.updateSpeed = 0.01;
    particleSystem.isAnimationSheetEnabled = true;
    particleSystem.startSpriteCellID = 1;
    particleSystem.endSpriteCellID = 63;
    particleSystem.spriteCellLoop = true;
    particleSystem.spriteRandomStartCell = true;
    particleSystem.spriteCellWidth = 128;
    particleSystem.spriteCellHeight = 128;
    particleSystem.spriteCellChangeSpeed = 0.1;
    particleSystem.preventAutoStart = true;
    particleSystem
      .addSizeGradient(0, 2)
      .addSizeGradient(1, 11)
      .addColorGradient(0, Color4.FromInts(178, 153, 110, 0))
      .addColorGradient(0.15, Color4.FromInts(178, 153, 110, 200))
      .addColorGradient(0.7, Color4.FromInts(178, 153, 110, 100))
      .addColorGradient(1, Color4.FromInts(178, 153, 110, 0));

    this.particleSystems[particleSystem.name] = particleSystem;
    this.currParticleSystem = particleSystem.name;
  }

  public start() {
    if (this.isStarted) return;

    this.particleSystems[this.currParticleSystem].start();
    this.isStarted = true;
  }
  public async stop() {
    if (!this.isStarted) return;

    this.particleSystems[this.currParticleSystem].stop();
    this.isStarted = false;

    const currId = this.currParticleSystem;
    // Create new system immediately
    this.setProperties();
    // Disposing only when all the particles are invisible after sometime
    if (!(await delay(6000, (clear) => this.unsub.push(clear)))) return;
    this.particleSystems[currId].dispose();
    delete this.particleSystems[currId];
  }

  static create(emitter: AbstractMesh, scene: Scene) {
    return new PSDust(emitter, scene);
  }
}
