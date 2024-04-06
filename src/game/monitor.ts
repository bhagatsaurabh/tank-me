import { TextBlock } from '@babylonjs/gui';

import { clamp } from '@/utils';
import type { World } from './main';
import { InputManager } from './input';

export class Monitor {
  private static handle = -1;
  private static _interval = 200;
  private static enabled = true;
  static set interval(ms: number) {
    Monitor._interval = clamp(ms, 500, Number.MAX_SAFE_INTEGER);
  }
  static get interval(): number {
    return Monitor._interval;
  }

  static start(world: World) {
    if (!this.enabled) return;

    Monitor.handle = setInterval(() => {
      if (world.isDestroyed) {
        this.stop();
        return;
      }

      if (world.vsAI) {
        world.gui &&
          ((world.gui.getControlByName('stats') as TextBlock).text = `\n
          Optimize Count: ${world.optimizeCount}\n
          Hardware Scaling: ${world.engine.getHardwareScalingLevel()}\n
          Priority Level: ${world.optimizer.currentPriorityLevel}\n
          Curret FPS: ${world.optimizer.currentFrameRate}\n
          Curret FPS: ${world.optimizer.targetFrameRate}`);
      } else {
        world.gui &&
          ((world.gui.getControlByName('stats') as TextBlock).text = `\n
          History Buffer: ${InputManager.history.length}\n
          Step: ${world.scene.getStepId()}\n
          Health: ${world.player.state!.health}`);
      }
    }, this._interval);
  }
  static stop() {
    clearInterval(Monitor.handle);
  }
}
