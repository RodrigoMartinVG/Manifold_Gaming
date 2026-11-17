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
  /** How high each ball went (its center, m), in the order they were made. */
  heights: Map<number, number>;
  /** Where player 1 was (its z) each time a watcher saw it. */
  seenAt: number[];
  /** How many events of each kind there were. */
  kinds: Record<string, number>;
  /** Player 1's mode at each step, and where it was (its z). */
  trail: { z: number; mode: string }[];
}

const hero = (s: Session, player = 1): Entity | undefined =>
  [...s.world.entities.values()].find((e) => e.character?.player === player);

function run(recipe: string, acts: Act[]): { session: Session; seen: Seen } {
  const registry = registryFor(DojoCartridge);
  const errors = registry.run(recipe, 'recipe').filter((m) => m.level === 'error');
  expect(errors).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const seen: Seen = {
    notices: [],
    modes: new Set(),
    carried: 0,
    balls: 0,
    heights: new Map(),
    seenAt: [],
    trail: [],
    kinds: {},
  };
  for (const act of acts) {
    const lines = typeof act.lines === 'function' ? act.lines(session) : (act.lines ?? []);
    for (const line of lines) expect(session.registry.run(line, 'console').filter((m) => m.level === 'error')).toEqual([]);
    for (let step = 1; step <= act.steps; step++) {
      session.setInput(1, act.drive?.(step) ?? NO_INPUT);
      if (session.world.players.has(2)) session.setInput(2, act.second?.(step) ?? NO_INPUT);
      session.step();
      const h = hero(session);
      for (const ev of session.world.stepEvents) seen.kinds[ev.type] = (seen.kinds[ev.type] ?? 0) + 1;
      for (const ev of session.world.stepEvents)
        if (ev.type === 'notice') {
          seen.notices.push([ev.say, ...(ev.values ?? [])].join(' '));
          if (ev.say === 'dojo.seen' && h?.transform) seen.seenAt.push(h.transform.position[2]);
        }
      if (h?.character) {
        seen.trail.push({ z: h.transform!.position[2], mode: h.character.mode });
        seen.modes.add(h.character.mode);
        if (h.character.ground.velocity.some((v) => v !== 0)) seen.carried++;
      }
      const balls = [...session.world.entities.values()].filter((e) => e.body?.shape.kind === 'ball');
      seen.balls = Math.max(seen.balls, balls.length);
      for (const b of balls) seen.heights.set(b.id, Math.max(seen.heights.get(b.id) ?? -Infinity, b.transform!.position[1]));
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
      { lines: ['dojo.goto 6 1 2'], steps: 300, drive: (s) => (s < 175 ? { move: [1, 0, 0] } : NO_INPUT) },
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
    expect(has('dojo.checkpoint')).toBe(1);
    expect(has('dojo.fell')).toBe(2);
    expect(has('dojo.star')).toBe(3);
    expect(has('dojo.goal')).toBe(1);
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

  test('phase 3, a world that responds: a button opens a door, plates call a lift, and the lift takes the character up', async () => {
    // (The room `machines`, written here: editing the room's recipe does not change the reference.)
    const signal = (s: Session, name: string) => s.world.signal(name);
    const { session, seen } = run('seed 5\ndojo.level machines', [
      { steps: 30 },
      // The shut door stops the walk; the button (E in front of it) opens it, and the way is free.
      { lines: ['dojo.goto 3 1 3.5'], steps: 60, drive: () => ({ move: [0, 0, -1] }) },
      { lines: ['dojo.goto 4.4 1 2.7'], steps: 80, drive: (s) => ({ use: s === 10 }) },
      { lines: ['dojo.goto 3 1 3.5'], steps: 90, drive: () => ({ move: [0, 0, -1] }) },
      // Onto the lift: it goes up; off it, onto the ledge, to the star.
      { lines: ['dojo.goto 7 1.2 -4'], steps: 200 },
      { steps: 40, drive: (s) => (s < 30 ? { move: [0.25, 0, -1] } : NO_INPUT) },
      // Down to the plate beside the lift: it comes down.
      { lines: ['dojo.goto 4.6 1 -4'], steps: 220 },
    ]);
    expect(signal(session, 'gate')).toBe(1);
    expect(seen.notices.filter((n) => n.startsWith('dojo.star'))).toHaveLength(1);
    expect(session.world.named('lift')!.transform!.position[1]).toBeCloseTo(0.15, 4);
    expect(seen.carried).toBeGreaterThan(150);
    await expect(
      referenceText(session, 'Phase 3: the machines: a button that opens a door, plates that call a lift, a ride up to a star.'),
    ).toMatchFileSnapshot('../replays/phase-3.replay');
    session.world.dispose();
  });

  test("phase 3, the light and the phase's demonstration: seen in the light, lost in the dark, behind a pillar and in a fog; a lamp switched on, and one broken by a ball", async () => {
    // (The room `watch`, written here.) How lit the character is goes into the hash at every step: this
    // replay is what checks, in every browser, that the light is the same as in Node.
    const { session, seen } = run('seed 8\ndojo.level watch', [
      { steps: 30 },
      // Into the pool on the left: seen. Back into the dark: lost.
      { lines: ['dojo.goto -4 1 3'], steps: 40 },
      { steps: 70, drive: (s) => (s < 50 ? { move: [1, 0, 1] } : NO_INPUT) },
      // Behind the pillar, lit: unseen; a step aside: seen.
      { lines: ['dojo.goto -3 1 -5.5'], steps: 40 },
      { steps: 30, drive: (s) => (s < 6 ? { move: [1, 0, 0] } : NO_INPUT) },
      // Into the fog bank from beside it.
      { lines: ['dojo.goto 5.6 1 5'], steps: 40 },
      { steps: 60, drive: (s) => (s < 12 ? { move: [-1, 0, 0] } : NO_INPUT) },
      // The switch, and the pool it lights.
      { lines: ['dojo.goto -5.4 1 6.2'], steps: 40, drive: (s) => ({ use: s === 20 }) },
      { lines: ['dojo.goto 3 1 -3'], steps: 60 },
      // The demonstration (stage 3e): in the near pool, seen, a ball thrown at its lamp breaks it; its
      // light goes out, and the eye loses the character.
      { lines: ['dojo.goto -4 1 4.5'], steps: 40, drive: (s) => (s === 30 ? { move: [0, 0, -0.2] } : NO_INPUT) },
      { steps: 60, drive: (s) => ({ 'dojo.throw': s === 5 }) },
    ]);
    // Seen in the pool, lost in the dark; seen a step aside from the pillar (still, beside the fog), lost
    // in it; seen in the pool the switch lit (still, in the near one); lost when its lamp broke.
    expect(seen.notices.filter((n) => n === 'dojo.seen' || n === 'dojo.lost')).toEqual([
      'dojo.seen',
      'dojo.lost',
      'dojo.seen',
      'dojo.lost',
      'dojo.seen',
      'dojo.lost',
    ]);
    expect(session.world.named('lamp_switch')!.lamp!.on).toBe(true);
    expect(session.world.named('lamp_near')!.breakable!.broken).toBe(true);
    expect(session.world.signal('spotted')).toBe(0);
    await expect(
      referenceText(
        session,
        "Phase 3, the light and the phase's demonstration: seen in the light, lost in the dark, behind a pillar and in a fog; a lamp switched on, and one broken by a ball.",
      ),
    ).toMatchFileSnapshot('../replays/phase-3-light.replay');
    session.world.dispose();
  });
});

describe('the reference replays of phase 4, growing with it', () => {
  test('phase 4, what a body can do (from 4b): aiming up and down, a ball thrown where it aims; crouching under a low passage; seen later crouched; rolling; a training dummy hurt, down and back', async () => {
    // The room `moves`, written here. On its open floor, looking at −Z: up, a little down, and almost
    // straight up, each throw where it aims (its pitch, a quarter turn per unit); the last one looking
    // at +X.
    // (A throw goes when it is let go: pressed at step 5, it leaves at step 6, a tap.)
    const aimed =
      (pitch: number, face: [number, number, number] = [0, 0, -1]) =>
      (s: number) => ({
        face,
        pitch,
        'dojo.throw': s === 5,
      });
    let struckAfterTap = -1;
    const { session, seen } = run('seed 9\ndojo.level moves', [
      { steps: 30 },
      { steps: 90, drive: aimed(0.4) },
      { steps: 90, drive: aimed(-0.15) },
      { steps: 120, drive: aimed(0.8, [1, 0, 0]) },
      // Standing, into the low passage along −Z: it does not fit; crouched, it passes, letting go of
      // crouch halfway (it stays low until it is out), and stands.
      { lines: ['dojo.goto 0 1 2'], steps: 120, drive: () => ({ move: [0, 0, -1] }) },
      // (Two seconds crouched at 2 m/s: from z = 2, to about the middle of the passage.)
      { lines: ['dojo.goto 0 1 2'], steps: 240, drive: (s) => ({ move: [0, 0, -1], crouch: s < 120 }) },
      // Rolling: on the open floor, looking at −Z (told), a roll to its right; then into the passage,
      // where it ends under the slab: it crouches on, out of it, and stands.
      { lines: ['dojo.goto -5 1 2'], steps: 80, drive: (s) => ({ face: [0, 0, -1], move: [1, 0, 0], roll: s === 30 }) },
      { lines: ['dojo.goto 0 1 2'], steps: 200, drive: (s) => ({ move: [0, 0, -1], roll: s === 30 }) },
      // The charge: from the start, aiming a little up at the target 15 m ahead, a tap (short of it),
      // then a throw held a second (it gets there, and its lamp lights for good).
      { lines: ['dojo.goto -5 1 6'], steps: 150, drive: (s) => ({ face: [0, 0, -1], pitch: 0.11, 'dojo.throw': s === 30 }) },
      {
        lines: (s) => {
          struckAfterTap = s.world.signal('struck');
          return [];
        },
        steps: 180,
        drive: (s) => ({ face: [0, 0, -1], pitch: 0.11, 'dojo.throw': s >= 10 && s < 75 }),
      },
      // The training dummy (stage 4c): from 3 m, a tap every half second until it goes down; three
      // seconds later, it is back.
      { lines: ['dojo.goto -5 1 2'], steps: 600, drive: (s) => ({ face: [-1, 0, 0], 'dojo.throw': s > 20 && s % 30 === 0 }) },
      // From the far end towards the lamp: standing, then (from the dark again) crouched.
      { lines: ['dojo.goto 5 1 9.5'], steps: 150, drive: () => ({ move: [0, 0, -1] }) },
      { lines: ['dojo.goto 5 1 9.5'], steps: 60 },
      { steps: 260, drive: () => ({ move: [0, 0, -1], crouch: true }) },
    ]);
    const c = hero(session)!.character!;
    expect(c.facing).toEqual([0, 0, -1]);
    // Thrown from the chest (1.2 m up): up at 36°, it rises about 2.7 m; at −13.5°, hardly at all; at
    // 72°, about 4.4 m.
    const [up, low, high] = [...seen.heights.values()];
    expect(seen.heights.size).toBeGreaterThan(8);
    expect(up! - 1.2).toBeGreaterThan(2.4);
    expect(low! - 1.2).toBeLessThan(0.1);
    expect(high! - 1.2).toBeGreaterThan(4);
    // Under the slab (z from 0 to −4, and the body's radius past each end), always low (crouched, or
    // rolling); out of it, standing again. (Standing, it stopped before it.)
    const under = seen.trail.filter((t) => t.z < -0.3 && t.z > -3.7);
    expect(under.length).toBeGreaterThan(100);
    expect(new Set(under.map((t) => t.mode))).toEqual(new Set(['crouch', 'roll']));
    // Two rolls, each its 36 steps.
    expect(seen.trail.filter((t) => t.mode === 'roll')).toHaveLength(72);
    expect(seen.trail.some((t) => t.z < -4.5 && t.mode === 'walk')).toBe(true);
    // The dummy went down once, and came back.
    expect(seen.kinds.hurt).toBeGreaterThan(3);
    expect(seen.kinds.down).toBe(1);
    expect(seen.kinds.revived).toBe(1);
    // The tap fell short of the target; the throw held a second reached it.
    expect(struckAfterTap).toBe(0);
    expect(session.world.signal('struck')).toBe(1);
    // Seen standing about 5 m from the lamp (at z = 0); crouched, under 2 m.
    expect(seen.seenAt).toHaveLength(2);
    expect(seen.seenAt[0]).toBeGreaterThan(4.5);
    expect(seen.seenAt[1]).toBeLessThan(2);
    expect(seen.notices.filter((n) => n === 'dojo.seen' || n === 'dojo.lost')).toEqual(['dojo.seen', 'dojo.lost', 'dojo.seen']);
    await expect(
      referenceText(
        session,
        'Phase 4, what a body can do: aiming up and down, a ball thrown where it aims; crouching under a low passage; seen later crouched; rolling, into the passage too; a training dummy hurt by balls, down, and back.',
      ),
    ).toMatchFileSnapshot('../replays/phase-4.replay');
    session.world.dispose();
  });
});

describe('the reference replays, as they are in their files', () => {
  test('there is one per phase (two for phase 3: its machines and its light), of this simulation version', () => {
    expect(Object.keys(REFERENCE_REPLAYS)).toEqual(['phase-0', 'phase-1', 'phase-2', 'phase-3', 'phase-3-light', 'phase-4']);
    for (const text of Object.values(REFERENCE_REPLAYS))
      expect(text.split('\n')[0]).toBe(`# Manifold replay ${SIMULATION_VERSION}`);
  });

  test.each(Object.entries(REFERENCE_REPLAYS))('%s plays to the hash on its last line', (_, text) => {
    const { session, same } = playReplay(DojoCartridge, replayFromText(text));
    expect(same).toBe(true);
    session.world.dispose();
  });
});
