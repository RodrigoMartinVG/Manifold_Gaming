import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/**
 * THE CIRCUIT, PLAYED (closing phase 2): the room "circuit" from its start to its goal, with no
 * teleport, by a driver that does what a player does: it steers towards a point at every step, jumps
 * at an edge (one press; holding the jump while falling glides), waits for the ferry and the lift.
 * Closed-loop, not a fixed list of inputs: a small change in the level or the character changes
 * when it jumps, not whether it gets there. If a part is no longer possible, it says which.
 */
function circuit() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.circuit!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const notices: string[] = [];
  const me = (): Entity => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  const at = () => me().transform!.position;
  const c = () => me().character!;
  const step = (input: PlayerInput) => {
    session.setInput(1, input);
    session.step();
    for (const ev of session.world.stepEvents) if (ev.type === 'notice') notices.push([ev.say, ...(ev.values ?? [])].join(' '));
  };
  /** The way to a point on the ground (x, z), from where it is. */
  const toward = (x: number, z: number): Vec3 => {
    const [px, , pz] = at();
    const d = Math.hypot(x - px!, z - pz!);
    return d < 0.05 ? [0, 0, 0] : [(x - px!) / d, 0, (z - pz!) / d];
  };
  /** Steps until `done` (at most `max`: a part that does not end fails, saying where it was). */
  const until = (part: string, done: () => boolean, input: () => PlayerInput, max = 1200) => {
    for (let i = 0; i < max; i++) {
      if (done()) return;
      step(input());
    }
    throw new Error(`${part}: not done in ${max} steps; at ${at().map((n) => n.toFixed(2))}, ${c().mode}`);
  };
  /** A machine (a box that moves), by where it starts. */
  const machine = (from: Vec3) =>
    [...session.world.entities.values()].find((e) => e.mover && e.mover.from.every((v, i) => Math.abs(v - from[i]!) < 1e-6))!;
  /** Standing on something, near a height. */
  const standingAt = (y: number) => c().grounded && Math.abs(at()[1]! - y) < 0.15;

  /** Walks (or runs) to (x, z) and stops there, standing. */
  const go = (part: string, x: number, z: number, run = false) =>
    until(
      part,
      () => c().grounded && Math.hypot(at()[0]! - x, at()[2]! - z) < 0.25,
      () => ({ move: toward(x, z), run }),
    );
  /**
   * Heads for (x, z) and jumps once, when `edge` says it is at the edge; then lands standing at
   * height `y` (a little more than the box's top: where its center stands). `glide` holds the jump
   * while falling; `twice` jumps again at the top of the first.
   */
  const leap = (
    part: string,
    x: number,
    z: number,
    y: number,
    edge: () => boolean,
    o: { run?: boolean; glide?: boolean; twice?: boolean } = {},
  ) => {
    let jumps = 0;
    let held = false;
    let flying = false;
    until(
      part,
      () => {
        if (jumps > 0 && !c().grounded) flying = true;
        return flying && standingAt(y);
      },
      () => {
        let jump = false;
        if (jumps === 0 && c().grounded && edge()) {
          jump = true;
          jumps = 1;
        } else if (o.twice && jumps === 1 && !c().grounded && c().velocity[1]! < 0.5 && !held) {
          jump = true;
          jumps = 2;
        } else if (o.glide && jumps > 0) jump = true; // held from the press on (let go a step, it was a second jump)
        held = jump;
        return { move: toward(x, z), run: o.run ?? false, jump };
      },
      900,
    );
  };
  /**
   * Tries a jump with less than what a part asks for: where it ends standing (its height), or null if
   * it fell into the void.
   */
  const attempt = (x: number, z: number, edge: () => boolean, o: { run?: boolean; glide?: boolean; twice?: boolean } = {}) => {
    const falls = notices.filter((n) => n.startsWith('dojo.fell')).length;
    let jumps = 0;
    let held = false;
    let flying = false;
    for (let i = 0; i < 900; i++) {
      if (notices.filter((n) => n.startsWith('dojo.fell')).length > falls) return null;
      if (jumps > 0 && !c().grounded) flying = true;
      if (flying && c().grounded) return at()[1]!;
      let jump = false;
      if (jumps === 0 && c().grounded && edge()) {
        jump = true;
        jumps = 1;
      } else if (o.twice && jumps === 1 && !c().grounded && c().velocity[1]! < 0.5 && !held) {
        jump = true;
        jumps = 2;
      } else if (o.glide && jumps > 0) jump = true; // held from the press on (let go a step, it was a second jump)
      held = jump;
      step({ move: toward(x, z), run: o.run ?? false, jump });
    }
    throw new Error(`the attempt did not end; at ${at().map((n) => n.toFixed(2))}`);
  };
  /** Puts the character somewhere (the lab's `dojo.goto`) and lets it land. */
  const put = (x: number, y: number, z: number) => {
    expect(session.registry.run(`dojo.goto ${x} ${y} ${z}`, 'console').filter((m) => m.level === 'error')).toEqual([]);
    until(
      'landing',
      () => c().grounded,
      () => NO_INPUT,
      200,
    );
  };
  return { session, notices, at, c, step, toward, until, machine, standingAt, go, leap, attempt, put };
}

/** Where a character's center stands on a box whose top is at `top`. */
const on = (top: number) => top + 0.82;

describe('the circuit (closing phase 2)', () => {
  test('it can be played from the start to the goal, through its four checkpoints and its three stars', () => {
    const { notices, at, c, step, toward, until, machine, standingAt, go, leap } = circuit();
    until(
      'landing at the start',
      () => c().grounded,
      () => NO_INPUT,
      120,
    );

    // 1. The yard, under the low roof, and 2. the jumps: 2 m, 3 m and up, 3.5 m and down.
    go('through the yard', 0, -5);
    leap('2 m to the first pillar', 0, -9, on(0), () => at()[2]! < -5.75);
    leap('3 m and a meter up', 0, -14, on(1), () => at()[2]! < -9.75);
    leap('3.5 m and half a meter down', 0, -20, on(0.5), () => at()[2]! < -14.75);
    go('along the beam, to the first checkpoint', 0, -32);
    expect(notices.at(-1)).toBe('dojo.checkpoint');
    // 7 m: only running.
    go('back, to take a run', 0, -31);
    leap('7 m, running', 0, -44.5, on(0.5), () => at()[2]! < -35.2, { run: true });

    // 3. The machines: the ferry, to the second checkpoint. As a player boards it: at the edge, waiting
    // for it, and stepping on as it arrives. (Boarding as it pulls away, it falls into the gap and is
    // caught on its edge, carried: the controller and moving bodies, in the roadmap for phase 3.) The
    // driver keeps to its center as it moves, and waits for itself to arrive, not for the ferry.
    const ferry = machine([0, 0.35, -48]);
    const ferryZ = () => ferry.transform!.position[2]!;
    const onFerry = () => c().grounded && Math.abs(at()[0]!) < 1.2 && Math.abs(at()[2]! - ferryZ()) < 1.2;
    go('to the edge, to wait for the ferry', 0, -46.15);
    let last = ferryZ();
    until(
      'the ferry, coming home',
      () => {
        const coming = ferryZ() > last && ferryZ() > -48.6;
        last = ferryZ();
        return coming;
      },
      () => NO_INPUT,
      700,
    );
    until('onto the ferry', onFerry, () => ({ move: toward(0, ferryZ()) }), 300);
    until(
      'carried by the ferry, to the other side',
      () => onFerry() && ferryZ() < -59.9,
      () => (Math.abs(at()[2]! - ferryZ()) > 0.4 ? { move: toward(0, ferryZ()) } : NO_INPUT),
      700,
    );
    go('to the second checkpoint', 0, -63.5);
    expect(notices.at(-1)).toBe('dojo.checkpoint');
    // The lift, up to its ledge and its star; and down again, walking off the ledge.
    const lift = machine([3, 0.35, -64]);
    const onLift = () => c().grounded && Math.abs(at()[0]! - 3) < 0.8 && Math.abs(at()[2]! + 64) < 0.8;
    until(
      'the lift, down',
      () => lift.transform!.position[1]! < 0.4,
      () => NO_INPUT,
      600,
    );
    until('onto the lift', onLift, () => ({ move: toward(3, -64) }), 300);
    until(
      'lifted, to the top',
      () => onLift() && at()[1]! > on(6) - 0.1,
      () => NO_INPUT,
      600,
    );
    go('onto the ledge, to its star', 6.5, -64);
    expect(notices.at(-1)).toMatch(/^dojo\.star/);
    until(
      'down from the ledge',
      () => standingAt(on(0.5)) && at()[0]! < 2,
      () => ({ move: [-1, 0, 0] }),
      400,
    );
    // The carousel, and off it to the wall's foot: the third checkpoint.
    go("to the pad's end", 0, -65.5);
    leap('onto the carousel', 0, -72, on(0.5), () => at()[2]! < -66.2);
    leap('off the carousel', 1.5, -79, on(0.5), () => at()[2]! < -73.4);
    expect(notices.at(-1)).toBe('dojo.checkpoint');

    // 4. The pillar, climbed straight up, for its star; down again; and the wall, to the plateau.
    go('to the pillar', 5, -82.6);
    until(
      'up the pillar, to its star',
      () => /^dojo\.star/.test(notices.at(-1) ?? ''),
      () => ({ move: [0, 0, -1] }),
      600,
    );
    until(
      'down from the pillar',
      () => standingAt(on(0.5)),
      () => ({ move: [0, 0, 1] }),
      400,
    );
    go('to the wall', 0, -82.6);
    until(
      'up the wall, to the fourth checkpoint',
      () => notices.at(-1) === 'dojo.checkpoint' && standingAt(on(6)),
      () => ({ move: [0, 0, -1] }),
      600,
    );

    // 5. Up: two jumps to the shelf.
    go("to the plateau's end", 0, -86.2);
    leap('two jumps up to the shelf', 0, -92.5, on(9.2), () => at()[2]! < -86.4, { twice: true });

    // 6. The far islet's star, gliding running; falling from it, back to the fourth checkpoint.
    go('back on the shelf', 0, -92);
    leap('a running glide to the islet', 6, -132, on(3), () => at()[2]! < -93.7, { run: true, glide: true });
    expect(notices.at(-1)).toMatch(/^dojo\.star 3 /);
    until(
      'falling back to the checkpoint',
      () => notices.at(-1) === 'dojo.fell',
      () => ({ move: [1, 0, 0] }),
      600,
    );
    until(
      'standing again',
      () => c().grounded,
      () => NO_INPUT,
      200,
    );
    // Up to the shelf again, and the glide to the goal.
    go("to the plateau's end, again", 0, -86.2);
    leap('two jumps up to the shelf, again', 0, -92.5, on(9.2), () => at()[2]! < -86.4, { twice: true });
    go('back on the shelf, again', 0, -92);
    leap('the glide to the goal', 0, -119.5, on(2), () => at()[2]! < -93.7, { glide: true });
    for (let i = 0; i < 10; i++) step(NO_INPUT);
    // The goal: its time, 1 fall, 3 stars taken and none left.
    expect(notices.at(-1)).toMatch(/^dojo\.goal [\d.]+ 1 3 0$/);
    expect(notices.filter((n) => n === 'dojo.checkpoint')).toHaveLength(4);
  });

  test('each part asks for exactly what it tests: with less, it is not enough', () => {
    const { session, c, at, step, go, attempt, put } = circuit();
    // 7 m walking falls short (running, it gets there: the first test).
    put(0, 1.4, -31);
    expect(
      attempt(0, -44.5, () => at()[2]! < -35.2),
      '7 m walking',
    ).toBeNull();
    // The ledge, with two jumps from the pad instead of the lift: it does not get onto it.
    put(0, 1.4, -64);
    go("to the pad's side", 1.6, -64);
    expect(
      attempt(6, -64, () => at()[0]! > 1.7, { twice: true }),
      'the ledge without the lift',
    ).not.toBeCloseTo(on(6), 1);
    // The wall without climbing: pushing at it for 3 s, it stays at its foot.
    session.registry.run('dojo.climb off', 'console');
    put(0, 1.4, -82);
    for (let i = 0; i < 180; i++) step({ move: [0, 0, -1] });
    expect(at()[1]!, 'the wall without climbing').toBeLessThan(on(0.5) + 0.2);
    session.registry.run('dojo.climb on', 'console');
    // The shelf with one jump: it falls.
    put(0, 7, -85.5);
    go("to the plateau's end", 0, -86.2);
    expect(
      attempt(0, -92.5, () => at()[2]! < -86.4),
      'the shelf with one jump',
    ).toBeNull();
    // The goal's island with a running jump, without gliding: it falls short.
    put(0, 10.2, -92);
    expect(
      attempt(0, -119.5, () => at()[2]! < -93.7, { run: true }),
      'the goal without gliding',
    ).toBeNull();
    // The islet, gliding but walking: it falls short.
    put(0, 10.2, -92);
    expect(
      attempt(6, -132, () => at()[2]! < -93.7, { glide: true }),
      'the islet gliding walking',
    ).toBeNull();
    expect(c().mode).not.toBe('climb');
  });
});
