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
export const leftVector = new Vector3(-1, 0, 0);
export const rightVector = new Vector3(1, 0, 0);
export const clamp = (val: number, min: number, max: number) => Math.max(Math.min(val, max), min);
export const avg = (vals: number[]) => vals.reduce((acc, curr) => acc + curr, 0) / vals.length;

const S4 = () => (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
export const luid = () => `${S4()}${S4()}`;
export const delay = async (ms: number, iife: (clear: () => void) => void = noop) => {
  let clear = noop;
  const promise = new Promise<boolean>((res) => {
    const handle = setTimeout(() => res(true), ms);
    clear = () => {
      clearTimeout(handle);
      res(false);
    };
  });
  iife(clear);
  return promise;
};
