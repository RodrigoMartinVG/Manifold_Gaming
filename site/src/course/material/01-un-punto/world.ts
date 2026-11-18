/** A point of the world, in meters: x to the right, y up, z towards whoever looks at the screen. */
export interface Point {
  x: number;
  y: number;
  z: number;
}

/** A level, as data: where the turret stands, and where each target is. */
export interface Layout {
  turret: Point;
  targets: Point[];
}

/** A target on its post, with a name. */
export interface Target {
  id: string;
  position: Point;
}

/**
 * THE WORLD, AS PLAIN DATA: numbers and names, nothing of three.js. The drawing reads it (main.ts, view/);
 * the coming lessons' rules will change it. Data can be saved, compared, sent and checked; a mesh cannot.
 */
export interface World {
  floor: { width: number; depth: number };
  turret: { position: Point };
  targets: Target[];
}

/** A new world from a level: copies of its numbers, so playing never changes the level. */
export function createWorld(layout: Layout): World {
  return {
    floor: { width: 14, depth: 24 },
    turret: { position: { ...layout.turret } },
    targets: layout.targets.map((p, i) => ({ id: `target ${i + 1}`, position: { ...p } })),
  };
}
