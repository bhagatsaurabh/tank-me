import { MapSchema, Schema } from '@colyseus/schema';

export class Player extends Schema {
  uid!: string;
  x!: number;
  y!: number;
  z!: number;
}

export class RoomState extends Schema {
  players = new MapSchema<Player>();
  status: 'matching' | 'ready' = 'matching';
}
