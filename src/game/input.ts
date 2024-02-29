import { GameInputType, KeyInputType } from '@/types/types';
import { keyMap } from '@/utils/constants';
import { type Scene } from '@babylonjs/core';
import { ActionEvent, ActionManager, ExecuteCodeAction } from '@babylonjs/core/Actions';

export class InputManager {
  static keys: Partial<Record<GameInputType, boolean>> = {};

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
}
