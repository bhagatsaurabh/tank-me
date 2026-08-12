import { MapSchema, Schema, type } from "@colyseus/schema";

export class Position extends Schema {
  @type("number") x!: number;
  @type("number") y!: number;
  @type("number") z!: number;
}
export class Rotation extends Schema {
  @type("number") x!: number;
  @type("number") y!: number;
  @type("number") z!: number;
  @type("number") w!: number;
}
export class BarrelRotation extends Schema {
  @type("number") x!: number;
  @type("number") y!: number;
  @type("number") z!: number;
  @type("number") w!: number;
}
export class TurretRotation extends Schema {
  @type("number") x!: number;
  @type("number") y!: number;
  @type("number") z!: number;
  @type("number") w!: number;
}
export class LastProcessedInput extends Schema {
  @type("number") step!: number;
  @type("number") timestamp!: number;
}

export class Player extends Schema {
  @type("string") sid!: string;
  @type("string") uid!: string;
  @type("boolean") canFire!: boolean;
  @type("number") leftSpeed!: number;
  @type("number") rightSpeed!: number;
  @type("number") health!: number;
  @type(Position) position!: Position;
  @type(Rotation) rotation!: Rotation;
  @type(BarrelRotation) barrelRotation!: BarrelRotation;
  @type(TurretRotation) turretRotation!: TurretRotation;
  @type(LastProcessedInput) lastProcessedInput!: LastProcessedInput;
}

export class RoomState extends Schema {
  @type("string") status: "matching" | "ready" = "matching";
  @type("number") startTimestamp: number = -1;
  @type({ map: Player }) players = new MapSchema<Player>();
}
