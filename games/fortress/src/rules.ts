import { characterParts, GROUNDED } from '@manifold/character';
import { quat, vec3, type Vec3 } from '@manifold/common';
import {
  ARMS_BRAINS,
  ARMS_INPUTS,
  arms,
  fuses,
  guard,
  POUCH,
  STEALTH_INPUTS,
  STEALTH_ZONES,
  stealth,
  stealthDamage,
  WEAPON,
  type Pouch,
  type Weapon,
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
import { KIT } from '@manifold/kit';

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
  ...STEALTH_ZONES,
};

/**
 * How an intruder is doing on a level: where it started and comes back to, when it started and got
 * out (−1: not yet), how many times it was caught (down) and seen (a guard's eyes found it), and
 * whether it carries the flame.
 */
export type Run = {
  spawn: Vec3;
  checkpoint: Vec3;
  start: number;
  finish: number;
  caught: number;
  seen: number;
  relic: boolean;
};
const RUN = 'fortress.run';
export const run = (e: Entity) => component<Run>(e, RUN);

/** Its numbers: how long a caught intruder is down (s) before it is back at its checkpoint; the flame's light it carries. */
export const FORTRESS = Object.freeze({
  back: 3,
  health: 100,
  /** The flame, carried: a small light round it (it shows where it goes: the way out is harder than the way in). */
  flame: { radius: 2.6, intensity: 0.7 },
  /** Night: what it starts with in its pouch. */
  pouch: { smoke: 1, flare: 0 } satisfies Pouch,
});

/** Its guards are all wary (stage 5e): they shout, light lamps again, mind a guard down. */
const WARY_GUARD = Object.freeze({ shout: true, relight: true, notice: true });

/** A guard on its feet (its eyes count: a guard down does not see). */
export const standing = (e: Entity | undefined): e is Entity => !!e?.brain && (e.health?.down ?? -1) < 0;

/** A line for one player's screen (the game's words: game.ts). */
const notice = (world: World, player: number, say: string) => world.emit({ type: 'notice', say, player });

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
    health: { most: FORTRESS.health },
    game: {
      [RUN]: {
        spawn: [...at],
        checkpoint: [...at],
        start: world.tick,
        finish: -1,
        caught: 0,
        seen: 0,
        relic: false,
      } satisfies Run,
      [POUCH]: { ...FORTRESS.pouch } satisfies Pouch,
      [WEAPON]: { kind: 'stick', ready: 0, strike: 0, struck: [] } satisfies Weapon,
    },
  });
}

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
          zone.lamp = { radius: FORTRESS.flame.radius, intensity: 1, signal: null, on: true };
        }
        if (zone.sensor.kind === 'item') {
          const flare = (zone.sensor.params.kind?.[0] ?? 1) === 2;
          zone.appearance = { shape: 'sphere', size: [0.3, 0.3, 0.3], color: flare ? 0xff6a3a : 0x8a8a84 };
          zone.spin = { angularVelocity: [0, 1.5, 0] };
        }
      }
      intruder(world, 1, level.spawn, level.facing);
    },
    onStep(world, events: readonly Event[]) {
      // Each player who joined, an intruder beside the first; one who left, none.
      const intruders = [...world.entities.values()].filter((e) => e.character && run(e));
      const first = intruders.find((e) => e.character!.player === 1);
      const spawn = (first && run(first)?.spawn) ?? [0, 1, 0];
      for (const p of world.players)
        if (p !== 1 && !intruders.some((e) => e.character!.player === p))
          intruder(world, p, [spawn[0] + 1.2 * (p - 1), spawn[1], spawn[2]], first?.character?.facing ?? [0, 0, -1]);
      for (const e of intruders)
        if (e.character!.player !== 1 && !world.players.has(e.character!.player)) world.removeEntity(e.id);
      arms(world, events);
      fuses(world);
      stealth(world, events);
      const relicHere = [...world.entities.values()].some((e) => e.sensor?.kind === 'relic');
      for (const ev of events) {
        // Seen by a guard's eyes, a guard on its feet (the shell's result counts the times: none, unseen).
        // (A guard down still has eyes, the world's watcher: it does not see, its game says.)
        if (ev.type === 'seen') {
          const who = world.entities.get(ev.entity);
          const r = who && run(who);
          if (standing(world.entities.get(ev.watcher)) && r && r.finish < 0) r.seen++;
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
          case 'relic':
            world.removeEntity(zone.id);
            r.relic = true;
            e.lamp = { radius: FORTRESS.flame.radius, intensity: FORTRESS.flame.intensity, signal: null, on: true };
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
        if (world.tick - e.health.down >= Math.round(FORTRESS.back * 60)) {
          world.revive(e.id, r.checkpoint);
          r.caught++;
          notice(world, e.character!.player, 'fortress.caught');
        }
      }
    },
  };
}
