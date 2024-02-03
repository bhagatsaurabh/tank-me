import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  CreatePlane,
  Mesh,
  CreateSphere,
  StandardMaterial,
  Color3
} from '@babylonjs/core';

import { GameClient } from '@/game/client';
import type { Room } from 'colyseus.js';
import type { RoomState } from './state';
import type { Null } from '@/interfaces/types';

/**
 * Assumptions before creating a game instance:
 * 1. GameClient is connected to LobbyRoom
 * 2. GameClient is connected to GameRoom
 * 3. GameRoom is full with maxNoOfClients
 */
export class TankMe {
  private static instance: TankMe;
  private engine: Engine;
  private scene: Scene;
  private playerEntities: Record<string, Mesh> = {};
  private playerNextPosition: Record<string, Vector3> = {};

  private constructor(
    public canvas: HTMLCanvasElement,
    public client: GameClient,
    public room: Room<RoomState>
  ) {
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);

    this.initScene();
    this.registerStateListeners();
    this.initDebugMode();
    this.render();
  }
  static get(): TankMe | undefined {
    return TankMe.instance;
  }
  static init(canvas: HTMLCanvasElement): Null<TankMe> {
    const client = GameClient.get();
    if (!TankMe.instance && client && client.rooms['desert']) {
      TankMe.instance = new TankMe(canvas, client, client.rooms['desert']);
      return TankMe.instance;
    }
    return null;
  }

  private initScene() {
    const ground = CreatePlane('ground', { size: 500 }, this.scene);
    ground.position.y = -15;
    ground.rotation.x = Math.PI / 2;

    // const light1: HemisphericLight = new HemisphericLight('light1', new Vector3(1, 1, 0), this.scene);
    this.scene.addLight(new HemisphericLight('light1', new Vector3(1, 1, 0)));
    const camera: ArcRotateCamera = new ArcRotateCamera(
      'Camera',
      Math.PI / 2,
      Math.PI / 2,
      2,
      Vector3.Zero(),
      this.scene
    );
    camera.attachControl(this.canvas, true);

    this.scene.onPointerDown = (event, pointer) => {
      if (event.button == 0 && pointer.pickedPoint) {
        const targetPosition = pointer.pickedPoint.clone();

        targetPosition.y = -1;
        if (targetPosition.x > 245) targetPosition.x = 245;
        else if (targetPosition.x < -245) targetPosition.x = -245;
        if (targetPosition.z > 245) targetPosition.z = 245;
        else if (targetPosition.z < -245) targetPosition.z = -245;

        this.client.rooms['desert']?.send('updatePosition', {
          x: targetPosition.x,
          y: targetPosition.y,
          z: targetPosition.z
        });
      }
    };

    this.scene.registerBeforeRender(() => {
      for (const sessionId in this.playerEntities) {
        const entity = this.playerEntities[sessionId];
        const targetPosition = this.playerNextPosition[sessionId];
        entity.position = Vector3.Lerp(entity.position, targetPosition, 0.05);
      }
    });
  }
  private registerStateListeners() {
    this.room.state.players.onAdd((player, sessionId) => {
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
    this.room.state.players.onRemove((player, sessionId) => {
      this.playerEntities[sessionId].dispose();
      delete this.playerEntities[sessionId];
    });
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
  private initDebugMode() {
    window.addEventListener('keydown', this.toggleInspect);
  }
  private render() {
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }

  public dispose() {
    this.engine.dispose();
  }
}
