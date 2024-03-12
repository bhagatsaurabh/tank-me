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
export class LastProcessedInput extends Schema {
  step!: number;
  timestamp!: number;
}

export class Player extends Schema {
  sid!: string;
  uid!: string;
  canFire!: boolean;
  leftSpeed!: number;
  rightSpeed!: number;
  health!: number;
  position!: Position;
  rotation!: Rotation;
  barrelRotation!: BarrelRotation;
  turretRotation!: TurretRotation;
  lastProcessedInput!: LastProcessedInput;
}

export class RoomState extends Schema {
  status: 'matching' | 'ready' = 'matching';
  startTimestamp: number = -1;
  players = new MapSchema<Player>();
}
