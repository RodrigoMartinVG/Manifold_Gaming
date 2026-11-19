import type { Cartridge, Entity, World } from '@manifold/core';
import { hold, createWall } from './rules';
import { WALL_LEVELS } from './levels';

/**
 * THE WALL WITHOUT A SCREEN (stage 5.5b): its rules with its levels, the levels in order, and when one
 * is done; what a test, a server or a check plays. The page (`game.ts`) adds what is seen and heard.
 */
export const WALL_CARTRIDGE: Cartridge = createWall(WALL_LEVELS);

/** Its levels, in order: each one's recipe, its name's key and its gold time (s). */
export const WALL_LEVEL_LIST = [
  { id: 'walk', recipe: 'wall.level level-1', name: 'wall.level.1', gold: 82 },
  { id: 'gatehouse', recipe: 'wall.level level-2', name: 'wall.level.2', gold: 106 },
  { id: 'towers', recipe: 'wall.level level-3', name: 'wall.level.3', gold: 148 },
  { id: 'gate', recipe: 'wall.level level-4', name: 'wall.level.4', gold: 129 },
];

/** Whether the level being played is done, and how it went (the shell reads it on every frame). */
export function wallDone(_: World, hero: Entity | undefined) {
  const h = hero && hold(hero);
  if (!h || h.finish < 0) return null;
  const notes: [string, ...string[]][] = [
    ...(h.secretsHere > 0 ? [['wall.recap.secrets', String(h.secrets), String(h.secretsHere)] as [string, ...string[]]] : []),
    ['wall.recap.felled', String(h.felled), String(h.attackersHere)],
  ];
  return { steps: h.finish - h.start, stars: h.downs === 0 ? 1 : 0, falls: h.downs, notes };
}
