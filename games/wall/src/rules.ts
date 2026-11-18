import { characterParts } from '@manifold/character';
import { quat, sinCosDegrees, vec3, type Vec3 } from '@manifold/common';
import {
  ARMS_BRAINS,
  ARMS_INPUTS,
  arms,
  armsDamage,
  fuses,
  guard,
  GUNNER,
  GUNNER_KEY,
  WEAPON,
  WEAPON_KINDS,
  type Gunner,
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
 * The zones a level of the wall understands: where the defender comes back to, where one falls, a weapon
 * on its rack (`kind`, as the games' racks: 1 dart, 2 bolt, 5 shotgun, 6 launcher), and where attackers
 * come in: in which wave, how many, with what (`kind`, as a rack's), each keeping to the level's nearest
 * route (their way in).
 */
export const WALL_ZONES: ZoneKinds = {
  checkpoint: {},
  fall: {},
  weapon: { kind: 1 },
  attackers: { wave: 1, count: 1, kind: 1 },
};

/**
 * How the defender is doing on a level: where it comes back to, when it started and held (−1: not yet),
 * how many times it went down, the wave under way (0 before the first) and how many the level has,
 * when the next one comes (the step; −1 while one is under way), and which level of the night it is (0,
 * the first: the pace rises with it).
 */
export type Hold = {
  place: number;
  spawn: Vec3;
  checkpoint: Vec3;
  start: number;
  finish: number;
  downs: number;
  wave: number;
  waves: number;
  next: number;
};
const HOLD = 'wall.hold';
export const hold = (e: Entity) => component<Hold>(e, HOLD);
/** Which wave an attacker came in with. */
const WAVE = 'wall.wave';

/**
 * ITS NUMBERS: before the first wave, and between two (s); how long the defender is down before it is
 * back at its checkpoint (s); its health.
 */
export const WALL = Object.freeze({
  first: 3,
  between: 4,
  back: 3,
  health: 100,
  /**
   * How long an attacker down stays (s) before it is carried off: down, its body still stands in the way
   * (the world's), and the next ones pushed against the fallen and stayed there (a wave that never ended).
   */
  gone: 2,
  /**
   * The attackers' eyes (m, degrees): they come to take the wall and look for its defender, farther and
   * wider than a guard on its rounds (12 m, 100°). From the gate they see across the yard.
   */
  sight: { range: 30, degrees: 120 },
});

/**
 * A RISING PACE (stage 5h): how the attackers of a wave fight, by how far into the night it is (`pace`:
 * the level's place times three, plus the wave's, from 0). From the arena's gunners (4g: a second to see
 * you, a shot a second and a half, an aim that goes 15% of the way each step) towards quicker ones: each
 * step of the pace a tenth of a second less to see and to shoot again, and two hundredths more of aim;
 * at most twice as quick, and an aim of 0.3 (at 0.3 a walking target is trailed by v·Δt·(1 − k)/k ≈ 0.18
 * m: most shots strike).
 */
export function paceOf(pace: number): Gunner {
  return {
    see: Math.max(30, GUNNER.see - 6 * pace),
    every: Math.max(45, GUNNER.every - 6 * pace),
    aim: Math.min(0.3, GUNNER.aim + 0.02 * pace),
    range: GUNNER.range,
  };
}

/** A line for one player's screen (the game's words: game.ts). */
const notice = (world: World, player: number, say: string, values?: readonly number[]) =>
  world.emit({ type: 'notice', say, player, ...(values ? { values } : {}) });

const COLORS = [0x93d9c9, 0x4a9fd8, 0xd8c04a, 0x7ac25a];

/** The defender: the games' character, with health, a dart in its hands. */
function defender(world: World, player: number, at: Vec3, facing: Vec3, waves: number, place: number) {
  const parts = characterParts({ player, facing, color: COLORS[(player - 1) % COLORS.length]! });
  world.createEntity({
    name: player === 1 ? 'defender' : `defender_${player}`,
    transform: { position: [...at], rotation: quat.identity() },
    body: parts.body,
    character: parts.character,
    appearance: parts.appearance,
    health: { most: WALL.health },
    game: {
      [HOLD]: {
        place,
        spawn: [...at],
        checkpoint: [...at],
        start: world.tick,
        finish: -1,
        downs: 0,
        wave: 0,
        waves,
        next: world.tick + Math.round(WALL.first * 60),
      } satisfies Hold,
      [WEAPON]: { kind: 'dart', ready: 0, strike: 0, struck: [] } satisfies Weapon,
    },
  });
}

/** The attackers standing (not down). */
export const attackers = (world: World) => [...world.entities.values()].filter((e) => e.brain && (e.health?.down ?? -1) < 0);

/**
 * THE WALL'S RULES (stage 5h): a level from its file, with the games' kit; a defender at its start; and
 * the waves. A few seconds after it starts, the first wave comes in where its `attackers` zones are (each
 * zone so many guards with its weapon, quicker as the night goes on: `paceOf`); when every attacker of a
 * wave is down, the next comes a few seconds later, the defender's health back; the last one down, the
 * level is held. Down, the
 * defender is back at its checkpoint three seconds later (the attackers let it go, and go back to their
 * way in); attackers taken down are carried off two seconds later. What fights is the games'
 * (@manifold/arms).
 */
export function createWall(levels: Readonly<Record<string, Level>>): Cartridge {
  const names = Object.keys(levels);
  return {
    id: 'wall',
    title: 'The wall',
    kit: KIT,
    zones: WALL_ZONES,
    brains: ARMS_BRAINS,
    inputs: [...ARMS_INPUTS],
    filterDamage: armsDamage,
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
          'Every attacker standing goes down at once (stage 5h): to see a level held, or a wave end, quickly (the browser tests). A world action: it enters at a step, and the replay has it.',
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
      let waves = 0;
      for (const zone of world.entities.values()) {
        if (zone.sensor?.kind === 'attackers') waves = Math.max(waves, zone.sensor.params.wave?.[0] ?? 1);
        if (zone.sensor?.kind === 'weapon') {
          const kind = WEAPON_KINDS[(zone.sensor.params.kind?.[0] ?? 1) - 1] ?? 'dart';
          zone.appearance = { shape: 'box', size: [0.3, 0.3, 0.7], color: 0x8a7a5a, model: `arms.${kind}` };
          zone.spin = { angularVelocity: [0, 1.5, 0] };
        }
      }
      defender(world, 1, level.spawn, level.facing, waves, Math.max(0, names.indexOf(name)));
    },
    onStep(world, events: readonly Event[]) {
      arms(world, events);
      fuses(world);
      const me = [...world.entities.values()].find((e) => e.character?.player === 1 && hold(e));
      const h = me && hold(me);
      if (!me || !h) return;
      // Down: three seconds, then back at its checkpoint, on its feet.
      if (me.health && me.health.down >= 0 && world.tick - me.health.down >= Math.round(WALL.back * 60)) {
        world.revive(me.id, h.checkpoint);
        h.downs++;
      }
      for (const ev of events)
        if (ev.type === 'down' && ev.target === me.id) notice(world, 1, 'wall.down');
        else if (ev.type === 'sensorEntered' && ev.entity === me.id) {
          const zone = world.entities.get(ev.sensor);
          if (zone?.sensor?.kind === 'fall') world.place(me, h.checkpoint);
          if (zone?.sensor?.kind === 'checkpoint' && zone.transform && !vec3.equals(h.checkpoint, zone.transform.position))
            h.checkpoint = [...zone.transform.position];
        }
      // The fallen carried off, a little after they fell.
      for (const e of [...world.entities.values()])
        if (e.brain && e.health && e.health.down >= 0 && world.tick - e.health.down >= Math.round(WALL.gone * 60))
          world.removeEntity(e.id);
      if (h.finish >= 0) return;
      // The wave under way, all down: the next a few seconds later; after the last, held.
      if (h.next < 0 && attackers(world).length === 0) {
        if (h.wave >= h.waves) {
          h.finish = world.tick;
          notice(world, 1, 'wall.held');
          return;
        }
        h.next = world.tick + Math.round(WALL.between * 60);
      }
      if (h.next >= 0 && world.tick >= h.next) {
        h.wave++;
        h.next = -1;
        // A breath between waves: on its feet, its health back.
        if (me.health && me.health.down < 0) me.health.points = me.health.most;
        const pace = paceOf(h.place * 3 + h.wave - 1);
        for (const zone of [...world.entities.values()]) {
          if (zone.sensor?.kind !== 'attackers' || (zone.sensor.params.wave?.[0] ?? 1) !== h.wave || !zone.transform) continue;
          const count = zone.sensor.params.count?.[0] ?? 1;
          const kind = WEAPON_KINDS[(zone.sensor.params.kind?.[0] ?? 1) - 1] ?? 'dart';
          const facing = quat.rotate(zone.transform.rotation, [0, 0, -1]);
          const side = vec3.cross(facing, [0, 1, 0]);
          for (let k = 0; k < count; k++) {
            const at = vec3.add(zone.transform.position, vec3.scale(side, (k - (count - 1) / 2) * 1.2));
            const g = guard(world, at, facing, null, kind);
            g.game = { ...g.game, [GUNNER_KEY]: { ...pace } satisfies Gunner, [WAVE]: { wave: h.wave } };
            g.watcher!.range = WALL.sight.range;
            g.watcher!.cone = sinCosDegrees(WALL.sight.degrees / 2)[1];
          }
        }
        notice(world, 1, 'wall.wave', [h.wave, h.waves]);
      }
    },
  };
}
