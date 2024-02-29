import { Client, Room } from 'colyseus.js';
import { MapSchema } from '@colyseus/schema';

import type { Player, RoomState } from './state';
import { World } from './main';
import { MessageType } from '@/types/types';
import { useLobbyStore } from '@/stores/lobby';
import type { MessageTypeFire } from '@/types/interfaces';

export class GameClient {
  private static instance: GameClient;
  private client!: Client;
  private world?: World;
  private rooms: { lobby?: Room<any>; desert?: Room<RoomState> } = {};

  get state(): MapSchema<Player, string> {
    return this.rooms.desert!.state.players;
  }

  private constructor() {
    this.client = new Client(import.meta.env.VITE_TANKME_SERVER);
  }
  static get(): GameClient {
    return GameClient.instance;
  }
  static connect(): GameClient | undefined {
    if (!GameClient.instance) {
      GameClient.instance = new GameClient();
    }
    return GameClient.instance;
  }
  static disconnect() {
    const instance = GameClient.instance;
    instance.rooms.desert?.removeAllListeners();
    instance.rooms.desert?.leave(true);
  }

  async joinRoom(name: 'lobby' | 'desert', accessToken: string) {
    const room = await this.client.joinOrCreate<RoomState>(name, { accessToken });
    this.rooms[name] = room;

    if (name === 'desert') {
      this.setListeners();
    }

    return room;
  }
  private setListeners() {
    const lobby = useLobbyStore();

    // this.rooms.desert!.onStateChange((state) => throttledDebug(state));
    this.rooms.desert!.state.listen('status', (newVal) => {
      if (newVal === 'ready') lobby.status = 'playing';
    });
    this.rooms.desert!.state.players.onAdd((player, key) => {
      this.world?.updatePlayer(player, key);
      player.onChange(() => this.world?.updatePlayer(player, key));
    });
    this.rooms.desert!.state.players.onRemove((_player, sessionId) => {
      this.world?.removePlayer(sessionId);
    });
    this.rooms.desert!.onMessage(MessageType.ENEMY_FIRE, (message: MessageTypeFire) => {
      this.world?.players[message.id].fire();
    });
    this.rooms.desert!.onMessage(MessageType.LOAD, () => this.world?.player.playSound('load'));
  }

  async createWorld(canvasEl: HTMLCanvasElement) {
    this.world = await World.create(this, canvasEl);
  }
  getSessionId() {
    return this.rooms.desert?.sessionId;
  }
  isReady() {
    return this.rooms.desert?.state?.status === 'ready';
  }
  getPlayers() {
    return this.rooms.desert!.state.players;
  }
  sendEvent<T>(type: MessageType, message: T) {
    this.rooms.desert?.send(type, message);
  }
}
