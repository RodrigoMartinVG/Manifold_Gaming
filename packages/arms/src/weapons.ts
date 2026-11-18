import { quat, sinCosDegrees, vec3, type Vec3 } from '@manifold/common';
import {
  aimOf,
  castHit,
  component,
  countOf,
  eyeHeightOf,
  isDown,
  MOST_BACK,
  NO_INPUT,
  pressed,
  shotDice,
  spread,
  upAt,
  type Damage,
  type Entity,
  type Event,
  type InputAction,
  type World,
} from '@manifold/core';

/** What attacks: the input a character presses to use the weapon it carries (stage 4c's `dojo.attack`, the games' since 5e). */
export const ATTACK = 'arms.attack';
/**
 * (Stage 5i, decision 0031) A weapon RAISED, held while its bearer takes aim before a shot: seen (it is
 * the world's: `arms.raised`) and heard (a sound, `ready`). A fair bot raises it for a moment before each
 * shot, so whoever it aims at has a warning (a player fires at once and never needs it).
 */
export const READY = 'arms.ready';

/** The inputs a game that fights declares (its cartridge's `inputs`). */
export const ARMS_INPUTS: readonly InputAction[] = [
  {
    name: ATTACK,
    kind: 'button',
    description: 'the character uses the weapon it carries: a dart, a bolt, a stick, a grenade (stage 4c)',
  },
  {
    name: READY,
    kind: 'button',
    description: 'the character raises its weapon, taking aim: seen and heard before it fires (stage 5i)',
  },
];

/**
 * A RAISED WEAPON (stage 5i): since when it is raised. Only there while it is (a component of its own, so
 * what never raised one, every replay before 5i, keeps its state as it was).
 */
export type Raised = { since: number };
export const RAISED = 'arms.raised';
export const raised = (e: Entity) => component<Raised>(e, RAISED);
/** How far a raised weapon is heard (m): across a yard, so a fight's warning reaches whoever it aims at. */
export const READY_HEARD = 14;

/**
 * Where a character's eyes are standing (stage 4g), above its center (m): its head's (the games'
 * character's hit parts). In each way of moving, the engine's `eyeHeightOf` (stage 4.5b: crouched, a
 * shot leaves where a first-person camera is, lower).
 */
export const EYE = 0.62;

/**
 * THE WEAPONS (stage 4c; the Dojo's until stage 5e, now the games'; stage 5g gave each its role and two
 * more), their policy: how much each takes, how often (steps), how far.
 *
 *   - the dart: a ray at once (hitscan), a little spread from the shot's own dice, looking back as far as
 *     its shooter saw. Its role, the one that is always right: quick, precise, at any distance, little
 *     each time (four to bring someone down, two to the head).
 *   - the bolt: a projectile, fast enough that only stepping it by segments of ray keeps it from crossing a
 *     thin wall. Its role, the heavy one: slower to fire, it travels (one leads whoever moves), and takes
 *     more (three).
 *   - the stick: a strike, its tip sweeping an arc in front over its steps, each target hit once a strike.
 *     Its role, the quiet one, at arm's length (and from behind, in a game that sneaks, at once).
 *   - the grenade: thrown in an arc, and a second and a half later it blows. Its role: round corners, at
 *     whoever does not move, and what is behind cover.
 *   - the shotgun (5g): eight pellets at once, each its own direction within 6 degrees from the shot's own
 *     dice. Its role, the near one: at two meters all of them strike someone (96), at five about half,
 *     at ten one or two (measured: shooter.test.ts); slow to fire again.
 *   - the launcher (5g): a rocket, slower than a bolt, that blows where it strikes (its blast the world's:
 *     what it reaches it pushes, and hurts by how near). Its role: a place rather than someone; and, at
 *     one's own feet, the explosion jump (one's own blast takes nothing from oneself, it only throws:
 *     4 m up alone, 9.5 with a jump; a kit wall is 3).
 *
 * The numbers of the first four are the ones the arena and the citadel were balanced with (4g, 4.5a):
 * 5g gave them their roles in words and in feel (the presentation's), not new numbers.
 */
export const WEAPONS = Object.freeze({
  dart: { damage: 25, reach: 60, spread: 1, every: 12 },
  bolt: { damage: 35, speed: 80, radius: 0.04, life: 90, every: 20 },
  stick: { damage: 30, reach: 1.2, radius: 0.15, steps: 12, arc: 120, every: 24 },
  /** (Stage 4f) Thrown where it aims; a second and a half later it blows: 60 at its center, less to 4 m. */
  grenade: { damage: 60, speed: 9, fuse: 90, radius: 4, strength: 500, every: 45 },
  /** (Stage 5g) Eight pellets of 12 within 6 degrees, 30 m at most; once a second. */
  shotgun: { damage: 12, pellets: 8, reach: 30, spread: 6, every: 60 },
  /** (Stage 5g) A rocket at 25 m/s for 4 s; where it strikes, a blast of 3.5 m: 90 at its center, less to its edge. */
  launcher: { damage: 90, speed: 25, radius: 0.08, life: 240, blast: 3.5, strength: 900, every: 50 },
});
export type WeaponKind = keyof typeof WEAPONS;
/** A `weapon` zone's `kind`: 1, 2, 3, 4; (stage 5g) 5, 6. */
export const WEAPON_KINDS: readonly WeaponKind[] = ['dart', 'bolt', 'stick', 'grenade', 'shotgun', 'launcher'];

/** A grenade's fuse (stage 4f): the steps left, and who threw it. */
type Fuse = { steps: number; by: number };
const FUSE = 'arms.fuse';

/**
 * WHAT A CHARACTER CARRIES (stage 4c): its weapon ('none' until it picks one up, walking into a
 * `weapon` zone), the step from which it can attack again, and its strike under way (steps left, and
 * whom it already hit).
 */
export type Weapon = { kind: WeaponKind | 'none'; ready: number; strike: number; struck: number[] };
export const WEAPON = 'arms.weapon';
export const weapon = (e: Entity) => component<Weapon>(e, WEAPON);

/** Who threw a ball (stage 4c). */
export type Thrown = { by: number };
export const THROWN = 'arms.thrown';

/**
 * WHAT A THROWN BALL TAKES (stage 4c): four points for each joule of a hit (measured: a tap's ball
 * strikes a dummy at 1 to 3 J, a charged one at more, and its bounces after a fraction of that), at
 * most 50, from whoever threw it.
 */
export const impactDamage = (energy: number) => Math.min(50, Math.round(4 * energy));

/**
 * THE WEAPONS AT A STEP (stage 4c): what is picked up; each `arms.attack` pressed, when its weapon is
 * ready, attacks (a dart's ray, a bolt, a strike begun); and each strike under way sweeps its tip one
 * step further. Not while down.
 */
export function arms(world: World, events: readonly Event[]) {
  for (const ev of events) {
    if (ev.type !== 'sensorEntered') continue;
    const zone = world.entities.get(ev.sensor);
    const carried = world.entities.get(ev.entity);
    const w = carried && weapon(carried);
    if (zone?.sensor?.kind === 'weapon' && w) w.kind = WEAPON_KINDS[(zone.sensor.params.kind?.[0] ?? 1) - 1] ?? 'dart';
  }
  for (const e of world.entities.values()) {
    const w = weapon(e);
    const c = e.character;
    if (!w || !c || !e.transform || w.kind === 'none' || (e.health?.down ?? -1) >= 0) continue;
    const up = upAt(world, e.transform.position);
    const { ahead } = aimOf(c, up);
    const back = countOf(world.inputs.get(c.player) ?? NO_INPUT, 'back', MOST_BACK);
    const chest = vec3.add(e.transform.position, vec3.scale(up, 0.4));
    // Shots leave the eyes (stage 4g), where a first-person camera is: what it has at its center is hit.
    const eye = vec3.add(e.transform.position, vec3.scale(up, e.character && e.body ? eyeHeightOf(e.character, e.body) : EYE));
    if (w.strike > 0) strike(world, e, w, chest, up, back);
    // (Stage 5i) Raised while `arms.ready` is held: the moment it goes up, it is heard.
    const lifting = isDown(world.inputs.get(c.player) ?? NO_INPUT, READY);
    if (lifting && !raised(e)) {
      (e.game ??= {})[RAISED] = { since: world.tick } satisfies Raised;
      world.emit({
        type: 'sound',
        sound: 'ready',
        source: e.id,
        at: [...eye],
        surface: null,
        speed: 0,
        energy: 0,
        radius: READY_HEARD,
      });
    } else if (!lifting && raised(e)) delete e.game![RAISED];
    if (!pressed(world, c.player, ATTACK) || world.tick < w.ready) continue;
    // (Stage 5g) For the eyes and the ears: the weapon used, from where, which way.
    const thrown = w.kind === 'grenade' || w.kind === 'stick';
    world.emit({ type: 'fired', from: e.id, at: thrown ? chest : eye, direction: [...ahead], kind: w.kind });
    if (w.kind === 'dart' || w.kind === 'shotgun') {
      // A ray at once; the shotgun's pellets, each its own direction from the one shot's dice.
      const gun = w.kind === 'dart' ? { ...WEAPONS.dart, pellets: 1 } : WEAPONS.shotgun;
      const dice = shotDice(world, c.player);
      for (let k = 0; k < gun.pellets; k++) {
        const direction = spread(ahead, up, gun.spread, dice);
        const hit = castHit(world, eye, direction, gun.reach, { back, skip: e.id });
        if (hit && world.entities.get(hit.entity)?.health)
          world.hurt(hit.entity, gun.damage, { from: e.id, part: hit.kind === 'character' ? hit.part : null, kind: w.kind });
        world.emit({
          type: 'shot',
          from: e.id,
          start: eye,
          end: hit ? hit.point : vec3.add(eye, vec3.scale(direction, gun.reach)),
          hit: hit?.entity ?? null,
          kind: w.kind,
        });
      }
      w.ready = world.tick + gun.every;
    } else if (w.kind === 'bolt' || w.kind === 'launcher') {
      const bolt = w.kind === 'bolt';
      const p = bolt ? WEAPONS.bolt : WEAPONS.launcher;
      world.createEntity({
        transform: { position: startOf(world, e, eye, ahead, 0.4, p.radius), rotation: quat.identity() },
        projectile: {
          from: e.id,
          velocity: vec3.scale(ahead, p.speed),
          radius: p.radius,
          // (A rocket's damage is its blast's: `rockets`.)
          damage: bolt ? WEAPONS.bolt.damage : 0,
          kind: w.kind === 'bolt' ? 'bolt' : 'rocket',
          gravity: false,
          life: p.life,
        },
        appearance: bolt
          ? { shape: 'sphere', size: [0.12, 0.12, 0.12], color: 0xff7050 }
          : { shape: 'sphere', size: [0.2, 0.2, 0.2], color: 0xffa040 },
      });
      w.ready = world.tick + p.every;
    } else if (w.kind === 'grenade') {
      const g = WEAPONS.grenade;
      const { above } = aimOf(c, up);
      world.createEntity({
        game: { [FUSE]: { steps: g.fuse, by: e.id } satisfies Fuse, [THROWN]: { by: e.id } satisfies Thrown },
        transform: { position: startOf(world, e, chest, ahead, 0.5, 0.12), rotation: quat.identity() },
        body: {
          type: 'dynamic',
          shape: { kind: 'ball', radius: 0.12 },
          restitution: 0.3,
          angularDamping: 0.8,
          linearVelocity: vec3.add(vec3.scale(ahead, g.speed), vec3.scale(above, 2.5)),
        },
        appearance: { shape: 'sphere', size: [0.24, 0.24, 0.24], color: 0x4a6a3a },
      });
      w.ready = world.tick + g.every;
    } else {
      w.strike = WEAPONS.stick.steps;
      w.struck = [];
      w.ready = world.tick + WEAPONS.stick.every;
      strike(world, e, w, chest, up, back);
    }
  }
  rockets(world, events);
}

/**
 * ROCKETS (stage 5g): each one that struck something blows there, a hair back the way it came (so the
 * blast is not behind the face it struck: what shelters is asked from where it blows), and each one it
 * reached with health is hurt by its share of the launcher's damage, from who fired it. (Out of its life
 * without striking anything, it is gone: the world's.)
 */
function rockets(world: World, events: readonly Event[]) {
  const l = WEAPONS.launcher;
  for (const ev of events) {
    if (ev.type !== 'impact' || ev.kind !== 'rocket') continue;
    const speed = vec3.length(ev.velocity);
    const at = speed > 1e-9 ? vec3.sub(ev.at, vec3.scale(ev.velocity, 0.1 / speed)) : ev.at;
    const by = ev.from;
    for (const { entity, share } of world.explode(at, l.blast, l.strength, by))
      if (world.entities.get(entity)?.health) world.hurt(entity, Math.round(l.damage * share), { from: by, kind: 'rocket' });
  }
}

/**
 * WHERE WHAT IS FIRED OR THROWN STARTS (stage 5l: the author saw weapons go through walls, facing one):
 * `along` m from `from` (the eyes, the chest) the way it goes, or, if something the world has is nearer
 * that way, a little short of it (`size`, what it is from its middle to its edge, and 2 cm more). Out of
 * the eyes into a wall, it starts on this side and strikes it; until 5l it started 0.4 m on, past a wall
 * thinner than what was left of that, and flew on beyond it.
 */
export function startOf(world: World, e: Entity, from: Vec3, ahead: Vec3, along: number, size: number): Vec3 {
  const hit = world.castRay(from, ahead, along + size, { skip: e.id, characters: false });
  const at = hit ? Math.max(0, Math.min(along, hit.distance - size - 0.02)) : along;
  return vec3.add(from, vec3.scale(ahead, at));
}

/**
 * ONE STEP OF A STRIKE (stage 4c): the stick turns on to the next point of its arc (from its right to its
 * left, at the chest, `reach` long), and a ball swept along it, from the chest to its tip, hurts the first
 * one it finds that it has not hit yet in this strike.
 */
function strike(world: World, e: Entity, w: Weapon, chest: Vec3, up: Vec3, back: number) {
  const stick = WEAPONS.stick;
  const c = e.character!;
  const right = vec3.cross(c.facing, up);
  const tip = (k: number) => {
    const [s, co] = sinCosDegrees(stick.arc / 2 - (stick.arc * k) / stick.steps);
    return vec3.add(chest, vec3.scale(vec3.add(vec3.scale(c.facing, co), vec3.scale(right, s)), stick.reach));
  };
  const k = stick.steps - w.strike;
  // Along the whole stick, from the chest to its tip (stage 4f: the tip alone, 1.2 m out, missed whoever
  // stood nearer); ten degrees a step, the lines a ball swept along overlap, and leave no gap.
  const from = chest;
  const to = tip(k);
  const along = vec3.sub(to, from);
  const length = vec3.length(along);
  w.strike--;
  if (length < 1e-9) return;
  const hit = castHit(world, from, vec3.scale(along, 1 / length), length, { back, skip: e.id, radius: stick.radius });
  if (!hit || w.struck.includes(hit.entity) || !world.entities.get(hit.entity)?.health) return;
  w.struck.push(hit.entity);
  world.hurt(hit.entity, stick.damage, { from: e.id, part: hit.kind === 'character' ? hit.part : null, kind: 'stick' });
}

/**
 * THE DAMAGE FILTER (stage 4c; the Dojo's until stage 5e): a hit on the head takes double; one's own ball
 * takes nothing from oneself.
 */
export function armsDamage(world: World, d: Damage): number {
  if (d.from !== null && d.from === d.target) return 0;
  const amount = d.part === 'head' ? 2 * d.amount : d.amount;
  // Blocking (stage 4f), a hit from in front takes a quarter.
  const target = world.entities.get(d.target);
  const from = d.from === null ? undefined : world.entities.get(d.from);
  if (target?.character?.mode === 'block' && target.transform && from?.transform) {
    const to = vec3.sub(from.transform.position, target.transform.position);
    if (vec3.dot(to, target.character.facing) > 0) return Math.round(amount * BLOCKED);
  }
  return amount;
}

/** What a blocked hit takes (stage 4f): a quarter. */
export const BLOCKED = 0.25;

/**
 * GRENADES (stage 4f): each fuse burns down; at its end, the blast (the engine's: it pushes what is
 * near), and each one it reached with health hurt by its share of the grenade's damage, from who threw
 * it. The grenade is gone.
 */
export function fuses(world: World) {
  for (const e of [...world.entities.values()]) {
    const f = component<Fuse>(e, FUSE);
    if (!f || !e.transform || --f.steps > 0) continue;
    const g = WEAPONS.grenade;
    const at: Vec3 = [...e.transform.position];
    world.removeEntity(e.id);
    for (const { entity, share } of world.explode(at, g.radius, g.strength, f.by))
      if (world.entities.get(entity)?.health) world.hurt(entity, Math.round(g.damage * share), { from: f.by, kind: 'grenade' });
  }
}
