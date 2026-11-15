import { initPhysics, ReplayPlayer, replayFromText, sessionFor, stateHash } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { REFERENCE_REPLAYS } from './replays';

/** How one reference replay went, played here. */
export interface CheckResult {
  name: string;
  steps: number;
  /** The hash its file ends with (the one Node gave when it was recorded). */
  expected: number;
  /** The one it gave here. */
  got: number;
  same: boolean;
  /** How long it took, in milliseconds. */
  ms: number;
}

/**
 * THE DETERMINISM CHECK (stage 2.5a): plays every reference replay in this program (a browser, Node),
 * without drawing anything, and compares the hash it ends with against the one in its file. Nothing
 * here needs a screen or WebGL: it is the simulation alone, which is what must give the same bits in
 * every JavaScript engine. It plays a few hundred steps at a time and lets the page breathe in
 * between (`pause`), so it can show how it goes.
 */
export async function checkReferences(
  o: { onProgress?: (name: string, step: number, steps: number) => void; pause?: () => Promise<void> } = {},
): Promise<CheckResult[]> {
  await initPhysics();
  const pause = o.pause ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  const results: CheckResult[] = [];
  for (const [name, text] of Object.entries(REFERENCE_REPLAYS)) {
    const replay = replayFromText(text);
    const start = performance.now();
    const session = sessionFor(DojoCartridge, replay);
    const player = new ReplayPlayer(replay);
    let busy = 0;
    while (!player.finished(session)) {
      player.feed(session);
      session.step();
      if (++busy === 240) {
        busy = 0;
        o.onProgress?.(name, session.world.tick, replay.end.step);
        await pause();
      }
    }
    const got = stateHash(session.world);
    session.world.dispose();
    results.push({
      name,
      steps: replay.end.step,
      expected: replay.end.hash,
      got,
      same: got === replay.end.hash,
      ms: performance.now() - start,
    });
    o.onProgress?.(name, replay.end.step, replay.end.step);
  }
  return results;
}
