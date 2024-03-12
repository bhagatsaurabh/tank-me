import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import { GlowLayer } from '@babylonjs/core/Layers';
import { PhysicsViewer } from '@babylonjs/core/Debug';
import { Engine, Observer, Scene } from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading';
import { Axis, Space, Vector3 } from '@babylonjs/core/Maths';
import { AbstractMesh, MeshBuilder, TransformNode } from '@babylonjs/core/Meshes';
import { PBRMaterial, StandardMaterial, Texture } from '@babylonjs/core/Materials';
import { HavokPlugin, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core/Physics';
import { DirectionalLight, CascadedShadowGenerator } from '@babylonjs/core/Lights';
import { FreeCamera, ArcRotateCamera, FollowCamera } from '@babylonjs/core/Cameras';
import HavokPhysics from '@babylonjs/havok';
import { AdvancedDynamicTexture, TextBlock, Control } from '@babylonjs/gui';

import { GameClient } from '@/game/client';
import type { Player } from './state';
import { gravityVector, noop, nzpyVector, throttle } from '@/utils/utils';
import { InputManager } from './input';
import { Tank } from './models/tank';
import { Ground } from './models/ground';
import { AssetLoader } from './loader';
import { Skybox } from './skybox';
import { MessageType } from '@/types/types';
import type { IMessageInput } from '@/types/interfaces';
import { PlayerTank } from './models/player';
import { EnemyTank } from './models/enemy';

export class World {
  static instance: World;
  private static timeStep = 1 / 60;
  private static subTimeStep = 12;
  private static lockstepMaxSteps = 4;
  static deltaTime = World.timeStep;
  static physicsViewer: PhysicsViewer;

  private id: string;
  scene: Scene;
  private throttledResizeListener = noop;
  private stateUnsubFns: (() => boolean)[] = [];
  private glowLayer!: GlowLayer;
  private directionalLight!: DirectionalLight;
  private shadowGenerator!: CascadedShadowGenerator;
  private tppCamera!: FreeCamera;
  private fppCamera!: FreeCamera;
  private endCamera!: ArcRotateCamera;
  private specCamera!: FollowCamera;
  private playerMeshes: AbstractMesh[] = [];
  players: Record<string, Tank> = {};
  player!: PlayerTank;
  gui!: AdvancedDynamicTexture;
  debugStats = false;
  private observers: Observer<Scene>[] = [];
  private fpsLabel!: TextBlock;

  private constructor(
    public engine: Engine,
    public client: GameClient,
    public physicsPlugin: HavokPlugin
  ) {
    this.id = client.getSessionId()!;
    this.scene = new Scene(this.engine);
    this.scene.enablePhysics(gravityVector, physicsPlugin);
    World.physicsViewer = new PhysicsViewer(this.scene);
    physicsPlugin.setTimeStep(0);
    this.scene.getPhysicsEngine()?.setSubTimeStep(World.subTimeStep);
  }
  static async create(client: GameClient, canvas: HTMLCanvasElement): Promise<World> {
    if (!World.instance && client?.getSessionId()) {
      // Pre-fetch all assets
      await AssetLoader.load([
        { path: '/assets/game/models/Panzer I/Panzer_I.glb' },
        { path: '/assets/game/map/desert/height.png' },
        { path: '/assets/game/map/desert/diffuse.png' },
        { path: '/assets/game/textures/explosion.jpg' },
        { path: '/assets/game/textures/flare.png' },
        { path: '/assets/game/textures/fire.jpg' },
        { path: '/assets/game/textures/grass.png' },
        { path: '/assets/game/spritesheets/smoke_dust_cloud.png' },
        { path: '/assets/game/spritesheets/explosion.png' },
        { path: '/assets/game/spritesheets/fire.png' },
        { path: '/assets/game/audio/explosion.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/cannon.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/idle.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/run.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/load.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/whizz1.mp3', format: 'arraybuffer' },
        { path: '/assets/game/audio/whizz2.mp3', format: 'arraybuffer' },
        { path: '/assets/game/gui/ads.png' },
        { path: '/assets/game/gui/overlay.png' }
      ]);

      // Init engine
      const engine = new Engine(canvas, true, {
        deterministicLockstep: true,
        lockstepMaxSteps: World.lockstepMaxSteps
      });
      const physicsPlugin = new HavokPlugin(false, await HavokPhysics());
      const world = new World(engine, client, physicsPlugin);
      await world.importPlayerMesh(world);
      await world.initScene();
      world.initWindowListeners();
      world.start();

      World.instance = world;
      return world;
    }
    return World.instance;
  }
  private async importPlayerMesh(world: World) {
    const { meshes } = await SceneLoader.ImportMeshAsync(
      null,
      '/assets/game/models/Panzer I/',
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

    await Skybox.create(this.scene);
    await Ground.create(this.scene);
    this.shadowGenerator?.addShadowCaster(Ground.mesh);
    this.setGUI();
    await this.createTanks();
    this.setBarriers();

    this.observers.push(this.scene.onBeforeStepObservable.add(() => this.beforeStep()));
    this.observers.push(this.scene.onAfterStepObservable.add(() => this.update()));
    this.observers.push(this.scene.onBeforeRenderObservable.add(() => this.beforeRender()));
    this.client.state.onChange(() => this.update());
  }
  private initWindowListeners() {
    window.addEventListener('keydown', this.toggleInspect.bind(this));
    this.throttledResizeListener = throttle(this.resize.bind(this), 200);
    window.addEventListener('resize', this.throttledResizeListener.bind(this));
  }
  private start() {
    this.engine.runRenderLoop(this.render.bind(this));
    this.physicsPlugin.setTimeStep(World.timeStep);
    this.specCamera.lockedTarget = this.player.mesh;
    this.specCamera.radius = 14;
  }
  private render() {
    this.scene.render();
    this.fpsLabel.text = this.engine.getFps().toFixed() + ' FPS';
  }
  private setLights() {
    this.glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer.intensity = 1;
    this.glowLayer.blurKernelSize = 15;

    this.directionalLight = new DirectionalLight('DirectionalLight', new Vector3(0, 1, 0), this.scene);
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

    this.shadowGenerator.autoCalcDepthBounds = true;
  }
  private setGUI() {
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI('UI');

    const statsControl = new TextBlock('stats');
    statsControl.text = 'Hello world';
    statsControl.color = 'white';
    statsControl.fontSize = 24;
    statsControl.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    statsControl.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    statsControl.resizeToFit = true;
    statsControl.fontSize = 14;
    statsControl.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    this.gui.addControl(statsControl);

    const fpsLabel = new TextBlock('fps');
    fpsLabel.text = '';
    fpsLabel.color = 'white';
    fpsLabel.fontSize = 24;
    fpsLabel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    fpsLabel.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
    fpsLabel.resizeToFit = true;
    fpsLabel.fontSize = 14;
    this.gui.addControl(fpsLabel);
    this.fpsLabel = fpsLabel;
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
    barrier1.receiveShadows = true;
    barrier1.material = barrierMaterial;
    const barrier2 = MeshBuilder.CreateBox('barrier2', { width: 500, height: 20, depth: 1 }, this.scene);
    barrier2.position = new Vector3(0, 9, 249);
    barrier2.receiveShadows = true;
    barrier2.material = barrierMaterial;
    const barrier3 = MeshBuilder.CreateBox('barrier3', { width: 500, height: 20, depth: 1 }, this.scene);
    barrier3.rotate(Axis.Y, Math.PI / 2, Space.LOCAL);
    barrier3.position = new Vector3(-249, 9, 0);
    barrier3.receiveShadows = true;
    barrier3.material = barrierMaterial;
    const barrier4 = MeshBuilder.CreateBox('barrier4', { width: 500, height: 20, depth: 1 }, this.scene);
    barrier4.position = new Vector3(249, 9, 0);
    barrier4.rotate(Axis.Y, -Math.PI / 2, Space.LOCAL);
    barrier4.receiveShadows = true;
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
  private beforeRender() {
    this.tppCamera.position = Vector3.Lerp(
      this.tppCamera.position,
      this.player.body.getDirection(nzpyVector).normalize().scale(15).add(this.player.body.position),
      World.deltaTime
    );
    this.tppCamera.target = Vector3.Lerp(
      this.tppCamera.target,
      this.player.body.position,
      World.deltaTime * 2
    );
  }
  private beforeStep() {
    if (this.client.isMatchEnded) {
      this.endCamera.target = this.player.body.absolutePosition;
      this.endCamera.alpha = 1.57;
      this.endCamera.beta += World.deltaTime * 2;
      return;
    }
    if (this.client.isReady()) {
      // 1. Send input to server
      const step = this.scene.getStepId();
      const message = {
        step,
        input: structuredClone(InputManager.keys)
      };
      this.sendInput(message);

      // 2. Immediately process it
      this.player.applyInputs(message.input);

      InputManager.addHistory(message, this.player, step);
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
      this.players[tank.state.sid] = tank;
      this.shadowGenerator.addShadowCaster(this.players[tank.state.sid].mesh);
      if (this.id === tank.state.sid) {
        this.player = tank as PlayerTank;
      }
    });
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

  matchEnd() {
    this.client.isMatchEnded = true;
    this.scene.activeCamera = this.endCamera;
  }
  dispose() {
    this.stateUnsubFns.forEach((unsubFn) => unsubFn());
    window.removeEventListener('keydown', this.toggleInspect);
    window.removeEventListener('resize', this.throttledResizeListener);
    this.engine.dispose();
  }
  removePlayer(id: string) {
    this.players[id].dispose();
  }
}
