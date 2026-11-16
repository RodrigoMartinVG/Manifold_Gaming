import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import {
  BONE_AXIS,
  bendOf,
  endOf,
  limbOf,
  limitJoint,
  reach,
  rootOf,
  softDistance,
  spanOf,
  swingTwist,
  twistOf,
  type LimbSpec,
} from './ik';

const deg = THREE.MathUtils.degToRad;

/**
 * A leg alone, as the mannequin's (two bones of 0.36 m pointing down from a hip 0.1 m to the side, the
 * knee bent a little forward, as the animations bend it): a model, its hips, a thigh and a shin.
 */
function leg(spec: Partial<LimbSpec> = {}, kneeBend = 10) {
  const model = new THREE.Object3D();
  const hips = new THREE.Object3D();
  hips.name = 'hips';
  model.add(hips);
  const thigh = new THREE.Object3D();
  thigh.name = 'thigh';
  thigh.position.set(0.1, -0.08, 0);
  // A bone points along its own +Y: the thigh, down.
  thigh.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  hips.add(thigh);
  const shin = new THREE.Object3D();
  shin.name = 'shin';
  shin.position.set(0, 0.36, 0);
  thigh.add(shin);
  const full: LimbSpec = {
    upper: 'thigh',
    lower: 'shin',
    end: [0, 0.36, 0],
    slack: 0.001,
    bend: deg(150),
    pole: [0, 0, -1],
    limit: { center: [0, -1, -0.35], cone: deg(100), twist: [deg(-45), deg(45)] },
    ...spec,
  };
  const limb = limbOf(model, full)!;
  // The pose: the knee bent forward, the foot back (the shin's turn, after the limb was read at rest).
  shin.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -deg(kneeBend));
  model.updateMatrixWorld(true);
  return { model, thigh, shin, limb };
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('the soft stretch (stage 4a)', () => {
  const L = 0.72;
  const soft = L - Math.E * 0.001;

  test('the distance itself up to where it gives; then less, rising, towards the reach, and short of it at full reach by the slack', () => {
    expect(softDistance(0.5, L, soft)).toBe(0.5);
    expect(softDistance(soft, L, soft)).toBe(soft);
    // Its slope at `soft` is 1 (no corner), and it keeps rising, slower and slower.
    const h = 1e-7;
    expect((softDistance(soft + h, L, soft) - soft) / h).toBeCloseTo(1, 4);
    let before = soft;
    for (let d = soft + 0.0005; d < 1.2; d += 0.0005) {
      const now = softDistance(d, L, soft);
      expect(now).toBeGreaterThan(before - 1e-15);
      expect(now).toBeLessThanOrEqual(L);
      before = now;
    }
    // At full reach, short of it by (L − soft) / e: the slack.
    expect(L - softDistance(L, L, soft)).toBeCloseTo(0.001, 9);
  });

  test('a finite angular speed at full reach: the bend of a knee whose target crosses it', () => {
    // dβ/dd, the bend's speed per meter the target moves away, measured as finely as one likes. Without
    // the stretch, finer measures find faster snaps without end (as 1/√h); with it, they agree, on
    // d_soft / (ab sin κ), its value where the stretch starts to give (κ: the inside angle there).
    const a = 0.36;
    const b = 0.36;
    const fastest = (h: number, spread: (d: number) => number) => {
      let most = 0;
      for (let d = 0.6; d < 0.8; d += h)
        most = Math.max(most, Math.abs(bendOf(a, b, spread(d + h)) - bendOf(a, b, spread(d))) / h);
      return most;
    };
    const hard = (d: number) => Math.min(d, a + b);
    const softly = (d: number) => softDistance(d, a + b, soft);
    expect(fastest(1e-6, hard) / fastest(1e-4, hard)).toBeGreaterThan(5);
    const coarse = fastest(1e-5, softly);
    const fine = fastest(1e-7, softly);
    expect(fine / coarse).toBeCloseTo(1, 2);
    const kappa = Math.PI - bendOf(a, b, soft);
    expect(fine).toBeCloseTo(soft / (a * b * Math.sin(kappa)), 0);
    // The mannequin's leg, 1 mm of slack: 32 radians per meter at most (at 0.2 m/s, 6.4 rad/s); an arm, 1 cm: 11.6.
    expect(fine).toBeLessThan(33);
  });
});

describe('one solver for every limb (stage 4a)', () => {
  test('a target within reach: the end on it, the knee on the side the pose bends it, the root where it was', () => {
    const { model, shin, limb } = leg();
    const hip = rootOf(limb, new THREE.Vector3());
    for (const target of [v(0.1, -0.7, -0.1), v(0.25, -0.6, 0.2), v(0.05, -0.5, -0.3), v(0.1, -0.4, 0)]) {
      const done = reach(model, limb, target);
      expect(endOf(limb, new THREE.Vector3()).distanceTo(target)).toBeLessThan(1e-6);
      expect(done.missed).toBeLessThan(1e-6);
      expect(done.limited).toBe(false);
      expect(rootOf(limb, new THREE.Vector3()).distanceTo(hip)).toBeLessThan(1e-12);
      // The knee forward of the line from the hip to the foot, as it was bent.
      const knee = shin.getWorldPosition(new THREE.Vector3());
      const line = target.clone().sub(hip).normalize();
      const out = knee.clone().sub(hip);
      out.addScaledVector(line, -out.dot(line));
      expect(out.z).toBeLessThan(0);
    }
  });

  test('out of reach: the end on the line to the target, where the soft stretch puts it; a straight leg bends to its pole', () => {
    const { model, limb } = leg({}, 0);
    const hip = rootOf(limb, new THREE.Vector3());
    const target = v(0.1, -1.2, -0.3);
    const done = reach(model, limb, target);
    const end = endOf(limb, new THREE.Vector3());
    const d = target.distanceTo(hip);
    expect(end.distanceTo(hip)).toBeCloseTo(softDistance(d, limb.a + limb.b, limb.soft), 8);
    expect(end.clone().sub(hip).normalize().angleTo(target.clone().sub(hip).normalize())).toBeLessThan(1e-6);
    expect(done.ratio).toBeCloseTo(d / 0.72, 9);
    expect(done.missed).toBeCloseTo(d - softDistance(d, 0.72, limb.soft), 8);
    // Exactly at full reach, it stays the slack short, and the knee a little bent (forward: its pole).
    const at = hip.clone().add(v(0, -0.72, 0));
    expect(reach(model, limb, at).missed).toBeCloseTo(0.001, 6);
    expect(bendOf(limb.a, limb.b, endOf(limb, new THREE.Vector3()).distanceTo(hip))).toBeGreaterThan(deg(5));
  });

  test('its limits: the knee bends at most as far as it may; a thigh sent outside its cone stops on its edge', () => {
    const { model, thigh, limb } = leg();
    const hip = rootOf(limb, new THREE.Vector3());
    // A foot brought up under the hip: the knee bends 150°, no more, and the foot stays short.
    const close = reach(model, limb, hip.clone().add(v(0, -0.1, 0)));
    expect(close.bend).toBeCloseTo(deg(150), 6);
    expect(endOf(limb, new THREE.Vector3()).distanceTo(hip)).toBeCloseTo(spanOf(0.36, 0.36, deg(150)), 9);
    // A foot sent up and behind (136° from the thigh's cone's center): the thigh held at 100°.
    const behind = reach(model, limb, hip.clone().add(v(0, 0.3, 0.6)));
    expect(behind.limited).toBe(true);
    const axis = BONE_AXIS.clone().applyQuaternion(thigh.quaternion);
    expect(THREE.MathUtils.radToDeg(axis.angleTo(limb.limit.center))).toBeCloseTo(100, 6);
    expect(behind.missed).toBeGreaterThan(0.05);
  });

  test('its turns are across the bone, and still the twist drifts: by the area of the triangle the axis draws on the sphere', () => {
    const { model, thigh, limb } = leg();
    const { from, range } = limb.limit.twist!;
    const twist = () => twistOf(from.clone().invert().multiply(thigh.quaternion), BONE_AXIS);
    const axis = () => BONE_AXIS.clone().applyQuaternion(thigh.quaternion);
    /** The signed area of the spherical triangle a, b, c (Van Oosterom and Strackee). */
    const area = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) =>
      2 * Math.atan2(a.dot(b.clone().cross(c)), 1 + a.dot(b) + b.dot(c) + c.dot(a));
    // The animation twisted the thigh 25° about itself.
    thigh.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(BONE_AXIS, deg(25)));
    model.updateMatrixWorld(true);
    let drift = 0;
    for (const target of [v(0.1, -0.7, -0.2), v(0.4, -0.5, 0.1), v(-0.2, -0.6, -0.3), v(0.3, -0.45, 0.35)]) {
      const [before, u] = [twist(), axis()];
      reach(model, limb, target);
      const [after, w] = [twist(), axis()];
      // The triangle: the cone's center (where the twist is measured from), and the axis before and after.
      expect(after - before).toBeCloseTo(area(limb.limit.center, u, w), 9);
      drift = Math.max(drift, Math.abs(after - before));
    }
    expect(THREE.MathUtils.radToDeg(drift)).toBeGreaterThan(1);
    // However far it would drift, it stays in its range.
    for (let i = 0; i < 200; i++) {
      const a = (i * 2.399) % (2 * Math.PI);
      reach(model, limb, v(0.1 + 0.5 * Math.cos(a), -0.6 + 0.3 * Math.sin(3 * a), 0.5 * Math.sin(a)));
      expect(twist()).toBeGreaterThanOrEqual(range[0] - 1e-9);
      expect(twist()).toBeLessThanOrEqual(range[1] + 1e-9);
    }
  });

  test('a weight between the pose and the solver: 0, the pose untouched; 1, the target; in between, in between', () => {
    const { model, thigh, shin, limb } = leg();
    const pose = [thigh.quaternion.clone(), shin.quaternion.clone()];
    const target = v(0.3, -0.55, -0.25);
    reach(model, limb, target, 0);
    expect(thigh.quaternion.angleTo(pose[0]!)).toBe(0);
    expect(shin.quaternion.angleTo(pose[1]!)).toBe(0);
    const before = endOf(limb, new THREE.Vector3());
    const half = reach(model, limb, target, 0.5);
    expect(half.missed).toBeGreaterThan(0.01);
    expect(half.missed).toBeLessThan(before.distanceTo(target));
    thigh.quaternion.copy(pose[0]!);
    shin.quaternion.copy(pose[1]!);
    model.updateMatrixWorld(true);
    expect(reach(model, limb, target, 1).missed).toBeLessThan(1e-6);
  });
});

describe('swing and twist (stage 4a)', () => {
  test('a turn split into a swing across the axis and a twist about it: they make the turn again', () => {
    const swing = new THREE.Quaternion();
    const twist = new THREE.Quaternion();
    for (const [axis, angle, by] of [
      [v(1, 0, 0), 40, 30],
      [v(0.3, 0, 1), 120, -70],
      [v(1, 0, 1), 170, 100],
      [v(0, 0, 1), 0, 45],
    ] as const) {
      // A twist of `by` about the bone, then a swing of `angle` about `axis` (across the bone).
      const q = new THREE.Quaternion()
        .setFromAxisAngle(axis.clone().normalize(), deg(angle))
        .multiply(new THREE.Quaternion().setFromAxisAngle(BONE_AXIS, deg(by)));
      swingTwist(q, BONE_AXIS, swing, twist);
      expect(swing.clone().multiply(twist).angleTo(q)).toBeLessThan(1e-6);
      expect(THREE.MathUtils.radToDeg(twistOf(q, BONE_AXIS))).toBeCloseTo(by, 6);
      // The swing tilts the axis where the turn does, and turns nothing about it.
      expect(BONE_AXIS.clone().applyQuaternion(swing).distanceTo(BONE_AXIS.clone().applyQuaternion(q))).toBeLessThan(1e-6);
      expect(Math.abs(twistOf(swing, BONE_AXIS))).toBeLessThan(1e-6);
    }
  });

  test('a joint limited: the twist clamped to its range, the swing kept; inside it, nothing changes', () => {
    const from = new THREE.Quaternion();
    const limit = { center: v(0, 1, 0), cone: deg(90), twist: { range: [deg(-30), deg(30)] as const, from } };
    const swing = new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), deg(50));
    const q = swing.clone().multiply(new THREE.Quaternion().setFromAxisAngle(BONE_AXIS, deg(70)));
    expect(limitJoint(q, limit)).toBe(true);
    expect(THREE.MathUtils.radToDeg(twistOf(q, BONE_AXIS))).toBeCloseTo(30, 6);
    expect(BONE_AXIS.clone().applyQuaternion(q).angleTo(BONE_AXIS.clone().applyQuaternion(swing))).toBeLessThan(1e-6);
    const inside = swing.clone().multiply(new THREE.Quaternion().setFromAxisAngle(BONE_AXIS, deg(-10)));
    const copy = inside.clone();
    expect(limitJoint(inside, limit)).toBe(false);
    expect(inside.equals(copy)).toBe(true);
    // Swung past its cone (120°): on its edge, the twist as it was.
    const far = new THREE.Quaternion()
      .setFromAxisAngle(v(0, 0, 1), deg(120))
      .multiply(new THREE.Quaternion().setFromAxisAngle(BONE_AXIS, deg(20)));
    expect(limitJoint(far, limit)).toBe(true);
    expect(THREE.MathUtils.radToDeg(BONE_AXIS.clone().applyQuaternion(far).angleTo(limit.center))).toBeCloseTo(90, 6);
    expect(THREE.MathUtils.radToDeg(twistOf(far, BONE_AXIS))).toBeCloseTo(20, 6);
  });
});
