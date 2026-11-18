import type { Layout } from './world';

/**
 * THE LEVELS, as data. The first one: the turret in the middle, and three targets on posts, half a meter
 * high: one ahead and to the right, one behind and to the left, one far ahead and to the left. (The type
 * says there is always at least one level.)
 */
export const LAYOUTS: readonly [Layout, ...Layout[]] = [
  {
    turret: { x: 0, y: 0, z: 0 },
    targets: [
      { x: 2, y: 0.5, z: -3 },
      { x: -1, y: 0.5, z: 2 },
      { x: -1, y: 0.5, z: -4 },
    ],
  },
];
