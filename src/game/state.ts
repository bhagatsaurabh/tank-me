import { MapSchema, Schema } from '@colyseus/schema';

export class Position extends Schema {
  x!: number;
  y!: number;
  z!: number;
}
export class Rotation extends Schema {
  x!: number;
  y!: number;
  z!: number;
  w!: number;
}
export class TurretRotation extends Schema {
  x!: number;
  y!: number;
  z!: number;
}
export class Player extends Schema {
  uid!: string;
  position!: Position;
  rotation!: Rotation;
  turretRotation!: TurretRotation;
}

export class RoomState extends Schema {
  players = new MapSchema<Player>();
  status: 'matching' | 'ready' = 'matching';
}
