import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { CHARACTER_SHAPE, POSES } from '@manifold/character';
import {
  initPhysics,
  metricsOf,
  metricsOfEntity,
  NO_INPUT,
  registryFor,
  Session,
  type Entity,
  type PlayerInput,
} from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/**
 * THE METRICS GYM, MEASURED (stage 5a, decision 0017): each station of `gym.level` played as a person
 * would (no teleport within a station: put at its start, then driven), and what was reached set beside
 * what `metricsOf` says from the character's numbers. The games' levels are built from these: the
 * test holds them, so a change to the character changes them on purpose.
 */
function gym() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.gym!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const me = (): Entity => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  const at = (): Vec3 => [...me().transform!.position];
  const c = () => me().character!;
  const step = (input: PlayerInput = NO_INPUT) => {
    session.setInput(1, input);
    session.step();
  };
  /** Put somewhere, looking along −Z, and on the ground (`settle` more steps after it lands). */
  const put = (x: number, y: number, z: number, settle = 30) => {
    expect(session.registry.run(`dojo.goto ${x} ${y} ${z}`, 'console').filter((m) => m.level === 'error')).toEqual([]);
    // (The command moves it in the next step: until then it is where it was, and as grounded.)
    step();
    for (let i = 0; i < 200 && !c().grounded; i++) step();
    for (let i = 0; i < settle; i++) step();
  };
  /** Contacts let go of for nothing: steps in the air, on the way, without a jump. */
  let lost = 0;
  const walk = (input: PlayerInput, steps: number, until: () => boolean = () => false) => {
    for (let i = 0; i < steps && !until(); i++) {
      step(input);
      if (!c().grounded) lost++;
    }
  };
  return { session, me, at, c, step, put, walk, lostSince: () => lost, resetLost: () => (lost = 0) };
}

const AHEAD: Vec3 = [0, 0, -1];
/** How high its middle is over its feet, standing (the capsule's half height and radius). */
const MIDDLE = CHARACTER_SHAPE.kind === 'capsule' ? CHARACTER_SHAPE.halfHeight + CHARACTER_SHAPE.radius : 0.8;

describe('the metrics gym (stage 5a)', () => {
  let g: ReturnType<typeof gym>;
  let m: ReturnType<typeof metricsOf>;
  beforeAll(() => {
    g = gym();
    const body = CHARACTER_SHAPE.kind === 'capsule' ? CHARACTER_SHAPE : null;
    const crouch = POSES.crouch?.shape.kind === 'capsule' ? POSES.crouch.shape : undefined;
    m = metricsOf(g.c().movement, body!, 9.81, { crouch });
  });

  test('the jump, on flat ground: its feet rise 2.0995 m and it lands at step 79, 5.925 m on walking and 9.875 running, as metricsOf says', () => {
    for (const run of [false, true]) {
      // Across the floor along +X at z = 19.5, where nothing stands (the move is the character's own: to its right).
      g.put(-30, 1, 19.5);
      g.walk({ move: [1, 0, 0], run }, 60);
      const from = g.at();
      g.step({ move: [1, 0, 0], run, jump: true });
      let steps = 1;
      let top = 0;
      // The velocity asked against the velocity had: across, in the air, it keeps what it asked for.
      const across: number[] = [];
      while (steps < 200 && !g.c().grounded) {
        g.step({ move: [1, 0, 0], run });
        steps++;
        top = Math.max(top, g.at()[1]! - from[1]!);
        across.push(Math.hypot(g.c().velocity[0]!, g.c().velocity[2]!));
      }
      const asked = run ? g.c().movement.walk.run : g.c().movement.walk.speed;
      expect(Math.min(...across)).toBeCloseTo(asked, 9);
      expect(Math.max(...across)).toBeCloseTo(asked, 9);
      expect(steps).toBe(m.jump.back);
      expect(top).toBeCloseTo(m.jump.height, 4);
      expect(g.at()[0]! - from[0]!).toBeCloseTo(run ? m.reach.run : m.reach.walk, 3);
    }
  });

  test('onto a block: 2.2 m from walking up to it, not 2.5 (its feet rise 2.0995 m, and its round foot rides an edge a little higher, as up a step)', () => {
    const HEIGHTS = [0.35, 0.5, 1.0, 1.5, 1.8, 2.0, 2.1, 2.2, 2.5];
    const reached = HEIGHTS.filter((h, k) => {
      g.put(-28 + 3 * k, 1, 24);
      // Walking at it, a jump half a meter before its face (z = 22.6), on forward.
      g.walk({ move: AHEAD }, 120, () => g.at()[2]! < 23.2);
      g.step({ move: AHEAD, jump: true });
      g.walk({ move: AHEAD }, 120, () => g.c().grounded && g.at()[2]! < 22.4);
      return g.c().grounded && g.at()[1]! > h + MIDDLE - 0.1;
    });
    expect(Math.max(...reached)).toBe(2.2);
    expect(Math.max(...reached)).toBeGreaterThan(m.jump.height);
    expect(Math.max(...reached)).toBeLessThanOrEqual(m.jump.height + m.step);
  });

  test('a step: walked up to 0.4 m, not 0.5 (the controller’s 0.35, and its round foot rides an edge a little higher)', () => {
    const STEPS = [0.2, 0.3, 0.35, 0.4, 0.5];
    const up = STEPS.filter((h, k) => {
      g.put(-28 + 3 * k, 1, 29);
      g.walk({ move: AHEAD }, 120, () => g.at()[2]! < 27);
      return g.at()[1]! > h + MIDDLE - 0.1;
    });
    expect(Math.max(...up)).toBe(0.4);
    expect(m.step).toBe(0.35);
  });

  test('a gap, 2 m up: across 6 m walking and 10 m running, its reach and a little more (its body lands on the edge)', () => {
    const GAPS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const across = (run: boolean) =>
      GAPS.filter((gap, k) => {
        g.put(-28 + 3 * k, 3, 5);
        // On along the runway; the step it is no longer on it, a jump (coyote time), on forward; and
        // across if, landed, it stays up there walking on.
        g.walk({ move: AHEAD, run }, 300, () => !g.c().grounded);
        g.step({ move: AHEAD, run, jump: true });
        g.walk({ move: AHEAD, run }, 200, () => g.c().grounded);
        g.walk({ move: AHEAD }, 20);
        return g.at()[1]! > 2 + MIDDLE - 0.1 && g.at()[2]! < -2 - gap;
      });
    const walking = Math.max(...across(false));
    const running = Math.max(...across(true));
    expect([walking, running]).toEqual([6, 10]);
    for (const [gap, reach] of [
      [walking, m.reach.walk],
      [running, m.reach.run],
    ] as const) {
      expect(gap).toBeGreaterThan(reach - m.width);
      expect(gap).toBeLessThan(reach + m.width);
    }
  });

  test('a slope: stood on up to 30° and slid down from 35°; walked up to 45°, not 55° (it climbs to 50°, pushing against the slide)', () => {
    const SLOPES = [10, 20, 25, 30, 35, 45, 55];
    const slant = (a: number) => Math.tan((a * Math.PI) / 180);
    const held = SLOPES.filter((a, k) => {
      if (a > 50) return false;
      // Dropped onto it halfway up, a sixth of a second to come to rest on it (grounded within the
      // controller's snap, it is still a few centimeters above), and then left alone for two seconds.
      g.put(4 + 3 * k, 0.5 + MIDDLE + 0.3, 0.5 / slant(a), 10);
      const from = g.at();
      g.walk(NO_INPUT, 120);
      const to = g.at();
      return Math.hypot(to[0]! - from[0]!, to[1]! - from[1]!, to[2]! - from[2]!) < 0.05;
    });
    expect(Math.max(...held)).toBe(m.slope);
    const up = SLOPES.filter((a, k) => {
      g.put(4 + 3 * k, 1, 1 / slant(a) + 1.5);
      g.walk({ move: AHEAD }, 300, () => g.at()[2]! < -1);
      return g.at()[1]! > 1 + MIDDLE - 0.1;
    });
    expect(Math.max(...up)).toBe(45);
    expect(Math.max(...up)).toBeLessThan(m.climb);
  });

  test('a corridor: through 0.65 m, not 0.6 (its body is 0.6 wide, and keeps a gap)', () => {
    const WIDTHS = [0.55, 0.6, 0.65, 0.7, 0.8];
    const through = WIDTHS.filter((w, k) => {
      g.put(4 + 4 * k, 1, 28);
      g.walk({ move: AHEAD }, 300, () => g.at()[2]! < 21.5);
      return g.at()[2]! < 21.5;
    });
    expect(Math.min(...through)).toBe(0.65);
    expect(Math.min(...through)).toBeGreaterThan(m.width + 2 * m.gap);
  });

  test('a ceiling: under 1.65 m standing (it is 1.6 tall), under 1.15 m crouched (1.1)', () => {
    const CEILINGS = [0.95, 1.05, 1.15, 1.6, 1.65, 1.7];
    const under = (crouch: boolean) =>
      CEILINGS.filter((h, k) => {
        g.put(4 + 4 * k, 1, 19);
        g.walk({ move: AHEAD, crouch }, 300, () => g.at()[2]! < 13.5);
        return g.at()[2]! < 13.5;
      });
    const standing = Math.min(...under(false));
    const crouched = Math.min(...under(true));
    expect([standing, crouched]).toEqual([1.65, 1.15]);
    expect(m.tall).toBeLessThan(standing);
    expect(m.crouched).toBeLessThan(crouched);
  });

  test('the console’s `metrics`: the character’s own, where it is; `set` a number and they follow (a soft jump of 4.5 m/s: a meter)', () => {
    const { session, me } = g;
    expect(metricsOfEntity(session.world, me())).toEqual(m);
    const id = me().id;
    expect(
      session.registry.run(`set ${id} character.movement.jump.speed 4.5`, 'console').filter((x) => x.level === 'error'),
    ).toEqual([]);
    g.step();
    expect(metricsOfEntity(session.world, me())!.jump.height).toBeCloseTo(1.0, 1);
    expect(
      session.registry.run(`set ${id} character.movement.jump.speed 6.5`, 'console').filter((x) => x.level === 'error'),
    ).toEqual([]);
    g.step();
    expect(metricsOfEntity(session.world, me())).toEqual(m);
  });

  test('the kit’s seams: walked and run across 40 tiles of a meter and 9 of four, never a contact let go of for nothing', () => {
    for (const [x, from, to] of [
      [28, 22, -20],
      [31, 20, -18],
    ] as const)
      for (const run of [false, true]) {
        g.put(x, 1, from);
        // Onto the lane (a step of 0.2 m), then counted.
        g.walk({ move: AHEAD, run }, 60, () => g.at()[2]! < from - 3);
        g.resetLost();
        g.walk({ move: AHEAD, run }, 600, () => g.at()[2]! < to + 1);
        expect(g.at()[2]!, `along the lane at x = ${x}`).toBeLessThan(to + 1.5);
        expect(g.lostSince(), `steps in the air at x = ${x}${run ? ', running' : ''}`).toBe(0);
      }
  });

  test('the platformer (stage 5c, the tower’s: dojo.arc, dojo.walljump, dojo.ledge): its jump exactly 2 m, back at step 45; ledges grabbed to 3.25 m (its hands reach 3.32); chimneys climbed to 4 m wide, not 5 (metricsOf: 4.46)', () => {
    const { session, me } = g;
    for (const line of ['dojo.arc on', 'dojo.walljump on', 'dojo.ledge on'])
      expect(session.registry.run(line, 'console').filter((x) => x.level === 'error')).toEqual([]);
    g.step();
    const p = metricsOfEntity(session.world, me())!;
    // On flat ground, the jump held: its feet exactly 2 m up, back at step 45, 3.375 m on walking.
    g.put(-30, 1, 19.5);
    g.walk({ move: [1, 0, 0] }, 60);
    const from = g.at();
    let steps = 0;
    let top = 0;
    do {
      g.step({ move: [1, 0, 0], jump: true });
      steps++;
      top = Math.max(top, g.at()[1]! - from[1]!);
    } while (steps < 200 && !g.c().grounded);
    expect(steps).toBe(p.jump.back);
    expect(top).toBeCloseTo(2, 3);
    expect(g.at()[0]! - from[0]!).toBeCloseTo(p.reach.walk, 3);
    // Ledges (their face at z = 9.5), walked up to and jumped at, the jump held (let go, a short hop).
    const LEDGES = [2.5, 3.0, 3.25, 3.5, 3.75];
    const grabbed = LEDGES.filter((_, k) => {
      g.put(4 + 4 * k, 1, 12);
      g.walk({ move: AHEAD }, 120, () => g.at()[2]! < 10.4);
      g.walk({ move: AHEAD, jump: true }, 60, () => g.c().mode === 'hang');
      return g.c().mode === 'hang';
    });
    expect(grabbed).toEqual([2.5, 3.0, 3.25]);
    expect(Math.max(...grabbed)).toBeLessThan(p.ledge);
    // Chimneys: from one wall to the other, the jump held, let go for a step on a wall and pressed again
    // still towards it (the wall it leaps off); how high in 400 steps (the walls: 8 m).
    const CHIMNEYS = [2.0, 3.0, 4.0, 4.5, 5.0];
    const heights = CHIMNEYS.map((_, k) => {
      g.put(-28 + 6.5 * k, 1, 14);
      let way = 1;
      let wait = 0;
      let high = 0;
      let held = true;
      g.step({ move: [way, 0, 0], jump: true });
      for (let i = 0; i < 400; i++) {
        let jump: boolean = held;
        let pressed = false;
        if (g.c().mode === 'slide' && wait === 0) {
          if (held) held = jump = false;
          else {
            held = jump = pressed = true;
            way = -way;
            wait = 10;
          }
        }
        wait = Math.max(0, wait - 1);
        g.step({ move: [pressed ? -way : way, 0, 0], jump });
        high = Math.max(high, g.at()[1]! - MIDDLE);
      }
      return high;
    });
    const climbed = CHIMNEYS.filter((_, k) => heights[k]! >= 7.9);
    expect(climbed).toEqual([2.0, 3.0, 4.0]);
    // Past 4.46 m its jumps come back lower than they left: at 4.5 it still climbs a while, not to the top; at 5, hardly.
    expect(p.wall.chimney).toBeGreaterThan(4);
    expect(p.wall.chimney).toBeLessThan(4.5);
    expect(heights[4]!).toBeLessThan(heights[3]!);
    for (const line of ['dojo.arc off', 'dojo.walljump off', 'dojo.ledge off']) session.registry.run(line, 'console');
    g.step();
  });
});
