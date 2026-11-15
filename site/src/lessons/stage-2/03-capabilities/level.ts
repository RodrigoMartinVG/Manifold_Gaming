/**
 * THE LEVEL, as data: boxes that do not move (a center and half its sizes, in meters) and three
 * stars. Each star asks for ONE capability: without it, it cannot be reached, not even with the
 * other two (a double jump rises about 4.3 m; a jump that glides crosses some 20 m of void).
 */
type Vec = [number, number, number];

export const START: Vec = [0, 0.9, 6];

export const BLOCKS: { center: Vec; half: Vec }[] = [
  { center: [0, -0.5, 2], half: [14, 0.5, 8] }, // the ground: its edge, at z = -6, faces the void
  { center: [-11, 2.5, -1], half: [1.25, 2.5, 1.25] }, // a tower, 5 m: higher than a double jump
  { center: [11, 3.45, -1], half: [2, 0.15, 2] }, // a ledge in the air, 3.6 m up: higher than a jump
  { center: [0, -4.5, -27], half: [3, 0.5, 5] }, // an island, 4 m down and 16 m out in the void
];

export const STARS: { name: string; at: Vec }[] = [
  { name: 'wall', at: [-11, 5.8, -1] }, // on top of the tower: climbing
  { name: 'gap', at: [0, -3.2, -28] }, // on the island: gliding
  { name: 'ledge', at: [11, 4.4, -1] }, // on the ledge: a second jump
];
