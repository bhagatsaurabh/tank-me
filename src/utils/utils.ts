import { Vector3 } from '@babylonjs/core';

import type { Null } from '@/interfaces/types';

export const throttle = (cb: (...argmts: any) => void, delay: number) => {
  let timerHandle: Null<Number>, args: any;
  const throttled = (...a: any) => {
    args = a;
    if (!timerHandle) {
      cb(...args);
      args = null;
      timerHandle = setTimeout(() => {
        timerHandle = null;
        if (args) {
          throttled(...args);
        }
      }, delay);
    }
  };
  return throttled;
};

export const noop: () => void = () => {};

export const gravityVector = new Vector3(0, -9.8, 0);
