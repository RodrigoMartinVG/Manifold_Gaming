import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { initPhysics, levelFromText, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { DOJO_ZONES } from './rules';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/** The room "surfaces", and what a test needs to drive it. */
function surfaces() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.surfaces!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const notices: string[] = [];
  const me = (): Entity => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  const at = () => me().transform!.position;
  const c = () => me().character!;
  const step = (input: PlayerInput = NO_INPUT, n = 1) => {
    for (let i = 0; i < n; i++) {
      session.setInput(1, input);
      session.step();
      for (const ev of session.world.stepEvents) if (ev.type === 'notice') notices.push([ev.say, ...(ev.values ?? [])].join(' '));
    }
  };
  const put = (x: number, y: number, z: number) => {
    expect(session.registry.run(`dojo.goto ${x} ${y} ${z}`, 'console').filter((m) => m.level === 'error')).toEqual([]);
    step();
    for (let i = 0; i < 200 && !c().grounded; i++) step();
  };
  /** Its speed along the ground. */
  const speed = () => Math.hypot(c().velocity[0], c().velocity[2]);
  return { session, notices, at, c, step, put, speed };
}

const walk = (x: number, z: number): PlayerInput => ({ ...NO_INPUT, move: [x, 0, z] });

describe('surfaces (stage 3b): what a floor is made of, and a zone that carries', () => {
  test("on the rink it slides: let go at full speed, it goes on 2.4 m (on the start's stone, 0.2)", () => {
    /** From standing at (x, z), walking along −Z for some steps (to full speed), then let go. */
    const slide = (x: number, z: number, steps: number) => {
      const m = surfaces();
      m.put(x, 1, z);
      m.step(walk(0, -1), steps);
      expect(m.speed()).toBeCloseTo(4.5, 6);
      const from = m.at()[2]!;
      let stopped = 0;
      while (m.speed() > 0 && stopped < 300) {
        m.step();
        stopped++;
      }
      return { steps: stopped, slid: from - m.at()[2]! };
    };
    // On the rink, along x = 1: between its posts (full speed takes 65 steps). On the start, from its
    // back (6 steps), still on its stone when let go.
    const ice = slide(1, 4, 90);
    const stone = slide(1, 10.5, 20);
    expect(stone.steps).toBe(6);
    expect(stone.slid).toBeLessThan(0.25);
    expect(ice.steps).toBe(65);
    expect(ice.slid).toBeGreaterThan(2.2);
    expect(ice.slid).toBeLessThan(2.6);
  });

  test('standing in the stream, it is carried at 3 m/s towards the edge, and over it: back to the checkpoint', () => {
    const m = surfaces();
    m.put(0, 1, -9); // the checkpoint, on the way
    m.put(0, 1, -12);
    const x = m.at()[0]!;
    m.step(NO_INPUT, 60);
    expect(m.at()[0]! - x).toBeCloseTo(3, 1);
    m.step(NO_INPUT, 120);
    expect(m.notices).toContain('dojo.fell');
  });

  test('walking against it, it advances 4.5 − 3 = 1.5 m/s: the current is one more contribution to its movement', () => {
    const m = surfaces();
    m.put(3.5, 1, -12);
    m.step(walk(-1, 0), 30);
    const from = m.at()[0]!;
    m.step(walk(-1, 0), 60);
    expect(m.at()[0]! - from).toBeCloseTo(-1.5, 2);
  });

  test('across it straight, it drifts 2.7 m; walking a little upstream, it crosses straight to the far side', () => {
    /** Walking from the checkpoint to the stream, then across it as asked: how far it drifted in it. */
    const across = (move: PlayerInput) => {
      const m = surfaces();
      m.put(0, 1, -9);
      for (let i = 0; i < 60 && m.at()[2]! > -10; i++) m.step(walk(0, -1));
      const entered = m.at()[0]!;
      for (let i = 0; i < 120 && m.at()[2]! > -14; i++) m.step(move);
      m.step(walk(0, -1), 15);
      return { drift: m.at()[0]! - entered, z: m.at()[2]!, fell: m.notices.includes('dojo.fell') };
    };
    // 4 m at 4.5 m/s, carried 3 m/s: 2.7 m.
    const straight = across(walk(0, -1));
    expect(straight.fell).toBe(false);
    expect(straight.z).toBeLessThan(-14.5);
    expect(straight.drift).toBeCloseTo((4 / 4.5) * 3, 0);
    // Upstream by as much as the current carries: 3 of its 4.5 m/s against it, the rest forward.
    const upstream = across(walk(-3 / 4.5, -Math.sqrt(1 - (3 / 4.5) ** 2)));
    expect(upstream.fell).toBe(false);
    expect(upstream.z).toBeLessThan(-14.5);
    expect(Math.abs(upstream.drift)).toBeLessThan(0.25);
  });

  test('jumping over it, or up from it, it is not carried in the air: the current takes hold through the feet', () => {
    // Before, the stream's zone was 5 m tall, and a jump over the water drifted as much as walking
    // through it: the author found it strange.
    const over = surfaces();
    over.put(0, 1, -9);
    over.step(walk(0, -1), 6);
    const x = over.at()[0]!;
    over.step({ ...walk(0, -1), jump: true });
    for (let i = 0; i < 120 && !(over.c().grounded && over.at()[2]! < -14.5); i++) over.step(walk(0, -1));
    expect(over.at()[2]!, 'over the stream, on the far side').toBeLessThan(-14.5);
    expect(Math.abs(over.at()[0]! - x), 'not carried').toBeLessThan(0.01);
    // Up from the water and down into it again: carried on the step it leaves (it stood), not after.
    const up = surfaces();
    up.put(-2, 1, -12);
    const from = up.at()[0]!;
    up.step({ ...NO_INPUT, jump: true });
    let steps = 1;
    while (!up.c().grounded && steps < 200) {
      up.step();
      steps++;
    }
    expect(steps, 'a whole jump').toBeGreaterThan(60);
    expect(up.at()[0]! - from).toBeCloseTo(3 / 60, 3);
  });

  test('the stream carries what the physics moves too (stage 3g): a ball rolls away with it; a stone cube on its bottom stays', () => {
    const m = surfaces();
    const world = m.session.world;
    const ball = world.createEntity({
      transform: { position: [-2, 0.3, -12], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.25 }, angularDamping: 0.8 },
    });
    const cube = world.createEntity({
      transform: { position: [-2, 0.3, -11], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'box', halfExtents: [0.3, 0.3, 0.3] }, material: 'stone' },
    });
    m.step(NO_INPUT, 30);
    const [b0, c0] = [ball.transform!.position[0]!, cube.transform!.position[0]!];
    m.step(NO_INPUT, 120);
    expect(ball.transform!.position[0]! - b0, 'the ball, downstream').toBeGreaterThan(1);
    expect(Math.abs(cube.transform!.position[0]! - c0), 'the cube, still').toBeLessThan(0.05);
  });

  test("the Dojo's levels are read with its zones: one it does not have, or a current without its flow, says its line", () => {
    const level = (line: string) => () => levelFromText(`# Manifold level 2\n${line}\n`, { zones: DOJO_ZONES });
    expect(level('sensor chekpoint 0 0 0  1 1 1')).toThrow(/line 2: "chekpoint" is not a zone of this game/);
    expect(level('sensor current 0 0 0  1 1 1')).toThrow(/line 2: a current needs its flow/);
    expect(level('sensor current 0 0 0  1 1 1  flow 1 0 0')).not.toThrow();
  });
});
