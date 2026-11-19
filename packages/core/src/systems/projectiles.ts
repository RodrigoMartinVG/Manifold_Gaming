import { gravityAt } from '../gravity';
import { castHit } from '../hits';
import { STEP, type World } from '../world';
import { vec3 } from '@manifold/common';

/**
 * READING BACK every moving body's pose and velocities. And, for what the physics moves, a hit, heard
 * (stage 3f): how much its velocity changed in the step beyond what gravity gave it is what something
 * did to it; half its mass times that change squared, the energy of the hit. From what the world
 * already has (the velocity before, the one after): the same in every copy, and after a snapshot.
 */
/**
 * PROJECTILES SYSTEM (stage 4c): each one moves a segment of ray, its velocity for a step (bent by
 * the gravity if it says so), swept with its radius against the characters as they are now and the
 * world (`castHit`, its shooter left out): so a fast one crosses nothing between two steps. What it
 * strikes first, if it has health, it hurts (a character's part by name), and it is gone (`impact`).
 * Out of steps, it is gone too.
 */
export function fly(world: World) {
  for (const e of [...world.entities.values()]) {
    const p = e.projectile;
    if (!p || !e.transform) continue;
    const at = e.transform.position;
    if (p.gravity) p.velocity = vec3.add(p.velocity, vec3.scale(gravityAt(world.gravity, at), STEP));
    const move = vec3.scale(p.velocity, STEP);
    const length = vec3.length(move);
    if (length > 0) {
      const hit = castHit(world, at, vec3.scale(move, 1 / length), length, {
        ...(p.from === null ? {} : { skip: p.from }),
        radius: p.radius,
      });
      if (hit) {
        if (world.entities.get(hit.entity)?.health)
          world.hurt(hit.entity, p.damage, { from: p.from, part: hit.kind === 'character' ? hit.part : null, kind: p.kind });
        world.emit({
          type: 'impact',
          projectile: e.id,
          at: hit.point,
          hit: hit.entity,
          kind: p.kind,
          // (Stage 5g) Which way it went, and who fired it: what a game does where it struck (a rocket blows).
          velocity: [...p.velocity],
          from: p.from,
        });
        world.removeEntity(e.id);
        continue;
      }
      e.transform.position = vec3.add(at, move);
    }
    if (--p.life <= 0) world.removeEntity(e.id);
  }
}
