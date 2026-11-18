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
 * the rules change it (turret.ts). Since lesson 1.7 the turret looks somewhere: which of the eight
 * headings it faces (an index into `HEADINGS`), the height of its eye, and its cone of fire, whose half
 * angle is kept as its cosine too, worked out once here.
 */
export interface World {
  floor: { width: number; depth: number };
  turret: { position: Point; heading: number; eye: number; cone: { degrees: number; cos: number } };
  targets: Target[];
}

/** A new world from a level: copies of its numbers, so playing never changes the level. */
export function createWorld(layout: Layout): World {
  const degrees = 30;
  return {
    floor: { width: 14, depth: 24 },
    turret: { position: { ...layout.turret }, heading: 0, eye: 0.5, cone: { degrees, cos: Math.cos((degrees * Math.PI) / 180) } },
    targets: layout.targets.map((p, i) => ({ id: `target ${i + 1}`, position: { ...p } })),
  };
}
