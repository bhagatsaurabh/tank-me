import { type Vector3 } from '@babylonjs/core/Maths';
import { LinesMesh, Mesh, MeshBuilder } from '@babylonjs/core/Meshes';

export class Debug {
  static meshes: Record<string, Mesh> = {};

  static drawLine(id: string, points: Vector3[], updatable = true) {
    const mesh = MeshBuilder.CreateLines(id, { points, updatable });
    Debug.meshes[id] = mesh;
    return mesh;
  }
  static updateLine(id: string, points: Vector3[]) {
    Debug.meshes[id] = MeshBuilder.CreateLines(id, { points, instance: Debug.meshes[id] as LinesMesh });
  }
}
