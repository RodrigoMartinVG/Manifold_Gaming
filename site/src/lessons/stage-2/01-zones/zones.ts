import * as THREE from 'three';

/**
 * A ZONE (a sensor): a box that pushes nothing, it only NOTICES who comes in. It has a center, a
 * rotation, and half its size along each of ITS OWN axes. What it means (a checkpoint, the void, a
 * goal) is not here: that is the game's, which reads the events.
 */
export interface Zone {
  name: string;
  center: THREE.Vector3;
  rotation: THREE.Quaternion;
  half: THREE.Vector3;
  /** Who has its center inside (by number), as of the last step. */
  inside: number[];
}

/** What happened at a step: a body's center came into a zone, or left it. */
export interface ZoneEvent {
  type: 'entered' | 'left';
  zone: string;
  body: number;
}

/** A body, as the zones see it: its number and where its CENTER is. Its shape does not matter. */
export interface Body {
  id: number;
  position: THREE.Vector3;
}

/** The zone's own axes, seen from the world: x, y and z, turned by its rotation. */
export function axesOf(zone: Zone): THREE.Vector3[] {
  return [
    new THREE.Vector3(1, 0, 0).applyQuaternion(zone.rotation),
    new THREE.Vector3(0, 1, 0).applyQuaternion(zone.rotation),
    new THREE.Vector3(0, 0, 1).applyQuaternion(zone.rotation),
  ];
}

/**
 * Is this point inside the zone? It is taken into the zone's own space: first relative to its
 * center, then measured along each of its axes (a dot product per axis: the same as turning it back
 * with the inverse rotation). There the box is not turned any more, and it is three comparisons.
 */
export function contains(zone: Zone, axes: THREE.Vector3[], point: THREE.Vector3): boolean {
  const d = point.clone().sub(zone.center);
  return (
    Math.abs(d.dot(axes[0]!)) <= zone.half.x &&
    Math.abs(d.dot(axes[1]!)) <= zone.half.y &&
    Math.abs(d.dot(axes[2]!)) <= zone.half.z
  );
}

/**
 * Half the size, along the WORLD's axes, of the box that holds the turned zone: each of the zone's
 * axes, as long as its half size, adds its length along each axis of the world. Every point of the
 * zone is inside it: so it can say "far" without ever leaving out a body that is inside.
 */
export function holdingBox(zone: Zone, axes: THREE.Vector3[]): THREE.Vector3 {
  const reach = new THREE.Vector3();
  axes.forEach((axis, j) => {
    const h = zone.half.getComponent(j);
    reach.x += Math.abs(axis.x) * h;
    reach.y += Math.abs(axis.y) * h;
    reach.z += Math.abs(axis.z) * h;
  });
  return reach;
}

/**
 * ONE STEP OF THE ZONES, right after the physics: for each zone, who has its center inside NOW; and,
 * against who had it BEFORE, what happened. Entered: now and not before. Left: before and not now.
 * Always in the same order: the zones in the order of their list, and in each one first who left,
 * then who entered, by number (`bodies` comes by number). `tests` counts the work.
 */
export function sense(zones: Zone[], bodies: Body[], tests = { cheap: 0, exact: 0 }): ZoneEvent[] {
  const events: ZoneEvent[] = [];
  for (const zone of zones) {
    const axes = axesOf(zone);
    const reach = holdingBox(zone, axes);
    const now: number[] = [];
    for (const body of bodies) {
      // 1. The cheap test: three comparisons against the box that holds the zone. Most stop here.
      tests.cheap++;
      const d = body.position.clone().sub(zone.center);
      if (Math.abs(d.x) > reach.x || Math.abs(d.y) > reach.y || Math.abs(d.z) > reach.z) continue;
      // 2. The exact test, in the zone's own space.
      tests.exact++;
      if (contains(zone, axes, body.position)) now.push(body.id);
    }
    for (const id of zone.inside)
      if (!now.includes(id)) events.push({ type: 'left', zone: zone.name, body: id });
    for (const id of now)
      if (!zone.inside.includes(id)) events.push({ type: 'entered', zone: zone.name, body: id });
    zone.inside = now;
  }
  return events;
}
