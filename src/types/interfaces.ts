import type { PlayerInputs } from './types';

export interface IMessageInput {
  step: number;
  // Actual timestamp is set at server, TS = ServerTime - AveragePing
  timestamp?: 0;
  input: PlayerInputs;
}

export interface IMessageFire {
  id: string;
}
export interface IMessageLoad {}
export interface IMessageEnd {
  winner: string;
  loser: string;
}
