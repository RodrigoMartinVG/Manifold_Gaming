import * as THREE from 'three';

/** How the camera goes with the character: how far, how high, and how quickly it comes back behind it. */
export interface Follow {
  distance: number;
  height: number;
  strength: number;
  smoothing: 'with dt' | 'per frame';
}

const UP = new THREE.Vector3(0, 1, 0);
/** A vector without its vertical part: on the floor. */
const flat = (v: THREE.Vector3) => v.clone().setY(0);

/** FIXED TO ITS BACK: always exactly behind and above. It turns as much as the character, at once. */
export function rigid(
  camera: THREE.Camera,
  head: THREE.Vector3,
  facing: THREE.Vector3,
  _dt: number,
  o: Follow,
) {
  const behind = flat(facing).normalize().multiplyScalar(-o.distance);
  camera.position.copy(head).add(behind).addScaledVector(UP, o.height);
  camera.lookAt(head);
}

/**
 * ON A LEASH: the camera stays where it is as long as it can. It keeps its distance along the floor
 * and its height: if the character goes away it pulls it, if it comes closer it pushes it back, and
 * if it goes to a side, the camera turns, little by little, without anyone telling it to.
 */
export function leash(
  camera: THREE.Camera,
  head: THREE.Vector3,
  _facing: THREE.Vector3,
  _dt: number,
  o: Follow,
) {
  place(camera, head, flat(camera.position.clone().sub(head)), o);
}

/**
 * CHASING: on a leash, and besides it goes back behind the character, a fraction of the angle left
 * on every frame. With dt, that fraction is 1 − e^(−strength · dt): the same chase at 30 or at 144
 * frames per second. Per frame, it is a fixed one (the one 60 frames per second would give).
 */
export function chase(
  camera: THREE.Camera,
  head: THREE.Vector3,
  facing: THREE.Vector3,
  dt: number,
  o: Follow,
) {
  const along = flat(camera.position.clone().sub(head));
  const behind = flat(facing).negate();
  // The angle from where the camera is to behind the character, with its sign (around "up").
  const angle = Math.atan2(
    new THREE.Vector3().crossVectors(along, behind).dot(UP),
    along.dot(behind),
  );
  const fraction =
    o.smoothing === 'with dt' ? 1 - Math.exp(-o.strength * dt) : 1 - Math.exp(-o.strength / 60);
  along.applyAxisAngle(UP, angle * fraction);
  place(camera, head, along, o);
}

/** At `distance` from the head along `along` (on the floor), `height` above it, looking at it. */
function place(camera: THREE.Camera, head: THREE.Vector3, along: THREE.Vector3, o: Follow) {
  if (along.lengthSq() < 1e-6) along.set(0, 0, 1);
  along.setLength(o.distance);
  camera.position.copy(head).add(along).addScaledVector(UP, o.height);
  camera.lookAt(head);
}
