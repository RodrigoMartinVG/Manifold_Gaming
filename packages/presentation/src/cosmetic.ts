import { gravityAt, RapierPhysics, STEP, type PhysicsBackend, type World } from '@manifold/core';

/**
 * THE PHYSICS OF WHAT IS ONLY SEEN (stage 5.5g, the audit's V11): a break's fragments, a blast's rubble, the
 * falls' ragdolls, moving among the level's still pieces, in a physics nobody hashes. Before there were two,
 * the debris's and the falls', each with its own copy of the level's boxes, each made at the first blast or
 * fall (the hitch at the explosion). Now one for the page: made for a world when the world is born (`ready`),
 * made again for another world, and stepped once a frame however many pieces have bodies in it.
 */
export interface CosmeticPhysics {
  /** Its physics for the world drawn now, with the world's still boxes in it. */
  of(world: World): PhysicsBackend;
  /** Made for this world now, not at its first use (the page calls it as a world is born). */
  ready(world: World): void;
  /** At the world's pace (`seconds`: this frame's, scaled), once for the frame `now` however many ask. */
  advance(now: number, seconds: number): void;
  dispose(): void;
}

export function createCosmeticPhysics(): CosmeticPhysics {
  let physics: PhysicsBackend | null = null;
  let of: World | null = null;
  let pending = 0;
  let stepped = -1;
  const make = (world: World) => {
    if (physics && of === world) return physics;
    physics?.dispose();
    of = world;
    pending = 0;
    physics = new RapierPhysics(gravityAt(world.gravity, [0, 0, 0]), STEP);
    // The level's still pieces (boxes and compounds of boxes: a heightfield, when the forest brings one, too).
    for (const e of world.entities.values())
      if (e.body?.type === 'fixed' && (e.body.shape.kind === 'box' || e.body.shape.kind === 'compound') && e.transform)
        physics.addBody(
          { type: 'fixed', shape: e.body.shape },
          { position: [...e.transform.position], rotation: [...e.transform.rotation] },
        );
    return physics;
  };
  return {
    of: make,
    ready: (world) => void make(world),
    advance(now, seconds) {
      if (!physics || now === stepped) return;
      stepped = now;
      // (At most five steps a frame: a frame that took long does not make them leap.)
      pending = Math.min(pending + seconds, STEP * 5);
      while (pending >= STEP) {
        physics.step();
        pending -= STEP;
      }
    },
    dispose() {
      physics?.dispose();
      physics = null;
      of = null;
    },
  };
}
