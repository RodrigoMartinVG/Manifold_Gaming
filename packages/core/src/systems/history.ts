import { HISTORY } from '../character';
import type { World } from '../world';

/**
 * HISTORY SYSTEM (stage 4c, decision 0022): each character's pose as it ends this step, at the end
 * of its history, which keeps the last `HISTORY` (the oldest goes).
 */
export function remember(world: World) {
  for (const e of world.entities.values()) {
    const c = e.character;
    if (!c || !e.transform) continue;
    c.history.push({ position: [...e.transform.position], rotation: [...e.transform.rotation], pitch: c.pitch, mode: c.mode });
    if (c.history.length > HISTORY) c.history.splice(0, c.history.length - HISTORY);
  }
}
