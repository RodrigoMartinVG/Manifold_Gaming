import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { STEP, type Character } from '@manifold/core';
import { motion, turnBody } from './models';

/** Only what `motion` reads of a character: what carries it. */
const standing = (ground: [number, number, number] = [0, 0, 0]) =>
  ({ ground: { velocity: ground, spin: 0 } }) as unknown as Character;

describe('what the view reads of a character (stage 2e2)', () => {
  test('how it really moved: against a wall, nothing; on a platform, without the platform; put somewhere, nothing', () => {
    // Walking 4.5 m/s: 7.5 cm in a step.
    expect(motion([0, 0, 0], [0, 0, -4.5 * STEP], standing())).toEqual([0, 0, -4.5]);
    // Against a wall it asks for 4.5 m/s and stays: it did not move (its `velocity` would say 4.5).
    expect(motion([5.93, 0.82, -4], [5.93, 0.82, -4], standing())).toEqual([0, 0, 0]);
    // Standing on a platform that goes at 2 m/s: it does not walk.
    const [x] = motion([0, 0, 0], [2 * STEP, 0, 0], standing([2, 0, 0]));
    expect(x).toBeCloseTo(0, 12);
    // Taken to a checkpoint: not a motion.
    expect(motion([0, 0, 0], [8, 1, 5], standing())).toEqual([0, 0, 0]);
  });

  test("the body's turn: a turn at once is drawn quick, a slow one exactly, and it says how fast it turned", () => {
    const up: [number, number, number] = [0, 1, 0];
    const half = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const drawn = new THREE.Quaternion();
    // The world turns it half a turn in a step: drawn, 900°/s at most (15° in a frame at 60 per second).
    const rate = turnBody(drawn, half, up, 1 / 60);
    expect(THREE.MathUtils.radToDeg(drawn.angleTo(new THREE.Quaternion()))).toBeCloseTo(15, 6);
    expect(Math.abs(rate)).toBeCloseTo(900, 3);
    // It gets there in a fifth of a second (180° at 900°/s), and stops turning.
    for (let i = 0; i < 12; i++) turnBody(drawn, half, up, 1 / 60);
    expect(drawn.angleTo(half)).toBeCloseTo(0, 6);
    expect(turnBody(drawn, half, up, 1 / 60)).toBeCloseTo(0, 6);
    // A slow turn (a platform's, 40°/s) is drawn as it is: no lag.
    const slow = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(40 / 60));
    const body = new THREE.Quaternion();
    expect(turnBody(body, slow, up, 1 / 60)).toBeCloseTo(40, 3);
    expect(body.angleTo(slow)).toBeCloseTo(0, 9);
    // Paused, it does not turn.
    const still = new THREE.Quaternion();
    expect(turnBody(still, half, up, 0)).toBe(0);
    expect(still.angleTo(new THREE.Quaternion())).toBe(0);
  });
});
