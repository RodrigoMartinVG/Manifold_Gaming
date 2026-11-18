import { describe, expect, it } from 'vitest';
import { cross, dot, length, normalize, vec } from './vec';

/** The project's vectors, with their two products (lessons 1.5 and 1.6). */
describe('the two products', () => {
  it('the dot product: the worked example, 5, and |a| |b| cos 45°', () => {
    const [a, b] = [vec(3, 0, -1), vec(1, 0, -2)];
    expect(dot(a, b)).toBe(5);
    expect(dot(a, b)).toBeCloseTo(length(a) * length(b) * Math.SQRT1_2, 12);
    expect(dot(vec(2, 0, 1), b)).toBe(0); // the rejection is perpendicular to b
  });
  it('the cross product: perpendicular to both, as long as the area, and the axes in their cycle', () => {
    const [a, b] = [vec(2, 1, 0), vec(0, 1, 3)];
    expect(cross(a, b)).toEqual(vec(3, -6, 2));
    expect(length(cross(a, b))).toBe(7);
    expect([dot(cross(a, b), a), dot(cross(a, b), b)]).toEqual([0, 0]);
    expect(cross(vec(1, 0, 0), vec(0, 1, 0))).toEqual(vec(0, 0, 1));
    expect(cross(vec(0, 0, 1), vec(1, 0, 0))).toEqual(vec(0, 1, 0));
    expect(cross(b, a)).toEqual(vec(-3, 6, -2));
  });
  it('a direction stays one long; the zero vector stays zero', () => {
    expect(length(normalize(vec(1, 0, -1)))).toBeCloseTo(1, 15);
    expect(normalize(vec(0, 0, 0))).toEqual(vec(0, 0, 0));
  });
});
