import { vec3, type Vec3 } from '@manifold/common';
import { ATTACK, EYE } from '@manifold/arms';
import type { Entity, PlayerInput } from '@manifold/core';
import { drive } from '@manifold/shell/drive';
import { WALL_CARTRIDGE, WALL_LEVEL_LIST, wallDone } from './cartridge';
import { attackers, hold } from './rules';

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/**
 * A LEVEL OF THE WALL, PLAYED (stage 5h): its defender driven as a person would, its attackers thinking
 * every step (a host's bots, as on a page): aiming from its eyes (where a first-person camera is) at the
 * nearest attacker it can see, at its chest, and firing when its weapon is ready; stepping where it is
 * told. What it took, by its hold; and the inputs (the attackers' too), for its reference replay.
 */
export function levelOf(index: number) {
  // (The games' driver, stage 5.5h: drive.ts, its attackers thinking every step; what is the wall's alone, below.)
  const d = drive(WALL_CARTRIDGE, WALL_LEVEL_LIST[index]!.recipe, {
    done: (s, me) => wallDone(s.world, me) !== null,
    think: true,
  });
  const { session, bots, world, me, at, done, step } = d;
  const h = () => hold(me())!;
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
  /**
   * The nearest attacker in sight, its chest (a little above its center); (stage 5o: levels of floors above
   * floors) or its head, if only that shows (over a railing, a balcony's edge).
   */
  const target = () =>
    attackers(world())
      .map((e) => {
        const chest = vec3.add(e.transform!.position, [0, 0.15, 0]) as Vec3;
        const head = vec3.add(e.transform!.position, [0, 0.6, 0]) as Vec3;
        return { e, chest: clear(chest) ? chest : clear(head) ? head : null };
      })
      .filter((t): t is { e: Entity; chest: Vec3 } => t.chest !== null)
      .sort((a, b) => flat(a.chest, at()) - flat(b.chest, at()))[0];
  /** Fighting for `steps` (or until held): aiming at the nearest in sight and firing as often as it can, moving `move`. */
  // (Pressed one step, let go the next: a shot is a press. Kept from one call to the next, so fighting a
  // step at a time still fires every other step.)
  let pressed = false;
  const fight = (steps: number, move: Vec3 = [0, 0, 0]) => {
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
  const walkTo = (x: number, z: number, near = 0.2, most = 600) => d.walkTo(x, z, near, most);
  /**
   * (Stage 5n) Fighting where it stands until no attacker has been in sight for `calm` steps (or `most`
   * steps went by): a room cleared.
   */
  const clear_ = (calm = 60, most = 1800) => {
    let quiet = 0;
    for (let i = 0; i < most && quiet < calm && !done(); i++) {
      if (target()) quiet = 0;
      else quiet++;
      fight(1);
    }
    return quiet >= calm;
  };
  /** (Stage 5n) Walking to a place, fighting whoever comes in sight on the way (it stops to fight). */
  const pushTo = (x: number, z: number, near = 0.3, most = 1800) => {
    for (let i = 0; i < most && !done(); i++) {
      if (target()) {
        fight(1);
        continue;
      }
      const dx = x - at()[0]!;
      const dz = z - at()[2]!;
      const d = Math.hypot(dx, dz);
      if (d < near) return true;
      const k = Math.min(1, d / 0.3);
      step({ move: [(dx / d) * k, 0, (dz / d) * k] });
    }
    return false;
  };
  /** (Stage 5o) Waiting, still, until `ready` (or `most` steps went by): a ferry that comes, a lift that rises. */
  const waitFor = (ready: () => boolean, most = 600) => {
    for (let i = 0; i < most && !ready() && !done(); i++) step();
    return ready();
  };
  /** (Stage 5o) Where something the level names is now (a ferry, a lift). */
  const where = (name: string): Vec3 => [...world().named(name)!.transform!.position] as Vec3;
  /** (Stage 5o) A jump toward a place (x, z), up onto what is there: pressed a moment, walking on to it. */
  const hop = (x: number, z: number) => {
    for (let k = 0; k < 12; k++) {
      const dx = x - at()[0]!;
      const dz = z - at()[2]!;
      const d = Math.hypot(dx, dz) || 1;
      step({ move: [dx / d, 0, dz / d], jump: k < 6 });
    }
    return walkTo(x, z);
  };
  /** (Stage 5n) A weapon of its arsenal in its hands, by its slot (1 to 9). */
  const take = (slot: number) => {
    step({ [`arms.slot${slot}`]: true });
    for (let i = 0; i < 20; i++) step();
  };
  /** (Stage 5n) A hand where it stands (a hidden button). */
  const use = () => {
    step({ use: true });
    step();
  };
  return {
    session,
    bots,
    world,
    me,
    at,
    h,
    done,
    step,
    fight,
    walkTo,
    target,
    clear: clear_,
    pushTo,
    take,
    use,
    waitFor,
    where,
    hop,
  };
}
