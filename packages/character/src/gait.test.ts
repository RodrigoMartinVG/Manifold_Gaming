import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import type { Character } from '@manifold/core';
import { FOOTING, STRIDES } from '@manifold/presentation/locomotion';
import { animate, modelInstance } from '@manifold/presentation/models';

/**
 * THE MANNEQUIN'S FEET (after the tutorial's pass): played as the presentation plays it (models.ts: the gait's weights
 * and phases, on the model's own animations), a foot on the ground stays where it is while the body
 * goes on, walking and running, forward, back, to each side and in between. Measured on the file, in
 * Node, with three.js's own loader and mixer: what the page draws.
 */
const files = import.meta.glob<string>('../assets/mannequin.glb', { query: '?inline', import: 'default', eager: true });

let model: { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
beforeAll(async () => {
  const url = files['../assets/mannequin.glb']!;
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  model = { scene: gltf.scene, clips: gltf.animations };
});

/** The floor, under the model's origin (the capsule's center): where its feet stand still. */
const FLOOR = -0.8;
/** A foot within this of the floor is on it. */
const ON = 0.002;
/** A frame at 60 per second. */
const DT = 1 / 60;

/** Where a foot is (the bottom of its shin, 0.36 m down it), in the world. */
function sole(object: THREE.Object3D, side: 'L' | 'R'): THREE.Vector3 {
  const shin = object.getObjectByName(`shin_${side}`)!;
  return new THREE.Vector3(0, 0.36, 0).applyMatrix4(shin.matrixWorld);
}

/** A velocity on the ground, `degrees` from where it looks (−Z; to its right, positive). */
const at = (speed: number, degrees: number): Vec3 => {
  const r = (degrees * Math.PI) / 180;
  return [speed * Math.sin(r), 0, -speed * Math.cos(r)];
};

/**
 * Walking at `velocity` for 1.5 s (its weights settle), then 3 s more, the model carried along as the
 * page carries it: how fast the foot on the ground slides (m/s, along the ground, in the world), on
 * average and at most; how much of the time a foot is on the ground; and how far, at most, the view held
 * a foot that was down from where the cycles' feet, mixed, had gone (feet.ts).
 */
function slide(velocity: Vec3, mode = 'walk') {
  const copy = modelInstance(model);
  const character = {
    mode,
    grounded: true,
    facing: [0, 0, -1],
    pitch: 0,
    velocity,
    jump: { pending: 0, held: false, air: 0, inAir: 0, rising: false, hung: 0 },
    ground: { velocity: [0, 0, 0], spin: 0 },
  } as unknown as Character;
  const speeds: number[] = [];
  let frames = 0;
  let held = 0;
  let before = null as { side: 'L' | 'R'; at: THREE.Vector3 } | null;
  for (let i = 0; i < 270; i++) {
    const t = i * DT;
    copy.object.position.set(velocity[0] * t, 0, velocity[2] * t);
    animate(copy, character, [0, 1, 0], velocity, 0, DT);
    copy.object.updateMatrixWorld(true);
    const l = sole(copy.object, 'L');
    const r = sole(copy.object, 'R');
    const side = l.y < r.y ? 'L' : 'R';
    const foot = side === 'L' ? l : r;
    const down = foot.y < FLOOR + ON;
    if (i >= 90) {
      for (const s of ['L', 'R'] as const) if (copy.feet[s].planted) held = Math.max(held, copy.feet[s].held);
      if (down) frames++;
      if (down && before?.side === side) speeds.push(Math.hypot(foot.x - before.at.x, foot.z - before.at.z) / DT);
    }
    before = down ? { side, at: foot } : null;
  }
  const mean = speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length);
  return { mean, most: Math.max(0, ...speeds), down: frames / 180, held };
}

describe("the mannequin's feet (after the tutorial's pass)", () => {
  test('a foot on the ground stays where it is: walking and running, every way', () => {
    const report: string[] = [];
    for (const [pace, speed] of [
      ['walk', 4.5],
      ['run', 7.5],
    ] as const)
      for (const degrees of [0, 30, -30, 45, -45, 90, -90, 135, -135, 180]) {
        const { mean, most, down, held } = slide(at(speed, degrees));
        const where = `${pace} at ${degrees}°: ${(mean * 100).toFixed(2)} cm/s (at most ${(most * 100).toFixed(1)}), down ${(down * 100).toFixed(0)}%, held ${(held * 100).toFixed(1)} cm`;
        report.push(where);
        // A foot is down about half the time (each one a quarter of the cycle), and does not slide (the
        // most: the frame it lifts, a couple of millimeters up).
        expect(down, where).toBeGreaterThan(0.45);
        expect(mean, where).toBeLessThan(0.02);
        expect(most, where).toBeLessThan(0.15);
        // And the view barely had to hold it there: the cycles, their strides and their weights already
        // keep the mixed foot within a centimeter of where it came down.
        expect(held, where).toBeLessThan(0.01);
      }
    console.log(report.join('\n'));
  });

  test('crouched (stage 4b), a foot on the ground stays where it is too: at 2 m/s, every way', () => {
    for (const degrees of [0, 30, -45, 90, -90, 135, 180]) {
      const { mean, most, down, held } = slide(at(2, degrees), 'crouch');
      const where = `crouched at ${degrees}°: ${(mean * 100).toFixed(2)} cm/s (at most ${(most * 100).toFixed(1)}), down ${(down * 100).toFixed(0)}%, held ${(held * 100).toFixed(1)} cm`;
      expect(down, where).toBeGreaterThan(0.45);
      expect(mean, where).toBeLessThan(0.02);
      expect(most, where).toBeLessThan(0.15);
      expect(held, where).toBeLessThan(0.01);
    }
  });

  test('paused, the feet stay as they are, and so do the legs (to a micron)', () => {
    const copy = modelInstance(model);
    const velocity = at(4.5, 30);
    const character = {
      mode: 'walk',
      grounded: true,
      facing: [0, 0, -1],
      pitch: 0,
      velocity,
      jump: { pending: 0, held: false, air: 0, inAir: 0, rising: false, hung: 0 },
      ground: { velocity: [0, 0, 0], spin: 0 },
    } as unknown as Character;
    for (let i = 0; i < 100; i++) {
      copy.object.position.set(velocity[0] * i * DT, 0, velocity[2] * i * DT);
      animate(copy, character, [0, 1, 0], velocity, 0, DT);
    }
    copy.object.updateMatrixWorld(true);
    const before = [sole(copy.object, 'L'), sole(copy.object, 'R')];
    const planted = [copy.feet.L.planted?.clone() ?? null, copy.feet.R.planted?.clone() ?? null];
    for (let i = 0; i < 10; i++) animate(copy, character, [0, 1, 0], velocity, 0, 0);
    copy.object.updateMatrixWorld(true);
    expect(sole(copy.object, 'L').distanceTo(before[0]!)).toBeLessThan(1e-6);
    expect(sole(copy.object, 'R').distanceTo(before[1]!)).toBeLessThan(1e-6);
    expect([copy.feet.L.planted, copy.feet.R.planted]).toEqual(planted);
  });

  test("the strides the presentation plays are the model's: how far a foot on the ground goes back in a cycle", () => {
    for (const [family, stride] of Object.entries(STRIDES))
      for (const [clip, expected] of [
        [family, stride.forward],
        [`${family}_back`, stride.back],
        [`${family}_right`, stride.side],
        [`${family}_left`, stride.side],
      ] as const) {
        // The clip alone, a sixteenth of a cycle on either side of the middle of the right foot's time on
        // the ground (a quarter of the cycle, around 0.25): how far that foot went, times eight.
        const copy = modelInstance(model);
        for (const action of copy.actions.values()) action.setEffectiveWeight(action.getClip().name === clip ? 1 : 0);
        const action = copy.actions.get(clip)!;
        const footAt = (phase: number) => {
          action.time = phase * action.getClip().duration;
          copy.mixer.update(0);
          copy.object.updateMatrixWorld(true);
          return sole(copy.object, 'R');
        };
        const { L, R } = FOOTING.middle;
        const a = footAt(R - 1 / 16);
        const b = footAt(R + 1 / 16);
        expect(a.y, `${clip}: down`).toBeCloseTo(FLOOR, 2);
        expect(b.y, `${clip}: down`).toBeCloseTo(FLOOR, 2);
        expect((Math.hypot(b.x - a.x, b.z - a.z) * 16) / 2, clip).toBeCloseTo(expected, 2);
        // When each foot is down is the presentation's `FOOTING` (feet.ts plants it then): the right one
        // around 0.25, the left one around 0.75, and the other one up meanwhile.
        const left = (phase: number) => {
          footAt(phase);
          return sole(copy.object, 'L').y;
        };
        expect(left(L - 1 / 16), `${clip}: the left foot down`).toBeCloseTo(FLOOR, 2);
        expect(left(L + 1 / 16), `${clip}: the left foot down`).toBeCloseTo(FLOOR, 2);
        expect(left(R), `${clip}: the left foot up`).toBeGreaterThan(FLOOR + 0.03);
        expect(footAt(L).y, `${clip}: the right foot up`).toBeGreaterThan(FLOOR + 0.03);
      }
  });
});
