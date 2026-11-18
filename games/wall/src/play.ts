import { vec3, type Vec3 } from '@manifold/common';
import { ATTACK, EYE } from '@manifold/arms';
import { BotHost, NO_INPUT, registryFor, Session, withoutView, type Entity, type PlayerInput } from '@manifold/core';
import { WALL } from './game';
import { attackers, hold } from './rules';

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * A LEVEL OF THE WALL, PLAYED (stage 5h): its defender driven as a person would, its attackers thinking
 * every step (a host's bots, as on a page): aiming from its eyes (where a first-person camera is) at the
 * nearest attacker it can see, at its chest, and firing when its weapon is ready; stepping where it is
 * told. What it took, by its hold; and the inputs (the attackers' too), for its reference replay.
 */
export function levelOf(index: number) {
  const registry = registryFor(WALL.cartridge);
  // (The recipe's view lines are the page's: a headless session has no camera.)
  const errors = registry.run(withoutView(WALL.levels[index]!.recipe), 'recipe').filter((m) => m.level === 'error');
  if (errors.length) throw new Error(errors.map((m) => m.text).join('; '));
  const session = new Session(WALL.cartridge, { registry });
  const bots = new BotHost();
  const world = () => session.world;
  const me = (): Entity => [...world().entities.values()].find((e) => e.character?.player === 1 && !e.brain)!;
  const at = () => me().transform!.position;
  const h = () => hold(me())!;
  const done = () => WALL.done(world(), me()) !== null;
  const step = (input: PlayerInput = NO_INPUT) => {
    bots.think(session);
    session.setInput(1, input);
    session.step();
  };
  const eye = (): Vec3 => vec3.add(at(), [0, EYE, 0]);
  /** Whether nothing that does not move is between its eyes and a point. */
  const clear = (to: Vec3) => {
    const from = eye();
    const d = vec3.length(vec3.sub(to, from));
    const hit = world().castRay(from, vec3.scale(vec3.sub(to, from), 1 / d), d, {
      skip: me().id,
      characters: false,
      dynamic: false,
    });
    return !hit || hit.distance > d - 0.3;
  };
  /** The aim at a point from its eyes: where to face (flat), and the pitch (a quarter turn a unit). */
  const aimAt = (to: Vec3): PlayerInput => {
    const from = eye();
    const v = vec3.sub(to, from);
    const d = Math.hypot(v[0], v[2]);
    return { face: [v[0] / d, 0, v[2] / d], pitch: (Math.atan2(v[1], d) * 180) / Math.PI / 90 };
  };
  /** The nearest attacker in sight, its chest (a little above its center). */
  const target = () =>
    attackers(world())
      .map((e) => ({ e, chest: vec3.add(e.transform!.position, [0, 0.15, 0]) as Vec3 }))
      .filter((t) => clear(t.chest))
      .sort((a, b) => flat(a.chest, at()) - flat(b.chest, at()))[0];
  /** Fighting for `steps` (or until held): aiming at the nearest in sight and firing as often as it can, moving `move`. */
  const fight = (steps: number, move: Vec3 = [0, 0, 0]) => {
    let pressed = false;
    for (let i = 0; i < steps && !done(); i++) {
      const t = target();
      if (!t || (me().health?.down ?? -1) >= 0) {
        step({ move });
        pressed = false;
        continue;
      }
      pressed = !pressed;
      step({ ...aimAt(t.chest), move, ...(pressed ? { [ATTACK]: true } : {}) });
    }
    return done();
  };
  /** Walking to a place (x, z), aiming at it: whether it got within `near`. */
  const walkTo = (x: number, z: number, near = 0.2, most = 600) => {
    for (let i = 0; i < most && !done(); i++) {
      const dx = x - at()[0]!;
      const dz = z - at()[2]!;
      const d = Math.hypot(dx, dz);
      if (d < near) return true;
      const k = Math.min(1, d / 0.3);
      step({ move: [(dx / d) * k, 0, (dz / d) * k] });
    }
    return false;
  };
  return { session, bots, world, me, at, h, done, step, fight, walkTo, target };
}
