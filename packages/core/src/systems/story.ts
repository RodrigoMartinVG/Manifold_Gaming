import type { World } from '../world';

/**
 * THE STORY'S PIECES (stage 4f), after the signals: each active objective whose signal is on is done
 * (`objective`, done), and the one it leads to becomes active (`objective`, active); each scene whose
 * signal is on and has not played, plays (`scene`). What they say is keys of the game's words.
 */
export function tell(world: World) {
  for (const e of [...world.entities.values()]) {
    const o = e.objective;
    if (o?.state !== 'active' || world.signal(o.when) === 0) continue;
    o.state = 'done';
    world.emit({ type: 'objective', name: e.name ?? String(e.id), say: o.say, state: 'done' });
    const next = o.then ? world.named(o.then)?.objective : undefined;
    if (next && next.state === 'waiting') {
      next.state = 'active';
      world.emit({ type: 'objective', name: o.then!, say: next.say, state: 'active' });
    }
  }
  for (const e of world.entities.values()) {
    const sc = e.scene;
    if (!sc || sc.played || world.signal(sc.when) === 0) continue;
    sc.played = true;
    world.emit({ type: 'scene', name: e.name ?? String(e.id), lines: sc.lines.map((l) => ({ ...l })) });
  }
}
