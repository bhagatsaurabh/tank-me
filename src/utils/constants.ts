import { Converter } from 'showdown';

import {
  GameInputType,
  type ErrorInfo,
  type KeyInputType,
  SpawnAxis,
  type INotification,
  type GraphicsPresetType,
  type GraphicsConfig,
  TouchInputType
} from '@/types';

const converter = new Converter();

export const keyMap: Record<KeyInputType, GameInputType> = {
  KeyW: GameInputType.FORWARD,
  KeyS: GameInputType.REVERSE,
  KeyA: GameInputType.LEFT,
  KeyD: GameInputType.RIGHT,
  KeyR: GameInputType.RESET,
  KeyV: GameInputType.CHANGE_PERSPECTIVE,
  ArrowUp: GameInputType.BARREL_UP,
  ArrowDown: GameInputType.BARREL_DOWN,
  ArrowLeft: GameInputType.TURRET_LEFT,
  ArrowRight: GameInputType.TURRET_RIGHT,
  Space: GameInputType.BRAKE,
  ControlLeft: GameInputType.FIRE,
  ControlRight: GameInputType.FIRE
};
export const touchMap: Record<TouchInputType, GameInputType> = {
  Joystick1Up: GameInputType.FORWARD,
  Joystick1Down: GameInputType.REVERSE,
  Joystick1Left: GameInputType.LEFT,
  Joystick1Right: GameInputType.RIGHT,
  Reset: GameInputType.RESET,
  Perspective: GameInputType.CHANGE_PERSPECTIVE,
  Joystick2Up: GameInputType.BARREL_UP,
  Joystick2Down: GameInputType.BARREL_DOWN,
  Joystick2Left: GameInputType.TURRET_LEFT,
  Joystick2Right: GameInputType.TURRET_RIGHT,
  Brake: GameInputType.BRAKE,
  Fire: GameInputType.FIRE
};

export const userNameRegex = /^.[^!@#$%^&*()+={}[\]`~:;"?/<>]{3,}$/;

export const Notifications = Object.freeze({
  GENERIC: (meta: ErrorInfo): INotification =>
    meta.isCritical
      ? {
          type: 'popup',
          title: 'Something went wrong',
          status: 'error',
          message: converter.makeHtml(
            'Please try again or report [here](https://github.com/saurabh-prosoft/tank-me/issues)'
          ),
          action: 'reload',
          error: meta.error
        }
      : {
          type: 'popup',
          title: 'Something went wrong',
          status: 'error',
          message: converter.makeHtml(
            'Please try again or report [here](https://github.com/saurabh-prosoft/tank-me/issues)'
          ),
          error: meta.error
        },
  ASSET_LOAD_FAILED: (meta: ErrorInfo): INotification => ({
    type: 'popup',
    title: 'Failed to load assets',
    status: 'error',
    message: converter.makeHtml(
      'Please try again or report [here](https://github.com/saurabh-prosoft/tank-me/issues)'
    ),
    error: meta.error
  }),
  SIGN_IN_FAILED: (meta: ErrorInfo): INotification => ({
    type: 'popup',
    title: 'Sign-in failed',
    status: 'error',
    message: converter.makeHtml(
      'Please try again or report [here](https://github.com/saurabh-prosoft/tank-me/issues)'
    ),
    error: meta.error
  }),
  ROOM_JOIN_FAILED: (meta: ErrorInfo): INotification => ({
    type: 'popup',
    title: 'Could not connect to server',
    status: 'error',
    message: converter.makeHtml(
      'Please try again or report [here](https://github.com/saurabh-prosoft/tank-me/issues)'
    ),
    error: meta.error
  })
});

export const spawnAxes: SpawnAxis[] = [SpawnAxis.PX, SpawnAxis.NX, SpawnAxis.PZ, SpawnAxis.NZ];

export const GraphicsPreset: Record<GraphicsPresetType, GraphicsConfig> = Object.freeze({
  high: {
    shadows: {
      quality: 0,
      mapSize: 512
    }
  },
  low: {
    shadows: {
      quality: 2,
      mapSize: 256
    }
  }
});
