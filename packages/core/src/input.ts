import { sinCosDegrees, type Vec3 } from '@manifold/common';
import type { InputValue, PlayerInput } from './types';
import type { World } from './world';

/**
 * WHAT A PLAYER CAN ASK FOR (stage 1d): actions with a name and a kind, declared by the core (what
 * the character reads) and by each game (its own buttons). The session accepts only what was
 * declared, so a replay or a message from the network cannot bring anything else.
 */
export interface InputAction {
  /** The core's (`move`, `jump`…) or a game's, with its namespace (`dojo.throw`). */
  name: string;
  /**
   * `button`: held or not; `axis`: an amount from −1 to 1; `vector`: three numbers; `direction`
   * (stage 2.5c): where on the ground, in whole degrees, and how much (see `direction`).
   */
  kind: 'button' | 'axis' | 'vector' | 'direction';
  description: string;
}

/** What the character system reads (stages 1b and 1c2): every game has them. */
export const CHARACTER_ACTIONS: readonly InputAction[] = [
  { name: 'move', kind: 'direction', description: 'where to go, on the ground of the world, and how much (up to 1)' },
  { name: 'ahead', kind: 'axis', description: 'forward (+) or back (−), where the character looks' },
  { name: 'side', kind: 'axis', description: 'to its right (+) or left (−), without turning' },
  { name: 'turn', kind: 'axis', description: 'turning on its own axis: to the right (+) or the left (−)' },
  {
    name: 'face',
    kind: 'direction',
    description: 'where to look, if it is given (inside the turn the platforms gave the character: faceFor)',
  },
  {
    name: 'pitch',
    kind: 'axis',
    description: 'where to aim, above (+) or below (−) where it looks, as a fraction of a quarter turn (stage 4b)',
  },
  { name: 'jump', kind: 'button', description: 'jumping' },
  { name: 'run', kind: 'button', description: 'running' },
  { name: 'crouch', kind: 'button', description: 'crouching, while it is held, on the ground (stage 4b)' },
  { name: 'roll', kind: 'button', description: 'rolling, a dodge, the way it is asked to go (stage 4b)' },
  { name: 'use', kind: 'button', description: 'using what it stands in: a button (stage 3c)' },
  { name: 'grab', kind: 'button', description: 'grabbing what is in front of it, and letting it go (stage 3g)' },
];

/** The actions of a game: the core's, then its own. Its own need a namespace, and cannot repeat a name. */
export function actionsFor(own: readonly InputAction[] = []): readonly InputAction[] {
  const names = new Set(CHARACTER_ACTIONS.map((a) => a.name));
  for (const a of own) {
    if (!/^[a-z][a-z0-9]*\.[a-z][a-z0-9.]*$/.test(a.name))
      throw new Error(`The action "${a.name}" needs its game's namespace, like "dojo.throw".`);
    if (names.has(a.name)) throw new Error(`The action "${a.name}" is declared twice.`);
    names.add(a.name);
  }
  return [...CHARACTER_ACTIONS, ...own];
}

/** A vector the player asks for, or zero. */
export const vectorOf = (input: PlayerInput, name: string): Vec3 => {
  const v = input[name];
  return Array.isArray(v) ? v : [0, 0, 0];
};
/** An axis the player asks for, or zero. */
export const axisOf = (input: PlayerInput, name: string): number => {
  const v = input[name];
  return typeof v === 'number' ? v : 0;
};
/** Whether a button is held. */
export const isDown = (input: PlayerInput, name: string): boolean => input[name] === true;

/** What a player who asks for nothing asks for. */
export const NO_INPUT: PlayerInput = Object.freeze({});

/**
 * Whether a button was PRESSED at this step: held now, and not at the step before. (Holding it is
 * not pressing it again: a jump, a throw, a shot happen once per press.)
 */
export function pressed(world: World, player: number, name: string): boolean {
  return isDown(world.inputs.get(player) ?? NO_INPUT, name) && !isDown(world.lastInputs.get(player) ?? NO_INPUT, name);
}

/**
 * Whether a button was LET GO at this step (stage 4b): held at the step before, and not now. What is
 * charged while it is held (a bow, a throw) goes when it is let go.
 */
export function released(world: World, player: number, name: string): boolean {
  return !isDown(world.inputs.get(player) ?? NO_INPUT, name) && isDown(world.lastInputs.get(player) ?? NO_INPUT, name);
}

/**
 * A DIRECTION ON THE GROUND (stage 2.5c): `degrees` from forward (−Z) towards the right (+X), whole,
 * and `amount` (0 to 1, in hundredths), as the vector the character reads. With our own sine and
 * cosine (`sinCosDegrees`): the same bits in every browser. A direction asked for is one of 360, and
 * it travels as its degrees: one number instead of three, in a replay and in a link.
 */
export function direction(degrees: number, amount = 1): Vec3 {
  const [s, c] = sinCosDegrees(degrees);
  return [amount * s || 0, 0, 0 - amount * c || 0];
}

/**
 * The whole degrees of a direction on the ground (its x and z), from forward (−Z) towards the right
 * (+X), from 0 to 359: the closest of the 360 directions. Without the browser's `atan2` (it may give
 * other bits in another browser): from the four quarters, it goes towards the one it looks most like,
 * halving the step, comparing with our own sine and cosine.
 */
export function degreesOf(x: number, z: number): number {
  const along = (d: number) => {
    const [s, c] = sinCosDegrees(d);
    return x * s - z * c;
  };
  let best = 0;
  for (const d of [90, 180, 270]) if (along(d) > along(best)) best = d;
  for (const step of [45, 23, 12, 6, 3, 2, 1]) for (const d of [best - step, best + step]) if (along(d) > along(best)) best = d;
  return ((best % 360) + 360) % 360;
}

/** How close two directions on the ground must be to count as the same one asked again: within 1°. */
const SAME_DIRECTION = sinCosDegrees(1)[1];

const hundredth = (x: number) =>
  // `|| 0`: a little negative number rounds to −0, which is written "0" and read back as +0; the two
  // have different bits, so a replay of it gave another hash (stage 1c2). Here it is +0 from the start.
  // Something that is not a number (NaN, infinity) is zero: it cannot enter the world.
  Number.isFinite(x) ? Math.round(x * 100) / 100 || 0 : 0;

/**
 * An input as it enters the world and travels (in a replay, in a link, over the network): only the
 * declared actions, its numbers rounded to hundredths (axes from −1 to 1), its directions to whole
 * degrees, and only what is not zero or not held. Small, comparable, and without the noise of a
 * camera that turns a little every frame. In the declared order: so it is written the same way.
 *
 * A direction changes only when it moves 1° or more from the one `before` (stage 2.5c): a camera
 * that turns slowly, or a hand on the mouse that trembles around the edge between two degrees, does
 * not ask for a new direction on every step. (Measured on the course, 30 s walking with the camera
 * turning: a replay link of 5,800 characters became half.)
 */
export function normalizeInput(input: PlayerInput, actions: readonly InputAction[], before: PlayerInput = {}): PlayerInput {
  const out: Record<string, InputValue> = {};
  for (const a of actions) {
    const v = input[a.name];
    if (a.kind === 'button') {
      if (v === true) out[a.name] = true;
    } else if (a.kind === 'axis') {
      const x = typeof v === 'number' ? hundredth(Math.max(-1, Math.min(1, v))) : 0;
      if (x !== 0) out[a.name] = x;
    } else if (a.kind === 'direction') {
      if (!Array.isArray(v) || v.length !== 3) continue;
      const length = Math.sqrt(v[0] * v[0] + v[2] * v[2]);
      const amount = Number.isFinite(length) ? hundredth(Math.min(1, length)) : 0;
      if (amount === 0) continue;
      let degrees = degreesOf(v[0], v[2]);
      const exact = direction(degrees, amount);
      // Already one of the 360 (it came normalized: from a client, from a replay): as it is. If not,
      // within 1° of the one asked for before, the same one.
      const onGrid = exact[0] === v[0] && exact[1] === v[1] && exact[2] === v[2];
      const was = before[a.name];
      if (!onGrid && Array.isArray(was)) {
        const wasLength = Math.sqrt(was[0] * was[0] + was[2] * was[2]);
        if (wasLength > 0 && (v[0] * was[0] + v[2] * was[2]) / (length * wasLength) > SAME_DIRECTION)
          degrees = degreesOf(was[0], was[2]);
      }
      out[a.name] = direction(degrees, amount);
    } else if (Array.isArray(v) && v.length === 3) {
      const x: Vec3 = [hundredth(v[0]), hundredth(v[1]), hundredth(v[2])];
      if (x.some((n) => n !== 0)) out[a.name] = x;
    }
  }
  return out;
}

const sameValue = (a: InputValue | undefined, b: InputValue | undefined) =>
  Array.isArray(a) && Array.isArray(b) ? a.every((x, i) => x === b[i]) : a === b;

/** Whether two normalized inputs ask for the same. */
export function sameInput(a: PlayerInput, b: PlayerInput): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => sameValue(a[k], b[k]));
}

/** Why an input does not fit the declared actions (a name nobody declared, a value of another kind), or null. */
export function inputProblem(input: PlayerInput, actions: readonly InputAction[]): string | null {
  for (const [name, value] of Object.entries(input)) {
    const a = actions.find((x) => x.name === name);
    if (!a) return `"${name}" is not something a player can ask for here`;
    const kind = value === true ? 'button' : typeof value === 'number' ? 'axis' : Array.isArray(value) ? 'vector' : '?';
    // (A direction travels as the vector it is.)
    if (kind !== a.kind && !(a.kind === 'direction' && kind === 'vector'))
      return `"${name}" is a ${a.kind}, and it came as a ${kind}`;
  }
  return null;
}
