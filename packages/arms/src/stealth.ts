import { quat, vec3, type Vec3 } from '@manifold/common';
import {
  aimOf,
  component,
  pressed,
  upAt,
  type Damage,
  type Entity,
  type Event,
  type InputAction,
  type World,
} from '@manifold/core';
import { armsDamage, THROWN, type Thrown } from './weapons';

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
 *     (`stealthDamage`): passing unseen pays, fighting face to face costs.
 *
 * What a character carries of them is its pouch; it picks them up walking into an `item` zone.
 */

/** The inputs a game that sneaks declares, besides the weapons'. */
export const SMOKE_INPUT = 'arms.smoke';
export const FLARE_INPUT = 'arms.flare';
export const SHOUT_INPUT = 'arms.shout';
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
];

/** The zones a game that sneaks understands: an `item` to pick up (its `kind`: 1, smoke; 2, a flare). */
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
});

/** What a character carries of them. */
export type Pouch = { smoke: number; flare: number };
export const POUCH = 'arms.pouch';
export const pouch = (e: Entity) => component<Pouch>(e, POUCH);

/** A guard's wariness (stage 5e), its game's to give: whether it shouts, lights lamps again, and minds a guard down. */
export type Wary = { shout: boolean; relight: boolean; notice: boolean };
export const WARY = 'arms.wary';
export const wary = (e: Entity) => component<Wary>(e, WARY);

/** What burns down: smoke's fuse before its cloud, a cloud's and a flare's life (steps). */
type Burning = { steps: number; then: 'cloud' | 'gone' };
const BURNING = 'arms.burning';

/** A thing thrown from a character's chest where it aims, a little up, with what it is. */
function thrown(
  world: World,
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
  return world.createEntity({
    game: { ...game, [THROWN]: { by: by.id } satisfies Thrown },
    transform: { position: vec3.add(chest, vec3.scale(ahead, 0.5)), rotation: quat.identity() },
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
    if ((zone.sensor.params.kind?.[0] ?? 1) === 2) p.flare++;
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
    if (pressed(world, c.player, SHOUT_INPUT))
      world.emit({
        type: 'sound',
        sound: 'shout',
        source: e.id,
        at: [...e.transform.position],
        surface: null,
        speed: 0,
        energy: 0,
        radius: STEALTH.shout,
      });
  }
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
