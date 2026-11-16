import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { aimOf, DEFAULT_MOVEMENT, faceFor, poseOf, turned } from './character';
import { buildLevel, levelFromText } from './level';
import { NO_INPUT } from './input';
import { stateHash } from './hash';
import { initPhysics } from './physics';
import { Session } from './session';
import type { Entity, GravityField, Mover, PlayerInput } from './types';
import { STEP, World } from './world';

beforeAll(initPhysics);

const STAND = 0.8; // a capsule 1.6 m tall stands with its center 0.8 m above the floor
const input = (move: Vec3 = [0, 0, 0], jump = false, run = false, face: Vec3 = [0, 0, 0]): PlayerInput => ({
  ...NO_INPUT,
  move,
  face,
  jump,
  run,
});

/** A world with a floor (its top at y = 0), boxes, and a character. */
function setUp(o: { at?: Vec3; gravity?: GravityField; boxes?: [center: Vec3, half: Vec3][] } = {}) {
  const world = new World({ seed: 1, gravity: o.gravity });
  world.createEntity({
    transform: { position: [0, -0.5, 0], rotation: quat.identity() },
    body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
  });
  for (const [center, half] of o.boxes ?? [])
    world.createEntity({
      transform: { position: center, rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: half } },
    });
  const hero = world.createEntity({
    transform: { position: o.at ?? [0, 1.5, 0], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1 },
  });
  return { world, hero };
}

function run(world: World, steps: number, give?: (step: number) => PlayerInput) {
  for (let i = 1; i <= steps; i++) {
    if (give) world.inputs.set(1, give(i));
    world.step();
  }
}

const y = (e: Entity) => e.transform!.position[1];

describe('the character (stage 1b)', () => {
  test('it falls and stands on the floor', () => {
    const { world, hero } = setUp();
    run(world, 120);
    expect(hero.character!.grounded).toBe(true);
    expect(y(hero)).toBeCloseTo(STAND, 1);
    expect(vec3.length(hero.character!.velocity)).toBeLessThan(1e-6);
    world.dispose();
  });

  test('it walks where it is asked, at its speed, and looks there; running is faster', () => {
    const walk = setUp();
    run(walk.world, 60);
    run(walk.world, 60, () => input([1, 0, 0]));
    // One second at 4.5 m/s (it reaches that speed in under a tenth of a second).
    expect(walk.hero.transform!.position[0]).toBeGreaterThan(4.2);
    expect(walk.hero.transform!.position[0]).toBeLessThan(4.6);
    expect(walk.hero.character!.facing).toEqual([1, 0, 0]);
    // Looking at +X: its −Z axis (its "forward") turned towards +X.
    const forward = quat.rotate(walk.hero.transform!.rotation, [0, 0, -1]);
    expect(vec3.dot(forward, [1, 0, 0])).toBeGreaterThan(0.999);
    const sprint = setUp();
    run(sprint.world, 60);
    run(sprint.world, 60, () => input([1, 0, 0], false, true));
    // At 7.5 m/s: about 6.9 m in that second, counting how long it takes to get there.
    expect(sprint.hero.transform!.position[0]).toBeGreaterThan(6.5);
    walk.world.dispose();
    sprint.world.dispose();
  });

  test('it jumps when the jump is pressed, not while it is held; it rises about v²/2g and lands', () => {
    const { world, hero } = setUp();
    run(world, 60);
    let highest = 0;
    let jumps = 0;
    let wasGrounded = true;
    // The jump held for two seconds: one jump only.
    run(world, 120, () => {
      if (wasGrounded && !hero.character!.grounded) jumps++;
      wasGrounded = hero.character!.grounded;
      highest = Math.max(highest, y(hero));
      return input([0, 0, 0], true);
    });
    expect(jumps).toBe(1);
    // 6.5 m/s on Earth: 6.5² / (2 · 9.81) = 2.15 m above where it stood.
    expect(highest - STAND).toBeGreaterThan(2.0);
    expect(highest - STAND).toBeLessThan(2.2);
    expect(hero.character!.grounded).toBe(true);
    // Released and pressed again: another jump.
    run(world, 1, () => input());
    run(world, 10, () => input([0, 0, 0], true));
    expect(y(hero)).toBeGreaterThan(STAND + 0.3);
    world.dispose();
  });

  test('coyote time: a jump a few steps after leaving an edge still counts; later, it does not', () => {
    const jumpAfter = (stepsOffTheEdge: number) => {
      // A platform 2 m high whose edge is at x = 1; the character walks off it towards +x.
      const { world, hero } = setUp({
        at: [0, 2.8, 0],
        boxes: [
          [
            [0, 1, 0],
            [1, 1, 1],
          ],
        ],
      });
      run(world, 60);
      let off = 0;
      let jumped = false;
      run(world, 60, () => {
        if (!hero.character!.grounded) off++;
        const jump = off === stepsOffTheEdge;
        if (jump) jumped = true;
        return input([1, 0, 0], jump && jumped);
      });
      const risen = hero.character!.velocity[1] > 0 || y(hero) > 2.8;
      world.dispose();
      return { risen, highestCheck: risen };
    };
    expect(jumpAfter(DEFAULT_MOVEMENT.jump.coyote - 2).risen).toBe(true);
    expect(jumpAfter(DEFAULT_MOVEMENT.jump.coyote + 6).risen).toBe(false);
  });

  test('a jump asked for a few steps before landing is kept, and happens on landing', () => {
    const { world, hero } = setUp({ at: [0, 3, 0] });
    // Falling: the jump is pressed when it is 4 steps from the floor (about 0.6 m above it).
    let pressed = false;
    let landedAt = 0;
    let rose = false;
    run(world, 90, (step) => {
      const press = !pressed && !hero.character!.grounded && y(hero) < STAND + 0.35 && hero.character!.velocity[1] < 0;
      if (press) pressed = true;
      if (hero.character!.grounded && !landedAt) landedAt = step;
      if (landedAt && hero.character!.velocity[1] > 1) rose = true;
      return input([0, 0, 0], press);
    });
    expect(pressed).toBe(true);
    expect(rose).toBe(true);
    world.dispose();
  });

  test('it climbs a 30 cm step by walking, but not a 60 cm wall; and it pushes a cube', () => {
    // A long step (from x = 1.5 to 5.5): after a second of walking, it is on top of it.
    const step = setUp({
      boxes: [
        [
          [3.5, 0.15, 0],
          [2, 0.15, 2],
        ],
      ],
    });
    run(step.world, 60);
    run(step.world, 60, () => input([1, 0, 0]));
    expect(step.hero.transform!.position[0]).toBeGreaterThan(2);
    expect(y(step.hero)).toBeCloseTo(STAND + 0.3, 1);

    const wall = setUp({
      boxes: [
        [
          [2, 0.3, 0],
          [0.5, 0.3, 2],
        ],
      ],
    });
    run(wall.world, 60);
    run(wall.world, 60, () => input([1, 0, 0]));
    expect(wall.hero.transform!.position[0]).toBeLessThan(1.5);
    expect(y(wall.hero)).toBeCloseTo(STAND, 1);

    const push = setUp();
    const cube = push.world.createEntity({
      transform: { position: [1.5, 0.25, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.25, 0.25, 0.25] } },
    });
    run(push.world, 60);
    run(push.world, 90, () => input([1, 0, 0]));
    expect(cube.transform!.position[0]).toBeGreaterThan(2);
    step.world.dispose();
    wall.world.dispose();
    push.world.dispose();
  });

  test('a jump next to a wall reaches its full height, and one while a spinning cube drags it is not cut short; a ceiling stops it', () => {
    /** How high it gets, and whether its velocity up was ever cut while rising (a ceiling, true or false). */
    const jump = (o: { boxes?: [Vec3, Vec3][]; spinner?: boolean; walk?: Vec3 }) => {
      const { world, hero } = setUp({ at: [0, 1.5, 3], boxes: o.boxes });
      if (o.spinner)
        world.createEntity({
          transform: { position: [0, 1, 0], rotation: quat.identity() },
          spin: { angularVelocity: [0.35, 0.9, 0.15] },
          body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
        });
      // Walk into the wall (or the cube) and press jump while touching it.
      run(world, 50, () => input(o.walk ?? [0, 0, -1]));
      let highest = 0;
      let cut = false;
      let rising = -1;
      run(world, 60, (step) => {
        highest = Math.max(highest, y(hero));
        const vUp = hero.character!.velocity[1];
        // Rising, its velocity up goes down by g × the step, each step, past the top.
        if (rising > 0 && Math.abs(rising - 9.81 * STEP - vUp) > 1e-6) cut = true;
        rising = vUp;
        return input([0, 0, 0], step < 3);
      });
      world.dispose();
      return { height: highest - STAND, cut };
    };
    // A wall right in front: z from 1.6 to 2.
    const wall = jump({
      boxes: [
        [
          [0, 2, 1.8],
          [2, 2, 0.2],
        ],
      ],
    });
    expect(wall.cut).toBe(false);
    expect(wall.height).toBeGreaterThan(2);
    // A spinning cube: whatever height its turning lets it reach (stage 3b: walking into it without
    // stopping a step now and then, it jumps from closer, and the cube's corners take some), never
    // taken for a ceiling.
    expect(jump({ spinner: true }).cut).toBe(false);
    // A ceiling 1 m above its head (a slab whose bottom is at 2.6 m): it stops there.
    const ceiling = jump({
      boxes: [
        [
          [0, 2.8, 3],
          [2, 0.2, 2],
        ],
      ],
      walk: [0, 0, 0],
    });
    expect(ceiling.cut).toBe(true);
    expect(ceiling.height).toBeLessThan(1.1);
  });

  test('told where to look, it looks there and walks sideways without turning (the aim)', () => {
    const { world, hero } = setUp();
    run(world, 60);
    // Looking at −Z, walking towards +X: a step to the side.
    run(world, 60, () => input([1, 0, 0], false, false, [0, 0, -1]));
    expect(hero.character!.facing).toEqual([0, 0, -1]);
    expect(hero.transform!.position[0]).toBeGreaterThan(4.2);
    expect(vec3.dot(quat.rotate(hero.transform!.rotation, [0, 0, -1]), [0, 0, -1])).toBeGreaterThan(0.999);
    world.dispose();
  });

  test('aiming (stage 4b): the pitch tilts where it aims, not its body; asked nothing, it aims level', () => {
    const { world, hero } = setUp();
    run(world, 60);
    const c = hero.character!;
    // Half of a quarter turn up, looking at +X.
    run(world, 2, () => ({ ...input([0, 0, 0], false, false, [1, 0, 0]), pitch: 0.5 }));
    expect(c.pitch).toBe(45);
    expect(c.facing).toEqual([1, 0, 0]);
    // Its body stays upright: it turns about its up only.
    expect(vec3.dot(quat.rotate(hero.transform!.rotation, [0, 1, 0]), [0, 1, 0])).toBeCloseTo(1, 12);
    const { ahead, above } = aimOf(c, [0, 1, 0]);
    expect(ahead[0]).toBeCloseTo(Math.SQRT1_2, 14);
    expect(ahead[1]).toBeCloseTo(Math.SQRT1_2, 14);
    expect(above[0]).toBeCloseTo(-Math.SQRT1_2, 14);
    expect(above[1]).toBeCloseTo(Math.SQRT1_2, 14);
    // Asked nothing: level again.
    run(world, 1, () => NO_INPUT);
    expect(c.pitch).toBe(0);
    world.dispose();
  });

  test("where it aims: level, its facing and its up exactly; straight up, its up; always of length 1 and square with the aim's up", () => {
    const facing: Vec3 = [0.6, 0, -0.8];
    expect(aimOf({ facing, pitch: 0 }, [0, 1, 0])).toEqual({ ahead: facing, above: [0, 1, 0] });
    const up = aimOf({ facing, pitch: 90 }, [0, 1, 0]);
    expect(up.ahead.map((v) => Math.abs(v) < 1e-15)).toEqual([true, false, true]);
    expect(up.ahead[1]).toBe(1);
    for (const pitch of [-90, -63, -12.6, 0.9, 27, 81]) {
      const { ahead, above } = aimOf({ facing, pitch }, [0, 1, 0]);
      expect(vec3.length(ahead)).toBeCloseTo(1, 14);
      expect(vec3.length(above)).toBeCloseTo(1, 14);
      expect(vec3.dot(ahead, above)).toBeCloseTo(0, 14);
      expect(Math.asin(ahead[1]) * (180 / Math.PI)).toBeCloseTo(pitch, 9);
    }
  });

  test('it turns on its own axis without moving, and walks where it looks: forward, back and to the side (tank controls)', () => {
    const { world, hero } = setUp();
    run(world, 60);
    const at: Vec3 = [...hero.transform!.position];
    // Half a second turning right: 30 steps of atan(3 / 60), about 86°; it does not move.
    run(world, 30, () => ({ ...NO_INPUT, turn: 1 }));
    const facing = hero.character!.facing;
    expect(Math.acos(vec3.dot(facing, [0, 0, -1]))).toBeCloseTo(30 * Math.atan(3 / 60), 9);
    expect(vec3.length(facing)).toBeCloseTo(1, 12);
    expect(facing[1]).toBe(0);
    expect(vec3.length(vec3.sub(hero.transform!.position, at))).toBeLessThan(0.01);
    // Forward: where it looks (+X, almost), and it keeps looking there.
    run(world, 60, () => ({ ...NO_INPUT, ahead: 1 }));
    expect(hero.transform!.position[0] - at[0]!).toBeGreaterThan(4);
    expect(hero.character!.facing).toEqual(facing);
    // Back: it does not turn around (it would, if it looked where it moves).
    const front = hero.transform!.position[0];
    run(world, 30, () => ({ ...NO_INPUT, ahead: -1 }));
    expect(hero.transform!.position[0]).toBeLessThan(front - 1); // (it first stops: it was going forward)
    expect(hero.character!.facing).toEqual(facing);
    // To its right (+Z, looking at +X), without turning.
    const z = hero.transform!.position[2];
    run(world, 30, () => ({ ...NO_INPUT, side: 1 }));
    expect(hero.transform!.position[2]).toBeGreaterThan(z + 1.5);
    expect(hero.character!.facing).toEqual(facing);
    world.dispose();
  });

  test('turning is additions, multiplications and a square root: atan(k) per step, on its ground, of length 1', () => {
    const k = 3 / 60;
    const once = turned([0, 0, -1], [0, 1, 0], 1, 3, 1 / 60);
    expect(Math.acos(vec3.dot(once, [0, 0, -1]))).toBeCloseTo(Math.atan(k), 12);
    expect(once[0]).toBeGreaterThan(0); // + is to the right: from −Z towards +X
    // Looking a little up, it turns on its ground (perpendicular to its up).
    const tilted = turned([0, 0.3, -1], [0, 1, 0], -1, 3, 1 / 60);
    expect(tilted[1]).toBe(0);
    expect(vec3.length(tilted)).toBeCloseTo(1, 12);
    expect(tilted[0]).toBeLessThan(0);
  });

  test('told where to look, turning does nothing: where to look comes first', () => {
    const { world, hero } = setUp();
    run(world, 30, () => ({ ...NO_INPUT, turn: 1, face: [0, 0, -1] }));
    expect(hero.character!.facing).toEqual([0, 0, -1]);
    world.dispose();
  });

  test('modes (stage 2b): on the ground it walks, off it it is in the air; resolved on every step', () => {
    const { world, hero } = setUp();
    run(world, 1);
    expect(hero.character!.mode).toBe('air'); // born above the floor
    run(world, 60);
    expect(hero.character!.mode).toBe('walk');
    run(world, 5, (step) => input([0, 0, 0], step === 1));
    expect(hero.character!.mode).toBe('air');
    world.dispose();
  });

  test("air control is data: at 0 a jump's arc cannot be steered; with the ground's, it steers as on the ground", () => {
    const sideways = (control: number) => {
      const { world, hero } = setUp();
      hero.character!.movement.air.control = control;
      run(world, 60);
      // A jump straight up, and only once in the air, the player asks to go to the side.
      run(world, 2, (step) => input([0, 0, 0], step === 1));
      run(world, 15, () => input([1, 0, 0]));
      const vx = hero.character!.velocity[0];
      world.dispose();
      return vx;
    };
    expect(sideways(0)).toBe(0);
    expect(sideways(14)).toBeCloseTo(15 * 14 * STEP, 6); // 14 m/s² for 15 steps
    expect(sideways(50)).toBeCloseTo(4.5, 6); // as on the ground: the walking speed at once
  });

  test('what carries it moves it this step only, whatever its mode; its velocity does not keep it', () => {
    const { world, hero } = setUp();
    run(world, 60);
    const x0 = hero.transform!.position[0];
    for (let i = 0; i < 30; i++) {
      hero.character!.carry = [2, 0, 0]; // the game says it on every step it applies (a wind, a belt…)
      run(world, 1);
    }
    expect(hero.transform!.position[0] - x0).toBeCloseTo(1, 2); // 2 m/s for half a second
    expect(hero.character!.velocity[0]).toBe(0);
    run(world, 30);
    expect(hero.transform!.position[0] - x0).toBeCloseTo(1, 2); // nothing carries it: it stays
    world.dispose();
  });

  test("a character's movement as it is asked for: only what is said changes, the rest is the default", () => {
    const world = new World({ seed: 1 });
    const hero = world.createEntity({
      transform: { position: [0, 1, 0], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1, movement: { jump: { speed: 3 }, air: { control: 0 } } },
    });
    expect(hero.character!.movement).toEqual({
      ...DEFAULT_MOVEMENT,
      jump: { ...DEFAULT_MOVEMENT.jump, speed: 3 },
      air: { control: 0 },
    });
    world.dispose();
  });

  test('double jump (stage 2c): a second press in the air jumps again, once; without it, nothing', () => {
    const highest = (doubleJump: boolean) => {
      const { world, hero } = setUp();
      hero.character!.can.doubleJump = doubleJump;
      run(world, 60);
      let top = 0;
      // Pressed on the ground, and pressed again (and again) in the air, at the top of the first jump.
      run(world, 120, (step) => {
        top = Math.max(top, hero.transform!.position[1]);
        return input([0, 0, 0], step === 1 || step === 40 || step === 60);
      });
      world.dispose();
      return top - STAND;
    };
    expect(highest(false)).toBeLessThan(2.3);
    expect(highest(true)).toBeGreaterThan(3.5); // two jumps' worth (a third press does nothing)
    expect(highest(true)).toBeLessThan(4.5);
  });

  test('glide (stage 2c): falling while holding the jump, it never falls faster than its limit', () => {
    const fastestFall = (glide: boolean) => {
      const { world, hero } = setUp({ at: [0, 12, 0] });
      hero.character!.can.glide = glide;
      let fastest = 0;
      run(world, 60, () => {
        fastest = Math.min(fastest, hero.character!.velocity[1]);
        return input([0, 0, 0], true);
      });
      world.dispose();
      return fastest;
    };
    expect(fastestFall(false)).toBeLessThan(-5);
    expect(fastestFall(true)).toBeCloseTo(-DEFAULT_MOVEMENT.glide.fall, 6);
  });

  test('climb (stage 2c): pushing against a 3 m wall, it climbs it and stands on top; without it, it stays below', () => {
    const climb = (can: boolean) => {
      // A block 3 m high and 3 m deep: room on top to land after the hop.
      const { world, hero } = setUp({
        boxes: [
          [
            [3, 1.5, 0],
            [1.5, 1.5, 3],
          ],
        ],
      });
      hero.character!.can.climb = can;
      run(world, 60);
      const modes = new Set<string>();
      let onTop = false;
      run(world, 300, () => {
        modes.add(hero.character!.mode);
        // Standing on the wall's top (it keeps pushing: later it walks across, and falls off the other side).
        if (hero.character!.grounded && hero.transform!.position[1] > 3.5) onTop = true;
        return input([1, 0, 0]);
      });
      world.dispose();
      return { onTop, modes };
    };
    const without = climb(false);
    expect(without.onTop).toBe(false);
    expect(without.modes.has('climb')).toBe(false);
    const withIt = climb(true);
    expect(withIt.modes.has('climb')).toBe(true);
    expect(withIt.onTop).toBe(true);
  });

  test('climb (stage 4a): it comes to its wall, to a centimeter from touching it, and never into it', () => {
    // The wall's face at x = 1.5; the character starts 1 m from it, and finds it with its ray 55 cm ahead.
    const { world, hero } = setUp({
      at: [0.5, 1, 0],
      boxes: [
        [
          [3, 3, 0],
          [1.5, 3, 3],
        ],
      ],
    });
    hero.character!.can.climb = true;
    run(world, 60);
    let closest = Infinity;
    let climbing = 0;
    run(world, 120, () => {
      if (hero.character!.mode === 'climb') {
        climbing++;
        closest = Math.min(closest, 1.5 - hero.transform!.position[0]);
      }
      return input([1, 0, 0]);
    });
    expect(climbing).toBeGreaterThan(60);
    // Touching: its radius (0.3 m) and the controller's gap (2 cm); it stays a centimeter more away.
    expect(closest).toBeGreaterThan(0.3 + 0.02);
    expect(closest).toBeLessThan(0.3 + 0.02 + 0.011);
    world.dispose();
  });

  test('climb (stage 2e2): climbing along a wall past its side edge, it lets go; only at the top does it hop', () => {
    // A narrow wall 6 m high (1.2 m wide along z): pushing into it at 45°, it climbs up and along it,
    // and its side edge comes long before its top.
    const { world, hero } = setUp({
      boxes: [
        [
          [2, 3, 0],
          [0.5, 3, 0.6],
        ],
      ],
    });
    hero.character!.can.climb = true;
    run(world, 60);
    // Straight at it until it climbs, then at 45°, along it.
    let climbed = false;
    let left: number | null = null;
    let peak = -Infinity;
    run(world, 150, (step) => {
      const c = hero.character!;
      const y = hero.transform!.position[1];
      if (c.mode === 'climb') climbed = true;
      else if (climbed && left === null) left = y;
      if (left !== null) peak = Math.max(peak, y);
      return input(step < 50 ? [1, 0, 0] : [0.7, 0, 0.71]);
    });
    expect(hero.transform!.position[2]).toBeGreaterThan(0.6); // past the side edge
    world.dispose();
    // It climbed, and left the wall by its side, well below the top.
    expect(left).not.toBeNull();
    expect(left!).toBeGreaterThan(1);
    expect(left!).toBeLessThan(4);
    // Then it rose only what its climbing speed carried it (1.8 m/s: 16 cm), not the top's hop (4 m/s: 82 cm).
    expect(peak - left!).toBeLessThan(0.3);
  });

  test('climb (closing phase 2): at the top the hop takes it over the edge, even with no control in the air', () => {
    // A block 3 m high and 3 m deep, as above; but nothing steers it in the air: the hop alone has to
    // get it onto the top (before, only up: it fell back beside the wall and grabbed it again, forever).
    const { world, hero } = setUp({
      boxes: [
        [
          [3, 1.5, 0],
          [1.5, 1.5, 3],
        ],
      ],
    });
    hero.character!.can.climb = true;
    hero.character!.movement.air.control = 0;
    run(world, 60);
    let onTop = -1;
    let grabs = 0;
    let before = hero.character!.mode;
    run(world, 300, (step) => {
      const c = hero.character!;
      if (c.mode === 'climb' && before !== 'climb') grabs++;
      before = c.mode;
      if (onTop < 0 && c.grounded && hero.transform!.position[1] > 3.5) onTop = step;
      return input([1, 0, 0]);
    });
    world.dispose();
    expect(onTop, 'standing on top').toBeGreaterThan(0);
    expect(grabs, 'it grabbed the wall once').toBe(1);
  });

  test('climb (closing phase 2): climbing turned off halfway up, it lets go and falls, with no hop', () => {
    // A wall 6 m high; climbing taken away (the console's `dojo.climb off`) at 2 m: in the code before
    // the phase closed, the wall it no longer looked for seemed to have ended, and it got the top's hop.
    const { world, hero } = setUp({
      boxes: [
        [
          [2, 3, 0],
          [0.5, 3, 3],
        ],
      ],
    });
    hero.character!.can.climb = true;
    run(world, 60);
    let off = -1;
    let rise = 0;
    for (let step = 1; step <= 240; step++) {
      world.inputs.set(1, input([1, 0, 0]));
      world.step();
      const y = hero.transform!.position[1];
      if (off < 0 && y > 2) {
        off = y;
        hero.character!.can.climb = false;
      } else if (off >= 0) rise = Math.max(rise, y - off);
    }
    world.dispose();
    expect(off, 'it climbed to 2 m').toBeGreaterThan(0);
    // It rose only what its climbing speed carried it (2.5 m/s: 32 cm), not the top's hop (4 m/s: 82 cm).
    expect(rise).toBeLessThan(0.4);
    expect(hero.character!.mode).not.toBe('climb');
  });

  test('climb (stage 2c): a jump from the wall takes it up and away from it', () => {
    const { world, hero } = setUp({
      boxes: [
        [
          [2, 3, 0],
          [0.5, 3, 3],
        ],
      ],
    });
    hero.character!.can.climb = true;
    run(world, 60);
    run(world, 60, () => input([1, 0, 0]));
    expect(hero.character!.mode).toBe('climb');
    const [x, y] = hero.transform!.position;
    // The jump, still pushing against the wall: while it goes up it does not grab it again.
    run(world, 10, (step) => input([1, 0, 0], step === 1));
    expect(hero.character!.mode).toBe('air');
    expect(hero.transform!.position[1]).toBeGreaterThan(y! + 0.4);
    // And letting go, it goes away from it.
    run(world, 10, () => input());
    expect(hero.transform!.position[0]).toBeLessThan(x! - 0.2);
    world.dispose();
  });

  /**
   * A character on a platform that moves (`mover`) or spins (`spin`), and nothing asked. It is born 5 cm
   * above it, and lands on it in its first steps (`landed`): born touching it, it would sink into it at
   * the first step, because the physics only sees a new body in its queries after its first step.
   */
  function onPlatform(platform: { mover?: Mover; spin?: Vec3 }, at: Vec3 = [0, 1.25, 0], height = 0.3) {
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
    });
    const board = world.createEntity({
      transform: { position: [0, height, 0], rotation: quat.identity() },
      body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [3, 0.1, 3] } },
      ...(platform.mover ? { mover: platform.mover } : {}),
      ...(platform.spin ? { spin: { angularVelocity: platform.spin } } : {}),
    });
    const hero = world.createEntity({
      transform: { position: at, rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    return { world, board, hero };
  }
  /** Ten steps: enough to land on the platform (5 cm fall, about 6 steps). */
  const landed = (world: World) => run(world, 10);

  test('a moving platform carries it (stage 2d): it goes along with it, without being asked anything', () => {
    const { world, board, hero } = onPlatform({ mover: { from: [0, 0.3, 0], to: [4, 0.3, 0], seconds: 2 } });
    landed(world);
    const offset = hero.transform!.position[0] - board.transform!.position[0];
    run(world, 110);
    expect(board.transform!.position[0]).toBeCloseTo(4, 2);
    // Where it stood on the platform, to the centimeter.
    expect(Math.abs(hero.transform!.position[0] - board.transform!.position[0] - offset)).toBeLessThan(0.01);
    expect(hero.character!.grounded).toBe(true);
    world.dispose();
  });

  test('a turning platform carries it around, and turns it with it (stage 2d)', () => {
    // 45° per second around y, the character 2 m from the center, looking at −Z.
    const { world, hero } = onPlatform({ spin: [0, Math.PI / 4, 0] }, [2, 1.25, 0]);
    run(world, 120); // 2 s: a quarter turn (but the first steps, landing)
    const [x, , z] = hero.transform!.position;
    expect(Math.hypot(x, z)).toBeCloseTo(2, 1); // still 2 m from the center
    expect(z).toBeLessThan(-1.7); // a quarter turn counterclockwise, seen from above: from +X to −Z
    expect(hero.character!.facing[0]).toBeLessThan(-0.9); // and it looks where −Z turned: to −X
    // Round and round, it does not drift: two whole turns later (16 s), the same place, to the millimeter.
    const before: Vec3 = [...hero.transform!.position];
    run(world, 960);
    expect(vec3.length(vec3.sub(hero.transform!.position, before))).toBeLessThan(0.001);
    world.dispose();
  });

  test('a platform that moves and turns at once: it goes with it and around it, once each (stage 2d)', () => {
    // Along x, 4 m in 2 s and back, turning 45° per second; the character 2 m from the center.
    const { world, board, hero } = onPlatform(
      { mover: { from: [0, 0.3, 0], to: [4, 0.3, 0], seconds: 2 }, spin: [0, Math.PI / 4, 0] },
      [2, 1.25, 0],
    );
    const arm = () => vec3.sub(hero.transform!.position, board.transform!.position);
    landed(world); // meanwhile, the platform goes on without it
    const start = arm();
    // A quarter turn is 120 steps (2 s at 45° per second): its arm from the center turns with it, once.
    // Turning 90° counterclockwise seen from above, (x, z) becomes (z, −x): a quarter turn, not two.
    run(world, 120);
    expect(vec3.length(vec3.sub(arm(), [start[2], start[1], -start[0]]))).toBeLessThan(0.005);
    run(world, 120); // half a turn, while the platform comes back along x
    expect(vec3.length(vec3.sub(arm(), [-start[0], start[1], -start[2]]))).toBeLessThan(0.005);
    world.dispose();
  });

  test('a platform that goes up and down (a lift) takes it up and down, standing on it all the way (stage 2d)', () => {
    // 3 m up in 1.5 s and down again, faster down than it would fall in the first steps.
    const { world, board, hero } = onPlatform({ mover: { from: [0, 0.3, 0], to: [0, 3.3, 0], seconds: 1.5 } });
    landed(world);
    const height = hero.transform!.position[1] - board.transform!.position[1];
    let highest = 0;
    let always = true;
    run(world, 180, () => {
      highest = Math.max(highest, board.transform!.position[1]);
      always &&= hero.character!.grounded && Math.abs(hero.transform!.position[1] - board.transform!.position[1] - height) < 0.01;
      return input();
    });
    expect(highest).toBeGreaterThan(3.2);
    expect(always).toBe(true);
    world.dispose();
  });

  test('walking off a moving platform, it keeps its velocity, as jumping (stage 2d)', () => {
    // The platform at 2 m/s along x, its top 1.4 m above the floor; the character walks towards +Z,
    // off its edge (3 m away). (With its top at 0.4 m, it would step down to the floor as down a curb,
    // without ever leaving the ground: there would be no velocity to keep.)
    const { world, hero } = onPlatform({ mover: { from: [0, 1.3, 0], to: [8, 1.3, 0], seconds: 4 } }, [0, 2.25, 0], 1.3);
    landed(world);
    let off = 0;
    let leaving = 0;
    run(world, 90, (step) => {
      if (!off && !hero.character!.grounded) {
        off = step;
        leaving = hero.character!.velocity[0];
      }
      return input(off ? [0, 0, 0] : [0, 0, 1]);
    });
    expect(off).toBeGreaterThan(0);
    expect(leaving).toBeCloseTo(2, 1); // as it leaves, with the platform's 2 m/s
    world.dispose();
  });

  test('stepping down from a moving platform, standing all the way, it keeps its velocity (stage 2.5b)', () => {
    // The course's ferry: 30 cm high, here at 2 m/s along x. The character walks towards +Z, off its
    // edge, and steps down to the floor without leaving the ground. Before, it stopped dead there.
    const { world, hero } = onPlatform({ mover: { from: [0, 0.15, 0], to: [8, 0.15, 0], seconds: 4 } }, [0, 1.1, 0], 0.15);
    landed(world);
    let down = 0;
    let air = false;
    const xs: number[] = [];
    const vx: number[] = [];
    run(world, 90, (step) => {
      air ||= !hero.character!.grounded;
      if (!down && hero.character!.grounded && hero.transform!.position[1] < 0.9) down = step;
      if (down) {
        xs.push(hero.transform!.position[0]);
        vx.push(hero.character!.velocity[0]);
      }
      return input(down ? [0, 0, 0] : [0, 0, 1]);
    });
    expect(down).toBeGreaterThan(0);
    expect(air).toBe(false); // standing all the way: down as a curb, never in the air
    // On the platform its velocity is its own (the platform carries it apart); on the floor, the next
    // step, it has the platform's 2 m/s, and walking (asked nothing) slows it down from there.
    expect(vx[1]).toBeCloseTo(2, 1);
    expect(xs[6]! - xs[0]!).toBeGreaterThan(0.04); // it went on along x (before: 0, it stopped dead)
    world.dispose();
  });

  test("on a platform's edge, its center beyond it and its capsule still on it, the platform carries it (stage 2.5b)", () => {
    // The platform, 6 m wide (its edge at x = 3), going along z at 2 m/s; the character with its
    // center 0.1 m beyond the edge (its capsule, 0.3 m in radius, still 0.2 m over it). A ray from its
    // center finds nothing there; its capsule does.
    const { world, board, hero } = onPlatform({ mover: { from: [0, 0.3, 0], to: [0, 0.3, 8], seconds: 4 } }, [3.1, 1.25, 0]);
    landed(world);
    expect(hero.character!.grounded).toBe(true);
    expect(hero.transform!.position[0]).toBeGreaterThan(3.05); // still beyond the edge
    const offset = hero.transform!.position[2] - board.transform!.position[2];
    run(world, 60);
    // Carried, to the centimeter: where it stood on the platform along z.
    expect(Math.abs(hero.transform!.position[2] - board.transform!.position[2] - offset)).toBeLessThan(0.01);
    expect(hero.character!.ground.velocity[2]).toBeCloseTo(2, 2);
    world.dispose();
  });

  test('a jump from a moving platform keeps its velocity (stage 2d)', () => {
    const { world, hero } = onPlatform({ mover: { from: [0, 0.3, 0], to: [6, 0.3, 0], seconds: 2 } });
    run(world, 30);
    run(world, 1, () => input([0, 0, 0], true));
    expect(hero.character!.grounded).toBe(false);
    expect(hero.character!.velocity[0]).toBeCloseTo(3, 1); // the platform's 3 m/s, as it leaves it
    world.dispose();
  });

  test('told where to look, the same thing all the way, a turning platform still turns it (stage 2d)', () => {
    // As an aiming camera that does not move: `face` is −Z on every step. 45° per second around y.
    const { world, hero } = onPlatform({ spin: [0, Math.PI / 4, 0] }, [2, 1.25, 0]);
    const aiming = () => input([0, 0, 0], false, false, [0, 0, -1]);
    run(world, 10, aiming); // it lands, looking at −Z (the platform turned it a little meanwhile)
    const start: Vec3 = [...hero.character!.facing];
    run(world, 120, aiming); // a quarter turn
    // Turning 90° counterclockwise seen from above, (x, z) becomes (z, −x): it looks a quarter turn later.
    expect(vec3.length(vec3.sub(hero.character!.facing, [start[2], 0, -start[0]]))).toBeLessThan(0.01);
    world.dispose();
  });

  test('faceFor: asked to look along a direction of the world, after a platform turned it, it looks there (stage 2d)', () => {
    const { world, hero } = onPlatform({ spin: [0, Math.PI / 4, 0] }, [2, 1.25, 0]);
    run(world, 130); // carried a quarter turn and more: its carried turn is not nothing any more
    expect(Math.abs(hero.character!.carriedTurn[1])).toBeGreaterThan(0.3);
    const east: Vec3 = [1, 0, 0];
    // One step to ask for it, one to read it (each step the platform turns it 0.75° more, on top).
    run(world, 1, () => input([0, 0, 0], false, false, faceFor(hero.character!, east)));
    expect(vec3.dot(hero.character!.facing, east)).toBeGreaterThan(0.999);
    world.dispose();
  });

  test('its "up" comes from the gravity: with gravity along −Z, it stands on a wall that is a floor', () => {
    // The same world turned: gravity towards −Z, and a "floor" whose top is at z = 0.
    const world = new World({ seed: 1, gravity: { kind: 'uniform', vector: [0, 0, -9.81] } });
    world.createEntity({
      transform: { position: [0, 0, -0.5], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 30, 0.5] } },
    });
    const hero = world.createEntity({
      transform: { position: [0, 0, 1.5], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1, facing: [1, 0, 0] },
    });
    run(world, 120);
    expect(hero.character!.grounded).toBe(true);
    expect(hero.transform!.position[2]).toBeCloseTo(STAND, 1);
    // Its head points along +Z, and it walks on that wall-floor.
    expect(vec3.dot(quat.rotate(hero.transform!.rotation, [0, 1, 0]), [0, 0, 1])).toBeGreaterThan(0.999);
    run(world, 60, () => input([0, 1, 0]));
    expect(hero.transform!.position[1]).toBeGreaterThan(4);
    expect(hero.transform!.position[2]).toBeCloseTo(STAND, 1);
    world.dispose();
  });
});

test('a collision pose per way of moving (stage 2e, for phase 4): the given one in its mode, the body in the rest', () => {
  const crouched = {
    shape: { kind: 'capsule' as const, halfHeight: 0.35, radius: 0.3 },
    offset: [0, 0.1, 0] as Vec3,
    rotation: quat.identity(),
  };
  const world = new World({ seed: 1 });
  const hero = world.createEntity({
    transform: { position: [0, 3, 0], rotation: quat.identity() },
    body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
    character: { player: 1, poses: { air: crouched } },
  });
  world.step();
  expect(hero.character!.mode).toBe('air');
  expect(poseOf(hero.character!, hero.body!)).toEqual(crouched);
  // Its own copy: changing what it was given does not change it.
  crouched.offset[1] = 9;
  expect(poseOf(hero.character!, hero.body!).offset[1]).toBe(0.1);
  // Walking, no pose given: its body's shape, centered and upright.
  hero.character!.mode = 'walk';
  expect(poseOf(hero.character!, hero.body!)).toEqual({ shape: hero.body!.shape, offset: [0, 0, 0], rotation: [0, 0, 0, 1] });
  world.dispose();
});

describe('the players inputs, through the session', () => {
  test('a press and its release before any step: the press is not lost (it enters, and then the release)', () => {
    const session = new Session(Course, { seed: 1 });
    session.step();
    // A quick tap of Space within one frame without a step: pressed, and released.
    session.setInput(1, { jump: true });
    session.setInput(1, NO_INPUT);
    session.step();
    expect(session.world.inputs.get(1)).toEqual({ jump: true });
    session.step();
    expect(session.world.inputs.get(1)).toEqual({});
    // Changes without a press in between are not queued: only the last one enters.
    session.setInput(1, { move: [1, 0, 0] });
    session.setInput(1, { move: [0, 0, 1] });
    session.step();
    expect(session.world.inputs.get(1)).toEqual({ move: [0, 0, 1] });
    expect(session.inputs.slice(-3).map((i) => i.input)).toEqual([{ jump: true }, {}, { move: [0, 0, 1] }]);
    session.world.dispose();
  });

  const Course: Cartridge = {
    id: 'test',
    title: 'Test',
    onStart(world) {
      world.createEntity({
        transform: { position: [0, -0.5, 0], rotation: quat.identity() },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [30, 0.5, 30] } },
      });
      world.createEntity({
        transform: { position: [0, 1.5, 0], rotation: quat.identity() },
        body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
        character: { player: 1 },
      });
    },
  };

  /** A little run around: walking, turning, jumping, running. */
  const script = (step: number): PlayerInput =>
    step < 40
      ? input()
      : step < 100
        ? input([0.6, 0, -0.8])
        : step < 130
          ? input([0.6, 0, -0.8], true)
          : step < 200
            ? input([-1, 0, 0], false, true)
            : input();

  test('they enter at the next step, are kept only when they change, and replaying them gives the same hash', () => {
    const play = () => {
      const session = new Session(Course);
      const hashes: number[] = [];
      for (let step = 1; step <= 240; step++) {
        // Asked every frame, as a presentation does: only the changes are kept.
        session.setInput(1, script(step));
        session.step();
        hashes.push(stateHash(session.world));
      }
      return { session, hashes };
    };
    const a = play();
    const b = play();
    expect(b.hashes).toEqual(a.hashes);
    expect(a.session.inputs.map((i) => i.step)).toEqual([40, 100, 130, 200]);
    // The movement is kept in hundredths (it travels in replays and over the network).
    a.session.setInput(1, input([0.123456, 0, 0]));
    a.session.step();
    expect(a.session.inputs.at(-1)!.input.move).toEqual([0.12, 0, 0]);
    a.session.setInput(1, { ...NO_INPUT, ahead: 0.987, side: -0.333, turn: 0.4567 });
    a.session.step();
    expect(a.session.inputs.at(-1)!.input).toMatchObject({ ahead: 0.99, side: -0.33, turn: 0.46 });
    a.session.world.dispose();
    b.session.world.dispose();
  });

  test("the game before the engine's phases (stage 2.5b): it sees this step's inputs, and what it sets is used in this same step", () => {
    const seen: string[] = [];
    // A wind that blows while the player holds jump: the game reads this step's input and sets what the
    // character carries, before the character phase reads it.
    const Windy: Cartridge = {
      ...Course,
      beforeStep(world) {
        const hero = [...world.entities.values()].find((e) => e.character)!;
        const held = world.inputs.get(1)?.jump === true;
        seen.push(`${world.tick + 1}:${held ? 'jump' : '-'}`);
        if (held) hero.character!.carry = [3, 0, 0];
      },
      onStep(world) {
        seen.push(`after ${world.tick}`);
      },
    };
    const session = new Session(Windy);
    for (let i = 0; i < 60; i++) session.step();
    const hero = [...session.world.entities.values()].find((e) => e.character)!;
    const x0 = hero.transform!.position[0];
    session.setInput(1, { jump: true });
    session.step();
    // The order: the game before (with this step's input), the engine, the game after.
    expect(seen.slice(-2)).toEqual(['61:jump', 'after 61']);
    // And the wind moved it in that same step: 3 m/s for a sixtieth of a second.
    expect(hero.transform!.position[0] - x0).toBeCloseTo(0.05, 2);
    session.world.dispose();
  });
});

describe('what the program moves, made solid (stage 3a)', () => {
  /** A world with no floor: a platform (its top at 0.5 m) and, maybe, a wall; and a character. */
  function platformWorld(
    platform: { type: 'fixed' | 'kinematic'; at: Vec3; half: Vec3; mover?: Mover; spin?: Vec3 },
    hero: Vec3,
    walls: [Vec3, Vec3][] = [],
  ) {
    const world = new World({ seed: 1 });
    const board = world.createEntity({
      transform: { position: platform.at, rotation: quat.identity() },
      body: { type: platform.type, shape: { kind: 'box', halfExtents: platform.half } },
      ...(platform.mover ? { mover: platform.mover } : {}),
      ...(platform.spin ? { spin: { angularVelocity: platform.spin } } : {}),
    });
    for (const [center, half] of walls)
      world.createEntity({
        transform: { position: center, rotation: quat.identity() },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: half } },
      });
    const character = world.createEntity({
      transform: { position: hero, rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    return { world, board, hero: character };
  }

  test('caught on the rear edge of a platform moving away, it steps onto it, as onto a still one (a little later)', () => {
    // Phase 2's close: boarding the ferry as it pulls away, it fell into the gap and its capsule rested
    // on the ferry's rear edge, 8 cm low, dragged along and never on it (a fixed platform, or one
    // standing still, it stepped onto in 13 steps). Here, put there: its round bottom on the edge.
    const cases = [
      ['fixed', 'fixed', undefined],
      ['still', 'kinematic', undefined],
      ['moving away', 'kinematic', { from: [0, 0.35, -1.5], to: [0, 0.35, -13.5], seconds: 5 }],
    ] as const;
    for (const [name, type, mover] of cases) {
      const { world, board, hero } = platformWorld(
        { type, at: [0, 0.35, -1.5], half: [1.5, 0.15, 1.5], ...(mover ? { mover: mover as Mover } : {}) },
        [0, 1.24, 0.26],
      );
      let on = -1;
      run(world, 120, (step) => {
        const [, y, z] = hero.transform!.position;
        const rear = board.transform!.position[2] + 1.5;
        if (on < 0 && hero.character!.grounded && y > 1.28 && z < rear - 0.4) on = step;
        return input([0, 0, -1]);
      });
      world.dispose();
      expect(on, `${name}: on the platform`).toBeGreaterThan(0);
      // Onto a fixed or a still one, in a quarter of a second (15 steps); onto one moving away, in half
      // a second (30): until it stands on it, the platform does not carry it, and goes away at 2.4 m/s.
      expect(on, `${name}: on it within`).toBeLessThan(type === 'kinematic' && mover ? 45 : 22);
    }
  });

  test('a platform that passes under a beam does not carry the character into it: the beam stops it', () => {
    // A platform going +X at 2 m/s, and a beam across its way at 4 m, 50 cm above it: the platform
    // passes under it, the character (1.6 m) does not. Phase 2's close: the carry was added after
    // the controller, without a collision test, and took it into the beam.
    const beam = 4 - 0.25 - 0.3; // where its capsule touches the beam
    const { world, hero } = platformWorld(
      {
        type: 'kinematic',
        at: [0, 0.35, 0],
        half: [1.5, 0.15, 1.5],
        mover: { from: [0, 0.35, 0], to: [8, 0.35, 0], seconds: 4 },
      },
      [0, 1.35, 0],
      [
        [
          [4, 2, 0],
          [0.25, 1, 3],
        ],
      ],
    );
    let furthest = -Infinity;
    run(world, 150, () => {
      furthest = Math.max(furthest, hero.transform!.position[0]);
      return input();
    });
    world.dispose();
    expect(furthest, 'it reached the beam').toBeGreaterThan(beam - 0.1);
    expect(furthest, 'and never went into it').toBeLessThan(beam + 0.03);
  });

  test("a turning platform's turn is a function of the step: ten minutes later, exactly where its function says", () => {
    // 45° a second around y. Its turn was added up step by step by the physics (deterministic, but
    // not a function of the step: a step could not be rebuilt without the ones before it).
    const { world, board } = platformWorld(
      { type: 'kinematic', at: [0, 0.35, 0], half: [1.5, 0.15, 1.5], spin: [0, Math.PI / 4, 0] },
      [9, 9, 9],
    );
    run(world, 36000);
    const expected = quat.fromDegrees([0, 1, 0], (45 * 36000) / 60);
    const r = board.transform!.rotation;
    const dot = Math.abs(r[0] * expected[0] + r[1] * expected[1] + r[2] * expected[2] + r[3] * expected[3]);
    world.dispose();
    expect(dot).toBeGreaterThan(1 - 1e-9);
  });
});

describe("what the floor is made of (stage 3b): a character's feet push as much as its friction lets them", () => {
  /** A character on a floor of a material (or a friction), walking along −Z at full speed, then let go. */
  function onFloor(floor: { material?: string; friction?: number }) {
    const world = new World({ seed: 1 });
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [40, 0.5, 40] }, ...floor },
    });
    const hero = world.createEntity({
      transform: { position: [0, STAND + 0.02, 30], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    run(world, 10);
    // Along the ground (standing, its velocity up is not 0: the controller holds it on the floor).
    const speed = () => Math.hypot(hero.character!.velocity[0], hero.character!.velocity[2]);
    // From standing still: its speed after half a second of walking.
    run(world, 30, () => input([0, 0, -1]));
    const afterHalfASecond = speed();
    run(world, 120, () => input([0, 0, -1]));
    const full = speed();
    // Let go: how many steps, and how far, until it stops.
    const from = hero.transform!.position[2];
    let steps = 0;
    while (speed() > 0 && steps < 600) {
      run(world, 1, () => input());
      steps++;
    }
    const slid = from - hero.transform!.position[2];
    world.dispose();
    return { afterHalfASecond, full, steps, slid };
  }

  test('on ice it slides: a twelfth of the push, so it takes twelve times longer to get going and to stop', () => {
    const stone = onFloor({ material: 'stone' });
    const ice = onFloor({ material: 'ice' });
    // On stone, at full speed in a tenth of a second; on ice, 50 × 0.05/0.6 = 4.17 m/s² for half a second.
    expect(stone.afterHalfASecond).toBeCloseTo(DEFAULT_MOVEMENT.walk.speed, 6);
    expect(ice.afterHalfASecond).toBeCloseTo(50 * (0.05 / 0.6) * 0.5, 3);
    // Both get to the same speed: the floor changes the push, not how fast its feet go.
    expect(ice.full).toBeCloseTo(stone.full, 6);
    // Let go: on stone it stops in 6 steps, 0.17 m on; on ice in 65, 2.39 m on (v² / 2a, by steps).
    expect(stone.steps).toBe(6);
    expect(ice.steps).toBe(65);
    expect(stone.slid).toBeCloseTo(0.167, 2);
    expect(ice.slid).toBeCloseTo(2.39, 2);
  });

  test('a floor that holds more than stone holds the same: feet do not walk faster on rubber; one that says nothing is stone', () => {
    const stone = onFloor({ material: 'stone' });
    expect(onFloor({ friction: 1.2 })).toEqual(stone);
    expect(onFloor({})).toEqual(stone);
  });
});

describe('standing, held by its floor (stage 3b)', () => {
  test('walking on a flat floor, it moves on every step (before, 2 to 6 steps in a hundred it did not move at all)', () => {
    /** Dropped onto a floor, then walking: the steps on which it moved less than half of what it was asked. */
    const stalls = (material: string, from: number, move: Vec3) => {
      const world = new World({ seed: 1 });
      world.createEntity({
        transform: { position: [0, -0.5, 0], rotation: quat.identity() },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [40, 0.5, 40] }, material },
      });
      const hero = world.createEntity({
        transform: { position: [20, from, 20], rotation: quat.identity() },
        body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
        character: { player: 1 },
      });
      for (let i = 0; i < 200 && !hero.character!.grounded; i++) world.step();
      let count = 0;
      let last = [...hero.transform!.position];
      run(world, 400, (step) => {
        const p = hero.transform!.position;
        const asked = Math.hypot(hero.character!.velocity[0], hero.character!.velocity[2]) * STEP;
        if (step > 5 && Math.hypot(p[0] - last[0]!, p[2] - last[2]!) < asked / 2) count++;
        last = [...p];
        return input(move);
      });
      world.dispose();
      return count;
    };
    // Pushed into its floor on every step, it sank into the controller's thin gap, and stuck there: 14,
    // 10, 23 and 8 such steps of these 400.
    expect([
      stalls('stone', 1.5, [-1, 0, 0]),
      stalls('ice', 1.5, [0, 0, -1]),
      stalls('stone', 1.2, [-0.7, 0, -0.7]),
      stalls('stone', STAND + 0.02, [-1, 0, 0]),
    ]).toEqual([0, 0, 0, 0]);
  });

  test('on a slope steeper than 30° it still slides down, standing still; on one of 18° it stays', () => {
    /** Put on a slope of so many degrees (around x), standing still for two seconds: how far down it went. */
    const slid = (degrees: number) => {
      const world = new World({ seed: 1 });
      world.createEntity({
        transform: { position: [0, 0, 0], rotation: quat.fromDegrees([1, 0, 0], degrees) },
        body: { type: 'fixed', shape: { kind: 'box', halfExtents: [3, 0.1, 8] } },
      });
      const hero = world.createEntity({
        transform: { position: [0, 1.2, 0], rotation: quat.identity() },
        body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
        character: { player: 1 },
      });
      run(world, 30, () => input());
      const from = y(hero);
      run(world, 120, () => input());
      world.dispose();
      return from - y(hero);
    };
    expect(slid(18)).toBeLessThan(0.01);
    // Slowly (14 cm in two seconds, as before this stage): one step of gravity at a time, since it keeps
    // no speed while it touches the ground. Written down for later.
    expect(slid(40)).toBeGreaterThan(0.1);
  });
});

describe('across a seam (stage 3c)', () => {
  test('walking from a lift that came up onto a ledge as high (to 32 bits: 0.00000004 m apart), it does not stick on the seam', () => {
    // The machines room's lift at the top and its ledge: 4.15 + 0.15 and 2.15 + 2.15, both 4.3 m, one a
    // hair higher. Standing on the lower one, its thin gap was a hair short over the other, and from
    // there a move along it met it at once: it stuck on the seam for good.
    const world = new World({ seed: 1 });
    buildLevel(
      world,
      levelFromText('# Manifold level 3\nbox 7 0.15 -4  1 0.15 1  lift 0 4 0 3 up\nbox 7 2.15 -6  1.5 2.15 1\nsignal up\n'),
    );
    const hero = world.createEntity({
      transform: { position: [7, 1.2, -4], rotation: quat.identity() },
      body: { type: 'character', shape: { kind: 'capsule', halfHeight: 0.5, radius: 0.3 } },
      character: { player: 1 },
    });
    run(world, 20);
    world.setSignal('up', 1);
    run(world, 200);
    expect(hero.transform!.position[1]).toBeCloseTo(5.12, 2);
    run(world, 40, () => input([0, 0, -1]));
    expect(hero.transform!.position[2], 'well onto the ledge').toBeLessThan(-5.5);
    expect(hero.character!.grounded).toBe(true);
    world.dispose();
  });
});
