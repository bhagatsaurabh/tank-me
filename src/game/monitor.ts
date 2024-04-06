import { TextBlock } from '@babylonjs/gui';

import { clamp } from '@/utils';
import type { World } from './main';
import { InputManager } from './input';

export class Monitor {
  private static handle = -1;
  private static _interval = 200;
  private static enabled = false;
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
          Config: ${world.config.id}
          Optimize Count: ${world.optimizeCount}
          Hardware Scaling: ${world.engine.getHardwareScalingLevel()}
          Priority Level: ${world.optimizer.currentPriorityLevel}
          Current FPS: ${world.optimizer.currentFrameRate}
          Target FPS: ${world.optimizer.targetFrameRate}`);
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
