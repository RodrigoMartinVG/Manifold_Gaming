import { describe, expect, test } from 'vitest';
import { pitchOf } from './drive';

describe('the aim camera’s pitch (stage 4b)', () => {
  test('how far above the ground a look is, as a fraction of a quarter turn, whatever its length; on any up', () => {
    expect(pitchOf([0, 0, -1], [0, 1, 0])).toBe(0);
    expect(pitchOf([0, 2, -2], [0, 1, 0])).toBeCloseTo(0.5, 12);
    expect(pitchOf([3, -3 * Math.sqrt(3), 0], [0, 1, 0])).toBeCloseTo(-2 / 3, 12);
    expect(pitchOf([0, 5, 0], [0, 1, 0])).toBe(1);
    // On a wall whose up is +X (phase 7's planets): looking along it, up it.
    expect(pitchOf([1, 0, -1], [1, 0, 0])).toBeCloseTo(0.5, 12);
    expect(pitchOf([0, 0, 0], [0, 1, 0])).toBe(0);
  });
});
