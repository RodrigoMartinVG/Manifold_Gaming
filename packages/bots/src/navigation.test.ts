import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { buildLevel, initPhysics, levelFromText, World } from '@manifold/core';
import { buildNav, CELL, cellAt, type Nav } from './navigation';
import { findPath } from './path';
import { wayTo } from './signals';

beforeAll(initPhysics);

/** A world built from a level's text, stepped once (queries see a body from the step after it was made). */
function room(text: string) {
  const world = new World({ seed: 1 });
  buildLevel(world, levelFromText(`# Manifold level 7\n${text}`));
  world.step();
  return world;
}
const FLOOR = 'box 0 -0.5 0  6 0.5 6';
const kinds = (nav: Nav, from: Vec3, to: Vec3, world: World, can = {}) =>
  findPath(world, nav, from, to, { can })?.steps.map((s) => s.kind) ?? null;

describe('the navigation of a level (stage 4d, decision 0024)', () => {
  test('a bare floor: a cell every half meter where the body fits (its radius in from the edges, at most), and straight across it', () => {
    const world = room(FLOOR);
    const nav = buildNav(world);
    expect(nav.reason).toBeNull();
    // 12 m across: 24 columns each way, every one standing.
    expect(nav.cells.length).toBe(24 * 24);
    expect(nav.cells.every((c) => Math.abs(c.at[1]) < 1e-9)).toBe(true);
    const path = findPath(world, nav, [-5, 1, -5], [5, 1, 4])!;
    // Straight: from where it starts to where it ends, nothing between.
    expect(path.steps.map((s) => s.kind)).toEqual(['start', 'walk']);
    expect(path.cost).toBeGreaterThan(Math.hypot(9.5, 9) / 4.5 - 1e-9);
    world.dispose();
  });

  test('a wall across it with a door-wide gap: no cells in the wall, and the way goes through the gap', () => {
    const world = room(`${FLOOR}\nbox -3.6 1 0  2.4 1 0.1\nbox 3.6 1 0  2.4 1 0.1`);
    const nav = buildNav(world);
    // Nothing stands where the wall is, or a radius from it.
    expect(nav.cells.some((c) => Math.abs(c.at[2]) < 0.3 && Math.abs(c.at[0]) > 1.2)).toBe(false);
    const path = findPath(world, nav, [-4, 1, -3], [-4, 1, 3])!;
    const xs = path.steps.map((s) => s.at[0]);
    // Through the gap (|x| < 1.2), around the wall's end.
    expect(path.steps.some((s) => Math.abs(s.at[0]) < 1.2 && Math.abs(s.at[2]) <= 0.75)).toBe(true);
    expect(Math.max(...xs)).toBeGreaterThan(-1.3);
    world.dispose();
  });

  test('up a step it walks; onto a block a meter high it jumps; up a wall of three meters only climbing, and without climbing around', () => {
    const world = room(`${FLOOR}\nbox 3 0.15 0  1 0.15 6\nbox -3 0.5 -3  1 0.5 1\nbox -3 1.5 3  1 1.5 1`);
    const nav = buildNav(world);
    expect(kinds(nav, [0, 1, 0], [3, 1, 0], world)).toEqual(['start', 'walk']);
    const jump = kinds(nav, [0, 1, -3], [-3, 2, -3], world)!;
    expect(jump).toContain('jump');
    expect(jump).not.toContain('climb');
    expect(kinds(nav, [0, 1, 3], [-3, 4, 3], world, { climb: true })).toContain('climb');
    // Without climbing (as a body plans unless told it climbs), the top of the tall block is out of reach.
    expect(findPath(world, nav, [0, 1, 3], [-3, 4, 3])).toBeNull();
    world.dispose();
  });

  test('a gap of 2 m between two floors: jumped across; of 4 m: nowhere', () => {
    const world = room('box -3 -0.5 0  2 0.5 2\nbox 3 -0.5 0  2 0.5 2\nbox 11 -0.5 0  2 0.5 2');
    const nav = buildNav(world);
    expect(kinds(nav, [-3, 1, 0], [3, 1, 0], world)).toContain('across');
    expect(findPath(world, nav, [3, 1, 0], [11, 1, 0], {})).toBeNull();
    world.dispose();
  });

  test('a door a button opens: closed, the way goes to the button first and presses it; open, straight through', () => {
    const world = room(
      [
        FLOOR,
        'box -3.4 1.1 0  2.8 1.1 0.1',
        'box 3.4 1.1 0  2.8 1.1 0.1',
        'box 0 1.1 0  0.6 1.1 0.06  door -0.6 0 0 y 90 1 gate  name door',
        'sensor button  3 0.9 2  0.5 0.9 0.5  name button',
        'signal pressed  used button',
        'signal gate     toggle pressed',
      ].join('\n'),
    );
    const nav = buildNav(world);
    expect(wayTo(world, 'gate', 1)).toEqual({ zone: 'button', use: true });
    const closed = findPath(world, nav, [0, 1, 4], [0, 1, -4])!;
    expect(closed.steps.map((s) => s.kind)).toContain('use');
    const use = closed.steps.find((s) => s.kind === 'use')!;
    expect(use.zone).toBe('button');
    expect(Math.abs(use.at[0] - 3)).toBeLessThanOrEqual(0.5);
    expect(closed.steps.some((s) => s.door === 'door')).toBe(true);
    expect(closed.changes).toEqual([{ signal: 'gate', value: 1, way: { zone: 'button', use: true } }]);
    // Planning for no button (depth 0): none.
    expect(findPath(world, nav, [0, 1, 4], [0, 1, -4], { depth: 0 })).toBeNull();
    world.dispose();
    // A door the game opens (its signal an input): open, straight through it, pressing nothing.
    const other = room(
      [
        FLOOR,
        'box -3.4 1.1 0  2.8 1.1 0.1',
        'box 3.4 1.1 0  2.8 1.1 0.1',
        'signal gate',
        'box 0 1.1 0  0.6 1.1 0.06  door -0.6 0 0 y 90 1 gate  name door',
      ].join('\n'),
    );
    other.setSignal('gate', 1);
    other.step();
    const opened = findPath(other, buildNav(other), [0, 1, 4], [0, 1, -4])!;
    expect(opened.steps.map((s) => s.kind)).not.toContain('use');
    expect(opened.steps.some((s) => s.door === 'door')).toBe(true);
    expect(opened.changes).toEqual([]);
    other.dispose();
  });

  test('the cells: where a point stands, its column’s highest cell under it; a level without one "down", none', () => {
    const world = room(`${FLOOR}\nbox 0 1 0  1 0.1 1`);
    const nav = buildNav(world);
    // On the slab (top at 1.1); under it, the body does not fit (0.9 m): the nearest floor's cell around.
    expect(cellAt(nav, [0.25, 2, 0.25])!.at[1]).toBeCloseTo(1.1, 9);
    const under = cellAt(nav, [0.25, 0.8, 0.25])!;
    expect(under.at[1]).toBeCloseTo(0, 9);
    expect(Math.max(Math.abs(under.at[0]), Math.abs(under.at[2]))).toBeGreaterThan(1);
    expect(CELL).toBe(0.5);
    const sideways = new World({ seed: 1, gravity: { kind: 'uniform', vector: [0, 0, -9.81] } });
    expect(buildNav(sideways).reason).toMatch(/not along −Y/);
    world.dispose();
    sideways.dispose();
  });
});
