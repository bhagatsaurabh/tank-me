import { Scene } from '@babylonjs/core';
import { AbstractMesh } from '@babylonjs/core/Meshes';
import { Color4, Vector3 } from '@babylonjs/core/Maths';
import { Texture } from '@babylonjs/core/Materials';
import { Particle, ParticleSystem, SphereDirectedParticleEmitter } from '@babylonjs/core/Particles';

import { AssetLoader } from '../loader';
import { luid } from '@/utils/utils';

export class PSMuzzle {
  private psExplosion!: ParticleSystem;
  private psShockwave!: ParticleSystem;
  private psDelayedSmoke!: ParticleSystem;

  private constructor(
    public emitter: AbstractMesh,
    public scene: Scene
  ) {
    this.setProperties();
  }
  private setProperties() {
    this.setExplosion();
    this.setShockwave();
    this.setDelayedSmoke();
  }

  private setExplosion() {
    this.psExplosion = new ParticleSystem(`PS:MuzzleExplosion:${luid()}`, 200, this.scene);
    this.psExplosion.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/explosion.png'] as string,
      this.scene
    );
    this.psExplosion.isBillboardBased = true;
    this.psExplosion.emitter = this.emitter;
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
    this.psExplosion.minEmitBox = new Vector3(0, 0, 4.5);
    this.psExplosion.maxEmitBox = new Vector3(0, 0, 4.5);
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
    this.psExplosion
      .addSizeGradient(0, 0)
      .addSizeGradient(1, 2)
      .addColorGradient(0, Color4.FromInts(255, 248, 151, 0))
      .addColorGradient(0.15, Color4.FromInts(255, 248, 151, 255))
      .addColorGradient(0.7, Color4.FromInts(255, 248, 151, 100))
      .addColorGradient(1, Color4.FromInts(255, 248, 151, 0));
  }
  private setShockwave() {
    this.psShockwave = new ParticleSystem(`PS:MuzzleShockwave:${luid()}`, 200, this.scene);
    this.psShockwave.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/spritesheets/smoke_dust_cloud.png'] as string,
      this.scene
    );
    this.psShockwave.isBillboardBased = true;
    this.psShockwave.emitter = this.emitter.absolutePosition.clone();
    this.psShockwave.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    this.psShockwave.emitRate = 5000;
    this.psShockwave.minEmitPower = 7;
    this.psShockwave.maxEmitPower = 7;
    this.psShockwave.minLifeTime = 0.25;
    this.psShockwave.maxLifeTime = 0.5;
    this.psShockwave.minScaleX = 1;
    this.psShockwave.maxScaleX = 1;
    this.psShockwave.minScaleY = 1;
    this.psShockwave.maxScaleY = 1;
    this.psShockwave.isLocal = true;
    const sphereEmitter = new SphereDirectedParticleEmitter(0, new Vector3(-5, 0, -5), new Vector3(5, 0, 5));
    this.psShockwave.particleEmitterType = sphereEmitter;
    this.psShockwave.updateSpeed = 0.01;
    this.psShockwave.isAnimationSheetEnabled = true;
    this.psShockwave.startSpriteCellID = 0;
    this.psShockwave.endSpriteCellID = 63;
    this.psShockwave.spriteCellLoop = true;
    this.psShockwave.spriteRandomStartCell = true;
    this.psShockwave.spriteCellWidth = 128;
    this.psShockwave.spriteCellHeight = 128;
    this.psShockwave.spriteCellChangeSpeed = 0.6;
    this.psShockwave.preventAutoStart = true;
    this.psShockwave.targetStopDuration = 0.05;
    this.psShockwave
      .addSizeGradient(0, 5)
      .addSizeGradient(1, 10)
      .addColorGradient(0, Color4.FromInts(224, 214, 197, 0))
      .addColorGradient(0.15, Color4.FromInts(224, 214, 197, 255))
      .addColorGradient(0.7, Color4.FromInts(224, 214, 197, 150))
      .addColorGradient(1, Color4.FromInts(224, 214, 197, 0));
    this.psShockwave.updateFunction = this.updateShockwave;
  }
  private updateShockwave(this: any, particles: Particle[]) {
    for (let index = 0; index < particles.length; index++) {
      const particle = particles[index];
      particle.age += this._scaledUpdateSpeed;
      if (particle.age >= particle.lifeTime) {
        particles.splice(index, 1);
        this._stockParticles.push(particle);
        index--;
        continue;
      } else {
        particle.colorStep.scaleToRef(this._scaledUpdateSpeed, this._scaledColorStep);
        particle.color.addInPlace(this._scaledColorStep);
        if (particle.color.a < 0) particle.color.a = 0;
        particle.angle += particle.angularSpeed * this._scaledUpdateSpeed;
        particle.direction.scaleToRef(this._scaledUpdateSpeed, this._scaledDirection);
        particle.position.addInPlace(this._scaledDirection);
        this.gravity.scaleToRef(this._scaledUpdateSpeed, this._scaledGravity);
        particle.direction.addInPlace(this._scaledGravity);
      }
    }
  }
  private setDelayedSmoke() {}

  public start(shockwaveOrigin?: Vector3) {
    // this.psExplosion.start();
    if (shockwaveOrigin) {
      this.psShockwave.emitter = shockwaveOrigin.add(new Vector3(0, -1, 0));
      this.psShockwave.start();
    }
    // this.psDelayedSmoke.start(500);
  }
  public stop() {
    //
  }

  static create(emitter: AbstractMesh, scene: Scene) {
    return new PSMuzzle(emitter, scene);
  }
}
