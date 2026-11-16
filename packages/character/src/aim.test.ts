import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Character } from '@manifold/core';
import { AIM_SPINE, animate, modelInstance, type ModelInstance } from '@manifold/presentation/models';

/**
 * THE AIM, SHOWN (stage 4b): the body faces along the ground, and the pitch is spread over the spine and
 * the head. Measured on the mannequin's file, in Node, as the page draws it.
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

const standing = (pitch: number) =>
  ({
    mode: 'walk',
    grounded: true,
    facing: [0, 0, -1],
    pitch,
    wall: [0, 0, 0],
    velocity: [0, 0, 0],
    airJumps: 0,
    holding: 0,
    ground: { velocity: [0, 0, 0], spin: 0 },
  }) as unknown as Character;

/** A bone's turn in the world. */
const turnOf = (copy: ModelInstance, name: string) => {
  copy.object.updateMatrixWorld(true);
  return copy.object.getObjectByName(name)!.getWorldQuaternion(new THREE.Quaternion());
};

/** How far above the ground a direction is (degrees). */
const elevation = (v: THREE.Vector3) => THREE.MathUtils.radToDeg(Math.asin(v.y));

describe('the aim, shown (stage 4b)', () => {
  test('the head looks where it aims, the chest part of the way; the hips and the legs stay as they were', () => {
    const BONES = ['head_socket', 'spine', 'hips', 'shin_L'] as const;
    const pose = (pitch: number) => {
      const copy = modelInstance(model);
      for (let i = 0; i < 60; i++) animate(copy, standing(pitch), [0, 1, 0], [0, 0, 0], 0, DT);
      return Object.fromEntries(BONES.map((b) => [b, turnOf(copy, b)])) as Record<(typeof BONES)[number], THREE.Quaternion>;
    };
    // In each bone's own frame, the direction that is the body's front when it aims level; aimed, where
    // that direction goes: up or down by as much as the bone was turned.
    const level = pose(0);
    const front = (b: (typeof BONES)[number]) => new THREE.Vector3(0, 0, -1).applyQuaternion(level[b].clone().invert());
    const tilt = (aimed: ReturnType<typeof pose>, b: (typeof BONES)[number]) =>
      elevation(front(b).applyQuaternion(aimed[b])) - elevation(front(b).applyQuaternion(level[b]));
    for (const pitch of [-40, 30, 60]) {
      const aimed = pose(pitch);
      expect(tilt(aimed, 'head_socket')).toBeCloseTo(pitch, 6);
      expect(tilt(aimed, 'spine')).toBeCloseTo(AIM_SPINE * pitch, 6);
      expect(aimed.hips.angleTo(level.hips)).toBeCloseTo(0, 9);
      expect(aimed.shin_L.angleTo(level.shin_L)).toBeCloseTo(0, 9);
    }
  });

  test('the drawn aim follows the world’s at 720°/s: a flick is quick, not a jump; paused, it stays', () => {
    const copy = modelInstance(model);
    animate(copy, standing(30), [0, 1, 0], [0, 0, 0], 0, DT);
    expect(copy.aim.pitch).toBeCloseTo(12, 9);
    animate(copy, standing(30), [0, 1, 0], [0, 0, 0], 0, DT);
    expect(copy.aim.pitch).toBeCloseTo(24, 9);
    animate(copy, standing(30), [0, 1, 0], [0, 0, 0], 0, 0);
    expect(copy.aim.pitch).toBeCloseTo(24, 9);
    animate(copy, standing(30), [0, 1, 0], [0, 0, 0], 0, DT);
    expect(copy.aim.pitch).toBe(30);
  });
});
