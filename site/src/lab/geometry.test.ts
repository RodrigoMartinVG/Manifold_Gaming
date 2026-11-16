import { describe, expect, it } from 'vitest';
import { centreShift, rayPlane } from './geometry';

describe('the lab kit’s geometry', () => {
  it('a ray down from (0, 5, 0) meets the floor y = 0 at t = 5', () => {
    expect(rayPlane({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 1, z: 0 }, 0)).toBe(5);
  });
  it('a plane behind the ray, or parallel to it, is not met', () => {
    expect(rayPlane({ x: 0, y: 5, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, 0)).toBeNull();
    expect(rayPlane({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 0)).toBeNull();
  });
  it('the plane x = 2, written [n | d] = [(1, 0, 0) | −2], is met at t = 2 from the origin along +x', () => {
    expect(rayPlane({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, -2)).toBe(2);
  });
  it('the picture moves half the panel left, at most a quarter of its width', () => {
    expect(centreShift(1200, 245)).toBe(122.5);
    expect(centreShift(400, 245)).toBe(100);
    expect(centreShift(800, 0)).toBe(0);
  });
});
