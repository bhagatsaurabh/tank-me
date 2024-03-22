import { Converter } from 'showdown';

import { GameInputType, type ErrorInfo, type KeyInputType } from '@/types/types';
import type { INotification } from '@/types/interfaces';

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
