import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { characterParts } from '@manifold/character';
import { initPhysics, stateHash, World, type Shape } from '@manifold/core';
import { fieldFrom, hills } from '@manifold/dojo/terrain';
import { measure, ms, record, time } from './measure';

/**
 * THE VALLEY'S GROUND (the forest's F0a, decision 0032): a height field of 501 × 501 heights over 500 m, its
 * hills from the probe's seed, with fifty things on it and a character walking, against the same on a box
 * of the same size; with its cells' edges as they come and fixed. What a step costs on it, next to the box's
 * in the same round (measure.ts); and what the world's hash costs while the heights are in the entity, as
 * any shape's numbers are today (the finding that makes F1 keep a reference to them instead).
 */

beforeAll(initPhysics);

type Floor = 'box' | 'field' | 'fixed';

function valley(floor: Floor) {
  const h = hills(7);
  const at = (x: number, z: number) => (floor === 'box' ? 0 : h(x, z));
  const world = new World({ seed: 1 });
  const shape: Shape =
    floor === 'box' ? { kind: 'box', halfExtents: [250, 0.5, 250] } : fieldFrom(500, 500, h, floor === 'fixed');
  world.createEntity({
    transform: { position: [0, floor === 'box' ? -0.5 : 0, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape },
  });
  for (let k = 0; k < 50; k++) {
    const x = -30 + (k % 10) * 6;
    const z = -30 + Math.floor(k / 10) * 12;
    world.createEntity({
      transform: { position: [x, at(x, z) + 2, z], rotation: quat.identity() },
      body: { type: 'dynamic', shape: k % 2 ? { kind: 'box', halfExtents: [0.3, 0.3, 0.3] } : { kind: 'ball', radius: 0.3 } },
    });
  }
  const parts = characterParts({ player: 1, facing: [0, 0, -1], color: 0x93d9c9 });
  world.createEntity({
    transform: { position: [0, at(0, 0) + 1.5, 0], rotation: quat.identity() },
    body: parts.body,
    character: parts.character,
  });
  let n = 0;
  /** A step, the character walking back and forth along X (100 steps each way). */
  const step = () => {
    world.inputs.set(1, { move: [n++ % 200 < 100 ? 1 : -1, 0, 0] });
    world.step();
  };
  // Two seconds in: what was dropped has landed.
  for (let i = 0; i < 120; i++) step();
  return { world, step };
}

describe('the valley’s ground (the forest’s F0a): a step on 501 × 501 heights, against a box', () => {
  test('a step with its edges fixed costs at most five times the box’s; the rest is recorded', () => {
    const v = { box: valley('box'), field: valley('field'), fixed: valley('fixed') };
    const steps = 30;
    const stepping = (f: Floor) => () =>
      time(() => {
        for (let i = 0; i < steps; i++) v[f].step();
      }) / steps;
    const t = measure('box', {
      box: stepping('box'),
      field: stepping('field'),
      fixed: stepping('fixed'),
      fieldHash: () => time(() => stateHash(v.field.world)),
      boxHash: () => time(() => stateHash(v.box.world)),
    });
    const message = `a step: on the box ${ms(t.ms.box)}, on the field ${ms(t.ms.field)} (${t.ratio.field.toFixed(2)}×), fixed ${ms(t.ms.fixed)} (${t.ratio.fixed.toFixed(2)}×); the hash ${ms(t.ms.boxHash)} on the box, ${ms(t.ms.fieldHash)} with the heights`;
    record('terrain', {
      boxStepMs: t.ms.box,
      fieldStepMs: t.ms.field,
      fixedStepMs: t.ms.fixed,
      fieldStepRatio: t.ratio.field,
      fixedStepRatio: t.ratio.fixed,
      boxHashMs: t.ms.boxHash,
      fieldHashMs: t.ms.fieldHash,
    });
    // Measured on the author's machine (2026-11-19): 0.22 to 0.27 ms on the box; 0.66 to 0.75 with the edges
    // fixed (3.8×), the way F0a's edges measure points the forest to; as they come, 0.76 to 1.1 (4.5×: what
    // hops at the edges makes more contacts). The fixed one is held; both are recorded.
    expect(t.ratio.fixed, message).toBeLessThan(5);
    for (const { world } of Object.values(v)) world.dispose();
  }, 300_000);
});
