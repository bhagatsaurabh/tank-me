import { ActionEvent, ActionManager, ExecuteCodeAction, type Scene } from '@babylonjs/core';

export class InputManager {
  private static keyInputSet = new Set<string>([
    'KeyW',
    'KeyS',
    'KeyA',
    'KeyD',
    'ShiftLeft',
    'ShiftRight',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ControlLeft',
    'ControlRight',
    'KeyR',
    'Space',
    'KeyV'
  ]);
  static map: Record<string, boolean> = {};

  static init(scene: Scene) {
    const actionManager = new ActionManager(scene);
    actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (ev: ActionEvent) => {
        if (this.keyInputSet.has(ev.sourceEvent.code)) InputManager.map[ev.sourceEvent.code] = true;
      })
    );
    actionManager.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (ev: ActionEvent) => {
        if (this.keyInputSet.has(ev.sourceEvent.code)) InputManager.map[ev.sourceEvent.code] = false;
      })
    );
    return actionManager;
  }
}
