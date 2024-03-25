import { TextBlock } from '@babylonjs/gui';

import { clamp } from '@/utils/utils';
import type { World } from './main';
import { InputManager } from './input';

export class Monitor {
  private static handle = -1;
  private static _interval = 200;
  static set interval(ms: number) {
    Monitor._interval = clamp(ms, 500, Number.MAX_SAFE_INTEGER);
  }
  static get interval(): number {
    return Monitor._interval;
  }

  static start(world: World) {
    Monitor.handle = setInterval(() => {
      if (world.vsAI) {
        /* const enemy = Object.values(world.players).find((tank) => tank.lid === 'Enemy')! as EnemyAITank;

        world.gui &&
          ((world.gui.getControlByName('stats') as TextBlock).text = `\n
          CBarrelAngle: ${enemy.currentBarrelAngleD}\n
          TBarrelAngle: ${enemy.targetBarrelAngleD}\n
          LeadAngle: ${enemy.leadAngleD}\n
          TurretDelta: ${enemy.deltaTurretAngleD}\n
          BarrelDelta: ${enemy.deltaBarrelAngleD}\n
          BarrelInfo: ${enemy.barrelInfoAngleD}\n
          BarrelInfoOrient: ${enemy.barrelInfoOrientD}`); */
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
