import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Character } from '@manifold/core';
import { animate, flinch, modelInstance } from '@manifold/presentation/models';

/** A HIT, DRAWN (stage 4c): the spine's spring, on the mannequin, as the page draws it. */
const files = import.meta.glob<string>('../assets/mannequin.glb', { query: '?inline', import: 'default', eager: true });

let model: { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
beforeAll(async () => {
  const url = files['../assets/mannequin.glb']!;
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  model = { scene: gltf.scene, clips: gltf.animations };
});

const DT = 1 / 60;
const standing = {
  mode: 'walk',
  grounded: true,
  facing: [0, 0, -1],
  pitch: 0,
  wall: [0, 0, 0],
  velocity: [0, 0, 0],
  airJumps: 1,
  holding: 0,
  rolling: 0,
  movement: { roll: { speed: 5, time: 0.6 } },
  ground: { velocity: [0, 0, 0], spin: 0 },
} as unknown as Character;

describe('a hit, drawn (stage 4c)', () => {
  test('hit from the front, the chest swings back, about ten degrees, and settles within a second and a half', () => {
    const hit = modelInstance(model);
    const quiet = modelInstance(model);
    const spine = (m: ReturnType<typeof modelInstance>) =>
      m.object.getObjectByName('spine')!.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 30; i++) {
      animate(hit, standing, [0, 1, 0], [0, 0, 0], 0, DT);
      animate(quiet, standing, [0, 1, 0], [0, 0, 0], 0, DT);
    }
    // A hit of 20 points or more, going towards +Z (it looks at −Z: from in front of it).
    flinch(hit, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), 25);
    const angles: number[] = [];
    let backward = 0;
    for (let i = 0; i < 90; i++) {
      animate(hit, standing, [0, 1, 0], [0, 0, 0], 0, DT);
      animate(quiet, standing, [0, 1, 0], [0, 0, 0], 0, DT);
      hit.object.updateMatrixWorld(true);
      quiet.object.updateMatrixWorld(true);
      angles.push(THREE.MathUtils.radToDeg(spine(hit).angleTo(spine(quiet))));
      // Which way: its up, leaning to +Z (back).
      if (i === 5)
        backward =
          new THREE.Vector3(0, 1, 0).applyQuaternion(spine(hit)).z - new THREE.Vector3(0, 1, 0).applyQuaternion(spine(quiet)).z;
    }
    const peak = Math.max(...angles);
    expect(peak).toBeGreaterThan(7);
    expect(peak).toBeLessThan(14);
    expect(angles.indexOf(peak)).toBeLessThan(10);
    expect(backward).toBeGreaterThan(0);
    expect(angles.at(-1)!).toBeLessThan(0.5);
    // A small hit, a small swing.
    const small = modelInstance(model);
    for (let i = 0; i < 30; i++) animate(small, standing, [0, 1, 0], [0, 0, 0], 0, DT);
    flinch(small, new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0), 2);
    expect(small.flinch.speed).toBeCloseTo(0.4, 9);
  });
});
