import type { PlayerInputs } from './types';

export interface IMessageTypeInput {
  seq: number;
  input: PlayerInputs;
}

export interface IMessageTypeFire {
  id: string;
}
export interface IMessageTypeLoad {}
