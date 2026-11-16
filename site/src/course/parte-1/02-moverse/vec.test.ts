import { describe, expect, it } from 'vitest';
import { add, length, normalize, scale, sub, vec } from './vec';

/** The project's vectors (decision 0021: a step's pure code has its unit tests; the reader does not see them). */
describe('vectors', () => {
  it('add and subtract component by component', () => {
    expect(add(vec(1, 2, 3), vec(4, -2, 1))).toEqual(vec(5, 0, 4));
    expect(sub(vec(4, 0, 1), vec(1, 2, 3))).toEqual(vec(3, -2, -2));
  });
  it('a scaled vector is that many times as long', () => {
    expect(length(scale(vec(3, 0, 4), -2))).toBe(10);
  });
  it('the diagonal of a unit square is √2 long, and normalized it is 1', () => {
    expect(length(vec(1, 0, -1))).toBeCloseTo(Math.SQRT2, 15);
    expect(length(normalize(vec(1, 0, -1)))).toBeCloseTo(1, 15);
  });
  it('the zero vector stays zero, with no NaN', () => {
    expect(normalize(vec(0, 0, 0))).toEqual(vec(0, 0, 0));
  });
});
