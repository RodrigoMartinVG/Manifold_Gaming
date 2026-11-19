import { beforeAll, describe, expect, test } from 'vitest';
import { vec3, type Vec3 } from '@manifold/common';
import { BotHost, eyeHeightOf, initPhysics, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from '../cartridge';
import { weapon } from '../rules';
import { ROOMS } from '../rooms';
import { referenceText } from '@manifold/shell/references';

beforeAll(initPhysics);

/**
 * THE CITADEL, PLAYED (stage 4.5f): the review's demonstration from its start to its goal, with no
 * teleport, by a driver that does what a player does (as the keep's: it steers towards a point every
 * step), with the guards thinking as they do on the page. When a guard on its floor is in sight, it
 * brings it down with darts, as the arena's driver does, and goes on. If a part is no longer
 * possible, it says which, and where the character was.
 */
function citadel() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.citadel!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const bots = new BotHost();
  const notices: string[] = [];
  const all = () => [...session.world.entities.values()];
  const me = (): Entity => all().find((e) => e.character?.player === 1)!;
  const at = () => me().transform!.position;
  const c = () => me().character!;
  const signal = (name: string) => session.world.signal(name);
  const guards = () => all().filter((e) => e.brain && e.health);
  let fights = 0;
  const raw = (input: PlayerInput) => {
    bots.think(session);
    session.setInput(1, input);
    session.step();
    for (const ev of session.world.stepEvents) if (ev.type === 'notice') notices.push(ev.say);
  };
  const flat = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[2] - a[2]);
  const towards = (from: Vec3, to: Vec3): Vec3 => {
    const d = flat(from, to);
    return d < 0.05 ? [0, 0, 0] : [(to[0] - from[0]) / d, 0, (to[2] - from[2]) / d];
  };
  const eye = () => vec3.add(at(), [0, eyeHeightOf(c(), me().body!), 0]);
  /** A guard up, on this floor, within 10 m and in sight: the one to shoot now. */
  const near = () =>
    guards().find((g) => {
      const p = g.transform!.position;
      if ((g.health!.down ?? -1) >= 0 || Math.abs(p[1] - at()[1]) > 1.5 || flat(at(), p) > 10) return false;
      const to = vec3.sub(p, eye());
      const d = vec3.length(to);
      const wall = session.world.castRay(eye(), vec3.scale(to, 1 / d), d, { skip: me().id, characters: false, dynamic: false });
      return wall === null;
    });
  /** Darts at its middle, from the eyes, each as soon as the last is ready, until it is down. */
  const shoot = (g: Entity) => {
    fights++;
    for (let i = 0; i < 600 && (g.health!.down ?? -1) < 0; i++) {
      if ((me().health!.down ?? -1) >= 0) throw new Error(`brought down at ${at().map((n) => n.toFixed(2))}`);
      const to = vec3.sub(g.transform!.position, eye());
      const aim = {
        face: towards(eye(), g.transform!.position),
        pitch: Math.atan2(to[1], Math.hypot(to[0], to[2])) / (Math.PI / 2),
      };
      raw({ ...aim, 'arms.attack': session.world.tick >= weapon(me())!.ready && i % 2 === 0 });
    }
    if ((g.health!.down ?? -1) < 0) throw new Error(`shooting at ${at().map((n) => n.toFixed(2))}: the guard is still up`);
  };
  /** A step of the player's: unless a guard is in sight, then the darts first (not while carrying). */
  const step = (input: PlayerInput) => {
    const g = c().holding === 0 && weapon(me())?.kind === 'dart' ? near() : undefined;
    if (g) shoot(g);
    raw(input);
  };
  const until = (part: string, done: () => boolean, input: () => PlayerInput, max = 1200) => {
    for (let i = 0; i < max; i++) {
      if (done()) return;
      step(input());
    }
    throw new Error(`${part}: not done in ${max} steps; at ${at().map((n) => n.toFixed(2))}, ${c().mode}`);
  };
  const go = (part: string, x: number, z: number, close = 0.25) =>
    until(
      part,
      () => c().grounded && flat(at(), [x, 0, z]) < close,
      () => ({ move: towards(at(), [x, 0, z]) }),
    );
  const wait = (steps: number) => {
    for (let i = 0; i < steps; i++) step(NO_INPUT);
  };
  /** Stands still, looking along (dx, dz) (a step of walking that way, then still). */
  const face = (dx: number, dz: number) => {
    raw({ move: [dx * 0.3, 0, dz * 0.3] });
    until(
      'standing',
      () => c().grounded && Math.hypot(c().velocity[0]!, c().velocity[2]!) < 0.05,
      () => NO_INPUT,
      120,
    );
  };
  /** Puts the character somewhere (the console's `dojo.goto`), for a test of one part. */
  const put = (x: number, y: number, z: number) => {
    expect(session.registry.run(`dojo.goto ${x} ${y} ${z}`, 'console').filter((m) => m.level === 'error')).toEqual([]);
    for (let i = 0; i < 200 && !c().grounded; i++) raw(NO_INPUT);
  };
  return { session, notices, me, at, c, signal, guards, raw, step, until, go, wait, face, put, fights: () => fights };
}

describe('the citadel (stage 4.5f)', () => {
  test('its gate holds open only for the crate: from the plate, running, it is shut before you are there', () => {
    const k = citadel();
    const gate = k.session.world.named('gate_west')!;
    const turned = () => 2 * Math.asin(Math.min(1, Math.hypot(...gate.transform!.rotation.slice(0, 3))));
    k.put(6, 1, 9);
    k.wait(80);
    expect(k.signal('gate_open')).toBe(1);
    expect(turned()).toBeCloseTo(Math.PI / 2, 2);
    // Off the plate and straight at the gate, running: it shuts in a second, and stops you at it.
    k.until(
      'running at the gate',
      () => k.at()[2]! < 0.6 || k.session.world.tick > 2000,
      () => ({ move: towards2(k.at(), [2, 0, -1.5]), run: true }),
      300,
    );
    k.wait(60);
    for (let i = 0; i < 60; i++) k.raw({ move: [0, 0, -1], run: true });
    expect(k.signal('gate_open')).toBe(0);
    expect(k.at()[2]!, 'stopped by the gate').toBeGreaterThan(0);
    k.session.world.dispose();
  });

  test('a guard follows you from floor to floor: seen in the hall, it comes after you up the stairs to the gallery', () => {
    const k = citadel();
    // (The hall's guard: the one on the ground; the zone named hall_guard is where it was put.)
    const guard = k.guards().find((g) => g.transform!.position[1] < 2)!;
    // In the hall, unarmed, by the gate; then up the stairs and along the gallery, running.
    k.put(2, 1, -1.5);
    k.wait(30);
    let highest = guard.transform!.position[1];
    const watch = () => (highest = Math.max(highest, guard.transform!.position[1]));
    for (const [x, z] of [
      [-6, -5.4],
      [-6, -12.6],
      [5, -14],
    ] as const)
      k.until(
        `running to (${x}, ${z})`,
        () => (watch(), k.c().grounded && Math.hypot(k.at()[0]! - x, k.at()[2]! - z) < 0.3),
        () => ({ move: towards2(k.at(), [x, 0, z]), run: true }),
        900,
      );
    // On the gallery, a floor up: the guard comes up the stairs after you, to within its stick's reach.
    k.until(
      'the guard up on the gallery',
      () => (watch(), guard.transform!.position[1] > 2.9 && Math.hypot(...vec3.sub(guard.transform!.position, k.at())) < 2),
      () => NO_INPUT,
      1800,
    );
    expect(highest).toBeGreaterThan(2.9);
    k.session.world.dispose();
  });

  // (A minute of play with two guards thinking: 8 to 17 s alone, 27 with every other test running beside
  // it; its own time, past the 20 s the rest are given.)
  test(
    'it can be played from the start to the goal, on three floors, past its guards; the run, a reference replay',
    { timeout: 60_000 },
    async () => {
      const k = citadel();
      const { session, at, c, signal, step, until, go, wait, face, notices } = k;
      const world = () => session.world;

      // The gatehouse: its button, its door; the dart from its rack.
      go('to the gatehouse button', -3.3, 1.4);
      step({ use: true });
      step(NO_INPUT);
      expect(signal('small_door')).toBe(1);
      wait(70);
      go('in front of the gatehouse door', -3.2, 3);
      go('through the gatehouse door', -4.8, 3);
      go('to the dart', -7, 1);
      expect(weapon(k.me())!.kind).toBe('dart');
      // The crate: behind it, looking at it and at the door along +X, grabbed; carried out and onto the
      // gate's plate.
      go('behind the crate', -6.8, 3, 0.12);
      face(1, 0);
      step({ grab: true });
      step(NO_INPUT);
      expect(c().holding).toBe(world().named('crate')!.id);
      go('carrying the crate out', -2.6, 3, 0.4);
      go('carrying the crate across the courtyard', 3, 9);
      until(
        'the crate over the plate',
        () => at()[0]! >= 5.05,
        () => ({ move: [1, 0, 0] }),
        200,
      );
      wait(30);
      step({ grab: true });
      step(NO_INPUT);
      expect(c().holding).toBe(0);
      go('back off the plate', 3.5, 9);
      wait(70);
      expect(signal('gate_open')).toBeGreaterThan(0);

      // The gate, the hall; up the stairs to the gallery.
      go('to the gate', 2, 1.5);
      go('through the gate', 2, -1.5);
      go('to the foot of the stairs', -6, -5.4);
      go('up the stairs', -6, -12.6);
      expect(at()[1]!).toBeGreaterThan(2.9);
      // The double door: its button, then through it to the landing.
      go('to the double door button', 7.2, -12.5);
      step({ use: true });
      step(NO_INPUT);
      expect(signal('wide_open')).toBe(1);
      wait(70);
      go('in front of the double door', 6.8, -14);
      go('through the double door', 10, -14);

      // The ferry: on when it is at the landing, off at the far one.
      const ferry = world().named('ferry')!;
      go('to the well', 12, -12.6);
      until(
        'the ferry at the landing',
        () => ferry.transform!.position[2] < -10.4,
        () => NO_INPUT,
        400,
      );
      go('onto the ferry', 12, -10.5, 0.4);
      until(
        'the crossing',
        () => ferry.transform!.position[2] > -5.6,
        () => ({ move: towards3(at(), ferry.transform!.position) }),
        400,
      );
      go('off the ferry', 12, -2);
      expect(notices).toContain('dojo.checkpoint');

      // The library: the plate in the lamp's light, seen; the lamp broken; the plate in the dark, the door.
      go('through the library doorway', 11, 1);
      go('to the plate, in the light', 13, 5.6);
      wait(10);
      expect(signal('seen_me')).toBe(1);
      expect(signal('opened')).toBe(0);
      go('in front of the lamp', 11.6, 2.9);
      face(0, 1);
      step({ 'dojo.throw': true });
      until(
        'the lamp breaking',
        () => world().named('lamp')!.breakable!.broken,
        () => NO_INPUT,
        120,
      );
      go('to the plate, in the dark', 13, 5.6);
      wait(10);
      expect(signal('seen_me')).toBe(0);
      expect(signal('opened')).toBe(1);
      wait(70);
      go('through the library door', 13, 9);

      // The lift, up to the roof.
      go('onto the lift', 10.1, 10);
      until(
        'the ride up',
        () => c().grounded && at()[1]! > 5.9,
        () => NO_INPUT,
        400,
      );
      expect(signal('lift_up')).toBe(1);

      // The roofs: across the well by its bridges, onto the hall's roof, up the ramp, across to the tower.
      go('off the lift', 12.6, 6);
      go('to the bridges', 12, -3.5);
      go('across the bridges', 12, -12.5);
      go('onto the hall roof', 5, -12);
      go('to the foot of the ramp', 0, -7.5);
      go('up the ramp', 0, -12.5);
      expect(at()[1]!).toBeGreaterThan(6.9);
      go('to the bridge', 0, -15.5);
      go('across to the tower', 0, -20.5);
      go('to the goal', 0, -25);
      wait(5);
      expect(notices.at(-1)).toBe('dojo.goal');
      // The guards were in the way: the hall's, the roof's (each brought down where it came).
      expect(k.fights()).toBeGreaterThanOrEqual(1);
      // The run, a reference replay (decision 0025; recorded again with `npm run references`): the guards'
      // inputs in it, as anyone's (decision 0023), the heaviest replay the site plays in every browser to
      // the hash Node gave (e2e/determinism.e2e.ts).
      await expect(
        referenceText(
          session,
          'The citadel, played from its gate to its tower: the crate on the plate, a guard that follows, the roofs.',
          'games/dojo/src/references/citadel.test.ts',
        ),
      ).toMatchFileSnapshot('../../replays/phase-4.5-citadel.replay');
      session.world.dispose();
    },
  );
});

/** Towards a moving point, in the plane: to stay on what carries you. */
function towards3(from: Vec3, to: Vec3): Vec3 {
  const d = Math.hypot(to[0] - from[0], to[2] - from[2]);
  return d < 0.3 ? [0, 0, 0] : [(to[0] - from[0]) / d, 0, (to[2] - from[2]) / d];
}

/** Towards a point, in the plane. */
function towards2(from: Vec3, to: Vec3): Vec3 {
  const d = Math.hypot(to[0] - from[0], to[2] - from[2]);
  return d < 0.05 ? [0, 0, 0] : [(to[0] - from[0]) / d, 0, (to[2] - from[2]) / d];
}
