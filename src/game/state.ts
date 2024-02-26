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
export class BarrelRotation extends Schema {
  x!: number;
  y!: number;
  z!: number;
  w!: number;
}
export class TurretRotation extends Schema {
  x!: number;
  y!: number;
  z!: number;
  w!: number;
}
export class Player extends Schema {
  sid!: string;
  uid!: string;
  canFire!: boolean;
  leftSpeed!: number;
  rightSpeed!: number;
  position!: Position;
  rotation!: Rotation;
  barrelRotation!: BarrelRotation;
  turretRotation!: TurretRotation;
}

export class RoomState extends Schema {
  players = new MapSchema<Player>();
  status: 'matching' | 'ready' = 'matching';
}
