import type { Memory } from './cartridge';
import type { Session } from './session';
import type { EntityId } from './types';
import { copyData } from './world';

/**
 * THE HOST OF THE BOTS (stage 4e, decision 0023): whoever hosts a match (the page alone, the server,
 * a test's harness) asks it, before each step, to think for every character with a `brain`: its game's
 * brain, given the world as it is and the bot's memory, says what the bot asks for, and that goes into
 * the session as any player's input does (so replays record it, and every copy gets it). A copy that
 * does not host never calls it; a replay playing does not either. A person can take a bot over
 * (`possess`): then its brain waits. The memories are the host's, plain data, out of the hash; its
 * snapshots carry them (`save`, `load`).
 */
export class BotHost {
  private memories = new Map<EntityId, Memory>();
  /** The bots people drive now: the bot's player, and who drives it. */
  readonly possessed = new Map<number, number>();

  /** Before a step: every bot's brain, and what each asks for into the session. */
  think(session: Session) {
    const brains = session.cartridge.brains;
    if (!brains) return;
    const world = session.world;
    const alive = new Set<EntityId>();
    for (const e of world.entities.values()) {
      const c = e.character;
      if (!e.brain || !c) continue;
      alive.add(e.id);
      if (this.possessed.has(c.player)) continue;
      const brain = brains[e.brain.name];
      if (!brain) continue;
      let memory = this.memories.get(e.id);
      if (!memory) this.memories.set(e.id, (memory = {}));
      session.setInput(c.player, brain(world, e, memory));
    }
    // A bot that is gone, forgotten.
    for (const id of this.memories.keys()) if (!alive.has(id)) this.memories.delete(id);
  }

  /** A bot's memory, by its entity (what the console shows), if it has thought yet. */
  memoryOf(id: EntityId): Readonly<Memory> | undefined {
    return this.memories.get(id);
  }

  /** The memories, copied (to keep with a snapshot of the match). */
  save(): [EntityId, Memory][] {
    return copyData([...this.memories]);
  }

  /** Back to memories saved with a snapshot (another world: nothing remembered, if none). */
  load(saved: readonly [EntityId, Memory][] = []) {
    this.memories = new Map(copyData([...saved]));
  }
}
