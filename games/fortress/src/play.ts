import type { Vec3 } from '@manifold/common';
import { ATTACK, SMOKE_INPUT } from '@manifold/arms';
import { BotHost, NO_INPUT, registryFor, Session, type Entity, type PlayerInput } from '@manifold/core';
import { FORTRESS } from './game';
import { run, standing } from './rules';

/**
 * A LEVEL OF THE FORTRESS, PLAYED (stage 5f): its intruder driven as a person would, in a few moves, its
 * guards thinking every step (a host's bots, as on a page): walking or crouching to a place, waiting for
 * a guard to be somewhere or to look away, a hand on a lamp, a blow of the stick, smoke thrown. What it
 * took, by its run; and the inputs (the guards' too), for its reference replay.
 */
export function levelOf(index: number) {
  const registry = registryFor(FORTRESS.cartridge);
  const errors = registry.run(FORTRESS.levels[index]!.recipe, 'recipe').filter((m) => m.level === 'error');
  if (errors.length) throw new Error(errors.map((m) => m.text).join('; '));
  const session = new Session(FORTRESS.cartridge, { registry });
  const bots = new BotHost();
  const world = () => session.world;
  const me = (): Entity => [...world().entities.values()].find((e) => e.character?.player === 1 && !e.brain)!;
  const named = (name: string) => world().named(name)!;
  const at = () => me().transform!.position;
  const r = () => run(me())!;
  const done = () => FORTRESS.done(world(), me()) !== null;
  const step = (input: PlayerInput = NO_INPUT) => {
    bots.think(session);
    session.setInput(1, input);
    session.step();
  };
  /** Steps with `input` until `until` (or `most` steps); whether it came. */
  const go = (input: PlayerInput, until: () => boolean, most = 600) => {
    for (let i = 0; i < most; i++) {
      if (until() || done()) return true;
      step(input);
    }
    return until() || done();
  };
  /** Waiting, standing (or crouched) where it is, until `until`. */
  const wait = (until: () => boolean, most = 900, crouch = false) => go(crouch ? { crouch: true } : NO_INPUT, until, most);
  /** Walking (crouched, if so) to a place (x, z), aiming at it every step: whether it got within `near`. */
  const walkTo = (x: number, z: number, o: { crouch?: boolean; near?: number; most?: number } = {}) => {
    const near = o.near ?? 0.15;
    for (let i = 0; i < (o.most ?? 900) && !done(); i++) {
      const dx = x - at()[0]!;
      const dz = z - at()[2]!;
      const d = Math.hypot(dx, dz);
      if (d < near) return true;
      const k = Math.min(1, d / 0.3);
      step({ move: [(dx / d) * k, 0, (dz / d) * k], ...(o.crouch ? { crouch: true } : {}) });
    }
    return false;
  };
  /** Turning to face `toward` (a direction on the ground), standing where it is, for a few steps. */
  const face = (toward: Vec3, crouch = false) => {
    for (let i = 0; i < 20; i++) step({ face: toward, ...(crouch ? { crouch: true } : {}) });
  };
  /** A hand on what is within reach (a lamp: out, or lit again). */
  const use = (crouch = false) => {
    step({ use: true, ...(crouch ? { crouch: true } : {}) });
    step(crouch ? { crouch: true } : NO_INPUT);
  };
  /** A blow of its stick, where it faces (a press, and its strike's steps). */
  const strike = (crouch = false) => {
    step({ [ATTACK]: true, ...(crouch ? { crouch: true } : {}) });
    for (let i = 0; i < 14; i++) step(crouch ? { crouch: true } : NO_INPUT);
  };
  /** Smoke thrown where it faces, `pitch` up (−1, at its feet). */
  const smoke = (pitch = 0) => {
    step({ [SMOKE_INPUT]: true, pitch });
    step({ pitch });
  };
  /** The guards, in the order the level has them. */
  const guards = () => [...world().entities.values()].filter((e) => e.brain);
  const guardAt = (k: number) => guards()[k]!.transform!.position;
  const facingOf = (k: number) => guards()[k]!.character!.facing;
  const down = (k: number) => (guards()[k]!.health?.down ?? -1) >= 0;
  /** Whether a guard on its feet sees it now. */
  const seen = () => guards().some((g) => standing(g) && g.watcher?.sees.includes(me().id));
  return {
    session,
    bots,
    world,
    me,
    named,
    at,
    r,
    done,
    step,
    go,
    wait,
    walkTo,
    face,
    use,
    strike,
    smoke,
    guards,
    guardAt,
    facingOf,
    down,
    seen,
  };
}
