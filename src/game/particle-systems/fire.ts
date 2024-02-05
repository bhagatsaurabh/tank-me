import { Color4, GPUParticleSystem, ParticleSystem, Scene, Texture, Vector3 } from '@babylonjs/core';
import { AssetLoader } from '../loader';

export class PSFire {
  private smokeSystem!: GPUParticleSystem | ParticleSystem;
  private fireSystem!: GPUParticleSystem | ParticleSystem;

  private constructor(
    public emitter: Vector3,
    public scene: Scene
  ) {
    this.setProperties();
  }

  private setProperties() {
    if (GPUParticleSystem.IsSupported) {
      this.smokeSystem = new GPUParticleSystem(
        'smoke',
        { capacity: 4000, randomTextureSize: 4096 },
        this.scene
      );
    } else {
      this.smokeSystem = new ParticleSystem('smoke', 1000, this.scene);
    }

    this.smokeSystem.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/textures/smoke.png'],
      this.scene
    );
    this.smokeSystem.emitter = this.emitter;
    this.smokeSystem.minEmitBox = new Vector3(-1, 1, -1);
    this.smokeSystem.maxEmitBox = new Vector3(1, 1, 1);
    this.smokeSystem.color1 = new Color4(0.02, 0.02, 0.02, 0.02);
    this.smokeSystem.color2 = new Color4(0.02, 0.02, 0.02, 0.02);
    this.smokeSystem.colorDead = new Color4(0, 0, 0, 0.0);
    this.smokeSystem.minSize = 1;
    this.smokeSystem.maxSize = 3;
    this.smokeSystem.minLifeTime = 0.3;
    this.smokeSystem.maxLifeTime = 1.5;
    this.smokeSystem.emitRate = 350;
    this.smokeSystem.blendMode = GPUParticleSystem.BLENDMODE_ONEONE;
    this.smokeSystem.gravity = new Vector3(0, 0, 0);
    this.smokeSystem.direction1 = new Vector3(-1.5, 8, -1.5);
    this.smokeSystem.direction2 = new Vector3(1.5, 8, 1.5);
    this.smokeSystem.minAngularSpeed = 0;
    this.smokeSystem.maxAngularSpeed = Math.PI;
    this.smokeSystem.minEmitPower = 0.5;
    this.smokeSystem.maxEmitPower = 1.5;
    this.smokeSystem.updateSpeed = 0.005;
    this.smokeSystem.preWarmCycles = GPUParticleSystem.IsSupported ? 400 : 100;

    if (GPUParticleSystem.IsSupported) {
      this.fireSystem = new GPUParticleSystem(
        'fire',
        { capacity: 8000, randomTextureSize: 4096 },
        this.scene
      );
    } else {
      this.fireSystem = new ParticleSystem('fire', 2000, this.scene);
    }

    this.fireSystem.particleTexture = new Texture(
      AssetLoader.assets['/assets/game/textures/flare.png'],
      this.scene
    );
    this.fireSystem.emitter = this.emitter;
    this.fireSystem.minEmitBox = new Vector3(-1, 1, -1);
    this.fireSystem.maxEmitBox = new Vector3(1, 1, 1);
    this.fireSystem.color1 = new Color4(1, 0.5, 0, 1.0);
    this.fireSystem.color2 = new Color4(1, 0.5, 0, 1.0);
    this.fireSystem.colorDead = new Color4(0, 0, 0, 0.0);
    this.fireSystem.minSize = 0.3;
    this.fireSystem.maxSize = 1;
    this.fireSystem.minLifeTime = 0.2;
    this.fireSystem.maxLifeTime = 0.4;
    this.fireSystem.emitRate = 600;
    this.fireSystem.blendMode = GPUParticleSystem.BLENDMODE_ONEONE;
    this.fireSystem.gravity = new Vector3(0, 0, 0);
    this.fireSystem.direction1 = new Vector3(0, 4, 0);
    this.fireSystem.direction2 = new Vector3(0, 4, 0);
    this.fireSystem.minAngularSpeed = 0;
    this.fireSystem.maxAngularSpeed = Math.PI;
    this.fireSystem.minEmitPower = 1;
    this.fireSystem.maxEmitPower = 3;
    this.fireSystem.updateSpeed = 0.007;
    this.fireSystem.preWarmCycles = GPUParticleSystem.IsSupported ? 400 : 100;
  }

  static create(emitter: Vector3, scene: Scene) {
    return new PSFire(emitter, scene);
  }

  public start() {
    this.fireSystem.start();
    this.smokeSystem.start();
  }
}
