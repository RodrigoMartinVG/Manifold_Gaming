import type { Cartridge, Entity, World } from '@manifold/core';
import { run, createFortress } from './rules';
import { FORTRESS_LEVELS } from './levels';

/**
 * THE FORTRESS WITHOUT A SCREEN (stage 5.5b): its rules with its levels, the levels in order, and when one
 * is done; what a test, a server or a check plays. The page (`game.ts`) adds what is seen and heard.
 */
export const FORTRESS_CARTRIDGE: Cartridge = createFortress(FORTRESS_LEVELS);

/** Its levels, in order: each one's recipe, its name's key and its gold time (s). */
export const FORTRESS_LEVEL_LIST = [
  { id: 'wall', recipe: 'fortress.level level-1', name: 'fortress.level.1', gold: 32 },
  { id: 'yard', recipe: 'fortress.level level-2', name: 'fortress.level.2', gold: 28 },
  { id: 'barracks', recipe: 'fortress.level level-3', name: 'fortress.level.3', gold: 59 },
  { id: 'keep', recipe: 'fortress.level level-4', name: 'fortress.level.4', gold: 60 },
];

/** Whether the level being played is done, and how it went (the shell reads it on every frame). */
export function fortressDone(_: World, hero: Entity | undefined) {
  const r = hero && run(hero);
  if (!r || r.finish < 0) return null;
  // (Stage 5m) Its recap: the scrolls taken of those the level has (if it has any), the guards taken down.
  const notes: [string, ...string[]][] = [
    ...(r.scrollsHere > 0 ? [['fortress.recap.scrolls', String(r.scrolls), String(r.scrollsHere)] as [string, ...string[]]] : []),
    ['fortress.recap.downs', String(r.downs)],
  ];
  return { steps: r.finish - r.start, stars: r.seen === 0 ? 1 : 0, falls: r.caught, notes };
}
