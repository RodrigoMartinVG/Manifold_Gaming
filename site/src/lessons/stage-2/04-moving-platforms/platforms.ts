import * as THREE from 'three';

/** Where a platform is at one step: its center, and how it is turned. */
export interface Pose {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
}

/**
 * A MOVING PLATFORM: its place is a FUNCTION of the step, never a velocity added up step after
 * step. So it never drifts, however many trips it makes, and its place at any step can be computed
 * again (in a replay, or by the network) without simulating the steps before.
 */
export interface Platform {
  name: string;
  poseAt(tick: number): Pose;
}

const UP = new THREE.Vector3(0, 1, 0);

/** It goes from `from` to `to` in `seconds`, and back: a triangle wave of the time. */
export function ferry(
  name: string,
  from: THREE.Vector3,
  to: THREE.Vector3,
  seconds: number,
  step: number,
): Platform {
  return {
    name,
    poseAt(tick) {
      const phase = (tick * step) % (2 * seconds); // where it is in its round trip
      const u = phase <= seconds ? phase / seconds : 2 - phase / seconds; // 0 → 1, then 1 → 0
      return { position: from.clone().lerp(to, u), rotation: new THREE.Quaternion() };
    },
  };
}

/**
 * It turns around its center, `degreesPerSecond` (+: counterclockwise, seen from above):
 * angle = speed × time.
 */
export function carousel(
  name: string,
  center: THREE.Vector3,
  degreesPerSecond: number,
  step: number,
): Platform {
  return {
    name,
    poseAt(tick) {
      const angle = THREE.MathUtils.degToRad(degreesPerSecond * tick * step);
      return {
        position: center.clone(),
        rotation: new THREE.Quaternion().setFromAxisAngle(UP, angle),
      };
    },
  };
}

/**
 * HOW A PLATFORM CARRIES A POINT in one step: from its pose at this step to its pose at the next
 * one. The point's arm (from the platform's center) turns with this step's turn, and goes along
 * with the center. On the ferry, that is only the translation; on the carousel, only the turn of
 * the arm. Also the turn itself: what stands there turns with it.
 */
export function carriedBy(platform: Platform, point: THREE.Vector3, tick: number) {
  const now = platform.poseAt(tick);
  const next = platform.poseAt(tick + 1);
  const turn = next.rotation.clone().multiply(now.rotation.clone().invert()); // this step's turn
  const arm = point.clone().sub(now.position);
  const there = arm.applyQuaternion(turn).add(next.position);
  return { movement: there.sub(point), turn };
}
