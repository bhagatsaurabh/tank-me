import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import {
  Engine,
  Scene,
  Vector3,
  Mesh,
  HavokPlugin,
  GlowLayer,
  DirectionalLight,
  CascadedShadowGenerator,
  FollowCamera,
  FreeCamera,
  SceneLoader,
  AbstractMesh,
  ArcRotateCamera,
  PhysicsViewer,
  PBRMaterial
} from '@babylonjs/core';
import HavokPhysics, { type HavokPhysicsWithBindings } from '@babylonjs/havok';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import type { Room } from 'colyseus.js';

import { GameClient } from '@/game/client';
import type { Player, RoomState } from './state';
import type { Null } from '@/interfaces/types';
import { gravityVector, noop, throttle } from '@/utils/utils';
import { InputManager } from './input';
import { Tank } from './models/tank';
import { Ground } from './models/ground';
import { AssetLoader } from './loader';
import { Skybox } from './skybox';

/**
 * Assumptions before creating a game instance:
 * 1. GameClient is connected to LobbyRoom
 * 2. GameClient is connected to GameRoom
 * 3. GameRoom is full with maxNoOfClients
 */
export class TankMe {
  private static instance: TankMe;
  static physicsPlugin: HavokPlugin;
  private scene: Scene;
  private playerEntities: Record<string, Mesh> = {};
  private playerNextPosition: Record<string, Vector3> = {};
  private throttledResizeListener = noop;
  private stateUnsubFns: (() => boolean)[] = [];
  private glowLayer!: GlowLayer;
  private directionalLight!: DirectionalLight;
  private shadowGenerator!: CascadedShadowGenerator;
  private tppCamera!: FollowCamera;
  private fppCamera!: FreeCamera;
  private endCamera!: ArcRotateCamera;
  private playerMeshes: AbstractMesh[] = [];
  private players: Record<string, Tank> = {};
  private player!: Tank;
  static physicsViewer: PhysicsViewer;
  private static timeStep = 1 / 60;
  private static subTimeStep = 16;

  private constructor(
    public engine: Engine,
    public client: GameClient,
    public room: Room<RoomState>,
    public physicsEngine: HavokPhysicsWithBindings,
    public selfUID: string
  ) {
    this.scene = new Scene(this.engine);
    TankMe.physicsPlugin = new HavokPlugin(false, physicsEngine);
    this.scene.enablePhysics(gravityVector, TankMe.physicsPlugin);
    TankMe.physicsViewer = new PhysicsViewer(this.scene);
    // Don't simulate anything until the scene is fully laoded
    TankMe.physicsPlugin.setTimeStep(0);
    this.scene.getPhysicsEngine()?.setSubTimeStep(TankMe.subTimeStep);
  }
  static get(): TankMe | undefined {
    return TankMe.instance;
  }
  static async init(canvas: HTMLCanvasElement, selfUID: string): Promise<Null<TankMe>> {
    const client = GameClient.get();
    if (!TankMe.instance && client && client.rooms['desert']) {
      // Pre-load assets
      await AssetLoader.load([
        { path: '/assets/game/models/Panzer I/Panzer_I.glb' },
        { path: '/assets/game/map/height.png' },
        { path: '/assets/game/map/diffuse.png' },
        { path: '/assets/game/textures/explosion.jpg' },
        { path: '/assets/game/textures/smoke.png' },
        { path: '/assets/game/textures/flare.png' },
        { path: '/assets/game/textures/fire.jpg' },
        { path: '/assets/game/audio/explosion.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/cannon.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/idle.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/run.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/load.mp3', format: 'arraybuffer' }
      ]);

      const engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4 });
      // Init Engine or WebGPUEngine based on support
      /* let engine: Engine;
      if (await WebGPUEngine.IsSupportedAsync) {
        engine = new WebGPUEngine(canvas, {
          deterministicLockstep: true,
          lockstepMaxSteps: 4,
          antialias: true
        });
        await (engine as WebGPUEngine).initAsync();
        (engine as WebGPUEngine).onContextLostObservable.add(() => {
          console.log('Context Lost');
          TankMe.instance.stop();
        });
        (engine as WebGPUEngine).onContextRestoredObservable.add(() => {
          TankMe.instance.start();
          console.log('Context Restored');
        });
        console.info('Running on WebGPU');
      } else {
        engine = new Engine(canvas, true, { deterministicLockstep: true, lockstepMaxSteps: 4 });
      } */
      // Init physics engine
      const physicsEngine = await HavokPhysics();
      // Init game instance
      TankMe.instance = new TankMe(engine, client, client.rooms['desert'], physicsEngine, selfUID);

      await TankMe.importPlayerMesh(TankMe.instance.scene);
      await TankMe.instance.initScene();
      TankMe.instance.initStateListeners();
      TankMe.instance.initWindowListeners();
      TankMe.instance.start();

      return TankMe.instance;
    }
    return null;
  }
  private static async importPlayerMesh(scene: Scene) {
    const { meshes } = await SceneLoader.ImportMeshAsync(
      null,
      '/assets/game/models/Panzer I/',
      'Panzer_I.glb',
      scene
    );

    // Reset __root__ mesh's transform
    meshes[0].position = Vector3.Zero();
    meshes[0].rotation = Vector3.Zero();
    meshes[0].scaling = Vector3.One();
    const container = meshes.shift();
    setTimeout(() => container?.dispose());

    meshes.forEach((mesh) => {
      if (mesh !== meshes[0]) {
        mesh.parent = meshes[0];
      } else {
        mesh.parent = null;
      }

      // Disable shininess
      (mesh.material as PBRMaterial).metallicF0Factor = 0;
      mesh.isVisible = false;
    });
    meshes[0].name = 'Panzer_I:Ref';
    TankMe.instance.playerMeshes = meshes;
  }

  private async initScene() {
    // Init input manager
    this.scene.actionManager = InputManager.init(this.scene);

    // Set GlowLayer
    this.glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer.intensity = 2;

    // Set Lights
    this.directionalLight = new DirectionalLight('DirectionalLight', new Vector3(-1, -1, 0), this.scene);
    this.directionalLight.intensity = 1.3;
    this.directionalLight.position = new Vector3(0, 0, 0);
    this.directionalLight.direction = new Vector3(-1, -1.2, -1);
    this.shadowGenerator = new CascadedShadowGenerator(1024, this.directionalLight);
    this.shadowGenerator.useContactHardeningShadow = true;
    this.shadowGenerator.lambda = 1;
    this.shadowGenerator.cascadeBlendPercentage = 0;
    this.shadowGenerator.bias = 0.001;
    this.shadowGenerator.normalBias = 0.09;
    this.shadowGenerator.darkness = 0.34;
    this.shadowGenerator.autoCalcDepthBounds = true;
    this.shadowGenerator.autoCalcDepthBoundsRefreshRate = 2;

    this.setCameras();
    this.shadowGenerator.autoCalcDepthBounds = true;

    // Create SkyBox
    await Skybox.create(this.scene);

    // Create Ground
    await Ground.create(this.scene);
    this.shadowGenerator?.addShadowCaster(Ground.groundMesh);
    await this.createTanks();

    /* this.client.rooms['desert']?.send('updatePosition', {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z
    }); */

    // Before frame render
    this.scene.onBeforeStepObservable.add(this.step.bind(this));
    // this.scene.physicsEnabled
  }
  private setCameras() {
    // Set TPP Camera
    this.tppCamera = new FollowCamera('tpp-cam', new Vector3(0, 10, -10), this.scene);
    this.tppCamera.radius = 13;
    this.tppCamera.heightOffset = 4;
    this.tppCamera.rotationOffset = 180;
    this.tppCamera.cameraAcceleration = 0.05;
    this.tppCamera.maxCameraSpeed = 10;
    this.scene.activeCamera = this.tppCamera;

    // Set FPP Camera
    this.fppCamera = new FreeCamera('fpp-cam', new Vector3(0, 2.1, 5.2), this.scene);

    // Set ArcRotateCamera
    this.endCamera = new ArcRotateCamera('end-cam', 0, 0, 10, new Vector3(0, 0, 0), this.scene);
  }
  private step() {
    const deltaTime = this.engine.getTimeStep() / 1000;
    const shiftModifier = InputManager.map['Shift'];
    let isMoving = false;
    const turningDirection = InputManager.map['KeyA'] ? -1 : InputManager.map['KeyD'] ? 1 : 0;
    const isAccelerating = InputManager.map['KeyW'] || InputManager.map['KeyS'];
    const isTurretMoving = InputManager.map['ArrowLeft'] || InputManager.map['ArrowRight'];
    const isBarrelMoving = InputManager.map['ArrowUp'] || InputManager.map['ArrowDown'];

    if (InputManager.map['KeyW']) {
      this.player.accelerate(deltaTime, turningDirection);
      isMoving = true;
    }
    if (InputManager.map['KeyS']) {
      this.player.reverse(deltaTime, turningDirection);
      isMoving = true;
    }
    if (InputManager.map['KeyA']) {
      this.player.left(deltaTime, isAccelerating);
      isMoving = true;
    }
    if (InputManager.map['KeyD']) {
      this.player.right(deltaTime, isAccelerating);
      isMoving = true;
    }
    if (InputManager.map['Space']) {
      this.player.brake(deltaTime);
    }
    if (!isMoving) {
      this.player.decelerate(deltaTime);
    }
    if (!isTurretMoving) {
      this.player.stopTurret();
    }
    if (!isBarrelMoving) {
      this.player.stopBarrel();
    }
    this.player?.playSounds(isMoving);

    if (InputManager.map['ArrowLeft']) {
      this.player.turretLeft(deltaTime);
    }
    if (InputManager.map['ArrowRight']) {
      this.player.turretRight(deltaTime);
    }
    if (InputManager.map['ArrowUp']) {
      this.player.barrelUp(deltaTime);
    }
    if (InputManager.map['ArrowDown']) {
      this.player.barrelDown(deltaTime);
    }

    if (InputManager.map['KeyR'] && !isTurretMoving && !isBarrelMoving) {
      this.player.resetTurret(deltaTime);
    }

    if (InputManager.map['ControlLeft'] || InputManager.map['ControlRight']) {
      this.player.fire();
    }

    if (InputManager.map['KeyV']) {
      this.player.toggleCamera();
    }

    this.player?.checkStuck();

    // Post-game cam
    /* if (rotateCamera) {
        arcRotateCam.alpha += 0.007;
      } */
  }
  private async createTanks() {
    const players: Player[] = [];
    this.room.state.players.forEach((player) => players.push(player));

    return await Promise.all(
      players.map(async (player) => {
        const isEnemy = this.selfUID !== player.uid;
        this.players[player.uid] = await Tank.create(
          player.uid,
          this.playerMeshes,
          /* new Vector3(...Object.values(player.position ?? { x: rand(-240, 240), y: 14, z: rand(-240, 240) })), */
          new Vector3(0, 14, 0),
          this.scene,
          !isEnemy ? { tpp: this.tppCamera, fpp: this.fppCamera } : null,
          isEnemy
        );
        this.shadowGenerator.addShadowCaster(this.players[player.uid].rootMesh);
        if (!isEnemy) this.player = this.players[player.uid];
      })
    );
  }
  private initStateListeners() {
    const unsubscribeOnAdd = this.room.state.players.onAdd((player, sessionId) => {
      /* player.onChange(() => {
        this.playerNextPosition[sessionId].set(player.x, player.y, player.z);
      });
      const isCurrentPlayer = sessionId === this.room.sessionId;
      const sphere = CreateSphere(`player-${sessionId}`, {
        segments: 8,
        diameter: 40
      });
      sphere.position.set(player.x, player.y, player.z);
      sphere.material = new StandardMaterial(`player-material-${sessionId}`);
      (sphere.material as StandardMaterial).emissiveColor = isCurrentPlayer
        ? Color3.FromHexString('#ff9900')
        : Color3.Gray();
      this.playerEntities[sessionId] = sphere;
      this.playerNextPosition[sessionId] = sphere.position.clone(); */
    });
    const unsubscribeOnRemove = this.room.state.players.onRemove((player, sessionId) => {
      /* this.playerEntities[sessionId].dispose();
      delete this.playerEntities[sessionId]; */
    });

    this.stateUnsubFns.push(unsubscribeOnAdd, unsubscribeOnRemove);
  }
  private toggleInspect(ev: KeyboardEvent) {
    // Sfhit+Alt+I
    if (ev.shiftKey && ev.altKey && ev.code === 'KeyI') {
      ev.preventDefault();
      ev.stopPropagation();
      if (this.scene.debugLayer.isVisible()) this.scene.debugLayer.hide();
      else this.scene.debugLayer.show();
    }
  }
  private resize() {
    this.engine.resize();
  }
  private initWindowListeners() {
    window.addEventListener('keydown', this.toggleInspect.bind(this));
    this.throttledResizeListener = throttle(this.resize.bind(this), 200);
    window.addEventListener('resize', this.throttledResizeListener.bind(this));
  }
  private start() {
    this.engine.runRenderLoop(this.render.bind(this));
    TankMe.physicsPlugin.setTimeStep(TankMe.timeStep);
  }
  private stop() {
    TankMe.physicsPlugin.setTimeStep(0);
    this.engine.stopRenderLoop();
  }
  private render() {
    this.scene.render();
    // fpsLabel.innerHTML = this.engine.getFps().toFixed() + ' FPS';
  }

  public dispose() {
    this.stateUnsubFns.forEach((unsubFn) => unsubFn());
    window.removeEventListener('keydown', this.toggleInspect);
    window.removeEventListener('resize', this.throttledResizeListener);
    this.engine.dispose();
  }
}
