import { quat, sinCosDegrees, vec3, type Vec3 } from '@manifold/common';
import { characterParts } from '@manifold/character';
import {
  aimOf,
  castHit,
  countOf,
  MOST_BACK,
  pressed,
  shotDice,
  spread,
  buildLevel,
  component,
  DEFAULT_MOVEMENT,
  GRID_COLOR,
  isDown,
  NO_INPUT,
  released,
  STEP,
  upAt,
  type Brain,
  type Capabilities,
  type Cartridge,
  type Character,
  type Damage,
  type Entity,
  type Event,
  type Level,
  type Movement,
  type World,
  type ZoneKinds,
} from '@manifold/core';

/** The big cube's spin at the start (a tilted axis: so it shows that it spins in 3D, not just "turns"). */
const START_SPIN: Vec3 = [0.35, 0.9, 0.15];

/** A color from the world's randomness (not too dark). */
const randomColor = (world: World) => Math.floor(world.random.between(0.25, 1) * 0xffffff) & 0xf0f0f0;

/**
 * A small cube with place, size, spin and color taken from THE WORLD'S RANDOMNESS (not Math.random).
 * It is a dynamic body: it falls, bounces and piles up (stage 1a).
 */
function randomCube(world: World) {
  const r = world.random;
  const side = r.between(0.2, 0.6);
  world.createEntity({
    transform: { position: [r.between(-6, 6), r.between(0.5, 4), r.between(-6, 6)], rotation: quat.identity() },
    body: {
      type: 'dynamic',
      shape: { kind: 'box', halfExtents: [side / 2, side / 2, side / 2] },
      angularVelocity: [r.between(-2, 2), r.between(-2, 2), r.between(-2, 2)],
    },
    appearance: { shape: 'box', size: [side, side, side], color: randomColor(world) },
  });
}

/** A copy of a movement's numbers. */
const copyMovement = (m: Movement): Movement => ({
  walk: { ...m.walk },
  air: { ...m.air },
  jump: { ...m.jump },
  glide: { ...m.glide },
  climb: { ...m.climb },
  crouch: { ...m.crouch },
  roll: { ...m.roll },
  block: { ...m.block },
  turn: m.turn,
});

/**
 * THE DOJO'S RUNNER (stage 2a; a named component since 2.5b): what the level's loop keeps on each
 * character: where it comes back after falling (its spawn, then its last checkpoint), when it
 * started, when it reached the goal (−1: not yet), its falls and its stars.
 */
export type Runner = { spawn: Vec3; checkpoint: Vec3; start: number; finish: number; falls: number; stars: number };
const RUNNER = 'dojo.runner';
/** A character's runner, if it has one. */
export const runner = (e: Entity) => component<Runner>(e, RUNNER);

/**
 * THE THROW'S CHARGE (stage 4b): how many steps `dojo.throw` has been held (0: not held). Let go, the
 * ball leaves where it aims, at `CHARGE.near` m/s for a tap and up to `CHARGE.far` held a second: the
 * same aim throws near or far. (A tap throws as the throw did before the charge.)
 */
export type Charge = { steps: number };
const CHARGE_COMPONENT = 'dojo.charge';
export const CHARGE = Object.freeze({ full: 60, near: 9, far: 16 });
/** A character's charge, if it has one. */
export const charge = (e: Entity) => component<Charge>(e, CHARGE_COMPONENT);
/** How charged a throw held for `steps` steps is, from 0 (a tap: one step) to 1 (a second or more). */
export const chargeOf = (steps: number) => Math.min(1, Math.max(0, steps - 1) / (CHARGE.full - 1));

/** A character: a capsule 1.6 m tall, and its runner for the level's loop. */
function character(world: World, player: number, at: Vec3, facing: Vec3, color: number, like?: Character) {
  // The games' character (stage 4a: @manifold/character): its body, its poses, the mannequin.
  const parts = characterParts({ player, facing, color });
  world.createEntity({
    transform: { position: [...at], rotation: quat.identity() },
    body: parts.body,
    // (Like another one, if given: a copy of the numbers it moves with and of what it can do.)
    character: { ...parts.character, ...(like ? { movement: copyMovement(like.movement), can: { ...like.can } } : {}) },
    appearance: parts.appearance,
    // (Stage 4e: a guard can fight it; down, it is back at its checkpoint three seconds later.)
    health: { most: HERO.health },
    game: {
      [RUNNER]: { spawn: [...at], checkpoint: [...at], start: world.tick, finish: -1, falls: 0, stars: 0 } satisfies Runner,
      [CHARGE_COMPONENT]: { steps: 0 } satisfies Charge,
      [WEAPON]: { kind: 'none', ready: 0, strike: 0, struck: [] } satisfies Weapon,
    },
  });
}

/** A player's character (stage 4e): its health, and how many steps it stays down (then, at its checkpoint). */
export const HERO = Object.freeze({ health: 100, back: 180 });

/**
 * A GUARD (stage 4e, decision 0023): a bot, a character of a player of its own (100, 101…: the session
 * takes its inputs as anyone's), the mannequin in dark red, with health, a stick, eyes (a watcher on its
 * body, looking where it looks: it sees by the light, 3d) and a brain, `dojo.guard` (guard.ts), that
 * keeps to a route: the one named, or the level's nearest to where it stands.
 */
export const GUARD = Object.freeze({
  health: 100,
  color: 0x8a3a3a,
  firstPlayer: 100,
  range: 12,
  degrees: 100,
  threshold: 0.3,
  /** Down, it is back on its feet ten seconds later (stage 4g: a dummy, three). */
  back: 600,
});

/** Where a character's eyes are (stage 4g), above its center (m): its head's (the games' character's hit parts). */
export const EYE = 0.62;

export function guard(world: World, at: Vec3, facing: Vec3, route: string | null = null, kind: WeaponKind = 'stick'): Entity {
  const guards = [...world.entities.values()].filter((e) => e.brain?.name === 'dojo.guard');
  const player = GUARD.firstPlayer + Math.max(-1, ...guards.map((e) => e.character!.player - GUARD.firstPlayer)) + 1;
  const parts = characterParts({ player, facing, color: GUARD.color });
  const nearest = (): string | null => {
    let best: string | null = null;
    let distance = Infinity;
    for (const e of world.entities.values())
      if (e.route && e.name) {
        const d = vec3.length(vec3.sub(e.route.points[0]!, at));
        if (d < distance) {
          distance = d;
          best = e.name;
        }
      }
    return best;
  };
  let name = 'guard';
  for (let k = 2; world.named(name); k++) name = `guard_${k}`;
  return world.createEntity({
    name,
    transform: { position: [...at], rotation: quat.identity() },
    body: parts.body,
    character: parts.character,
    appearance: parts.appearance,
    health: { most: GUARD.health },
    watcher: { range: GUARD.range, cone: sinCosDegrees(GUARD.degrees / 2)[1], threshold: GUARD.threshold },
    brain: { name: 'dojo.guard', route: route ?? nearest() },
    game: { [WEAPON]: { kind, ready: 0, strike: 0, struck: [] } satisfies Weapon },
  });
}

/**
 * A TRAINING DUMMY (stage 4c): a character nobody drives (player 0: no one sends its inputs), the
 * mannequin in straw, with health, standing where a `dummy` zone is and looking where the zone looks.
 */
export const DUMMY = Object.freeze({ health: 100, color: 0xc9a86a, back: 180 });

/** How many steps a character down stays down: a guard's, a player's or a dummy's (the HUD counts it down too). */
export const downFor = (e: Entity) => (e.brain ? GUARD.back : runner(e) ? HERO.back : DUMMY.back);
function dummy(world: World, zone: Entity) {
  const facing = quat.rotate(zone.transform!.rotation, [0, 0, -1]);
  const parts = characterParts({ player: 0, facing, color: DUMMY.color });
  world.createEntity({
    transform: { position: [...zone.transform!.position], rotation: zone.transform!.rotation },
    body: parts.body,
    character: parts.character,
    appearance: parts.appearance,
    health: { most: DUMMY.health },
  });
}

/**
 * THE DOJO'S WEAPONS (stage 4c), its policy: a dart (hitscan: a ray, at once, with a little spread
 * from the shot's own dice, looking back as far as its shooter saw), a bolt (a projectile, fast enough
 * that only stepping it by segments of ray keeps it from crossing a thin wall) and a stick (a strike:
 * its tip sweeps an arc in front over its steps, a ball swept along each step's segment, each target
 * hit once a strike). How much each takes, how often, how far.
 */
export const WEAPONS = Object.freeze({
  dart: { damage: 25, reach: 60, spread: 1, every: 12 },
  bolt: { damage: 35, speed: 80, radius: 0.04, life: 90, every: 20 },
  stick: { damage: 30, reach: 1.2, radius: 0.15, steps: 12, arc: 120, every: 24 },
  /** (Stage 4f) Thrown where it aims; a second and a half later it blows: 60 at its center, less to 4 m. */
  grenade: { damage: 60, speed: 9, fuse: 90, radius: 4, strength: 500, every: 45 },
});
export type WeaponKind = keyof typeof WEAPONS;
/** A `weapon` zone's `kind`: 1, 2, 3, 4. */
const WEAPON_KINDS: readonly WeaponKind[] = ['dart', 'bolt', 'stick', 'grenade'];

/** A grenade's fuse (stage 4f): the steps left, and who threw it. */
type Fuse = { steps: number; by: number };
const FUSE = 'dojo.fuse';

/**
 * WHAT A CHARACTER CARRIES (stage 4c): its weapon ('none' until it picks one up, walking into a
 * `weapon` zone), the step from which it can attack again, and its strike under way (steps left, and
 * whom it already hit).
 */
export type Weapon = { kind: WeaponKind | 'none'; ready: number; strike: number; struck: number[] };
const WEAPON = 'dojo.weapon';
export const weapon = (e: Entity) => component<Weapon>(e, WEAPON);

/** Who threw a ball (stage 4c). */
type Thrown = { by: number };
const THROWN = 'dojo.thrown';

/**
 * WHAT A THROWN BALL TAKES (stage 4c): four points for each joule of a hit (measured: a tap's ball
 * strikes a dummy at 1 to 3 J, a charged one at more, and its bounces after a fraction of that), at
 * most 50, from whoever threw it.
 */
export const impactDamage = (energy: number) => Math.min(50, Math.round(4 * energy));

/**
 * THE WEAPONS AT A STEP (stage 4c): what is picked up; each `dojo.attack` pressed, when its weapon is
 * ready, attacks (a dart's ray, a bolt, a strike begun); and each strike under way sweeps its tip one
 * step further. Not while down.
 */
function arms(world: World, events: readonly Event[]) {
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
    const eye = vec3.add(e.transform.position, vec3.scale(up, EYE));
    if (w.strike > 0) strike(world, e, w, chest, up, back);
    if (!pressed(world, c.player, 'dojo.attack') || world.tick < w.ready) continue;
    if (w.kind === 'dart') {
      const dart = WEAPONS.dart;
      const direction = spread(ahead, up, dart.spread, shotDice(world, c.player));
      const hit = castHit(world, eye, direction, dart.reach, { back, skip: e.id });
      if (hit && world.entities.get(hit.entity)?.health)
        world.hurt(hit.entity, dart.damage, { from: e.id, part: hit.kind === 'character' ? hit.part : null, kind: 'dart' });
      world.emit({
        type: 'shot',
        from: e.id,
        start: eye,
        end: hit ? hit.point : vec3.add(eye, vec3.scale(direction, dart.reach)),
        hit: hit?.entity ?? null,
        kind: 'dart',
      });
      w.ready = world.tick + dart.every;
    } else if (w.kind === 'bolt') {
      const bolt = WEAPONS.bolt;
      world.createEntity({
        transform: { position: vec3.add(eye, vec3.scale(ahead, 0.4)), rotation: quat.identity() },
        projectile: {
          from: e.id,
          velocity: vec3.scale(ahead, bolt.speed),
          radius: bolt.radius,
          damage: bolt.damage,
          kind: 'bolt',
          gravity: false,
          life: bolt.life,
        },
        appearance: { shape: 'sphere', size: [0.12, 0.12, 0.12], color: 0xff7050 },
      });
      w.ready = world.tick + bolt.every;
    } else if (w.kind === 'grenade') {
      const g = WEAPONS.grenade;
      const { above } = aimOf(c, up);
      world.createEntity({
        game: { [FUSE]: { steps: g.fuse, by: e.id } satisfies Fuse, [THROWN]: { by: e.id } satisfies Thrown },
        transform: { position: vec3.add(chest, vec3.scale(ahead, 0.5)), rotation: quat.identity() },
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
 * THE DOJO'S DAMAGE FILTER (stage 4c, its policy): a hit on the head takes double; one's own ball
 * takes nothing from oneself.
 */
export function dojoDamage(world: World, d: Damage): number {
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
function fuses(world: World) {
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

/** The level's stars: zones of kind `star` (while nobody has taken them). */
const stars = (world: World) => [...world.entities.values()].filter((e) => e.sensor?.kind === 'star');

/**
 * A LEVEL (stage 2a: from its file, `dojo.level <name>`): its boxes and its zones, and player 1's
 * character where the level says.
 */
function buildDojoLevel(world: World, level: Level) {
  buildLevel(world, level);
  // Its stars are seen (stage 2c): a small gold cube that spins, in each `star` zone. (A zone with a
  // spin and no body: the world turns it, without trigonometry.)
  for (const star of stars(world)) {
    star.appearance = { shape: 'box', size: [0.4, 0.4, 0.4], color: 0xf0c040 };
    star.spin = { angularVelocity: [0.4, 2, 0.3] };
  }
  // Its training dummies (stage 4c), where its `dummy` zones are; its weapons to pick up, a small bar
  // that turns, in its `weapon` zones (a dart blue, a bolt red, a stick brown).
  for (const zone of [...world.entities.values()].filter((e) => e.sensor?.kind === 'dummy')) dummy(world, zone);
  // Its guards (stage 4e), where its `guard` zones are, looking where the zone looks.
  for (const zone of [...world.entities.values()].filter((e) => e.sensor?.kind === 'guard'))
    guard(world, zone.transform!.position, quat.rotate(zone.transform!.rotation, [0, 0, -1]));
  // (Stage 4g) Guards with a weapon of their own, where `gunner` zones are: its kind as a rack's.
  for (const zone of [...world.entities.values()].filter((e) => e.sensor?.kind === 'gunner'))
    guard(
      world,
      zone.transform!.position,
      quat.rotate(zone.transform!.rotation, [0, 0, -1]),
      null,
      WEAPON_KINDS[(zone.sensor!.params.kind?.[0] ?? 1) - 1] ?? 'dart',
    );
  for (const zone of [...world.entities.values()].filter((e) => e.sensor?.kind === 'weapon')) {
    const kind = WEAPON_KINDS[(zone.sensor!.params.kind?.[0] ?? 1) - 1] ?? 'dart';
    zone.appearance = {
      shape: 'box',
      size: [0.12, 0.12, 0.7],
      color: { dart: 0x5a8ae0, bolt: 0xd85a5a, stick: 0x8a6a42, grenade: 0x6a9a4a }[kind],
    };
    zone.spin = { angularVelocity: [0, 1.5, 0] };
  }
  character(world, 1, level.spawn, level.facing, 0x93d9c9);
}

/**
 * THE DOJO'S ZONES, and what each one carries (stage 3b): its levels are read with them, so a zone of
 * another kind, or a current without its flow, is an error with its line (before, a `chekpoint` was
 * read, and did nothing).
 */
export const DOJO_ZONES: ZoneKinds = {
  checkpoint: {},
  fall: {},
  star: {},
  goal: {},
  /** It carries whoever is in it along its `flow` (m/s, x y z, in the world's axes). */
  current: { flow: 3 },
  /** Where a character presses `use` (stage 3c): what it means is in the level's signals. */
  button: {},
  /** A pressure plate (stage 3c): who is on it, in the level's signals. */
  plate: {},
  /** A fog bank (stage 3d): it attenuates light and sight through it, by its `opacity` per meter. */
  fog: { opacity: 1 },
  /** Where the camera should look while a character is in it (stage 3h): its `view`, a direction (x y z). */
  camera: { view: 3 },
  /** Where a training dummy stands (stage 4c), looking where the zone looks. */
  dummy: {},
  /** Where a guard stands at the start (stage 4e), looking where the zone looks. */
  guard: {},
  /** A guard with a weapon of its own (stage 4g): its `kind` as a rack's (1 a dart, 2 a bolt). */
  gunner: { kind: 1 },
  /** A weapon to pick up (stage 4c), walking into it: its `kind`, 1 a dart, 2 a bolt, 3 a stick. */
  weapon: { kind: 1 },
};

/**
 * CURRENTS (stage 3b): a character in a `current` zone, standing in it, is carried along its flow, on
 * every step it is there. One more contribution to its movement (stage 2b's `carry`): walking against
 * it, it advances less; across it, it drifts. It takes hold through the feet, as water at the ankles
 * does: in the air, jumping over it, nothing holds on to it (at first it carried a jump too, from a
 * zone 5 m tall, and the author found it strange: over the water, without touching it, it pushed). A
 * wind, which would push in the air, would be another kind of zone. What the physics moves, it pushes
 * by its material's drag (stage 3g).
 */
function currents(world: World) {
  for (const zone of world.entities.values()) {
    if (zone.sensor?.kind !== 'current') continue;
    const flow = zone.sensor.params.flow as Vec3;
    for (const id of zone.sensor.inside) {
      const e = world.entities.get(id);
      const c = e?.character;
      if (c?.grounded) c.carry = vec3.add(c.carry, flow);
      // What the physics moves (stage 3g): pushed towards the flow by its material's drag, the part of
      // the difference it closes in a step (stone's, without one). Along the ground only: a ball rolls
      // away with it; a stone cube on the bottom stays, its friction holding it.
      if (e?.body?.type === 'dynamic') {
        const drag = world.materials[e.body.material ?? 'stone']?.drag ?? 0.5;
        const v = e.body.linearVelocity;
        const along: Vec3 = [flow[0] - v[0], 0, flow[2] - v[2]];
        world.push(e, vec3.scale(along, Math.min(1, drag * STEP)));
      }
    }
  }
}

/**
 * A LEVEL'S LOOP (stage 2a), with its zones: the engine says who came into which one, and what it
 * means is the Dojo's.
 * - `checkpoint`: a character comes back here from now on, if it falls;
 * - `fall` (the void under the floor): a character goes back to its checkpoint; a cube or a ball is gone
 *   (a platform, which the program moves, is not);
 * - `star` (stage 2c): whoever gets there first takes it, and it is gone;
 * - `goal`: the time it took (from when it started), how many times it fell and its stars, once.
 * And a watcher (stage 3d) tells the character it began to see, or lost.
 * What it keeps lives in the character's runner (`dojo.runner`): it is the world's, so it is hashed, it
 * travels in snapshots, and a replay plays it the same.
 */
function levelLoop(world: World, events: readonly Event[]) {
  // What it tells a player, as a key of its words (interface.ts) and its numbers (decision 0019).
  const notice = (player: number, say: string, values?: readonly number[]) =>
    world.emit({ type: 'notice', say, player, ...(values ? { values } : {}) });
  for (const ev of events) {
    // A watcher (stage 3d): the character it began to see, or lost, is told.
    // (A level's watcher: a guard's eyes, stage 4e, are its own business.)
    if ((ev.type === 'seen' || ev.type === 'lost') && !world.entities.get(ev.watcher)?.character) {
      const player = world.entities.get(ev.entity)?.character?.player;
      if (player !== undefined) notice(player, ev.type === 'seen' ? 'dojo.seen' : 'dojo.lost');
      continue;
    }
    if (ev.type !== 'sensorEntered') continue;
    const zone = world.entities.get(ev.sensor);
    const e = world.entities.get(ev.entity);
    if (!zone?.sensor || !zone.transform || !e) continue;
    const run = runner(e);
    const player = e.character?.player;
    switch (zone.sensor.kind) {
      case 'fall':
        // What the physics moves (a cube, a ball) is gone; what the program moves (a platform) is not
        // the void's (closing phase 2: before, a platform whose center dipped into it was deleted).
        if (!e.character) {
          if (e.body?.type === 'dynamic') world.removeEntity(e.id);
        } else if (run && player !== undefined) {
          world.place(e, run.checkpoint);
          run.falls++;
          notice(player, 'dojo.fell');
        }
        break;
      case 'checkpoint':
        if (run && player !== undefined && !vec3.equals(run.checkpoint, zone.transform.position)) {
          run.checkpoint = [...zone.transform.position];
          notice(player, 'dojo.checkpoint');
        }
        break;
      case 'star':
        if (run && player !== undefined) {
          world.removeEntity(zone.id);
          run.stars++;
          notice(player, 'dojo.star', [run.stars, stars(world).length]);
        }
        break;
      case 'goal':
        if (run && player !== undefined && run.finish < 0) {
          run.finish = world.tick;
          // Its time, its falls, the stars it took and those it left.
          notice(player, 'dojo.goal', [(run.finish - run.start) * STEP, run.falls, run.stars, stars(world).length]);
        }
        break;
    }
  }
}

/** A ball at a place, with its size and color from the world's randomness: it falls from there. */
function ball(world: World, position: Vec3, velocity: Vec3 = [0, 0, 0], by?: Entity) {
  const diameter = world.random.between(0.3, 0.7);
  world.createEntity({
    // Who threw it (stage 4c): what it hurts, it hurts from them.
    ...(by ? { game: { [THROWN]: { by: by.id } satisfies Thrown } } : {}),
    transform: { position: [...position], rotation: quat.identity() },
    // A little angular damping: Rapier has no rolling resistance, and without it the ball would roll
    // until it fell off the floor's edge.
    body: {
      type: 'dynamic',
      shape: { kind: 'ball', radius: diameter / 2 },
      restitution: 0.5,
      angularDamping: 0.8,
      linearVelocity: [...velocity],
    },
    appearance: { shape: 'sphere', size: [diameter, diameter, diameter], color: randomColor(world) },
  });
}

/** Each player's color: the first one's is the course's; the others', from this list. */
const PLAYER_COLORS = [0x4a9fd8, 0xd86a4a, 0x7ac25a, 0xc25ab8, 0xd8c04a];

/**
 * In a level with characters (the course), every player who comes into the match (stage 1e:
 * `players.join`) gets one, next to the first one's; whoever leaves loses it. Player 1's belongs to
 * the level: it is there from the start, and it stays.
 */
function joinedPlayers(world: World) {
  const characters = [...world.entities.values()].filter((e) => e.character);
  const first = characters.find((e) => e.character!.player === 1);
  if (!first) return;
  // Next to where the first one started, each one 1.2 m further to the right.
  const spawn = runner(first)?.spawn ?? [0, 1, 6];
  for (const p of world.players)
    if (p !== 1 && !characters.some((e) => e.character!.player === p))
      character(
        world,
        p,
        [spawn[0] + 1.2 * (p - 1), spawn[1], spawn[2]],
        first.character!.facing,
        PLAYER_COLORS[(p - 2) % PLAYER_COLORS.length]!,
        // It moves like the first one, and can do what it can (whatever `dojo.air`, `dojo.climb`… made of it).
        first.character!,
      );
  // (Player 0 drives nothing: a training dummy, stage 4c, stays; a bot's brain drives it, stage 4e.)
  for (const e of characters) {
    const p = e.character!.player;
    if (p !== 1 && p !== 0 && !e.brain && !world.players.has(p)) world.removeEntity(e.id);
  }
}

/**
 * THE DOJO'S CARTRIDGE: the first game, the engine's lab. A floor, a big cube that spins (a
 * kinematic body: it pushes what it touches), small cubes that fall from the world's randomness, and
 * balls on demand. Or a level, which brings its whole ground (stage 3b: before, the floor and the big
 * cube were built in every room, and the circuit's first jump had that floor under it). It tests what matters: that a game, from OUTSIDE the engine, puts things in a
 * world that the simulation runs (with its physics) and the presentation draws.
 *
 * What the Dojo lets people change it DECLARES (decision 0010), each thing with its scope:
 * - `dojo.cubes` is STARTUP: how many cubes there are when the world is born (changing it restarts it);
 * - `dojo.spin` is WORLD: the big cube's spin, which changes at a given step;
 * - `dojo.spawn x y z` is a WORLD action: a ball that falls from there, at a given step.
 * - `dojo.throw` is a PLAYER's button (stage 1d): held, it charges; let go, the character throws a ball where it aims (stage 4b). The core does
 *   not know it: the Dojo declares it, reads it on every step, and its page says which key presses it.
 * (And the engine's `seed` and `physics.gravity`, which the Dojo lets people touch too.)
 *
 * The Dojo's rules do not touch the screen (this file runs the same in tests): what is seen is
 * decided by `index.ts`.
 */
export function createDojo(levels: Readonly<Record<string, Level>>, brains: Readonly<Record<string, Brain>> = {}): Cartridge {
  return {
    id: 'dojo',
    title: 'Dojo',
    // Its guards' brains (stage 4e): given here by whoever hosts its matches (the page, a test); a
    // replay, which only plays the inputs they gave, does not need them.
    brains,
    inputs: [
      {
        name: 'dojo.throw',
        kind: 'button',
        description:
          'held, the character charges a throw; let go, it throws a ball where it aims, farther the longer it was held',
      },
      {
        name: 'dojo.attack',
        kind: 'button',
        description: 'the character uses the weapon it carries: a dart, a bolt, a stick (stage 4c)',
      },
    ],
    // A lab: in a match, everybody may change the world (another game may let only its host).
    mayChange: () => true,
    // Its zones (stage 3b), for its levels and for what the console adds (stage 3j).
    zones: DOJO_ZONES,

    onDeclare(registry) {
      registry.declareVariable({
        name: 'dojo.cubes',
        description:
          "Small cubes at the start, at places taken from the world's randomness: with the same seed, always the same ones.",
        scope: 'startup',
        type: { kind: 'integer', min: 0, max: 200 },
        default: 0,
      });
      registry.declareVariable({
        name: 'dojo.level',
        description:
          'What the room is: `empty` (a floor and the big cube), or a level from `games/dojo/levels/`, which brings its whole ground, like `course`: a small classic level with a character to drive (WASD or the arrows, Space to jump, Shift to run), checkpoints and a goal.',
        scope: 'startup',
        type: { kind: 'option', options: ['empty', ...Object.keys(levels)] },
        default: 'empty',
      });
      // What the characters can do besides walking and jumping (stage 2c): on and off, live, for all.
      // (Off unless said: crouching, on, as the games' character comes, stage 4b.)
      const capability = (name: string, key: keyof Capabilities, description: string, on = false) =>
        registry.declareVariable({
          name,
          description,
          scope: 'world',
          type: { kind: 'boolean' },
          default: on,
          onWorld(world, value) {
            for (const e of world.entities.values()) if (e.character) e.character.can[key] = value === true;
          },
        });
      capability(
        'dojo.climb',
        'climb',
        'Pushing against a wall, the characters climb it; jumping from it, they leap off (stage 2c).',
      );
      capability(
        'dojo.glide',
        'glide',
        'Holding the jump while falling, the characters glide: they fall slowly, and steer more (stage 2c).',
      );
      capability('dojo.doublejump', 'doubleJump', 'One more jump in the air, pressing jump again (stage 2c).');
      capability(
        'dojo.crouch',
        'crouch',
        'Holding C on the ground, the characters crouch: slower, under what they could not stand under, seen and heard less (stage 4b).',
        true,
      );
      capability(
        'dojo.roll',
        'roll',
        'Pressing V on the ground, the characters roll: a dodge, low, the way they are asked to go (stage 4b).',
        true,
      );
      registry.declareVariable({
        name: 'dojo.air',
        description:
          "How much a character can steer in the air, in m/s² (stage 2b). 14 is a platformer's; 0, none at all, like real physics (once in the air, there is nothing to push against); 50, as much as on the ground. It changes at a step, for every character.",
        scope: 'world',
        type: { kind: 'number', min: 0, max: 60 },
        default: DEFAULT_MOVEMENT.air.control,
        onWorld(world, value) {
          for (const e of world.entities.values()) if (e.character) e.character.movement.air.control = Number(value);
        },
      });
      registry.declareVariable({
        name: 'dojo.spin',
        description: 'How the big cube spins (in the Dojo without a level): radians per second around each axis (x y z).',
        scope: 'world',
        type: { kind: 'vector' },
        default: START_SPIN,
        onWorld(world, value) {
          // The big cube, by its name (stage 3b; before, by being the world's first entity, which in a
          // room with a level is the level's first box).
          const cube = world.named('cube');
          if (cube?.spin) cube.spin.angularVelocity = [...(value as Vec3)];
        },
      });
      registry.declareCommand({
        name: 'dojo.goto',
        description:
          "Puts player 1's character at (x, y, z), stopped: to explore a level (stage 2c). A world action: it enters at a step, and the replay has it.",
        args: [{ name: 'x y z', type: { kind: 'vector' } }],
        // (A room may start you somewhere: stage 4e's guard room starts you on the lift.)
        inRecipes: true,
        onWorld(world, [place]) {
          const hero = [...world.entities.values()].find((e) => e.character?.player === 1);
          if (hero) world.place(hero, place as Vec3);
        },
      });
      registry.declareCommand({
        name: 'dojo.guard',
        description:
          'Puts a guard at (x, y, z) (stage 4e): a bot with health, a stick and eyes, that keeps to a route (the one named, or the nearest), hears and sees you, comes after you and fights. A world action.',
        args: [
          { name: 'x y z', type: { kind: 'vector' } },
          { name: 'route', type: { kind: 'text' }, optional: true },
        ],
        inRecipes: true,
        onWorld(world, [place, route]) {
          guard(world, place as Vec3, [0, 0, -1], route ? String(route) : null);
        },
      });
      registry.declareCommand({
        name: 'dojo.spawn',
        description: "Drops a ball from (x, y, z), with its size and color taken from the world's randomness.",
        args: [{ name: 'x y z', type: { kind: 'vector' } }],
        onWorld(world, [place]) {
          ball(world, place as Vec3);
        },
      });
    },

    beforeStep(world) {
      currents(world);
    },

    filterDamage: dojoDamage,

    onStep(world, events) {
      joinedPlayers(world);
      levelLoop(world, events);
      // What a thrown ball strikes, if it has health, it hurts (stage 4c); a dummy down is back on its
      // feet after three seconds.
      for (const ev of events)
        if (ev.type === 'sound' && ev.sound === 'hit' && ev.against != null && world.entities.get(ev.against)?.health) {
          const source = world.entities.get(ev.source);
          const thrown = source && component<Thrown>(source, THROWN);
          world.hurt(ev.against, impactDamage(ev.energy), { from: thrown?.by ?? null, kind: 'impact' });
        }
      // Down three seconds, it is back on its feet (a dummy; a guard, ten); a player's, at its checkpoint.
      for (const e of world.entities.values())
        if (e.health && e.health.down >= 0 && world.tick - e.health.down >= downFor(e)) {
          world.revive(e.id);
          const run = runner(e);
          if (run) world.place(e, run.checkpoint);
        }
      arms(world, events);
      fuses(world);
      // How many guards are down (stage 4f), and whether all of them are (stage 4g), for a level that asks
      // (its `down` and `cleared` signals, inputs).
      const guards = [...world.entities.values()].filter((e) => e.brain);
      const downs = guards.filter((e) => (e.health?.down ?? -1) >= 0).length;
      if (world.signals.some((g) => g.name === 'down' && g.op === 'input')) world.setSignal('down', downs);
      if (world.signals.some((g) => g.name === 'cleared' && g.op === 'input'))
        world.setSignal('cleared', guards.length > 0 && downs === guards.length ? 1 : 0);
      // Held, the throw charges; let go, one ball leaves: from the chest, where it aims (stage 4b: with
      // its pitch), up a little from there, as fast as it was charged.
      for (const e of world.entities.values()) {
        const held = e.character && charge(e);
        if (!e.character || !e.transform || !held) continue;
        const player = e.character.player;
        if (isDown(world.inputs.get(player) ?? NO_INPUT, 'dojo.throw')) held.steps = Math.min(held.steps + 1, CHARGE.full);
        if (!released(world, player, 'dojo.throw')) continue;
        const speed = CHARGE.near + (CHARGE.far - CHARGE.near) * chargeOf(held.steps);
        held.steps = 0;
        const up = upAt(world, e.transform.position);
        const { ahead, above } = aimOf(e.character, up);
        const from = vec3.add(e.transform.position, vec3.add(vec3.scale(ahead, 0.75), vec3.scale(up, 0.4)));
        ball(world, from, vec3.add(vec3.scale(ahead, speed), vec3.scale(above, 2.5)), e);
      }
    },

    onStart(world, registry) {
      const level = levels[String(registry.value('dojo.level'))];
      if (level) buildDojoLevel(world, level);
      else {
        // Without a level: the big cube, the one `dojo.spin` turns, and the floor, 20 m square with its
        // top at y = 0, drawn as a grid (stage 3b: before, the stage drew the grid, under any level).
        world.createEntity({
          name: 'cube',
          transform: { position: [0, 1, 0], rotation: quat.identity() },
          spin: { angularVelocity: [...START_SPIN] },
          body: { type: 'kinematic', shape: { kind: 'box', halfExtents: [0.5, 0.5, 0.5] } },
          appearance: { shape: 'box', size: [1, 1, 1], color: 0xe0a040 },
        });
        world.createEntity({
          name: 'floor',
          transform: { position: [0, -0.5, 0], rotation: quat.identity() },
          body: { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 10] } },
          appearance: { shape: 'grid', size: [20, 1, 20], color: GRID_COLOR },
        });
      }
      const cubes = Number(registry.value('dojo.cubes'));
      for (let i = 0; i < cubes; i++) randomCube(world);
    },
  };
}
