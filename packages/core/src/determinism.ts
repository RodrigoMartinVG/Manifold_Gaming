import type { Cartridge } from './cartridge';
import { stateHash } from './hash';
import { initPhysics } from './physics';
import { replayFromText, ReplayPlayer, sessionFor } from './replay';

/** A game, and its reference replays by name (`level-1`). */
export interface CheckedGame {
  cartridge: Cartridge;
  replays: Readonly<Record<string, string>>;
}

/** How one reference replay went, played here. */
export interface CheckResult {
  /** Its game's id (`tower`) and its name (`floor-1`). */
  game: string;
  name: string;
  steps: number;
  /** The hash its file ends with (the one Node gave when it was recorded). */
  expected: number;
  /** The one it gave here. */
  got: number;
  same: boolean;
  /** How long it took, in milliseconds, if a clock was given. */
  ms: number;
}

/**
 * THE DETERMINISM CHECK (stage 2.5a; every game's since 5.5c): plays every game's reference replays in this
 * program (a browser, Node), without drawing anything, and compares the hash each ends with against the
 * one in its file. Nothing here needs a screen or WebGL: it is the simulation alone, which is what must
 * give the same bits in every JavaScript engine. Until 5.5c it was the Dojo's own and played only its
 * replays: the tower's, the fortress's and the wall's were played only in Node, their rules never
 * compared in another browser. It plays `every` steps at a time and lets the page breathe in between
 * (`pause`), so it can show how it goes. (No clock of its own: the page gives one, `now`, for the times.)
 */
export async function checkReplays(
  games: readonly CheckedGame[],
  o: {
    onProgress?: (game: string, name: string, step: number, steps: number) => void;
    pause?: () => Promise<void>;
    now?: () => number;
    every?: number;
  } = {},
): Promise<CheckResult[]> {
  await initPhysics();
  const pause = o.pause ?? (() => Promise.resolve());
  const now = o.now ?? (() => 0);
  const every = o.every ?? 240;
  const results: CheckResult[] = [];
  for (const { cartridge, replays } of games)
    for (const [name, text] of Object.entries(replays)) {
      const game = cartridge.id;
      const replay = replayFromText(text);
      const start = now();
      const session = sessionFor(cartridge, replay);
      const player = new ReplayPlayer(replay);
      let busy = 0;
      while (!player.finished(session)) {
        player.feed(session);
        session.step();
        if (++busy === every) {
          busy = 0;
          o.onProgress?.(game, name, session.world.tick, replay.end.step);
          await pause();
        }
      }
      const got = stateHash(session.world);
      session.world.dispose();
      results.push({
        game,
        name,
        steps: replay.end.step,
        expected: replay.end.hash,
        got,
        same: got === replay.end.hash,
        ms: now() - start,
      });
      o.onProgress?.(game, name, replay.end.step, replay.end.step);
    }
  return results;
}
