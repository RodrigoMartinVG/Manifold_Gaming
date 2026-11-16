import { beforeAll, describe, expect, test } from 'vitest';
import type { Vec3 } from '@manifold/common';
import { initPhysics, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { ROOMS } from './rooms';

beforeAll(initPhysics);

/**
 * THE KEEP, PLAYED (closing phase 3): the phase's demonstration from its start to its goal, with no
 * teleport, by a driver that does what a player does (as the circuit's: it steers towards a point every
 * step): the button, the door, the lift, the dark hall, the plate the eye sees, a ball at the lamp, the
 * plate again, the last door, the goal. If a part is no longer possible, it says which.
 */
function keep() {
  const registry = registryFor(DojoCartridge);
  expect(registry.run(ROOMS.keep!.text, 'recipe').filter((m) => m.level === 'error')).toEqual([]);
  const session = new Session(DojoCartridge, { registry });
  const notices: string[] = [];
  const me = (): Entity => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  const at = () => me().transform!.position;
  const c = () => me().character!;
  const signal = (name: string) => session.world.signal(name);
  const step = (input: PlayerInput) => {
    session.setInput(1, input);
    session.step();
    for (const ev of session.world.stepEvents) if (ev.type === 'notice') notices.push(ev.say);
  };
  const toward = (x: number, z: number): Vec3 => {
    const [px, , pz] = at();
    const d = Math.hypot(x - px!, z - pz!);
    return d < 0.05 ? [0, 0, 0] : [(x - px!) / d, 0, (z - pz!) / d];
  };
  const until = (part: string, done: () => boolean, input: () => PlayerInput, max = 1200) => {
    for (let i = 0; i < max; i++) {
      if (done()) return;
      step(input());
    }
    throw new Error(`${part}: not done in ${max} steps; at ${at().map((n) => n.toFixed(2))}, ${c().mode}`);
  };
  const go = (part: string, x: number, z: number) =>
    until(
      part,
      () => c().grounded && Math.hypot(at()[0]! - x, at()[2]! - z) < 0.25,
      () => ({ move: toward(x, z) }),
    );
  /** Stands still, looking along `facing` (a step of walking that way, then still). */
  const face = (dx: number, dz: number) => {
    step({ move: [dx * 0.3, 0, dz * 0.3] });
    until(
      'standing',
      () => c().grounded && Math.hypot(c().velocity[0]!, c().velocity[2]!) < 0.05,
      () => NO_INPUT,
      120,
    );
  };
  return { session, notices, at, c, signal, step, until, go, face };
}

describe('the keep (closing phase 3)', () => {
  test('it can be played from the start to the goal: the door, the lift, the eye, the lamp broken, the last door', () => {
    const k = keep();
    const { at, c, signal, step, until, go, face, notices } = k;
    // The button: in front of it, `use`; the door opens.
    go('to the button', 1.6, 0.9);
    step({ use: true });
    step(NO_INPUT);
    expect(signal('gate')).toBe(1);
    // (It turns open in a second.)
    for (let i = 0; i < 70; i++) step(NO_INPUT);
    // Through the doorway, onto the lift: it goes up to the ledge.
    go('through the door', 0, -1.2);
    go('onto the lift', 0, -4);
    until(
      'the ride up',
      () => c().grounded && at()[1]! > 5,
      () => NO_INPUT,
      400,
    );
    expect(signal('lift_up')).toBe(1);
    // Up, into the hall: to the plate, in the lamp's light: the eye sees, and the door stays shut.
    go('onto the ledge', 0, -7);
    go('to the plate, in the light', 0, -16.5);
    for (let i = 0; i < 10; i++) step(NO_INPUT);
    expect(signal('seen_me')).toBe(1);
    expect(signal('opened')).toBe(0);
    expect(notices).toContain('dojo.seen');
    // Back to throw a ball at the lamp, facing it from 2.5 m (at chest height): it breaks, its light goes.
    go('in front of the lamp', 2, -12.5);
    face(0, -1);
    step({ 'dojo.throw': true });
    until(
      'the lamp breaking',
      () => k.session.world.named('lamp')!.breakable!.broken,
      () => NO_INPUT,
      120,
    );
    // The plate again, in the dark: the eye does not see, and the door opens, and stays open.
    go('to the plate, in the dark', 0, -16.5);
    for (let i = 0; i < 10; i++) step(NO_INPUT);
    expect(signal('seen_me')).toBe(0);
    expect(signal('opened')).toBe(1);
    for (let i = 0; i < 70; i++) step(NO_INPUT);
    // Through the last door, to the goal.
    go('through the last door', 0, -20);
    go('to the goal', 0, -22);
    for (let i = 0; i < 5; i++) step(NO_INPUT);
    expect(notices.at(-1)).toBe('dojo.goal');
    expect(signal('opened')).toBe(1);
    k.session.world.dispose();
  });

  test('without breaking the lamp, the last door does not open: the eye sees whoever is on the plate', () => {
    const k = keep();
    const { at, c, signal, step, until, go } = k;
    go('to the button', 1.6, 0.9);
    step({ use: true });
    for (let i = 0; i < 80; i++) step(NO_INPUT);
    go('through the door', 0, -1.2);
    go('onto the lift', 0, -4);
    until(
      'the ride up',
      () => c().grounded && at()[1]! > 5,
      () => NO_INPUT,
      400,
    );
    go('onto the ledge', 0, -7);
    go('to the plate, in the light', 0, -16.5);
    for (let i = 0; i < 120; i++) step(NO_INPUT);
    expect(signal('opened')).toBe(0);
    expect(k.session.world.named('last_door')!.transform!.position[2]).toBeCloseTo(-19, 2);
    k.session.world.dispose();
  });
});
