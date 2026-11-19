import { hitRadius } from '../sound';
import type { Entity, EntityId } from '../types';
import type { World } from '../world';
import { quat, type Vec3, vec3 } from '@manifold/common';

/**
 * BREAKS SYSTEM (stage 3e): for every whole breakable with a body, what the physics moves that touches
 * it now, and with how much energy it came: half its mass times its speed squared, its speed as it was
 * before this step (its component still has it: it is read back after this phase). The first hit at
 * least its threshold breaks it (`breakApart`).
 */
export function shatter(world: World) {
  for (const e of [...world.entities.values()]) {
    const b = e.breakable;
    if (!b || b.broken || !e.body) continue;
    for (const handle of world.physics.touching(e.body.handle)) {
      const other = world.entityOfHandle(handle);
      if (other?.body?.type !== 'dynamic') continue;
      const v = other.body.linearVelocity;
      const energy = 0.5 * world.physics.massOf(handle) * vec3.dot(v, v);
      if (energy >= b.threshold) {
        breakApart(world, e, other.id, energy);
        break;
      }
    }
  }
}

/**
 * Breaks something (stage 3e; the console or a game may, too): it is broken (a lamp gives no light),
 * its body goes (it stops colliding), a few large pieces the physics moves fly from where it was
 * (in the hash: they are the world's), and the break is an event with a seed for the fragments. The
 * pieces: as many as its size asks for (one per 0.2 m of its largest side, 2 at least, 6 at most), a
 * cube a third of its smallest side, out at 1 to 3 m/s from the world's randomness.
 */
export function breakApart(world: World, e: Entity, by: EntityId, energy: number) {
  const b = e.breakable;
  if (!b || b.broken || !e.transform) return;
  b.broken = true;
  const at: Vec3 = [...e.transform.position];
  const seed = world.random.uint32();
  const half: Vec3 =
    e.body?.shape.kind === 'box'
      ? e.body.shape.halfExtents
      : e.body?.shape.kind === 'ball'
        ? [e.body.shape.radius, e.body.shape.radius, e.body.shape.radius]
        : [0.1, 0.1, 0.1];
  const material = e.body?.material ?? null;
  if (e.body) {
    world.forgetBody(e);
    world.physics.removeBody(e.body.handle);
    delete e.body;
  }
  const pieces = Math.max(2, Math.min(6, Math.round((2 * Math.max(...half)) / 0.2)));
  const side = Math.max(0.04, (2 * Math.min(...half)) / 3);
  const color = e.appearance?.color ?? 0x8a8a8a;
  for (let i = 0; i < pieces; i++) {
    const out: Vec3 = [world.random.between(-1, 1), world.random.between(0.2, 1), world.random.between(-1, 1)];
    const speed = world.random.between(1, 3) / Math.max(1e-9, vec3.length(out));
    world.createEntity({
      transform: {
        position: vec3.add(at, [
          world.random.between(-half[0], half[0]),
          world.random.between(-half[1], half[1]),
          world.random.between(-half[2], half[2]),
        ]),
        rotation: quat.identity(),
      },
      body: {
        type: 'dynamic',
        shape: { kind: 'box', halfExtents: [side / 2, side / 2, side / 2] },
        linearVelocity: vec3.scale(out, speed),
        angularVelocity: [world.random.between(-6, 6), world.random.between(-6, 6), world.random.between(-6, 6)],
      },
      appearance: { shape: 'box', size: [side, side, side], color },
    });
  }
  world.emit({ type: 'broke', entity: e.id, at, by, energy, seed });
  world.emit({
    type: 'sound',
    sound: 'break',
    source: e.id,
    at,
    surface: e.lamp ? 'glass' : material,
    speed: 0,
    energy,
    radius: Math.max(15, hitRadius(energy)),
  });
  // A box that broke is gone but for its pieces; a lamp stays, broken (it is still a lamp, dark).
  if (!e.lamp) world.removeEntity(e.id);
}
