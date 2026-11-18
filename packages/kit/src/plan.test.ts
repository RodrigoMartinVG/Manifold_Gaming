import { describe, expect, test } from 'vitest';
import { levelFromPlan } from './plan';

/** A level drawn as a plan, made of the kit (stage 5m). */
describe('a level from its plan', () => {
  const plan = [
    '# Manifold level 10',
    'title A room',
    'plan -2 -3',
    '#####',
    '#.c.#',
    '#...+',
    '##.##',
    'end',
    'lamp 0 2.4 0  4 1',
  ].join('\n');
  const made = levelFromPlan(plan, 'a test');
  const lines = made.split('\n');

  test('what is not the grid passes as it is, before and after, in its place', () => {
    expect(lines.slice(0, 2)).toEqual(['# Manifold level 10', 'title A room']);
    expect(lines.at(-1)).toBe('lamp 0 2.4 0  4 1');
    expect(made).not.toContain('plan ');
    expect(made).not.toMatch(/^end$/m);
  });

  test('a floor tile wherever a 4 by 4 square of the plan has anything: two, for a plan 5 wide and 4 deep', () => {
    expect(lines.filter((l) => l.startsWith('kit floor_4'))).toEqual(['kit floor_4  0 0 -1', 'kit floor_4  4 0 -1']);
  });

  test('walls along their runs, 6 m high (two pieces up), in pieces of 4, 2 and 1, turned along a column; the low one, one up', () => {
    // The first row, five cells from x = −2: a piece of 4 and one of 1, each twice (y 0 and 3).
    expect(lines).toContain('kit wall_4  0 0 -2.5');
    expect(lines).toContain('kit wall_4  0 3 -2.5');
    expect(lines).toContain('kit wall_1  2.5 0 -2.5');
    // The left column, four cells from z = −3: one piece of 4, turned.
    expect(lines).toContain('kit wall_4  -1.5 0 -1  rotate y 90');
    // The last row's two runs of two, either side of the door.
    expect(lines).toContain('kit wall_2  -1 0 0.5');
    expect(lines).toContain('kit wall_2  2 0 0.5');
    // The `+`, alone between walls of `#`: a piece of 1, one up.
    expect(lines).toContain('kit wall_1  2.5 0 -0.5');
    expect(lines).not.toContain('kit wall_1  2.5 3 -0.5');
  });

  test('a crate where the plan says, on the floor; the same plan, the same level', () => {
    expect(lines).toContain('kit block_1  0.5 0 -1.5');
    expect(levelFromPlan(plan, 'a test')).toBe(made);
  });

  test('(stage 5o) a second grid, 3 m up: its floor exactly where its cells are (a balcony does not cover the hall), its walls and railings on it', () => {
    const two = [
      'title Two floors',
      'plan 0 0',
      '....',
      '....',
      '....',
      '....',
      'end',
      'plan 0 0 3',
      '##  ',
      '#.= ',
      '#.= ',
      '##  ',
      'end',
    ].join('\n');
    const lines = levelFromPlan(two).split('\n');
    // The ground: one tile of 4. Up: its 12 cells that are not empty, in tiles of 2 and of 1 at y 3; none of 4.
    expect(lines.filter((l) => l.startsWith('kit floor_4'))).toEqual(['kit floor_4  2 0 2']);
    expect(lines.filter((l) => / 3 /.test(l) && l.startsWith('kit floor_')).length).toBeGreaterThan(0);
    expect(lines.some((l) => l.startsWith('kit floor_4') && / 3 /.test(l))).toBe(false);
    // Up, a wall of 2 along the first row, standing on 3 and on 6; a railing turned along the last column.
    expect(lines).toContain('kit wall_2  1 3 0.5');
    expect(lines).toContain('kit wall_2  1 6 0.5');
    expect(lines).toContain('kit railing_2  2.5 3 2  rotate y 90');
    // Nothing laid over the last column, empty: the hall below is seen.
    expect(lines.some((l) => l.startsWith('kit floor_1  3.5 3'))).toBe(false);
  });

  test('a plan without its grid, or with a grid that never ends, is refused', () => {
    expect(() => levelFromPlan('title x')).toThrow(/plan <x> <z>/);
    expect(() => levelFromPlan('plan 0 0\n###')).toThrow(/end/);
  });
});
