import { TextBlock } from '@babylonjs/gui';

import { clamp } from '@/utils/utils';
import type { World } from './main';
import { InputManager } from './input';

export class Monitor {
  private static handle = -1;
  private static _interval = 1000;
  static set interval(ms: number) {
    Monitor._interval = clamp(ms, 500, Number.MAX_SAFE_INTEGER);
  }
  static get interval(): number {
    return Monitor._interval;
  }

  static start(world: World) {
    Monitor.handle = setInterval(() => {
      world.gui &&
        ((world.gui.getControlByName('stats') as TextBlock).text =
          `Interpolation Buffer: ${InputManager.history.length}`);
    }, this._interval);
  }
  static stop() {
    clearInterval(Monitor.handle);
  }
}
