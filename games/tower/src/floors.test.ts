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
import { TOWER } from './game';
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

describe('the tower’s four floors, played to their goal (stage 5d)', () => {
  test('the entrance: a hop, a ledge 3 m up, a chimney 2.4 m wide to the terrace 6 m up', async () => {
    const f = floorOf(0);
    f.go(NO_INPUT, () => f.c().grounded, 60);
    f.go({ move: AHEAD }, () => f.at()[2]! < 4.2);
    f.jump(AHEAD, 25);
    f.go({ move: AHEAD }, () => f.at()[2]! < -0.9);
    f.jump(AHEAD, 40);
    expect(f.go({ move: AHEAD }, () => f.c().grounded && f.feet() > 2.5, 120)).toBe(true);
    f.go({ move: AHEAD }, () => f.c().grounded && f.at()[2]! < -12.5);
    f.chimney(6, AHEAD);
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
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(f.session, "The tower's second floor, played to its goal: a ferry, a hanging chimney, a lift."),
    ).toMatchFileSnapshot('../replays/floor-3.replay');
    f.session.world.dispose();
  });

  test('the top: a ledge 3 m up, a chimney 3 m wide, a ferry to a landing and a lift from it, the last chimney 3.6 m wide to the top 18 m up', async () => {
    const f = floorOf(3);
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
    expect(f.go({ move: AHEAD }, () => f.done(), 240)).toBe(true);
    expect(runner(f.me())!.falls).toBe(0);
    await expect(
      referenceText(
        f.session,
        "The tower's top, played to its goal: a ledge, a chimney, a ferry, a landing, a lift, the last chimney.",
      ),
    ).toMatchFileSnapshot('../replays/floor-4.replay');
    f.session.world.dispose();
  });
});

describe('the tower’s reference replays (stage 5d)', () => {
  test('one for each floor, of this simulation version', () => {
    expect(Object.keys(TOWER_REPLAYS).sort()).toEqual(TOWER.levels.map((l) => l.id));
    for (const text of Object.values(TOWER_REPLAYS)) expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
  });

  test.each(Object.entries(TOWER_REPLAYS))('%s plays to the hash on its last line', (_, text) => {
    const { session, same } = playReplay(TOWER.cartridge, replayFromText(text));
    expect(same).toBe(true);
    session.world.dispose();
  });
});
