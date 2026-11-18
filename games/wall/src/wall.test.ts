import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, NO_INPUT, type Entity, type Event, type PlayerInput } from '@manifold/core';
import { arsenal, ATTACK, SLOTS, weapon } from '@manifold/arms';
import { missingKeys, notesBetween } from '@manifold/presentation';
import { WALL, WALL_THEME, WALL_WORDS } from './game';
import { levelOf } from './play';
import { attackers, paceOf, ROLES, WALL as RULES } from './rules';

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

describe('the wall, on the games’ shell (stage 5h)', () => {
  test('a key opens its door (stage 5n): taken, its signal on; before the door, it opens, and stays open', () => {
    const f = levelOf(0);
    f.step();
    const door = () => f.world().named('red_door')!;
    const closed = [...door().transform!.rotation];
    // Before the door without the key: it stays shut.
    f.world().place(f.me(), [0, 0.82, -19.5]);
    for (let i = 0; i < 90; i++) f.step();
    expect(door().transform!.rotation).toEqual(closed);
    // The key, its notice; before the door again: it opens; gone from before it, it stays open.
    const said: string[] = [];
    f.world().place(f.me(), [-15, 0.82, -31]);
    for (let i = 0; i < 3; i++) {
      f.step();
      said.push(...notices(f.world().stepEvents));
    }
    expect([f.h().keys, f.world().signal('key_red')]).toEqual([1, 1]);
    expect(said).toContain('wall.key');
    f.world().place(f.me(), [0, 0.82, -19.5]);
    for (let i = 0; i < 90; i++) f.step();
    expect(door().transform!.rotation).not.toEqual(closed);
    f.world().place(f.me(), [0, 0.82, -5]);
    for (let i = 0; i < 90; i++) f.step();
    expect(door().transform!.rotation).not.toEqual(closed);
    f.session.world.dispose();
  });

  test('what is taken (stage 5n): health up to the most, armor that takes half of each hit, ammunition up to what one carries, a weapon’s rack once', () => {
    const f = levelOf(0);
    f.step();
    // Hurt, then the storeroom's health: 25 back, never past the most.
    f.world().hurt(f.me().id, 40);
    f.world().place(f.me(), [16.5, 0.82, -18]);
    f.step();
    expect(f.me().health!.points).toBe(85);
    // The secret alcove's armor: 50; a hit of 20 takes 10 from it and 10 from the health.
    f.world().place(f.me(), [-10, 0.82, 0.5]);
    f.step();
    expect(f.h().armor).toBe(50);
    f.world().hurt(f.me().id, 20);
    expect([f.h().armor, f.me().health!.points]).toEqual([40, 75]);
    // The shotgun's rack: the shotgun kept, in its hands, 8 shells; the rack gone.
    f.world().place(f.me(), [-12.5, 0.82, -6]);
    f.step();
    const a = arsenal(f.me())!;
    expect([a.owned, weapon(f.me())!.kind, a.ammo.shells]).toEqual([['stick', 'dart', 'shotgun'], 'shotgun', 8]);
    expect([...f.world().entities.values()].some((e) => e.sensor?.kind === 'weapon')).toBe(false);
    f.session.world.dispose();
  });

  test('the arsenal (stage 5n): a slot’s key takes that weapon; what fires spends its ammunition; empty, the best with some', () => {
    const f = levelOf(0);
    f.step();
    const a = arsenal(f.me())!;
    f.take(1);
    expect(weapon(f.me())!.kind).toBe('stick');
    f.take(3);
    expect(weapon(f.me())!.kind).toBe('stick'); // no shotgun yet: the slot is empty
    f.take(2);
    expect(weapon(f.me())!.kind).toBe('dart');
    const darts = a.ammo.darts;
    f.step({ [ATTACK]: true });
    f.step();
    expect(a.ammo.darts).toBe(darts - 1);
    // Out of darts: a press takes up the stick (the best it owns with what it needs).
    a.ammo.darts = 0;
    for (let i = 0; i < 20; i++) f.step();
    f.step({ [ATTACK]: true });
    f.step();
    expect(weapon(f.me())!.kind).toBe('stick');
    f.session.world.dispose();
  });

  test('a group called in once (stage 5n): walking into its trigger, its attackers come, of their role', () => {
    const f = levelOf(3);
    f.step();
    const before = attackers(f.world()).length;
    f.world().place(f.me(), [0, 0.82, -33]);
    f.step();
    f.step();
    const come = attackers(f.world()).length - before;
    expect(come).toBe(3);
    // Of their roles: two who charge (sticks, 80, 9 m/s) and a brute (a shotgun, 300).
    const called = attackers(f.world()).slice(-3);
    expect(called.map((e) => [weapon(e)!.kind, e.health!.most]).sort()).toEqual([
      ['shotgun', 300],
      ['stick', 80],
      ['stick', 80],
    ]);
    expect(called.find((e) => weapon(e)!.kind === 'stick')!.character!.movement.walk.run).toBe(ROLES[3].run);
    // Again, nothing more: the trigger is used.
    f.world().place(f.me(), [0, 0.82, -30]);
    f.step();
    f.world().place(f.me(), [0, 0.82, -33]);
    f.step();
    expect(attackers(f.world()).length - before).toBeLessThanOrEqual(3);
    f.session.world.dispose();
  });

  test('down, the defender is back at its checkpoint three seconds later, on its feet, the time counted', () => {
    const f = levelOf(0);
    f.step();
    f.world().place(f.me(), [0, 0.82, -1]);
    f.step();
    f.world().hurt(f.me().id, 1000);
    for (let i = 0; i < RULES.back * 60 + 2; i++) f.step();
    expect(f.me().health!.down).toBe(-1);
    expect(Math.hypot(f.at()[0]!, f.at()[2]!)).toBeLessThan(0.1);
    expect(f.h().downs).toBe(1);
    f.session.world.dispose();
  });

  test('a rising pace, fair: quicker each level, a warning before every shot, two at once at most', () => {
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

  test('its jump, grounded (stage 5k): its feet 1.1 m up in 0.36 s, on its feet again in about 0.66 s, no longer 2 m on the world’s gravity', () => {
    const j = jumpOf(levelOf(0));
    expect(j.height).toBeCloseTo(1.1, 1);
    expect(j.top).toBeCloseTo(0.36, 1);
    expect(j.landed).toBeGreaterThan(0.6);
    expect(j.landed).toBeLessThan(0.72);
  });

  test('its words: the same keys in Spanish and English, and every key the game names among them', () => {
    expect(missingKeys(WALL_WORDS)).toEqual([]);
    const named = [
      WALL.title,
      WALL.tagline,
      ...WALL.levels.map((l) => l.name),
      ...[...WALL.thread.opening, ...WALL.thread.ending].flatMap((l) => [l.who, l.say]),
      'wall.down',
      'wall.out',
      'wall.key',
      'wall.secret',
      'wall.recap.secrets',
      'wall.recap.felled',
      ...SLOTS.map((k) => `wall.weapon.${k}`),
    ];
    for (const key of named) expect(WALL_WORDS.es, key).toHaveProperty([key]);
  });

  test('its music, sparse (decision 0027): waiting, a note begins on fewer than a fifth of the beats; fighting, on a third at most; quiet once out', () => {
    const beats = WALL_THEME.tempo;
    const share = (mood: string) => new Set(notesBetween(WALL_THEME, mood, 0, beats).map((n) => n.beat)).size / beats;
    expect(share('wait')).toBeGreaterThan(0);
    expect(share('wait')).toBeLessThan(0.2);
    expect(share('fight')).toBeGreaterThan(share('wait'));
    expect(share('fight')).toBeLessThanOrEqual(1 / 3);
    expect(notesBetween(WALL_THEME, 'done', 0, beats)).toEqual([]);
  });
});
