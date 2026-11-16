import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-deterministic-compat';

/**
 * THE ENGINE'S NUMBERS (stage 3g). A push: 900 N at most, as fast as it walks at most. A hold: where
 * (0.95 m ahead of its center, 0.2 m up), how near a thing must be to be grabbed (here, a distance;
 * the engine sweeps a short sphere along where it looks), when it lets go (2 m away), how hard it
 * can pull (1,200 N) and how quickly it brings the thing to where it holds it (0.12 s).
 */
export const PUSH = 900;
export const HOLD = { ahead: 0.95, lift: 0.2, reach: 1.2, letGo: 2, force: 1200, settle: 0.12 };
const G = 9.81;

/**
 * A PUSH, by the engine's rule: along where it walks, until the thing goes as fast as it walks, and
 * never more than a force of PUSH can do in one step: an impulse of PUSH × dt, which changes the
 * velocity of a mass m by PUSH × dt / m. The floor's friction is the physics': in the same step it
 * takes away up to μ·m·g × dt. If the push is less, nothing moves.
 */
export function push(
  thing: RAPIER.RigidBody,
  along: THREE.Vector3,
  speed: number,
  dt: number,
  capped: boolean,
) {
  const v = thing.linvel();
  const gap = speed - (v.x * along.x + v.z * along.z); // how much slower than it walks
  if (gap <= 0) return;
  const mass = thing.mass();
  const change = capped ? Math.min(gap, (PUSH * dt) / mass) : gap;
  thing.applyImpulse({ x: along.x * change * mass, y: 0, z: along.z * change * mass }, true);
}

/**
 * A PULL towards where it is held: a spring with damping, and a limit. The change of velocity that
 * would bring the thing there in HOLD.settle seconds, moving as the one who holds it moves (the spring
 * and the damping), with gravity's own step taken back (so a crate held still does not sag); never
 * more than HOLD.force can do in a step for its mass (the limit). The thing stays the physics': a
 * wall stops it, and what is too heavy hangs back. Its distance to where it is held.
 */
export function pull(
  thing: RAPIER.RigidBody,
  target: THREE.Vector3,
  carrier: THREE.Vector3,
  dt: number,
  capped: boolean,
): number {
  const to = target.clone().sub(thing.translation());
  const v = thing.linvel();
  const change = to
    .clone()
    .divideScalar(HOLD.settle)
    .add(carrier)
    .sub(new THREE.Vector3(v.x, v.y, v.z))
    .add(new THREE.Vector3(0, G * dt, 0));
  const mass = thing.mass();
  const most = (HOLD.force * dt) / mass;
  if (capped && change.length() > most) change.setLength(most);
  thing.applyImpulse(change.multiplyScalar(mass), true);
  return to.length();
}
