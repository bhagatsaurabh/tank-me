import { Scene } from '@babylonjs/core';
import { Color4, Vector3 } from '@babylonjs/core/Maths';
import { Texture } from '@babylonjs/core/Materials';
import { GPUParticleSystem, SphereDirectedParticleEmitter } from '@babylonjs/core/Particles';

import { AssetLoader } from '../loader';
import { delay, luid } from '@/utils';

export class PSShellExplosion {
  private particleSystem!: GPUParticleSystem;
  private unsub!: () => void;

  private constructor(public scene: Scene) {
    this.setProperties();
  }

  private setProperties() {
    this.particleSystem = new GPUParticleSystem(
      `PS:ShellExplosion:${luid()}`,
      { capacity: 150, randomTextureSize: 256 },
      this.scene
    );
    this.particleSystem.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/smoke_dust_cloud.png'] as string,
      this.scene
    );
    this.particleSystem.isBillboardBased = true;
    this.particleSystem.blendMode = GPUParticleSystem.BLENDMODE_MULTIPLYADD;
    this.particleSystem.updateSpeed = 0.025;
    const emitter = new SphereDirectedParticleEmitter(0.5, new Vector3(-2, 0, -2), new Vector3(2, 2, 2));
    this.particleSystem.particleEmitterType = emitter;
    this.particleSystem.emitRate = 600;
    this.particleSystem.minEmitPower = 30;
    this.particleSystem.maxEmitPower = 60;
    this.particleSystem.minScaleX = 1;
    this.particleSystem.maxScaleX = 1;
    this.particleSystem.minScaleY = 1;
    this.particleSystem.maxScaleY = 1;
    this.particleSystem.minLifeTime = 3;
    this.particleSystem.maxLifeTime = 3;
    this.particleSystem.targetStopDuration = 1;
    this.particleSystem.isAnimationSheetEnabled = true;
    this.particleSystem.startSpriteCellID = 0;
    this.particleSystem.endSpriteCellID = 63;
    this.particleSystem.spriteCellLoop = true;
    this.particleSystem.spriteRandomStartCell = true;
    this.particleSystem.spriteCellWidth = 64;
    this.particleSystem.spriteCellHeight = 64;
    this.particleSystem.spriteCellChangeSpeed = 1.0;
    this.particleSystem.preventAutoStart = true;
    this.particleSystem
      .addSizeGradient(0, 1)
      .addSizeGradient(0.12, 2)
      .addSizeGradient(1, 4)
      .addColorGradient(0, Color4.FromInts(255, 252, 0, 204))
      .addColorGradient(0.4, Color4.FromInts(255, 156, 0, 153))
      .addColorGradient(1, Color4.FromInts(0, 0, 0, 0))
      .addLimitVelocityGradient(0, 5)
      .addLimitVelocityGradient(0.15, 3)
      .addLimitVelocityGradient(0.25, 2)
      .addLimitVelocityGradient(1, 1);
  }

  async start(origin: Vector3) {
    this.particleSystem.emitter = origin;
    this.particleSystem.start();

    if (!(await delay(4000, (clear) => (this.unsub = clear)))) return;
    this.particleSystem.dispose();
  }
  stop() {
    //
  }
  dispose() {
    this.unsub?.();
  }

  static create(scene: Scene) {
    return new PSShellExplosion(scene);
  }
}
