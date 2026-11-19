import type { Vec3 } from '@manifold/common';
import {
  BotHost,
  NO_INPUT,
  registryFor,
  Session,
  withoutView,
  type Cartridge,
  type Entity,
  type PlayerInput,
} from '@manifold/core';

/**
 * A LEVEL, PLAYED WITHOUT A SCREEN (stage 5.5h, the audit's G2: each game copied this harness): a session of
 * `cartridge` born from `recipe` (its view lines left out), player 1's character driven as a person would,
 * in a few moves; `done` says when the level is over (the game's: its goal reached); with `think`, its bots
 * think before every step, as a page hosting the match has them (decision 0023). What a game's tests and its
 * reference recorders are made with; a game adds what only it does (a chimney, a lamp put out, a weapon).
 */
export function drive(
  cartridge: Cartridge,
  recipe: string,
  o: { done?: (session: Session, me: Entity) => boolean; think?: boolean } = {},
) {
  const registry = registryFor(cartridge);
  const errors = registry.run(withoutView(recipe), 'recipe').filter((m) => m.level === 'error');
  if (errors.length) throw new Error(errors.map((m) => m.text).join('; '));
  const session = new Session(cartridge, { registry });
  const bots = new BotHost();
  const world = () => session.world;
  /** Player 1's character (not a bot's). */
  const me = (): Entity => [...session.world.entities.values()].find((e) => e.character?.player === 1 && !e.brain)!;
  const named = (name: string) => session.world.named(name)!;
  const c = () => me().character!;
  const at = () => me().transform!.position;
  const over = () => o.done?.(session, me()) ?? false;
  /** One step, asking for `input` (its bots thinking first, if they do). */
  const step = (input: PlayerInput = NO_INPUT) => {
    if (o.think) bots.think(session);
    session.setInput(1, input);
    session.step();
  };
  /** Steps with `input` until `until` (or `most` steps, or the level's end); whether it came. */
  const go = (input: PlayerInput, until: () => boolean, most = 600) => {
    for (let i = 0; i < most; i++) {
      if (until() || over()) return true;
      step(input);
    }
    return until() || over();
  };
  /** Walking (crouched, if so) to a place (x, z) on what it stands on, aiming at it every step: whether it got within `near`. */
  const walkTo = (x: number, z: number, near = 0.12, most = 400, crouch = false) => {
    for (let i = 0; i < most && !over(); i++) {
      const dx = x - at()[0]!;
      const dz = z - at()[2]!;
      const d = Math.hypot(dx, dz);
      if (d < near) return true;
      // (Slower the last few centimeters: on at full speed, it would go past.)
      const k = Math.min(1, d / 0.3);
      step({ move: [(dx / d) * k, 0, (dz / d) * k], ...(crouch ? { crouch: true } : {}) });
    }
    return false;
  };
  /** A jump held for `steps`, moving `move`. */
  const jump = (move: Vec3, steps = 30) => {
    for (let i = 0; i < steps && !over(); i++) step({ move, jump: true });
  };
  return { session, bots, world, me, named, c, at, done: over, step, go, walkTo, jump };
}
