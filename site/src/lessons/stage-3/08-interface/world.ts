import { createRandom } from './random';

/**
 * THE WORLD: a token that takes the stars and goes to the goal, by itself or as the player asks,
 * and makes sounds on the way. It tells what happened with a key and its numbers (`notice.star`,
 * 2, 3), never with words: this file does not know that there are languages. The page says them in
 * the player's (`words.ts`).
 */
export const STEP = 1 / 60;
export const STARS = 5;
export const GOAL = { x: 0, z: 2.8 };
const SPEED = 2; // m/s
const STRIDE = 0.8; // a step every 80 cm walked
const REACH = 0.5; // this near a star, or the goal, is there (m)

export interface Point {
  x: number;
  z: number;
}
/** What the world tells the player: a key and its numbers. */
export interface Notice {
  key: string;
  values: number[];
}
/** A sound: what made it, on what, where, and how far it is heard (m). */
export interface Sound {
  kind: 'step' | 'chime' | 'door';
  surface?: 'wood' | 'metal';
  at: [number, number, number];
  radius: number;
}

export interface World {
  tick: number;
  at: Point; // where the token is
  walked: number; // since its last step (m)
  lap: number;
  lapStart: number; // the tick it started
  stars: Point[]; // the ones still there
  taken: number;
  notices: Notice[]; // what it told and the page has not read yet
  sounds: Sound[];
  hash: number;
  random: () => number;
}

// THE STARS, at seeded places on the floor.
function placeStars(random: () => number): Point[] {
  const stars: Point[] = [];
  for (let i = 0; i < STARS; i++) stars.push({ x: -4 + 8 * random(), z: -2.5 + 4.5 * random() });
  return stars;
}

// (Products, not `**`: + − × ÷ and the square root give the same bits in every browser.)
const length = (x: number, z: number) => Math.sqrt(x * x + z * z);
const distance = (a: Point, b: Point) => length(a.x - b.x, a.z - b.z);
const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

/** A hash of the world (FNV-1a, a number at a time): only the world's numbers go into it. */
function mix(hash: number, numbers: number[]): number {
  for (const n of numbers) hash = Math.imul(hash ^ n, 16777619) >>> 0;
  return hash;
}

export function createWorld(seed: number): World {
  const random = createRandom(seed);
  return {
    tick: 0,
    at: { x: GOAL.x, z: GOAL.z },
    walked: 0,
    lap: 1,
    lapStart: 0,
    stars: placeStars(random),
    taken: 0,
    notices: [],
    sounds: [],
    hash: 2166136261, // FNV-1a's starting number
    random,
  };
}

function tell(w: World, key: string, values: number[]) {
  w.notices.push({ key, values });
  const codes = [...key].map((c) => c.charCodeAt(0));
  w.hash = mix(w.hash, codes.concat(values.map((v) => Math.round(v * 1000))));
}

/** THE AUTOPILOT: towards the nearest star, or the goal when none is left. */
function autopilot(w: World): Point {
  let target = GOAL;
  for (const star of w.stars)
    if (target === GOAL || distance(w.at, star) < distance(w.at, target)) target = star;
  return { x: target.x - w.at.x, z: target.z - w.at.z };
}

/**
 * ONE STEP. `wanted` is where the player asks to walk (from the keys), or null: the autopilot walks.
 * The token goes that way at its speed, and never farther than what was asked.
 */
export function step(w: World, wanted: Point | null) {
  w.tick++;
  const want = wanted ?? autopilot(w);
  const asked = length(want.x, want.z);
  if (asked > 0) {
    const move = Math.min(SPEED * STEP, asked) / asked;
    const to = { x: clamp(w.at.x + want.x * move, 4.8), z: clamp(w.at.z + want.z * move, 3.3) };
    w.walked += distance(w.at, to);
    w.at = to;
  }
  // A STAR within reach: taken. The notice says how many taken and how many left, as numbers.
  for (const star of w.stars.filter((s) => distance(w.at, s) <= REACH)) {
    w.stars.splice(w.stars.indexOf(star), 1);
    w.taken++;
    tell(w, 'notice.star', [w.taken, w.stars.length]);
    w.sounds.push({ kind: 'chime', at: [star.x, 0.8, star.z], radius: 8 });
  }
  // THE GOAL, with every star: the lap's time in seconds (a number; how it is written is the page's).
  if (w.stars.length === 0 && distance(w.at, GOAL) <= REACH) {
    tell(w, 'notice.goal', [(w.tick - w.lapStart) * STEP]);
    w.lap++;
    w.lapStart = w.tick;
    w.taken = 0;
    w.stars = placeStars(w.random);
  }
  // A STEP every stride, heard as far as its floor says (the lesson on sound: wood 7 m, metal 10 m).
  if (w.walked >= STRIDE) {
    w.walked -= STRIDE;
    const surface = w.at.x < 0 ? 'wood' : 'metal';
    const radius = surface === 'wood' ? 7 : 10;
    w.sounds.push({ kind: 'step', surface, at: [w.at.x, 0, w.at.z], radius });
  }
  // A DOOR behind where the camera starts, every 8 s: a sound that nobody sees.
  if (w.tick % 480 === 240) w.sounds.push({ kind: 'door', at: [-6, 1, 14], radius: 20 });
  const position = [Math.round(w.at.x * 1e6), Math.round(w.at.z * 1e6)];
  w.hash = mix(w.hash, [w.tick, w.lap, w.taken, ...position]);
}
