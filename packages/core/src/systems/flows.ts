import { vec3, type Vec3 } from '@manifold/common';
import { STEP, type World } from '../world';

/**
 * ZONES THAT CARRY WHAT IS IN THEM (stage 3b, the Dojo's currents; the core's since stage 5.5h, the audit's G5:
 * the forest's water and wind are the same mechanism). A game says which kind of zone carries (`kind`), and
 * the zone its `flow` (m/s). A character in one is carried along it, on every step it is there: one more
 * contribution to its movement (its `carry`): walking against it, it advances less; across it, it drifts.
 * With `grounded`, only standing in it, as water at the ankles holds through the feet (over it, jumping, it
 * does not push); without, in the air too, as a wind. What the physics moves, it pushes along the ground by
 * its material's drag: the part of the difference it closes in a step (stone's, without one), so a ball rolls
 * away with it and a stone cube on the bottom stays, its friction holding it. Called by the game in its step,
 * where it wants it (its hash depends on when).
 */
export function carryAlong(world: World, kind: string, o: { grounded?: boolean } = {}) {
  const grounded = o.grounded ?? true;
  for (const zone of world.entities.values()) {
    if (zone.sensor?.kind !== kind) continue;
    const flow = zone.sensor.params.flow as Vec3;
    for (const id of zone.sensor.inside) {
      const e = world.entities.get(id);
      const c = e?.character;
      if (c && (c.grounded || !grounded)) c.carry = vec3.add(c.carry, flow);
      if (e?.body?.type === 'dynamic') {
        const drag = world.materials[e.body.material ?? 'stone']?.drag ?? 0.5;
        const v = e.body.linearVelocity;
        const along: Vec3 = [flow[0] - v[0], 0, flow[2] - v[2]];
        world.push(e, vec3.scale(along, Math.min(1, drag * STEP)));
      }
    }
  }
}
