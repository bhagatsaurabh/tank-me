import { LinesMesh, Mesh, MeshBuilder, type Vector3 } from '@babylonjs/core';

export class Debug {
  static meshes: Record<string, Mesh> = {};

  static drawLine(id: string, points: Vector3[], updatable = true) {
    const mesh = MeshBuilder.CreateLines(id, { points, updatable });
    Debug.meshes[id] = mesh;
  }
  static updateLine(id: string, points: Vector3[]) {
    Debug.meshes[id] = MeshBuilder.CreateLines(id, { points, instance: Debug.meshes[id] as LinesMesh });
  }
}
