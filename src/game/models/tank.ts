import {
  CreateSoundAsync,
  Observer,
  Ray,
  SoundState,
  StaticSound,
  type Nullable,
} from "@babylonjs/core";
import { Space, Axis, Vector3 } from "@babylonjs/core/Maths";
import { AbstractMesh, TransformNode } from "@babylonjs/core/Meshes";
import { PBRMaterial, Texture } from "@babylonjs/core/Materials";
import { type IBasePhysicsCollisionEvent, PhysicsEventType } from "@babylonjs/core/Physics";

import { forwardVector, randInRange } from "@/utils";
import { Shell, type PlayerTank, type EnemyAITank, type EnemyTank } from "../models";
import { PSExhaust, PSDust, PSMuzzle, PSTankExplosion } from "../particle-systems";
import type { Player } from "../state";
import { type TankSounds, type TankSoundType } from "@/types";
import { World } from "../main";

export class Tank {
  private static commonConfig = {
    recoilForce: 7.5,
  };
  protected isPlayer = false;
  mesh!: AbstractMesh;
  body!: TransformNode;
  barrel!: AbstractMesh;
  barrelTip!: TransformNode;
  turret!: AbstractMesh;
  protected leftTrack!: AbstractMesh;
  protected rightTrack!: AbstractMesh;
  protected leftExhaust!: AbstractMesh;
  protected rightExhaust!: AbstractMesh;
  protected leftWheels: AbstractMesh[] = [];
  protected rightWheels: AbstractMesh[] = [];

  // Actual shell with physics enabled just for effects, the server is still the authority
  protected loadedShell!: Shell;
  protected sounds: TankSounds = {};
  protected particleSystems: {
    muzzle?: PSMuzzle;
    "exhaust-left"?: PSExhaust;
    "exhaust-right"?: PSExhaust;
    "dust-left"?: PSDust;
    "dust-right"?: PSDust;
    explosion?: PSTankExplosion;
  } = {};
  protected observers: Observer<unknown>[] = [];
  lid!: string;

  protected constructor(
    public world: World,
    public state: Nullable<Player>,
  ) {}

  protected async init() {
    await this.setSoundSources();
    this.loadedShell = await Shell.create(this);
    // [[], this.loadedShell] = await Promise.all([this.setSoundSources(), Shell.create(this)]);

    this.setParticleSystems();
    this.particleSystems["exhaust-left"]?.start();
    this.particleSystems["exhaust-right"]?.start();

    this.sounds.idle!.pitch = Math.floor(Math.random() * 200) - 100;
    this.sounds["idle"]?.play();
  }

  protected trigger(event: IBasePhysicsCollisionEvent) {
    if (
      event.type === PhysicsEventType.TRIGGER_ENTERED &&
      event.collidedAgainst.transformNode.name.includes("Shell")
    ) {
      const ray = new Ray(
        event.collidedAgainst.transformNode.absolutePosition,
        event.collidedAgainst.transformNode.getDirection(forwardVector).normalize(),
        10,
      );
      const info = this.world.scene.pickWithRay(ray, undefined, true);
      if (
        !info?.hit ||
        !info.pickedMesh ||
        (info.pickedMesh &&
          (!this.world.vsAI
            ? !info.pickedMesh.name.includes(this.state!.sid)
            : !info.pickedMesh.name.includes("Player")))
      ) {
        const name = `whizz${Math.round(randInRange(1, 2))}` as TankSoundType;
        this.sounds[name]!.pitch = Math.floor(Math.random() * 300) - 150;
        this.sounds[name]!.playbackRate = Math.floor(Math.random() * 2.2) - 1.1;
        this.sounds[name]?.play();
      }
    }
  }
  protected simulateRecoil() {
    const recoilVector = this.turret
      .getDirection(new Vector3(0, 1, -1))
      .normalize()
      .scale(Tank.commonConfig.recoilForce);
    const contactPoint = this.body.up
      .normalize()
      .scale(1)
      .add(this.body.position)
      .add(this.turret.forward.normalize().scale(1));
    this.body.physicsBody!.applyImpulse(recoilVector, contactPoint);
  }
  private setParticleSystems() {
    this.particleSystems["exhaust-left"] = PSExhaust.create(this.leftExhaust, this.world.scene);
    this.particleSystems["exhaust-right"] = PSExhaust.create(this.rightExhaust, this.world.scene);
    this.particleSystems["dust-left"] = PSDust.create(this.leftTrack, this.world.scene);
    this.particleSystems["dust-right"] = PSDust.create(this.rightTrack, this.world.scene);
    this.particleSystems["muzzle"] = PSMuzzle.create(this.barrelTip, this.world.scene);
    this.particleSystems["explosion"] = PSTankExplosion.create(
      this.body as AbstractMesh,
      this.world.scene,
    );
  }
  private async setSoundSources() {
    const promises: Promise<StaticSound>[] = [
      CreateSoundAsync("cannon", "/assets/game/audio/cannon.mp3", {
        spatialDistanceModel: "linear",
        spatialPanningModel: "HRTF",
        spatialEnabled: true,
        spatialMaxDistance: 250,
      }),
      CreateSoundAsync("idle", "/assets/game/audio/idle.mp3", {
        loop: true,
        spatialDistanceModel: "linear",
        spatialPanningModel: "HRTF",
        spatialEnabled: true,
        spatialMaxDistance: 50,
      }),
      CreateSoundAsync("move", "/assets/game/audio/run.mp3", {
        loop: true,
        spatialDistanceModel: "linear",
        spatialPanningModel: "HRTF",
        spatialEnabled: true,
        spatialMaxDistance: 70,
      }),
      CreateSoundAsync("explode", "/assets/game/audio/explosion.mp3", {
        spatialDistanceModel: "linear",
        spatialPanningModel: "HRTF",
        spatialEnabled: true,
        spatialMaxDistance: 160,
      }),
      CreateSoundAsync("load", "/assets/game/audio/load.mp3", {
        spatialEnabled: false,
      }),
      CreateSoundAsync("turret", "/assets/game/audio/turret.mp3", {
        loop: true,
        spatialDistanceModel: "linear",
        spatialPanningModel: "HRTF",
        spatialEnabled: true,
        spatialMaxDistance: 15,
      }),
      CreateSoundAsync("whizz1", "/assets/game/audio/whizz1.mp3", {
        spatialEnabled: false,
      }),
      CreateSoundAsync("whizz2", "/assets/game/audio/whizz2.mp3", {
        spatialEnabled: false,
      }),
    ];
    const sounds = await Promise.all(promises);
    this.sounds["cannon"] = sounds[0];
    this.sounds["idle"] = sounds[1];
    this.sounds["move"] = sounds[2];
    this.sounds["explode"] = sounds[3];
    this.sounds["load"] = sounds[4];
    this.sounds["turret"] = sounds[5];
    this.sounds["whizz1"] = sounds[6];
    this.sounds["whizz2"] = sounds[7];

    Object.values(this.sounds).forEach((sound) => {
      if (sound._isSpatial) {
        console.log(sound.name);
        sound.spatial.attach(this.body, true);
      }
    });

    let res;
    try {
      res = await Promise.all(promises);
    } catch (error) {
      console.log(error);
    }
    return res;
  }
  protected animate(leftTrackSpeed?: number, rightTrackSpeed?: number) {
    const leftSpeed = leftTrackSpeed ?? this.state!.leftSpeed;
    const rightSpeed = rightTrackSpeed ?? this.state!.rightSpeed;

    if (leftSpeed !== 0) {
      ((this.leftTrack.material as PBRMaterial).albedoTexture as Texture).vOffset +=
        leftSpeed * 0.0009;
      this.leftWheels.forEach((wheel) => wheel.rotate(Axis.X, leftSpeed * 0.0095, Space.LOCAL));
    }
    if (rightSpeed !== 0) {
      ((this.rightTrack.material as PBRMaterial).albedoTexture as Texture).vOffset +=
        rightSpeed * 0.0009;
      this.rightWheels.forEach((wheel) => wheel.rotate(Axis.X, rightSpeed * 0.0095, Space.LOCAL));
    }

    // Dust trail
    if (Math.abs(leftSpeed) <= 1.5 || Math.abs(rightSpeed) <= 1.5) {
      this.particleSystems["dust-left"]?.stop();
      this.particleSystems["dust-right"]?.stop();
    } else {
      this.particleSystems["dust-left"]?.start();
      this.particleSystems["dust-right"]?.start();
    }
  }

  explode() {
    this.particleSystems["explosion"]?.start();
    this.particleSystems["exhaust-left"]?.stop();
    this.particleSystems["exhaust-right"]?.stop();
  }
  protected playSounds(isMoving: boolean, isTurretMoving: boolean) {
    if (isMoving) {
      this.sounds.move!.pitch = Math.floor(Math.random() * 200) - 100;
      if (this.sounds["move"]?.state !== SoundState.Started) this.sounds["move"]?.play();
      if (this.sounds["idle"]?.state === SoundState.Started) this.sounds["idle"]?.pause();
    } else {
      if (this.sounds["move"]?.state === SoundState.Started) this.sounds["move"]?.pause();
      this.sounds.idle!.pitch = Math.floor(Math.random() * 200) - 100;
      if (this.sounds["idle"]?.state !== SoundState.Started) this.sounds["idle"]?.play();
    }

    if (isTurretMoving) {
      this.sounds.turret!.pitch = Math.floor(Math.random() * 100) - 100;
      if (this.sounds["turret"]?.state !== SoundState.Started) this.sounds["turret"]?.play();
    } else {
      if (this.sounds["turret"]?.state === SoundState.Started) this.sounds["turret"]?.pause();
    }
  }
  playSound(type: TankSoundType) {
    if (this.sounds[type]?.state !== SoundState.Started) this.sounds[type]?.play();
  }

  sync() {
    if (this.isPlayer) {
      (this as unknown as PlayerTank).reconcile();
    } else {
      (this as unknown as EnemyTank).interpolate();
    }
  }

  dispose() {
    this.observers.forEach((observer) => observer.remove());
    this.body.dispose();
  }

  damage(amount: number) {
    if (!this.world.vsAI) return;
    (this as unknown as PlayerTank | EnemyAITank).health -= amount;

    if ((this as unknown as PlayerTank | EnemyAITank).health <= 0) {
      this.world.matchEnd({
        loser: this.lid,
        winner: this.lid === "Player" ? "Enemy" : "Player",
        stats: { Player: this.world.playerStats },
        isDraw: false,
      });
    }
  }
}
