import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import {
  Engine,
  Scene,
  Vector3,
  Mesh,
  CreateSphere,
  StandardMaterial,
  Color3,
  HavokPlugin,
  GlowLayer,
  DirectionalLight,
  ShadowGenerator,
  CascadedShadowGenerator,
  FollowCamera,
  MeshBuilder,
  CubeTexture,
  Texture,
  GroundMesh,
  PhysicsAggregate,
  PhysicsShapeType,
  FreeCamera,
  SceneLoader,
  AbstractMesh,
  ArcRotateCamera
} from '@babylonjs/core';
import HavokPhysics, { type HavokPhysicsWithBindings } from '@babylonjs/havok';

import { GameClient } from '@/game/client';
import type { Room } from 'colyseus.js';
import type { RoomState } from './state';
import type { Null } from '@/interfaces/types';
import { gravityVector, noop, throttle } from '@/utils/utils';
import { InputManager } from './input';
import { AssetLoader } from './loader';
import { Tank } from './tank';

/**
 * Assumptions before creating a game instance:
 * 1. GameClient is connected to LobbyRoom
 * 2. GameClient is connected to GameRoom
 * 3. GameRoom is full with maxNoOfClients
 */
export class TankMe {
  private static instance: TankMe;
  static physicsPlugin: HavokPlugin;
  private engine: Engine;
  private scene: Scene;
  private playerEntities: Record<string, Mesh> = {};
  private playerNextPosition: Record<string, Vector3> = {};
  private throttledResizeListener = noop;
  private stateUnsubFns: (() => boolean)[] = [];
  private glowLayer!: GlowLayer;
  private directionalLight!: DirectionalLight;
  private shadowGenerator!: ShadowGenerator;
  private tppCamera!: FollowCamera;
  private fppCamera!: FreeCamera;
  private endCamera!: ArcRotateCamera;
  private ground!: GroundMesh;
  private playerMeshes: AbstractMesh[] = [];
  private players: Record<string, Tank> = {};
  private player!: Tank;

  private constructor(
    public canvas: HTMLCanvasElement,
    public client: GameClient,
    public room: Room<RoomState>,
    public physicsEngine: HavokPhysicsWithBindings,
    public selfUID: string
  ) {
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);
    TankMe.physicsPlugin = new HavokPlugin(true, physicsEngine);
    this.scene.enablePhysics(gravityVector, TankMe.physicsPlugin);

    this.initScene();
    this.initStateListeners();
    this.initWindowListeners();
    this.render();
  }
  static get(): TankMe | undefined {
    return TankMe.instance;
  }
  static async init(canvas: HTMLCanvasElement, selfUID: string): Promise<Null<TankMe>> {
    const client = GameClient.get();
    if (!TankMe.instance && client && client.rooms['desert']) {
      const physicsEngine = await HavokPhysics();
      TankMe.instance = new TankMe(canvas, client, client.rooms['desert'], physicsEngine, selfUID);

      await TankMe.importPlayerMesh(TankMe.instance.scene);

      return TankMe.instance;
    }
    return null;
  }
  private static async importPlayerMesh(scene: Scene) {
    const { meshes } = await SceneLoader.ImportMeshAsync(
      null,
      '/assets/game/models/default',
      'Tank.babylon',
      scene
    );
    TankMe.instance.playerMeshes = meshes;
  }

  private initScene() {
    // Init input manager
    this.scene.actionManager = InputManager.init(this.scene);

    // Set GlowLayer
    this.glowLayer = new GlowLayer('glow', this.scene);
    this.glowLayer.intensity = 2;

    // Set Lights
    this.directionalLight = new DirectionalLight('DirectionalLight', new Vector3(-1, -1, 0), this.scene);
    this.directionalLight.intensity = 1;
    this.directionalLight.position.x = -300;
    this.shadowGenerator = new CascadedShadowGenerator(1024, this.directionalLight);
    this.shadowGenerator.useContactHardeningShadow = true;

    this.setCameras();

    // Create SkyBox
    /* const skybox = MeshBuilder.CreateBox('skyBox', { size: 1000.0 }, this.scene);
    const skyboxMaterial = new StandardMaterial('skyBox', this.scene);
    skyboxMaterial.backFaceCulling = false;
    skybox.material = skyboxMaterial;
    skybox.infiniteDistance = true;
    skyboxMaterial.disableLighting = true;
    skyboxMaterial.reflectionTexture = new CubeTexture('/assets/game/skybox/bluecloud', this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0); */
    // this.scene.createDefaultSkybox(new CubeTexture('/assets/game/skybox/bluecloud', this.scene), false, 1000);
    this.scene.createDefaultSkybox(new CubeTexture('/assets/game/skybox/bluecloud', this.scene), true, 1000);

    // Create Ground
    this.ground = MeshBuilder.CreateGroundFromHeightMap(
      'ground',
      AssetLoader.assets['/assets/game/map/height.png'],
      {
        width: 500,
        height: 500,
        subdivisions: 500,
        minHeight: 0,
        maxHeight: 25,
        updatable: false,
        onReady: this.handleGroundCreated
      },
      this.scene
    );

    /* this.client.rooms['desert']?.send('updatePosition', {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z
    }); */

    // Before frame render
    this.scene.registerBeforeRender(this.handleInput);
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
  private handleInput() {
    const shiftModifier = InputManager.map['Shift'];
    let isMoving = false;

    if (InputManager.map['KeyW']) {
      this.player.forward(0.2);
      isMoving = true;
    }
    if (InputManager.map['KeyS']) {
      this.player.backward(-0.2);
      isMoving = true;
    }
    if (InputManager.map['KeyA']) {
      this.player.left(shiftModifier ? -0.01 : -0.02);
      isMoving = true;
    }
    if (InputManager.map['KeyD']) {
      this.player.right(shiftModifier ? 0.01 : 0.02);
      isMoving = true;
    }
    this.player.playSounds(isMoving);

    if (InputManager.map['ArrowLeft']) {
      this.player.turretLeft(shiftModifier ? 0.01 : 0.02);
    }
    if (InputManager.map['ArrowRight']) {
      this.player.turretRight(shiftModifier ? 0.01 : 0.02);
    }
    if (InputManager.map['ArrowUp']) {
      this.player.turretUp(0.01);
    }
    if (InputManager.map['ArrowDown']) {
      this.player.turretDown(0.01);
    }

    if (InputManager.map['KeyT']) {
      this.player.reset();
    }

    if (InputManager.map['KeyR']) {
      this.player.resetTurret();
    }

    if (InputManager.map['Space']) {
      this.player.fire();
    }

    if (InputManager.map['KeyV']) {
      this.player.toggleCamera();
    }

    this.player.checkStuck();

    // Post-game cam
    /* if (rotateCamera) {
        arcRotateCam.alpha += 0.007;
      } */
  }
  private handleGroundCreated() {
    if (!this.ground) return;

    const groundMaterial = new StandardMaterial('ground', this.scene);
    groundMaterial.diffuseTexture = new Texture(
      AssetLoader.assets['/assets/game/map/diffuse.png'],
      this.scene
    );
    groundMaterial.specularColor = new Color3(0, 0, 0);
    groundMaterial.ambientColor = new Color3(1, 1, 1);
    this.ground.material = groundMaterial;

    /* this.ground.physicsImpostor = new PhysicsImpostor(
      this.ground,
      PhysicsImpostor.HeightmapImpostor,
      { mass: 0, restitution: 0 },
      this.scene
    ); */
    new PhysicsAggregate(
      this.ground,
      PhysicsShapeType.MESH,
      { mass: 0, restitution: 0 },
      this.scene
    ).body.setCollisionCallbackEnabled(true);

    this.ground.position.y = 0;
    this.shadowGenerator?.addShadowCaster(this.ground);
    this.ground.receiveShadows = true;

    this.createTanks();
  }
  private createTanks() {
    this.room.state.players.forEach((player) => {
      const isEnemy = this.selfUID !== player.uid;
      this.players[player.uid] = Tank.create(
        player.uid,
        this.playerMeshes,
        this.shadowGenerator,
        new Vector3(...Object.values(player.position)),
        this.scene,
        !isEnemy ? { tpp: this.tppCamera, fpp: this.fppCamera } : null,
        isEnemy
      );
      if (!isEnemy) this.player = this.players[player.uid];
    });
  }
  private initStateListeners() {
    const unsubscribeOnAdd = this.room.state.players.onAdd((player, sessionId) => {
      player.onChange(() => {
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
      this.playerNextPosition[sessionId] = sphere.position.clone();
    });
    const unsubscribeOnRemove = this.room.state.players.onRemove((player, sessionId) => {
      this.playerEntities[sessionId].dispose();
      delete this.playerEntities[sessionId];
    });

    this.stateUnsubFns.push(unsubscribeOnAdd, unsubscribeOnRemove);
  }
  private toggleInspect(ev: KeyboardEvent) {
    // Sfhit+Ctrl+Alt
    if (ev.shiftKey && ev.ctrlKey && ev.altKey) {
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
    window.addEventListener('keydown', this.toggleInspect);
    this.throttledResizeListener = throttle(this.resize.bind(this), 200);
    window.addEventListener('resize', this.throttledResizeListener);
  }
  private render() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
      // fpsLabel.innerHTML = this.engine.getFps().toFixed() + ' FPS';
    });
  }

  public dispose() {
    this.stateUnsubFns.forEach((unsubFn) => unsubFn());
    window.removeEventListener('keydown', this.toggleInspect);
    window.removeEventListener('resize', this.throttledResizeListener);
    this.engine.dispose();
  }
}
