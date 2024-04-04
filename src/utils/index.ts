import { Vector3, type Nullable } from '@babylonjs/core';

import { type ITrapBounds, SpawnAxis } from '@/types';
import { spawnAxes } from './constants';

export const throttle = (cb: (...argmts: any) => void, delay: number) => {
  let timerHandle: Nullable<Number>, args: any;
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
export const nzpyVector = new Vector3(0, 0.4, -1);
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
export const randInRange = (min: number, max: number) => {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return denormalize(buf[0] / (0xffffffff + 1), min, max);
};
export const trapFocus = (event: KeyboardEvent, el: HTMLElement, bound: ITrapBounds) => {
  if (event.key === 'Tab') {
    if (!el.contains(document.activeElement)) {
      (bound.first as HTMLElement)?.focus();
      return;
    }

    if (event.shiftKey) {
      if (document.activeElement === bound.first) {
        (bound.last as HTMLElement)?.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === bound.last) {
        (bound.first as HTMLElement)?.focus();
        event.preventDefault();
      }
    }
  }
};
export const trapBetween = (root: HTMLElement): ITrapBounds => {
  if (!root) return { first: null, last: null };

  const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      (node as HTMLElement).tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
  });

  let currNode = null,
    lastTabbableNode = null;
  const firstTabbableNode = treeWalker.nextNode();

  while ((currNode = treeWalker.nextNode()) !== null) {
    lastTabbableNode = currNode;
  }

  if (!lastTabbableNode) lastTabbableNode = firstTabbableNode;

  return { first: firstTabbableNode, last: lastTabbableNode };
};
export const getSlug = (title: string) => `#pop-${title.toLowerCase().replaceAll(' ', '-')}`;
export const choose = <T>(vals: T[]): T => vals[Math.round(randInRange(0, vals.length - 1))];
export const getSpawnPoint = (): Vector3 => {
  switch (choose<SpawnAxis>(spawnAxes)) {
    case SpawnAxis.PX:
      return new Vector3(240, 15, Math.round(randInRange(-240, 240)));
    case SpawnAxis.NX:
      return new Vector3(-240, 15, Math.round(randInRange(-240, 240)));
    case SpawnAxis.PZ:
      return new Vector3(Math.round(randInRange(-240, 240)), 15, 240);
    case SpawnAxis.NZ:
      return new Vector3(Math.round(randInRange(-240, 240)), 15, -240);
    default:
      return new Vector3(240, 15, Math.round(randInRange(-240, 240)));
  }
};
export const isInRange = (val: number, min: number, max: number) => val >= min && val <= max;

export const normalize = (val: number, max: number, min: number) => (val - min) / (max - min);
