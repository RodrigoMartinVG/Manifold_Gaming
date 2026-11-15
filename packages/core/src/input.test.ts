import { describe, expect, test } from 'vitest';
import { CHARACTER_ACTIONS, degreesOf, direction, normalizeInput } from './input';

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
