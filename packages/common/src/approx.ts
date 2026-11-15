import { vec3, type Quat, type Vec3 } from './math';

/**
 * WITH THE BROWSER'S TRIGONOMETRY, for tests and views (stage 2.5b: before, inside `quat`): they use
 * `Math.sin`, `Math.cos` and `Math.acos`, which each JavaScript engine computes its own way, so they
 * may give other bits in another browser. Never inside a simulation step: a lint rule keeps them out
 * of the core, the network and a game's rules (in the simulation, a literal quaternion, `quat.look`
 * or `quat.fromDegrees`).
 */
export const approx = {
  /** The rotation of `angle` radians around `axis` (it does not need length 1). */
  fromAxisAngle: (axis: Readonly<Vec3>, angle: number): Quat => {
    const [x, y, z] = vec3.normalize(axis);
    const s = Math.sin(angle / 2);
    return [x * s, y * s, z * s, Math.cos(angle / 2)];
  },

  /** The angle (radians, from 0 to π) of the rotation that takes `a` to `b`. */
  angleBetween: (a: Readonly<Quat>, b: Readonly<Quat>): number => {
    const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
    return 2 * Math.acos(Math.min(1, d));
  },
};
