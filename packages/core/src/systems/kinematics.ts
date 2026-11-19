import type { Entity, Mechanism } from '../types';
import { STEP, mechanismAt, progressOf, type World } from '../world';
import { quat, vec3 } from '@manifold/common';

/**
 * SPIN system: the rotation advances this step's angle around the axis of its angular velocity,
 * WITHOUT TRIGONOMETRY (stage 1f: it used `hypot`, `sin` and `cos`, which each JavaScript engine
 * computes its own way). The quaternion of a small turn is [ω·dt/2, 1], brought back to length 1:
 * it turns 2·atan(|ω|·dt/2) instead of |ω|·dt, two parts in a hundred thousand less at 1 rad/s.
 * Additions, multiplications and a square root, the same bits everywhere. It is renormalized, so
 * rounding does not accumulate.
 */
export function spin(world: World) {
  for (const e of world.entities.values()) {
    if (!e.spin || !e.transform) continue;
    const w = e.spin.angularVelocity;
    // A kinematic body is turned by the physics (with its deterministic math: see `move`); a
    // dynamic or fixed one is moved by the physics, or not at all.
    if (e.body) continue;
    if (w[0] === 0 && w[1] === 0 && w[2] === 0) continue;
    const h = STEP / 2;
    const delta = quat.normalize([w[0] * h, w[1] * h, w[2] * h, 1]);
    e.transform.rotation = quat.normalize(quat.multiply(delta, e.transform.rotation));
  }
}

/**
 * KINEMATIC BODIES SYSTEM: each one gets the velocity of this step: the one it has, the one it
 * spins with, and, if it is a MOVING PLATFORM (stage 2d), the one that takes it where it has to be
 * at the end of this step. That place is a function of the time (back and forth, at a constant
 * speed), not of where it was: so it never drifts, however many trips it makes.
 */
export function move(world: World) {
  const t = world.tick * STEP;
  for (const e of world.entities.values()) {
    if (!e.transform || e.body?.type !== 'kinematic') continue;
    const m = e.mover;
    if (m) {
      const phase = t % (2 * m.seconds);
      const u = phase <= m.seconds ? phase / m.seconds : 2 - phase / m.seconds;
      const target = vec3.add(m.from, vec3.scale(vec3.sub(m.to, m.from), u));
      e.body.linearVelocity = vec3.scale(vec3.sub(target, e.transform.position), 1 / STEP);
    }
    if (e.spin) e.body.angularVelocity = [...e.spin.angularVelocity];
    if (e.mechanism) drive(world, e, e.mechanism);
    world.physics.setKinematicVelocity(e.body.handle, e.body.linearVelocity, e.body.angularVelocity);
  }
}

/**
 * A MECHANISM (stage 3c): it reads its signal, as it was at the end of the last step, and turns
 * back from where it is if the signal changed which way it goes; then it gets the velocity that
 * takes it where it has to be at the end of this step. Its place is a function of its state and the
 * step (`mechanismAt`); its velocity, of where it really is: so it never drifts. Turning, from the
 * turn between where it is and where it has to be: twice its vector part, over the step (for the
 * small turn of one step, the angle; a little less, and the next step makes it up). No sine, no
 * cosine: the same bits everywhere.
 */
export function drive(world: World, e: Entity, m: Mechanism) {
  const want = world.signal(m.signal) !== 0 ? 1 : 0;
  if (want !== m.toward) {
    m.from = progressOf(m, world.tick - 1);
    m.since = world.tick - 1;
    m.toward = want;
    // Heard when it starts to move (stage 3f): a door creaks, a lift hums, 12 m around.
    world.emit({
      type: 'sound',
      sound: m.door ? 'door' : 'lift',
      source: e.id,
      at: [...e.transform!.position],
      surface: e.body?.material ?? null,
      speed: 1 / m.seconds,
      energy: 0,
      radius: 12,
    });
  }
  const target = mechanismAt(m, progressOf(m, world.tick));
  const body = e.body!;
  body.linearVelocity = vec3.scale(vec3.sub(target.position, e.transform!.position), 1 / STEP);
  let turn = quat.multiply(target.rotation, quat.conjugate(e.transform!.rotation));
  if (turn[3] < 0) turn = [-turn[0], -turn[1], -turn[2], -turn[3]];
  body.angularVelocity = [(2 * turn[0]) / STEP, (2 * turn[1]) / STEP, (2 * turn[2]) / STEP];
}
