import { GameInputType, type KeyInputType } from '@/types/types';

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
