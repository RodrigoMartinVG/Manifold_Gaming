import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import { characterParts } from '@manifold/character';
import {
  BotHost,
  initPhysics,
  NO_INPUT,
  Session,
  type Cartridge,
  type Entity,
  type PlayerInput,
  type World,
} from '@manifold/core';
import { ARMS_BRAINS } from './brain';
import { guard } from './guard';
import {
  POUCH,
  SMOKE_INPUT,
  FLARE_INPUT,
  SHOUT_INPUT,
  STEALTH,
  STEALTH_INPUTS,
  STEALTH_ZONES,
  stealth,
  stealthDamage,
  type Pouch,
} from './stealth';
import { ARMS_INPUTS, arms, ATTACK, fuses, WEAPON, type Weapon } from './weapons';

beforeAll(initPhysics);

/** A cartridge to try them: a floor, a player with a pouch and a stick, the weapons and the stealth at each step. */
function cartridge(build: (world: World) => void, ambient = 1): Cartridge {
  return {
    id: 'arms-test',
    title: 'Arms',
    brains: ARMS_BRAINS,
    inputs: [...ARMS_INPUTS, ...STEALTH_INPUTS],
    zones: { ...STEALTH_ZONES },
    filterDamage: stealthDamage,
    onStart(world) {
      world.ambient = ambient;
      world.createEntity({
        transform: { position: [0, -0.5, 0], rotation: quat.identity() },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [20, 0.5, 20] } },
      });
      const parts = characterParts({ player: 1, facing: [0, 0, -1], color: 0x93d9c9 });
      world.createEntity({
        transform: { position: [0, 0.82, 0], rotation: quat.identity() },
        body: parts.body,
        character: parts.character,
        appearance: parts.appearance,
        health: { most: 100 },
        game: {
          [POUCH]: { smoke: 1, flare: 1 } satisfies Pouch,
          [WEAPON]: { kind: 'stick', ready: 0, strike: 0, struck: [] } satisfies Weapon,
        },
      });
      build(world);
    },
    onStep(world, events) {
      arms(world, events);
      fuses(world);
      stealth(world, events);
    },
  };
}

function play(c: Cartridge) {
  const session = new Session(c);
  const bots = new BotHost();
  const world = () => session.world;
  const me = (): Entity => [...world().entities.values()].find((e) => e.character?.player === 1)!;
  const step = (input: PlayerInput = NO_INPUT) => {
    bots.think(session);
    session.setInput(1, input);
    session.step();
  };
  for (let i = 0; i < 20; i++) step();
  return { session, world, me, step, bots };
}

const lamp = (world: World, at: Vec3, radius = 5) =>
  world.createEntity({
    name: 'lamp',
    transform: { position: at, rotation: quat.identity() },
    lamp: { radius, intensity: 1, signal: null },
  });
const eye = (world: World, at: Vec3) =>
  world.createEntity({
    name: 'eye',
    transform: { position: at, rotation: quat.identity() },
    watcher: { range: 12, cone: Math.cos(Math.PI / 3), threshold: 0.3 },
  });

describe('the light as a tool (stage 5e)', () => {
  test('a hand puts out the lamp within reach (along the ground, though it hangs high), and lights it again', () => {
    const { world, step } = play(cartridge((w) => lamp(w, [0, 2.6, -1])));
    const l = world().named('lamp')!;
    expect(l.lamp!.on).toBe(true);
    step({ use: true });
    step();
    expect([l.lamp!.out, l.lamp!.on]).toEqual([true, false]);
    step({ use: true });
    step();
    expect([l.lamp!.out, l.lamp!.on]).toEqual([false, true]);
  });

  test('in the dark it is not seen: an eye sees it by its lamp; the lamp put out, it does not', () => {
    // An eye 6 m ahead, looking back at it (its −Z turned round); the night's ambient, nearly none.
    const { world, step } = play(
      cartridge((w) => {
        lamp(w, [0, 2.2, 0.8]);
        const e = eye(w, [0, 1.4, -6]);
        e.transform!.rotation = quat.fromDegrees([0, 1, 0], 180);
      }, 0.05),
    );
    const sees = () => world().named('eye')!.watcher!.sees.length;
    expect(sees()).toBe(1);
    step({ use: true });
    step();
    expect(sees()).toBe(0);
  });

  test('smoke: thrown, a cloud a second later that hides it from the eye, gone 8 s after', () => {
    const { world, me, step } = play(
      cartridge((w) => {
        const e = eye(w, [0, 1.4, -8]);
        e.transform!.rotation = quat.fromDegrees([0, 1, 0], 180);
      }, 1),
    );
    const sees = () => world().named('eye')!.watcher!.sees.length;
    expect(sees()).toBe(1);
    // Thrown down at its feet (it looks down): the cloud round it.
    step({ [SMOKE_INPUT]: true, pitch: -1 });
    expect((me().game![POUCH] as Pouch).smoke).toBe(0);
    for (let i = 0; i < STEALTH.smoke.fuse + 5; i++) step();
    const cloud = [...world().entities.values()].find((e) => e.sensor?.kind === 'smoke');
    expect(cloud?.sensor?.params.opacity).toEqual([STEALTH.smoke.opacity]);
    expect(sees()).toBe(0);
    for (let i = 0; i < STEALTH.smoke.life + 5; i++) step();
    expect([...world().entities.values()].some((e) => e.sensor?.kind === 'smoke')).toBe(false);
    expect(sees()).toBe(1);
  });

  test('a flare: thrown, a light where it falls, that lets the eye see in the dark; gone 20 s after', () => {
    const { world, step } = play(
      cartridge((w) => {
        const e = eye(w, [0, 1.4, -6]);
        e.transform!.rotation = quat.fromDegrees([0, 1, 0], 180);
      }, 0.05),
    );
    const sees = () => world().named('eye')!.watcher!.sees.length;
    expect(sees()).toBe(0);
    step({ [FLARE_INPUT]: true, pitch: -1 });
    for (let i = 0; i < 60; i++) step();
    expect([...world().entities.values()].some((e) => e.lamp && e.body)).toBe(true);
    expect(sees()).toBe(1);
    for (let i = 0; i < STEALTH.flare.life; i++) step();
    expect([...world().entities.values()].some((e) => e.lamp && e.body)).toBe(false);
  });
});

describe('a guard, and its wariness (stage 5e)', () => {
  test('a blow of a stick from behind, on a guard that does not see who strikes, takes it down at once; face to face, it blocks: a quarter of the stick’s 30', () => {
    // A guard 1 m ahead, its back to it.
    const { world, me, step } = play(cartridge((w) => guard(w, [0, 0.82, -1], [0, 0, -1])));
    const g = () => [...world().entities.values()].find((e) => e.brain)!;
    for (let i = 0; i < 14; i++) step({ [ATTACK]: i === 0 });
    expect(g().health!.down).toBeGreaterThanOrEqual(0);
    // Again, face to face: it sees the blow coming, and blocks it.
    const two = play(cartridge((w) => guard(w, [0, 0.82, -1], [0, 0, 1])));
    const g2 = () => [...two.world().entities.values()].find((e) => e.brain)!;
    for (let i = 0; i < 14; i++) two.step({ [ATTACK]: i === 0 });
    expect(g2().health!.points).toBe(100 - Math.round(30 * 0.25));
    void me;
  });

  test('a wary guard lights again a lamp it saw lit and finds put out: it goes to it, and a hand on it', () => {
    const { world, step } = play(
      cartridge((w) => {
        lamp(w, [0, 2.2, -6]);
        guard(w, [0, 0.82, -1], [0, 0, -1], null, 'stick', { shout: true, relight: true, notice: true });
      }),
    );
    const l = () => world().named('lamp')!.lamp!;
    for (let i = 0; i < 30; i++) step();
    l().out = true;
    let lit = -1;
    for (let i = 0; i < 600 && lit < 0; i++) {
      step();
      if (!l().out) lit = i;
    }
    expect(lit).toBeGreaterThan(0);
  });

  test('a wary guard that sees someone shouts; another wary one, its back to it all, hears it and comes to look', () => {
    const WARY = { shout: true, relight: true, notice: true };
    const { world, step, bots } = play(
      cartridge((w) => {
        guard(w, [0, 0.82, -5], [0, 0, 1], null, 'stick', WARY);
        guard(w, [8, 0.82, -5], [1, 0, 0], null, 'stick', WARY);
      }),
    );
    const [a, b] = [...world().entities.values()].filter((e) => e.brain);
    // (It saw it in the first steps: its shout, then.) The first is after it; the second heard it, and went to look.
    step();
    expect((bots.memoryOf(a!.id) as { mode?: string }).mode).toBe('chase');
    // (Looking where the shout came from; or, turned round to it, after it too.)
    const heard = bots.memoryOf(b!.id) as { mode?: string; heard?: { at: Vec3 } | null } | undefined;
    expect(['look', 'chase']).toContain(heard?.mode);
    expect(heard?.heard?.at[0]).toBeCloseTo(0, 0);
    expect(heard?.heard?.at[2]).toBeCloseTo(-5, 0);
    expect(heard?.heard?.at[0]).toBeCloseTo(0, 0);
  });

  test('a wary guard with no route keeps its post (stage 5f): a shout heard, it goes to look, and comes back to where it stood, facing as it faced', () => {
    const WARY = { shout: true, relight: true, notice: true };
    // In the dark (it does not see who shouts): a guard 6 m ahead, its back to it.
    const { world, me, step, bots } = play(cartridge((w) => guard(w, [0, 0.82, -6], [0, 0, -1], false, 'stick', WARY), 0.05));
    const g = () => [...world().entities.values()].find((e) => e.brain)!;
    expect(g().brain!.route).toBeNull();
    step({ [SHOUT_INPUT]: true });
    // Out of its way, to the side.
    world().place(me(), [6, 0.82, 2]);
    step();
    expect((bots.memoryOf(g().id) as { mode?: string }).mode).toBe('look');
    let left = false;
    for (let i = 0; i < 900; i++) {
      step();
      const p = g().transform!.position;
      if (Math.hypot(p[0], p[2] + 6) > 2) left = true;
    }
    const p = g().transform!.position;
    expect(left).toBe(true);
    expect(Math.hypot(p[0], p[2] + 6)).toBeLessThan(0.8);
    expect(g().character!.facing[2]).toBeLessThan(-0.95);
    expect((bots.memoryOf(g().id) as { mode?: string }).mode).toBe('patrol');
  });

  test('a guard with a shotgun (stage 5h) shoots only near: at 6 m it stands and fires; at 11 m (it sees to 12) it runs in to 8 m first', () => {
    const fires = (distance: number) => {
      const { world, step } = play(cartridge((w) => guard(w, [0, 0.82, -distance], [0, 0, 1], null, 'shotgun'), 1));
      const g = () => [...world().entities.values()].find((e) => e.brain)!;
      for (let i = 0; i < 240; i++) {
        step();
        if (world().stepEvents.some((e) => e.type === 'fired' && e.from === g().id)) return Math.abs(g().transform!.position[2]!);
      }
      return null;
    };
    expect(fires(6)).toBeGreaterThan(5.5);
    const far = fires(11);
    expect(far).not.toBeNull();
    expect(far!).toBeLessThanOrEqual(8.2);
  });
});
