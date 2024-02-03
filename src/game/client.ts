import { Client, Room } from 'colyseus.js';
import type { RoomState } from './state';

export class GameClient {
  private static instance: GameClient;
  private clysClient!: Client;
  rooms: { lobby?: Room<any>; desert?: Room<RoomState> } = {};

  private constructor() {
    this.clysClient = new Client(import.meta.env.VITE_TANKME_SERVER);
  }

  static get(): GameClient | undefined {
    return GameClient.instance;
  }
  static connect(): GameClient | undefined {
    if (!GameClient.instance) {
      GameClient.instance = new GameClient();
    }
    return GameClient.instance;
  }

  async joinRoom(name: 'lobby' | 'desert', accessToken: string) {
    const room = await this.clysClient.joinOrCreate<RoomState>(name, { accessToken });
    this.rooms[name] = room;
    return room;
  }
}
