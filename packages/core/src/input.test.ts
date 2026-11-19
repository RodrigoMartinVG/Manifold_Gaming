import { describe, expect, test } from 'vitest';
import { actionsFor, CHARACTER_ACTIONS, degreesOf, direction, normalizeInput } from './input';

describe('directions on the ground, in whole degrees (stage 2.5c)', () => {
  test('a direction is one of 360: forward is 0°, the right 90°; its vector, with our own sine and cosine', () => {
    expect(direction(0)).toEqual([0, 0, -1]);
    expect(direction(90)).toEqual([1, 0, 0]);
    expect(direction(180)).toEqual([0, 0, 1]);
    expect(direction(270, 0.5)).toEqual([-0.5, 0, 0]);
    // No −0 (it has other bits: another hash).
    expect(Object.is(direction(0)[0], -0)).toBe(false);
  });

  test("the degrees of any direction: the closest of the 360, without the browser's atan2", () => {
    for (let d = 0; d < 360; d++) expect(degreesOf(...xz(direction(d))), `${d}°`).toBe(d);
    // Between two, the closest: 0.6 to the right and 0.8 forward is 36.87°.
    expect(degreesOf(0.6, -0.8)).toBe(37);
    // Against the browser's trigonometry (only in a test: it compares, it does not simulate).
    for (let i = 0; i < 500; i++) {
      const a = (i * 0.7193) % 360;
      const rad = (a * Math.PI) / 180;
      const expected = Math.round(a) % 360;
      expect(degreesOf(Math.sin(rad), -Math.cos(rad)), `${a.toFixed(3)}°`).toBe(expected);
    }
  });

  const move = (x: number, z: number) => ({ move: [x, 0, z] as [number, number, number] });
  const at = (d: number) => {
    const rad = (d * Math.PI) / 180;
    return move(Math.sin(rad), -Math.cos(rad));
  };

  test('a direction changes only past 1° from the one asked for before: a trembling hand does not ask again', () => {
    const first = normalizeInput(at(10.4), CHARACTER_ACTIONS);
    expect(first.move).toEqual(direction(10));
    // Trembling around the edge between 10° and 11°: the same one.
    for (const d of [10.6, 10.45, 10.9, 10.55])
      expect(normalizeInput(at(d), CHARACTER_ACTIONS, first).move, `${d}°`).toEqual(direction(10));
    // Past 1° from it: a new one, the closest.
    expect(normalizeInput(at(11.2), CHARACTER_ACTIONS, first).move).toEqual(direction(11));
    // A direction that is already one of the 360 (from a client, from a replay) is taken as it is.
    expect(normalizeInput({ move: direction(11) }, CHARACTER_ACTIONS, first).move).toEqual(direction(11));
  });

  test('how much: in hundredths, up to 1; nothing is nothing', () => {
    expect(normalizeInput(move(0.3, 0), CHARACTER_ACTIONS).move).toEqual(direction(90, 0.3));
    expect(normalizeInput(move(3, 4), CHARACTER_ACTIONS).move).toEqual(direction(degreesOf(3, 4)));
    expect(normalizeInput(move(0.001, 0), CHARACTER_ACTIONS)).toEqual({});
  });
});

const xz = (v: readonly number[]): [number, number] => [v[0]!, v[2]!];

describe('where to look and to aim, finer (stage 4.5a)', () => {
  // The search as it was (stage 2.5c), to hold the whole degrees to it.
  const wholeDegrees = (x: number, z: number) => {
    const along = (d: number) => {
      const [s, c] = [Math.sin((d * Math.PI) / 180), Math.cos((d * Math.PI) / 180)];
      return x * s - z * c;
    };
    let best = 0;
    for (const d of [90, 180, 270]) if (along(d) > along(best)) best = d;
    for (const step of [45, 23, 12, 6, 3, 2, 1]) for (const d of [best - step, best + step]) if (along(d) > along(best)) best = d;
    return ((best % 360) + 360) % 360;
  };

  test('in whole degrees, the search finds what it found before (every replay reads the same)', () => {
    for (let k = 0; k < 2000; k++) {
      const a = (k * 0.1803) % 360;
      const x = Math.sin((a * Math.PI) / 180);
      const z = -Math.cos((a * Math.PI) / 180);
      expect(degreesOf(x, z)).toBe(wholeDegrees(x, z));
    }
    for (let d = 0; d < 360; d++) expect(degreesOf(...([direction(d)[0], direction(d)[2]] as const))).toBe(d);
  });

  test('on a grid of tenths, each of the 3,600 directions comes back as itself, with the same bits', () => {
    for (let u = 0; u < 3600; u++) {
      const d = u / 10;
      const v = direction(d);
      expect(degreesOf(v[0], v[2], 0.1)).toBe(d);
    }
  });

  test('`face` travels to a tenth of a degree, `pitch` to a thousandth of a quarter turn; `move` keeps whole degrees', () => {
    const asked = (d: number) => direction(d);
    const out = normalizeInput({ face: asked(12.34), move: asked(12.34), pitch: 0.12345 }, CHARACTER_ACTIONS);
    expect(out.face).toEqual(direction(12.3));
    expect(out.move).toEqual(direction(12));
    expect(out.pitch).toBe(0.123);
    // A turn under a tenth from the one asked before asks for the same; past it, a new one.
    const before = { face: direction(12.3) };
    expect(normalizeInput({ face: asked(12.36) }, CHARACTER_ACTIONS, before).face).toEqual(direction(12.3));
    expect(normalizeInput({ face: asked(12.48) }, CHARACTER_ACTIONS, before).face).toEqual(direction(12.5));
  });
});

describe('a character looks where it is asked, to a tenth of a degree (stage 4.5a)', () => {
  test('asked a tenth more each step, it turns a tenth each step: no jumps of a degree', async () => {
    const { quat } = await import('@manifold/common');
    const { initPhysics } = await import('./physics');
    const { World } = await import('./world');
    await initPhysics();
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 10] } },
    });
    const hero = world.createEntity({
      transform: { position: [0, 0.82, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1, can: {} },
    });
    let before = {};
    const angles: number[] = [];
    for (let k = 0; k <= 20; k++) {
      // The camera turning 0.07° a frame (half a pixel of the mouse): asked as it is, normalized as a session does.
      const input = normalizeInput({ face: direction(10 + k * 0.07) }, CHARACTER_ACTIONS, before);
      before = input;
      world.applyInputs(new Map([[1, input]]));
      world.step();
      const f = hero.character!.facing;
      angles.push(Math.round(((Math.atan2(f[0], -f[2]) * 180) / Math.PI) * 100) / 100);
    }
    // From 10° to 11.4°, in tenths (each step the tenth nearest, held within a tenth of the last).
    expect(angles[0]).toBe(10);
    expect(angles.at(-1)).toBeCloseTo(11.4, 1);
    const steps = angles.slice(1).map((a, i) => Math.round((a - angles[i]!) * 100) / 100);
    expect(Math.max(...steps)).toBeLessThanOrEqual(0.2);
    expect(new Set(angles).size).toBeGreaterThan(10);
    world.dispose();
  });
});

/**
 * A GAME'S ACTIONS BY THEIR OWNER'S NAME (stage 5.5e: the pattern of a word with its owner, one for the
 * components, the sounds, the affordances and the actions; the actions had one of their own, which took
 * a name ending in a dot or with two dots together).
 */
describe("a game's actions, by their owner's name (stage 5.5e)", () => {
  test('`<game>.<action>`, its words lowercase, no dot at its end nor two together', () => {
    const action = (name: string) => [{ name, kind: 'button' as const, description: '' }];
    expect(() => actionsFor(action('dojo.throw'))).not.toThrow();
    expect(() => actionsFor(action('arms.fire.alt'))).not.toThrow();
    for (const name of ['throw', 'dojo.', 'dojo..throw', 'Dojo.throw'])
      expect(() => actionsFor(action(name)), name).toThrow("needs its game's namespace");
  });
});
