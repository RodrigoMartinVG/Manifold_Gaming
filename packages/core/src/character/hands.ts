import { quat, vec3, type Vec3 } from '@manifold/common';
import { gravityAt } from '../gravity';
import { pressed } from '../input';
import type { Character, Entity } from '../types';
import type { World } from '../world';

/**
 * HOLDING (stage 3g): how far it reaches to grab (m, from its chest along where it looks), where it holds
 * (in front of it and a little up), how far the held thing may get before it lets go, how hard it can
 * pull (N: a wooden crate of 45 kg comes along; a stone block of a tonne does not leave the ground), and
 * how quickly it brings it to where it holds it (s). It lets go at 2 m: turning to walk, where it holds
 * swings round at once (a crate on the floor in front, a quarter turn: 1.5 m away).
 */
export const HOLD = Object.freeze({ reach: 1.2, distance: 0.95, lift: 0.2, letGo: 2, force: 1200, settle: 0.12 });

/**
 * GRABBING AND HOLDING (stage 3g): `grab`, pressed, takes what the physics moves in front of it (a
 * short sphere swept from its chest along where it looks), or lets go of what it holds. Held, it stays
 * the physics': on every step it is pushed (`World.push`) with the change of velocity that would take it
 * where it is held in `HOLD.settle` seconds, moving as the character moves, gravity's own step taken
 * back; never more than `HOLD.force` can do in a step for its mass, so a heavy thing hangs back. Too far
 * (it fell, it caught on something, it was too heavy to lift), it lets go.
 */
/** How far what is held reaches from its center, at most (a box's half diagonal across, a ball's radius). */
function heldRadius(held: Entity): number {
  const shape = held.body!.shape;
  if (shape.kind === 'ball') return shape.radius;
  if (shape.kind === 'box') return Math.max(...shape.halfExtents);
  return 0.2;
}

export function hold(world: World, e: Entity, c: Character, up: Vec3, dt: number) {
  let held = c.holding ? world.entities.get(c.holding) : undefined;
  if (c.holding && held?.body?.type !== 'dynamic') {
    c.holding = 0;
    held = undefined;
  }
  const position = e.transform!.position;
  const ahead = vec3.normalize(vec3.onPlane(c.facing, up));
  if (pressed(world, c.player, 'grab')) {
    if (held) {
      c.holding = 0;
      return;
    }
    // Low (a crate on the floor) and high (one on a shelf): the nearest the physics moves.
    let found: Entity | undefined;
    let nearest = Infinity;
    for (const height of [-0.35, 0.25]) {
      const from = vec3.add(position, vec3.scale(up, height));
      const hit = world.castShape({ kind: 'ball', radius: 0.3 }, from, quat.identity(), ahead, HOLD.reach, { skip: e.id });
      const thing = hit ? world.entities.get(hit.entity) : undefined;
      if (hit && thing?.body?.type === 'dynamic' && hit.distance < nearest) {
        nearest = hit.distance;
        found = thing;
      }
    }
    if (found) c.holding = found.id;
    return;
  }
  if (!held?.transform || !held.body) return;
  let target = vec3.add(position, vec3.add(vec3.scale(ahead, HOLD.distance), vec3.scale(up, HOLD.lift)));
  // It moves as the character moves; but not on into what stops it (walking into a wall with it).
  let moving = c.velocity;
  // Not into what is in the way (stage 4.5's close): held at a wall, it was pushed into it on every
  // step, the wall pushing back, and what the push could do went into the wall, not into holding it up:
  // it shook, turned and sank. Where it is held comes as near as what is in the way lets a ball of its
  // size come, from the character's center.
  const reach = vec3.sub(target, position);
  const far = vec3.length(reach);
  if (far > 1e-9) {
    const along = vec3.scale(reach, 1 / far);
    const size = heldRadius(held);
    const wall = world.castShape({ kind: 'ball', radius: size }, position, quat.identity(), along, far, {
      skip: e.id,
      besides: held.id,
      characters: false,
      dynamic: false,
    });
    if (wall) {
      target = vec3.add(position, vec3.scale(along, wall.distance));
      moving = vec3.sub(moving, vec3.scale(along, Math.max(0, vec3.dot(moving, along))));
    }
  }
  const to = vec3.sub(target, held.transform.position);
  if (vec3.length(to) > HOLD.letGo) {
    c.holding = 0;
    return;
  }
  const g = gravityAt(world.gravity, held.transform.position);
  const want = vec3.add(vec3.scale(to, 1 / HOLD.settle), moving);
  let change = vec3.sub(vec3.sub(want, held.body.linearVelocity), vec3.scale(g, dt));
  const most = (HOLD.force * dt) / Math.max(1e-9, world.physics.massOf(held.body.handle));
  const length = vec3.length(change);
  if (length > most) change = vec3.scale(change, most / length);
  world.push(held, change);
}

/**
 * PUSHING (stage 3g): what the physics moves that the character walks into, it pushes along the ground,
 * towards where it is going, as fast as it walks there at most, with a force of `PUSH` newtons at most:
 * the thing's friction on the floor (its mass times g times the friction) has to be less for it to
 * move. The friction is Rapier's: the average of the two surfaces'. A wooden crate of 45 kg on stone
 * (0.5 and 0.6: 0.55, 242 N) slides along; a stone block of 1.2 tonnes (0.6: 7,200 N) does not.
 * (Rapier's own rule pushes with an impulse by the character's mass on every step, which adds up: with
 * a person's 70 kg, the block went along almost as far as the crate, 3.8 m against 4.5 in two seconds.
 * With the mass Rapier gives the engine's capsule, its volume at density 1, 0.4 kg, it moves neither:
 * the crate 0.5 m, the block nothing. Measured with Rapier alone again, after the tutorial's pass.)
 */
export const PUSH = 900;

export function push(world: World, e: Entity, touched: readonly number[], wanted: Vec3, up: Vec3, dt: number) {
  if (touched.length === 0) return;
  const speed = vec3.length(wanted);
  if (speed < 1e-6) return;
  const along = vec3.scale(wanted, 1 / speed);
  for (const handle of touched) {
    const thing = world.entityOfHandle(handle);
    if (!thing?.body || !thing.transform || thing.id === e.character?.holding) continue;
    // Only what is ahead of it, where it is going.
    const toward = vec3.onPlane(vec3.sub(thing.transform.position, e.transform!.position), up);
    if (vec3.dot(toward, along) <= 0) continue;
    const gap = speed - vec3.dot(thing.body.linearVelocity, along);
    if (gap <= 0) continue;
    const mass = world.physics.massOf(handle);
    world.push(thing, vec3.scale(along, Math.min(gap, (PUSH * dt) / Math.max(1e-9, mass))));
  }
}
