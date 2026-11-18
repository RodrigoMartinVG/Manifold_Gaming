import type { Vec3 } from '@manifold/common';
import { characterParts, PLATFORMER } from '@manifold/character';
import { quat, vec3 } from '@manifold/common';
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

/** The zones a floor of the tower understands: where you come back to, where you fall, a star, the goal. */
export const TOWER_ZONES: ZoneKinds = { checkpoint: {}, fall: {}, star: {}, goal: {} };

/** How a climber is doing on a floor: where it started and comes back to, when it started and reached the goal (−1: not yet), its falls and stars. */
export type Runner = { spawn: Vec3; checkpoint: Vec3; start: number; finish: number; falls: number; stars: number };
const RUNNER = 'tower.runner';
export const runner = (e: Entity) => component<Runner>(e, RUNNER);

/** The first climber's color, and the others'. */
const COLORS = [0x93d9c9, 0x4a9fd8, 0xd86a4a, 0x7ac25a, 0xc25ab8];

/** A climber: the games' character (stage 4a), moving as the platformer's (stage 5c), and its runner. */
function climber(world: World, player: number, at: Vec3, facing: Vec3) {
  const parts = characterParts({ player, facing, color: COLORS[(player - 1) % COLORS.length]! });
  world.createEntity({
    transform: { position: [...at], rotation: quat.identity() },
    body: parts.body,
    character: {
      ...parts.character,
      movement: { ...parts.character.movement, arc: { ...PLATFORMER.movement.arc }, wall: { ...PLATFORMER.movement.wall } },
      can: { ...parts.character.can, ...PLATFORMER.can },
    },
    appearance: parts.appearance,
    game: {
      [RUNNER]: { spawn: [...at], checkpoint: [...at], start: world.tick, finish: -1, falls: 0, stars: 0 } satisfies Runner,
    },
  });
}

const stars = (world: World) => [...world.entities.values()].filter((e) => e.sensor?.kind === 'star');

/**
 * THE TOWER'S RULES (stage 5b; its climber, the platformer's since 5c: its jump by height and time,
 * walls slid down and leapt off, ledges grabbed): a floor from its file, with the games' kit, and a
 * climber at its start (each player who joins, beside the first); a fall brings it back to its last
 * checkpoint, a star is taken, the goal ends the floor (the shell says so: its runner's `finish`). Its own rules, not the Dojo's (decision 0003: a game imports the engine,
 * never another game), and headless: what it keeps is the world's (hashed, in snapshots, in replays).
 */
export function createTower(levels: Readonly<Record<string, Level>>): Cartridge {
  const names = Object.keys(levels);
  const notice = (world: World, player: number, say: string, values?: readonly number[]) =>
    world.emit({ type: 'notice', say, player, ...(values ? { values } : {}) });
  return {
    id: 'tower',
    title: 'The tower',
    kit: KIT,
    zones: TOWER_ZONES,
    onDeclare(registry) {
      registry.declareVariable({
        name: 'tower.floor',
        description: 'Which floor of the tower is built: one of `games/tower/levels/`.',
        scope: 'startup',
        type: { kind: 'option', options: names },
        default: names[0]!,
      });
    },
    onStart(world, registry) {
      const level = levels[String(registry.value('tower.floor'))]!;
      buildLevel(world, level);
      // Its stars are seen: a small gold cube that spins, in each `star` zone.
      for (const star of stars(world)) {
        star.appearance = { shape: 'box', size: [0.4, 0.4, 0.4], color: 0xf0c040 };
        star.spin = { angularVelocity: [0.4, 2, 0.3] };
      }
      climber(world, 1, level.spawn, level.facing);
    },
    onStep(world, events: readonly Event[]) {
      // Each player who joined, a climber beside the first (1.2 m to its right); one who left, none.
      const climbers = [...world.entities.values()].filter((e) => e.character);
      const first = climbers.find((e) => e.character!.player === 1);
      const spawn = (first && runner(first)?.spawn) ?? [0, 1, 0];
      for (const p of world.players)
        if (p !== 1 && !climbers.some((e) => e.character!.player === p))
          climber(world, p, [spawn[0] + 1.2 * (p - 1), spawn[1], spawn[2]], first?.character?.facing ?? [0, 0, -1]);
      for (const e of climbers)
        if (e.character!.player !== 1 && !world.players.has(e.character!.player)) world.removeEntity(e.id);
      for (const ev of events) {
        if (ev.type !== 'sensorEntered') continue;
        const zone = world.entities.get(ev.sensor);
        const e = world.entities.get(ev.entity);
        const run = e && runner(e);
        const player = e?.character?.player;
        if (!zone?.sensor || !zone.transform || !e || !run || player === undefined) continue;
        switch (zone.sensor.kind) {
          case 'fall':
            world.place(e, run.checkpoint);
            run.falls++;
            notice(world, player, 'tower.fell');
            break;
          case 'checkpoint':
            if (!vec3.equals(run.checkpoint, zone.transform.position)) {
              run.checkpoint = [...zone.transform.position];
              notice(world, player, 'tower.checkpoint');
            }
            break;
          case 'star':
            world.removeEntity(zone.id);
            run.stars++;
            notice(world, player, 'tower.star', [run.stars, stars(world).length]);
            break;
          case 'goal':
            if (run.finish < 0) run.finish = world.tick;
            break;
        }
      }
    },
  };
}
