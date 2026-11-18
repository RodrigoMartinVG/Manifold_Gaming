import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import { characterParts } from '@manifold/character';
import {
  airStrafe,
  DEFAULT_MOVEMENT,
  initPhysics,
  NO_INPUT,
  Session,
  type Cartridge,
  type Entity,
  type Event,
  type PlayerInput,
  type World,
} from '@manifold/core';
import { ARMS_INPUTS, armsDamage, arms, ATTACK, fuses, WEAPON, WEAPONS, type Weapon, type WeaponKind } from './weapons';

beforeAll(initPhysics);

/** A floor, a player carrying `kind`, and dummies (characters with health and no one driving them) where asked. */
function range(kind: WeaponKind, dummies: Vec3[] = [], o: { wall?: Vec3 } = {}): Cartridge {
  return {
    id: 'arms-range',
    title: 'Range',
    inputs: [...ARMS_INPUTS],
    filterDamage: armsDamage,
    onStart(world) {
      world.createEntity({
        transform: { position: [0, -0.5, 0], rotation: quat.identity() },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [40, 0.5, 40] } },
      });
      if (o.wall)
        world.createEntity({
          transform: { position: o.wall, rotation: quat.identity() },
          body: { type: 'fixed', shape: { kind: 'box', halfExtents: [4, 3, 0.2] } },
        });
      const make = (player: number, at: Vec3, facing: Vec3, game: Entity['game'] = {}) => {
        const parts = characterParts({ player, facing, color: 0x93d9c9 });
        world.createEntity({
          name: player === 1 ? 'me' : `dummy_${player}`,
          transform: { position: at, rotation: quat.identity() },
          body: parts.body,
          character: parts.character,
          appearance: parts.appearance,
          health: { most: 1000 },
          game,
        });
      };
      make(1, [0, 0.82, 0], [0, 0, -1], { [WEAPON]: { kind, ready: 0, strike: 0, struck: [] } satisfies Weapon });
      dummies.forEach((at, k) => make(50 + k, at, [0, 0, 1], {}));
    },
    onStep(world, events) {
      arms(world, events);
      fuses(world);
    },
  };
}

function play(c: Cartridge) {
  const session = new Session(c);
  const world = (): World => session.world;
  const me = (): Entity => world().named('me')!;
  const all: Event[] = [];
  const step = (input: PlayerInput = NO_INPUT) => {
    session.setInput(1, input);
    session.step();
    all.push(...world().stepEvents);
  };
  for (let i = 0; i < 20; i++) step();
  all.length = 0;
  return { session, world, me, step, all };
}

/** The pitch input that aims from the eyes (0.62 above the center) at a point `ahead` meters on, `drop` below the eyes. */
const pitchFor = (ahead: number, drop: number) => -Math.atan2(drop, ahead) / (Math.PI / 2);

describe('the shotgun (stage 5g): eight pellets on the shot’s own dice', () => {
  test('one shot, eight pellets, each within 6 degrees of the aim, the same on every copy', () => {
    const shots = () => {
      const { step, all, world } = play(range('shotgun'));
      step({ [ATTACK]: true });
      const out = all.filter((e) => e.type === 'shot');
      world().dispose();
      return out;
    };
    const one = shots();
    expect(one).toHaveLength(WEAPONS.shotgun.pellets);
    for (const s of one) {
      if (s.type !== 'shot') continue;
      const d = vec3.normalize(vec3.sub(s.end, s.start));
      expect(Math.acos(Math.min(1, -d[2])) * (180 / Math.PI)).toBeLessThanOrEqual(WEAPONS.shotgun.spread + 1e-6);
    }
    expect(new Set(one.map((s) => (s.type === 'shot' ? s.end.join(',') : ''))).size).toBe(WEAPONS.shotgun.pellets);
    expect(shots()).toEqual(one);
  });

  test('its role, the near one: at a meter every pellet strikes; at ten, a few; and it fires once a second', () => {
    const struck = (distance: number) => {
      const { step, all, world } = play(range('shotgun', [[0, 0.82, -distance]]));
      step({ [ATTACK]: true, pitch: pitchFor(distance, 0.62) });
      const hits = all.filter((e) => e.type === 'hurt').length;
      // Pressed again at once, and for most of a second: nothing more.
      for (let i = 0; i < WEAPONS.shotgun.every - 2; i++) step({ [ATTACK]: i % 2 === 0 });
      const again = all.filter((e) => e.type === 'fired').length;
      world().dispose();
      return { hits, again };
    };
    const near = struck(1);
    expect(near.hits).toBe(WEAPONS.shotgun.pellets);
    expect(near.again).toBe(1);
    expect(struck(10).hits).toBeLessThanOrEqual(3);
  });
});

describe('the launcher (stage 5g): a rocket that blows where it strikes', () => {
  test('fired at a wall, it blows there: who is near it is hurt by how near, and pushed', () => {
    const { step, all, world } = play(range('launcher', [[1.5, 0.82, -9]], { wall: [0, 3, -10.2] }));
    step({ [ATTACK]: true });
    for (let i = 0; i < 40; i++) step();
    const blast = all.find((e) => e.type === 'blast');
    expect(blast?.type === 'blast' && blast.at[2]).toBeGreaterThan(-10.05);
    expect(blast?.type === 'blast' && blast.by).toBe(world().named('me')!.id);
    const hurt = all.find((e) => e.type === 'hurt');
    expect(hurt?.type === 'hurt' && hurt.amount).toBeGreaterThan(0);
    expect(hurt?.type === 'hurt' && hurt.amount).toBeLessThan(WEAPONS.launcher.damage);
    world().dispose();
  });

  test('the explosion jump: at its own feet, it takes nothing from itself and throws it up; with a jump, higher', () => {
    const top = (jump: boolean) => {
      const { step, me, world, all } = play(range('launcher'));
      const floor = me().transform!.position[1]!;
      step({ [ATTACK]: true, pitch: -1, ...(jump ? { jump: true } : {}) });
      let most = 0;
      for (let i = 0; i < 180; i++) {
        step();
        most = Math.max(most, me().transform!.position[1]! - floor);
      }
      expect(me().health!.points).toBe(me().health!.most);
      expect(all.some((e) => e.type === 'blast')).toBe(true);
      world().dispose();
      return most;
    };
    const alone = top(false);
    expect(alone).toBeGreaterThan(1.5);
    expect(top(true)).toBeGreaterThan(alone + 1);
  });
});

describe('steering while thrown (stage 5g: `airStrafe`)', () => {
  const most = 0.25;
  test('asked along a velocity past what is asked, nothing is added; across it, it turns; against it, it slows', () => {
    // Thrown at 10 m/s along +x; asked 4.5 along +x: as it was.
    expect(airStrafe([10, 0, 0], [4.5, 0, 0], most)).toEqual([10, 0, 0]);
    // Asked across (+z): up to `most` across, its 10 along kept.
    expect(airStrafe([10, 0, 0], [0, 0, 4.5], most)).toEqual([10, 0, most]);
    // Asked against: slowed by `most`.
    expect(airStrafe([10, 0, 0], [-4.5, 0, 0], most)[0]).toBeCloseTo(10 - most, 12);
    // Slower than asked, along it: up to what is asked, no further.
    expect(airStrafe([4.4, 0, 0], [4.5, 0, 0], most)[0]).toBeCloseTo(4.5, 12);
  });

  test('a character thrown by a blast, held forward the whole flight, goes no faster than the blast and its walk made it', () => {
    const { step, me, world, session } = play(range('stick'));
    session.world.explode(vec3.add(me().transform!.position, [0, -0.6, 1.2]), 4, 1200, null);
    let fastest = 0;
    let first = -1;
    for (let i = 0; i < 120 && (i < 3 || !me().character!.grounded); i++) {
      step({ move: [0, 0, -1] });
      const v = me().character!.velocity;
      const along = Math.hypot(v[0], v[2]);
      if (first < 0) first = along;
      fastest = Math.max(fastest, along);
    }
    expect(fastest).toBeLessThanOrEqual(Math.max(first, DEFAULT_MOVEMENT.walk.speed) + 1e-9);
    world().dispose();
  });
});
