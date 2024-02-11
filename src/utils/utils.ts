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

export const readAsDataURL = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
export const readAsArrayBuffer = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(blob);
  });
export const denormalize = (norm: number, min: number, max: number) => {
  return norm * (max - min) + min;
};
export const rand = (min: number, max: number) => {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return denormalize(buf[0] / (0xffffffff + 1), min, max);
};
export const forwardVector = new Vector3(0, 0, 1);