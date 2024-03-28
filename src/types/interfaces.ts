import type {
  MatchStats,
  NotificationAction,
  NotificationStatus,
  NotificationType,
  PlayerInputs
} from './types';

export interface IMessageInput {
  step: number;
  // Actual timestamp is set at server, TS = ServerTime - AveragePing
  timestamp?: 0;
  input: PlayerInputs;
}

export interface IMessageFire {
  id: string;
}
export interface IMessageEnd {
  winner: string;
  loser: string;
  stats: MatchStats;
}

export interface ITrapBounds {
  first: Node | null;
  last: Node | null;
}

export interface INotification {
  type: NotificationType;
  title: string;
  status: NotificationStatus;
  message: string;
  action?: NotificationAction;
  error?: unknown;
}
