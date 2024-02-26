import { Client, Room } from 'colyseus.js';
import { MapSchema } from '@colyseus/schema';

import type { Player, RoomState } from './state';
import { World } from './main';
import { GameInputType, MessageType } from '@/types/types';
import { useLobbyStore } from '@/stores/lobby';
import type { MessageTypeFire } from '@/types/interfaces';

export class GameClient {
  private static instance: GameClient;
  private client!: Client;
  private world!: World;
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
    const lobby = useLobbyStore();

    const room = await this.client.joinOrCreate<RoomState>(name, { accessToken });
    this.rooms[name] = room;
    this.setListeners();

    room.state.listen('status', (newVal) => {
      if (newVal === 'ready') lobby.status = 'playing';
    });

    return room;
  }
  private setListeners() {
    this.rooms.desert!.state.players.onChange((player, sessionId) => {
      // const isPlayer = sessionId === this.rooms.desert!.sessionId;
      this.world.updatePlayer(player, sessionId);
    });
    this.rooms.desert!.state.players.onRemove((_player, sessionId) => {
      this.world.removePlayer(sessionId);
    });

    this.rooms.desert!.onMessage(MessageType.FIRE, (message: MessageTypeFire) => {
      this.world.players[message.id].fire();
    });
    this.rooms.desert!.onMessage(MessageType.LOAD, () => this.world.player.playSound('load'));
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
  sendUpdate(keys: Record<GameInputType, boolean>) {
    this.rooms.desert?.send(MessageType.INPUT, keys);
  }
  getPlayers() {
    return this.rooms.desert!.state.players;
  }
}
