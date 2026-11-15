import { beforeAll, describe, expect, test } from 'vitest';
import {
  initPhysics,
  NO_INPUT,
  playReplay,
  registryFor,
  replayFromText,
  replayOf,
  replayToText,
  Session,
  SIMULATION_VERSION,
  type Entity,
  type PlayerInput,
} from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { REFERENCE_REPLAYS } from './replays';

beforeAll(initPhysics);

/**
 * AN ACT of a reference run: console lines that enter at its first step (recorded as changes, like
 * typed ones), and then `steps` steps with what each player asks for (nothing, if not said).
 */
interface Act {
  lines?: string[] | ((s: Session) => string[]);
  steps: number;
  drive?: (step: number) => PlayerInput;
  second?: (step: number) => PlayerInput;
}

/** What a run went through: the course's notices, the modes, the steps carried by a platform, the balls. */
interface Seen {
  notices: string[];
  modes: Set<string>;
  carried: number;
  /** The most balls there were at once (thrown or dropped from the console). */
  balls: number;
}

const hero = (s: Session, player = 1): Entity | undefined =>
  [...s.world.entities.values()].find((e) => e.character?.player === player);

function run(recipe: string, acts: Act[]): { session: Session; seen: Seen } {
  const registry = registryFor(DojoCartridge);
  const errors = registry.run(recipe, 'recipe').filter((m) => m.level === 'error');
  expect(errors).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const seen: Seen = { notices: [], modes: new Set(), carried: 0, balls: 0 };
  for (const act of acts) {
    const lines = typeof act.lines === 'function' ? act.lines(session) : (act.lines ?? []);
    for (const line of lines) expect(session.registry.run(line, 'console').filter((m) => m.level === 'error')).toEqual([]);
    for (let step = 1; step <= act.steps; step++) {
      session.setInput(1, act.drive?.(step) ?? NO_INPUT);
      if (session.world.players.has(2)) session.setInput(2, act.second?.(step) ?? NO_INPUT);
      session.step();
      for (const ev of session.world.stepEvents) if (ev.type === 'notice') seen.notices.push(ev.text);
      const h = hero(session);
      if (h?.character) {
        seen.modes.add(h.character.mode);
        if (h.character.ground.velocity.some((v) => v !== 0)) seen.carried++;
      }
      const balls = [...session.world.entities.values()].filter((e) => e.body?.shape.kind === 'ball').length;
      seen.balls = Math.max(seen.balls, balls);
    }
  }
  return { session, seen };
}

/**
 * The replay as text, with a few comment lines after its header: what it is, and that it is not
 * edited by hand. (Comments are skipped when it is read.)
 */
function referenceText(session: Session, about: string): string {
  const [header, ...rest] = replayToText(replayOf(session)).split('\n');
  return [
    header,
    `# ${about}`,
    '# A reference replay (stage 2.5a): playing it must end with the hash on its last line. A refactor',
    '# keeps it bit for bit. Recorded by games/dojo/src/reference.test.ts; recorded again (npm run',
    '# references) only when the simulation changes on purpose, with SIMULATION_VERSION.',
    ...rest,
  ].join('\n');
}

/** Where the ferry is now (it is wherever its time says): to put a character on it. */
const ferryX = (s: Session) =>
  [...s.world.entities.values()].find((e) => e.mover && e.transform!.position[2] === 6)!.transform!.position[0];

const press = (at: number[]) => (step: number) => at.includes(step);
const fixed = (n: number) => n.toFixed(2);

describe('the reference replays (stage 2.5a), recorded from their scripts', () => {
  test('phase 0, the foundations: the empty Dojo, its cube spun from the console at given steps', async () => {
    const { session } = run('', [
      { steps: 60 },
      { lines: ['dojo.spin 0 2 0'], steps: 120 },
      { lines: ['dojo.spin 1.5 0 -0.5'], steps: 120 },
      { lines: ['dojo.spin 0 0 0'], steps: 60 },
    ]);
    expect(session.world.entities.size).toBe(2);
    await expect(referenceText(session, 'Phase 0: the empty Dojo, its cube spun from the console.')).toMatchFileSnapshot(
      '../replays/phase-0.replay',
    );
    session.world.dispose();
  });

  test('phase 1, physics and the character: walking, running, jumping, turning, throwing, the gravity, a second player', async () => {
    const { session, seen } = run('seed 7\ndojo.level course\ndojo.cubes 20', [
      { steps: 60 },
      // Walking, running, a jump while running.
      { steps: 60, drive: () => ({ move: [0, 0, -1] }) },
      { steps: 50, drive: (s) => ({ move: [0.4, 0, -1], run: true, jump: s === 20 }) },
      // Turning as in the old shooters: forward while turning left, then to the side, then on the spot.
      { steps: 60, drive: () => ({ ahead: 1, turn: -1 }) },
      { steps: 40, drive: () => ({ ahead: 1, side: 1 }) },
      { steps: 30, drive: () => ({ turn: 1 }) },
      // Looking somewhere, and throwing three balls (each press throws one).
      { steps: 60, drive: (s) => ({ face: [1, 0, 0], 'dojo.throw': press([5, 25, 45])(s) }) },
      // A second player joins, walks and jumps; balls fall from the console.
      {
        lines: ['players.join 2', 'dojo.spawn 1 4 2', 'dojo.spawn -2 5 0'],
        steps: 120,
        drive: (s) => ({ move: [-1, 0, 0.5], jump: s === 40 }),
        second: (s) => (s > 10 ? { move: [1, 0, 0], jump: s === 70 } : NO_INPUT),
      },
      // Moon gravity, a jump in it, and back to the Earth's.
      { lines: ['physics.gravity 0 -1.62 0'], steps: 150, drive: (s) => ({ jump: s === 10 }) },
      { lines: ['physics.gravity 0 -9.81 0', 'players.leave 2'], steps: 90 },
    ]);
    expect([...seen.modes].sort()).toEqual(['air', 'walk']);
    expect(seen.balls).toBe(5); // three thrown, two dropped
    expect(hero(session, 2)).toBeUndefined();
    await expect(
      referenceText(
        session,
        'Phase 1: the character walking, running, jumping, turning and throwing; the gravity; a second player.',
      ),
    ).toMatchFileSnapshot('../replays/phase-1.replay');
    session.world.dispose();
  });

  test('phase 2, capabilities: a checkpoint, a fall, the three stars, the goal, the platforms, values changed live', async () => {
    // (The room `capabilities`, written here: editing the room does not change the reference.)
    const { session, seen } = run('seed 2\ndojo.level course\ndojo.cubes 6\ndojo.climb on\ndojo.glide on\ndojo.doublejump on', [
      { steps: 30 },
      // The checkpoint (put on it), and a walk off the floor's west edge: back to it.
      { lines: ['dojo.goto 0 2 -4'], steps: 30 },
      { steps: 300, drive: (s) => (s < 180 ? { move: [-1, 0, 0] } : NO_INPUT) },
      // The tower, climbed: its star.
      { lines: ['dojo.goto 6 1 2'], steps: 300, drive: (s) => (s < 200 ? { move: [1, 0, 0] } : NO_INPUT) },
      // The island, gliding: its star.
      { lines: ['dojo.goto -3.5 4.5 -7'], steps: 300, drive: (s) => ({ move: [-1, 0, 0], jump: s > 1 }) },
      // The highest platform (the goal), and once landed, a second jump at the top of the first: its star.
      { lines: ['dojo.goto -3 4.5 -7'], steps: 140, drive: (s) => ({ jump: s === 20 || s === 60 }) },
      // The carousel: carried round looking the same way, walking on it, and a jump from it.
      { lines: ['dojo.goto -4.8 0.9 7'], steps: 150, drive: () => ({ face: [0, 0, -1] }) },
      { steps: 90, drive: (s) => ({ move: [0, 0, -0.5], jump: s === 30 }) },
      // The ferry, wherever it is: out over the void, and a walk off it.
      { lines: (s) => [`dojo.goto ${fixed(ferryX(s))} 1.2 6`], steps: 200 },
      { steps: 200, drive: (s) => (s < 60 ? { move: [0, 0, 1] } : NO_INPUT) },
      // Values changed live: no steering in the air, then no gliding.
      { lines: ['dojo.air 0'], steps: 90, drive: (s) => ({ jump: s === 5, move: s > 8 ? [1, 0, 0] : [0, 0, 0] }) },
      { lines: ['dojo.air 14', 'dojo.glide off'], steps: 90, drive: (s) => ({ jump: s >= 5 && s < 60 }) },
    ]);
    const has = (start: string) => seen.notices.filter((n) => n.startsWith(start)).length;
    expect(has('checkpoint')).toBe(1);
    expect(has('you fell')).toBe(2);
    expect(has('a star')).toBe(3);
    expect(has('the goal')).toBe(1);
    expect([...seen.modes].sort()).toEqual(['air', 'climb', 'glide', 'walk']);
    expect(seen.carried).toBeGreaterThan(300);
    await expect(
      referenceText(
        session,
        'Phase 2: the course with every capability: a checkpoint, falls, three stars, the goal, both platforms.',
      ),
    ).toMatchFileSnapshot('../replays/phase-2.replay');
    session.world.dispose();
  });
});

describe('the reference replays, as they are in their files', () => {
  test('there is one per phase, of this simulation version', () => {
    expect(Object.keys(REFERENCE_REPLAYS)).toEqual(['phase-0', 'phase-1', 'phase-2']);
    for (const text of Object.values(REFERENCE_REPLAYS))
      expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
  });

  test.each(Object.entries(REFERENCE_REPLAYS))('%s plays to the hash on its last line', (_, text) => {
    const { session, same } = playReplay(DojoCartridge, replayFromText(text));
    expect(same).toBe(true);
    session.world.dispose();
  });
});
