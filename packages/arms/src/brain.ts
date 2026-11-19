import { cellAt, findPath, inZone, navOf, type Step } from '@manifold/bots';
import { vec3, type Vec3 } from '@manifold/common';
import {
  CHARACTER_GAP,
  eyeHeightOf,
  shotDice,
  type Brain,
  type Entity,
  type EntityId,
  type Memory,
  type PlayerInput,
  type World,
} from '@manifold/core';
import { gunnerOf, GUARD_BRAIN, type Fair, type Gunner } from './guard';
import { ATTACK, raised, READY, weapon } from './weapons';
import { noticeOf, SHOUT_INPUT, STEALTH, wary } from './stealth';

/**
 * THE GUARD'S BRAIN (stage 4e, decision 0023): it runs where the match is hosted, once, and asks for
 * what a player would (to walk, to look, to press `use`, to strike with its stick). What it senses is
 * the simulation's: who its eyes see (a watcher on its body, by the light: 3d; a crouching player, with
 * less), the sounds within their radius (3f: steps, the lift, a door, a hit). What it decides:
 *
 *   - patrol: along its route, there and back (or round), from point to point;
 *   - look: a sound it heard, it stops and turns to it for a moment (listening), then walks to where it
 *     came from, and looks around for two seconds;
 *   - chase: someone it sees, it goes after; within reach of its stick, it strikes; with a dart, a bolt or
 *     (stage 5h) a shotgun, it stands and shoots, within its range;
 *   - search: whoever it lost, it goes to where it saw them last, and looks around.
 *
 * Its way is the navigation's (4d): when a door or the lift is not as its path needs, the path goes to
 * the button or the plate first, and it waits there until the mechanism is as needed; on the lift, until
 * it is up. Its memory is plain data the host keeps.
 *
 * (Stage 5l) An aware guard (its wariness has `aware`) does not go after whoever it glimpses: what it has
 * noticed is the world's (`noticing`, stealth.ts), and it acts on it. Calm, it keeps its round; suspicious
 * and seeing them, it stops and stares; suspicious and no longer seeing them, it goes to look where it
 * saw them (as to a sound); alerted, it gives chase as before (and shouts); searching, it goes to where
 * it saw them last and looks round.
 */

type Mode = 'patrol' | 'look' | 'chase' | 'search';

/** A path being followed: its steps, the next one, where it goes, when it was planned. */
interface Plan {
  steps: Step[];
  next: number;
  to: Vec3;
  made: number;
  changes: { signal: string; value: number; zone: string }[];
}

export interface GuardMemory extends Memory {
  mode: Mode;
  /** Its route's next point, and which way it goes along it. */
  waypoint: number;
  forward: boolean;
  goal: Vec3 | null;
  heard: { at: Vec3; tick: number } | null;
  seen: { id: number; at: Vec3; tick: number } | null;
  plan: Plan | null;
  /** When it got to where it went to look (it looks around for a while), or −1. */
  arrived: number;
  /** When it last pressed `use`, and its stick's press (pressed one step, let go the next). */
  used: number;
  swing: boolean;
  /** (Stage 4g) Since when it sees whoever it shoots at, and when it last shot; where it aims, following them. */
  sighted: number;
  shot: number;
  aim?: Vec3 | null;
  /** When a player last hit it (it is on its guard: it shoots whoever it sees at once). */
  alert?: number;
  /**
   * (Stage 4.5f) Where it last found no way to, and when: not asked again until it goes somewhere
   * else or a while has passed (in the citadel a guard asked every step, for a sound behind a shut gate).
   */
  nowhere?: { to: Vec3; tick: number } | null;
  /** (Stage 5e, a wary guard) Each lamp it saw, by id, and whether it was lit; the one it goes to light again; the guards down it found. */
  lamps?: Record<string, boolean>;
  relight?: number | null;
  downs?: number[];
  /**
   * (Stage 5f, a wary guard with no route) Its post: where it stood when it started, and the way it
   * faced. Back from looking or searching, it goes there and faces that way again (a guard of 4e with no
   * route stays where it ended: the Dojo's recorded games keep their hashes).
   */
  post?: { at: Vec3; facing: Vec3 } | null;
  /** (Stage 5i, a fair gunner) When it last flinched from a hit, and how many shots since it last saw them. */
  flinch?: number;
  shots?: number;
  /** (Stage 5l, an aware guard) Which sighting it went to look at, suspicious; which search it went on. */
  investigated?: number;
  searched?: number;
}

/** How near a point it must be to have reached it (m, along the ground); within its stick's reach (m, to the other's center). */
const NEAR = 0.35;
const REACH = 1.5;
/** How long it listens, turned to a sound, before it goes to look (steps). */
const LISTEN = 45;
/**
 * With a dart or a bolt (stage 4g): how long it takes to see you, how often it shoots, how its aim
 * follows and how far it shoots are the room's (`gunnerOf`, rules.ts: why those numbers is there);
 * nearer than `CLOSE` (m) it steps back as it shoots.
 */
const CLOSE = 4;
/** (Stage 5h) How near a guard with a shotgun shoots (m): beyond it, it comes nearer. */
const SHOTGUN_RANGE = 8;
/** How long out of sight it still counts as seeing them, for its time to shoot and its aim (steps). */
const GLIMPSE = 30;
/** How long it chases whoever it no longer sees (steps), looks around where it went to look, and keeps a plan before planning again. */
const LOSE = 180;
const LOOK = 120;
const REPLAN = 90;

const flat = (a: Vec3, b: Vec3) => Math.sqrt((a[0] - b[0]) * (a[0] - b[0]) + (a[2] - b[2]) * (a[2] - b[2]));
const toward = (from: Vec3, to: Vec3): Vec3 => {
  const d = flat(from, to);
  return d < 1e-6 ? [0, 0, 0] : [(to[0] - from[0]) / d, 0, (to[2] - from[2]) / d];
};

/** Where its feet are (the capsule's bottom, under its center). */
const feetOf = (e: Entity): Vec3 => {
  const p = e.transform!.position;
  const shape = e.body?.shape;
  const below = shape?.kind === 'capsule' ? shape.halfHeight + shape.radius + CHARACTER_GAP : 0.82;
  return [p[0], p[1] - below, p[2]];
};

/** The ground under a point (of what a program moves too: the lift), if there is any within 3 m below it. */
function groundAt(world: World, at: Vec3, self: Entity): number | null {
  const hit = world.castRay([at[0], at[1] + 1.5, at[2]], [0, -1, 0], 4.5, { skip: self.id, characters: false, dynamic: false });
  return hit ? hit.point[1] : null;
}

/** The players' characters it could go after: no brain of their own, standing. */
const isPlayer = (e: Entity | undefined): e is Entity =>
  e !== undefined && !!e.character && !e.brain && e.character.player >= 1 && (e.health?.down ?? -1) < 0;

/**
 * WHETHER A GUARD SEES A POINT (stage 5e): within its eyes' range and field of view, nothing in the way
 * (what is there itself, a lamp's body, within half a meter of it, does not count).
 */
function inSight(world: World, self: Entity, at: Vec3): boolean {
  const w = self.watcher;
  if (!w || !self.transform || !self.character || !self.body) return false;
  const eye = vec3.add(self.transform.position, [0, eyeHeightOf(self.character, self.body), 0]);
  const to = vec3.sub(at, eye);
  const d = vec3.length(to);
  if (d > w.range || d < 1e-6) return d < 1e-6;
  const dir = vec3.scale(to, 1 / d);
  if (vec3.dot(dir, self.character.facing) < w.cone) return false;
  const hit = world.castRay(eye, dir, d, { skip: self.id, characters: false });
  return !hit || hit.distance > d - 0.5;
}

/**
 * THE GUARD'S BRAIN, WARY (stage 5e): what a guard its game made wary (`arms.wary`) adds to the guard's.
 * A lamp it saw lit and now sees put out, it goes to (as to a sound) and lights again; a guard down it
 * sees, it goes to look round; the moment it starts after someone, it shouts (the wary ones near hear
 * it); with no route, it keeps a post (stage 5f). Without it, the guard's, as in stage 4e: the Dojo's do
 * not change.
 */
export const guardBrain: Brain = (world, self, memory) => {
  const m = memory as GuardMemory;
  const w = wary(self);
  if (!w || (self.health?.down ?? -1) >= 0 || !self.transform) return guardBrain4e(world, self, memory);
  m.lamps ??= {};
  m.downs ??= [];
  m.relight ??= null;
  m.post ??= self.brain?.route ? null : { at: feetOf(self), facing: [...self.character!.facing] };
  const before = m.mode;
  // (Stage 5l) What it noticed: whom it may go after (only once alerted, or searching), and what it does short of that.
  const n = w.aware ? noticeOf(self) : undefined;
  let after: readonly EntityId[] | undefined;
  if (w.aware) {
    const seeing = (self.watcher?.sees ?? []).filter((id) => isPlayer(world.entities.get(id)));
    after = n && (n.state === 'alerted' || n.state === 'searching') ? seeing : [];
    const at = n && n.at.length === 3 ? (n.at as Vec3) : null;
    if (n?.state === 'suspicious' && at) {
      if (seeing.length > 0) return { face: toward(self.transform.position, at) };
      if (m.investigated !== n.seen) {
        m.investigated = n.seen;
        m.heard = { at: [...at], tick: world.tick };
      }
    }
    if (n?.state === 'searching' && at && m.mode === 'patrol' && m.searched !== n.since) {
      m.searched = n.since;
      m.heard = { at: [...at], tick: world.tick };
    }
  }
  for (const l of world.entities.values()) {
    if (!l.lamp || !l.transform || !inSight(world, self, l.transform.position)) continue;
    const was = m.lamps[String(l.id)];
    if (w.relight && was === true && l.lamp.out && !l.breakable?.broken && m.relight === null) {
      m.relight = l.id;
      m.heard = { at: [...l.transform.position], tick: world.tick };
    }
    m.lamps[String(l.id)] = l.lamp.on;
  }
  if (w.notice)
    for (const g of world.entities.values()) {
      if (g === self || !g.brain || (g.health?.down ?? -1) < 0 || !g.transform || m.downs.includes(g.id)) continue;
      if (!inSight(world, self, g.transform.position)) continue;
      m.downs.push(g.id);
      m.heard = { at: [...g.transform.position], tick: world.tick };
    }
  const input = guardBrain4e(world, self, memory, after);
  // At the lamp it goes to light again (not while it is after someone): a hand on it.
  const lamp = m.relight === null ? undefined : world.entities.get(m.relight);
  if (lamp?.transform && lamp.lamp && m.mode !== 'chase') {
    const to = vec3.sub(lamp.transform.position, self.transform.position);
    if (Math.hypot(to[0], to[2]) <= STEALTH.lamp - 0.3 && world.tick - m.used > 2) {
      m.used = world.tick;
      m.relight = null;
      return { ...input, use: true };
    }
  } else if (!lamp?.lamp?.out) m.relight = null;
  return w.shout && m.mode === 'chase' && before !== 'chase' ? { ...input, [SHOUT_INPUT]: true } : input;
};

/**
 * A FAIR SHOT (stage 5i; `Fair`, guard.ts, says why each number): within `range`, the gunner aims where its
 * target was `lag` steps before, its aim following at its pace; once it has seen them long enough, its
 * weapon is ready, it did not just flinch and a token is free, it raises its weapon (`arms.ready`, seen
 * and heard); held `windup` steps, it shoots, with an error from the shot's own dice (wide when it first
 * saw them, narrowing over 36 steps), the first shot after a sighting passing `miss` meters to a side.
 * Beyond its range, nothing (`null`): it goes after them as before.
 */
function fairShot(
  world: World,
  self: Entity,
  m: GuardMemory,
  target: Entity,
  gunner: Readonly<Gunner>,
  fair: Fair,
  range: number,
): PlayerInput | null {
  const c = self.character!;
  const center = self.transform!.position;
  const p = target.transform!.position;
  const v = target.character?.velocity ?? [0, 0, 0];
  const behind: Vec3 = [p[0] - (v[0] * fair.lag) / 60, p[1] - (v[1] * fair.lag) / 60, p[2] - (v[2] * fair.lag) / 60];
  if (m.sighted < 0 || !m.aim) {
    m.sighted = world.tick;
    m.aim = [...behind];
    m.shots = 0;
  }
  const aim = (m.aim = [
    m.aim[0] + (behind[0] - m.aim[0]) * gunner.aim,
    m.aim[1] + (behind[1] - m.aim[1]) * gunner.aim,
    m.aim[2] + (behind[2] - m.aim[2]) * gunner.aim,
  ]);
  const to = vec3.sub(aim, [center[0], center[1] + eyeHeightOf(c, self.body!), center[2]]);
  const along = Math.hypot(to[0], to[2]);
  if (along > range) return null;
  const face = toward(center, aim);
  const pitch = (Math.atan2(to[1], along) * 180) / Math.PI / 90;
  const flinched = world.tick - (m.flinch ?? -Infinity) < fair.flinch;
  const up = raised(self);
  if (!up) {
    const w = weapon(self)!;
    const start =
      world.tick - m.sighted >= gunner.see &&
      !flinched &&
      world.tick >= w.ready &&
      world.tick - m.shot >= gunner.every &&
      tokenFree(world, self, target, fair.tokens);
    const back: Vec3 = along < CLOSE ? [-face[0], 0, -face[2]] : [0, 0, 0];
    return { face, pitch, move: back, ...(start ? { [READY]: true } : {}) };
  }
  // Hit while raised, it lowers it (and raises it again once it has its aim back).
  if (flinched) return { face, pitch, move: [0, 0, 0] };
  if (world.tick - up.since < fair.windup) return { face, pitch, move: [0, 0, 0], [READY]: true };
  // The shot. Its error: degrees across and up, from its own dice (another number than the weapon's own).
  const dice = shotDice(world, c.player, 0x5f1);
  const widen = 1 + 2 * Math.max(0, 1 - (world.tick - m.sighted) / 36);
  let across = (2 * dice.next() - 1) * fair.spread * widen;
  const lift = (2 * dice.next() - 1) * fair.spread * widen * 0.5;
  if ((m.shots ?? 0) === 0) across += (dice.next() < 0.5 ? -1 : 1) * ((Math.atan2(fair.miss, along) * 180) / Math.PI);
  m.shots = (m.shots ?? 0) + 1;
  m.shot = world.tick;
  const turn = (across * Math.PI) / 180;
  const [s, k] = [Math.sin(turn), Math.cos(turn)];
  return {
    face: [face[0] * k - face[2] * s, 0, face[0] * s + face[2] * k],
    pitch: pitch + lift / 90,
    move: [0, 0, 0],
    [ATTACK]: true,
  };
}

/**
 * WHETHER A TOKEN IS FREE (stage 5i): at most `tokens` fair gunners raised at once against the same target.
 * Of those that see them and could raise theirs, the lowest ids go first: every brain counts the same
 * world (who sees whom, whose weapon is raised or ready), so two never take the last token at one step.
 */
function tokenFree(world: World, self: Entity, target: Entity, tokens: number): boolean {
  let up = 0;
  const wanting: number[] = [];
  for (const e of world.entities.values()) {
    if (!e.brain || !e.character || (e.health?.down ?? -1) >= 0 || !e.watcher?.sees.includes(target.id)) continue;
    if (raised(e)) up++;
    else if (gunnerOf(e).fair && world.tick >= (weapon(e)?.ready ?? Infinity)) wanting.push(e.id);
  }
  wanting.sort((a, b) => a - b);
  const rank = wanting.indexOf(self.id);
  return rank >= 0 && rank < tokens - up;
}

/** The guard's brain, as stage 4e made it. */
/** The guard's brain of stage 4e; (5l) whom it may go after among those its eyes see, if its caller says (an aware guard: only once alerted). */
const guardBrain4e = (world: World, self: Entity, memory: Memory, after?: readonly EntityId[]): PlayerInput => {
  const m = memory as GuardMemory;
  if (m.mode === undefined)
    Object.assign(m, {
      mode: 'patrol',
      waypoint: 0,
      forward: true,
      goal: null,
      heard: null,
      seen: null,
      plan: null,
      arrived: -1,
      used: -1000,
      swing: false,
      sighted: -1,
      shot: -1000,
      aim: null,
      alert: -1000,
    } satisfies GuardMemory);
  const c = self.character!;
  if ((self.health?.down ?? -1) >= 0) {
    m.plan = null;
    m.mode = 'patrol';
    return {};
  }
  const center = self.transform!.position;
  const feet = feetOf(self);

  // What it senses: who its eyes see now; what it hears. Where, on the ground a body walks (the
  // navigation's: a door creaks a meter up, a lift hums at its middle).
  const nav = navOf(world);
  const ground = (p: Vec3): Vec3 => (nav.reason ? p : (cellAt(nav, p)?.at ?? p));
  const target = (after ?? self.watcher?.sees ?? []).map((id) => world.entities.get(id)).find(isPlayer);
  if (target) m.seen = { id: target.id, at: [...feetOf(target)], tick: world.tick };
  // (A door or a lift it is working itself, or that moves right by it, it does not go to look at: it knows.)
  const working = (m.plan?.changes.length ?? 0) > 0 || world.tick - m.used < 60;
  for (const ev of world.stepEvents) {
    if (ev.type !== 'sound' || ev.source === self.id) continue;
    // (Another guard's sounds it does not mind; a wary one, its shout: stage 5e.)
    if (world.entities.get(ev.source)?.brain && !(ev.sound === 'arms.shout' && wary(self))) continue;
    const mechanism = ev.sound === 'door' || ev.sound === 'lift';
    if (mechanism && (working || vec3.length(vec3.sub(ev.at, center)) < 3)) continue;
    if (vec3.length(vec3.sub(ev.at, center)) <= ev.radius) m.heard = { at: [...ev.at], tick: world.tick };
  }
  // Hit (stage 4g): it knows where from, as if it had seen who did it.
  for (const ev of world.stepEvents) {
    const by = ev.type === 'hurt' && ev.target === self.id && ev.from !== null ? world.entities.get(ev.from) : undefined;
    if (isPlayer(by)) {
      m.seen = { id: by.id, at: [...feetOf(by)], tick: world.tick };
      m.alert = world.tick;
      // (Stage 5i) A fair gunner flinches: its weapon down, and its aim as wide as when it first saw them.
      if (gunnerOf(self).fair) {
        m.flinch = world.tick;
        m.sighted = world.tick;
      }
    }
  }
  // Whoever it was after is down: it lets them go, back to its rounds. (It went to stand where they
  // fell, and the arena's player came back to find the guards waiting.)
  if (m.seen && (world.entities.get(m.seen.id)?.health?.down ?? -1) >= 0) {
    m.seen = null;
    if (m.mode === 'chase' || m.mode === 'search') {
      m.mode = 'patrol';
      m.plan = null;
    }
  }

  // What it does about it.
  const route = self.brain?.route ? world.named(self.brain.route)?.route : undefined;
  const lost = m.seen === null || world.tick - m.seen.tick > LOSE;
  if (target || (m.seen && m.seen.tick === world.tick)) m.mode = 'chase';
  else if (m.mode === 'chase' && lost) m.mode = 'search';
  if (m.mode !== 'chase' && m.heard && m.heard.tick === world.tick) {
    m.mode = 'look';
    m.arrived = -1;
  }
  if (m.mode === 'chase') m.goal = m.seen!.at;
  // (Where it heard it, on the ground a body walks: asked when it goes there, not when it heard it, since
  // the navigation may still be being built then: stage 4.5a found a guard sent into the air.)
  else if (m.mode === 'look') m.goal = ground(m.heard!.at);
  else if (m.mode === 'search') m.goal = m.seen?.at ?? null;
  else m.goal = route ? route.points[m.waypoint % route.points.length]! : (m.post?.at ?? null);

  // With a dart or a bolt (stage 4g), whoever it sees and is near enough it shoots at, standing (after a
  // moment to see them), from its eyes, aiming at their middle; too near, it steps back as it shoots.
  const kind = weapon(self)?.kind;
  // (Stage 5n: and the orb, an attacker's.)
  if (target && (kind === 'dart' || kind === 'bolt' || kind === 'shotgun' || kind === 'orb')) {
    const gunner = gunnerOf(self);
    const { see, every, aim: follow } = gunner;
    // (Stage 5h) With a shotgun, only near: its pellets spread (at ten meters one or two strike).
    const range = kind === 'shotgun' ? Math.min(gunner.range, SHOTGUN_RANGE) : gunner.range;
    // (Stage 5i) A fair gunner: within its range, it raises its weapon and shoots as `fairShot` says.
    // (Stage 5n) A fair gunner fires only as `fairShot` says: out of its range there, it goes after them. (It
    // fell through to the shots below, whose range is measured from a smoothed aim: at the edge, 18 m, the
    // wall walk's start, one fired with no weapon raised.)
    const fair = gunner.fair ? fairShot(world, self, m, target, gunner, gunner.fair, range) : null;
    if (fair) return fair;
    const p = target.transform!.position;
    if (m.sighted < 0 || !m.aim) {
      m.sighted = world.tick;
      m.aim = [...p];
    }
    const aim = (m.aim = [
      m.aim[0] + (p[0] - m.aim[0]) * follow,
      m.aim[1] + (p[1] - m.aim[1]) * follow,
      m.aim[2] + (p[2] - m.aim[2]) * follow,
    ]);
    const to = vec3.sub(aim, [center[0], center[1] + eyeHeightOf(c, self.body!), center[2]]);
    const along = Math.hypot(to[0], to[2]);
    if (along <= range && !gunner.fair) {
      const face = toward(center, aim);
      const pitch = (Math.atan2(to[1], along) * 180) / Math.PI / 90;
      // (Hit a moment ago, it is on its guard: it does not take its time to see them.)
      const ready = world.tick - m.sighted >= see || world.tick - (m.alert ?? -Infinity) <= LOSE;
      const fire = ready && world.tick - m.shot >= every;
      if (fire) m.shot = world.tick;
      const back: Vec3 = along < CLOSE ? [-face[0], 0, -face[2]] : [0, 0, 0];
      return { face, pitch, move: back, ...(fire ? { [ATTACK]: true } : {}) };
    }
  } else if (world.tick - (m.seen?.tick ?? -Infinity) > GLIMPSE) {
    // Out of sight for more than a moment, it will take its time to see them again. (A step lost
    // behind cover's edge started its time over: a first version shot only those it saw unbroken.)
    m.sighted = -1;
    m.aim = null;
    m.shots = 0;
  }
  // A sound just heard: it turns to it and listens a moment before it goes.
  if (m.mode === 'look' && m.heard && world.tick - m.heard.tick < LISTEN) return { face: toward(center, m.heard.at) };
  // Within reach of whoever it chases: it faces them and strikes (a press, then a release); while they
  // swing at it, it blocks (stage 4f).
  if (m.mode === 'chase' && target && vec3.length(vec3.sub(target.transform!.position, center)) <= REACH) {
    const face = toward(center, target.transform!.position);
    if ((weapon(target)?.strike ?? 0) > 0) return { face, block: true };
    m.swing = !m.swing;
    return { face, [ATTACK]: m.swing };
  }
  if (!m.goal) return {};

  // Got there: patrolling, on to the next point; looking or searching, it looks around, then goes back.
  if (flat(feet, m.goal) <= 0.8 && Math.abs(feet[1] - m.goal[1]) < 1) {
    if (m.mode === 'patrol' && route) {
      const n = route.points.length;
      if (route.loop) m.waypoint = (m.waypoint + 1) % n;
      else {
        if (m.waypoint + 1 >= n) m.forward = false;
        else if (m.waypoint <= 0) m.forward = true;
        m.waypoint += m.forward ? 1 : -1;
      }
      m.plan = null;
    } else if (m.mode === 'look' || m.mode === 'search') {
      if (m.arrived < 0) m.arrived = world.tick;
      if (world.tick - m.arrived >= LOOK) {
        m.mode = 'patrol';
        m.arrived = -1;
        m.plan = null;
      }
      // Looking around: a quarter turn every half second.
      const k = Math.floor((world.tick - m.arrived) / 30) % 4;
      return {
        face: [
          [1, 0, 0],
          [0, 0, 1],
          [-1, 0, 0],
          [0, 0, -1],
        ][k] as Vec3,
      };
    }
    // At its post (a wary guard with no route, stage 5f): facing the way it faced.
    return m.mode === 'patrol' && m.post ? { face: m.post.facing } : {};
  }

  // Its way there: planned again when it goes somewhere else, or after a while (not while it waits by a
  // button or on the lift).
  const waiting = m.plan && ['use', 'stand', 'ride'].includes(m.plan.steps[m.plan.next]?.kind ?? '');
  if (!waiting && (!m.plan || flat(m.plan.to, m.goal) > 1.5 || world.tick - m.plan.made > REPLAN)) {
    const lost = !!m.nowhere && flat(m.nowhere.to, m.goal) <= 1.5 && world.tick - m.nowhere.tick < REPLAN;
    const path = nav.reason || lost ? null : findPath(world, nav, center, m.goal, { can: c.can, depth: 2 });
    if (!path) {
      m.plan = null;
      if (!nav.reason && !lost) m.nowhere = { to: [...m.goal], tick: world.tick };
      // Nowhere to go from here (off the navigation, or no way): straight at it.
      return { move: toward(feet, m.goal), run: m.mode === 'chase' };
    }
    m.nowhere = null;
    m.plan = {
      steps: path.steps,
      next: 1,
      to: [...m.goal],
      made: world.tick,
      changes: path.changes.map((ch) => ({ signal: ch.signal, value: ch.value, zone: ch.way.zone })),
    };
    // (It may start a little off its first cell: on from the one nearest it.)
    const here = cellAt(nav, center);
    if (here && flat(here.at, path.steps[0]!.at) > NEAR) m.plan.next = 0;
  }
  return follow(world, self, m, feet);
};

/** One step along its plan: towards its next point, or what that point asks for. */
function follow(world: World, self: Entity, m: GuardMemory, feet: Vec3): PlayerInput {
  const plan = m.plan!;
  const run = m.mode === 'chase';
  const step = plan.steps[plan.next];
  if (!step) {
    m.plan = null;
    return {};
  }
  const near = flat(feet, step.at) <= NEAR && Math.abs(feet[1] - step.at[1]) < 0.6;
  switch (step.kind) {
    case 'use': {
      const zone = step.zone ? world.named(step.zone) : undefined;
      if (!zone || !inZone(world, zone.id, self.transform!.position)) return { move: toward(feet, step.at) };
      // In the button's zone: press once, and on.
      if (world.tick - m.used > 30) {
        m.used = world.tick;
        plan.next++;
        return { use: true };
      }
      return {};
    }
    case 'stand': {
      if (!near) return { move: toward(feet, step.at) };
      // On the plate: until the mechanism is as the way needs.
      const change = plan.changes.find((ch) => ch.zone === step.zone);
      if (!change || world.signal(change.signal) === change.value) plan.next++;
      return {};
    }
    case 'ride': {
      // On the lift, right where the ride starts (its zone may end a little past its edge): until it is
      // there (the ground under the next point at its height), and off it.
      const start = plan.steps[plan.next - 1]?.at;
      if (start && flat(feet, start) > 0.1) return { move: toward(feet, start) };
      const ground = groundAt(world, step.at, self);
      if (ground !== null && Math.abs(ground - step.at[1]) < 0.1 && Math.abs(feet[1] - step.at[1]) < 0.15) plan.next++;
      return {};
    }
    default: {
      if (near) {
        plan.next++;
        return follow(world, self, m, feet);
      }
      // Not onto what is not there yet (the lift on its way): it waits.
      const ground = groundAt(world, step.at, self);
      if (ground === null || ground < step.at[1] - 0.15) return {};
      const move = toward(feet, step.at);
      const jump = (step.kind === 'jump' || step.kind === 'across') && flat(feet, step.at) < 1.2;
      return { move, ...(run ? { run: true } : {}), ...(jump ? { jump: true } : {}) };
    }
  }
}

/** The games' brains (stage 4e; the Dojo's until 5e), by name, for whoever hosts their matches. */
export const ARMS_BRAINS: Readonly<Record<string, Brain>> = { [GUARD_BRAIN]: guardBrain };
