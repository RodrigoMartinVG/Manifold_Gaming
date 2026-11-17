import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Character } from '@manifold/core';
import { animate, modelInstance } from '@manifold/presentation/models';

/**
 * THE LANDING BY INERTIA (stage 4b), on the mannequin: from a fall (its arms up and out), a cross-fade
 * of 0.05 s turned its bones at 1495°/s, almost twice the landing's own fastest; by inertia, its pose
 * comes at once and the fall's dies out. Measured as the page draws it, at 60 frames a second.
 */
const files = import.meta.glob<string>('../assets/mannequin.glb', { query: '?inline', import: 'default', eager: true });

let model: { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
beforeAll(async () => {
  const url = files['../assets/mannequin.glb']!;
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  model = { scene: gltf.scene, clips: gltf.animations };
});

const DT = 1 / 60;
const character = (grounded: boolean, vertical: number) =>
  ({
    mode: grounded ? 'walk' : 'air',
    grounded,
    facing: [0, 0, -1],
    pitch: 0,
    wall: [0, 0, 0],
    velocity: [0, vertical, 0],
    airJumps: 1,
    holding: 0,
    rolling: 0,
    movement: { roll: { speed: 5, time: 0.6 } },
    ground: { velocity: [0, 0, 0], spin: 0 },
  }) as unknown as Character;

describe('the landing by inertia (stage 4b)', () => {
  test('from a fall: no snap (the bones turn at half the cross-fade’s speed), and nothing left of the fall once it has died out', () => {
    const copy = modelInstance(model);
    const turns = () => copy.bones.map((b) => b.getWorldQuaternion(new THREE.Quaternion()));
    let before = turns();
    const speeds: number[] = [];
    const frame = (grounded: boolean, vertical: number) => {
      animate(copy, character(grounded, vertical), [0, 1, 0], [0, vertical, 0], 0, DT);
      copy.object.updateMatrixWorld(true);
      const now = turns();
      speeds.push(Math.max(...now.map((q, i) => (q.angleTo(before[i]!) * 180) / Math.PI / DT)));
      before = now;
    };
    // Falling for two thirds of a second, at 9 m/s; then on the ground.
    for (let i = 0; i < 40; i++) frame(false, -9);
    const landed = speeds.length;
    for (let i = 0; i < 40; i++) frame(true, 0);
    expect(copy.gait.started.clip).toBe('land');
    const fastest = Math.max(...speeds.slice(landed, landed + 18));
    expect(fastest).toBeLessThan(800);
    // And once its offsets have died out (0.2 s at most), the pose is the animations' alone.
    expect(copy.inertia.offsets.size).toBe(0);
  });
});
