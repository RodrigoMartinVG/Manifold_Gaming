import type { EntityId } from '../types';
import { holdingBox, type World } from '../world';
import { quat, vec3 } from '@manifold/common';

/**
 * ZONES SYSTEM (stage 2a): for each zone, which moving bodies have their center inside its box (in
 * the box's own axes: the point is turned back by the zone's rotation). Additions, multiplications
 * and comparisons: the same everywhere. Who came in and who left become events, in a fixed order.
 *
 * Most bodies are far from every zone (stage 2.5b): first, three comparisons against the box along
 * the world's axes that holds the zone (it never leaves out one that is inside: it holds it), and
 * only the bodies within it are turned into the zone's axes. In the stress room it took 0.15 ms a
 * step, a third of the physics; the same answer, for less.
 */
export function sense(world: World) {
  const movers = [...world.entities.values()].filter((e) => e.transform && e.body && e.body.type !== 'fixed');
  for (const zone of world.entities.values()) {
    const sensor = zone.sensor;
    const at = zone.transform;
    if (!sensor || !at) continue;
    const back = quat.conjugate(at.rotation);
    const reach = holdingBox(at.rotation, sensor.half);
    const c = at.position;
    const now: EntityId[] = [];
    for (const e of movers) {
      const p = e.transform!.position;
      if (Math.abs(p[0] - c[0]) > reach[0] || Math.abs(p[1] - c[1]) > reach[1] || Math.abs(p[2] - c[2]) > reach[2]) continue;
      const local = quat.rotate(back, vec3.sub(e.transform!.position, at.position));
      if (Math.abs(local[0]) <= sensor.half[0] && Math.abs(local[1]) <= sensor.half[1] && Math.abs(local[2]) <= sensor.half[2])
        now.push(e.id);
    }
    for (const id of sensor.inside)
      if (!now.includes(id) && world.entities.has(id)) world.emit({ type: 'sensorLeft', sensor: zone.id, entity: id });
    for (const id of now) if (!sensor.inside.includes(id)) world.emit({ type: 'sensorEntered', sensor: zone.id, entity: id });
    // Who was inside first stays first; who came now goes after.
    sensor.inside = [...sensor.inside.filter((id) => now.includes(id)), ...now.filter((id) => !sensor.inside.includes(id))];
  }
}
