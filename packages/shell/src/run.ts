import type { Vec3 } from '@manifold/common';
import { STEP, type Entity, type World } from '@manifold/core';

/**
 * A LEVEL'S RUN, THE GAMES' (stage 5.5h, the audit's G1): what every cartridge copied, headless, in the
 * library. Each game keeps its own component's key, its own words and the order it does things in (its
 * replays' hashes depend on it): these are the pieces it puts together.
 */

/**
 * THE VERSION OF ITS RULES (stage 5.5h): what a level's run decides (who joins beside the first, what is
 * said), as every game whose rules use it names it in its `versions` (decision 0033, stage 5.5c).
 *
 *   1  stage 5.5h: as each game's run was, to the bit
 */
export const SHELL_VERSION = { shell: 1 } as const;

/** The steps in a second, as a whole number: `* 60` was written for it in five places. */
export const STEPS_PER_SECOND = Math.round(1 / STEP);

/** What a game says to one player (a notice), by a key of its words, with its numbers (decision 0019). */
export function notice(world: World, player: number, say: string, values?: readonly number[]) {
  world.emit({ type: 'notice', say, player, ...(values ? { values } : {}) });
}

/**
 * THE PLAYERS WHO JOINED, BESIDE THE FIRST: each player in the match without a character of the game's gets
 * one, `make`, 1.2 m further to the right of where the first started (`spawn`) for each player after it;
 * one who left loses it, unless it `stays` (a training dummy, a bot). With `needsFirst`, none without
 * player 1's (a level with no characters). The characters it found, before any was made: what a game goes
 * on with in its step.
 */
export function followPlayers(
  world: World,
  o: {
    ours?: (e: Entity) => boolean;
    spawn: (first: Entity | undefined) => Vec3;
    make: (player: number, at: Vec3, first: Entity | undefined) => void;
    stays?: (e: Entity) => boolean;
    needsFirst?: boolean;
  },
): Entity[] {
  const ours = [...world.entities.values()].filter((e) => e.character && (o.ours?.(e) ?? true));
  const first = ours.find((e) => e.character!.player === 1);
  if (o.needsFirst && !first) return ours;
  const spawn = o.spawn(first);
  for (const p of world.players)
    if (p !== 1 && !ours.some((e) => e.character!.player === p)) o.make(p, [spawn[0] + 1.2 * (p - 1), spawn[1], spawn[2]], first);
  for (const e of ours) {
    const p = e.character!.player;
    if (p !== 1 && !(o.stays?.(e) ?? false) && !world.players.has(p)) world.removeEntity(e.id);
  }
  return ours;
}

/**
 * A GAME'S FILES BY NAME (stage 5.5h, G2: each game copied the same lines for its levels and its replays): what
 * a glob of its folder gives (`import.meta.glob(…, { query: '?raw', import: 'default', eager: true })`, which
 * must stay in the game's own file: it is resolved where it is written), by each file's name without its
 * folder and its extension (`floor-1`), each read by `read`.
 */
export function byName<T = string>(
  files: Readonly<Record<string, string>>,
  read: (text: string) => T = (t) => t as T,
): Readonly<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(files).map(([path, text]) => [path.replace(/^.*\/([^/]+)\.[^./]+$/, '$1'), read(text)]),
  );
}
