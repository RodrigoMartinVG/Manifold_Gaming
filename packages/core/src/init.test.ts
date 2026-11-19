import { describe, expect, test } from 'vitest';
import { initPhysics } from './physics';
import { World } from './world';

/**
 * RAPIER LOADED ONCE (found in continuous integration at the forest's F0a). This file loads it itself, with no
 * `beforeAll`: two pieces of a page that ask at the same time must share one load, or the second takes the
 * memory from under the first one's worlds ("unreachable", on "La misma huella").
 */
describe('loading the physics', () => {
  test('two calls at once share one load, and a world made after the first still steps after the second', async () => {
    const first = initPhysics();
    const second = initPhysics();
    expect(second).toBe(first);
    await first;
    const world = new World({ seed: 1 });
    await initPhysics();
    world.step();
    expect(world.tick).toBe(1);
    world.dispose();
  });
});
