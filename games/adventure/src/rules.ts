import { characterParts } from '@manifold/character';
import { quat, type Vec3 } from '@manifold/common';
import {
  buildLevel,
  component,
  levelFromText,
  type Cartridge,
  type Entity,
  type Event,
  type Progress,
  type World,
  type ZoneKinds,
} from '@manifold/core';
import { CELL, dungeon } from './dungeon';

/** The adventure's zones (stage 3k): what a dungeon's map gives its letters, and the void. */
export const ADVENTURE_ZONES: ZoneKinds = { gem: {}, key: {}, exit: {}, fall: {} };

/**
 * THE EXPLORER (stage 3k, a component of the game, 2.5): what the adventure keeps on its character,
 * the world's (hashed, in snapshots): the dungeon's seed, how deep it is, what it carries (its
 * inventory, `items`: `gem`, `key`), and which cells it already took something from (`col,row`), so a
 * saved game brings back the dungeon without them.
 */
export type Explorer = { dungeon: number; depth: number; items: string[]; taken: string[] };
const EXPLORER = 'adventure.explorer';
export const explorer = (e: Entity) => component<Explorer>(e, EXPLORER);

/** Where a zone of the map is, as its cell: `col,row`. */
const cellOf = (zone: Entity) => {
  const [x, , z] = zone.transform!.position;
  return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
};

/** How what lies in a dungeon is seen, floating where it is: a gem, a small blue ball; the key, a gold bar that turns; the exit, a red light as tall as a character. */
const LOOKS: Record<string, { shape: 'box' | 'sphere'; size: Vec3; color: number; opacity?: number; spins?: boolean }> = {
  gem: { shape: 'sphere', size: [0.35, 0.35, 0.35], color: 0x5ab4e6 },
  key: { shape: 'box', size: [0.6, 0.12, 0.2], color: 0xe8c050, spins: true },
  exit: { shape: 'box', size: [1.8, 1.6, 1.8], color: 0xb04040, opacity: 0.3 },
};

/**
 * A dungeon, built in the world: its map's walls, floor and zones, as a level (stage 3j); what lies in
 * it, seen (a zone has no look of its own: the game gives it one, as the Dojo does its stars).
 */
function buildDungeon(world: World, seed: number, depth: number) {
  const d = dungeon(seed, depth);
  buildLevel(world, levelFromText(d.text, { zones: ADVENTURE_ZONES }));
  for (const zone of world.entities.values()) {
    const look = zone.sensor && LOOKS[zone.sensor.kind];
    if (!look || !zone.transform) continue;
    zone.appearance = {
      shape: look.shape,
      size: look.size,
      color: look.color,
      ...(look.opacity ? { opacity: look.opacity } : {}),
    };
    if (look.spins) zone.spin = { angularVelocity: [0, 1.5, 0] };
  }
  return d;
}

/** The character of a player, if it has one. */
const characterOf = (world: World, player: number) => [...world.entities.values()].find((e) => e.character?.player === player);

/**
 * WHAT A SAVED GAME KEEPS (stage 3k, decision 0020): the player's progress, not the world. Version 2:
 * the dungeon's seed and depth, where the character is and where it looks, what it carries, and the
 * cells it took something from. Version 1 (the first, kept to be brought forward): the seed, the
 * depth, the position and the bag, without what was taken.
 */
export interface AdventureProgress {
  dungeon: number;
  depth: number;
  at: Vec3;
  facing: Vec3;
  items: string[];
  taken: string[];
}

export const ADVENTURE_PROGRESS: Progress<AdventureProgress> = {
  version: 2,
  migrations: {
    1: (old) => {
      const v1 = old as { seed: number; depth: number; position: Vec3; bag: string[] };
      return { dungeon: v1.seed, depth: v1.depth, at: v1.position, facing: [0, 0, 1], items: v1.bag, taken: [] };
    },
  },
  write(world, player) {
    const hero = characterOf(world, player);
    const ex = hero && explorer(hero);
    if (!hero?.transform || !hero.character || !ex) return null;
    return {
      dungeon: ex.dungeon,
      depth: ex.depth,
      at: [...hero.transform.position],
      facing: [...hero.character.facing],
      items: [...ex.items],
      taken: [...ex.taken],
    };
  },
  startup: (p) => [`adventure.dungeon ${p.dungeon}`, `adventure.depth ${p.depth}`],
  apply(world, player, p) {
    const hero = characterOf(world, player);
    const ex = hero && explorer(hero);
    if (!hero?.character || !ex) return;
    world.place(hero, p.at);
    hero.character.facing = [...p.facing];
    ex.items = [...p.items];
    ex.taken = [...p.taken];
    // What was already taken is not there.
    for (const zone of [...world.entities.values()])
      if ((zone.sensor?.kind === 'gem' || zone.sensor?.kind === 'key') && ex.taken.includes(cellOf(zone)))
        world.removeEntity(zone.id);
  },
};

/**
 * THE ACTION ADVENTURE (decision 0012), its start (stage 3k): a dungeon made from a seed, rooms joined
 * by corridors, a gem in the rooms, a key, and an exit the key opens, down to the next depth (a new
 * dungeon from the same seed). The character carries what it takes (its inventory). Its progress is
 * what a saved game keeps (decision 0020).
 */
export function createAdventure(): Cartridge {
  return {
    id: 'adventure',
    title: 'The adventure',
    zones: ADVENTURE_ZONES,
    progress: ADVENTURE_PROGRESS,
    onDeclare(registry) {
      registry.declareVariable({
        name: 'adventure.dungeon',
        description: "The dungeon's seed: the same seed, the same dungeon, at every depth (stage 3k).",
        scope: 'startup',
        type: { kind: 'integer', min: 0, max: 4294967295 },
        default: 1,
      });
      registry.declareVariable({
        name: 'adventure.depth',
        description: 'How deep the world is born (stage 3k): each depth, another dungeon from the same seed, with more rooms.',
        scope: 'startup',
        type: { kind: 'integer', min: 1, max: 99 },
        default: 1,
      });
    },
    onStart(world, registry) {
      const seed = Number(registry.value('adventure.dungeon'));
      const depth = Number(registry.value('adventure.depth'));
      const d = buildDungeon(world, seed, depth);
      world.createEntity({
        // (By its name, the console finds it: `inspect hero`, `set hero transform.position …`.)
        name: 'hero',
        transform: { position: [...d.spawn], rotation: quat.identity() },
        // The games' character (stage 4a: @manifold/character): the mannequin, no longer a bare capsule.
        ...characterParts({ player: 1, facing: [0, 0, 1], color: 0xd9a35a }),
        game: { [EXPLORER]: { dungeon: seed, depth, items: [], taken: [] } satisfies Explorer },
      });
    },
    onStep(world, events) {
      explore(world, events);
    },
  };
}

/** What the dungeon does with who walks in it: takes what it finds, opens the exit with the key, catches a fall. */
function explore(world: World, events: readonly Event[]) {
  const notice = (player: number, say: string, values?: readonly number[]) =>
    world.emit({ type: 'notice', say, player, ...(values ? { values } : {}) });
  for (const ev of events) {
    if (ev.type !== 'sensorEntered') continue;
    const zone = world.entities.get(ev.sensor);
    const hero = world.entities.get(ev.entity);
    const ex = hero && explorer(hero);
    const player = hero?.character?.player;
    if (!zone?.sensor || !ex || player === undefined || !hero.transform) continue;
    switch (zone.sensor.kind) {
      case 'gem':
      case 'key':
        ex.items.push(zone.sensor.kind);
        ex.taken.push(cellOf(zone));
        world.removeEntity(zone.id);
        notice(player, `adventure.${zone.sensor.kind}`, [ex.items.filter((i) => i === 'gem').length]);
        break;
      case 'exit': {
        const key = ex.items.indexOf('key');
        if (key < 0) {
          notice(player, 'adventure.locked');
          break;
        }
        // Down: the key stays in the lock, this dungeon goes, the next one comes, from the same seed.
        ex.items.splice(key, 1);
        ex.depth++;
        ex.taken = [];
        for (const e of [...world.entities.values()]) if (e.source) world.removeEntity(e.id);
        const d = buildDungeon(world, ex.dungeon, ex.depth);
        world.place(hero, d.spawn);
        notice(player, 'adventure.down', [ex.depth]);
        break;
      }
      case 'fall':
        world.place(hero, dungeon(ex.dungeon, ex.depth).spawn);
        notice(player, 'adventure.fell');
        break;
    }
  }
}

/** The adventure's cartridge. */
export const AdventureCartridge = createAdventure();
