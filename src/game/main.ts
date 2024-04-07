import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import { GlowLayer } from '@babylonjs/core/Layers';
import { PhysicsViewer } from '@babylonjs/core/Debug';
import {
  Engine,
  HardwareScalingOptimization,
  Observer,
  ParticlesOptimization,
  RenderTargetsOptimization,
  Scene,
  SceneOptimizer,
  SceneOptimizerOptions,
  ShadowsOptimization,
  TextureOptimization
} from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading';
import { Axis, Color3, Space, Vector3 } from '@babylonjs/core/Maths';
import { AbstractMesh, MeshBuilder, TransformNode } from '@babylonjs/core/Meshes';
import { PBRMaterial, StandardMaterial, Texture } from '@babylonjs/core/Materials';
import { HavokPlugin, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core/Physics';
import { DirectionalLight, ShadowGenerator } from '@babylonjs/core/Lights';
import { FreeCamera, ArcRotateCamera, FollowCamera } from '@babylonjs/core/Cameras';
import HavokPhysics from '@babylonjs/havok';
import { AdvancedDynamicTexture, TextBlock, Control, Rectangle, Image } from '@babylonjs/gui';

import { GameClient } from '@/game/client';
import type { Player } from './state';
import { clamp, getSpawnPoint, gravityVector, noop, nzpyVector, throttle } from '@/utils';
import { InputManager } from './input';
import { Tank, Ground, PlayerTank, EnemyAITank, EnemyTank } from './models';
import { AssetLoader } from './loader';
import { Skybox } from './skybox';
import {
  MessageType,
  type PlayerStats,
  type IMessageEnd,
  type IMessageInput,
  type GraphicsConfig
} from '@/types';

export class World {
  static instance: World;
  private static timeStep = 1 / 60;
  private static subTimeStep = 12;
  private static lockstepMaxSteps = 4;
  static deltaTime = World.timeStep;
  static physicsViewer: PhysicsViewer;

  private id: string | undefined;
  scene: Scene;
  private throttledResizeListener = noop;
  private stateUnsubFns: (() => boolean)[] = [];
  glowLayer!: GlowLayer;
  private directionalLight!: DirectionalLight;
  shadowGenerator!: ShadowGenerator;
  private tppCamera!: FreeCamera;
  private fppCamera!: FreeCamera;
  private endCamera!: ArcRotateCamera;
  private specCamera!: FollowCamera;
  private playerMeshes: AbstractMesh[] = [];
  players: Record<string, Tank> = {};
  player!: PlayerTank;
  gui!: AdvancedDynamicTexture;
  guiRefs!: {
    health: Rectangle;
    healthBorder: Rectangle;
    shell: Image;
    fps: TextBlock;
    stats: TextBlock;
  };
  debugStats = false;
  private observers: Observer<Scene>[] = [];
  private fpsLabel!: TextBlock;
  ground!: Ground;
  playerStats: PlayerStats = { shellsUsed: 0, totalDamage: 0 };
  private _isDestroyed = false;
  get isDestroyed(): boolean {
    return this._isDestroyed;
  }
  startTimestamp: number = Date.now();
  private hardwareScale: number = 1;
  optimizer!: SceneOptimizer;
  optimizeCount: number = 0;
  fps: number = 0;
  lastFpsTS: number = 0;

  private constructor(
    public engine: Engine,
    public client: GameClient,
    public physicsPlugin: HavokPlugin,
    public vsAI: boolean,
    public config: GraphicsConfig
  ) {
    this.id = client.getSessionId();
    this.scene = new Scene(this.engine);
    this.scene.enablePhysics(gravityVector, physicsPlugin);
    World.physicsViewer = new PhysicsViewer(this.scene);
    physicsPlugin.setTimeStep(0);
    this.scene.getPhysicsEngine()?.setSubTimeStep(World.subTimeStep);
  }
  static async create(
    client: GameClient,
    canvas: HTMLCanvasElement,
    vsAI = false,
    config: GraphicsConfig
  ): Promise<World> {
    if (client?.getSessionId() || vsAI) {
      // Pre-fetch all assets
      await AssetLoader.load();

      // Init engine
      const engine = new Engine(canvas, true, {
        deterministicLockstep: true,
        lockstepMaxSteps: World.lockstepMaxSteps
      });
      const physicsPlugin = new HavokPlugin(false, await HavokPhysics());
      const world = new World(engine, client, physicsPlugin, vsAI, config);
      await world.importPlayerMesh(world);
      await world.initScene();
      world.initWindowListeners();
      world.start();

      World.instance = world;
      return world;
    } else {
      return World.instance;
    }
  }
  private async importPlayerMesh(world: World) {
    const { meshes } = await SceneLoader.ImportMeshAsync(
      null,
      '/assets/game/models/',
      'Panzer_I.glb',
      world.scene
    );

    // Reset __root__ mesh's transform
    meshes[0].position = Vector3.Zero();
    meshes[0].rotation = Vector3.Zero();
    meshes[0].scaling = Vector3.One();
    const container = meshes.shift();
    setTimeout(() => container?.dispose());

    meshes.forEach((mesh) => {
      mesh.parent = mesh !== meshes[0] ? meshes[0] : null;

      // Disable shininess
      (mesh.material as PBRMaterial).metallicF0Factor = 0;
      mesh.isVisible = false;
    });
    meshes[0].name = 'Panzer:Ref';
    world.playerMeshes = meshes;
  }
  private async initScene() {
    // The classic :)
    this.setLights();
    this.setCameras();
    this.scene.actionManager = InputManager.create(this.scene);

    this.scene.fogMode = Scene.FOGMODE_LINEAR;
    this.scene.fogDensity = 0.0035;
    this.scene.fogColor = Color3.FromInts(178, 153, 110);
    this.scene.fogStart = 20;
    this.scene.fogEnd = 700;

    await Skybox.create(this.scene);
    this.ground = await Ground.create(this);
    this.setGUI();
    await this.createTanks();
    this.setBarriers();

    this.observers.push(this.scene.onBeforeStepObservable.add(() => this.beforeStep()));
    this.observers.push(this.scene.onAfterStepObservable.add(() => this.update()));
    this.observers.push(this.scene.onBeforeRenderObservable.add(() => this.beforeRender()));
    !this.vsAI && this.client.state.onChange(() => this.update());

    this.setOptimizer();
  }
  private initWindowListeners() {
    window.addEventListener('keydown', this.toggleInspect.bind(this));
    this.throttledResizeListener = throttle(this.resize.bind(this), 200);
    window.addEventListener('resize', this.throttledResizeListener.bind(this));
  }
  private start() {
    // this.engine.getCaps().parallelShaderCompile = undefined;

    this.engine.runRenderLoop(this.render.bind(this));
    this.physicsPlugin.setTimeStep(World.timeStep);
    this.specCamera.lockedTarget = this.player.mesh;
    this.specCamera.radius = 14;
    this.optimizer.start();
  }
  private render() {
    this.scene.render();
    this.fps = this.engine.getFps();
    this.fpsLabel.text = this.fps.toFixed() + ' FPS';
  }
  private setLights() {
    this.glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer.intensity = 1;
    this.glowLayer.blurKernelSize = 15;

    this.directionalLight = new DirectionalLight('DirectionalLight', new Vector3(0, 1, 0), this.scene);
    this.directionalLight.intensity = 1.3;
    this.directionalLight.position = new Vector3(0, 0, 0);
    this.directionalLight.direction = new Vector3(-1, -1.2, -1);
    this.directionalLight.shadowMinZ = -1000;
    this.directionalLight.shadowMaxZ = 1000;

    this.shadowGenerator = new ShadowGenerator(512, this.directionalLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    this.shadowGenerator.filteringQuality = this.config.shadows.quality;
    this.shadowGenerator.bias = 0;
    this.shadowGenerator.normalBias = 0;
    this.shadowGenerator.darkness = 0.3;
  }
  private setCameras() {
    // Set TPP Camera
    this.tppCamera = new FreeCamera('tpp-cam', new Vector3(0, 0, 0), this.scene, true);
    this.tppCamera.maxZ = 100000;

    // Set FPP Camera
    this.fppCamera = new FreeCamera('fpp-cam', new Vector3(0.3, -0.309, 1), this.scene);
    this.fppCamera.minZ = 0.5;
    this.fppCamera.maxZ = 100000;

    // Set End Camera
    this.endCamera = new ArcRotateCamera('end-cam', 0, 0, 15, new Vector3(0, 0, 0), this.scene);

    // Set Spec Camera
    this.specCamera = new FollowCamera('spec-cam', new Vector3(0, 10, -10), this.scene);
  }
  private setGUI() {
    const scale = this.engine.getHardwareScalingLevel();
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI('UI');

    const statsControl = new TextBlock('stats');
    statsControl.text = '';
    statsControl.color = 'white';
    statsControl.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    statsControl.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    statsControl.resizeToFit = true;
    statsControl.fontSize = 14 * scale;
    statsControl.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.gui.addControl(statsControl);

    const fpsLabel = new TextBlock('fps');
    fpsLabel.text = '';
    fpsLabel.color = 'white';
    fpsLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    fpsLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    fpsLabel.resizeToFit = true;
    fpsLabel.fontSize = 14 * scale;
    this.gui.addControl(fpsLabel);
    this.fpsLabel = fpsLabel;

    const renderWidth = this.engine.getRenderWidth(true);
    const healthBarBorder = new Rectangle('health-border');
    healthBarBorder.width = `${renderWidth * 0.3 * scale}px`;
    healthBarBorder.height = `${20 * scale}px`;
    healthBarBorder.top = `${-20 * scale}px`;
    healthBarBorder.thickness = 1 * scale;
    healthBarBorder.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    healthBarBorder.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    healthBarBorder.color = '#d3d3d3cc';
    const healthBar = new Rectangle('health');
    healthBar.height = `${20 * scale}px`;
    healthBar.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    healthBar.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    healthBar.background = '#d3d3d3cc';
    healthBar.color = 'transparent';
    healthBarBorder.addControl(healthBar);
    this.gui.addControl(healthBarBorder);

    const shell = new Image('shell', AssetLoader.assets['/assets/game/gui/shell.png'] as string);
    shell.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    shell.verticalAlignment = Control.VERTICAL_ALIGNMENT_BOTTOM;
    shell.height = `${24 * scale}px`;
    shell.top = `${-20 * scale}px`;
    shell.fixedRatio = 1;
    this.gui.addControl(shell);

    this.guiRefs = {
      health: healthBar,
      healthBorder: healthBarBorder,
      shell,
      fps: fpsLabel,
      stats: statsControl
    };
  }
  private adjustGUI(scale: number, width: number, height: number) {
    this.guiRefs.stats.fontSize = 14 * scale;
    this.guiRefs.fps.fontSize = 14 * scale;
    this.guiRefs.healthBorder.width = `${width * 0.3 * scale}px`;
    this.guiRefs.healthBorder.height = `${20 * scale}px`;
    this.guiRefs.healthBorder.top = `${-20 * scale}px`;
    this.guiRefs.healthBorder.thickness = 1 * scale;
    this.guiRefs.health.height = `${20 * scale}px`;
    this.guiRefs.shell.height = `${24 * scale}px`;
    this.guiRefs.shell.top = `${-20 * scale}px`;

    this.player?.adjustGUI(scale, width, height);

    this.gui.renderScale = scale;
  }
  private setBarriers() {
    const barrier = new TransformNode('barrier', this.scene);
    const barrierMaterial = new StandardMaterial('barrier', this.scene);
    barrierMaterial.diffuseTexture = new Texture('/assets/game/textures/metal.png', this.scene);
    barrierMaterial.diffuseTexture.level = 1.4;
    (barrierMaterial.diffuseTexture as Texture).uScale = 5;
    (barrierMaterial.diffuseTexture as Texture).vScale = 0.5;

    const barrier1 = MeshBuilder.CreateBox('barrier1', { width: 500, height: 20, depth: 1 }, this.scene);
    barrier1.position = new Vector3(0, 9, -249);
    // barrier1.receiveShadows = true;
    barrier1.material = barrierMaterial;
    const barrier2 = MeshBuilder.CreateBox('barrier2', { width: 500, height: 20, depth: 1 }, this.scene);
    barrier2.position = new Vector3(0, 9, 249);
    // barrier2.receiveShadows = true;
    barrier2.material = barrierMaterial;
    const barrier3 = MeshBuilder.CreateBox('barrier3', { width: 500, height: 20, depth: 1 }, this.scene);
    barrier3.rotate(Axis.Y, Math.PI / 2, Space.LOCAL);
    barrier3.position = new Vector3(-249, 9, 0);
    // barrier3.receiveShadows = true;
    barrier3.material = barrierMaterial;
    const barrier4 = MeshBuilder.CreateBox('barrier4', { width: 500, height: 20, depth: 1 }, this.scene);
    barrier4.position = new Vector3(249, 9, 0);
    barrier4.rotate(Axis.Y, -Math.PI / 2, Space.LOCAL);
    // barrier4.receiveShadows = true;
    barrier4.material = barrierMaterial;

    barrier1.parent = barrier;
    barrier2.parent = barrier;
    barrier3.parent = barrier;
    barrier4.parent = barrier;

    new PhysicsAggregate(barrier1, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    new PhysicsAggregate(barrier2, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    new PhysicsAggregate(barrier3, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    new PhysicsAggregate(barrier4, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
  }
  private setOptimizer() {
    const options = new SceneOptimizerOptions(this.config.optimizations.targetFps);

    options.addOptimization(new TextureOptimization(0, this.config.optimizations.maxTextureSize));
    options.addOptimization(new ShadowsOptimization(1));
    options.addCustomOptimization(
      () => {
        if (this.config.id === 'low') {
          this.scene.shadowsEnabled = false;
          return true;
        }
        return false;
      },
      () => 'CustomShadowOptimization',
      1
    );
    options.addOptimization(new HardwareScalingOptimization(1, this.config.optimizations.maxHardwareScale));
    options.addOptimization(new RenderTargetsOptimization(1));
    options.addOptimization(new ParticlesOptimization(2));

    this.optimizer = SceneOptimizer.OptimizeAsync(this.scene, options, () => (this.optimizeCount += 1));
  }
  fadeDir = -1;
  private beforeRender() {
    const now = performance.now();
    // Scene optimization is not working as expected on low-end devices
    if (
      this.config.id === 'low' &&
      now - this.lastFpsTS > 2000 &&
      this.optimizer.currentFrameRate < this.optimizer.targetFrameRate
    ) {
      this.optimizer.reset();
      this.optimizer.start();
      this.lastFpsTS = now;
    }

    const renderWidth = this.engine.getRenderWidth(true);
    const renderHeight = this.engine.getRenderHeight(true);
    if (this.engine.getHardwareScalingLevel() !== this.hardwareScale) {
      this.hardwareScale = this.engine.getHardwareScalingLevel();
      this.adjustGUI(this.hardwareScale, renderWidth, renderHeight);
    }

    let health = this.vsAI ? this.player.health : this.player.state!.health;
    const orgHealth = health;

    if (this.client.isMatchEnded && !this.client.didWin) health = 0;
    this.guiRefs.health.width = `${renderWidth * 0.3 * (health / 100)}px`;

    this.guiRefs.healthBorder.width = `${renderWidth * 0.3}px`;
    if (orgHealth <= 75) {
      this.guiRefs.health.background = '#e97451cc';
    } else if (orgHealth <= 25) {
      this.guiRefs.health.background = '#ee4b2bcc';
    }

    this.guiRefs.shell.left = `${(renderWidth * 0.3) / 2 + 15}px`;
    if (this.player.canFire) {
      this.guiRefs.shell.alpha = 1;
    } else {
      this.guiRefs.shell.alpha = clamp(this.guiRefs.shell.alpha + World.deltaTime * 3 * this.fadeDir, 0, 1);
      if (this.guiRefs.shell.alpha <= 0 || this.guiRefs.shell.alpha >= 1) {
        this.fadeDir *= -1;
      }
    }

    this.tppCamera.position = Vector3.Lerp(
      this.tppCamera.position,
      this.player.turret
        .getDirection(nzpyVector)
        .normalize()
        .scaleInPlace(15)
        .addInPlace(this.player.body.position),
      World.deltaTime
    );
    this.tppCamera.target = Vector3.Lerp(
      this.tppCamera.target,
      this.player.body.position,
      World.deltaTime * 2
    );
  }
  private beforeStep() {
    if (
      this.vsAI &&
      Date.now() - this.startTimestamp >= this.client.matchDuration &&
      !this.client.isMatchEnded
    ) {
      this.matchEnd({ winner: null, loser: null, isDraw: true, stats: { Player: this.playerStats } });
    }
    if (this.client.isMatchEnded) {
      this.animateEndCam();
      return;
    }
    if (this.client.isReady()) {
      // 1. Send input to server
      const step = this.scene.getStepId();
      const message = {
        step,
        input: structuredClone(InputManager.input)
      };
      this.sendInput(message);

      // 2. Immediately process it
      this.player.applyInputs(message.input);

      InputManager.addHistory(message, this.player, step);
    }

    if (this.vsAI) {
      this.player.applyInputs(InputManager.input);
    }
  }
  private update() {
    if (this.client.isReady()) {
      // 3. Reconcile/Interpolate
      Object.values(this.players).forEach((player) => player.sync());
    }
  }
  private async sendInput(message: IMessageInput) {
    this.client.sendEvent<IMessageInput>(MessageType.INPUT, message);
  }
  private async createTanks() {
    if (this.vsAI) {
      const spawn = getSpawnPoint();
      const tanks = await Promise.all([
        PlayerTank.create(this, null, this.playerMeshes[0], spawn, {
          tpp: this.tppCamera,
          fpp: this.fppCamera
        }),
        EnemyAITank.create(this, this.playerMeshes[0], new Vector3(-1 * spawn.x, 14, -1 * spawn.z))
      ]);

      this.players = {
        Player: tanks[0],
        Enemy: tanks[1]
      };
      this.player = tanks[0];
      tanks.forEach((tank) => this.shadowGenerator?.addShadowCaster(tank.mesh));
    } else {
      const players: Player[] = [];
      this.client.getPlayers().forEach((player) => players.push(player));

      const tanks = await Promise.all(
        players.map((player) => {
          const isPlayer = this.id === player.sid;

          if (!isPlayer) {
            return EnemyTank.create(
              this,
              player,
              this.playerMeshes[0],
              new Vector3(player.position.x, player.position.y, player.position.z)
            );
          } else {
            return PlayerTank.create(
              this,
              player,
              this.playerMeshes[0],
              new Vector3(player.position.x, player.position.y, player.position.z),
              { tpp: this.tppCamera, fpp: this.fppCamera }
            );
          }
        })
      );
      tanks.forEach((tank) => {
        this.players[tank.state!.sid] = tank;
        this.shadowGenerator?.addShadowCaster(this.players[tank.state!.sid].mesh);
        if (this.id === tank.state!.sid) {
          this.player = tank as PlayerTank;
        }
      });
    }
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
  private resize(force = false) {
    this.engine.resize(force);

    const width = this.engine.getRenderWidth(true);
    const height = this.engine.getRenderHeight(true);

    this.adjustGUI(this.hardwareScale, width, height);
  }
  private animateEndCam() {
    this.endCamera.target = this.player.body.absolutePosition;
    this.endCamera.radius = 50;
    let alpha = this.endCamera.alpha + World.deltaTime * 0.1;
    if (alpha >= 6.28) alpha = 0;
    this.endCamera.alpha = alpha;
    this.endCamera.beta = 0.75;
  }

  matchEnd(message: IMessageEnd) {
    this.client.isMatchEnded = true;
    this.client.isDraw = message.isDraw;
    this.scene.activeCamera = this.endCamera;
    this.player.sights.forEach((ui) => (ui.isVisible = false));
    Object.values(this.guiRefs).forEach((control) => (control.isVisible = false));

    if (!message.isDraw) {
      const id = this.vsAI ? 'Player' : this.player.state!.sid;
      this.client.didWin = message.winner === id;
      this.client.stats = message.stats[id];
      this.players[message.loser!].explode();
    }
  }
  destroy() {
    if (this._isDestroyed) return;

    this.observers.forEach((observer) => observer.remove());
    this.stateUnsubFns.forEach((unsubFn) => unsubFn());
    window.removeEventListener('keydown', this.toggleInspect);
    window.removeEventListener('resize', this.throttledResizeListener);

    Object.values(this.players).forEach((player) => player.dispose());
    this.ground?.dispose();
    this.scene.dispose();
    this.engine.dispose();
    this._isDestroyed = true;
  }
  removePlayer(id: string) {
    this.players[id].dispose();
  }
}
