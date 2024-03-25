import { Client, Room } from 'colyseus.js';

import type { RoomState } from './state';
import { World } from './main';
import { MessageType } from '@/types/types';
import { useLobbyStore } from '@/stores/lobby';
import type { IMessageEnd, IMessageFire } from '@/types/interfaces';
import type { EnemyTank } from './models/enemy';
import { Monitor } from './monitor';

export class GameClient {
  private static instance: GameClient;
  private client!: Client;
  private world?: World;
  private rooms: { lobby?: Room<any>; desert?: Room<RoomState> } = {};
  isMatchEnded = false;
  didWin = false;

  get state() {
    return this.rooms.desert!.state;
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
    const lobby = useLobbyStore();

    const instance = GameClient.instance;
    instance.rooms.desert?.removeAllListeners();
    instance.rooms.desert?.leave(true);

    lobby.status = 'idle';
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

    this.rooms.desert!.state.listen('status', (newVal) => newVal === 'ready' && (lobby.status = 'playing'));
    this.rooms.desert!.state.players.onRemove((_player, sessionId) => this.world?.removePlayer(sessionId));
    this.rooms.desert!.onMessage(MessageType.ENEMY_FIRE, (message: IMessageFire) => {
      if (this.isMatchEnded) return;
      (this.world?.players[message.id] as EnemyTank).fire();
    });
    this.rooms.desert!.onMessage<IMessageEnd>(MessageType.MATCH_END, (message) => {
      this.world!.matchEnd(message);
    });
  }

  async createWorld(canvasEl: HTMLCanvasElement, vsAI = false) {
    this.world = await World.create(this, canvasEl, vsAI);
    Monitor.start(this.world!);
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
    if (this.isMatchEnded) return;
    this.rooms.desert?.send(type, message);
  }
}
