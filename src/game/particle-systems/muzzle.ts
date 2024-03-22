import { Scene } from '@babylonjs/core';
import { AbstractMesh, TransformNode } from '@babylonjs/core/Meshes';
import { Color4, Vector3 } from '@babylonjs/core/Maths';
import { Texture } from '@babylonjs/core/Materials';
import { ParticleSystem, SphereDirectedParticleEmitter } from '@babylonjs/core/Particles';

import { AssetLoader } from '../loader';
import { luid } from '@/utils/utils';

export class PSMuzzle {
  private psExplosion!: ParticleSystem;
  private psSmoke!: ParticleSystem;
  // private psDelayedSmoke!: GPUParticleSystem;

  private constructor(
    public emitter: TransformNode,
    public scene: Scene
  ) {
    this.setExplosion();
    this.setSmoke();
    // this.setDelayedSmoke();
  }

  private setExplosion() {
    this.psExplosion = new ParticleSystem(`PS:MuzzleExplosion:${luid()}`, 200, this.scene);
    this.psExplosion.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/explosion.png'] as string,
      this.scene
    );
    this.psExplosion.isBillboardBased = true;
    this.psExplosion.emitter = this.emitter as AbstractMesh;
    this.psExplosion.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.psExplosion.emitRate = 750;
    this.psExplosion.minEmitPower = 1;
    this.psExplosion.maxEmitPower = 8;
    this.psExplosion.minLifeTime = 0.1;
    this.psExplosion.maxLifeTime = 0.2;
    this.psExplosion.minScaleX = 1;
    this.psExplosion.maxScaleX = 1;
    this.psExplosion.minScaleY = 1;
    this.psExplosion.maxScaleY = 1;
    this.psExplosion.minEmitBox = Vector3.Zero();
    this.psExplosion.maxEmitBox = Vector3.Zero();
    this.psExplosion.direction1 = new Vector3(-1.5, -1.5, 5);
    this.psExplosion.direction2 = new Vector3(1.5, 1.5, 6);
    this.psExplosion.updateSpeed = 0.1;
    this.psExplosion.isAnimationSheetEnabled = true;
    this.psExplosion.startSpriteCellID = 0;
    this.psExplosion.endSpriteCellID = 15;
    this.psExplosion.spriteCellLoop = false;
    this.psExplosion.spriteRandomStartCell = false;
    this.psExplosion.spriteCellWidth = 256;
    this.psExplosion.spriteCellHeight = 256;
    this.psExplosion.spriteCellChangeSpeed = 2.5;
    this.psExplosion.preventAutoStart = true;
    this.psExplosion.targetStopDuration = 0.7;
    this.psExplosion.isLocal = true;
    this.psExplosion
      .addSizeGradient(0, 0)
      .addSizeGradient(1, 2)
      .addColorGradient(0, Color4.FromInts(255, 248, 151, 0))
      .addColorGradient(0.15, Color4.FromInts(255, 248, 151, 255))
      .addColorGradient(0.7, Color4.FromInts(255, 248, 151, 100))
      .addColorGradient(1, Color4.FromInts(255, 248, 151, 0));
  }
  private setSmoke() {
    this.psSmoke = new ParticleSystem(`PS:MuzzleSmoke:${luid()}`, 200, this.scene);
    this.psSmoke.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/smoke_dust_cloud.png'] as string,
      this.scene
    );
    this.psSmoke.isBillboardBased = true;
    this.psSmoke.emitter = this.emitter as AbstractMesh;
    this.psSmoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.psSmoke.emitRate = 1000;
    this.psSmoke.minEmitPower = 0.5;
    this.psSmoke.maxEmitPower = 1.5;
    this.psSmoke.minLifeTime = 0.25;
    this.psSmoke.maxLifeTime = 0.5;
    this.psSmoke.minScaleX = 1;
    this.psSmoke.maxScaleX = 1;
    this.psSmoke.minScaleY = 1;
    this.psSmoke.maxScaleY = 1;
    const sphereEmitter = new SphereDirectedParticleEmitter(
      0,
      new Vector3(-2.5, -2.5, 0),
      new Vector3(2.5, 2.5, 2.5)
    );
    this.psSmoke.particleEmitterType = sphereEmitter;
    this.psSmoke.updateSpeed = 0.03;
    this.psSmoke.isAnimationSheetEnabled = true;
    this.psSmoke.startSpriteCellID = 1;
    this.psSmoke.endSpriteCellID = 63;
    this.psSmoke.spriteCellLoop = true;
    this.psSmoke.spriteRandomStartCell = true;
    this.psSmoke.spriteCellWidth = 128;
    this.psSmoke.spriteCellHeight = 128;
    this.psSmoke.spriteCellChangeSpeed = 0.1;
    this.psSmoke.preventAutoStart = true;
    this.psSmoke.isLocal = true;
    this.psSmoke.targetStopDuration = 0.05;
    this.psSmoke
      .addSizeGradient(0, 0)
      .addSizeGradient(1, 3)
      .addColorGradient(0, Color4.FromInts(255, 255, 255, 0), Color4.FromInts(255, 255, 255, 0))
      .addColorGradient(0.15, Color4.FromInts(224, 214, 197, 255), Color4.FromInts(224, 214, 197, 255))
      .addColorGradient(0.7, Color4.FromInts(224, 214, 197, 150), Color4.FromInts(224, 214, 197, 150))
      .addColorGradient(1, Color4.FromInts(224, 214, 197, 0), Color4.FromInts(224, 214, 197, 0));
  }

  // Seems a bit superflous
  /* private setDelayedSmoke() {
    this.psDelayedSmoke = new GPUParticleSystem(
      `PS:MuzzleDelayedSmoke:${luid()}`,
      { capacity: 10000, randomTextureSize: 1024 },
      this.scene
    );
    this.psDelayedSmoke.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/smoke_dust_cloud.png'] as string,
      this.scene
    );
    this.psDelayedSmoke.isBillboardBased = true;
    this.psDelayedSmoke.emitter = this.emitter as AbstractMesh;
    this.psDelayedSmoke.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.psDelayedSmoke.emitRate = 10000;
    this.psDelayedSmoke.minEmitPower = 1;
    this.psDelayedSmoke.maxEmitPower = 3;
    this.psDelayedSmoke.minLifeTime = 0.5;
    this.psDelayedSmoke.maxLifeTime = 1;
    this.psDelayedSmoke.minScaleX = 1;
    this.psDelayedSmoke.maxScaleX = 1;
    this.psDelayedSmoke.minScaleY = 1;
    this.psDelayedSmoke.maxScaleY = 1;
    const pointEmitter = new PointParticleEmitter();
    pointEmitter.direction1 = new Vector3(-0.5, -0.5, 4);
    pointEmitter.direction2 = new Vector3(0.5, 0.5, 4);
    this.psDelayedSmoke.particleEmitterType = pointEmitter;
    this.psDelayedSmoke.updateSpeed = 0.01;
    this.psDelayedSmoke.isAnimationSheetEnabled = true;
    this.psDelayedSmoke.startSpriteCellID = 1;
    this.psDelayedSmoke.endSpriteCellID = 63;
    this.psDelayedSmoke.spriteCellLoop = true;
    this.psDelayedSmoke.spriteRandomStartCell = true;
    this.psDelayedSmoke.spriteCellWidth = 128;
    this.psDelayedSmoke.spriteCellHeight = 128;
    this.psDelayedSmoke.spriteCellChangeSpeed = 0.1;
    this.psDelayedSmoke.preventAutoStart = true;
    this.psDelayedSmoke.targetStopDuration = 0.7;
    this.psDelayedSmoke
      .addSizeGradient(0, 0.1)
      .addSizeGradient(0.75, 1)
      .addSizeGradient(1, 2)
      .addColorGradient(0, Color4.FromInts(255, 255, 255, 0))
      .addColorGradient(0.15, Color4.FromInts(255, 255, 255, 255))
      .addColorGradient(0.7, Color4.FromInts(255, 255, 255, 150))
      .addColorGradient(1, Color4.FromInts(255, 255, 255, 0))
      .addDragGradient(0, 0.1)
      .addDragGradient(0.6, 0.3)
      .addDragGradient(1, 2);

    this.psDelayedSmoke.onDisposeObservable.add(() => this.setDelayedSmoke());
  } */

  async start() {
    this.psExplosion.start();
    this.psSmoke.start();

    /* this.psDelayedSmoke.start();
    // Workaround since GPUParticles are one-off & continuous
    if (!(await delay(3000, (clear) => this.unsub.push(clear)))) return;
    this.psDelayedSmoke.stop();
    if (!(await delay(3000, (clear) => this.unsub.push(clear)))) return;
    this.psDelayedSmoke.dispose(false); */
  }
  stop() {
    //
  }
  dispose() {
    // this.unsub.forEach((clear) => clear?.());
  }

  static create(emitter: TransformNode, scene: Scene) {
    return new PSMuzzle(emitter, scene);
  }
}
