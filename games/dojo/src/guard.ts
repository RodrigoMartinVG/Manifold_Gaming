import { cellAt, findPath, inZone, navOf, type Step } from '@manifold/bots';
import { vec3, type Vec3 } from '@manifold/common';
import { CHARACTER_GAP, type Brain, type Entity, type Memory, type PlayerInput, type World } from '@manifold/core';
import { EYE, weapon } from './rules';

/**
 * THE GUARD'S BRAIN (stage 4e, decision 0023): it runs where the match is hosted, once, and asks for
 * what a player would (to walk, to look, to press `use`, to strike with its stick). What it senses is
 * the simulation's: who its eyes see (a watcher on its body, by the light: 3d; a crouching player, with
 * less), the sounds within their radius (3f: steps, the lift, a door, a hit). What it decides:
 *
 *   - patrol: along its route, there and back (or round), from point to point;
 *   - look: a sound it heard, it stops and turns to it for a moment (listening), then walks to where it
 *     came from, and looks around for two seconds;
 *   - chase: someone it sees, it goes after; within reach of its stick, it strikes;
 *   - search: whoever it lost, it goes to where it saw them last, and looks around.
 *
 * Its way is the navigation's (4d): when a door or the lift is not as its path needs, the path goes to
 * the button or the plate first, and it waits there until the mechanism is as needed; on the lift, until
 * it is up. Its memory is plain data the host keeps.
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
  /** (Stage 4g) Since when it sees whoever it shoots at, and when it last shot. */
  sighted: number;
  shot: number;
}

/** How near a point it must be to have reached it (m, along the ground); within its stick's reach (m, to the other's center). */
const NEAR = 0.35;
const REACH = 1.5;
/** How long it listens, turned to a sound, before it goes to look (steps). */
const LISTEN = 45;
/**
 * With a dart or a bolt (stage 4g): how far it shoots from (m; nearer than `CLOSE` it steps back), how
 * long it takes to shoot once it sees someone (steps), and how often it shoots then (steps).
 */
const SHOOTS = 18;
const CLOSE = 4;
const REACT = 30;
const SHOT_EVERY = 60;
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

export const guardBrain: Brain = (world, self, memory) => {
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
  const target = (self.watcher?.sees ?? []).map((id) => world.entities.get(id)).find(isPlayer);
  if (target) m.seen = { id: target.id, at: [...feetOf(target)], tick: world.tick };
  // (A door or a lift it is working itself, or that moves right by it, it does not go to look at: it knows.)
  const working = (m.plan?.changes.length ?? 0) > 0 || world.tick - m.used < 60;
  for (const ev of world.stepEvents) {
    if (ev.type !== 'sound' || ev.source === self.id) continue;
    if (world.entities.get(ev.source)?.brain) continue;
    const mechanism = ev.sound === 'door' || ev.sound === 'lift';
    if (mechanism && (working || vec3.length(vec3.sub(ev.at, center)) < 3)) continue;
    if (vec3.length(vec3.sub(ev.at, center)) <= ev.radius) m.heard = { at: ground(ev.at), tick: world.tick };
  }
  // Hit (stage 4g): it knows where from, as if it had seen who did it.
  for (const ev of world.stepEvents) {
    const by = ev.type === 'hurt' && ev.target === self.id && ev.from !== null ? world.entities.get(ev.from) : undefined;
    if (isPlayer(by)) m.seen = { id: by.id, at: [...feetOf(by)], tick: world.tick };
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
  else if (m.mode === 'look') m.goal = m.heard!.at;
  else if (m.mode === 'search') m.goal = m.seen?.at ?? null;
  else m.goal = route ? route.points[m.waypoint % route.points.length]! : null;

  // With a dart or a bolt (stage 4g), whoever it sees and is near enough it shoots at, standing (after a
  // moment to see them), from its eyes, aiming at their middle; too near, it steps back as it shoots.
  const kind = weapon(self)?.kind;
  if (target && (kind === 'dart' || kind === 'bolt')) {
    if (m.sighted < 0) m.sighted = world.tick;
    const to = vec3.sub(target.transform!.position, [center[0], center[1] + EYE, center[2]]);
    const along = Math.hypot(to[0], to[2]);
    if (along <= SHOOTS) {
      const face = toward(center, target.transform!.position);
      const pitch = (Math.atan2(to[1], along) * 180) / Math.PI / 90;
      const fire = world.tick - m.sighted >= REACT && world.tick - m.shot >= SHOT_EVERY;
      if (fire) m.shot = world.tick;
      const back: Vec3 = along < CLOSE ? [-face[0], 0, -face[2]] : [0, 0, 0];
      return { face, pitch, move: back, ...(fire ? { 'dojo.attack': true } : {}) };
    }
  } else m.sighted = -1;
  // A sound just heard: it turns to it and listens a moment before it goes.
  if (m.mode === 'look' && m.heard && world.tick - m.heard.tick < LISTEN) return { face: toward(center, m.heard.at) };
  // Within reach of whoever it chases: it faces them and strikes (a press, then a release); while they
  // swing at it, it blocks (stage 4f).
  if (m.mode === 'chase' && target && vec3.length(vec3.sub(target.transform!.position, center)) <= REACH) {
    const face = toward(center, target.transform!.position);
    if ((weapon(target)?.strike ?? 0) > 0) return { face, block: true };
    m.swing = !m.swing;
    return { face, 'dojo.attack': m.swing };
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
    return {};
  }

  // Its way there: planned again when it goes somewhere else, or after a while (not while it waits by a
  // button or on the lift).
  const waiting = m.plan && ['use', 'stand', 'ride'].includes(m.plan.steps[m.plan.next]?.kind ?? '');
  if (!waiting && (!m.plan || flat(m.plan.to, m.goal) > 1.5 || world.tick - m.plan.made > REPLAN)) {
    const path = nav.reason ? null : findPath(world, nav, center, m.goal, { can: c.can, depth: 2 });
    if (!path) {
      m.plan = null;
      // Nowhere to go from here (off the navigation, or no way): straight at it.
      return { move: toward(feet, m.goal), run: m.mode === 'chase' };
    }
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

/** The Dojo's brains (stage 4e), by name, for whoever hosts its matches. */
export const DOJO_BRAINS: Readonly<Record<string, Brain>> = { 'dojo.guard': guardBrain };
