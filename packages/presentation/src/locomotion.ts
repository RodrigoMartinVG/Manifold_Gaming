import { vec3, type Vec3 } from '@manifold/common';
import type { ModeName } from '@manifold/core';

/**
 * HOW A CHARACTER'S MODEL MOVES (stage 2e2): which of its animations it plays, how much of each, and
 * at what point of their cycles. Pure numbers, without three.js (models.ts applies them), so the
 * tests read them without a screen.
 *
 * In 2e one animation followed the mode and the speed, and walking sideways or backwards played the
 * forward cycle. Now, on the ground, four cycles for each pace (forward, back, each side) are mixed by
 * the angle between where it goes and where it looks (and crouched, from stage 4b, four more, and its
 * own quiet); climbing, up and each side; in the air, rising
 * and falling. Each family shares one length and one phase, which advances with the distance really
 * travelled, one cycle per stride (`STRIDES`: how far the model's foot on the ground goes back in a
 * cycle): mixed, the feet stay in step, and a foot on the ground stays where it is. The velocity is the
 * one it REALLY had (what the view saw it move), not the one it asks for: against a wall it does not
 * walk in place. And two short gestures over the rest: a somersault for the jump in the air, and
 * the weight of a landing.
 */

/** The animations a character's model must have, by name (the art's test asks for exactly these). */
export const CHARACTER_CLIPS = [
  'idle',
  'walk',
  'walk_back',
  'walk_left',
  'walk_right',
  'run',
  'run_back',
  'run_left',
  'run_right',
  'crouch_idle',
  'crouch',
  'crouch_back',
  'crouch_left',
  'crouch_right',
  'turn',
  'climb',
  'climb_left',
  'climb_right',
  'rise',
  'fall',
  'glide',
  'flip',
  'roll',
  'land',
] as const;
export type CharacterClip = (typeof CHARACTER_CLIPS)[number];

/** The families whose cycles are mixed: each one, one length (the art's test checks it) and one phase. */
export const FAMILIES = {
  walk: ['walk', 'walk_back', 'walk_left', 'walk_right'],
  run: ['run', 'run_back', 'run_left', 'run_right'],
  crouch: ['crouch', 'crouch_back', 'crouch_left', 'crouch_right'],
  climb: ['climb', 'climb_left', 'climb_right'],
} as const satisfies Record<string, readonly CharacterClip[]>;

/** The speeds the cycles were made for (m/s): the engine's walk and run. */
const WALK = 4.5;
const RUN = 7.5;

/** How far one cycle of a family carries it (m), ahead, back and to either side. */
export interface Stride {
  forward: number;
  back: number;
  side: number;
}

/**
 * HOW FAR ONE CYCLE CARRIES IT (m), for each family and direction: how far a foot on the ground goes
 * back under the hips in one cycle, measured in the model (the Dojo's gait test reads it from the file,
 * and fails if these are not its numbers). Played with these, a foot on the ground stays where it is
 * (after the tutorial's pass). In 2e2 they were what a jog's steps should be (2.7 m), not what the cycles did: their
 * foot on the ground went back and forth a few centimeters, and slid the whole way.
 */
export const STRIDES = {
  walk: { forward: 2.64, back: 2.24, side: 1.36 },
  run: { forward: 3.04, back: 2.4, side: 1.6 },
  crouch: { forward: 1.44, back: 1.2, side: 0.96 },
} as const satisfies Record<'walk' | 'run' | 'crouch', Stride>;
/** How far one climbing cycle takes it along the wall (m), and how far it turns in one turning cycle (degrees). */
const CLIMB_STRIDE = 2;
const TURN_CYCLE = 180;
/** How long the weights take to follow (s): short enough to read as a change, long enough not to snap. */
const BLEND = 0.1;
/** The fall that makes a landing weigh (m/s down). */
const HARD_LANDING = 4;

/** What the view read of a character this frame. */
export interface Reading {
  mode: ModeName;
  grounded: boolean;
  up: Vec3;
  /** Where it looks (flat). */
  facing: Vec3;
  /** How it really moved (m/s), apart from what carries it. */
  velocity: Vec3;
  /** Its vertical speed as the simulation has it (m/s): rising or falling. */
  vertical: number;
  /** The jumps in the air it has left: when it goes down in the air, it jumped again. */
  airJumps: number;
  /** How fast its body is drawn turning around "up" (degrees per second), apart from what carries it. */
  turning: number;
  /** How far its roll has gone (stage 4b), 0 to 1, from the simulation (0, not rolling). */
  roll: number;
}

/** What a copy remembers from one frame to the next. */
export interface Gait {
  /** The weights it plays with now (they follow the targets). */
  weights: Record<CharacterClip, number>;
  /** The phases (0 to 1) of the ground's cycles, of climbing, and of turning; and a clock for the rest. */
  phase: number;
  climbPhase: number;
  turnPhase: number;
  /** How far the roll has gone (stage 4b): the simulation's, as the last reading said. */
  rollPhase: number;
  clock: number;
  /** The last direction it moved in (degrees, from where it looks): stopping does not jump to "forward". */
  angle: number;
  climbAngle: number;
  /** A gesture playing: which, since when (s), and how strong. */
  gesture: { clip: 'flip' | 'land'; time: number; strength: number } | null;
  /**
   * How many gestures have started, and the last one (stage 3b): what the browser tests read. The
   * animation that weighs most, read frame by frame, could miss a landing: it lasts 0.3 s and comes in
   * from nothing, and at a few frames per second (WebGL on the CPU, a loaded machine) no frame showed it.
   */
  started: { count: number; clip: 'flip' | 'land' | null };
  /** How long each gesture lasts (s): its animation's length, from the model. */
  lengths: { flip: number; land: number };
  last: { mode: ModeName | null; airJumps: number; vertical: number };
}

export function newGait(lengths: { flip: number; land: number } = { flip: 0.45, land: 0.3 }): Gait {
  const weights = Object.fromEntries(CHARACTER_CLIPS.map((c) => [c, c === 'idle' ? 1 : 0])) as Record<CharacterClip, number>;
  return {
    weights,
    phase: 0,
    climbPhase: 0,
    turnPhase: 0,
    rollPhase: 0,
    clock: 0,
    angle: 0,
    climbAngle: 0,
    gesture: null,
    started: { count: 0, clip: null },
    lengths,
    last: { mode: null, airJumps: 0, vertical: 0 },
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const degrees = (radians: number) => (radians * 180) / Math.PI;

/**
 * WHEN EACH FOOT IS ON THE GROUND in a cycle of walking or running (the art makes them so, and the Dojo's
 * gait test checks it): a quarter of the cycle each, the right foot's around 0.25 and the left one's
 * around 0.75; between them, both in the air. `lift`: how long after it the foot may still be leaving
 * the floor.
 */
export const FOOTING = { stance: 0.25, lift: 0.06, middle: { L: 0.75, R: 0.25 } } as const;

/** Where a foot is in its cycle: down, lifting, or up. */
export type Footing = 'down' | 'lifting' | 'up';

/**
 * Where a foot is in its cycle now (feet.ts plants it): `down`, standing on something with walking or
 * running weighing most, in that foot's quarter; `lifting`, just after it; `up`, otherwise.
 */
export function footing(g: Gait, side: 'L' | 'R', grounded: boolean): Footing {
  if (!grounded) return 'up';
  let ground = 0;
  for (const clip of [...FAMILIES.walk, ...FAMILIES.run, ...FAMILIES.crouch]) ground += g.weights[clip];
  if (ground < 0.5) return 'up';
  const u = (((g.phase - FOOTING.middle[side] + FOOTING.stance / 2) % 1) + 1) % 1;
  return u < FOOTING.stance ? 'down' : u < FOOTING.stance + FOOTING.lift ? 'lifting' : 'up';
}

/** The same stride every way: the directions' weights by angle alone. */
const EVEN: Stride = { forward: 1, back: 1, side: 1 };
const ORDER = ['forward', 'right', 'back', 'left'] as const;

/**
 * Between the two nearest directions of an angle (degrees, from where it looks; to its right,
 * positive): the weight of each, and how far a cycle of their mix carries it. A foot on the ground in
 * the mix goes back as the cycles' feet would, weighted: the first one's stride `S1` along its
 * direction, the next one's `S2` along its own, so the mix goes along the motion only if
 * `w1·S1 : w2·S2 = cos r : sin r` (r, the angle from the first). Weighted by the angle alone (as in
 * 2e2), a mix of a long stride and a short one pointed off its way: between forward (2.64 m) and to a
 * side (1.36 m), walking at 45° its step went at 27°.
 */
function between(angle: number, stride: Stride) {
  const a = ((angle % 360) + 360) % 360;
  const sector = Math.floor(a / 90) % 4;
  const first = ORDER[sector]!;
  const next = ORDER[(sector + 1) % 4]!;
  const length = (d: (typeof ORDER)[number]) => (d === 'forward' ? stride.forward : d === 'back' ? stride.back : stride.side);
  const r = ((a - sector * 90) * Math.PI) / 180;
  const along = length(next) * Math.cos(r);
  const across = length(first) * Math.sin(r);
  const w1 = along / (along + across);
  const w2 = across / (along + across);
  return { first, next, w1, w2, stride: Math.sqrt((w1 * length(first)) ** 2 + (w2 * length(next)) ** 2) };
}

/**
 * The four directions' weights for an angle (degrees, from where it looks; to its right, positive):
 * the two nearest, so that their mixed step goes where it walks (`between`); with the same stride every
 * way, at 45°, half forward and half to the side.
 */
export function directions(angle: number, stride: Stride = EVEN): { forward: number; right: number; back: number; left: number } {
  const w = { forward: 0, right: 0, back: 0, left: 0 };
  const b = between(angle, stride);
  w[b.first] += b.w1;
  w[b.next] += b.w2;
  return w;
}

/** How far one cycle of the two nearest directions, mixed by `directions`, carries it (m). */
export function strideAlong(angle: number, stride: Stride): number {
  return between(angle, stride).stride;
}

/** What it plays with no gesture over it, from what it does (the weights add up to 1). */
export function targets(r: Reading, g: Pick<Gait, 'angle' | 'climbAngle'>): Partial<Record<CharacterClip, number>> {
  const right = vec3.cross(r.facing, r.up);
  if (r.mode === 'glide') return { glide: 1 };
  // Rolling (stage 4b): its roll, played by how far it has gone.
  if (r.mode === 'roll') return { roll: 1 };
  if (r.mode === 'air') {
    // Rising (fast up), and falling (from a little before the top): a jump reads its arc.
    const rise = clamp01((r.vertical + 1) / 4);
    return { rise, fall: 1 - rise };
  }
  if (r.mode === 'climb') {
    // Up the wall, or to a side along it, by the angle of its motion on the wall (it does not climb down).
    const up = vec3.dot(r.velocity, r.up);
    const side = vec3.dot(r.velocity, right);
    const angle =
      Math.hypot(up, side) > 0.1 ? Math.max(-90, Math.min(90, degrees(Math.atan2(side, Math.max(0, up))))) : g.climbAngle;
    const s = Math.abs(angle) / 90;
    return angle >= 0 ? { climb: 1 - s, climb_right: s } : { climb: 1 - s, climb_left: s };
  }
  // On the ground: still, turning on the spot, or moving (walking, running, mixed), by the four directions.
  const flat = vec3.onPlane(r.velocity, r.up);
  const speed = vec3.length(flat);
  const angle = speed > 0.05 ? degrees(Math.atan2(vec3.dot(flat, right), vec3.dot(flat, r.facing))) : g.angle;
  const moving = smoothstep(0.2, 1, speed);
  if (r.mode === 'crouch') {
    // Crouched (stage 4b): its own quiet, or its cycles by the four directions (turning on the spot, quiet).
    const low = directions(angle, STRIDES.crouch);
    return {
      crouch_idle: 1 - moving,
      crouch: moving * low.forward,
      crouch_right: moving * low.right,
      crouch_back: moving * low.back,
      crouch_left: moving * low.left,
    };
  }
  const turning = (1 - moving) * clamp01(Math.abs(r.turning) / 90);
  const run = clamp01((speed - WALK) / (RUN - WALK));
  const walking = directions(angle, STRIDES.walk);
  const running = directions(angle, STRIDES.run);
  return {
    idle: 1 - moving - turning,
    turn: turning,
    walk: moving * (1 - run) * walking.forward,
    walk_right: moving * (1 - run) * walking.right,
    walk_back: moving * (1 - run) * walking.back,
    walk_left: moving * (1 - run) * walking.left,
    run: moving * run * running.forward,
    run_right: moving * run * running.right,
    run_back: moving * run * running.back,
    run_left: moving * run * running.left,
  };
}

/**
 * Moves a copy's gait on by `dt` seconds (already scaled by the match's speed: paused, nothing
 * moves): the weights follow what it does, the phases advance with how far it went, and a gesture
 * starts when the world says so (a jump in the air, a hard landing).
 */
export function advance(g: Gait, r: Reading, dt: number) {
  // (Paused, nothing moves: not the cycles, not the weights, not what it remembers.)
  if (dt <= 0) return;
  const right = vec3.cross(r.facing, r.up);
  const flat = vec3.onPlane(r.velocity, r.up);
  const speed = vec3.length(flat);
  if (speed > 0.05) g.angle = degrees(Math.atan2(vec3.dot(flat, right), vec3.dot(flat, r.facing)));
  if (r.mode === 'climb') {
    const up = vec3.dot(r.velocity, r.up);
    const side = vec3.dot(r.velocity, right);
    if (Math.hypot(up, side) > 0.1) g.climbAngle = Math.max(-90, Math.min(90, degrees(Math.atan2(side, Math.max(0, up)))));
  }

  // The weights follow their targets, all at the same pace (so they keep adding up to 1).
  const target = targets(r, g);
  const follow = 1 - Math.exp(-dt / BLEND);
  for (const clip of CHARACTER_CLIPS) g.weights[clip] += ((target[clip] ?? 0) - g.weights[clip]) * follow;

  // The phases: the ground's, by the distance travelled over one cycle's (the mix's: walking and running
  // at one phase, their feet on the ground going back along the same line, add up as they are weighed);
  // climbing's, by the distance along the wall; turning's, by the angle.
  const run = clamp01((speed - WALK) / (RUN - WALK));
  // (Crouched, its own strides, at the same phase: its feet are down when walking's are.)
  const stride =
    r.mode === 'crouch'
      ? strideAlong(g.angle, STRIDES.crouch)
      : (1 - run) * strideAlong(g.angle, STRIDES.walk) + run * strideAlong(g.angle, STRIDES.run);
  g.phase = (g.phase + (dt * speed) / stride) % 1;
  if (r.mode === 'climb') g.climbPhase = (g.climbPhase + (dt * vec3.length(r.velocity)) / CLIMB_STRIDE) % 1;
  g.turnPhase = (g.turnPhase + (dt * Math.abs(r.turning)) / TURN_CYCLE) % 1;
  g.rollPhase = r.roll;
  g.clock += dt;

  // The gestures. A jump in the air (it had one more a moment ago, and it is not standing): a
  // somersault. Landing from a fall faster than a jump's: its weight, stronger the harder it came down.
  if (r.airJumps < g.last.airJumps && !r.grounded && r.mode !== 'climb') {
    g.gesture = { clip: 'flip', time: 0, strength: 1 };
    g.started = { count: g.started.count + 1, clip: 'flip' };
  } else if (r.grounded && (g.last.mode === 'air' || g.last.mode === 'glide') && g.last.vertical < -HARD_LANDING) {
    g.gesture = { clip: 'land', time: 0, strength: Math.max(0.35, clamp01((-g.last.vertical - HARD_LANDING) / 5)) };
    g.started = { count: g.started.count + 1, clip: 'land' };
  } else if (g.gesture) {
    g.gesture.time += dt;
    if (g.gesture.time >= g.lengths[g.gesture.clip]) g.gesture = null;
  }
  g.last = { mode: r.mode, airJumps: r.airJumps, vertical: r.vertical };
}

/**
 * How much a gesture weighs now: all of it from its start (the pose before it dies out by inertia, in
 * the view: inertia.ts), out at its end (0 when there is none).
 */
export function gestureWeight(g: Gait): number {
  if (!g.gesture) return 0;
  const length = g.lengths[g.gesture.clip];
  const { time, strength } = g.gesture;
  return strength * clamp01(Math.min((length - time) / 0.1, 1));
}

/** Every animation's weight as it is drawn: the gait's, under the gesture's (they add up to 1). */
export function finalWeights(g: Gait): Record<CharacterClip, number> {
  const over = gestureWeight(g);
  const out = {} as Record<CharacterClip, number>;
  for (const clip of CHARACTER_CLIPS) out[clip] = g.weights[clip] * (1 - over);
  if (g.gesture) out[g.gesture.clip] += over;
  return out;
}

/** The animation that weighs most (what the browser tests read). */
export function dominant(weights: Record<CharacterClip, number>): CharacterClip {
  let best: CharacterClip = 'idle';
  for (const clip of CHARACTER_CLIPS) if (weights[clip] > weights[best]) best = clip;
  return best;
}

/** Where in its cycle each animation is (0 to 1), or, for the ones with their own clock, the seconds. */
export function cycleTime(g: Gait, clip: CharacterClip): { phase: number } | { seconds: number } {
  if (
    (FAMILIES.walk as readonly string[]).includes(clip) ||
    (FAMILIES.run as readonly string[]).includes(clip) ||
    (FAMILIES.crouch as readonly string[]).includes(clip)
  )
    return { phase: g.phase };
  if ((FAMILIES.climb as readonly string[]).includes(clip)) return { phase: g.climbPhase };
  if (clip === 'turn') return { phase: g.turnPhase };
  if (clip === 'roll') return { phase: g.rollPhase };
  if (clip === 'flip' || clip === 'land') return { seconds: g.gesture?.clip === clip ? g.gesture.time : 0 };
  return { seconds: g.clock };
}
