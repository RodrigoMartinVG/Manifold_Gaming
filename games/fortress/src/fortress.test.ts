import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, NO_INPUT, type Entity, type Event, type PlayerInput } from '@manifold/core';
import { noticeOf, pouch, secondsToNotice } from '@manifold/arms';
import { missingKeys, notesBetween } from '@manifold/presentation';
import { FORTRESS, FORTRESS_THEME, FORTRESS_WORDS } from './game';
import { levelOf } from './play';
import { AWARE, FORTRESS as RULES } from './rules';

beforeAll(initPhysics);

const notices = (events: readonly Event[]) => events.flatMap((e) => (e.type === 'notice' ? [e.say] : []));

/**
 * (Stage 5k) A jump on the spot, held to its top: how high its feet went (m), when they got there and
 * when it stood again (s, at 60 steps a second).
 */
function jumpOf(f: { me(): Entity; at(): readonly number[]; step(input?: PlayerInput): void }) {
  for (let i = 0; i < 30 && !f.me().character!.grounded; i++) f.step();
  const ground = f.at()[1]!;
  let top = ground;
  let topAt = 0;
  for (let k = 1; k < 120; k++) {
    f.step({ ...NO_INPUT, jump: true });
    const y = f.at()[1]!;
    if (y > top + 1e-9) [top, topAt] = [y, k];
    if (k > 5 && f.me().character!.grounded) return { height: top - ground, top: topAt / 60, landed: k / 60 };
  }
  throw new Error('it never came down');
}

describe('the fortress, on the games’ shell (stage 5f)', () => {
  test('caught (down), the intruder is back at its checkpoint three seconds later, on its feet, the time counted', () => {
    const f = levelOf(0);
    f.step();
    f.session.world.place(f.me(), [-3, 0.82, -2.5]);
    f.step();
    expect(f.r().checkpoint).toEqual([-3, 1, -2.5]);
    f.session.world.place(f.me(), [6, 0.82, -10]);
    f.step();
    f.session.world.hurt(f.me().id, 1000);
    expect(f.me().health!.down).toBeGreaterThanOrEqual(0);
    let said: string[] = [];
    for (let i = 0; i < RULES.back * 60 + 2; i++) {
      f.step();
      said = [...said, ...notices(f.session.world.stepEvents)];
    }
    expect(f.me().health!.down).toBe(-1);
    expect(Math.hypot(f.at()[0]! + 3, f.at()[2]! + 2.5)).toBeLessThan(0.1);
    expect(f.r().caught).toBe(1);
    expect(said).toContain('fortress.caught');
    f.session.world.dispose();
  });

  test('the keep’s way out counts only with the flame: without it, a line that says so; with it, done', () => {
    const f = levelOf(3);
    f.step();
    let said: string[] = [];
    const steps = (n: number) => {
      for (let i = 0; i < n; i++) {
        f.step();
        said = [...said, ...notices(f.session.world.stepEvents)];
      }
    };
    f.session.world.place(f.me(), [-15.5, 0.82, -2]);
    steps(3);
    expect(f.done()).toBe(false);
    expect(said).toContain('fortress.need');
    // The guard at its post down (it would see the flame), the flame taken by its zone, and out again.
    f.session.world.hurt(f.guards()[0]!.id, 1000);
    f.session.world.place(f.me(), [0.3, 0.82, -36.4]);
    steps(3);
    expect([f.r().relic, f.me().lamp?.radius]).toEqual([true, RULES.flame.radius]);
    expect(said).toContain('fortress.flame');
    f.session.world.place(f.me(), [-15.5, 0.82, -2]);
    steps(3);
    expect(f.done()).toBe(true);
    expect(FORTRESS.done(f.session.world, f.me())).toMatchObject({ stars: 1, falls: 0 });
    f.session.world.dispose();
  });

  test('seen (stage 5l): a glimpse is not; a moment longer in its sight, the guard is suspicious (“huh?”), then alerted (it shouts), and that is being seen (no star); a guard down sees nothing', () => {
    const f = levelOf(3);
    f.step();
    const g0 = () => f.guards()[0]!;
    const n = () => noticeOf(g0())!;
    const said: string[] = [];
    const steps = (k: number) => {
      for (let i = 0; i < k; i++) {
        f.step();
        for (const ev of f.world().stepEvents) if (ev.type === 'sound' && ev.source === g0().id) said.push(ev.sound);
      }
    };
    // The flame taken behind the guard at its post (it faces the hall), then before it, the flame lighting
    // it (it carries it): a glimpse, three steps.
    f.session.world.place(f.me(), [0.3, 0.82, -36.4]);
    steps(2);
    expect(f.r().relic).toBe(true);
    f.session.world.place(f.me(), [0.3, 0.82, -29.6]);
    steps(3);
    expect(n().level).toBeGreaterThan(0);
    expect([n().state, f.r().seen]).toEqual(['calm', 0]);
    // A moment longer: suspicious, then alerted; seen once.
    for (let i = 0; i < 60 && n().state !== 'alerted'; i++) steps(1);
    expect(n().state).toBe('alerted');
    // (Its shout is its brain's, the step after.)
    steps(3);
    expect(said.indexOf('huh')).toBeGreaterThanOrEqual(0);
    expect(said.indexOf('huh')).toBeLessThan(said.indexOf('shout'));
    expect(f.r().seen).toBe(1);
    // Again, the guard down first: the same place, unseen.
    const g = levelOf(3);
    g.step();
    g.session.world.hurt(g.guards()[0]!.id, 1000);
    g.session.world.place(g.me(), [0.3, 0.82, -36.4]);
    for (let i = 0; i < 3; i++) g.step();
    expect(g.r().relic).toBe(true);
    expect(g.r().seen).toBe(0);
    f.session.world.dispose();
    g.session.world.dispose();
  });

  test('a guard’s awareness (stage 5l): sure in a fraction of a second near and in light, in seconds at the edge of its sight in the dark; warier, sooner', () => {
    // Right by it, as lit as it can count: a seventh of a second; at its sight's edge (12 m), barely lit: two.
    expect(secondsToNotice(AWARE, 0, 12, 2.5)).toBeCloseTo(0.14, 6);
    expect(secondsToNotice(AWARE, 12, 12, 1)).toBeCloseTo(2, 6);
    expect(secondsToNotice(AWARE, 6, 12, 1)).toBeCloseTo(1.175, 6);
    // Brighter than 2.5 counts as 2.5; farther than its sight as its edge; warier, 0.6 of it.
    expect(secondsToNotice(AWARE, 0, 12, 9)).toBe(secondsToNotice(AWARE, 0, 12, 2.5));
    expect(secondsToNotice(AWARE, 30, 12, 1)).toBe(secondsToNotice(AWARE, 12, 12, 1));
    expect(secondsToNotice(AWARE, 6, 12, 1, true)).toBeCloseTo(0.6 * 1.175, 6);
  });

  test('suspicious and out of its sight, one gets away: the guard goes to look, then lets it go (“nothing”); alerted and lost, it searches, then goes back warier', () => {
    const f = levelOf(3);
    f.step();
    const g0 = () => f.guards()[0]!;
    const n = () => noticeOf(g0())!;
    const post = [...g0().transform!.position];
    const said: string[] = [];
    const steps = (k: number, until: () => boolean = () => false) => {
      for (let i = 0; i < k && !until(); i++) {
        f.step();
        for (const ev of f.world().stepEvents) if (ev.type === 'sound' && ev.source === g0().id) said.push(ev.sound);
      }
    };
    /**
     * Put somewhere at once, and a step of the world before its guards think: its eyes then are of where it
     * is now (a brain thinking first reads the eyes of the step before with where it is now: it would know
     * where it went, as no one who walks there could make it).
     */
    const put = (at: number[]) => {
      f.session.world.place(f.me(), at as [number, number, number]);
      f.session.step();
    };
    // The flame taken behind it, then before it, lit by the flame.
    put([0.3, 0.82, -36.4]);
    put([0.3, 0.82, -29.6]);
    steps(60, () => n().state === 'suspicious');
    expect(n().state).toBe('suspicious');
    // Gone (back at the level's start, out of its sight): it goes to look, and in a few seconds lets it go.
    put([...f.r().spawn]);
    steps(600, () => n().state === 'calm');
    expect(n().state).toBe('calm');
    expect(said).toContain('calm');
    expect(Math.hypot(g0().transform!.position[0] - post[0]!, g0().transform!.position[2] - post[2]!)).toBeGreaterThan(0.5);
    expect(f.r().seen).toBe(0);
    // Alerted, then lost: three seconds on it searches, ten more and it is back, warier for half a minute.
    put([0.3, 0.82, -29.6]);
    steps(120, () => n().state === 'alerted');
    expect(n().state).toBe('alerted');
    put([...f.r().spawn]);
    steps(400, () => n().state === 'searching');
    expect(n().state).toBe('searching');
    steps(900, () => n().state === 'calm');
    expect(n().state).toBe('calm');
    expect(n().until - f.world().tick).toBeGreaterThan(60 * (AWARE.waryFor - 1));
    f.session.world.dispose();
  });

  test('a pebble (stage 5l): thrown, where it first strikes a clatter is heard 10 m round; three in the pouch, one gone', () => {
    const f = levelOf(0);
    f.step();
    expect(pouch(f.me())!.pebble).toBe(3);
    f.pebble(0.2);
    expect(pouch(f.me())!.pebble).toBe(2);
    let heard: { radius: number } | undefined;
    for (let i = 0; i < 180 && !heard; i++) {
      f.step();
      heard = f.world().stepEvents.find((ev) => ev.type === 'sound' && ev.sound === 'pebble') as { radius: number } | undefined;
    }
    expect(heard?.radius).toBe(10);
    f.session.world.dispose();
  });

  test('its jump, grounded (stage 5k): its feet 1.1 m up in 0.36 s, on its feet again in about 0.66 s, no longer 2 m on the world’s gravity', () => {
    const j = jumpOf(levelOf(0));
    expect(j.height).toBeCloseTo(1.1, 1);
    expect(j.top).toBeCloseTo(0.36, 1);
    expect(j.landed).toBeGreaterThan(0.6);
    expect(j.landed).toBeLessThan(0.72);
  });

  test('its words: the same keys in Spanish and English, and every key the game names among them', () => {
    expect(missingKeys(FORTRESS_WORDS)).toEqual([]);
    const named = [
      FORTRESS.title,
      FORTRESS.tagline,
      ...FORTRESS.levels.map((l) => l.name),
      ...[...FORTRESS.thread.opening, ...FORTRESS.thread.ending].flatMap((l) => [l.who, l.say]),
      'fortress.caught',
      'fortress.checkpoint',
      'fortress.flame',
      'fortress.need',
    ];
    for (const key of named) expect(FORTRESS_WORDS.es, key).toHaveProperty([key]);
  });

  test('its music, sparse (decision 0027), in tiers (5l): sneaking, a note begins on fewer than a fifth of the beats; wary, more; alert, more still, a third at most; quiet once done', () => {
    const beats = FORTRESS_THEME.tempo;
    const share = (mood: string) => new Set(notesBetween(FORTRESS_THEME, mood, 0, beats).map((n) => n.beat)).size / beats;
    expect(share('sneak')).toBeGreaterThan(0);
    expect(share('sneak')).toBeLessThan(0.2);
    expect(share('wary')).toBeGreaterThan(share('sneak'));
    expect(share('alert')).toBeGreaterThan(share('wary'));
    expect(share('alert')).toBeLessThanOrEqual(1 / 3);
    expect(notesBetween(FORTRESS_THEME, 'done', 0, beats)).toEqual([]);
  });
});
