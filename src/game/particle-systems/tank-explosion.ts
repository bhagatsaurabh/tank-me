import {
  AbstractMesh,
  Color4,
  GPUParticleSystem,
  Scene,
  SphereDirectedParticleEmitter,
  Texture,
  Vector3
} from '@babylonjs/core';
import { AssetLoader } from '../loader';
import { luid } from '@/utils/utils';

export class PSTankExplosion {
  private psExplosion!: GPUParticleSystem;
  private psFire!: GPUParticleSystem;

  private constructor(
    public emitter: AbstractMesh,
    public scene: Scene
  ) {
    this.setExplosion();
    this.setFire();
  }

  private setExplosion() {
    this.psExplosion = new GPUParticleSystem(
      `PS:TankExplosion:${luid()}`,
      { capacity: 400, randomTextureSize: 1024 },
      this.scene
    );

    this.psExplosion.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/smoke_dust_cloud.png'] as string,
      this.scene
    );
    this.psExplosion.isBillboardBased = true;
    this.psExplosion.emitter = this.emitter;
    const sphereEmitter = new SphereDirectedParticleEmitter(
      0.5,
      new Vector3(-3.5, 0, -3.5),
      new Vector3(3.5, 5, 3.5)
    );
    this.psExplosion.particleEmitterType = sphereEmitter;
    this.psExplosion.blendMode = GPUParticleSystem.BLENDMODE_MULTIPLYADD;
    this.psExplosion.updateSpeed = 0.1;
    this.psExplosion.emitRate = 1000;
    this.psExplosion.minEmitPower = 7;
    this.psExplosion.maxEmitPower = 8;
    this.psExplosion.minLifeTime = 2;
    this.psExplosion.maxLifeTime = 4;
    this.psExplosion.minScaleX = 1;
    this.psExplosion.maxScaleX = 1;
    this.psExplosion.minScaleY = 1;
    this.psExplosion.maxScaleY = 1;
    this.psExplosion.targetStopDuration = 1.5;
    this.psExplosion
      .addSizeGradient(0, 1)
      .addSizeGradient(1, 5)
      .addLimitVelocityGradient(0, 5)
      .addLimitVelocityGradient(0.15, 3)
      .addLimitVelocityGradient(0.25, 2)
      .addLimitVelocityGradient(1, 1)
      .addColorGradient(0, Color4.FromInts(255, 220, 0, 204))
      .addColorGradient(0.4, Color4.FromInts(252, 143, 0, 153))
      .addColorGradient(1, Color4.FromInts(0, 0, 0, 0));
    this.psExplosion.isAnimationSheetEnabled = true;
    this.psExplosion.startSpriteCellID = 0;
    this.psExplosion.endSpriteCellID = 63;
    this.psExplosion.spriteCellLoop = true;
    this.psExplosion.spriteRandomStartCell = true;
    this.psExplosion.spriteCellWidth = 128;
    this.psExplosion.spriteCellHeight = 128;
    this.psExplosion.spriteCellChangeSpeed = 1.0;
    this.psExplosion.preventAutoStart = true;
  }
  private setFire() {
    this.psFire = new GPUParticleSystem(
      `PS:TankFire:${luid()}`,
      { capacity: 50, randomTextureSize: 1024 },
      this.scene
    );

    this.psFire.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/fire.png'] as string,
      this.scene
    );
    this.psFire.emitter = this.emitter;
    this.psFire.worldOffset.y = 3;
    this.psFire.gravity.y = 1;
    this.psFire.isBillboardBased = true;
    this.psFire.blendMode = GPUParticleSystem.BLENDMODE_MULTIPLYADD;
    this.psFire.updateSpeed = 0.026;
    this.psFire.direction1 = Vector3.Zero();
    this.psFire.direction2 = Vector3.Zero();
    this.psFire.minEmitBox = new Vector3(-1, 0, -2.5);
    this.psFire.maxEmitBox = new Vector3(1, 0, 1);
    this.psFire.emitRate = 50.0;
    this.psFire.minEmitPower = 0;
    this.psFire.maxEmitPower = 0;
    this.psFire.minScaleX = 2;
    this.psFire.maxScaleX = 2;
    this.psFire.minScaleY = 2;
    this.psFire.maxScaleY = 2;
    this.psFire.minLifeTime = 2;
    this.psFire.maxLifeTime = 3;
    this.psFire.minInitialRotation = Math.PI;
    this.psFire.maxInitialRotation = Math.PI;
    this.psFire
      .addSizeGradient(0, 0)
      .addSizeGradient(0.37, 3)
      .addSizeGradient(1, 6)
      .addSizeGradient(0, 0)
      .addColorGradient(0, Color4.FromInts(255, 220, 0, 204))
      .addColorGradient(0.4, Color4.FromInts(252, 143, 0, 153))
      .addColorGradient(1, Color4.FromInts(0, 0, 0, 0));
    this.psFire.isAnimationSheetEnabled = true;
    this.psFire.startSpriteCellID = 1;
    this.psFire.endSpriteCellID = 63;
    this.psFire.spriteCellLoop = true;
    this.psFire.spriteRandomStartCell = true;
    this.psFire.spriteCellWidth = 128;
    this.psFire.spriteCellHeight = 128;
    this.psFire.spriteCellChangeSpeed = 0.4;

    this.psFire.preventAutoStart = true;
  }

  public start() {
    this.psExplosion.start();
    this.psFire.start();
  }

  public stop() {
    //
  }
  public dispose() {
    //
  }

  static create(emitter: AbstractMesh, scene: Scene) {
    return new PSTankExplosion(emitter, scene);
  }
}
