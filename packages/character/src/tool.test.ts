import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Character } from '@manifold/core';
import type { Surroundings } from '@manifold/presentation/hands';
import { endOf } from '@manifold/presentation/ik';
import { animate, modelInstance, type ModelInstance } from '@manifold/presentation/models';
import type { Tool } from '@manifold/presentation/tools';

/**
 * WHAT THE MANNEQUIN CARRIES (stage 4c): a tool held in front of the chest along the aim, both hands on
 * its grips by the IK; raised with the aim; swept by a strike. As the page plays it (models.ts), on the
 * model's file, in Node.
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
const standing = (pitch = 0, mode = 'walk') =>
  ({
    mode,
    grounded: true,
    facing: [0, 0, -1],
    pitch,
    wall: [0, 0, 0],
    velocity: [0, 0, 0],
    airJumps: 1,
    holding: 0,
    rolling: 0,
    movement: { roll: { speed: 5, time: 0.6 } },
    ground: { velocity: [0, 0, 0], spin: 0 },
  }) as unknown as Character;

const DART: Tool = { size: [0.04, 0.07, 0.26], color: 0x8fa8c0, grips: [0.04, 0.16], lift: 0, sweep: null };
const STICK: Tool = { size: [0.035, 0.035, 1.2], color: 0xc8a060, grips: [0.06, 0.24], lift: 50, sweep: null };
/** (Stage 5l) A wall across in front, its face at z = `at` (none: no wall), as the surroundings' rays see it. */
const wallAt = (at: number | null) => (from: THREE.Vector3, d: THREE.Vector3, reach: number) => {
  if (at === null || d.z >= -1e-9) return null;
  const t = (at - from.z) / d.z;
  return t >= 0 && t <= reach ? { point: from.clone().addScaledVector(d, t) } : null;
};
const holding = (tool: Tool | null, wall: number | null = null): Surroundings => ({
  ray: () => null,
  wall: wallAt(wall),
  held: null,
  tool,
});

/** `frames` frames standing, aiming at `pitch`, carrying `tool` (a wall in front at z = `wall`, if any). */
function play(copy: ModelInstance, tool: Tool | null, frames: number, pitch = 0, mode = 'walk', wall: number | null = null) {
  for (let i = 0; i < frames; i++) animate(copy, standing(pitch, mode), [0, 1, 0], [0, 0, 0], 0, DT, holding(tool, wall));
  copy.object.updateMatrixWorld(true);
}
const handOf = (copy: ModelInstance, side: 'L' | 'R') => endOf(copy.arms![side], new THREE.Vector3());
/** Where the tool points (its +Z), and how far up that is, in degrees. */
const pointing = (copy: ModelInstance) => new THREE.Vector3(0, 0, 1).applyQuaternion(copy.holding.pose!.rotation);
const above = (v: THREE.Vector3) => THREE.MathUtils.radToDeg(Math.asin(v.y));

describe('what the mannequin carries (stage 4c)', () => {
  test('a dart, in front of the chest along the aim, both hands on it; aiming up, it points up and the hands go with it', () => {
    const copy = modelInstance(model);
    play(copy, DART, 30);
    const pose = copy.holding.pose!;
    expect(copy.hands.R.kind).toBe('tool');
    expect(copy.hands.L.kind).toBe('tool');
    // On its grips, within 2 cm.
    expect(handOf(copy, 'R').distanceTo(pose.grips.R)).toBeLessThan(0.02);
    expect(handOf(copy, 'L').distanceTo(pose.grips.L!)).toBeLessThan(0.02);
    // Level, ahead (−Z), in front of the body.
    expect(pointing(copy).z).toBeCloseTo(-1, 3);
    expect(pose.muzzle.z).toBeLessThan(-0.3);
    // Aiming 30° up (the drawn aim follows within a sixth of a second): 30° up, the hands still on it.
    play(copy, DART, 30, 30);
    expect(above(pointing(copy))).toBeCloseTo(30, 1);
    expect(handOf(copy, 'R').distanceTo(copy.holding.pose!.grips.R)).toBeLessThan(0.02);
    expect(handOf(copy, 'L').distanceTo(copy.holding.pose!.grips.L!)).toBeLessThan(0.02);
  });

  test('the stick: held up at rest; a strike sweeps it from the right to the left, level, and it comes back up', () => {
    const copy = modelInstance(model);
    play(copy, STICK, 30);
    expect(above(pointing(copy))).toBeCloseTo(50, 1);
    play(copy, { ...STICK, sweep: 60 }, 6);
    const right = pointing(copy);
    expect(above(right)).toBeCloseTo(0, 1);
    expect(THREE.MathUtils.radToDeg(Math.atan2(right.x, -right.z))).toBeCloseTo(60, 1);
    // Swept at 600°/s (as the world sweeps it), the drawn one keeps up: 10° a frame.
    for (let a = 50; a >= -50; a -= 10) play(copy, { ...STICK, sweep: a }, 1);
    const left = pointing(copy);
    expect(THREE.MathUtils.radToDeg(Math.atan2(left.x, -left.z))).toBeCloseTo(-50, 1);
    // The right hand stays on it all the way (the left one reaches across as far as it can).
    expect(handOf(copy, 'R').distanceTo(copy.holding.pose!.grips.R)).toBeLessThan(0.02);
    play(copy, STICK, 20);
    expect(above(pointing(copy))).toBeCloseTo(50, 1);
  });

  test('(stage 5l) facing a wall, what it holds stays out of it: raised as little as clears it, drawn back if even raised it does not; with room again, as before', () => {
    const copy = modelInstance(model);
    // Its body keeps 0.3 m from a wall: the wall's face half a meter ahead, nearer than the dart's end.
    play(copy, DART, 30, 0, 'walk', -0.5);
    expect(copy.holding.pose!.muzzle.z).toBeGreaterThanOrEqual(-0.5);
    expect(above(pointing(copy))).toBeGreaterThan(5);
    // The stick, swept level across in front (a strike), at the same wall: its end never in it.
    play(copy, STICK, 30, 0, 'walk', -0.5);
    for (let a = 60; a >= -60; a -= 10) {
      play(copy, { ...STICK, sweep: a }, 1, 0, 'walk', -0.5);
      expect(copy.holding.pose!.muzzle.z).toBeGreaterThanOrEqual(-0.5 - 1e-6);
    }
    // The hands stay on it.
    expect(handOf(copy, 'R').distanceTo(copy.holding.pose!.grips.R)).toBeLessThan(0.03);
    // Room again (the wall three meters off): the dart comes down level, slowly, in a second.
    play(copy, DART, 60, 0, 'walk', -3);
    expect(above(pointing(copy))).toBeCloseTo(0, 1);
  });

  test('nothing carried, or climbing or rolling: no tool, and the hands are free', () => {
    const copy = modelInstance(model);
    play(copy, null, 10);
    expect(copy.holding.pose).toBeNull();
    expect(copy.hands.R.kind).toBeNull();
    play(copy, DART, 10);
    expect(copy.hands.R.kind).toBe('tool');
    play(copy, DART, 10, 0, 'roll');
    expect(copy.holding.pose).toBeNull();
    expect(copy.hands.R.kind).toBeNull();
  });
});
