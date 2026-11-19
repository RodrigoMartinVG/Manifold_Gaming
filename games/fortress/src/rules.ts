import { characterParts, GROUNDED, CHARACTER_VERSION } from '@manifold/character';
import { quat, vec3, type Vec3 } from '@manifold/common';
import {
  ARMS_BRAINS,
  ARMS_INPUTS,
  arms,
  fuses,
  guard,
  noticeOf,
  POUCH,
  STEALTH_INPUTS,
  STEALTH_ZONES,
  stealth,
  stealthDamage,
  WEAPON,
  type Aware,
  type Pouch,
  type Weapon,
  ARMS_VERSION,
} from '@manifold/arms';
import {
  buildLevel,
  component,
  type Cartridge,
  type Entity,
  type Event,
  type Level,
  type World,
  type ZoneKinds,
} from '@manifold/core';
import { KIT, KIT_VERSION } from '@manifold/kit';
import { followPlayers, notice, STEPS_PER_SECOND, SHELL_VERSION } from '@manifold/shell/run';

/**
 * The zones a level of the fortress understands: where one comes back to, where one falls, the way out
 * (its goal), the flame to take back, a pouch's item (smoke, a flare), and where a guard stands: on its
 * round (`guard`: it keeps to the level's nearest route) or at its post (`post`: it keeps there, facing
 * as the zone faces).
 */
export const FORTRESS_ZONES: ZoneKinds = {
  checkpoint: {},
  fall: {},
  goal: {},
  relic: {},
  guard: {},
  post: {},
  // (Stage 5m) A scroll to steal, off the safe way: an objective of one's own.
  scroll: {},
  ...STEALTH_ZONES,
};

/**
 * How an intruder is doing on a level: where it started and comes back to, when it started and got
 * out (−1: not yet), how many times it was caught (down) and seen (since 5l: a guard was alerted by it,
 * not glimpsed it), and whether it carries the flame; (stage 5m) how many scrolls it took of how many the
 * level has, and how many guards it took down.
 */
export type Run = {
  spawn: Vec3;
  checkpoint: Vec3;
  start: number;
  finish: number;
  caught: number;
  seen: number;
  relic: boolean;
  scrolls: number;
  scrollsHere: number;
  downs: number;
};
const RUN = 'fortress.run';
export const run = (e: Entity) => component<Run>(e, RUN);

/** Its numbers: how long a caught intruder is down (s) before it is back at its checkpoint; the flame's light it carries. */
export const FORTRESS_TUNING = Object.freeze({
  back: 3,
  health: 100,
  /** The flame, carried: a small light round it (it shows where it goes: the way out is harder than the way in). */
  flame: { radius: 2.6, intensity: 0.7 },
  /** Night: what it starts with in its pouch (stage 5l: three pebbles to throw, a noise a guard comes to check). */
  pouch: { smoke: 1, flare: 0, pebble: 3 } satisfies Pouch,
});

/**
 * (Stage 5l, decision 0031) HOW ITS GUARDS' AWARENESS FILLS: a third of a second right by one in light,
 * two seconds at the edge of its sight (12 m) at the light it needs to see at all; suspicious from a
 * third; out of sight a second and a half, emptying a third a second; alerted, three seconds lost before
 * it searches, ten seconds of search ("tens of seconds", the research says, by its senses); then warier
 * half a minute, its times at 0.6. The numbers of the genre (Mark of the Ninja's and Thief's guards take
 * a moment to be sure), short enough that standing in a lamp's light is still caught at once.
 */
export const AWARE: Readonly<Aware> = Object.freeze({
  near: 0.35,
  far: 2,
  suspicious: 0.35,
  decay: 0.35,
  grace: 1.5,
  lose: 3,
  search: 10,
  wary: 0.6,
  waryFor: 30,
});

/** Its guards are all wary (stage 5e): they shout, light lamps again, mind a guard down; (5l) and aware. */
const WARY_GUARD = Object.freeze({ shout: true, relight: true, notice: true, aware: AWARE });

/** A guard on its feet (its eyes count: a guard down does not see). */
export const standing = (e: Entity | undefined): e is Entity => !!e?.brain && (e.health?.down ?? -1) < 0;

const COLORS = [0x6a7a8a, 0x4a9fd8, 0xd86a4a, 0x7ac25a];

/** The intruder: the games' character, crouching and rolling, with a stick (for a blow from behind) and a pouch. */
function intruder(world: World, player: number, at: Vec3, facing: Vec3) {
  const parts = characterParts({ player, facing, color: COLORS[(player - 1) % COLORS.length]! });
  world.createEntity({
    name: player === 1 ? 'intruder' : `intruder_${player}`,
    transform: { position: [...at], rotation: quat.identity() },
    body: parts.body,
    // (Stage 5k) Its jump, the grounded one: 1.1 m in 0.36 s, not the world's floaty 2 m.
    character: { ...parts.character, movement: { ...parts.character.movement, arc: { ...GROUNDED.movement.arc } } },
    appearance: parts.appearance,
    health: { most: FORTRESS_TUNING.health },
    game: {
      [RUN]: {
        spawn: [...at],
        checkpoint: [...at],
        start: world.tick,
        finish: -1,
        caught: 0,
        seen: 0,
        relic: false,
        scrolls: 0,
        scrollsHere: [...world.entities.values()].filter((z) => z.sensor?.kind === 'scroll').length,
        downs: 0,
      } satisfies Run,
      [POUCH]: { ...FORTRESS_TUNING.pouch } satisfies Pouch,
      [WEAPON]: { kind: 'stick', ready: 0, strike: 0, struck: [] } satisfies Weapon,
    },
  });
}

/**
 * THE VERSION OF ITS RULES (stage 5.5c, decision 0033): it goes up when they change what a replay gives;
 * its replays are then recorded again, and no other game's. With the library's it uses, its `versions`.
 *
 *   1  stage 5.5c: as at the engine's version 49
 */
export const FORTRESS_VERSION = 1;

/**
 * THE FORTRESS'S RULES (stage 5f): a level from its file, with the games' kit; an intruder at its start;
 * its guards wary (they shout, light lamps again, mind a guard down: stage 5e), where its `guard` zones
 * are; what fights and the stealth (@manifold/arms), a blow from behind on a guard that does not see
 * taking it down. Caught (down), the intruder is back at its checkpoint three seconds later; a guard
 * taken down stays down. The flame, once taken, is carried, lit; the way out counts only with it, on the
 * level that has one.
 */
export function createFortress(levels: Readonly<Record<string, Level>>): Cartridge {
  const names = Object.keys(levels);
  return {
    id: 'fortress',
    title: 'The fortress',
    versions: { fortress: FORTRESS_VERSION, ...SHELL_VERSION, ...ARMS_VERSION, ...CHARACTER_VERSION, ...KIT_VERSION },
    kit: KIT,
    zones: FORTRESS_ZONES,
    brains: ARMS_BRAINS,
    inputs: [...ARMS_INPUTS, ...STEALTH_INPUTS],
    filterDamage: stealthDamage,
    onDeclare(registry) {
      registry.declareVariable({
        name: 'fortress.level',
        description: 'Which level of the fortress is built: one of `games/fortress/levels/`.',
        scope: 'startup',
        type: { kind: 'option', options: names },
        default: names[0]!,
      });
    },
    onStart(world, registry) {
      const level = levels[String(registry.value('fortress.level'))]!;
      buildLevel(world, level);
      for (const zone of [...world.entities.values()]) {
        if (!zone.sensor || !zone.transform) continue;
        if (zone.sensor.kind === 'guard' || zone.sensor.kind === 'post') {
          const facing = quat.rotate(zone.transform.rotation, [0, 0, -1]);
          guard(world, zone.transform.position, facing, zone.sensor.kind === 'post' ? false : null, 'stick', WARY_GUARD);
        }
        // The flame: a small light that stays where it is until it is taken.
        if (zone.sensor.kind === 'relic') {
          zone.appearance = { shape: 'sphere', size: [0.3, 0.3, 0.3], color: 0xffb04a };
          zone.lamp = { radius: FORTRESS_TUNING.flame.radius, intensity: 1, signal: null, on: true };
        }
        // A scroll: a small pale roll, turning slowly.
        if (zone.sensor.kind === 'scroll') {
          zone.appearance = { shape: 'box', size: [0.12, 0.12, 0.42], color: 0xe8dcb4 };
          zone.spin = { angularVelocity: [0, 1, 0] };
        }
        if (zone.sensor.kind === 'item') {
          const kind = zone.sensor.params.kind?.[0] ?? 1;
          zone.appearance = {
            shape: 'sphere',
            size: kind === 3 ? [0.18, 0.18, 0.18] : [0.3, 0.3, 0.3],
            color: kind === 2 ? 0xff6a3a : kind === 3 ? 0xb4ac9e : 0x8a8a84,
          };
          zone.spin = { angularVelocity: [0, 1.5, 0] };
        }
      }
      intruder(world, 1, level.spawn, level.facing);
    },
    onStep(world, events: readonly Event[]) {
      // Each player who joined, an intruder beside the first; one who left, none.
      const intruders = followPlayers(world, {
        ours: (e) => !!run(e),
        spawn: (first) => (first && run(first)?.spawn) ?? [0, 1, 0],
        make: (p, at, first) => intruder(world, p, at, first?.character?.facing ?? [0, 0, -1]),
      });
      arms(world, events);
      fuses(world);
      stealth(world, events);
      const relicHere = [...world.entities.values()].some((e) => e.sensor?.kind === 'relic');
      // Seen: a guard alerted by it, at this step (stage 5l: a glimpse that a guard let go is not being
      // seen; the shell's result counts the times: none, unseen).
      for (const g of world.entities.values()) {
        const n = noticeOf(g);
        if (!n || n.state !== 'alerted' || n.since !== world.tick || !standing(g)) continue;
        const who = world.entities.get(n.who);
        const r = who && run(who);
        if (r && r.finish < 0) r.seen++;
      }
      for (const ev of events) {
        // (Stage 5m) A guard taken down by an intruder: counted, for the level's recap.
        if (ev.type === 'down' && ev.from !== null) {
          const by = world.entities.get(ev.from);
          const r = by && run(by);
          if (r && r.finish < 0 && world.entities.get(ev.target)?.brain) r.downs++;
          continue;
        }
        if (ev.type !== 'sensorEntered') continue;
        const zone = world.entities.get(ev.sensor);
        const e = world.entities.get(ev.entity);
        const r = e && run(e);
        if (!zone?.sensor || !zone.transform || !e || !r) continue;
        switch (zone.sensor.kind) {
          case 'fall':
            world.place(e, r.checkpoint);
            break;
          case 'checkpoint':
            if (!vec3.equals(r.checkpoint, zone.transform.position)) {
              r.checkpoint = [...zone.transform.position];
              notice(world, e.character!.player, 'fortress.checkpoint');
            }
            break;
          case 'scroll':
            world.removeEntity(zone.id);
            r.scrolls++;
            notice(world, e.character!.player, 'fortress.scroll');
            break;
          case 'relic':
            world.removeEntity(zone.id);
            r.relic = true;
            e.lamp = { radius: FORTRESS_TUNING.flame.radius, intensity: FORTRESS_TUNING.flame.intensity, signal: null, on: true };
            notice(world, e.character!.player, 'fortress.flame');
            break;
          case 'goal':
            if (r.finish >= 0) break;
            if (r.relic || !relicHere) r.finish = world.tick;
            else notice(world, e.character!.player, 'fortress.need');
            break;
        }
      }
      // Caught: down three seconds, then back at its checkpoint (what it carries, it keeps).
      for (const e of intruders) {
        const r = run(e);
        if (!r || !e.health || e.health.down < 0) continue;
        if (world.tick - e.health.down >= Math.round(FORTRESS_TUNING.back * STEPS_PER_SECOND)) {
          world.revive(e.id, r.checkpoint);
          r.caught++;
          notice(world, e.character!.player, 'fortress.caught');
        }
      }
    },
  };
}
