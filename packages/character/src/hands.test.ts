import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import type { Character, Shape } from '@manifold/core';
import { LET_GO, TAKE, type HoldKind, type Surroundings } from '@manifold/presentation/hands';
import { endOf, rootOf } from '@manifold/presentation/ik';
import { animate, modelInstance, type ModelInstance } from '@manifold/presentation/models';

/**
 * THE MANNEQUIN'S HANDS (stage 4a): climbing a wall, they hold on to it, and to its top when it ends;
 * holding something, they reach for it. Played as the page plays it (models.ts), on the model's file, in
 * Node, against a wall made of rays (what `surroundingsOf` asks the world).
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
/** The wall's face, where a climbing capsule touches it (its radius, 0.3 m, and the controller's gap, 2 cm). */
const FACE = -0.32;
/** How far a hand's socket is from a surface it is on (hands.ts). */
const PALM = 0.03;

/** A wall in front (−Z), from far below up to `top`: rays against a box, its face at z = FACE. */
function wall(top: number): Surroundings {
  const low = new THREE.Vector3(-3, -20, FACE - 1);
  const high = new THREE.Vector3(3, top, FACE);
  const box = new THREE.Box3(low, high);
  return {
    ray(from, direction, reach) {
      const point = new THREE.Ray(from, direction).intersectBox(box, new THREE.Vector3());
      if (!point || point.distanceTo(from) > reach) return null;
      // The face it entered by: the one the point is on.
      const normal = new THREE.Vector3();
      const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
      if (near(point.z, FACE)) normal.set(0, 0, 1);
      else if (near(point.y, top)) normal.set(0, 1, 0);
      else if (near(point.x, 3)) normal.set(1, 0, 0);
      else if (near(point.x, -3)) normal.set(-1, 0, 0);
      else normal.set(0, -1, 0);
      return { point, normal };
    },
    held: null,
  };
}

const climber = (velocity: Vec3, mode = 'climb') =>
  ({
    mode,
    grounded: false,
    facing: [0, 0, -1],
    wall: mode === 'climb' ? [0, 0, -1] : [0, 0, 0],
    velocity,
    airJumps: 0,
    holding: 0,
    ground: { velocity: [0, 0, 0], spin: 0 },
  }) as unknown as Character;

interface Frame {
  y: number;
  hands: Record<
    'L' | 'R',
    {
      kind: HoldKind | null;
      contact: THREE.Vector3 | null;
      weight: number;
      at: THREE.Vector3;
      shoulder: THREE.Vector3;
      phase: number;
    }
  >;
}

/** Climbing at `speed` from y = 0 for `seconds`, against `around`: each frame, what each hand did. */
function climb(copy: ModelInstance, around: Surroundings, speed: number, seconds: number, from = 0): Frame[] {
  const frames: Frame[] = [];
  const character = climber([0, speed, 0]);
  for (let i = 0; i < seconds / DT; i++) {
    const y = from + speed * i * DT;
    copy.object.position.set(0, y, 0);
    copy.object.updateMatrixWorld(true);
    animate(copy, character, [0, 1, 0], [0, speed, 0], 0, DT, around);
    copy.object.updateMatrixWorld(true);
    const hand = (side: 'L' | 'R') => ({
      kind: copy.hands[side].kind,
      contact: copy.hands[side].contact?.clone() ?? null,
      weight: copy.hands[side].weight,
      at: endOf(copy.arms![side], new THREE.Vector3()),
      shoulder: rootOf(copy.arms![side], new THREE.Vector3()),
      phase: copy.gait.climbPhase,
    });
    frames.push({ y, hands: { L: hand('L'), R: hand('R') } });
  }
  return frames;
}

describe("the mannequin's hands (stage 4a)", () => {
  test('climbing, each hand holds on to the wall in its half of the cycle, stays where it took hold, and lets go within reach', () => {
    const copy = modelInstance(model);
    const reach = copy.arms!.L.a + copy.arms!.L.b;
    const frames = climb(copy, wall(50), 2.5, 4);
    const report: string[] = [];
    for (const side of ['L', 'R'] as const) {
      let holds = 0;
      let drift = 0;
      let longest = 0;
      let run = 0;
      for (let i = 1; i < frames.length; i++) {
        const [before, now] = [frames[i - 1]!.hands[side], frames[i]!.hands[side]];
        if (!now.contact) {
          run = 0;
          continue;
        }
        expect(now.kind).toBe('wall');
        // On the wall's face, a palm off it.
        expect(now.contact.z).toBeCloseTo(FACE + PALM, 9);
        // Never kept beyond 1.05 of the reach.
        expect(now.shoulder.distanceTo(now.contact)).toBeLessThanOrEqual(LET_GO * reach + 1e-9);
        if (!before.contact) {
          holds++;
          // Taken within 0.85 of the reach, in the hand's half of the cycle.
          expect(now.shoulder.distanceTo(now.contact)).toBeLessThanOrEqual(TAKE * reach + 1e-9);
          expect(side === 'L' ? now.phase >= 0.5 : now.phase < 0.5).toBe(true);
        } else {
          // Where it took hold, in the world, while the body climbs past it.
          expect(now.contact.distanceTo(before.contact)).toBe(0);
          run++;
          longest = Math.max(longest, run);
        }
        // Its weight all there: the hand on the hold, within the arm's slack (1 cm), and, past full reach,
        // as much short as it is past.
        if (now.weight === 1) {
          const past = Math.max(0, now.shoulder.distanceTo(now.contact) - reach);
          expect(now.at.distanceTo(now.contact)).toBeLessThan(0.0101 + past);
          drift = Math.max(drift, now.at.distanceTo(now.contact) - past);
        }
      }
      report.push(
        `${side}: ${holds} holds, held up to ${((longest * DT * 2.5 * 100) | 0) / 100} m of climbing, the hand within ${(drift * 1000).toFixed(1)} mm (past full reach, less what is past)`,
      );
      // Four seconds at 2.5 m/s, a cycle every 2 m: five cycles, a hold in each.
      expect(holds).toBeGreaterThanOrEqual(4);
      expect(longest * DT * 2.5).toBeGreaterThan(0.5);
    }
    console.log(report.join('\n'));
  });

  test('at the top of the wall, both hands hold its edge (a ledge); still on the wall, both hold it', () => {
    const copy = modelInstance(model);
    // The wall ends at 2 m: the shoulders (0.4 m above the center) come to it.
    const frames = climb(copy, wall(2), 2.5, 1.2, 0.5);
    const ledge = frames.filter((f) => f.hands.L.kind === 'ledge' && f.hands.R.kind === 'ledge');
    expect(ledge.length).toBeGreaterThan(3);
    for (const f of ledge)
      for (const side of ['L', 'R'] as const) {
        const { contact } = f.hands[side];
        // On its top, a palm above it and a palm back from its face.
        expect(contact!.y).toBeCloseTo(2 + PALM, 9);
        expect(contact!.z).toBeCloseTo(FACE - 0.05 + PALM, 9);
      }
    // Still (on the wall, not moving): both hands on it.
    const still = modelInstance(model);
    const around = wall(50);
    const character = climber([0, 0, 0]);
    for (let i = 0; i < 30; i++) {
      still.object.position.set(0, 1, 0);
      still.object.updateMatrixWorld(true);
      animate(still, character, [0, 1, 0], [0, 0, 0], 0, DT, around);
    }
    expect([still.hands.L.kind, still.hands.R.kind]).toEqual(['wall', 'wall']);
    expect([still.hands.L.weight, still.hands.R.weight]).toEqual([1, 1]);
    // Off the wall (falling), they let go, and their weight goes in a fraction of a second.
    const falling = climber([0, -3, 0], 'air');
    for (let i = 0; i < 12; i++) animate(still, falling, [0, 1, 0], [0, -3, 0], 0, DT, around);
    expect([still.hands.L.kind, still.hands.R.kind]).toEqual([null, null]);
    expect([still.hands.L.weight, still.hands.R.weight]).toEqual([0, 0]);
  });

  test('holding something, the arms reach for its sides (it is held 0.95 m ahead: farther than they reach)', () => {
    const copy = modelInstance(model);
    const box = {
      center: new THREE.Vector3(0, 0.2, -0.95),
      rotation: new THREE.Quaternion(),
      shape: { kind: 'box', halfExtents: [0.2, 0.2, 0.2] } as Shape,
    };
    const around: Surroundings = { ray: () => null, held: box };
    const character = climber([0, 0, 0], 'walk');
    (character as { grounded: boolean }).grounded = true;
    for (let i = 0; i < 12; i++) {
      copy.object.updateMatrixWorld(true);
      animate(copy, character, [0, 1, 0], [0, 0, 0], 0, DT, around);
    }
    for (const [side, sign] of [
      ['L', -1],
      ['R', 1],
    ] as const) {
      const hand = copy.hands[side];
      expect(hand.kind).toBe('held');
      expect(hand.weight).toBe(1);
      expect(hand.contact!.toArray()).toEqual([sign * (0.2 + PALM), 0.2, -0.95]);
      // The arm points at it, as far as it goes: short of it by what it cannot reach.
      const shoulder = rootOf(copy.arms![side], new THREE.Vector3());
      const at = endOf(copy.arms![side], new THREE.Vector3());
      expect(at.clone().sub(shoulder).angleTo(hand.contact!.clone().sub(shoulder))).toBeLessThan(1e-6);
      expect(hand.ratio).toBeGreaterThan(1.6);
    }
  });
});
