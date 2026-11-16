/**
 * WHAT THINGS ARE MADE OF, as data: a name and four numbers.
 * - `friction`: how much its surface holds what slides on it (Coulomb's coefficient, μ);
 * - `bounce`: how much of its speed something keeps when it hits it (the restitution, e: 0 to 1);
 * - `density` (kg/m³) and `drag` (per second): what a body of it weighs for its size, and how fast
 *   a current carries it. They are part of the material; this lesson uses neither.
 */
export interface Material {
  friction: number;
  bounce: number;
  density: number;
  drag: number;
}

/** The engine's five, with its numbers (packages/core/src/materials.ts). */
export const MATERIALS: Readonly<Record<string, Material>> = {
  stone: { friction: 0.6, bounce: 0.2, density: 2400, drag: 0.5 },
  wood: { friction: 0.5, bounce: 0.3, density: 700, drag: 2 },
  metal: { friction: 0.4, bounce: 0.15, density: 7800, drag: 0.4 },
  glass: { friction: 0.3, bounce: 0.4, density: 2500, drag: 0.3 },
  ice: { friction: 0.05, bounce: 0.05, density: 917, drag: 1 },
};

/**
 * A LEVEL'S OWN MATERIAL, from its line, as the engine's level format writes it:
 * `material oil friction 0.02 bounce 0 density 900 drag 0.4`. All four numbers, or an error.
 */
export function readMaterial(line: string): { name: string; material: Material } {
  const [kind, name = '', ...rest] = line.trim().split(/\s+/);
  if (kind !== 'material' || !/^[a-z][a-z0-9_]*$/.test(name))
    throw new Error(`not a material: ${line}`);
  const said = new Map<string, number>();
  for (let i = 0; i < rest.length; i += 2) said.set(rest[i], Number(rest[i + 1]));
  const number = (key: string) => {
    const value = said.get(key);
    if (value === undefined || !(value >= 0))
      throw new Error(`"${name}" needs its ${key}, 0 or more`);
    return value;
  };
  const material = {
    friction: number('friction'),
    bounce: number('bounce'),
    density: number('density'),
    drag: number('drag'),
  };
  if (material.bounce > 1) throw new Error(`"${name}": its bounce goes from 0 to 1`);
  return { name, material };
}

/**
 * HOW TWO NUMBERS BECOME ONE at a contact: each surface has its own, and the contact needs one.
 * Rapier's four rules (Average is its default). When two colliders ask for different rules, Rapier
 * uses the one further down this list: max over multiply over min over average.
 */
export type Rule = 'average' | 'min' | 'multiply' | 'max';
export function combine(a: number, b: number, rule: Rule): number {
  if (rule === 'min') return Math.min(a, b);
  if (rule === 'multiply') return a * b;
  if (rule === 'max') return Math.max(a, b);
  return (a + b) / 2;
}

/**
 * TRACTION: how much a floor lets feet push, from 0 to 1. Fully from stone's friction up; less on
 * less (on ice, 0.05 / 0.6: a twelfth). As in the engine: a character is not moved by the physics'
 * friction (it is kinematic), so the game reads the floor's friction and decides.
 */
export const FULL_GRIP = MATERIALS.stone.friction;
export const tractionOf = (friction: number) => Math.max(0, Math.min(1, friction / FULL_GRIP));
