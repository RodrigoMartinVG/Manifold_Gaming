import { beforeAll, describe, expect, test } from 'vitest';
import { quat, type Vec3 } from '@manifold/common';
import { arcOf } from './character';
import { NO_INPUT } from './input';
import { initPhysics } from './physics';
import type { Entity, PlayerInput } from './types';
import { STEP, World } from './world';

beforeAll(initPhysics);

/** The platformer's numbers (as @manifold/character's PLATFORMER: the core does not know that package). */
const ARC = { height: 2, time: 0.42, release: 2.5, fall: 1.5, terminal: 16, corner: 0.25 };
const STAND = 0.8;
const input = (move: Vec3 = [0, 0, 0], jump = false): PlayerInput => ({ ...NO_INPUT, move, jump });

/** A world with a floor (its top at y = 0), boxes, and a platformer's character. */
function setUp(
  o: {
    at?: Vec3;
    boxes?: [center: Vec3, half: Vec3][];
    arc?: (typeof ARC & { hang?: number }) | null;
    wallJump?: boolean;
    ledge?: boolean;
    reach?: number;
  } = {},
) {
  const world = new World({ seed: 1 });
  world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
  });
  for (const [center, half] of o.boxes ?? [])
    world.createEntity({
      transform: { position: center, rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: half } },
    });
  const arc = o.arc === null ? undefined : (o.arc ?? ARC);
  const hero = world.createEntity({
    transform: { position: o.at ?? [0, STAND, 0], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: {
      player: 1,
      movement: { ...(arc ? { arc } : {}), ...(o.reach !== undefined ? { wall: { reach: o.reach } } : {}) },
      can: { wallJump: o.wallJump ?? false, ledge: o.ledge ?? false },
    },
  });
  return { world, hero };
}
const feet = (e: Entity) => e.transform!.position[1] - STAND;
const step = (world: World, i: PlayerInput = NO_INPUT) => {
  world.inputs.set(1, i);
  world.step();
};
/** Standing still on the floor first. */
const settle = (world: World) => {
  for (let i = 0; i < 30; i++) step(world);
};

describe('the platformer’s jump (stage 5c): its height and its time to the top', () => {
  test('arcOf: in N = 25 steps (0.42 s), 2 m: g = 2h / (N(N − 1) Δt²) = 24 m/s², v = 2h / ((N − 1) Δt) = 10 m/s', () => {
    const a = arcOf(ARC, STEP);
    expect(a.steps).toBe(25);
    expect(a.gravity).toBeCloseTo(24, 9);
    expect(a.speed).toBeCloseTo(10, 9);
    // The continuous ones are a little less: 2h/t² and 2h/t.
    expect(a.gravity).toBeGreaterThan((2 * 2) / (0.42 * 0.42));
  });

  test('held, its feet rise exactly 2 m, at steps 24 and 25, and no higher; let go at once, a short hop', () => {
    const { world, hero } = setUp();
    settle(world);
    // (From where its feet were: standing, the controller keeps them 2 cm off the floor.)
    const from = feet(hero);
    const heights: number[] = [];
    for (let i = 0; i < 30; i++) {
      step(world, input([0, 0, 0], true));
      heights.push(feet(hero) - from);
    }
    const top = Math.max(...heights);
    expect(top).toBeCloseTo(2, 3);
    expect(heights.indexOf(top) + 1).toBeGreaterThanOrEqual(24);
    // A tap (the jump held one step): from the second step its gravity is 2.5 times; the arc's top, by
    // the same sums the step does.
    const hop = setUp();
    settle(hop.world);
    const { gravity, speed } = arcOf(ARC, STEP);
    let v = speed;
    let y = 0;
    let most = 0;
    for (let k = 1; v > 0; k++) {
      v -= gravity * (k === 1 ? 1 : ARC.release) * STEP;
      y += v * STEP;
      most = Math.max(most, y);
    }
    let reached = 0;
    const start = feet(hop.hero);
    for (let i = 0; i < 30; i++) {
      step(hop.world, input([0, 0, 0], i === 0));
      reached = Math.max(reached, feet(hop.hero) - start);
    }
    expect(reached).toBeCloseTo(most, 3);
    expect(reached).toBeLessThan(0.5 * 2);
  });

  test('it falls faster than it rose (1.5 times the gravity): up in 25 steps, down in 20 (k(k+1) ≥ 2h / (1.5 g Δt²) = 400)', () => {
    const { world, hero } = setUp();
    settle(world);
    let landed = 0;
    for (let i = 1; i <= 80 && !landed; i++) {
      step(world, input([0, 0, 0], true));
      if (i > 5 && hero.character!.grounded) landed = i;
    }
    expect(landed).toBeGreaterThanOrEqual(44);
    expect(landed).toBeLessThanOrEqual(46);
  });

  test('no faster down than 16 m/s', () => {
    const { world, hero } = setUp({ at: [0, 60, 0] });
    let fastest = 0;
    for (let i = 0; i < 120; i++) {
      step(world);
      fastest = Math.max(fastest, -hero.character!.velocity[1]!);
    }
    expect(fastest).toBeCloseTo(16, 9);
  });

  test('corner correction: its head clipping an edge by 10 cm, it is nudged round it and rises on; without it, the edge stops it', () => {
    // A ceiling 2.5 m up whose edge is 20 cm right of its middle: its head (30 cm round) clips 10 cm of it.
    const ceiling: [Vec3, Vec3] = [
      [1.2, 2.75, 0],
      [1, 0.25, 2],
    ];
    const reach = (corner: number) => {
      const { world, hero } = setUp({ boxes: [ceiling], arc: { ...ARC, corner } });
      settle(world);
      let top = 0;
      for (let i = 0; i < 40; i++) {
        step(world, input([0, 0, 0], true));
        top = Math.max(top, feet(hero));
      }
      return { top, x: hero.transform!.position[0]! };
    };
    const nudged = reach(0.25);
    expect(nudged.top).toBeGreaterThan(1.9);
    expect(nudged.x).toBeLessThan(-0.09);
    expect(reach(0).top).toBeLessThan(1);
  });
});

describe('down a wall and off it (stage 5c, `wallJump`)', () => {
  /** A wall 10 m high whose face is at x = 1. */
  const WALL: [Vec3, Vec3] = [
    [1.5, 5, 0],
    [0.5, 5, 3],
  ];

  test('pushing against it in the air, it slides down no faster than 2.5 m/s; a jump takes it up and off at 6 m/s, and for 0.25 s it cannot steer back', () => {
    const { world, hero } = setUp({ at: [0.6, 7, 0], boxes: [WALL], wallJump: true });
    for (let i = 0; i < 40; i++) step(world, input([1, 0, 0]));
    expect(hero.character!.mode).toBe('slide');
    expect(-hero.character!.velocity[1]!).toBeCloseTo(2.5, 9);
    step(world, input([1, 0, 0], true));
    expect(hero.character!.velocity[1]).toBeCloseTo(arcOf(ARC, STEP).speed - arcOf(ARC, STEP).gravity * STEP, 9);
    expect(hero.character!.velocity[0]).toBeCloseTo(-6, 9);
    // Still pushing towards it: for the lock's 15 steps it goes on away from it.
    const x0 = hero.transform!.position[0]!;
    for (let i = 0; i < 14; i++) step(world, input([1, 0, 0]));
    expect(hero.transform!.position[0]!).toBeLessThan(x0 - 1);
  });

  test('without the capability, a wall is a wall: it falls along it', () => {
    const { world, hero } = setUp({ at: [0.6, 9.5, 0], boxes: [WALL] });
    for (let i = 0; i < 20; i++) step(world, input([1, 0, 0]));
    expect(hero.character!.mode).toBe('air');
    expect(-hero.character!.velocity[1]!).toBeGreaterThan(5);
  });

  test('between two walls 2.4 m apart, jumping from one to the other, it climbs higher than any jump', () => {
    const { world, hero } = setUp({
      at: [0, STAND, 0],
      boxes: [
        [
          [1.7, 10, 0],
          [0.5, 10, 3],
        ],
        [
          [-1.7, 10, 0],
          [0.5, 10, 3],
        ],
      ],
      wallJump: true,
    });
    settle(world);
    let way = 1;
    let top = 0;
    let wait = 0;
    step(world, input([way, 0, 0], true));
    for (let i = 0; i < 400; i++) {
      const c = hero.character!;
      // At a wall (sliding on it), a jump, and then towards the other one.
      const jump = c.mode === 'slide' && wait === 0;
      if (jump) {
        way = -way;
        wait = 10;
      }
      wait = Math.max(0, wait - 1);
      step(world, input([jump ? -way : way, 0, 0], jump));
      top = Math.max(top, feet(hero));
    }
    expect(top).toBeGreaterThan(6);
  });
});

describe('a ledge, grabbed and climbed onto (stage 5c, `ledge`)', () => {
  /** A block 2 m high whose face is at x = 1: its top, a ledge. */
  const BLOCK: [Vec3, Vec3] = [
    [2, 1, 0],
    [1, 1, 3],
  ];
  /** Falling past it, pushing towards it, until it hangs: its feet under the top (1.8 m), its hands over it. */
  const hanging = () => {
    const s = setUp({ at: [0.55, 2.6, 0], boxes: [BLOCK], ledge: true });
    for (let i = 0; i < 60 && s.hero.character!.mode !== 'hang'; i++) step(s.world, input([1, 0, 0]));
    return s;
  };

  test('falling past it, it grabs it: its hands on the top (2 m), its body a gap off the face, still (pushing on a moment, it would climb)', () => {
    const { world, hero } = hanging();
    expect(hero.character!.mode).toBe('hang');
    for (let i = 0; i < 60; i++) step(world);
    expect(hero.character!.mode).toBe('hang');
    // Its hands, 30 cm under the top of its head (0.5 above its center), at the top's height.
    expect(hero.transform!.position[1]! + 0.5).toBeCloseTo(2, 2);
    expect(hero.transform!.position[0]!).toBeCloseTo(1 - 0.3 - 0.02 - 0.01, 2);
    expect(hero.character!.velocity).toEqual([0, 0, 0]);
  });

  test('pushing on, it climbs onto the top and stands there (up 0.15 s, on 0.15 s, after hanging a fifth of a second)', () => {
    const { world, hero } = hanging();
    let steps = 0;
    for (; steps < 90 && !(hero.character!.grounded && hero.character!.mode === 'walk'); steps++) step(world, input([1, 0, 0]));
    expect(steps).toBeLessThanOrEqual(12 + 18 + 2);
    for (let i = 0; i < 10; i++) step(world);
    expect(hero.character!.grounded).toBe(true);
    expect(feet(hero)).toBeCloseTo(2, 1);
    expect(hero.transform!.position[0]!).toBeGreaterThan(1.3);
  });

  test('pushing away, it lets go and falls to the floor, and does not grab it again on the way', () => {
    const { world, hero } = hanging();
    step(world, input([-1, 0, 0]));
    for (let i = 0; i < 80; i++) step(world);
    expect(hero.character!.mode).toBe('walk');
    expect(feet(hero)).toBeCloseTo(0, 1);
  });

  test('without the capability, it falls past it', () => {
    const { world, hero } = setUp({ at: [0.55, 2.6, 0], boxes: [BLOCK] });
    for (let i = 0; i < 80; i++) step(world, input([1, 0, 0]));
    expect(feet(hero)).toBeCloseTo(0, 1);
  });
});

describe('forgiveness (stage 5p, decision 0031: as Celeste’s)', () => {
  /** A wall 10 m high whose face is at x = 1. */
  const WALL: [Vec3, Vec3] = [
    [1.5, 5, 0],
    [0.5, 5, 3],
  ];
  /** Sliding down it, pushing against it. */
  const sliding = (o: { reach?: number } = {}) => {
    const s = setUp({ at: [0.6, 7, 0], boxes: [WALL], wallJump: true, ...o });
    for (let i = 0; i < 40; i++) step(s.world, input([1, 0, 0]));
    expect(s.hero.character!.mode).toBe('slide');
    return s;
  };

  test('held, it hangs at its top 0.08 s more (5 steps at 2 m), its height the same; let go there, it falls at once', () => {
    const steady = setUp();
    const hanging = setUp({ arc: { ...ARC, hang: 0.08 } });
    const atTop = (s: ReturnType<typeof setUp>) => {
      settle(s.world);
      const from = feet(s.hero);
      const heights: number[] = [];
      for (let i = 0; i < 45; i++) {
        step(s.world, input([0, 0, 0], true));
        heights.push(feet(s.hero) - from);
      }
      const top = Math.max(...heights);
      return { top, steps: heights.filter((h) => top - h < 1e-6).length };
    };
    const [a, b] = [atTop(steady), atTop(hanging)];
    expect(b.top).toBeCloseTo(2, 3);
    expect(b.top).toBeCloseTo(a.top, 9);
    expect(b.steps - a.steps).toBe(5);
    // Let go as it starts to hang: down at once.
    const s = setUp({ arc: { ...ARC, hang: 0.08 } });
    settle(s.world);
    for (let i = 0; i < 40 && s.hero.character!.hung === undefined; i++) step(s.world, input([0, 0, 0], true));
    expect(s.hero.character!.hung).toBe(5);
    step(s.world);
    expect(s.hero.character!.velocity[1]).toBeLessThan(0);
    expect(s.hero.character!.hung).toBeUndefined();
  });

  test('a jump off a wall asked for pushing away from it leaps off it (until 5p, only one pushing towards it did)', () => {
    for (const reach of [0.45, undefined]) {
      const s = sliding(reach === undefined ? {} : { reach });
      step(s.world, input([-1, 0, 0], true));
      expect(s.hero.character!.velocity[0]).toBeCloseTo(-6, 9);
      expect(s.hero.character!.velocity[1]).toBeGreaterThan(9);
    }
  });

  test('a wall 40 cm off its body: a jump, pushing nowhere, leaps off it with the reach; at 60 cm, it does not', () => {
    for (const [gap, leaps] of [
      [0.4, true],
      [0.6, false],
    ] as const) {
      // (Falling past it, its body `gap` from its face.)
      const s = setUp({ at: [1 - 0.3 - gap, 7, 0], boxes: [WALL], wallJump: true, reach: 0.45 });
      for (let i = 0; i < 10; i++) step(s.world);
      step(s.world, input([0, 0, 0], true));
      expect(s.hero.character!.velocity[1]! > 0, `${gap} m off`).toBe(leaps);
    }
  });

  test('coyote time off a wall: pushed away for up to 6 steps, a jump still leaps off it; after 8, it does not', () => {
    for (const [away, leaps] of [
      [3, true],
      [6, true],
      [8, false],
    ] as const) {
      const s = sliding();
      for (let i = 0; i < away; i++) step(s.world, input([-1, 0, 0]));
      step(s.world, input([-1, 0, 0], true));
      expect(s.hero.character!.velocity[1]! > 0, `${away} steps away`).toBe(leaps);
      if (leaps) expect(s.hero.character!.velocity[0]).toBeLessThan(-5);
    }
  });

  test('not twice off the same wall: leapt off it, a late jump does not leap off it again', () => {
    const s = sliding({ reach: 0.45 });
    step(s.world, input([-1, 0, 0], true));
    for (let i = 0; i < 3; i++) step(s.world, input([1, 0, 0]));
    // (Released and pressed again, still in the lock: no second leap off it, nor a coyote one.)
    step(s.world, input([1, 0, 0], true));
    expect(s.hero.character!.velocity[0]).toBeLessThan(-4);
    expect(s.hero.character!.nearWall).toBeUndefined();
  });
});
