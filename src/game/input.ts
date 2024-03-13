import { Vector3, type Scene, Quaternion } from '@babylonjs/core';
import { ActionEvent, ActionManager, ExecuteCodeAction } from '@babylonjs/core/Actions';

import type { IMessageInput } from '@/types/interfaces';
import { GameInputType, KeyInputType, type PlayerInputs } from '@/types/types';
import { keyMap } from '@/utils/constants';
import { IndexedQueue } from '@/utils/queue';
import type { LastProcessedInput } from './state';
import type { PlayerTank } from './models/player';

export interface IInputHistory {
  step: number;
  message: IMessageInput;
  transform: {
    position: Vector3;
    rotation: Quaternion;
    turretRotation: Quaternion;
    barrelRotation: Quaternion;
  };
}
export interface IHistoryInfo {
  targetStep: number | undefined;
  history: Record<number, IInputHistory>;
}

export class InputManager {
  static history = new IndexedQueue<number, IInputHistory>([], 'step');
  static keys: PlayerInputs = {};
  private static maxBufferSize = 30;

  static create(scene: Scene) {
    const actionManager = new ActionManager(scene);
    actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (ev: ActionEvent) => {
        const code = ev.sourceEvent.code as KeyInputType;
        if (typeof GameInputType[keyMap[code]] !== 'undefined') InputManager.keys[keyMap[code]] = true;
      })
    );
    actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (ev: ActionEvent) => {
        const code = ev.sourceEvent.code as KeyInputType;
        if (typeof GameInputType[keyMap[code]] !== 'undefined') InputManager.keys[keyMap[code]] = false;
      })
    );
    return actionManager;
  }
  static cull(lastProcessedInput: LastProcessedInput) {
    if (typeof lastProcessedInput?.step === 'undefined') return -1;
    InputManager.history.clearTill(lastProcessedInput.step);
    return lastProcessedInput.step + 1;
  }
  static addHistory(message: IMessageInput, player: PlayerTank, step: number) {
    if (InputManager.history.length >= InputManager.maxBufferSize) {
      InputManager.history.pop();
    }
    InputManager.history.push({
      step,
      message,
      transform: {
        position: player.body.position.clone(),
        rotation: player.body.rotationQuaternion!.clone(),
        turretRotation: player.turret.rotationQuaternion!.clone(),
        barrelRotation: player.barrel.rotationQuaternion!.clone()
      }
    });
  }
  static getHistory(): IHistoryInfo {
    return {
      targetStep: this.history.seekLast()?.step,
      history: this.history.getAll()
    };
  }
}
