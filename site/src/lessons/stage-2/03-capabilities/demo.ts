/** What a player asks for at a step: where to go along the ground (x, z) and whether jump is held. */
export interface Input {
  x: number;
  z: number;
  jump: boolean;
}

/**
 * A SCRIPTED TRY at a star: where it starts, and what it asks for, as a list of
 * [steps, x, z, jump held]. The same inputs whatever the character can do: with the capability
 * the star is taken; without it, the same keys do not get there.
 */
interface Try {
  star: string;
  from: [number, number, number];
  script: [steps: number, x: number, z: number, jump: boolean][];
}

export const TRIES: Try[] = [
  // Walking to the tower, and pushing on against it.
  {
    star: 'wall',
    from: [-11, 0.9, 2.5],
    script: [
      [172, 0, -1, false],
      [40, 0, 0, false], // still, a moment
    ],
  },
  // Running to the edge, jumping there, and holding jump: it glides down to the island.
  {
    star: 'gap',
    from: [0, 0.9, -1],
    script: [
      [64, 0, -1, false],
      [330, 0, -1, true], // a jump at the edge, and jump held
      [40, 0, 0, false],
    ],
  },
  // Running at the ledge, jumping, and jumping again at the top of the first jump.
  {
    star: 'ledge',
    from: [11, 0.9, 8.5],
    script: [
      [40, 0, -1, false],
      [10, 0, -1, true], // a jump
      [28, 0, -1, false],
      [10, 0, -1, true], // another one, near the top of the first
      [42, 0, -1, false],
      [40, 0, 0, false],
    ],
  },
];

/** What a try asks for at its step `n`; null when it is over. */
export function inputAt(t: Try, n: number): Input | null {
  for (const [steps, x, z, jump] of t.script) {
    if (n < steps) return { x, z, jump };
    n -= steps;
  }
  return null;
}
