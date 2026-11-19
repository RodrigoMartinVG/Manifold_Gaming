import type { Vec3 } from '@manifold/common';
import { ATTACK, PEBBLE_INPUT, SMOKE_INPUT } from '@manifold/arms';
import { NO_INPUT } from '@manifold/core';
import { drive } from '@manifold/shell/drive';
import { FORTRESS_CARTRIDGE, FORTRESS_LEVEL_LIST, fortressDone } from './cartridge';
import { run, standing } from './rules';

/**
 * A LEVEL OF THE FORTRESS, PLAYED (stage 5f): its intruder driven as a person would, in a few moves, its
 * guards thinking every step (a host's bots, as on a page): walking or crouching to a place, waiting for
 * a guard to be somewhere or to look away, a hand on a lamp, a blow of the stick, smoke thrown. What it
 * took, by its run; and the inputs (the guards' too), for its reference replay.
 */
export function levelOf(index: number) {
  // (The games' driver, stage 5.5h: drive.ts, its guards thinking every step; what is the fortress's alone, below.)
  const d = drive(FORTRESS_CARTRIDGE, FORTRESS_LEVEL_LIST[index]!.recipe, {
    done: (s, me) => fortressDone(s.world, me) !== null,
    think: true,
  });
  const { session, bots, world, me, named, at, done, step, go } = d;
  const r = () => run(me())!;
  /** Waiting, standing (or crouched) where it is, until `until`. */
  const wait = (until: () => boolean, most = 900, crouch = false) => go(crouch ? { crouch: true } : NO_INPUT, until, most);
  /** Walking (crouched, if so) to a place (x, z), aiming at it every step: whether it got within `near`. */
  const walkTo = (x: number, z: number, o: { crouch?: boolean; near?: number; most?: number } = {}) =>
    d.walkTo(x, z, o.near ?? 0.15, o.most ?? 900, o.crouch ?? false);
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
  /** (Stage 5l) A pebble thrown where it faces, `pitch` up. */
  const pebble = (pitch = 0) => {
    step({ [PEBBLE_INPUT]: true, pitch });
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
    pebble,
    guards,
    guardAt,
    facingOf,
    down,
    seen,
  };
}
