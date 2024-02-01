import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  CreatePlane
} from '@babylonjs/core';

import { useLobbyStore } from '@/stores/lobby';

export class TankMe {
  constructor(canvas: HTMLCanvasElement) {
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);
    const lobby = useLobbyStore();

    const ground = CreatePlane('ground', { size: 500 }, scene);
    ground.position.y = -15;
    ground.rotation.x = Math.PI / 2;

    const camera: ArcRotateCamera = new ArcRotateCamera(
      'Camera',
      Math.PI / 2,
      Math.PI / 2,
      2,
      Vector3.Zero(),
      scene
    );
    camera.attachControl(canvas, true);
    const light1: HemisphericLight = new HemisphericLight('light1', new Vector3(1, 1, 0), scene);

    scene.onPointerDown = (event, pointer) => {
      if (event.button == 0 && pointer.pickedPoint) {
        const targetPosition = pointer.pickedPoint.clone();

        targetPosition.y = -1;
        if (targetPosition.x > 245) targetPosition.x = 245;
        else if (targetPosition.x < -245) targetPosition.x = -245;
        if (targetPosition.z > 245) targetPosition.z = 245;
        else if (targetPosition.z < -245) targetPosition.z = -245;

        lobby.gameRoom?.send('updatePosition', {
          x: targetPosition.x,
          y: targetPosition.y,
          z: targetPosition.z
        });
      }
    };
    window.addEventListener('keydown', (ev) => {
      // Shift+Ctrl+Alt
      if (ev.shiftKey && ev.ctrlKey && ev.altKey) {
        ev.preventDefault();
        ev.stopPropagation();
        if (scene.debugLayer.isVisible()) {
          scene.debugLayer.hide();
        } else {
          scene.debugLayer.show();
        }
      }
    });

    scene.registerBeforeRender(() => {
      for (const sessionId in lobby.playerEntities) {
        const entity = lobby.playerEntities[sessionId];
        const targetPosition = lobby.playerNextPosition[sessionId];
        entity.position = Vector3.Lerp(entity.position, targetPosition, 0.05);
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
    });
  }
}
