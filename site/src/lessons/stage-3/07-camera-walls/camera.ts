import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-deterministic-compat';

// THE CAMERA AGAINST WALLS, the engine's made small. It is the view's, not the world's: it
// runs once per frame with the frame's seconds, and changes nothing in the world. So it may use
// Math.exp and Math.atan2, which the simulation may not (another browser could give other bits).
const BEHIND = 5.5; // where it starts: this far behind the head (m)...
const ABOVE = 2.2; // ...and this far above it
const CLEARANCE = 0.25; // the ball it sweeps: how far from a wall it stays (m)
const CLOSEST = 0.35; // the nearest to the head a wall may bring it (m)
const OUT = 3; // back out: each frame, 1 − e^(−3·dt) of what a wall took is given back
const TURN = 2; // back behind the character: each frame, 1 − e^(−2·dt) of the angle left
const UP = new THREE.Vector3(0, 1, 0);
const UNTURNED = { x: 0, y: 0, z: 0, w: 1 };

export interface CameraOptions {
  sweep: boolean;
  easeOut: boolean;
  /** THE BUG, on purpose: one position for both, so the leash starts from where a wall put it. */
  learns: boolean;
}

export function createCameraRig(world: RAPIER.World, hero: RAPIER.RigidBody) {
  /** Where it wants to be: what the leash moves. A wall never moves this one. */
  const wanted = new THREE.Vector3();
  /** Where it is shown: where the player's camera goes. */
  const at = new THREE.Vector3();
  const lastHead = new THREE.Vector3();
  /** How many meters in front of where it wants to be it is shown: what a wall took. */
  let cut = 0;
  const ball = new RAPIER.Ball(CLEARANCE);

  /** Behind the head and above it; nothing taken. */
  function reset(head: THREE.Vector3, facing: THREE.Vector3) {
    wanted.copy(head).addScaledVector(facing, -BEHIND).addScaledVector(UP, ABOVE);
    at.copy(wanted);
    lastHead.copy(head);
    cut = 0;
  }

  function frame(head: THREE.Vector3, facing: THREE.Vector3, dt: number, o: CameraOptions) {
    // 1. ON A LEASH ("La cámara que sigue"): it keeps the height and the distance along the floor it
    // had to the head, and stays where it is as long as it can. It starts from where it WANTS to be:
    // what a wall took is only what is shown. (With the bug, from where it is shown.)
    const from = o.learns ? at : wanted;
    const offset = from.clone().sub(lastHead);
    const along = from.clone().sub(head).setY(0);
    if (along.lengthSq() < 1e-6) along.copy(facing).negate();
    // 2. CHASING, gently: it goes back behind the character, a fraction of the angle left.
    const back = facing.clone().negate().setY(0);
    const angle = Math.atan2(
      new THREE.Vector3().crossVectors(along, back).dot(UP),
      along.dot(back),
    );
    along.applyAxisAngle(UP, angle * (1 - Math.exp(-TURN * dt)));
    along.setLength(Math.hypot(offset.x, offset.z));
    wanted.copy(head).add(along).addScaledVector(UP, offset.y);
    lastHead.copy(head);

    // 3. THE SWEEP: a ball from the head to where it wants to be. From the head, every frame (not from
    // where the camera was: a wall could slip in between). Not what the physics moves (a passing ball
    // would make it jump), and not the character: the ball starts inside its capsule.
    const way = wanted.clone().sub(head);
    const wants = way.length();
    way.divideScalar(wants);
    const hit = o.sweep
      ? world.castShape(
          head,
          UNTURNED,
          way,
          ball,
          0,
          wants,
          true,
          RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,
          undefined,
          undefined,
          hero,
        )
      : null;
    // 4. What a wall takes now, AT ONCE: one frame behind a wall would hide the character. What it
    // took before, given back SLOWLY, and only that. (With the bug the leash already keeps what the
    // wall took: there is nothing left to give back.)
    const takes = hit ? wants - Math.max(Math.min(CLOSEST, wants), hit.time_of_impact) : 0;
    const kept = o.easeOut && !o.learns ? cut * Math.exp(-OUT * dt) : 0;
    cut = Math.max(takes, kept);
    if (cut < 1e-4) cut = 0;
    at.copy(head).addScaledVector(way, Math.max(0, wants - cut));
    return { wanted, at, cut, hit: hit !== null };
  }

  return { reset, frame };
}
