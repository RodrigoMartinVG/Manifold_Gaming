import type { Cartridge, Entity, World } from '@manifold/core';
import { runner, createTower } from './rules';
import { TOWER_LEVELS } from './levels';

/**
 * THE TOWER WITHOUT A SCREEN (stage 5.5b): its rules with its floors, the floors in order, and when one
 * is done; what a test, a server or a check plays. The page (`game.ts`) adds what is seen and heard.
 */
export const TOWER_CARTRIDGE: Cartridge = createTower(TOWER_LEVELS);

/** Its floors, in order: each one's recipe, its name's key and its gold time (s). */
export const TOWER_LEVEL_LIST = [
  { id: 'floor-1', recipe: 'tower.floor floor-1', name: 'tower.floor.1', gold: 20 },
  { id: 'floor-2', recipe: 'tower.floor floor-2', name: 'tower.floor.2', gold: 23 },
  { id: 'floor-3', recipe: 'tower.floor floor-3', name: 'tower.floor.3', gold: 59 },
  { id: 'floor-4', recipe: 'tower.floor floor-4', name: 'tower.floor.4', gold: 25 },
  { id: 'floor-5', recipe: 'tower.floor floor-5', name: 'tower.floor.5', gold: 18 },
  { id: 'floor-6', recipe: 'tower.floor floor-6', name: 'tower.floor.6', gold: 42 },
];

/** Whether the floor being played is done, and how it went (the shell reads it on every frame). */
export function towerDone(_: World, hero: Entity | undefined) {
  const run = hero && runner(hero);
  return run && run.finish >= 0 ? { steps: run.finish - run.start, stars: run.stars, falls: run.falls } : null;
}
