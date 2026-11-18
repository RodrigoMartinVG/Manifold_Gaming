/** How a level went: how many steps it took (60 a second), how many stars it found, how many falls. */
export interface LevelResult {
  steps: number;
  stars: number;
  falls: number;
}

/** The version of the progress this code writes (decision 0020: kept data says its version). */
export const PROGRESS_VERSION = 1;

/**
 * A PLAYER'S WAY THROUGH A GAME (stage 5b), kept in their browser: how far it has gone and the best of
 * each level done. Not the world (3k's saved game is that, for a game that wants one): a level is
 * short, and starts again from its beginning.
 */
export interface Progress {
  version: typeof PROGRESS_VERSION;
  /** Whether the beginning was seen (its lines): "continue" does not show them again. */
  started: boolean;
  /** How many levels are open: the next to play is this one (0, the first; as many as there are: all done). */
  reached: number;
  /** The best of each level done, by its id: each number its own best (the fewest steps, the most stars, the fewest falls). */
  best: Record<string, LevelResult>;
}

export const NEW_PROGRESS: Readonly<Progress> = Object.freeze({
  version: PROGRESS_VERSION,
  started: false,
  reached: 0,
  best: {},
});

/**
 * The progress after a level was done: the next one open, and its bests kept. (Raced against someone's
 * ghost from a link, stage 5d, `open` false: its best kept, but no level opened by it.)
 */
export function finished(
  progress: Progress,
  levels: readonly string[],
  level: string,
  result: LevelResult,
  o: { open?: boolean } = {},
): Progress {
  const at = levels.indexOf(level);
  if (at < 0) return progress;
  const was = progress.best[level];
  return {
    ...progress,
    started: o.open === false ? progress.started : true,
    reached: o.open === false ? progress.reached : Math.max(progress.reached, at + 1),
    best: {
      ...progress.best,
      [level]: was
        ? {
            steps: Math.min(was.steps, result.steps),
            stars: Math.max(was.stars, result.stars),
            falls: Math.min(was.falls, result.falls),
          }
        : { ...result },
    },
  };
}

/**
 * Each older version's progress, brought one version forward (decision 0020: step by step, each
 * step a function of its own, tested with a file of that version). None yet: version 1 is the first.
 */
const FORWARD: Readonly<Record<number, (old: Record<string, unknown>) => Record<string, unknown>>> = {};

const isResult = (r: unknown): r is LevelResult =>
  !!r &&
  typeof r === 'object' &&
  ['steps', 'stars', 'falls'].every(
    (k) => Number.isFinite((r as Record<string, unknown>)[k]) && (r as Record<string, number>)[k]! >= 0,
  );

/**
 * What was kept, as this version's progress: brought forward from an older version; new if there is
 * none, if it is not progress, or if it is of a newer version than this code (a page that went back
 * to an older engine: it starts again rather than read what it does not know).
 */
export function progressFrom(kept: unknown): Progress {
  if (!kept || typeof kept !== 'object') return { ...NEW_PROGRESS, best: {} };
  let data = kept as Record<string, unknown>;
  let version = data.version;
  while (typeof version === 'number' && version < PROGRESS_VERSION && FORWARD[version]) {
    data = FORWARD[version]!(data);
    version = data.version;
  }
  if (version !== PROGRESS_VERSION) return { ...NEW_PROGRESS, best: {} };
  const reached = Number.isInteger(data.reached) && (data.reached as number) >= 0 ? (data.reached as number) : 0;
  const best: Record<string, LevelResult> = {};
  if (data.best && typeof data.best === 'object')
    for (const [level, r] of Object.entries(data.best as Record<string, unknown>)) if (isResult(r)) best[level] = { ...r };
  return { version: PROGRESS_VERSION, started: data.started === true, reached, best };
}
