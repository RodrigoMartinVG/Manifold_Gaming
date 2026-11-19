import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import {
  initPhysics,
  NO_INPUT,
  playReplay,
  replayFromText,
  replayOf,
  replayToText,
  Session,
  SIMULATION_VERSION,
} from '@manifold/core';
import { TOWER_CARTRIDGE, TOWER_LEVEL_LIST } from './cartridge';
import { floorOf } from './play';
import { TOWER_REPLAYS } from './replays';
import { runner } from './rules';

beforeAll(initPhysics);

const AHEAD: Vec3 = [0, 0, -1];

/** A floor's run as a reference replay: its header, what it is, and that it is not edited by hand. */
function referenceText(session: Session, about: string): string {
  const [header, ...rest] = replayToText(replayOf(session)).split('\n');
  return [
    header,
    `# ${about}`,
    '# A reference replay (stage 5d, as the Dojo’s since 2.5a): playing it must end with the hash on its',
    '# last line. Recorded by games/tower/src/floors.test.ts; recorded again (npm run references) only',
    '# when the simulation changes on purpose, with SIMULATION_VERSION.',
    ...rest,
  ].join('\n');
}

describe('the tower’s six floors, played to their goal (stage 5d; six, longer, since 5p)', () => {
  test('the entrance: a hop, a ledge 3 m up, a chimney to the terrace 6 m up; three pillars (a running jump), a ledge, a chimney to the goal 15 m up', async () => {
    const f = floorOf(0);
    f.go(NO_INPUT, () => f.c().grounded, 60);
    f.go({ move: AHEAD }, () => f.at()[2]! < 4.2);
    f.jump(AHEAD, 25);
    f.go({ move: AHEAD }, () => f.at()[2]! < -0.9);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 2.5, 120)).toBe(true);
    f.go({ move: AHEAD }, () => f.c().grounded && f.at()[2]! < -12.5);
    f.chimney(6, AHEAD);
    // (Stage 5p) From the terrace: a pillar 2 m off; one a meter lower; one 4.5 m off, a running jump away.
    f.walkTo(0, -17.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    f.walkTo(0, -21.7);
    f.jump(AHEAD, 25);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(4.5);
    f.walkTo(0, -24.3);
    f.go({ move: AHEAD, run: true }, () => f.at()[2]! < -25.8, 60);
    for (let i = 0; i < 30; i++) f.step({ move: AHEAD, run: true, jump: true });
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(5.5);
    // The block's ledge, 3 m up across 1.5 m; its chimney, to the goal.
    f.walkTo(0, -34.3);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 8.5, 160)).toBe(true);
    f.walkTo(0, -43.4);
    f.chimney(15, AHEAD);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    await expect(
      referenceText(f.session, "The tower's entrance, played to its goal: a hop, a ledge, a chimney."),
    ).toMatchFileSnapshot('../replays/floor-1.replay');
    f.session.world.dispose();
  });

  test('the first floor: a chimney 2.4 m wide, 2.5 m across the void to a pillar, a ledge 3 m up, a chimney 3.2 m wide over nothing', async () => {
    const f = floorOf(1);
    f.go(NO_INPUT, () => f.c().grounded, 60);
    f.go({ move: AHEAD }, () => f.at()[2]! < -5.4);
    f.chimney(6, AHEAD);
    expect(f.feet()).toBeGreaterThan(5.5);
    f.walkTo(0, -9.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 120)).toBe(true);
    expect(f.feet()).toBeGreaterThan(5.5);
    // To the pillar's edge, and at the block: its ledge, grabbed falling past it.
    f.walkTo(0, -14.1);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 8.5, 160)).toBe(true);
    f.walkTo(0, -19.6);
    f.jump(AHEAD, 8);
    f.chimney(15, AHEAD);
    // (Stage 5p) Across 2.5 m to a pillar; into a chimney 4 m wide over nothing, up it to the goal.
    f.walkTo(0, -27.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(14.5);
    f.walkTo(0, -32.4);
    f.jump(AHEAD, 8);
    f.chimney(24, AHEAD);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(f.session, "The tower's first floor, played to its goal: two chimneys, a jump over the void, a ledge."),
    ).toMatchFileSnapshot('../replays/floor-2.replay');
    f.session.world.dispose();
  });

  test('the second floor: a ferry under a chimney hanging over the void, up it, and a lift to the goal 14 m up', async () => {
    const f = floorOf(2);
    const ferry = () => f.named('ferry').transform!.position;
    const lift = () => f.named('lift').transform!.position[1]! + 0.15;
    f.go(NO_INPUT, () => f.c().grounded, 60);
    // The ferry, coming back towards the balcony (it left as the floor began): a running start, a jump at
    // the edge, onto it as it comes; and still on it to the chimney's mouth.
    f.walkTo(0, 3.8);
    f.go(NO_INPUT, () => ferry()[2]! < -6, 900);
    f.go(NO_INPUT, () => ferry()[2]! > -3.6, 900);
    f.go({ move: AHEAD }, () => f.at()[2]! < 2.35, 60);
    f.jump(AHEAD, 30);
    f.go({ move: AHEAD }, () => f.c().grounded, 60);
    expect(f.c().grounded).toBe(true);
    expect(f.at()[2]!).toBeLessThan(1.5);
    // At the ferry's end, between the chimney's walls: up it.
    f.go(NO_INPUT, () => ferry()[2]! < -10.9, 600);
    f.chimney(10, AHEAD);
    expect(f.feet()).toBeGreaterThan(9.5);
    // The lift, level with the terrace: a hop onto it; up with it; off it at its top, onto the goal's terrace.
    f.walkTo(0, -19.6);
    f.go(NO_INPUT, () => Math.abs(lift() - 10) < 0.25, 900);
    // (A hop: let go at once; and on, to its middle.)
    for (let i = 0; i < 22 && f.at()[2]! > -21.9; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    f.go(NO_INPUT, () => lift() > 12.8, 600);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 120)).toBe(true);
    expect(f.feet()).toBeGreaterThan(13.5);
    // (Stage 5p) The ferry off the terrace's far edge, waited for: onto it, across, onto the landing; the
    // lift from it, waited for at the bottom, up to the goal.
    const ferry3 = () => f.named('ferry_3').transform!.position;
    const lift2 = () => f.named('lift_2').transform!.position[1]! + 0.15;
    f.walkTo(0, -27.6);
    f.go(NO_INPUT, () => ferry3()[2]! < -33, 900);
    f.go(NO_INPUT, () => ferry3()[2]! > -29.2, 900);
    for (let i = 0; i < 20 && f.at()[2]! > -28.9; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    f.go(NO_INPUT, () => ferry3()[2]! < -36.8, 600);
    for (let i = 0; i < 40 && f.at()[2]! > -38.8; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-38.2);
    f.walkTo(0, -41.6);
    f.go(NO_INPUT, () => lift2() < 14.3, 900);
    for (let i = 0; i < 40 && f.at()[2]! > -42.9; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    f.go(NO_INPUT, () => lift2() > 19.8, 600);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's second floor, played to its goal: a ferry, a hanging chimney, a lift, a ferry, a lift.",
      ),
    ).toMatchFileSnapshot('../replays/floor-3.replay');
    f.session.world.dispose();
  });

  test('the third floor: a carousel, a faster one, a bar ridden half a turn, three turntables up to the goal', async () => {
    const f = floorOf(3);
    /** The bar's long side, from its yaw: along z (pointing this way and the other), |cos| near 0. */
    const barAcross = () => {
      const q = f.named('bar').transform!.rotation;
      return Math.abs(Math.cos(2 * Math.atan2(q[1]!, q[3]!)));
    };
    f.go(NO_INPUT, () => f.c().grounded, 60);
    // The carousel: off the balcony's edge onto it; near its far side; off it onto the landing.
    f.walkTo(0, 2.3);
    f.jump(AHEAD, 25);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    f.walkTo(0, -3);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-6.4);
    // The faster one, a meter up; off it onto the second landing, a meter higher.
    f.walkTo(0, -10.3);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    f.walkTo(0, -15.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(1.5);
    // The bar: as it comes to point this way, onto its end; ridden half a turn; off at the other side.
    f.walkTo(0, -24.3);
    f.go(NO_INPUT, () => barAcross() > 0.5, 900);
    f.go(NO_INPUT, () => barAcross() < 0.12, 900);
    f.walkTo(0, -25.6, 0.2, 40);
    f.go(NO_INPUT, () => f.at()[2]! < -34.3, 600);
    f.walkTo(0, -36.3, 0.2, 60);
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-35.4);
    // Three turntables, each a meter higher: onto each, to its middle, and on.
    f.walkTo(0, -39.3);
    for (const [name, z] of [
      ['turntable_1', -43],
      ['turntable_2', -46.5],
      ['turntable_3', -50],
    ] as const) {
      f.jump(AHEAD, 30);
      expect(
        f.go({ move: AHEAD }, () => f.c().grounded, 90),
        name,
      ).toBe(true);
      f.walkTo(0, z);
    }
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(f.session, "The tower's third floor, played to its goal: two carousels, the bar, three turntables."),
    ).toMatchFileSnapshot('../replays/floor-4.replay');
    f.session.world.dispose();
  });

  test('the fourth floor: a wall’s ledge, one across a gap, a running jump to a pillar, a drop, a stair of ledges to the goal', async () => {
    const f = floorOf(4);
    f.go(NO_INPUT, () => f.c().grounded, 60);
    f.walkTo(0, 2.6);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 2.5, 160)).toBe(true);
    // Across 2 m, a block 2.5 m higher: its ledge, grabbed leaping.
    f.walkTo(0, -1.9);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 5, 160)).toBe(true);
    // A running jump across 4 m onto a pillar a meter higher.
    f.walkTo(0, -4.3);
    f.go({ move: AHEAD, run: true }, () => f.at()[2]! < -7.8, 60);
    for (let i = 0; i < 30; i++) f.step({ move: AHEAD, run: true, jump: true });
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 6, 160)).toBe(true);
    // Down 3 m onto the landing.
    f.walkTo(0, -13.8);
    f.jump(AHEAD, 20);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() < 4, 120)).toBe(true);
    // The stair of ledges, each 3 m higher a meter on.
    for (const [edge, top] of [
      [-19.7, 6.5],
      [-23.9, 9.5],
      [-28.9, 12.5],
      [-33.9, 15.5],
    ] as const) {
      f.walkTo(0, edge);
      f.jump(AHEAD, 40);
      expect(
        f.go({ move: AHEAD }, () => f.done() || (f.c().grounded && f.feet() > top - 0.5), 160),
        `up to ${top}`,
      ).toBe(true);
    }
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's fourth floor, played to its goal: ledges, a running jump, a drop, a stair of ledges.",
      ),
    ).toMatchFileSnapshot('../replays/floor-5.replay');
    f.session.world.dispose();
  });

  test('the top: a ledge 3 m up, a chimney 3 m wide, a ferry to a landing and a lift from it, a chimney 3.6 m wide to a terrace 18 m up; a pillar, the last chimney 4.5 m wide to the summit 27 m up', async () => {
    const f = floorOf(5);
    const ferry = () => f.named('ferry').transform!.position;
    const lift = () => f.named('lift').transform!.position[1]! + 0.15;
    f.go(NO_INPUT, () => f.c().grounded, 60);
    // The ledge 3 m up, at the balcony's end; on it, chimney 1, up to terrace B.
    f.walkTo(0, 2.9);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 2.5, 160)).toBe(true);
    f.walkTo(0, -5.4);
    f.chimney(9, AHEAD);
    expect(f.feet()).toBeGreaterThan(8.5);
    // The ferry, back at the terrace: a hop onto it; at its end, a hop onto the landing.
    f.walkTo(0, -9.6);
    f.go(NO_INPUT, () => ferry()[2]! < -15, 900);
    f.go(NO_INPUT, () => ferry()[2]! > -11.6, 900);
    for (let i = 0; i < 40 && f.at()[2]! > -11.6; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-10.6);
    f.go(NO_INPUT, () => ferry()[2]! < -17.4, 600);
    for (let i = 0; i < 40 && f.at()[2]! > -19.6; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    expect(f.at()[2]!).toBeLessThan(-18.8);
    // The lift, at the bottom: a hop onto it; at its top, onto the terrace; to the last chimney.
    f.go(NO_INPUT, () => lift() < 9.3, 900);
    for (let i = 0; i < 40 && f.at()[2]! > -21.9; i++) f.step({ move: AHEAD, jump: i < 3 });
    expect(f.go(NO_INPUT, () => f.c().grounded, 60)).toBe(true);
    f.go(NO_INPUT, () => lift() > 14.85, 600);
    f.walkTo(0, -26.6);
    expect(f.feet()).toBeGreaterThan(14.5);
    f.walkTo(0, -30.4);
    f.chimney(18, AHEAD);
    // (Stage 5p) Across 2.5 m to a pillar; into the last chimney, 4.5 m wide, up it to the summit.
    f.walkTo(0, -34.6);
    f.jump(AHEAD, 30);
    expect(f.go({ move: AHEAD }, () => f.c().grounded, 90)).toBe(true);
    expect(f.feet()).toBeGreaterThan(17.5);
    f.walkTo(0, -39.4);
    f.jump(AHEAD, 8);
    f.chimney(27, AHEAD);
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's top, played to its goal: a ledge, a chimney, a ferry, a landing, a lift, the last chimney.",
      ),
    ).toMatchFileSnapshot('../replays/floor-6.replay');
    f.session.world.dispose();
  });
});

describe('the tower’s reference replays (stage 5d)', () => {
  test('one for each floor, of this simulation version', () => {
    expect(Object.keys(TOWER_REPLAYS).sort()).toEqual(TOWER_LEVEL_LIST.map((l) => l.id));
    for (const text of Object.values(TOWER_REPLAYS)) expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
  });

  test.each(Object.entries(TOWER_REPLAYS))('%s plays to the hash on its last line', (_, text) => {
    const { session, same } = playReplay(TOWER_CARTRIDGE, replayFromText(text));
    expect(same).toBe(true);
    session.world.dispose();
  });
});
