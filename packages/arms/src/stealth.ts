import { quat, vec3, type Vec3 } from '@manifold/common';
import {
  aimOf,
  component,
  pressed,
  setComponent,
  upAt,
  type Damage,
  type Entity,
  type Event,
  type InputAction,
  type World,
} from '@manifold/core';
import { armsDamage, startOf, THROWN, type Thrown } from './weapons';

/**
 * THE LIGHT AS A TOOL, AND THE GUARDS' WARINESS (stage 5e; decision 0029: the adventure, stealth first,
 * its distinctive mechanic the light). What a game that sneaks adds to what fights:
 *
 *   - a lamp put out by a hand (`use` near it) gives no light until a hand lights it again: a guard
 *     sees by the simulation's light (3d), so the dark is where one passes;
 *   - smoke, thrown: where it lands, a cloud whose opacity hides what is in it and behind it (the
 *     light and the sight go through a zone with an opacity, 3d), for a while;
 *   - a flare, thrown: a light where it lands, for a while (the guards see whoever it lights);
 *   - a guard that is wary (its game says so) shouts when it sees someone (the others hear it, and
 *     come), lights again a lamp it saw lit and finds out, and looks round where it finds a guard down;
 *   - a blow of a stick from behind, on a guard that does not see who strikes it, takes it down at once
 *     (`stealthDamage`): passing unseen pays, fighting face to face costs;
 *   - (stage 5l, decision 0031) a pebble, thrown: where it first strikes, a clatter a guard comes to check;
 *   - (5l) a guard that is aware (its wariness says how) does not find someone at a glance: its awareness
 *     FILLS while it sees them, faster near and in light, slower far and in the dark, and empties when it
 *     no longer does (`noticing`): calm, then suspicious (it says "huh?", stares, goes to look), then
 *     alerted (it shouts and gives chase), then searching where it last saw them, then back on its round,
 *     warier for a while ("nothing"). Breaking its sight while it is only suspicious, one gets away.
 *
 * What a character carries of them is its pouch; it picks them up walking into an `item` zone.
 */

/** The inputs a game that sneaks declares, besides the weapons'. */
export const SMOKE_INPUT = 'arms.smoke';
export const FLARE_INPUT = 'arms.flare';
export const SHOUT_INPUT = 'arms.shout';
export const PEBBLE_INPUT = 'arms.pebble';
export const STEALTH_INPUTS: readonly InputAction[] = [
  {
    name: SMOKE_INPUT,
    kind: 'button',
    description: 'the character throws smoke where it aims, if it carries some: a cloud that hides (stage 5e)',
  },
  {
    name: FLARE_INPUT,
    kind: 'button',
    description: 'the character throws a flare where it aims, if it carries one: a light (stage 5e)',
  },
  {
    name: SHOUT_INPUT,
    kind: 'button',
    description: 'the character shouts: who hears it, hears where (a wary guard, seeing someone; stage 5e)',
  },
  {
    name: PEBBLE_INPUT,
    kind: 'button',
    description:
      'the character throws a pebble where it aims, if it carries one: where it lands, a noise a guard comes to check (stage 5l)',
  },
];

/** The zones a game that sneaks understands: an `item` to pick up (its `kind`: 1, smoke; 2, a flare; 3, a pebble). */
export const STEALTH_ZONES = { item: { kind: 1 } } as const;

/** Its numbers: how near a lamp a hand reaches (m, along the ground; up to `high` over its middle); smoke's and a flare's. */
export const STEALTH = Object.freeze({
  lamp: 1.6,
  high: 2.6,
  /** Thrown at 8 m/s; its cloud a second later: 5 m across and 3 high, 2.5 of opacity a meter, for 8 s. */
  smoke: { speed: 8, fuse: 60, half: [2.5, 1.5, 2.5] as Vec3, opacity: 2.5, life: 480 },
  /** Thrown at 9 m/s; a light of 7 m and 1.4 where it is, for 20 s. */
  flare: { speed: 9, radius: 7, intensity: 1.4, life: 1200 },
  /** How far a shout is heard (m). */
  shout: 15,
  /** (5l) Thrown at 11 m/s; where it first strikes, a clatter heard 10 m round; it lies there 3 s. */
  pebble: { speed: 11, heard: 10, life: 180 },
  /** (5l) How far a guard's "huh?" and its "nothing" are heard (m): by those near, the intruder too. */
  bark: 8,
});

/** What a character carries of them (pebbles since 5l: what carried none before has none). */
export type Pouch = { smoke: number; flare: number; pebble?: number };
export const POUCH = 'arms.pouch';
export const pouch = (e: Entity) => component<Pouch>(e, POUCH);

/**
 * HOW A GUARD'S AWARENESS FILLS (stage 5l, decision 0031; the stealth games' readable awareness: Thief,
 * Mark of the Ninja, Splinter Cell): the seconds it takes to fill, seeing someone right by it and at the
 * edge of its sight (between, in a straight line by the distance), shorter the brighter they are (up to
 * 2.5 times as bright as it needs to see them at all); from how full it is suspicious; how fast it
 * empties (a share a second) once it has not seen them for `grace` seconds; alerted, how many seconds out
 * of its sight before it searches, and for how many it searches; back on its round, for how many seconds
 * it is warier, and how much quicker (its times multiplied by `wary`).
 */
export type Aware = {
  near: number;
  far: number;
  suspicious: number;
  decay: number;
  grace: number;
  lose: number;
  search: number;
  wary: number;
  waryFor: number;
};

/** A guard's wariness (stage 5e), its game's to give: whether it shouts, lights lamps again, and minds a guard down; (5l) how its awareness fills, if it has one. */
export type Wary = { shout: boolean; relight: boolean; notice: boolean; aware?: Aware };

/**
 * (Stage 5l) WHAT A GUARD HAS NOTICED: how full its awareness is (0 to 1), where it stands (calm,
 * suspicious, alerted, searching), where and whom it last saw (and when; none yet: `[]` and −1), since
 * when it is as it is, and until when it is warier. The world's: in the hash, read by its brain and drawn
 * by the view.
 */
export type NoticeState = 'calm' | 'suspicious' | 'alerted' | 'searching';
export type Notice = {
  level: number;
  state: NoticeState;
  at: number[];
  who: number;
  seen: number;
  since: number;
  until: number;
};
export const NOTICE = 'arms.notice';
export const noticeOf = (e: Entity) => component<Notice>(e, NOTICE);
export const WARY = 'arms.wary';
export const wary = (e: Entity) => component<Wary>(e, WARY);

/** What burns down: smoke's fuse before its cloud, a cloud's and a flare's life (steps). */
type Burning = { steps: number; then: 'cloud' | 'gone' };
const BURNING = 'arms.burning';
/** (5l) A pebble in flight: its velocity a step before (`[]` the step it is thrown; a sudden change is where it struck), whether it was heard, how long it lies. */
type Pebble = { before: number[]; heard: boolean; steps: number };
const PEBBLE = 'arms.pebble';

/** A thing thrown from a character's chest where it aims, a little up, with what it is (`kind`, for the eyes and ears: stage 5g). */
function thrown(
  world: World,
  kind: string,
  by: Entity,
  speed: number,
  look: { size: number; color: number },
  game: Record<string, unknown>,
  lamp?: Pick<NonNullable<Entity['lamp']>, 'radius' | 'intensity' | 'signal'>,
) {
  const c = by.character!;
  const up = upAt(world, by.transform!.position);
  const { ahead, above } = aimOf(c, up);
  const chest = vec3.add(by.transform!.position, vec3.scale(up, 0.4));
  world.emit({ type: 'fired', from: by.id, at: chest, direction: [...ahead], kind });
  return world.createEntity({
    game: { ...game, [THROWN]: { by: by.id } satisfies Thrown },
    transform: { position: startOf(world, by, chest, ahead, 0.5, look.size / 2), rotation: quat.identity() },
    body: {
      type: 'dynamic',
      shape: { kind: 'ball', radius: look.size / 2 },
      restitution: 0.2,
      angularDamping: 0.8,
      linearVelocity: vec3.add(vec3.scale(ahead, speed), vec3.scale(above, 2.5)),
    },
    appearance: { shape: 'sphere', size: [look.size, look.size, look.size], color: look.color },
    ...(lamp ? { lamp } : {}),
  });
}

/**
 * THE STEALTH AT A STEP (stage 5e): what is picked up; lamps put out and lit again by a hand; smoke and
 * flares thrown, burning down, a cloud made and gone; shouts heard. Not while down.
 */
export function stealth(world: World, events: readonly Event[]) {
  for (const ev of events) {
    if (ev.type !== 'sensorEntered') continue;
    const zone = world.entities.get(ev.sensor);
    const e = world.entities.get(ev.entity);
    const p = e && pouch(e);
    if (zone?.sensor?.kind !== 'item' || !p) continue;
    const kind = zone.sensor.params.kind?.[0] ?? 1;
    if (kind === 2) p.flare++;
    else if (kind === 3) p.pebble = (p.pebble ?? 0) + 1;
    else p.smoke++;
    world.removeEntity(zone.id);
  }
  for (const e of [...world.entities.values()]) {
    const c = e.character;
    if (!c || !e.transform || (e.health?.down ?? -1) >= 0) continue;
    // A hand on the nearest lamp within reach: out if it gives light, lit again if a hand put it out.
    if (pressed(world, c.player, 'use')) {
      let near: Entity | null = null;
      let best: number = STEALTH.lamp;
      const up = upAt(world, e.transform.position);
      for (const l of world.entities.values()) {
        if (!l.lamp || !l.transform || l.breakable?.broken) continue;
        const to = vec3.sub(l.transform.position, e.transform.position);
        const d = vec3.length(vec3.onPlane(to, up));
        if (d <= best && Math.abs(vec3.dot(to, up)) <= STEALTH.high) {
          best = d;
          near = l;
        }
      }
      if (near?.lamp) near.lamp.out = !near.lamp.out;
    }
    const p = pouch(e);
    if (p && p.smoke > 0 && pressed(world, c.player, SMOKE_INPUT)) {
      p.smoke--;
      thrown(
        world,
        'smoke',
        e,
        STEALTH.smoke.speed,
        { size: 0.2, color: 0x6a6a64 },
        { [BURNING]: { steps: STEALTH.smoke.fuse, then: 'cloud' } satisfies Burning },
      );
    }
    if (p && p.flare > 0 && pressed(world, c.player, FLARE_INPUT)) {
      p.flare--;
      const f = STEALTH.flare;
      thrown(
        world,
        'flare',
        e,
        f.speed,
        { size: 0.14, color: 0xff6a3a },
        { [BURNING]: { steps: f.life, then: 'gone' } satisfies Burning },
        {
          radius: f.radius,
          intensity: f.intensity,
          signal: null,
        },
      );
    }
    if (p && (p.pebble ?? 0) > 0 && pressed(world, c.player, PEBBLE_INPUT)) {
      p.pebble = p.pebble! - 1;
      const s = STEALTH.pebble;
      thrown(
        world,
        'pebble',
        e,
        s.speed,
        { size: 0.08, color: 0x9a948a },
        { [PEBBLE]: { before: [], heard: false, steps: s.life } satisfies Pebble },
      );
    }
    if (pressed(world, c.player, SHOUT_INPUT))
      world.emit({
        type: 'sound',
        sound: 'arms.shout',
        source: e.id,
        at: [...e.transform.position],
        surface: null,
        speed: 0,
        energy: 0,
        radius: STEALTH.shout,
      });
  }
  // (5l) A pebble: where it first strikes (its velocity turned or cut short in a step), a clatter; then it lies a while.
  for (const e of [...world.entities.values()]) {
    const pb = component<Pebble>(e, PEBBLE);
    if (!pb || !e.transform || !e.body) continue;
    const v = e.body.linearVelocity ?? [0, 0, 0];
    const before = pb.before.length === 3 ? (pb.before as Vec3) : null;
    if (before && !pb.heard && vec3.length(vec3.sub(v, before)) > 0.5 * Math.max(1, vec3.length(before)) + STEP_FALL) {
      pb.heard = true;
      world.emit({
        type: 'sound',
        sound: 'arms.pebble',
        source: e.id,
        at: [...e.transform.position],
        surface: null,
        speed: vec3.length(before),
        energy: 0,
        radius: STEALTH.pebble.heard,
      });
    }
    pb.before = [...v];
    if (--pb.steps <= 0) world.removeEntity(e.id);
  }
  noticing(world, events);
  for (const e of [...world.entities.values()]) {
    const b = component<Burning>(e, BURNING);
    if (!b || !e.transform || --b.steps > 0) continue;
    const at: Vec3 = [...e.transform.position];
    world.removeEntity(e.id);
    if (b.then !== 'cloud') continue;
    const s = STEALTH.smoke;
    world.createEntity({
      transform: { position: at, rotation: quat.identity() },
      sensor: { kind: 'smoke', half: [...s.half], params: { opacity: [s.opacity] } },
      appearance: { shape: 'sphere', size: [2 * s.half[0], 2 * s.half[1], 2 * s.half[2]], color: 0xa4a29c, opacity: 0.7 },
      game: { [BURNING]: { steps: s.life, then: 'gone' } satisfies Burning },
    });
  }
}

/** What gravity takes off a falling thing's velocity in a step (m/s): a change no larger is a fall, not a strike. */
const STEP_FALL = 9.81 / 60 + 0.05;

/** The players' characters a guard notices: no brain of their own, standing. */
const isIntruder = (e: Entity | undefined): e is Entity =>
  e !== undefined && !!e.character && !e.brain && e.character.player >= 1 && (e.health?.down ?? -1) < 0;

/**
 * (Stage 5l) HOW MANY SECONDS A GUARD TAKES TO BE SURE of someone it sees `d` m away, its sight `range` m
 * long, they `bright` times as lit as it needs to see them at all (1 to 2.5), warier or not:
 * T = (near + (far − near) · min(1, d / range)) / bright, times `wary` if it is warier.
 */
export function secondsToNotice(aware: Aware, d: number, range: number, bright: number, warier = false): number {
  const b = Math.max(1, Math.min(2.5, bright));
  return ((aware.near + (aware.far - aware.near) * Math.min(1, Math.max(0, d) / range)) / b) * (warier ? aware.wary : 1);
}

/** A guard's bark: what it says, heard `STEALTH.bark` round. */
const bark = (world: World, guard: Entity, sound: 'arms.huh' | 'arms.calm') =>
  world.emit({
    type: 'sound',
    sound,
    source: guard.id,
    at: [...guard.transform!.position],
    surface: null,
    speed: 0,
    energy: 0,
    radius: STEALTH.bark,
  });

/**
 * WHAT EACH AWARE GUARD NOTICES, A STEP (stage 5l; `Aware` says why each number). Seeing someone (its
 * eyes, the world's watcher: in its field, in the light, nothing in the way), its awareness fills by a
 * step's share of the time it takes there,
 *
 *     T = (near + (far − near) · min(1, d / range)) / clamp(light · posture / threshold, 1, 2.5),
 *
 * (times `wary`, if it is warier now): seconds right by it and in light, more far and in the dark. Out of
 * its sight for `grace` seconds, it empties at `decay` a second. Hit by someone, it is full at once.
 * From `suspicious` it is suspicious (it says "huh?"); full, alerted; alerted and `lose` seconds without
 * seeing them, searching; `search` seconds later, back on its round, warier for `waryFor` ("nothing").
 * Suspicious, and empty to half of it, it lets it go ("nothing"). Searching, the moment it sees them it is
 * alerted again. A guard down notices nothing and starts over when up.
 */
export function noticing(world: World, events: readonly Event[]) {
  for (const g of world.entities.values()) {
    const aware = wary(g)?.aware;
    if (!aware || !g.transform || !g.watcher || !g.character) continue;
    const n =
      component<Notice>(g, NOTICE) ??
      setComponent(g, NOTICE, {
        level: 0,
        state: 'calm',
        at: [],
        who: -1,
        seen: -1,
        since: world.tick,
        until: -1,
      } satisfies Notice);
    const set = (state: NoticeState) => {
      n.state = state;
      n.since = world.tick;
    };
    if ((g.health?.down ?? -1) >= 0) {
      if (n.state !== 'calm' || n.level > 0) Object.assign(n, { level: 0, state: 'calm', since: world.tick });
      continue;
    }
    const seeing = g.watcher.sees.map((id) => world.entities.get(id)).find(isIntruder);
    const hitBy = events
      .map((ev) => (ev.type === 'hurt' && ev.target === g.id && ev.from !== null ? world.entities.get(ev.from) : undefined))
      .find(isIntruder);
    const feet = (e: Entity): Vec3 => [...e.transform!.position];
    if (hitBy) {
      n.level = 1;
      n.at = feet(hitBy);
      n.who = hitBy.id;
      n.seen = world.tick;
    }
    if (seeing) {
      const d = vec3.length(vec3.sub(seeing.transform!.position, g.transform.position));
      const c = seeing.character!;
      const posture = c.mode === 'crouch' ? c.movement.crouch.seen : 1;
      const bright = (c.light * posture) / Math.max(1e-6, g.watcher.threshold);
      const seconds = secondsToNotice(aware, d, g.watcher.range, bright, world.tick < n.until);
      // Searching, it is on edge: it knows them at once.
      n.level = n.state === 'searching' ? 1 : Math.min(1, n.level + 1 / (60 * seconds));
      n.at = feet(seeing);
      n.who = seeing.id;
      n.seen = world.tick;
    } else if (!hitBy && n.state !== 'alerted' && n.state !== 'searching' && world.tick - n.seen > 60 * aware.grace)
      n.level = Math.max(0, n.level - aware.decay / 60);
    switch (n.state) {
      case 'calm':
        if (n.level >= 1) set('alerted');
        else if (n.level >= aware.suspicious) {
          set('suspicious');
          bark(world, g, 'arms.huh');
        }
        break;
      case 'suspicious':
        if (n.level >= 1) set('alerted');
        else if (n.level < aware.suspicious / 2) {
          set('calm');
          bark(world, g, 'arms.calm');
        }
        break;
      case 'alerted':
        if (!seeing && !hitBy && world.tick - n.seen > 60 * aware.lose) set('searching');
        break;
      case 'searching':
        if (n.level >= 1 && (seeing || hitBy)) set('alerted');
        else if (world.tick - n.since > 60 * aware.search) {
          set('calm');
          n.level = 0;
          n.until = world.tick + 60 * aware.waryFor;
          bark(world, g, 'arms.calm');
        }
        break;
    }
  }
}

/**
 * THE DAMAGE FILTER OF A GAME THAT SNEAKS (stage 5e): the weapons' (`armsDamage`: a head twice, a block
 * a quarter, none from oneself), and a blow of a stick from behind on a guard that does not see who
 * strikes takes all it has: down at once.
 */
export function stealthDamage(world: World, d: Damage): number {
  const amount = armsDamage(world, d);
  const target = world.entities.get(d.target);
  const from = d.from === null ? undefined : world.entities.get(d.from);
  if (d.kind !== 'stick' || !target?.brain || !target.health || !target.transform || !target.character || !from?.transform)
    return amount;
  const sees = target.watcher?.sees.includes(from.id) ?? false;
  const behind = vec3.dot(vec3.sub(from.transform.position, target.transform.position), target.character.facing) < 0;
  return !sees && behind ? Math.max(amount, target.health.points) : amount;
}
