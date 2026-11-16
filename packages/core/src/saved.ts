import type { Registry } from '@manifold/commands';
import type { Cartridge } from './cartridge';
import type { PlainData } from './types';
import { SIMULATION_VERSION } from './version';
import type { World } from './world';

/** The envelope's own version: what a saved game looks like around a game's progress. */
export const SAVE_FORMAT = 1;

/**
 * WHAT A GAME SAVES (stage 3k, decision 0020): the player's progress, as plain data the game defines,
 * with its own version; never a snapshot (that belongs to one engine version). The game says how to
 * write it from the world, which startup values it asks for (the seed, the depth), how to put it into
 * a world born from them, and how to bring each old version forward to the next.
 */
export interface Progress<P = PlainData> {
  /** The progress's version now. */
  readonly version: number;
  /** For each version it ever had, how to turn one into the next (`1` takes a version 1 into a 2). */
  readonly migrations: Readonly<Record<number, (old: unknown) => unknown>>;
  /** A player's progress, from the world (null: nothing to save, like no character). */
  write(world: World, player: number): P | null;
  /** The startup values it asks for, as recipe lines. */
  startup(progress: P): string[];
  /** Into a world born from those values, at its first step (as a world change: `progress`). */
  apply(world: World, player: number, progress: P): void;
}

/** A saved game: the envelope around the progress. JSON, as it is kept. */
export interface SavedGame {
  save: number;
  game: string;
  version: number;
  /** The simulation version that wrote it: to say it; nothing refuses a save for it. */
  engine: number;
  /** When it was made (the day, ISO). */
  made: string;
  progress: unknown;
}

/** A saved game of a player, now (null if the game has nothing to save). */
export function saveGame(
  cartridge: Cartridge,
  world: World,
  player: number,
  made = new Date().toISOString().slice(0, 10),
): SavedGame | null {
  const progress = cartridge.progress?.write(world, player);
  if (!cartridge.progress || progress === null || progress === undefined) return null;
  return {
    save: SAVE_FORMAT,
    game: cartridge.id,
    version: cartridge.progress.version,
    engine: SIMULATION_VERSION,
    made,
    progress,
  };
}

/**
 * A saved game read back (its text, or its data), with its progress brought forward to the version
 * the game has now, one version at a time. One of another game, newer than the game, or with a
 * version no migration brings forward, throws, with why.
 */
export function readSave(cartridge: Cartridge, saved: string | SavedGame): { progress: unknown; from: number } {
  const s = (typeof saved === 'string' ? JSON.parse(saved) : saved) as Partial<SavedGame>;
  const p = cartridge.progress;
  if (!p) throw new Error(`${cartridge.id} saves nothing`);
  if (s.save !== SAVE_FORMAT)
    throw new Error(`a saved game of format ${String(s.save)}: this engine reads format ${SAVE_FORMAT}`);
  if (s.game !== cartridge.id) throw new Error(`a saved game of ${String(s.game)}, not of ${cartridge.id}`);
  const from = Number(s.version);
  if (!Number.isInteger(from) || from < 1) throw new Error(`a saved game with no version`);
  if (from > p.version)
    throw new Error(`a saved game of version ${from}: this ${cartridge.id} is version ${p.version} (newer than it)`);
  let progress = s.progress;
  for (let v = from; v < p.version; v++) {
    const step = p.migrations[v];
    if (!step) throw new Error(`a saved game of version ${from}: nothing brings version ${v} forward`);
    progress = step(progress);
  }
  return { progress, from };
}

/**
 * A saved game as a recipe (decision 0020): the startup values its progress asks for, and, once the
 * world is born, its progress for player 1 as a world change. Loading it is loading this recipe.
 */
export function saveRecipe(cartridge: Cartridge, saved: string | SavedGame): string {
  const { progress } = readSave(cartridge, saved);
  return [...cartridge.progress!.startup(progress as never), 'wait 1', `progress 1 ${JSON.stringify(progress)}`].join('\n');
}

/** The `progress` world change, for a game that saves. */
export function declareProgress(registry: Registry<World>, cartridge?: Cartridge) {
  const p = cartridge?.progress;
  if (!p) return;
  const parse = (text: string): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  };
  registry.declareCommand({
    name: 'progress',
    description:
      "A player's progress put into the world (stage 3k, decision 0020): what loading a saved game does, at the first step of a world born from its startup values. `progress 1 {…}`, in JSON.",
    args: [
      { name: 'player', type: { kind: 'integer', min: 1, max: 64 } },
      { name: 'progress', type: { kind: 'rest' } },
    ],
    inRecipes: true,
    check: (_, [, text], out) => {
      if (parse(String(text)) !== undefined) return true;
      out.write('progress: in JSON, as a saved game has it', 'error');
      return false;
    },
    onWorld: (world, [player, text]) => {
      const progress = parse(String(text));
      if (progress !== undefined) p.apply(world, Number(player), progress as never);
    },
  });
}
