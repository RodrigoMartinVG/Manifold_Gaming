import { pressed } from '../input';
import type { World } from '../world';

/**
 * SIGNALS SYSTEM (stage 3c, decision 0018): every signal, in the order declared, from what the
 * zones noticed in this step and the signals above it. A change is an event (`signalChanged`).
 */
export function compute(world: World) {
  if (world.wires.length === 0) return;
  const value = new Map<string, number>();
  const zone = (name: string) => world.named(name)?.sensor;
  for (const w of world.wires) {
    const was = w.value;
    const on = (name: string) => (value.get(name) ?? 0) !== 0;
    switch (w.op) {
      case 'input':
        w.value = w.memory;
        break;
      case 'zone':
        w.value = (zone(w.reads[0]!)?.inside ?? []).filter((id) => {
          const e = world.entities.get(id);
          return e?.character !== undefined || e?.body?.type === 'dynamic';
        }).length;
        break;
      case 'used':
        w.value = (zone(w.reads[0]!)?.inside ?? []).filter((id) => {
          const c = world.entities.get(id)?.character;
          return c !== undefined && pressed(world, c.player, 'use');
        }).length;
        break;
      case 'seen':
        w.value = world.named(w.reads[0]!)?.watcher?.sees.length ?? 0;
        break;
      case 'any':
        w.value = w.reads.some(on) ? 1 : 0;
        break;
      case 'all':
        w.value = w.reads.every(on) ? 1 : 0;
        break;
      case 'not':
        w.value = on(w.reads[0]!) ? 0 : 1;
        break;
      case 'toggle': {
        const now = on(w.reads[0]!) ? 1 : 0;
        if (now && !w.memory) w.value = w.value ? 0 : 1;
        w.memory = now;
        break;
      }
      case 'latch':
        w.value = on(w.reads[0]!) ? 1 : on(w.reads[1]!) ? 0 : w.value;
        break;
    }
    value.set(w.name, w.value);
    if (w.value !== was) world.emit({ type: 'signalChanged', signal: w.name, value: w.value, was });
  }
}
