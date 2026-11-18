import type { Vec3 } from '@manifold/common';
import { NO_INPUT, registryFor, Session, withoutView, type Entity, type PlayerInput } from '@manifold/core';
import { TOWER } from './game';
import { runner } from './rules';

const STAND = 0.82;
/**
 * A FLOOR OF THE TOWER, PLAYED (stage 5d): its climber driven as a person would, in a few moves: walking
 * until somewhere, a jump held (let go at once, the platformer's is a short hop), up a chimney leaping
 * from wall to wall (the jump held, let go for a step on a wall and pressed again towards it), waiting
 * for what moves. What it took, by its runner; and the inputs, for its reference replay.
 */
export function floorOf(index: number) {
  const registry = registryFor(TOWER.cartridge);
  const errors = registry.run(withoutView(TOWER.levels[index]!.recipe), 'recipe').filter((m) => m.level === 'error');
  if (errors.length) throw new Error(errors.map((m) => m.text).join('; '));
  const session = new Session(TOWER.cartridge, { registry });
  const me = (): Entity => [...session.world.entities.values()].find((e) => e.character?.player === 1)!;
  const named = (name: string) => session.world.named(name)!;
  const c = () => me().character!;
  const at = () => me().transform!.position;
  const feet = () => at()[1]! - STAND;
  const done = () => TOWER.done(session.world, me()) !== null;
  const step = (input: PlayerInput = NO_INPUT) => {
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
  /** Walking to a place (x, z) on what it stands on, aiming at it every step: whether it got within `near`. */
  const walkTo = (x: number, z: number, near = 0.12, most = 400) => {
    for (let i = 0; i < most && !done(); i++) {
      const dx = x - at()[0]!;
      const dz = z - at()[2]!;
      const d = Math.hypot(dx, dz);
      if (d < near) return true;
      // (Slower the last few centimeters: on at full speed, it would go past.)
      const k = Math.min(1, d / 0.3);
      step({ move: [(dx / d) * k, 0, (dz / d) * k] });
    }
    return false;
  };
  /** A jump held for `steps`, moving `move`. */
  const jump = (move: Vec3, steps = 30) => {
    for (let i = 0; i < steps && !done(); i++) step({ move, jump: true });
  };
  /** Up a chimney (its walls facing ±x), until its feet are at `top`; then on, `out`, onto what is there. */
  const chimney = (top: number, out: Vec3, most = 900) => {
    let way = 1;
    let held = true;
    let wait = 0;
    step({ move: [way, 0, 0], jump: true });
    for (let i = 0; i < most && feet() < top && !done(); i++) {
      let pressing: boolean = held;
      let pressed = false;
      if (c().mode === 'slide' && wait === 0) {
        if (held) held = pressing = false;
        else {
          held = pressing = pressed = true;
          way = -way;
          wait = 10;
        }
      }
      wait = Math.max(0, wait - 1);
      step({ move: [pressed ? -way : way, 0, 0], jump: pressing });
    }
    // Over the top: on, pushing (a ledge it grabs, it climbs).
    go({ move: out, jump: true }, () => c().grounded && feet() > top - 0.5, 240);
  };
  const stars = () => runner(me())!.stars;
  return { session, me, named, c, at, feet, done, step, go, walkTo, jump, chimney, stars };
}
