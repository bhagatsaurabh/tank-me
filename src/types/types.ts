import type { Sound } from '@babylonjs/core';

export type AuthStatus = 'pending' | 'blocked' | 'verified' | 'signed-in' | 'signed-out';
export type AuthType = 'email' | 'verify' | 'guest' | 'guest-verify';

export type LobbyStatus = 'connecting' | 'failed' | 'idle' | 'matchmaking' | 'playing';

export enum GameInputType {
  FORWARD = 0,
  REVERSE = 1,
  LEFT = 2,
  RIGHT = 3,
  BRAKE = 4,
  BARREL_UP = 5,
  BARREL_DOWN = 6,
  TURRET_LEFT = 7,
  TURRET_RIGHT = 8,
  FIRE = 9,
  RESET = 10,
  CHANGE_PERSPECTIVE = 11
}
export enum KeyInputType {
  KEY_W = 'KeyW',
  KEY_S = 'KeyS',
  KEY_A = 'KeyA',
  KEY_D = 'KeyD',
  KEY_SPACE = 'Space',
  KEY_ARROW_UP = 'ArrowUp',
  KEY_ARROW_DOWN = 'ArrowDown',
  KEY_ARROW_LEFT = 'ArrowLeft',
  KEY_ARROW_RIGHT = 'ArrowRight',
  KEY_CTRL_LEFT = 'ControlLeft',
  KEY_CTRL_RIGHT = 'ControlRight',
  KEY_R = 'KeyR',
  KEY_V = 'KeyV'
}

export enum MessageType {
  INPUT = 'input',
  LOAD = 'load',
  FIRE = 'fire'
}

export type TankSoundType = 'idle' | 'move' | 'explode' | 'turret' | 'cannon' | 'load' | 'whizz1' | 'whizz2';
export type TankSounds = {
  [id in TankSoundType]?: Sound;
};
