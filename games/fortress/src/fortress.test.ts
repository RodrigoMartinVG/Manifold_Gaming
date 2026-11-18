import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, NO_INPUT, type Entity, type Event, type PlayerInput } from '@manifold/core';
import { missingKeys, notesBetween } from '@manifold/presentation';
import { FORTRESS, FORTRESS_THEME, FORTRESS_WORDS } from './game';
import { levelOf } from './play';
import { FORTRESS as RULES } from './rules';

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
    f.session.world.place(f.me(), [0, 0.82, -2]);
    f.step();
    expect(f.r().checkpoint).toEqual([0, 1, -2]);
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
    expect(Math.hypot(f.at()[0]!, f.at()[2]! + 2)).toBeLessThan(0.1);
    expect(f.r().caught).toBe(1);
    expect(said).toContain('fortress.caught');
    f.session.world.dispose();
  });

  test('the keep’s way out counts only with the flame: without it, a line that says so; with it, done', () => {
    const f = levelOf(2);
    f.step();
    let said: string[] = [];
    const steps = (n: number) => {
      for (let i = 0; i < n; i++) {
        f.step();
        said = [...said, ...notices(f.session.world.stepEvents)];
      }
    };
    f.session.world.place(f.me(), [12, 0.82, -11]);
    steps(3);
    expect(f.done()).toBe(false);
    expect(said).toContain('fortress.need');
    // The guard at its post down (it would see the flame), the flame taken by its zone, and out again.
    f.session.world.hurt(f.guards()[0]!.id, 1000);
    f.session.world.place(f.me(), [0.3, 0.82, -17.2]);
    steps(3);
    expect([f.r().relic, f.me().lamp?.radius]).toEqual([true, RULES.flame.radius]);
    expect(said).toContain('fortress.flame');
    f.session.world.place(f.me(), [12, 0.82, -11]);
    steps(3);
    expect(f.done()).toBe(true);
    expect(FORTRESS.done(f.session.world, f.me())).toMatchObject({ stars: 1, falls: 0 });
    f.session.world.dispose();
  });

  test('seen by a guard on its feet, it was seen (no star); a guard down sees nothing', () => {
    const f = levelOf(2);
    f.step();
    // Before the guard at its post, the flame lighting it (it carries it): seen.
    f.session.world.place(f.me(), [0.3, 0.82, -17.2]);
    for (let i = 0; i < 3; i++) f.step();
    expect(f.r().seen).toBeGreaterThan(0);
    // Again, the guard down first: the same place, unseen.
    const g = levelOf(2);
    g.step();
    g.session.world.hurt(g.guards()[0]!.id, 1000);
    g.session.world.place(g.me(), [0.3, 0.82, -17.2]);
    for (let i = 0; i < 3; i++) g.step();
    expect(g.r().relic).toBe(true);
    expect(g.r().seen).toBe(0);
    f.session.world.dispose();
    g.session.world.dispose();
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

  test('its music, sparse (decision 0027): sneaking, a note begins on fewer than a fifth of the beats; alert, on a third at most; quiet once done', () => {
    const beats = FORTRESS_THEME.tempo;
    const share = (mood: string) => new Set(notesBetween(FORTRESS_THEME, mood, 0, beats).map((n) => n.beat)).size / beats;
    expect(share('sneak')).toBeGreaterThan(0);
    expect(share('sneak')).toBeLessThan(0.2);
    expect(share('alert')).toBeGreaterThan(share('sneak'));
    expect(share('alert')).toBeLessThanOrEqual(1 / 3);
    expect(notesBetween(FORTRESS_THEME, 'done', 0, beats)).toEqual([]);
  });
});
