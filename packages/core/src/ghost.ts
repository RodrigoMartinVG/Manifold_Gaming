import { quat, vec3, type Vec3 } from '@manifold/common';
import { degreesOf, direction } from './input';
import type { Character, EntityId, ModeName } from './types';
import type { World } from './world';

/**
 * A GHOST AS A STRIP OF POSES (stage 4.5c, decision 0025): what a character did, as where it was, where
 * it looked and how it moved, every few steps; not the inputs that made it. A replay, by its inputs,
 * plays only on the simulation that recorded it (and is checked against its hash); a strip of poses is
 * drawn on any, checked against nothing: a ghost to race, which a new version of the engine does not
 * break, and which needs no second world simulated beside the live one (it is drawn, not run).
 *
 * Quantized: positions to the centimeter, where it looks to a tenth of a degree, its way of moving by
 * name; each pose after the first as how much what changed changed (its second difference, in its own
 * units: whole numbers). Walking straight, or falling, that is the same line again and again, and a
 * link's deflate makes little of it: a minute of running about first took 4.2 KB with what changed
 * alone (the open question's budget was 2). As text:
 *
 *   # Manifold ghost 1
 *   game dojo
 *   birth seed 1                 the room it was recorded in (a replay's birth: a recipe)
 *   birth dojo.level course
 *   every 6                      steps between two poses
 *   pose -500 82 600 0 walk      the first: x y z in cm, where it looks in tenths of a degree, its mode
 *   0 0 -30 0                    each next: how much what changed changed (and its mode, if it changed)
 *   0 0 0 2
 *   end 1840                     the step it ends at (if off the grid, its last pose is there)
 */
export const GHOST_HEADER = '# Manifold ghost';
/** The strip's own format (not the simulation's version: a strip outlives those). */
export const GHOST_FORMAT = 1;
/**
 * Steps between two poses: ten a second. Between two, a straight line strays from a jump's arc by at
 * most g t² / 8, 1.2 cm, cuts a sharp dodge's corner by at most v t / 2, 22 cm, and the body's turn is
 * drawn eased anyway. Measured, a minute of running about in a link's deflate: every 4 steps (the open
 * question's proposal), 2.7 KB; every 6, 2.3; every 8, 2.0, cutting corners by 30 cm (decision 0025).
 */
export const GHOST_EVERY = 6;

const MODES: readonly ModeName[] = ['walk', 'air', 'glide', 'climb', 'crouch', 'roll', 'block'];

/** A pose of a strip: where (m), where it looks (degrees from forward, −Z, towards the right) and how it moves. */
export interface GhostPose {
  position: Vec3;
  yaw: number;
  mode: ModeName;
}

export interface Ghost {
  game: string;
  birth: string;
  every: number;
  /** One every `every` steps, from step 0. */
  poses: GhostPose[];
  end: number;
}

/** A pose, quantized: centimeters, tenths of a degree. */
interface Quantized {
  x: number;
  y: number;
  z: number;
  yaw: number;
  mode: ModeName;
}

// (`|| 0`: a little negative number rounds to −0, written "0" and read back as +0, other bits.)
const quantize = (p: GhostPose): Quantized => ({
  x: Math.round(p.position[0] * 100) || 0,
  y: Math.round(p.position[1] * 100) || 0,
  z: Math.round(p.position[2] * 100) || 0,
  yaw: ((Math.round(p.yaw * 10) % 3600) + 3600) % 3600,
  mode: p.mode,
});
const back = (q: Quantized): GhostPose => ({ position: [q.x / 100, q.y / 100, q.z / 100], yaw: q.yaw / 10, mode: q.mode });

/** Where a character looks, in degrees from forward (−Z) towards the right, to a tenth. */
export const yawOf = (c: Pick<Character, 'facing'>): number => degreesOf(c.facing[0], c.facing[2], 0.1);

/**
 * RECORDING ONE: the pose of a world's player every `every` steps, from the step it is at when asked.
 * (The page asks after every step; a test, as it likes.)
 */
export class GhostRecorder {
  readonly poses: GhostPose[] = [];
  /** The player's latest pose, every step (the strip's last one, where it ended: stage 4.5's close). */
  private latest: { tick: number; pose: GhostPose } | null = null;
  private id: EntityId | null = null;
  constructor(readonly every = GHOST_EVERY) {}

  /** After a step: the player's pose, kept if the step is one of the strip's. */
  record(world: World, player: number) {
    let e = this.id === null ? undefined : world.entities.get(this.id);
    if (e?.character?.player !== player) {
      e = [...world.entities.values()].find((x) => x.character?.player === player);
      this.id = e?.id ?? null;
    }
    if (!e?.character || !e.transform) return;
    const pose = { position: [...e.transform.position] as Vec3, yaw: yawOf(e.character), mode: e.character.mode };
    this.latest = { tick: world.tick, pose };
    if (world.tick % this.every !== 0) return;
    const at = world.tick / this.every;
    // (Born at step 0 or joined later: the poses before it are where it first was.)
    while (this.poses.length < at) this.poses.push(pose);
    this.poses[at] = pose;
  }

  /**
   * The strip, to step `end`; its last pose where the player was then, if that is between two of the
   * strip's (stage 4.5's close: the ghost stopped up to five steps short, 45 cm walking).
   */
  ghost(game: string, birth: string, end: number): Ghost {
    const lines = birth
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l);
    const poses = this.poses.map((p) => back(quantize(p)));
    if (this.latest?.tick === end && end % this.every !== 0) poses.push(back(quantize(this.latest.pose)));
    return { game, birth: lines.join('\n'), every: this.every, poses, end };
  }
}

/** A strip as text (see above): what changed from pose to pose, in whole numbers. */
export function ghostToText(g: Ghost): string {
  const lines = [`${GHOST_HEADER} ${GHOST_FORMAT}`, `game ${g.game}`];
  for (const line of g.birth.split('\n').filter((l) => l.trim())) lines.push(`birth ${line}`);
  lines.push(`every ${g.every}`);
  let last: Quantized | null = null;
  let was = [0, 0, 0, 0];
  for (const p of g.poses) {
    const q = quantize(p);
    if (!last) lines.push(`pose ${q.x} ${q.y} ${q.z} ${q.yaw} ${q.mode}`);
    else {
      let turn = q.yaw - last.yaw;
      if (turn > 1800) turn -= 3600;
      if (turn <= -1800) turn += 3600;
      const now = [q.x - last.x, q.y - last.y, q.z - last.z, turn];
      lines.push(`${now.map((d, k) => d - was[k]!).join(' ')}${q.mode === last.mode ? '' : ` ${q.mode}`}`);
      was = now;
    }
    last = q;
  }
  lines.push(`end ${g.end}`);
  return lines.join('\n') + '\n';
}

/** Back from text. A line that is not understood is an error, with its number. */
export function ghostFromText(text: string): Ghost {
  const lines = text.split('\n');
  const fail = (n: number, why: string): never => {
    throw new Error(`the ghost's line ${n + 1}: ${why}`);
  };
  const head = /^# Manifold ghost (\d+)$/.exec(lines[0]?.trim() ?? '');
  if (!head) fail(0, `it does not start with "${GHOST_HEADER}"`);
  if (Number(head![1]) > GHOST_FORMAT) fail(0, `format ${head![1]} is newer than this engine's (${GHOST_FORMAT})`);
  const g: Ghost = { game: '', birth: '', every: GHOST_EVERY, poses: [], end: 0 };
  const birth: string[] = [];
  let last: Quantized | null = null;
  let was = [0, 0, 0, 0];
  const int = (n: number, s: string | undefined) => {
    if (s === undefined || !/^-?\d+$/.test(s)) fail(n, `"${s ?? ''}" is not a whole number`);
    return Number(s);
  };
  const mode = (n: number, s: string | undefined, was: ModeName | null): ModeName => {
    if (s === undefined) return was ?? fail(n, 'its way of moving is missing');
    if (!(MODES as readonly string[]).includes(s)) fail(n, `"${s}" is not a way of moving`);
    return s as ModeName;
  };
  for (let n = 1; n < lines.length; n++) {
    const line = lines[n]!.trim();
    if (!line) continue;
    const words = line.split(/\s+/);
    if (words[0] === 'game') g.game = words[1] ?? '';
    else if (words[0] === 'birth') birth.push(line.slice('birth '.length));
    else if (words[0] === 'every') g.every = Math.max(1, int(n, words[1]));
    else if (words[0] === 'end') g.end = int(n, words[1]);
    else if (words[0] === 'pose') {
      last = {
        x: int(n, words[1]),
        y: int(n, words[2]),
        z: int(n, words[3]),
        yaw: int(n, words[4]),
        mode: mode(n, words[5], null),
      };
      g.poses.push(back(last));
    } else {
      if (!last) fail(n, 'a change before its first pose');
      const now = [0, 1, 2, 3].map((k) => was[k]! + int(n, words[k]));
      was = now;
      const q: Quantized = {
        x: last!.x + now[0]!,
        y: last!.y + now[1]!,
        z: last!.z + now[2]!,
        yaw: (((last!.yaw + now[3]!) % 3600) + 3600) % 3600,
        mode: mode(n, words[4], last!.mode),
      };
      g.poses.push(back(q));
      last = q;
    }
  }
  g.birth = birth.join('\n');
  return g;
}

/**
 * WHERE A GHOST IS at a step (with its fraction): along a curve through its poses (stage 5d; before,
 * the straight line between the two around it), looking by the shorter way round between theirs; its
 * way of moving, the earlier one's. Pose k is at step k × every, the last one at the strip's end if
 * that comes first (where the player ended, between two of the strip's steps; an older strip has none
 * there, and reads as it did). Past its end, its last pose.
 *
 * The curve, between poses p₁ (at step t₁) and p₂ (at t₂): a cubic (Hermite's) that passes through
 * both with the velocity of its neighbours there, m₁ = (p₂ − p₀)/(t₂ − t₀) and m₂ = (p₃ − p₁)/(t₃ − t₁)
 * (past an end, the pose reflected: p₀ = 2p₁ − p₂). With u = (t − t₁)/h, h = t₂ − t₁,
 *
 *     p(u) = (2u³ − 3u² + 1) p₁ + (u³ − 2u² + u) h m₁ + (−2u³ + 3u²) p₂ + (u³ − u²) h m₂.
 *
 * Moving at one velocity, it is the straight line (both m are the chord's); a jump's parabola, sampled
 * at equal steps, it draws exactly (the neighbours' differences are its velocity at the middle pose).
 * A span longer than any motion covers (`LEAP`: put back at a checkpoint, a teleport) is not a motion:
 * the ghost is at the first pose for its first half and at the second for the rest (when within it the
 * leap was, the strip does not say: halfway, at most half a span off), and no curve takes a neighbour
 * across it (it would swing wide: over a minute of the circuit with its falls, the curve was further
 * off than the straight lines).
 */
export function ghostAt(g: Ghost, step: number): GhostPose | null {
  if (g.poses.length === 0) return null;
  const last = g.poses.length - 1;
  const when = (k: number) => (g.end > 0 ? Math.min(k * g.every, g.end) : k * g.every);
  const s = Math.max(0, step);
  const i = Math.min(last, Math.floor(s / g.every));
  const a = g.poses[i]!;
  const b = g.poses[Math.min(last, i + 1)]!;
  const t1 = when(i);
  const t2 = when(Math.min(last, i + 1));
  const h = t2 - t1;
  const u = h > 0 ? Math.min(1, (s - t1) / h) : 1;
  let turn = b.yaw - a.yaw;
  if (turn > 180) turn -= 360;
  if (turn < -180) turn += 360;
  const yaw = (((a.yaw + turn * u) % 360) + 360) % 360;
  if (h <= 0) return { position: [...b.position], yaw, mode: a.mode };
  const far = (p: Vec3, q: Vec3) => vec3.length(vec3.sub(p, q)) > LEAP;
  if (far(a.position, b.position)) return { position: [...(u < 0.5 ? a.position : b.position)], yaw, mode: a.mode };
  // The neighbours, and their steps: past an end or a leap, the pose and its step reflected.
  const p0 = i > 0 ? g.poses[i - 1]!.position : null;
  const p3 = i + 2 <= last ? g.poses[i + 2]!.position : null;
  const near0 = p0 !== null && !far(p0, a.position);
  const near3 = p3 !== null && !far(p3, b.position);
  const before = near0 ? p0 : vec3.sub(vec3.scale(a.position, 2), b.position);
  const t0 = near0 ? when(i - 1) : t1 - h;
  const after = near3 ? p3 : vec3.sub(vec3.scale(b.position, 2), a.position);
  const t3 = near3 ? when(i + 2) : t2 + h;
  const m1 = vec3.scale(vec3.sub(b.position, before), 1 / (t2 - t0));
  const m2 = vec3.scale(vec3.sub(after, a.position), 1 / (t3 - t1));
  const u2 = u * u;
  const u3 = u2 * u;
  const position = vec3.add(
    vec3.add(vec3.scale(a.position, 2 * u3 - 3 * u2 + 1), vec3.scale(m1, (u3 - 2 * u2 + u) * h)),
    vec3.add(vec3.scale(b.position, -2 * u3 + 3 * u2), vec3.scale(m2, (u3 - u2) * h)),
  );
  return { position, yaw, mode: a.mode };
}

/** A span between two poses longer than any motion covers in it (m): a leap, not a motion (`ghostAt`). */
export const LEAP = 3;

/** Where a pose looks, as a direction on the ground (length 1), and its body's turn about +Y. */
export const ghostFacing = (p: GhostPose): Vec3 => direction(p.yaw);
export const ghostTurn = (p: GhostPose) => quat.look(ghostFacing(p), [0, 1, 0]);
