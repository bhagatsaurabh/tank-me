import type { IMessageInput } from '@/types/interfaces';
import { GameInputType, KeyInputType, type PlayerInputs } from '@/types/types';
import { keyMap } from '@/utils/constants';
import { IndexedQueue } from '@/utils/queue';
import { type Scene } from '@babylonjs/core';
import { ActionEvent, ActionManager, ExecuteCodeAction } from '@babylonjs/core/Actions';
import type { LastProcessedInput } from './state';

export class InputManager {
  static history = new IndexedQueue<number, IMessageInput>([], 'seq');
  static keys: PlayerInputs = {};

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
    if (!lastProcessedInput?.seq) return;
    InputManager.history.clearTill(lastProcessedInput.seq);
  }
}
