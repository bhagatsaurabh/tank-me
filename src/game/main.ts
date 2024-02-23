import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import '@babylonjs/loaders/glTF/2.0/glTFLoader';
import { GlowLayer } from '@babylonjs/core/Layers';
import { PhysicsViewer } from '@babylonjs/core/Debug';
import { Engine, Scene } from '@babylonjs/core';
import { SceneLoader } from '@babylonjs/core/Loading';
import { Axis, Space, Vector3 } from '@babylonjs/core/Maths';
import { Mesh, AbstractMesh, MeshBuilder, TransformNode } from '@babylonjs/core/Meshes';
import { PBRMaterial, StandardMaterial, Texture } from '@babylonjs/core/Materials';
import { HavokPlugin, PhysicsAggregate, PhysicsShapeType } from '@babylonjs/core/Physics';
import { DirectionalLight, CascadedShadowGenerator } from '@babylonjs/core/Lights';
import { FollowCamera, FreeCamera, ArcRotateCamera } from '@babylonjs/core/Cameras';
import HavokPhysics, { type HavokPhysicsWithBindings } from '@babylonjs/havok';
import { AdvancedDynamicTexture, Image, Control, Rectangle, Container } from '@babylonjs/gui';
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
  private gui!: AdvancedDynamicTexture;
  private sights: (Control | Container)[] = [];
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
        { path: '/assets/game/map/desert/height.png' },
        { path: '/assets/game/map/desert/diffuse.png' },
        { path: '/assets/game/textures/explosion.jpg' },
        { path: '/assets/game/textures/flare.png' },
        { path: '/assets/game/textures/fire.jpg' },
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
    this.glowLayer.intensity = 1;
    this.glowLayer.blurKernelSize = 15;

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

    this.setGUI();
    this.setBarriers();
  }
  private setCameras() {
    // Set TPP Camera
    this.tppCamera = new FollowCamera('tpp-cam', new Vector3(0, 10, -10), this.scene);
    this.tppCamera.radius = 13;
    this.tppCamera.heightOffset = 4;
    this.tppCamera.rotationOffset = 180;
    this.tppCamera.cameraAcceleration = 0.05;
    this.tppCamera.maxCameraSpeed = 10;
    this.tppCamera.maxZ = 100000;
    this.scene.activeCamera = this.tppCamera;

    // Set FPP Camera
    this.fppCamera = new FreeCamera('fpp-cam', new Vector3(0.3, -0.309, 1), this.scene);
    this.fppCamera.minZ = 0.5;
    this.fppCamera.maxZ = 100000;

    // Set ArcRotateCamera
    this.endCamera = new ArcRotateCamera('end-cam', 0, 0, 10, new Vector3(0, 0, 0), this.scene);
  }
  private setGUI() {
    this.gui = AdvancedDynamicTexture.CreateFullscreenUI('UI');
    const scope = new Image('ads', AssetLoader.assets['/assets/game/gui/ads.png'] as string);
    scope.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    scope.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    scope.autoScale = true;
    scope.width = '50%';
    scope.fixedRatio = 1;
    scope.stretch = Image.STRETCH_FILL;
    scope.shadowBlur = 3;
    scope.shadowColor = '#AFE1AF';
    scope.alpha = 0.8;
    scope.isVisible = false;
    scope.scaleX = 1.5;
    scope.scaleY = 1.5;
    this.gui.addControl(scope);

    const overlay = new Image('overlay', AssetLoader.assets['/assets/game/gui/overlay.png'] as string);
    overlay.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    overlay.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    overlay.height = '100%';
    overlay.fixedRatio = 1;
    overlay.isVisible = false;
    this.gui.addControl(overlay);

    const padWidth = (this.engine.getRenderWidth(true) - this.engine.getRenderHeight(true)) / 2;
    const padLeft = new Rectangle('left-pad');
    padLeft.width = `${padWidth}px`;
    padLeft.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    padLeft.color = '#000';
    padLeft.background = '#000';
    padLeft.isVisible = false;
    this.gui.addControl(padLeft);

    const padRight = new Rectangle('right-pad');
    padRight.width = `${padWidth}px`;
    padRight.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
    padRight.color = '#000';
    padRight.background = '#000';
    padRight.isVisible = false;
    this.gui.addControl(padRight);

    this.sights.push(scope, overlay, padLeft, padRight);
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
    barrier4.rotate(Axis.Y, Math.PI / 2, Space.LOCAL);
    barrier4.position = new Vector3(249, 9, 0);
    barrier4.receiveShadows = true;
    barrier4.material = barrierMaterial;

    barrier1.parent = barrier;
    barrier2.parent = barrier;
    barrier3.parent = barrier;
    barrier4.parent = barrier;

    // Not working
    /* const barrierShape = new PhysicsShapeBox(
      Vector3.Zero(),
      Quaternion.Identity(),
      new Vector3(250, 10, 1),
      this.scene
    );
    const barrierContainerShape = new PhysicsShapeContainer(this.scene);
    barrierShape.addChildFromParent(barrier, barrierShape, barrier1);
    barrierShape.addChildFromParent(barrier, barrierShape, barrier2);
    barrierShape.addChildFromParent(barrier, barrierShape, barrier3);
    barrierShape.addChildFromParent(barrier, barrierShape, barrier4);
    const barrierPB = new PhysicsBody(barrier, PhysicsMotionType.STATIC, false, this.scene);
    barrierPB.shape = barrierContainerShape;
    barrierPB.setMassProperties({ mass: 0, centerOfMass: Vector3.Zero() }); */

    new PhysicsAggregate(barrier1, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    new PhysicsAggregate(barrier2, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    new PhysicsAggregate(barrier3, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    new PhysicsAggregate(barrier4, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
  }
  private step() {
    const deltaTime = this.engine.getTimeStep() / 1000;
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
    this.player?.playSounds(isMoving, isBarrelMoving || isTurretMoving);

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
      this.sights.forEach((ui) => (ui.isVisible = this.scene.activeCamera === this.fppCamera));
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

    this.players['test'] = await Tank.create(
      'test',
      this.playerMeshes,
      // new Vector3(...Object.values(player.position ?? { x: rand(-240, 240), y: 14, z: rand(-240, 240) })),
      new Vector3(-20, 14, 20),
      this.scene,
      null,
      true
    );
    this.shadowGenerator.addShadowCaster(this.players['test'].rootMesh);

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
