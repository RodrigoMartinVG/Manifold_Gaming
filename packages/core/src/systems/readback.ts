import { bodyMass } from '../physics';
import { HIT_HEARD, hitRadius } from '../sound';
import type { EntityId } from '../types';
import { STEP, type World } from '../world';
import { type Vec3, vec3 } from '@manifold/common';

export function readBack(world: World) {
  const g = world.uniformGravity();
  const gone: EntityId[] = [];
  for (const e of world.entities.values()) {
    if (!e.body || !e.transform || e.body.type === 'fixed') continue;
    // (Not copied: reading gives the body a new velocity, and no one changes one in place.)
    const before = e.body.linearVelocity;
    world.physics.read(e.body.handle, e.transform, e.body);
    if (e.body.type !== 'dynamic') continue;
    // Out of the world (stage 4.5b): what the physics moves, past `FARTHEST` from the origin, is gone
    // (a ball out of a level without a void fell for ever, and the physics went on with it). Never a
    // character: what becomes of one is its game's.
    if (!e.character && vec3.length(e.transform.position) > world.edge) {
      gone.push(e.id);
      continue;
    }
    // Only as a contact begins (stage 4.5's close): what it was pressed against, or slides along, it does
    // not strike again on every step. (Asked first: most bodies begin no contact in a step, and the rest
    // of world is then not worked out. The order of the two questions changes nothing of what is heard.)
    const struck = world.physics.struck(e.body.handle);
    if (struck.length === 0) continue;
    // What its contacts did to its velocity, beyond holding it up against gravity (stage 4.5's close: a
    // crate at rest takes back a step of gravity on every step, 0.6 J for its 45 kg, and was heard on
    // every one; the author heard it).
    const contact = vec3.sub(vec3.sub(e.body.linearVelocity, before), vec3.scale(g, STEP));
    const fall = vec3.length(g);
    const up = fall > 1e-9 ? vec3.scale(g, -1 / fall) : ([0, 0, 0] as Vec3);
    const change = vec3.sub(contact, vec3.scale(up, Math.min(Math.max(vec3.dot(contact, up), 0), fall * STEP)));
    // Its mass from its density and its shape, here (asking the physics, a call into WebAssembly for
    // every body on every step, took the stress room's step near its budget): the same number.
    const energy = 0.5 * bodyMass(e.body) * vec3.dot(change, change);
    if (energy < HIT_HEARD) continue;
    // On what: the first thing it began to touch (its material), or its own.
    const against = world.entityOfHandle(struck[0]!);
    world.emit({
      type: 'sound',
      sound: 'hit',
      source: e.id,
      at: [...e.transform.position],
      surface: against?.body?.material ?? e.body.material ?? null,
      speed: vec3.length(before),
      energy,
      radius: hitRadius(energy),
      against: against?.id ?? null,
    });
  }
  for (const id of gone) world.removeEntity(id);
}
