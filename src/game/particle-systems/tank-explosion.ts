import {
  AbstractMesh,
  Color4,
  GPUParticleSystem,
  ParticleSystem,
  Scene,
  Texture,
  Vector3
} from '@babylonjs/core';
import { AssetLoader } from '../loader';

export class PSTankExplosion {
  private particleSystem!: GPUParticleSystem | ParticleSystem;

  private constructor(
    public emitter: AbstractMesh,
    public scene: Scene
  ) {
    this.setProperties();
  }

  private setProperties() {
    if (GPUParticleSystem.IsSupported) {
      this.particleSystem = new GPUParticleSystem(
        'tank-explosion',
        { capacity: 8000, randomTextureSize: 1024 },
        this.scene
      );
    } else {
      this.particleSystem = new ParticleSystem('tank-explosion', 2000, this.scene);
    }

    this.particleSystem.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/textures/explosion.png'] as string,
      this.scene
    );
    this.particleSystem.emitter = this.emitter;
    this.particleSystem.minEmitBox = new Vector3(-0.3, -0.3, -0.3);
    this.particleSystem.maxEmitBox = new Vector3(0.3, 0.3, 0.3);
    this.particleSystem.color1 = new Color4(0.953, 0.503, 0, 1.0);
    this.particleSystem.color2 = new Color4(1, 0.66, 0.113, 1.0);
    this.particleSystem.colorDead = new Color4(0, 0, 0, 1.0);
    this.particleSystem.minSize = 0.1;
    this.particleSystem.maxSize = 0.2;
    this.particleSystem.minLifeTime = 3;
    this.particleSystem.maxLifeTime = 5;
    this.particleSystem.emitRate = 6000;
    this.particleSystem.blendMode = GPUParticleSystem.BLENDMODE_ONEONE;
    this.particleSystem.gravity = new Vector3(0, -0.2, 0);
    this.particleSystem.direction1 = new Vector3(-0.05, -0.05, -0.05);
    this.particleSystem.direction2 = new Vector3(0.05, 0.05, 0.05);
    this.particleSystem.minAngularSpeed = 0;
    this.particleSystem.maxAngularSpeed = Math.PI;
    this.particleSystem.minEmitPower = 20;
    this.particleSystem.maxEmitPower = 26;
    this.particleSystem.updateSpeed = 0.05;
    this.particleSystem.targetStopDuration = 1;
    this.particleSystem.disposeOnStop = true;
    this.particleSystem.preWarmCycles = GPUParticleSystem.IsSupported ? 400 : 100;
  }

  static create(emitter: AbstractMesh, scene: Scene) {
    return new PSTankExplosion(emitter, scene).particleSystem;
  }
}
