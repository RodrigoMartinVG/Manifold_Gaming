import { characterParts, GROUNDED, CHARACTER_VERSION } from '@manifold/character';
import { quat, sinCosDegrees, vec3, type Vec3 } from '@manifold/common';
import {
  ARMS_BRAINS,
  ARMS_INPUTS,
  ARSENAL,
  arms,
  armsDamage,
  fuses,
  giveAmmo,
  guard,
  GUNNER,
  GUNNER_KEY,
  SLOT_INPUTS,
  WEAPON,
  WEAPON_KINDS,
  type AmmoKind,
  type Arsenal,
  type Gunner,
  type Weapon,
  type WeaponKind,
  ARMS_VERSION,
} from '@manifold/arms';
import {
  buildLevel,
  component,
  type Cartridge,
  type Damage,
  type Entity,
  type Event,
  type Level,
  setComponent,
  type World,
  type ZoneKinds,
} from '@manifold/core';
import { KIT, KIT_VERSION } from '@manifold/kit';
import { notice, STEPS_PER_SECOND, SHELL_VERSION } from '@manifold/shell/run';

/**
 * The zones a level of the wall understands (stage 5n, decision 0031: levels to advance through, as the
 * genre's): where the defender comes back to, where one falls, its way out (`goal`); a weapon on its rack
 * (`kind`, as the games' racks: 1 dart, 2 bolt, 5 shotgun, 6 launcher, 7 repeater; taken once), a key
 * (`color`: 1 red, 2 blue, 3 yellow: it turns on the level's signal `key_red`… that its doors read), health,
 * armor (`amount`), ammunition (`kind`: 1 darts, 2 shells, 3 bolts, 4 rockets, 5 grenades; `amount`), a
 * secret (counted, for the recap); and the attackers: in which group (`wave`: 0, standing from the start;
 * any other, when the defender walks into a `trigger` zone of that group), how many, of which role (1 to 4:
 * `ROLES`), each keeping to the level's nearest route, if any.
 */
export const WALL_ZONES: ZoneKinds = {
  checkpoint: {},
  fall: {},
  goal: {},
  weapon: { kind: 1 },
  key: { color: 1 },
  health: { amount: 1 },
  armor: { amount: 1 },
  ammo: { kind: 1, amount: 1 },
  secret: {},
  trigger: { wave: 1 },
  attackers: { wave: 1, count: 1, role: 1 },
  // A place the level's signals read: before a door (a key's door opens there), a hidden button (`used`).
  area: {},
};

/** The keys' colors, by a key zone's `color`: the signal each turns on is `key_<color>`. */
export const KEY_COLORS = ['red', 'blue', 'yellow'] as const;
/** The ammunition by an `ammo` zone's `kind`: (stage 5o) 6, the flame lance's oil. */
const AMMO_KINDS: readonly AmmoKind[] = ['darts', 'shells', 'bolts', 'rockets', 'grenades', 'oil'];

/**
 * How the defender is doing on a level: which level of the night it is (its place: the attackers' pace
 * rises with it), where it comes back to, when it started and got out (−1: not yet), how many times it went
 * down, its armor (0 to 100: a hit takes half from it while it lasts), the keys it has (a bit each, by
 * color), the groups already called in (a bit each), and for the recap: the secrets found of how many, the
 * attackers brought down of how many.
 */
export type Hold = {
  place: number;
  spawn: Vec3;
  checkpoint: Vec3;
  start: number;
  finish: number;
  downs: number;
  armor: number;
  keys: number;
  called: number;
  secrets: number;
  secretsHere: number;
  felled: number;
  attackersHere: number;
};
const HOLD = 'wall.hold';
export const hold = (e: Entity) => component<Hold>(e, HOLD);
/** Which group an attacker came in with. */
const WAVE = 'wall.wave';

/**
 * ITS NUMBERS: how long the defender is down before it is back at its checkpoint (s); its health; how much
 * armor it can have, and how much of a hit the armor takes; how long a fallen attacker stays before it is
 * carried off (s: down, its body still stands in the way); the attackers' eyes (they come looking for the
 * wall's defender: farther and wider than a guard on its round, 12 m and 100°); (stage 5o) how far the horn
 * of a group called in is heard (m: across a level).
 */
export const WALL_TUNING = Object.freeze({
  back: 3,
  health: 100,
  armor: { most: 100, takes: 0.5 },
  gone: 2,
  sight: { range: 30, degrees: 120 },
  horn: 80,
});

/**
 * A RISING PACE (stage 5h, fair since 5i: decision 0031, "los bots son muy perfectos"; `Fair`, @manifold/arms):
 * how an attacker fights by how far into the night it is (`pace`, from 0). Each takes a moment to see you
 * (0.6 s, down to 0.3), raises its weapon where you see and hear it (0.5 s, down to 0.3), aims where you were
 * 0.2 s before, with an error of 3.5 degrees (down to 1.5) that starts three times wider, its first shot
 * going by a meter's ear from you; at most two raise theirs at once; hit, it flinches for 0.4 s.
 */
export function paceOf(pace: number): Gunner {
  return {
    see: Math.max(18, 36 - 3 * pace),
    every: Math.max(45, GUNNER.every - 6 * pace),
    aim: Math.min(0.3, GUNNER.aim + 0.02 * pace),
    range: GUNNER.range,
    fair: {
      windup: Math.max(18, 30 - 2 * pace),
      spread: Math.max(1.5, 3.5 - 0.25 * pace),
      lag: 12,
      tokens: 2,
      miss: 0.8,
      flinch: 24,
    },
  };
}

/**
 * (Stage 5n, decision 0031: "enemies with roles, one new per level, shown from afar before you fight it") THE
 * ATTACKERS' ROLES, by an `attackers` zone's `role`:
 *
 *   1. the sentry: a dart, 40 of health (two darts), as the arena's gunners: the many;
 *   2. the caster: an orb (a glowing ball at 11 m/s, seen coming and stepped out of), 60 of health, slower
 *      to fire (its wind-up 0.7 s, seen and heard): it holds a place and makes you move;
 *   3. the charger: a stick, 80 of health, running at 9 m/s (the defender runs at 7.5), loud: it closes in,
 *      and one turns to meet it;
 *   4. the brute: a shotgun, 300 of health, walking at 3.2 m/s, a flinch of a fifteenth of a second (it
 *      hardly stops): what the launcher is for.
 */
export const ROLES = Object.freeze({
  1: { kind: 'dart', health: 40, walk: 4.5, run: 7.5, windup: 0, flinch: 24 },
  2: { kind: 'orb', health: 60, walk: 3.5, run: 5, windup: 42, flinch: 24 },
  3: { kind: 'stick', health: 80, walk: 5, run: 9, windup: 0, flinch: 12 },
  4: { kind: 'shotgun', health: 300, walk: 3.2, run: 4.5, windup: 24, flinch: 4 },
} as const satisfies Record<
  number,
  { kind: WeaponKind; health: number; walk: number; run: number; windup: number; flinch: number }
>);

const COLORS = [0x93d9c9, 0x4a9fd8, 0xd8c04a, 0x7ac25a];

/**
 * The defender: the games' character, with health; (stage 5n) an arsenal: the stick and the dart, forty darts,
 * the dart in its hands.
 */
function defender(world: World, player: number, at: Vec3, facing: Vec3, place: number, secretsHere: number) {
  const parts = characterParts({ player, facing, color: COLORS[(player - 1) % COLORS.length]! });
  world.createEntity({
    name: player === 1 ? 'defender' : `defender_${player}`,
    transform: { position: [...at], rotation: quat.identity() },
    body: parts.body,
    // (Stage 5k) Its jump, the grounded one: 1.1 m in 0.36 s, not the world's floaty 2 m.
    character: { ...parts.character, movement: { ...parts.character.movement, arc: { ...GROUNDED.movement.arc } } },
    appearance: parts.appearance,
    health: { most: WALL_TUNING.health },
    game: {
      [HOLD]: {
        place,
        spawn: [...at],
        checkpoint: [...at],
        start: world.tick,
        finish: -1,
        downs: 0,
        armor: 0,
        keys: 0,
        called: 1,
        secrets: 0,
        secretsHere,
        felled: 0,
        attackersHere: 0,
      } satisfies Hold,
      [WEAPON]: { kind: 'dart', ready: 0, strike: 0, struck: [] } satisfies Weapon,
      [ARSENAL]: {
        owned: ['stick', 'dart'],
        // (Stage 5o) The dart's magazine full, and 28 more carried.
        ammo: { darts: 28, shells: 0, bolts: 0, rockets: 0, grenades: 0, oil: 0 },
        loaded: { dart: 12 },
        reloading: -1,
      } satisfies Arsenal,
    },
  });
}

/** The attackers standing (not down). */
export const attackers = (world: World) => [...world.entities.values()].filter((e) => e.brain && (e.health?.down ?? -1) < 0);

/** A group's attackers in: each `attackers` zone of it, so many guards of its role, abreast, at the level's pace. */
function callIn(world: World, wave: number, place: number): number {
  let count = 0;
  for (const zone of [...world.entities.values()]) {
    if (zone.sensor?.kind !== 'attackers' || (zone.sensor.params.wave?.[0] ?? 1) !== wave || !zone.transform) continue;
    const n = zone.sensor.params.count?.[0] ?? 1;
    const role = ROLES[(zone.sensor.params.role?.[0] ?? 1) as keyof typeof ROLES] ?? ROLES[1];
    const facing = quat.rotate(zone.transform.rotation, [0, 0, -1]);
    const side = vec3.cross(facing, [0, 1, 0]);
    const pace = paceOf(place * 2 + (wave > 0 ? 1 : 0));
    for (let k = 0; k < n; k++) {
      const at = vec3.add(zone.transform.position, vec3.scale(side, (k - (n - 1) / 2) * 1.2));
      const g = guard(world, at, facing, null, role.kind);
      const fair = { ...pace.fair!, windup: Math.max(pace.fair!.windup, role.windup), flinch: role.flinch };
      setComponent(g, GUNNER_KEY, { ...pace, fair } satisfies Gunner);
      setComponent(g, WAVE, { wave });
      g.health = { ...g.health!, most: role.health, points: role.health };
      g.character!.movement.walk = { ...g.character!.movement.walk, speed: role.walk, run: role.run };
      g.watcher!.range = WALL_TUNING.sight.range;
      g.watcher!.cone = sinCosDegrees(WALL_TUNING.sight.degrees / 2)[1];
      count++;
    }
  }
  return count;
}

/**
 * THE WALL'S DAMAGE (stage 5n): the weapons' (`armsDamage`), and the defender's armor takes half of a hit
 * while it lasts.
 */
function wallDamage(world: World, d: Damage): number {
  const amount = armsDamage(world, d);
  const target = world.entities.get(d.target);
  const h = target && hold(target);
  if (!h || h.armor <= 0 || amount <= 0) return amount;
  const taken = Math.min(h.armor, Math.round(amount * WALL_TUNING.armor.takes));
  h.armor -= taken;
  return amount - taken;
}

/**
 * THE VERSION OF ITS RULES (stage 5.5c, decision 0033): it goes up when they change what a replay gives;
 * its replays are then recorded again, and no other game's. With the library's it uses, its `versions`.
 *
 *   1  stage 5.5c: as at the engine's version 49
 */
export const WALL_VERSION = 1;

/**
 * THE WALL'S RULES (stage 5h; levels to advance through since 5n, decision 0031): a level from its file, with
 * the games' kit; a defender at its start, with its arsenal; the attackers standing from the start, and each
 * group called in when the defender walks into its `trigger`. A key taken turns on its signal (the level's
 * doors read it); health, armor and ammunition taken; secrets found and attackers brought down counted. Down,
 * the defender is back at its checkpoint three seconds later; attackers down are carried off two seconds
 * later. The way out (`goal`) ends the level. What fights is the games' (@manifold/arms).
 */
export function createWall(levels: Readonly<Record<string, Level>>): Cartridge {
  const names = Object.keys(levels);
  return {
    id: 'wall',
    title: 'The wall',
    versions: { wall: WALL_VERSION, ...SHELL_VERSION, ...ARMS_VERSION, ...CHARACTER_VERSION, ...KIT_VERSION },
    kit: KIT,
    zones: WALL_ZONES,
    brains: ARMS_BRAINS,
    inputs: [...ARMS_INPUTS, ...SLOT_INPUTS],
    filterDamage: wallDamage,
    onDeclare(registry) {
      registry.declareVariable({
        name: 'wall.level',
        description: 'Which level of the wall is built: one of `games/wall/levels/`.',
        scope: 'startup',
        type: { kind: 'option', options: names },
        default: names[0]!,
      });
      registry.declareCommand({
        name: 'wall.down',
        description:
          'Every attacker standing goes down at once (stage 5h): to get through a level quickly (the browser tests). A world action: it enters at a step, and the replay has it.',
        args: [],
        inRecipes: true,
        onWorld(world) {
          for (const e of attackers(world)) world.hurt(e.id, e.health!.points, { kind: 'command' });
        },
      });
    },
    onStart(world, registry) {
      const name = String(registry.value('wall.level'));
      const level = levels[name]!;
      buildLevel(world, level);
      let secretsHere = 0;
      let attackersHere = 0;
      for (const zone of world.entities.values()) {
        const kind = zone.sensor?.kind;
        if (kind === 'secret') secretsHere++;
        if (kind === 'attackers') attackersHere += zone.sensor!.params.count?.[0] ?? 1;
        if (kind === 'weapon') {
          const weapon = WEAPON_KINDS[(zone.sensor!.params.kind?.[0] ?? 1) - 1] ?? 'dart';
          zone.appearance = { shape: 'box', size: [0.3, 0.3, 0.7], color: 0x8a7a5a, model: `arms.${weapon}` };
          zone.spin = { angularVelocity: [0, 1.5, 0] };
        }
        if (kind === 'key') {
          const color = [0xd84a3a, 0x3a7ad8, 0xe0c040][(zone.sensor!.params.color?.[0] ?? 1) - 1] ?? 0xd84a3a;
          zone.appearance = { shape: 'box', size: [0.12, 0.3, 0.06], color };
          zone.spin = { angularVelocity: [0, 2, 0] };
        }
        if (kind === 'health') zone.appearance = { shape: 'box', size: [0.3, 0.3, 0.3], color: 0xe8e8e0 };
        if (kind === 'armor') zone.appearance = { shape: 'box', size: [0.4, 0.4, 0.15], color: 0x6aa86a };
        if (kind === 'ammo') zone.appearance = { shape: 'box', size: [0.3, 0.2, 0.25], color: 0xb08a4a };
      }
      const place = Math.max(0, names.indexOf(name));
      defender(world, 1, level.spawn, level.facing, place, secretsHere);
      callIn(world, 0, place);
      const me = [...world.entities.values()].find((e) => e.character?.player === 1 && hold(e));
      if (me) hold(me)!.attackersHere = attackersHere;
    },
    onStep(world, events: readonly Event[]) {
      arms(world, events);
      fuses(world);
      const me = [...world.entities.values()].find((e) => e.character?.player === 1 && hold(e));
      const h = me && hold(me);
      if (!me || !h) return;
      // Down: three seconds, then back at its checkpoint, on its feet.
      if (me.health && me.health.down >= 0 && world.tick - me.health.down >= Math.round(WALL_TUNING.back * STEPS_PER_SECOND)) {
        world.revive(me.id, h.checkpoint);
        h.downs++;
      }
      for (const ev of events) {
        if (ev.type === 'down' && ev.target === me.id) notice(world, 1, 'wall.down');
        // (An attacker the defender brought down: its own, not one the console or another's blast did.)
        else if (ev.type === 'down' && ev.from === me.id && world.entities.get(ev.target)?.brain && h.finish < 0) h.felled++;
        else if (ev.type === 'sensorEntered' && ev.entity === me.id) {
          const zone = world.entities.get(ev.sensor);
          const kind = zone?.sensor?.kind;
          if (!zone || !kind || !zone.transform) continue;
          const take = (say: string, values?: readonly number[]) => {
            world.removeEntity(zone.id);
            notice(world, 1, say, values);
          };
          if (kind === 'fall') world.place(me, h.checkpoint);
          else if (kind === 'checkpoint' && !vec3.equals(h.checkpoint, zone.transform.position))
            h.checkpoint = [...zone.transform.position];
          else if (kind === 'key') {
            const color = (zone.sensor!.params.color?.[0] ?? 1) - 1;
            h.keys |= 1 << color;
            world.setSignal(`key_${KEY_COLORS[color] ?? 'red'}`, 1);
            take('wall.key', [color]);
          } else if (kind === 'health' && me.health && me.health.points < me.health.most) {
            me.health.points = Math.min(me.health.most, me.health.points + (zone.sensor!.params.amount?.[0] ?? 25));
            take('wall.health');
          } else if (kind === 'armor' && h.armor < WALL_TUNING.armor.most) {
            h.armor = Math.min(WALL_TUNING.armor.most, h.armor + (zone.sensor!.params.amount?.[0] ?? 50));
            take('wall.armor');
          } else if (kind === 'ammo') {
            const ammo = AMMO_KINDS[(zone.sensor!.params.kind?.[0] ?? 1) - 1] ?? 'darts';
            if (giveAmmo(me, ammo, zone.sensor!.params.amount?.[0] ?? 10) > 0) take('wall.ammo');
          } else if (kind === 'secret') {
            h.secrets++;
            take('wall.secret');
          } else if (kind === 'trigger') {
            const wave = zone.sensor!.params.wave?.[0] ?? 1;
            if (!(h.called & (1 << wave))) {
              h.called |= 1 << wave;
              callIn(world, wave, h.place);
              // (Stage 5o) The alarm: a horn where the defender is, heard across the level; those called hear
              // it and come to look (the attackers are guards: they go only to what they see or hear).
              world.emit({
                type: 'sound',
                sound: 'wall.horn',
                source: me.id,
                at: [...me.transform!.position],
                surface: null,
                speed: 0,
                energy: 0,
                radius: WALL_TUNING.horn,
              });
            }
            world.removeEntity(zone.id);
          } else if (kind === 'goal' && h.finish < 0) {
            h.finish = world.tick;
            notice(world, 1, 'wall.out');
          }
        }
      }
      // The fallen carried off, a little after they fell.
      for (const e of [...world.entities.values()])
        if (
          e.brain &&
          e.health &&
          e.health.down >= 0 &&
          world.tick - e.health.down >= Math.round(WALL_TUNING.gone * STEPS_PER_SECOND)
        )
          world.removeEntity(e.id);
    },
  };
}
