import { describe, expect, it } from 'vitest';
// (The level is 1.3's, unchanged: a step's folder has only what it changes, and a test reads it from there.)
import { LAYOUTS } from '../01-ventana/layouts';
import { classify, headingTowards } from './turret';
import { createWorld } from './world';

/** What the turret knows (lesson 1.7). The targets are at its eye's height: (2, 0, −3), (−1, 0, 2), (−1, 0, −4) from it. */
describe('the turret looks', () => {
  it('at the start (facing north, a cone of 30°): target 1 in front, right, outside (33.7°); 2 behind, left; 3 in front, left, inside (14.0°)', () => {
    const world = createWorld(LAYOUTS[0]);
    expect(classify(world).map((s) => [s.front, s.side, s.inside])).toEqual([
      [true, 'right', false],
      [false, 'left', false],
      [true, 'left', true],
    ]);
  });
  it('one eighth to the right (north-east), target 1 is inside: at 11.3°', () => {
    const world = createWorld(LAYOUTS[0]);
    world.turret.heading = 1;
    expect(classify(world)[0]!.inside).toBe(true);
  });
  it('without normalizing the forward, the cone widens at a diagonal (√2 long: as if cos α were 0.612, 52°): facing north-west, target 3 at 31.0° comes in', () => {
    const world = createWorld(LAYOUTS[0]);
    world.turret.heading = 7;
    expect(classify(world).filter((s) => s.inside)).toEqual([]);
    expect(
      classify(world, { normalize: false })
        .filter((s) => s.inside)
        .map((s) => s.id),
    ).toEqual(['target 3']);
  });
  it('the heading towards a target is the compass heading nearest its way (the largest dot product)', () => {
    const world = createWorld(LAYOUTS[0]);
    expect(headingTowards(world, world.targets[2]!.position)).toBe(0); // north, 14.0° off
    expect(headingTowards(world, world.targets[1]!.position)).toBe(5); // south-west, 18.4° off (south is 26.6°)
    expect(headingTowards(world, world.targets[0]!.position)).toBe(1); // north-east, 11.3° off
  });
});
