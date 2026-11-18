import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, type Event } from '@manifold/core';
import { missingKeys, notesBetween } from '@manifold/presentation';
import { WALL, WALL_THEME, WALL_WORDS } from './game';
import { levelOf } from './play';
import { attackers, paceOf, WALL as RULES } from './rules';

beforeAll(initPhysics);

const notices = (events: readonly Event[]) => events.flatMap((e) => (e.type === 'notice' ? [e.say] : []));

describe('the wall, on the games’ shell (stage 5h)', () => {
  test('its waves: the first a few seconds in; the next a few seconds after the last attacker is down, the defender’s health back; after the last, held', () => {
    const f = levelOf(0);
    let said: string[] = [];
    const steps = (n: number) => {
      for (let i = 0; i < n; i++) {
        f.step();
        said = [...said, ...notices(f.session.world.stepEvents)];
      }
    };
    steps(RULES.first * 60 - 2);
    expect([f.h().wave, attackers(f.world()).length]).toEqual([0, 0]);
    steps(3);
    expect(f.h().wave).toBe(1);
    expect(attackers(f.world()).length).toBe(2);
    expect(said).toContain('wall.wave');
    // Hurt, and every attacker down: the next wave later, its health back.
    f.world().hurt(f.me().id, 40);
    f.session.registry.run('wall.down', 'console');
    steps(2);
    expect(attackers(f.world()).length).toBe(0);
    steps(RULES.between * 60 + 2);
    expect(f.h().wave).toBe(2);
    expect(f.me().health!.points).toBe(f.me().health!.most);
    for (let w = 2; w <= f.h().waves; w++) {
      f.session.registry.run('wall.down', 'console');
      steps(RULES.between * 60 + 4);
    }
    expect(f.done()).toBe(true);
    expect(said).toContain('wall.held');
    f.session.world.dispose();
  });

  test('down, the defender is back at its checkpoint three seconds later, on its feet, the time counted', () => {
    const f = levelOf(0);
    f.step();
    f.world().place(f.me(), [6, 0.82, -6]);
    f.step();
    f.world().hurt(f.me().id, 1000);
    for (let i = 0; i < RULES.back * 60 + 2; i++) f.step();
    expect(f.me().health!.down).toBe(-1);
    expect(Math.hypot(f.at()[0]!, f.at()[2]! - 7)).toBeLessThan(0.1);
    expect(f.h().downs).toBe(1);
    f.session.world.dispose();
  });

  test('a rising pace, fair: quicker each wave, a warning before every shot, two at once at most', () => {
    for (let p = 1; p < 12; p++) {
      const [a, b] = [paceOf(p - 1), paceOf(p)];
      expect(b.see).toBeLessThanOrEqual(a.see);
      expect(b.every).toBeLessThanOrEqual(a.every);
      expect(b.fair!.windup).toBeLessThanOrEqual(a.fair!.windup);
      expect(b.fair!.spread).toBeLessThanOrEqual(a.fair!.spread);
    }
    // From 0.6 s to see and 0.5 s raised (3.5 degrees), to 0.3 and 0.3 (1.5 degrees); never two at once more.
    expect(paceOf(0)).toMatchObject({ see: 36, every: 90, fair: { windup: 30, spread: 3.5, lag: 12, tokens: 2 } });
    expect(paceOf(20)).toMatchObject({ see: 18, every: 45, aim: 0.3, fair: { windup: 18, spread: 1.5, tokens: 2 } });
  });

  test('its words: the same keys in Spanish and English, and every key the game names among them', () => {
    expect(missingKeys(WALL_WORDS)).toEqual([]);
    const named = [
      WALL.title,
      WALL.tagline,
      ...WALL.levels.map((l) => l.name),
      ...[...WALL.thread.opening, ...WALL.thread.ending].flatMap((l) => [l.who, l.say]),
      'wall.wave',
      'wall.down',
      'wall.held',
    ];
    for (const key of named) expect(WALL_WORDS.es, key).toHaveProperty([key]);
  });

  test('its music, sparse (decision 0027): waiting, a note begins on fewer than a fifth of the beats; fighting, on a third at most; quiet once held', () => {
    const beats = WALL_THEME.tempo;
    const share = (mood: string) => new Set(notesBetween(WALL_THEME, mood, 0, beats).map((n) => n.beat)).size / beats;
    expect(share('wait')).toBeGreaterThan(0);
    expect(share('wait')).toBeLessThan(0.2);
    expect(share('fight')).toBeGreaterThan(share('wait'));
    expect(share('fight')).toBeLessThanOrEqual(1 / 3);
    expect(notesBetween(WALL_THEME, 'done', 0, beats)).toEqual([]);
  });
});
