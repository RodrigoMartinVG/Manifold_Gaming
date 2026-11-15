import { describe, expect, test } from 'vitest';
import { levelFromText, levelToText, type LevelBox } from '@manifold/core';
import { LEVELS } from './levels';
import { DOJO_ZONES } from './rules';

/**
 * THE DOJO'S LEVELS, DRAWN WITHOUT FLICKER (stage 3a). Two boxes whose faces lie in the same plane,
 * facing the same way and overlapping, flicker on the screen: the graphics card cannot tell which one
 * is in front, and picks one or the other from pixel to pixel (z-fighting). The machines room had it:
 * its ferry's run ended 3 m inside the floor across the pit, its top at the same height (the author
 * saw it). Faces that only touch, or face each other, are fine. A box that moves, or a lift (stage 3c),
 * counts with all the room it sweeps; a turned or spinning one, or a door, is left out (its faces are
 * not along the axes), and so is a hidden one (stage 3b: it is not drawn). A grid counts: its lines lie
 * in the plane of its top.
 */
const EPSILON = 1e-4;

/** Where a box reaches along each axis, over all its run if it moves. */
function extent(b: LevelBox): [number, number][] {
  return [0, 1, 2].map((k) => {
    const lo = b.center[k]! - b.half[k]!;
    const hi = b.center[k]! + b.half[k]!;
    const by = (b.move ?? b.lift)?.by[k] ?? 0;
    return [Math.min(lo, lo + by), Math.max(hi, hi + by)];
  });
}

/** The overlap of two intervals (0 if they only touch, or not at all). */
const overlap = (a: [number, number], b: [number, number]) => Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

/** Faces of two boxes in the same plane, facing the same way, overlapping with some area: a description of each. */
function flickering(boxes: LevelBox[]): string[] {
  const found: string[] = [];
  const straight = boxes.map((b, i) => ({ b, i })).filter(({ b }) => !b.turn && !b.spin && !b.door && b.look !== 'hidden');
  for (let p = 0; p < straight.length; p++)
    for (let q = p + 1; q < straight.length; q++) {
      const [A, B] = [straight[p]!, straight[q]!];
      const [ea, eb] = [extent(A.b), extent(B.b)];
      for (let k = 0; k < 3; k++) {
        const others = [0, 1, 2].filter((j) => j !== k);
        const area = overlap(ea[others[0]!]!, eb[others[0]!]!) * overlap(ea[others[1]!]!, eb[others[1]!]!);
        if (area < EPSILON) continue;
        // A face along axis k, low or high: in the same plane and facing the same way. (A moving box's
        // faces move: only a still face along its run's axis has one place.)
        for (const side of [0, 1] as const) {
          const movesAlong = (b: LevelBox) => Math.abs((b.move ?? b.lift)?.by[k] ?? 0) > EPSILON;
          if (movesAlong(A.b) || movesAlong(B.b)) continue;
          if (Math.abs(ea[k]![side] - eb[k]![side]) < EPSILON)
            found.push(`boxes ${A.i + 1} and ${B.i + 1}: their ${side ? 'high' : 'low'} ${'xyz'[k]} faces, at ${ea[k]![side]}`);
        }
      }
    }
  return found;
}

describe("the Dojo's levels (stage 3a)", () => {
  for (const [name, level] of Object.entries(LEVELS)) {
    test(`${name}: no two faces in the same plane overlap (they would flicker)`, () => {
      expect(flickering(level.boxes)).toEqual([]);
    });
    // Stage 3b: written in the format's latest version and read again, it is the same level.
    test(`${name}: written as text and read again, the same`, () => {
      expect(levelFromText(levelToText(level), { zones: DOJO_ZONES })).toEqual(level);
    });
  }

  test('the check finds what it is for: the machines room as it was, its ferry running into the floor', () => {
    const box = {
      name: null,
      turn: null,
      color: 0,
      look: 'solid',
      material: null,
      groups: null,
      move: null,
      spin: null,
      door: null,
      lift: null,
      model: null,
      breaks: null,
    } as const;
    const ferry: LevelBox = { ...box, center: [3, -0.15, -11.5], half: [1.5, 0.15, 1.5], move: { by: [0, 0, -6], seconds: 2.5 } };
    const floor: LevelBox = { ...box, center: [3, -0.5, -22], half: [6, 0.5, 6] };
    expect(flickering([ferry, floor])).toEqual(['boxes 1 and 2: their high y faces, at 0']);
    expect(flickering([ferry, { ...floor, center: [3, -0.5, -25] }])).toEqual([]);
  });
});
