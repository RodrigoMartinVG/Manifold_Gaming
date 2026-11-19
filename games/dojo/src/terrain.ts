import { quat, type Vec3 } from '@manifold/common';
import { characterParts } from '@manifold/character';
import { stateHash, World, type PlayerInput, type Shape } from '@manifold/core';

/**
 * THE TERRAIN'S MEASURES (the forest's F0a, decision 0032): height fields made the same everywhere, and a world
 * on one that every browser must step to the same hash. Measures, not the forest's terrain: its format and its
 * generator are F1's choice, from these numbers. Only the engine's arithmetic (no `sin`, no `pow`): the heights
 * are part of the world, so they must be the same bits in Node and in every browser.
 */

export type Field = Extract<Shape, { kind: 'heightfield' }>;

/**
 * A field of `cells` × `cells` square cells over `size` m, centered on its body, its height at each corner
 * `h(x, z)` (in meters, from the body's center).
 */
export function fieldFrom(cells: number, size: number, h: (x: number, z: number) => number, fixEdges = false): Field {
  const heights: number[] = [];
  for (let i = 0; i <= cells; i++)
    for (let j = 0; j <= cells; j++) heights.push(h(-size / 2 + (j * size) / cells, -size / 2 + (i * size) / cells));
  return { kind: 'heightfield', cols: cells, rows: cells, heights, size: [size, 1, size], ...(fixEdges ? { fixEdges } : {}) };
}

/** A number in [0, 1) for a corner of an integer lattice, from a seed: integer arithmetic only. */
function lattice(seed: number, i: number, j: number): number {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise in [0, 1): the lattice's corners, blended smoothly (3t² − 2t³) inside each square of 1 × 1. */
export function noise(seed: number, x: number, z: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const fade = (t: number) => t * t * (3 - 2 * t);
  const u = fade(x - i);
  const v = fade(z - j);
  const a = lattice(seed, i, j);
  const b = lattice(seed, i + 1, j);
  const c = lattice(seed, i, j + 1);
  const d = lattice(seed, i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Hills: two octaves of noise, 16 m and 5 m across, up to 4 m and 1 m high, and nothing to hold a sense of up. */
export const hills = (seed: number) => (x: number, z: number) => 4 * noise(seed, x / 16, z / 16) + noise(seed + 1, x / 5, z / 5);

/** The probe: 64 m of hills in cells of 1 m, ten things dropped on it, a character walking a square over it for ten seconds. */
export const TERRAIN_PROBE = { seed: 7, cells: 64, size: 64, steps: 600 } as const;

/** What player 1 asks for at step `n` of the probe: a square, a side every 2.5 s, a jump every 1.5 s. */
function walk(n: number): PlayerInput {
  const sides: Vec3[] = [
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
    [0, 0, -1],
  ];
  return { move: sides[Math.floor(n / 150) % 4]!, ...(n % 90 < 10 ? { jump: true } : {}) };
}

/**
 * THE PROBE'S WORLD, stepped to its end: its hash (8 hex digits), with or without the field's edges fixed. The
 * page "La misma huella" steps it in the reader's browser, and the browser tests compare it with Node's.
 */
export function terrainProbe(fixEdges: boolean): string {
  const { seed, cells, size, steps } = TERRAIN_PROBE;
  const h = hills(seed);
  const world = new World({ seed: 1 });
  world.createEntity({
    transform: { position: [0, 0, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: fieldFrom(cells, size, h, fixEdges) },
    appearance: { shape: 'field', size: [size, 1, size], color: 0x6f8f4e },
  });
  for (let k = 0; k < 10; k++) {
    const x = -20 + 40 * lattice(seed, k, 100);
    const z = -20 + 40 * lattice(seed, k, 200);
    world.createEntity({
      transform: { position: [x, h(x, z) + 3 + k * 0.5, z], rotation: quat.identity() },
      body: { type: 'dynamic', shape: k % 2 ? { kind: 'box', halfExtents: [0.3, 0.3, 0.3] } : { kind: 'ball', radius: 0.3 } },
    });
  }
  const parts = characterParts({ player: 1, facing: [0, 0, -1], color: 0x93d9c9 });
  world.createEntity({
    transform: { position: [0, h(0, 0) + 1.5, 0], rotation: quat.identity() },
    body: parts.body,
    character: parts.character,
  });
  let last: PlayerInput = {};
  for (let n = 0; n < steps; n++) {
    const input = walk(n);
    world.inputs.set(1, input);
    world.lastInputs.set(1, last);
    world.step();
    last = input;
  }
  const hash = stateHash(world).toString(16).padStart(8, '0');
  world.dispose();
  return hash;
}
