import type { Cartridge } from './cartridge';
import { NO_INPUT } from './input';
import { ReplayPlayer, sessionFor, type Replay } from './replay';
import type { SessionSave } from './session';
import type { Entity, EntityId } from './types';
import { copyData, type World } from './world';

/** A window re-simulated, and how it went. */
export interface Resimulated {
  from: number;
  to: number;
  /** The first step at which one's own character was not as recorded, and what differed; null if it always was. */
  differs: { step: number; what: string } | null;
}

/**
 * RE-SIMULATING ONE'S OWN CHARACTER (stage 5.5c; decision 0016's reconciliation, its first harness, with no
 * network yet). Online, each copy predicts only its own character: when the server's word for step t − k
 * arrives, the copy puts its own character back as it was then and re-simulates only it up to now, the others
 * seen where they were. That holds only if what carries or stops one's own character is a function of the step
 * or kept in a history (0016), and until now nothing checked it.
 *
 * This plays a replay once, keeping every entity as it ends each step. Then, from each window's start, it goes
 * back to the world as it was there, gives the other players nothing to ask for (so their own simulation goes
 * elsewhere) and, before each step, puts every other entity where the recording had it. One's own character,
 * with only its own inputs and the console's changes, must end every step exactly as recorded. A piece that
 * breaks this (a hold kept outside the character's state, a carry that is not a function of the step) shows as
 * the first step at which it differs, and in what.
 *
 * It still steps the whole world (the others' simulation runs, and is overwritten): whether one character alone
 * can be stepped is the forest's F2 measure.
 */
export function resimulateOwn(
  cartridge: Cartridge,
  replay: Replay,
  player: number,
  o: { window: number; every: number; first?: number },
): Resimulated[] {
  const session = sessionFor(cartridge, replay);
  const play = new ReplayPlayer(replay);
  const starts: number[] = [];
  for (let s = o.first ?? o.every; s + o.window <= replay.end.step; s += o.every) starts.push(s);
  const inWindow = (step: number) => starts.some((s) => step >= s && step <= s + o.window);
  // Every entity as it ended each step a window covers; the session as it was at each window's start.
  const recorded = new Map<number, Map<EntityId, Entity>>();
  const saves = new Map<number, SessionSave>();
  const keep = (w: World) => new Map([...w.entities].map(([id, e]) => [id, copyData(e)] as const));
  while (true) {
    const tick = session.world.tick;
    if (inWindow(tick)) recorded.set(tick, keep(session.world));
    if (starts.includes(tick)) saves.set(tick, session.save());
    if (play.finished(session)) break;
    play.feed(session);
    session.step();
  }
  const results: Resimulated[] = [];
  for (const from of starts) {
    const to = from + o.window;
    session.load(saves.get(from)!);
    const own = [...recorded.get(from)!.values()].find((e) => e.character?.player === player)?.id;
    if (own === undefined) {
      results.push({ from, to, differs: { step: from, what: `no character of player ${player}` } });
      continue;
    }
    // The others ask for nothing from here: whatever they do, the recording puts them back.
    for (const p of session.world.players) if (p !== player) session.setInput(p, NO_INPUT);
    let differs: Resimulated['differs'] = null;
    for (let step = from + 1; step <= to && !differs; step++) {
      for (const c of replay.changes) if (c.step === step) session.registry.run(c.line, 'console');
      for (const i of replay.inputs) if (i.step === step && i.player === player) session.setInput(i.player, i.input);
      placeOthers(session.world, recorded.get(step - 1)!, own);
      session.step();
      const now = session.world.entities.get(own);
      const then = recorded.get(step)!.get(own);
      const what = !now || !then ? 'its character is gone' : firstDifference(copyData(now), then, 'own');
      if (what) differs = { step, what };
    }
    results.push({ from, to, differs });
  }
  session.world.dispose();
  return results;
}

/** Every entity but one's own where the recording had it, moving as it moved (only those that are not already so). */
function placeOthers(world: World, recorded: ReadonlyMap<EntityId, Entity>, own: EntityId) {
  for (const [id, r] of recorded) {
    const e = world.entities.get(id);
    if (id === own || !e?.transform || !r.transform) continue;
    const moved =
      firstDifference(e.transform, r.transform, '') !== null ||
      (e.body &&
        r.body &&
        (firstDifference(e.body.linearVelocity, r.body.linearVelocity, '') !== null ||
          firstDifference(e.body.angularVelocity, r.body.angularVelocity, '') !== null));
    if (!moved) continue;
    e.transform.rotation = copyData(r.transform.rotation);
    world.place(e, r.transform.position);
    if (e.body && r.body) {
      e.body.linearVelocity = copyData(r.body.linearVelocity);
      e.body.angularVelocity = copyData(r.body.angularVelocity);
      world.physics.setKinematicVelocity(e.body.handle, e.body.linearVelocity, e.body.angularVelocity);
    }
    if (e.character && r.character) Object.assign(e.character, copyData(r.character));
  }
}

/** The first place where two plain values differ, to the bit (`own.character.velocity.1`), or null. */
function firstDifference(a: unknown, b: unknown, at: string): string | null {
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) ? null : `${at}: ${a} ≠ ${b}`;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${at}: ${a.length} ≠ ${b.length} items`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDifference(a[i], b[i], `${at}.${i}`);
      if (d) return d;
    }
    return null;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const d = firstDifference((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${at}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return a === b ? null : `${at}: ${String(a)} ≠ ${String(b)}`;
}
