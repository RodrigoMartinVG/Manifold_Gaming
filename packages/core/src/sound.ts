/**
 * WHAT IS HEARD (stage 3f): the simulation's events make sounds, and each sound is an event too, with
 * where it is, what it is (a step, a landing, a hit, a door, a lift, a break), what surface it is on,
 * how fast or how hard, and how far it is heard: a hearing radius in the simulation, for the bots of
 * phase 4 (a guard hears what is within it). The presentation synthesizes it from those numbers,
 * without recorded files (decision 0015). Nothing of it is kept: an event is what happened in a step.
 *
 * The radii, in meters, for a step at walking speed: metal rings, wood knocks, stone thuds, ice is
 * soft. A run is louder (as much as its speed over walking's, up to twice); a landing, by how fast it
 * came down; a hit, by its energy.
 */
export const STEP_HEARD: Readonly<Record<string, number>> = Object.freeze({
  stone: 6,
  wood: 7,
  metal: 10,
  glass: 8,
  ice: 4,
});

/** How far a step on a surface is heard (a surface the table does not have, as stone). */
export function stepRadius(surface: string | null, speed: number, walking: number): number {
  const base = STEP_HEARD[surface ?? 'stone'] ?? STEP_HEARD.stone!;
  return base * Math.max(0.5, Math.min(2, speed / walking));
}

/** How far a hit of this energy (J) is heard: 2 m, and 8 more for every square root of a joule, 25 at most. */
export const hitRadius = (energy: number): number => Math.min(25, 2 + 8 * Math.sqrt(energy));

/** The least a hit carries to be heard (J): below it, a body settling, or sliding, is quiet. */
export const HIT_HEARD = 0.02;

/** How far one stride is: a step is heard every this many meters walked on the ground. */
export const STRIDE = 0.8;
