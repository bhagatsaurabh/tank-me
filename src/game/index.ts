import '@babylonjs/core/Debug/debugLayer';
import '@babylonjs/inspector';
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  Mesh,
  MeshBuilder
} from '@babylonjs/core';

export class TankMe {
  constructor(canvas: HTMLCanvasElement) {
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);

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
    const sphere: Mesh = MeshBuilder.CreateSphere('sphere', { diameter: 1 }, scene);

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

    engine.runRenderLoop(() => {
      scene.render();
    });
  }
}
