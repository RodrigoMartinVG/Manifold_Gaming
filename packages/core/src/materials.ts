/**
 * WHAT THINGS ARE MADE OF (stage 3b). A material is a name and four numbers, as data:
 * - `friction`: how much its surface holds what slides on it (Rapier's coefficient: 0, none; 1, a lot).
 *   Whatever the physics moves feels it, and a character's feet too (`tractionOf`);
 * - `bounce`: how much of its speed something keeps when it hits it (0 to 1);
 * - `density`, kg/m³: what a body of it weighs for its size (water is 1000: less floats, more sinks);
 * - `drag`, per second: how fast a current carries a body of it, as the part of the difference
 *   between their velocities it closes in one second (a rough, light thing, more; a smooth one, less).
 * The density and the drag are for what comes later (buoyancy, a river that carries things): one more
 * contribution then, not a redesign (from a report on fluids reviewed when phase 2 closed).
 *
 * The world keeps its materials by name (`World.materials`): these, the engine's, and those a level
 * declares. A body refers to its material by name (`body.material`, the name a game also reads for
 * the sound of a step or what breaks how), and takes its friction and bounce when it is created.
 */
export interface Material {
  friction: number;
  bounce: number;
  density: number;
  drag: number;
}

/** The engine's materials. Stone's friction and bounce are a body's when nothing is said (0.6, 0.2). */
export const MATERIALS: Readonly<Record<string, Readonly<Material>>> = Object.freeze({
  stone: Object.freeze({ friction: 0.6, bounce: 0.2, density: 2400, drag: 0.5 }),
  wood: Object.freeze({ friction: 0.5, bounce: 0.3, density: 700, drag: 2 }),
  metal: Object.freeze({ friction: 0.4, bounce: 0.15, density: 7800, drag: 0.4 }),
  glass: Object.freeze({ friction: 0.3, bounce: 0.4, density: 2500, drag: 0.3 }),
  ice: Object.freeze({ friction: 0.05, bounce: 0.05, density: 917, drag: 1 }),
});

/** A material's name: a word in lowercase (`ice`, `wet_stone`). */
export const MATERIAL_NAME = /^[a-z][a-z0-9_]*$/;

/**
 * The friction at which a character's feet hold fully: stone's. On less, it slides: its walk reaches
 * what it is asked for, and stops, that much slower (on ice, 0.05: a twelfth). On more, it holds the
 * same: feet do not walk faster on rubber.
 */
export const FULL_GRIP = MATERIALS.stone!.friction;

/** How much a surface of this friction lets feet push, from 0 to 1. */
export const tractionOf = (friction: number): number => Math.max(0, Math.min(1, friction / FULL_GRIP));

/** Why a material's numbers are not one (or null): none below 0, a bounce up to 1, a density above 0. */
export function materialProblem(m: Material): string | null {
  for (const key of ['friction', 'bounce', 'drag'] as const)
    if (!Number.isFinite(m[key]) || m[key] < 0) return `its ${key} must be a number, 0 or more`;
  if (m.bounce > 1) return 'its bounce goes from 0 to 1';
  if (!Number.isFinite(m.density) || m.density <= 0) return 'its density must be more than 0';
  return null;
}
