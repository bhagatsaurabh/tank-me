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
