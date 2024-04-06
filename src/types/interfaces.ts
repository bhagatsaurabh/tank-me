import { type Nullable } from '@babylonjs/core';
import type {
  MatchStats,
  NotificationAction,
  NotificationStatus,
  NotificationType,
  PlayerInputs,
  ShadowGeneratorQuality
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
  winner: Nullable<string>;
  loser: Nullable<string>;
  isDraw: boolean;
  stats: MatchStats;
}

export interface ITrapBounds {
  first: Node | null;
  last: Node | null;
}

export interface IModalAction {
  text: string;
  action?: () => Promise<any> | any;
  async?: boolean;
  busy?: boolean;
}
export interface IModalInfo {
  title: string;
  controls: IModalAction[];
  message: string;
}

export interface INotification {
  type: NotificationType;
  title: string;
  status: NotificationStatus;
  message: string;
  action?: NotificationAction;
  error?: unknown;
}

export interface UserPreferences {
  fullscreenConsentTS: number;
}

export interface GraphicsConfig {
  id: string;
  shadows: {
    quality: ShadowGeneratorQuality;
    mapSize: 128 | 256 | 512;
  };
  optimizations: {
    targetFps: 30 | 45 | 60;
    maxTextureSize: 128 | 256 | 512;
    maxHardwareScale: 2 | 3 | 4;
  };
}
