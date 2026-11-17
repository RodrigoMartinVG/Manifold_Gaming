import * as THREE from 'three';

/**
 * INERTIALIZATION (stage 4b): going from one pose to another without a cross-fade. A cross-fade mixes
 * the two for a while: quick, and the new pose arrives late (a landing's knees, which must give at
 * once, would give a tenth of a second later); short, and the body snaps. Measured on the mannequin, the
 * landing faded in over 0.05 s from the fall's arms-up pose turned its bones at 1495°/s, almost twice
 * its own fastest (815, landing from a stand); every other change of animation (walk to crouch, idle to
 * run, a roll, the somersault) stayed under its clips' own. So for the landing, and every gesture: the
 * new pose is drawn at once, and what separates it from the pose that was showing, an offset for each
 * bone (a turn about an axis), dies out by itself.
 *
 * Each offset's angle x(t) goes from x₀ at the speed it had (v₀, from the last two poses drawn) to 0 in
 * a time t₁, with no speed and no acceleration left: a polynomial of degree five, the least that meets
 * those six conditions (x, x′ and x″ at both ends; x″(0) chosen so that x does not overshoot, as David
 * Bollo's inertialization does it). If the offset was already shrinking fast, t₁ is shorter: never
 * longer than it would take at that speed, five times over. Only the view: the world is not touched.
 */

/** How long an offset takes to die out at most (s). */
export const INERTIA_TIME = 0.2;

/** One bone's offset as it dies out: about `axis`, its angle at time t is the polynomial's. */
interface Offset {
  axis: THREE.Vector3;
  /** x(t) = x0 + v0 t + a0/2 t² + C t³ + B t⁴ + A t⁵, until t1. */
  x0: number;
  v0: number;
  a0: number;
  A: number;
  B: number;
  C: number;
  t1: number;
}

/** What a copy remembers from one frame to the next: its last two poses drawn, and the offsets dying out. */
export interface Inertia {
  last: Map<string, THREE.Quaternion>;
  before: Map<string, THREE.Quaternion>;
  /** The time between the last two poses (s). */
  step: number;
  offsets: Map<string, Offset>;
  /**
   * And the bones' places (stage 4c: the hips, back from where a fall left them): the last drawn, and
   * each one's offset dying out the same way, along its direction (its angle is its length).
   */
  lastPlaces: Map<string, THREE.Vector3>;
  placeOffsets: Map<string, Offset>;
  time: number;
}

export const newInertia = (): Inertia => ({
  last: new Map(),
  before: new Map(),
  step: 0,
  offsets: new Map(),
  lastPlaces: new Map(),
  placeOffsets: new Map(),
  time: 0,
});

/** The polynomial for an offset of angle `x0` changing at `v0` (rad/s), to die out within `most` seconds. */
export function decay(x0: number, v0: number, most = INERTIA_TIME): Omit<Offset, 'axis'> {
  // Moving away from 0 (or not at all): it is stopped first, within the whole time.
  const v = Math.min(v0, 0);
  const t1 = v < 0 ? Math.max(1e-3, Math.min(most, (-5 * x0) / v)) : most;
  const a0 = (-8 * v * t1 - 20 * x0) / (t1 * t1);
  const A = -(a0 * t1 * t1 + 6 * v * t1 + 12 * x0) / (2 * t1 ** 5);
  const B = (3 * a0 * t1 * t1 + 16 * v * t1 + 30 * x0) / (2 * t1 ** 4);
  const C = -(3 * a0 * t1 * t1 + 12 * v * t1 + 20 * x0) / (2 * t1 ** 3);
  return { x0, v0: v, a0, A, B, C, t1 };
}

/** The angle of a dying offset at time `t` (0 from `t1` on). */
export function angleAt(o: Omit<Offset, 'axis'>, t: number): number {
  if (t >= o.t1) return 0;
  return o.x0 + o.v0 * t + (o.a0 / 2) * t * t + o.C * t ** 3 + o.B * t ** 4 + o.A * t ** 5;
}

const offset = new THREE.Quaternion();
const back = new THREE.Quaternion();
const turn = new THREE.Quaternion();

/**
 * After the animations are applied to `bones` (their turns are the new pose's), before the procedural
 * layers: if a new pose starts now (`start`), each bone's offset from the pose drawn last is taken, with
 * the speed it had; and each bone is turned by what is left of its offset. Then the pose drawn is
 * remembered. (`dt`: the world's time; paused, nothing changes.)
 */
export function inertialize(bones: readonly THREE.Object3D[], inertia: Inertia, start: boolean, dt: number) {
  if (start && inertia.last.size > 0) {
    inertia.offsets.clear();
    inertia.time = 0;
    for (const bone of bones) {
      const last = inertia.last.get(bone.name);
      if (!last) continue;
      // The offset: what turns the new pose into the last one drawn (last = offset ⊗ new).
      offset.copy(last).multiply(back.copy(bone.quaternion).invert());
      if (offset.w < 0) offset.set(-offset.x, -offset.y, -offset.z, -offset.w);
      const x0 = 2 * Math.acos(Math.min(1, offset.w));
      if (x0 < 1e-6) continue;
      const axis = new THREE.Vector3(offset.x, offset.y, offset.z).normalize();
      // Its speed: how the offset was changing, from the pose before the last one (along the same axis).
      let v0 = 0;
      const before = inertia.before.get(bone.name);
      if (before && inertia.step > 0) {
        turn.copy(before).multiply(back);
        if (turn.w < 0) turn.set(-turn.x, -turn.y, -turn.z, -turn.w);
        const along = 2 * Math.atan2(turn.x * axis.x + turn.y * axis.y + turn.z * axis.z, turn.w);
        v0 = (x0 - along) / inertia.step;
      }
      inertia.offsets.set(bone.name, { axis, ...decay(x0, v0) });
    }
    // The places that moved (the hips: up from the floor, back under the body): from where they were drawn.
    inertia.placeOffsets.clear();
    for (const bone of bones) {
      const last = inertia.lastPlaces.get(bone.name);
      if (!last) continue;
      const away = last.clone().sub(bone.position);
      const length = away.length();
      if (length < 1e-4) continue;
      inertia.placeOffsets.set(bone.name, { axis: away.divideScalar(length), ...decay(length, 0) });
    }
  }
  if (dt > 0 && (inertia.offsets.size > 0 || inertia.placeOffsets.size > 0)) inertia.time += dt;
  for (const bone of bones) {
    const o = inertia.offsets.get(bone.name);
    const x = o ? angleAt(o, inertia.time) : 0;
    if (o && x !== 0) bone.quaternion.premultiply(turn.setFromAxisAngle(o.axis, x));
    const p = inertia.placeOffsets.get(bone.name);
    const d = p ? angleAt(p, inertia.time) : 0;
    if (p && d !== 0) bone.position.addScaledVector(p.axis, d);
  }
  const done = (m: Map<string, Offset>) => [...m.values()].every((o) => inertia.time >= o.t1);
  if ((inertia.offsets.size > 0 || inertia.placeOffsets.size > 0) && done(inertia.offsets) && done(inertia.placeOffsets)) {
    inertia.offsets.clear();
    inertia.placeOffsets.clear();
  }
  // What was drawn, remembered (paused, the same frame again: not twice).
  if (dt > 0) {
    for (const bone of bones) {
      const last = inertia.last.get(bone.name);
      if (last) inertia.before.set(bone.name, last);
      inertia.last.set(bone.name, bone.quaternion.clone());
      inertia.lastPlaces.set(bone.name, bone.position.clone());
    }
    inertia.step = dt;
  }
}
