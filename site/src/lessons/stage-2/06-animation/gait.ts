/**
 * WHAT THE VIEW DECIDES, like the engine's locomotion.ts: which clips play, how much of each, and
 * how far one cycle of what plays carries the figure. Pure numbers, no three.js: it reads how the
 * figure really moved, and the simulation never hears of it.
 */

export type Direction = 'forward' | 'right' | 'back' | 'left';
export type Pace = 'walk' | 'run';
export const DIRECTIONS: Direction[] = ['forward', 'right', 'back', 'left'];
export const PACE_NAMES: Pace[] = ['walk', 'run'];

/** Each direction as a vector, from where the body looks: [ahead, to its right]. */
export const VECTORS: Record<Direction, [number, number]> = {
  forward: [1, 0],
  right: [0, 1],
  back: [-1, 0],
  left: [0, -1],
};

/**
 * THE PACES: the speed each family of cycles was made for (m/s), and how far one cycle carries it
 * (m): ahead or back, and to a side (shorter steps, so the feet do not cross). The clips are made
 * from these same numbers (figure.ts): the view and the art cannot disagree.
 */
export const PACES: Record<Pace, { speed: number; along: number; side: number }> = {
  walk: { speed: 1.2, along: 1.2, side: 0.6 },
  run: { speed: 2.8, along: 1.7, side: 0.8 },
};

/** A clip's name, as in the engine: `walk`, `walk_right`, `run_back`… */
export function clipName(pace: Pace, d: Direction): string {
  return d === 'forward' ? pace : `${pace}_${d}`;
}

/** How far one cycle of a clip carries the body. */
export function strideLength(pace: Pace, d: Direction): number {
  return VECTORS[d][0] !== 0 ? PACES[pace].along : PACES[pace].side;
}

/**
 * BY DIRECTION: the angle of the motion from where the body looks (degrees, to its right positive)
 * picks the two nearest of the four directions, and weighs them so that the mixed step points where
 * it goes: each one's weight × stride, as the cosine and the sine of the angle inside the quarter.
 * Without blending, only the nearest, whole.
 */
export function byDirection(angle: number, pace: Pace, blend: boolean): Record<Direction, number> {
  const w = { forward: 0, right: 0, back: 0, left: 0 };
  const a = ((angle % 360) + 360) % 360;
  const quarter = Math.floor(a / 90) % 4;
  const here = DIRECTIONS[quarter];
  const next = DIRECTIONS[(quarter + 1) % 4];
  const inside = ((a - quarter * 90) * Math.PI) / 180; // 0 on `here`, a right angle on `next`
  if (!blend) {
    w[inside < Math.PI / 4 ? here : next] = 1;
    return w;
  }
  const h = Math.cos(inside) / strideLength(pace, here);
  const n = Math.sin(inside) / strideLength(pace, next);
  w[here] = h / (h + n); // the two add up to 1
  w[next] = n / (h + n);
  return w;
}

/** BY SPEED: how much it runs, from 0 at the walk's speed to 1 at the run's. */
export function runWeight(speed: number): number {
  return Math.min(
    1,
    Math.max(0, (speed - PACES.walk.speed) / (PACES.run.speed - PACES.walk.speed)),
  );
}

/** How much it moves: 0 standing still, 1 from 0.4 m/s on (a smooth step between the two). */
export function moveWeight(speed: number): number {
  const t = Math.min(1, Math.max(0, (speed - 0.05) / 0.35));
  return t * t * (3 - 2 * t);
}

/** WHAT TO PLAY: every clip's weight (still, or its direction's times its pace's). They add up to 1. */
export function gait(angle: number, speed: number, blend: boolean): Record<string, number> {
  const moving = moveWeight(speed);
  const run = runWeight(speed);
  const weights: Record<string, number> = { idle: 1 - moving };
  for (const pace of PACE_NAMES) {
    const d = byDirection(angle, pace, blend);
    const share = moving * (pace === 'run' ? run : 1 - run);
    for (const dir of DIRECTIONS) weights[clipName(pace, dir)] = d[dir] * share;
  }
  return weights;
}

/**
 * HOW FAR ONE CYCLE OF WHAT PLAYS CARRIES THE BODY (m): each moving clip's stride as a vector
 * (where it sweeps the feet), times its weight, added up; the length of that sum, for a whole
 * weight. With the weights it plays with now, not the targets: during a crossfade, the feet sweep
 * what is playing.
 */
export function strideOf(weights: Record<string, number>): number {
  let ahead = 0;
  let right = 0;
  let moving = 0;
  for (const pace of PACE_NAMES)
    for (const dir of DIRECTIONS) {
      const w = weights[clipName(pace, dir)] ?? 0;
      moving += w;
      ahead += w * strideLength(pace, dir) * VECTORS[dir][0];
      right += w * strideLength(pace, dir) * VECTORS[dir][1];
    }
  return moving > 0 ? Math.hypot(ahead, right) / moving : 0;
}

/**
 * THE CROSSFADE: the weights it plays with follow their targets, all at one pace, so they keep
 * adding up to 1. `seconds` is how long they take to go most of the way (0: at once, a pop).
 */
export function follow(
  weights: Record<string, number>,
  targets: Record<string, number>,
  dt: number,
  seconds: number,
) {
  const k = seconds > 0 ? 1 - Math.exp(-dt / seconds) : 1;
  for (const name of Object.keys(targets)) {
    const w = weights[name] ?? 0;
    weights[name] = w + (targets[name] - w) * k;
  }
}
