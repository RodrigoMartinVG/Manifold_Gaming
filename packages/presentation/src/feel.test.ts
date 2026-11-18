import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { blastEffect, flameEffect, impactEffect, muzzleEffect } from './effects';
import { colorAt, type Stop } from './particles';
import { cadenceAt, dipAt, SWAY, swayAt } from './sway';
import { heardFrom, impulseResponse, passedBy, SPEED_OF_SOUND } from './synth';

/** A source of randomness that gives the same numbers every run. */
const seeded =
  (seed = 1) =>
  () =>
    (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32;

/** Explosions, sounds and the walk's sway as numbers (stage 5k, decision 0031). */
describe('how a sound arrives', () => {
  test('near, all of it and every high; at the edge of its reach, nothing; past it, not heard', () => {
    expect(heardFrom(0, 40)).toEqual({ dry: 1, wet: 1, cutoff: 18000, delay: 0 });
    expect(heardFrom(40, 40)).toBeNull();
    expect(heardFrom(50, 40)).toBeNull();
  });

  test('halfway, the direct sound a quarter, the echo at 0.71: far away, mostly echo; and late, at 343 m/s', () => {
    const h = heardFrom(20, 40)!;
    expect(h.dry).toBeCloseTo(0.25, 9);
    expect(h.wet).toBeCloseTo(Math.SQRT1_2, 9);
    expect(h.cutoff).toBeCloseTo(700 + 17300 / 4, 6);
    expect(h.delay).toBeCloseTo(20 / SPEED_OF_SOUND, 9);
    // A blast 34.3 m away is heard a tenth of a second after it is seen.
    expect(heardFrom(34.3, 60)!.delay).toBeCloseTo(0.1, 9);
  });

  test('the farther, the duller: the air takes the highs off as the distance grows', () => {
    const cutoffs = [0, 5, 10, 20, 30, 39].map((d) => heardFrom(d, 40)!.cutoff);
    for (let i = 1; i < cutoffs.length; i++) expect(cutoffs[i]).toBeLessThan(cutoffs[i - 1]!);
  });
});

describe('a shot going by', () => {
  test('passing a meter from the ears, a meter; one that struck before it got past (at the ears, or short of them), none', () => {
    const ears = [0, 1.5, 0];
    expect(passedBy([-10, 1.5, 1], [10, 1.5, 1], ears)!.distance).toBeCloseTo(1, 12);
    expect(passedBy([-10, 1.5, 1], [10, 1.5, 1], ears)!.point).toEqual([0, 1.5, 1]);
    expect(passedBy([-10, 1.5, 0], [0, 1.5, 0], ears)).toBeNull();
    expect(passedBy([-10, 1.5, 1], [-5, 1.5, 1], ears)).toBeNull();
    // Fired from beside the ears, away: its nearest point is its start.
    expect(passedBy([0, 1.5, 2], [0, 1.5, 12], ears)!.distance).toBeCloseTo(2, 12);
  });
});

describe('what a place gives back', () => {
  const energy = (d: Float32Array, from: number, to: number) => {
    let e = 0;
    for (let i = Math.floor(from * d.length); i < Math.floor(to * d.length); i++) e += d[i]! * d[i]!;
    return e;
  };

  test('its tail falls by more than 50 dB from its first tenth to its last, each tenth below the one before', () => {
    const [left] = impulseResponse(8000, 1.6, seeded(3));
    expect(left.length).toBe(Math.round(8000 * 1.6));
    const tenths = Array.from({ length: 10 }, (_, k) => energy(left, k / 10, (k + 1) / 10));
    for (let k = 1; k < 10; k++) expect(tenths[k]).toBeLessThan(tenths[k - 1]!);
    expect(tenths[9]! / tenths[0]!).toBeLessThan(1e-5);
  });

  test('the two ears hear different echoes: wide, not in the middle of the head', () => {
    const [l, r] = impulseResponse(8000, 1, seeded(5));
    let lr = 0;
    let ll = 0;
    let rr = 0;
    for (let i = 0; i < l.length; i++) {
      lr += l[i]! * r[i]!;
      ll += l[i]! * l[i]!;
      rr += r[i]! * r[i]!;
    }
    expect(Math.abs(lr / Math.sqrt(ll * rr))).toBeLessThan(0.3);
  });
});

describe('a blast, seen', () => {
  const at = new THREE.Vector3(1, 2, 3);

  test('a flash, a fireball, sparks, embers and smoke; on the ground, also its ring, its dust and a scorch', () => {
    const air = blastEffect(at, 3.5, null, seeded());
    const ground = blastEffect(at, 3.5, { y: 2 }, seeded());
    const kinds = (e: ReturnType<typeof blastEffect>) => [...e.adds, ...e.covers].map((p) => p.kind);
    expect(kinds(air).filter((k) => k === 'flash')).toHaveLength(1);
    expect(kinds(air)).not.toContain('ring');
    expect(kinds(air)).not.toContain('scorch');
    expect(kinds(ground).filter((k) => k === 'ring')).toHaveLength(1);
    expect(kinds(ground).filter((k) => k === 'scorch')).toHaveLength(1);
    expect(ground.covers.length).toBeGreaterThan(air.covers.length + 10);
    expect(air.adds.filter((p) => p.kind === 'spark').length).toBeGreaterThanOrEqual(20);
  });

  test('the fireball is gone in well under a second, the smoke lasts seconds and rises; the scorch stays a dozen', () => {
    const e = blastEffect(at, 3.5, { y: 2 }, seeded());
    const fire = e.adds.filter((p) => p.kind === 'puff' && p.drag === 7);
    expect(fire.length).toBeGreaterThan(10);
    for (const p of fire) expect(p.life).toBeLessThan(0.7);
    const smoke = e.covers.filter((p) => p.kind === 'puff' && (p.gravity ?? 0) < -0.5);
    expect(smoke.length).toBeGreaterThan(10);
    for (const p of smoke) expect(p.life).toBeGreaterThanOrEqual(2);
    expect(e.covers.find((p) => p.kind === 'scorch')!.life).toBe(12);
  });

  test('as large as its radius: twice the radius, twice the ball and the smoke', () => {
    const small = blastEffect(at, 3.5, null, seeded(7));
    const large = blastEffect(at, 7, null, seeded(7));
    const largest = (e: ReturnType<typeof blastEffect>) => Math.max(...e.covers.map((p) => p.size[1]));
    expect(largest(large) / largest(small)).toBeCloseTo(2, 6);
    expect(large.adds[0]!.size[1] / small.adds[0]!.size[1]).toBeCloseTo(2, 6);
  });

  test('its fire burns brighter than white at first (the glow blooms it), and fades to nothing', () => {
    const fire = blastEffect(at, 3.5, null, seeded()).adds.find((p) => p.drag === 7)!;
    const c: [number, number, number, number] = [0, 0, 0, 0];
    expect(colorAt(fire.stops, 0, c)[0]).toBeGreaterThan(1);
    expect(colorAt(fire.stops, 1, c)[3]).toBe(0);
  });

  test('a shotgun throws sparks from its flash, a dart only flashes; both leave a breath of smoke', () => {
    const forward = new THREE.Vector3(0, 0, -1);
    expect(muzzleEffect(at, forward, 0.34, seeded()).adds.filter((p) => p.kind === 'spark').length).toBeGreaterThan(0);
    expect(muzzleEffect(at, forward, 0.14, seeded()).adds.filter((p) => p.kind === 'spark')).toHaveLength(0);
    expect(muzzleEffect(at, forward, 0.14, seeded()).covers).toHaveLength(1);
  });

  test('(stage 5o) the flame lance’s breath: five puffs of fire thrown ahead, the air stopping them within its reach', () => {
    const forward = new THREE.Vector3(0, 0, -1);
    const { adds } = flameEffect(at, forward, seeded());
    expect(adds).toHaveLength(5);
    for (const p of adds) {
      // Ahead, within a few degrees; and how far the drag lets it go, v/k (5 to 6.8 m: the lance reaches 6).
      expect(p.velocity!.dot(forward) / p.velocity!.length()).toBeGreaterThan(0.95);
      expect(p.velocity!.length() / p.drag!).toBeGreaterThanOrEqual(5);
      expect(p.velocity!.length() / p.drag!).toBeLessThanOrEqual(6.9);
    }
  });

  test('a shot on stone throws sparks back the way it came and stone dust; on someone, a pale burst and no sparks', () => {
    const back = new THREE.Vector3(0, 0, 1);
    const stone = impactEffect(at, back, false, 'stone', seeded());
    const sparks = stone.adds.filter((p) => p.kind === 'spark');
    expect(sparks.length).toBeGreaterThan(4);
    const along = sparks.reduce((s, p) => s + p.velocity!.dot(back) / p.velocity!.length(), 0) / sparks.length;
    expect(along).toBeGreaterThan(0.3);
    expect(impactEffect(at, back, true, null, seeded()).adds.filter((p) => p.kind === 'spark')).toHaveLength(0);
  });
});

describe('colors over a life', () => {
  test('between two stops, in a straight line; before the first and after the last, theirs', () => {
    const stops: Stop[] = [
      [0, 0, 0, 0, 1],
      [0.5, 2, 4, 6, 0.5],
      [1, 2, 4, 6, 0],
    ];
    const c: [number, number, number, number] = [0, 0, 0, 0];
    expect(colorAt(stops, 0.25, c)).toEqual([1, 2, 3, 0.75]);
    expect(colorAt(stops, 0.75, c)).toEqual([2, 4, 6, 0.25]);
    expect(colorAt(stops, 0, c)).toEqual([0, 0, 0, 1]);
    expect(colorAt(stops, 1, c)).toEqual([2, 4, 6, 0]);
  });
});

describe('the walk’s sway', () => {
  test('the eyes lowest when a foot lands (a whole step), highest between, and in the middle there', () => {
    expect(swayAt(3, 1).up).toBeCloseTo(-SWAY.bob, 12);
    expect(swayAt(3.5, 1).up).toBeCloseTo(0, 12);
    expect(swayAt(3, 1).side).toBeCloseTo(0, 12);
  });

  test('to one side on one step and to the other on the next, smoothly across each step', () => {
    expect(swayAt(0.5, 1).side).toBeCloseTo(SWAY.side, 12);
    expect(swayAt(1.5, 1).side).toBeCloseTo(-SWAY.side, 12);
    const e = 1e-4;
    for (const k of [1, 2, 7]) {
      // Its value and its slope the same on both sides of a step.
      expect(swayAt(k - e, 1).side).toBeCloseTo(swayAt(k + e, 1).side, 3);
      const slope = (s: number) => (swayAt(s + e, 1).side - swayAt(s - e, 1).side) / (2 * e);
      expect(slope(k - 2 * e)).toBeCloseTo(slope(k + 2 * e), 3);
    }
  });

  test('as much as its amount: running more, standing nothing', () => {
    expect(swayAt(2, SWAY.run).up).toBeCloseTo(-SWAY.bob * SWAY.run, 12);
    expect(swayAt(2.3, 0)).toEqual({ up: -0, side: 0, roll: 0, hold: { side: 0, up: -0 } });
  });

  test('(stage 5o) its cadence: about two steps a second walking, 2.6 running, between them by the speed, no faster than the run’s', () => {
    expect(cadenceAt(4.5, 4.5, 7.5)).toBeCloseTo(1.9, 12);
    expect(cadenceAt(7.5, 4.5, 7.5)).toBeCloseTo(2.6, 12);
    expect(cadenceAt(6, 4.5, 7.5)).toBeCloseTo(2.25, 12);
    expect(cadenceAt(12, 4.5, 7.5)).toBeCloseTo(2.6, 12);
    expect(cadenceAt(1, 4.5, 7.5)).toBeCloseTo(1.9, 12);
  });

  test('landing, the eyes sink to their lowest at τ and come back without passing', () => {
    const speed = 7;
    const deepest = Math.min(SWAY.land.most, SWAY.land.per * speed);
    expect(dipAt(SWAY.land.time, speed)).toBeCloseTo(-deepest, 12);
    for (const t of [0.01, 0.03, 0.12, 0.3]) expect(dipAt(t, speed)).toBeGreaterThan(-deepest - 1e-12);
    expect(dipAt(0, speed)).toBe(-0);
    expect(Math.abs(dipAt(0.6, speed))).toBeLessThan(0.001);
    for (const t of [0.05, 0.1, 0.2, 0.4]) expect(dipAt(t, speed)).toBeLessThanOrEqual(0);
    expect(dipAt(SWAY.land.time, 100)).toBeCloseTo(-SWAY.land.most, 12);
    // Before any landing (never landed: an infinite time ago), nothing, not "not a number".
    expect(dipAt(Infinity, speed)).toBe(0);
    expect(dipAt(Number.NaN, speed)).toBe(0);
  });
});
