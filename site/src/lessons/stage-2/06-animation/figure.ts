import * as THREE from 'three';
import { clipName, DIRECTIONS, PACE_NAMES, PACES, strideLength, VECTORS } from './gait';

/**
 * THE MODEL, made in code: what art/mannequin.py does in Blender for the engine. A skeleton (bones in
 * a hierarchy, each an empty Object3D at its joint) with rigid boxes hanging from the bones, and its
 * clips: keyframes of the bones' turns over one cycle. Looking at −Z, its right at +X, its feet at 0.
 */
const BODY = 0x93d9c9;
const JOINT = 0x4f7f76;
const VISOR = 0x1a1714;
/** The leg (m): thigh, shin, the hips' height, the ankle's over the sole, and half the hips' width. */
const THIGH = 0.45;
const SHIN = 0.45;
const HIP = 0.84;
const ANKLE = 0.06;
const HIP_X = 0.1;
type Triple = [number, number, number];

/** A bone: an empty object at its joint, which turns, and turns all that hangs from it. */
function bone(name: string, parent: THREE.Object3D, at: Triple) {
  const b = new THREE.Object3D();
  b.name = name; // a clip finds what it turns by name: `thigh_L.quaternion`
  b.position.set(...at);
  parent.add(b);
  return b;
}

/** A rigid piece of the body: a box of `size`, `at` from its bone's joint. */
function piece(b: THREE.Object3D, size: Triple, at: Triple, color: number) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    new THREE.MeshStandardMaterial({ color }),
  );
  mesh.position.set(...at);
  b.add(mesh);
  return mesh;
}

const SIDES: { side: 'L' | 'R'; x: number }[] = [
  { side: 'L', x: -1 },
  { side: 'R', x: 1 },
];

export function buildFigure() {
  const root = new THREE.Group(); // where the simulation puts it, at the floor
  const hips = bone('hips', root, [0, HIP, 0]);
  piece(hips, [0.3, 0.14, 0.18], [0, 0, 0], JOINT);
  const spine = bone('spine', hips, [0, 0.06, 0]);
  piece(spine, [0.34, 0.42, 0.2], [0, 0.25, 0], BODY);
  const head = bone('head', spine, [0, 0.5, 0]);
  piece(head, [0.22, 0.24, 0.24], [0, 0.16, 0], BODY);
  piece(head, [0.18, 0.06, 0.04], [0, 0.18, -0.12], VISOR); // where it looks
  const feet: THREE.Object3D[] = [];
  const soles: THREE.Mesh[] = [];
  for (const { side, x } of SIDES) {
    const arm = bone(`upper_arm_${side}`, spine, [0.22 * x, 0.44, 0]);
    piece(arm, [0.09, 0.3, 0.09], [0, -0.15, 0], BODY);
    piece(bone(`forearm_${side}`, arm, [0, -0.3, 0]), [0.08, 0.28, 0.08], [0, -0.14, 0], JOINT);
    const thigh = bone(`thigh_${side}`, hips, [HIP_X * x, 0, 0]);
    piece(thigh, [0.12, THIGH, 0.12], [0, -THIGH / 2, 0], BODY);
    const shin = bone(`shin_${side}`, thigh, [0, -THIGH, 0]);
    piece(shin, [0.1, SHIN, 0.1], [0, -SHIN / 2, 0], JOINT);
    const foot = bone(`foot_${side}`, shin, [0, -SHIN, 0]); // at the ankle
    feet.push(foot);
    soles.push(piece(foot, [0.1, ANKLE, 0.22], [0, -ANKLE / 2, -0.05], JOINT));
  }
  return { root, feet, soles };
}

// ---------------------------------------------------------------- the clips

const KEYS = 32; // keys in a cycle (and one more, equal to the first: a loop)
interface Style {
  lift: number; // how high a foot rises (m)
  lean: number; // degrees forward, going forward
  tilt: number; // degrees to the side, going to a side
  arm: number; // how far the arms swing (degrees)
  elbow: number; // how bent the elbows are (degrees)
}
const STYLE: Record<string, Style> = {
  idle: { lift: 0, lean: 0, tilt: 0, arm: 0, elbow: 10 },
  walk: { lift: 0.08, lean: 4, tilt: 3, arm: 22, elbow: 30 },
  run: { lift: 0.16, lean: 10, tilt: 6, arm: 40, elbow: 75 },
};
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const DOWN = new THREE.Vector3(0, -1, 0);
function about(axis: THREE.Vector3, degrees: number) {
  return new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(degrees));
}

/**
 * WHERE A FOOT IS (its ankle, from its hip) at `t` of a cycle that carries the body `stride` m along
 * `dir` ([ahead, right]). The left foot swings in the first half, the right one in the second: one
 * timing for every clip, so any two mix. ON THE GROUND, the foot goes back along `dir` at one pace,
 * half a stride in half a cycle: as far as the body goes forward, so in the world it stays still. IN
 * THE AIR, it comes forward again, lifted; it leaves and lands at the ground's pace, smoothly (a
 * fifth-degree curve: the keys sample it well).
 */
function footAt(t: number, side: 'L' | 'R', dir: [number, number], stride: number, lift: number) {
  const u = (t % 0.5) / 0.5;
  const swinging = t < 0.5 === (side === 'L');
  const reach = stride / 4;
  const along = swinging
    ? reach * (-1 - 2 * u + 40 * u ** 3 - 60 * u ** 4 + 24 * u ** 5)
    : reach * (1 - 2 * u);
  const [ahead, right] = dir;
  // Stepping to a side, the feet a little apart, so they do not cross when they come together.
  const apart = (Math.abs(right) * Math.max(0, stride / 2 + 0.16 - 2 * HIP_X)) / 2;
  return new THREE.Vector3(
    right * along + (side === 'L' ? -apart : apart),
    -(HIP - ANKLE) + (swinging ? lift * Math.sin(Math.PI * u) : 0),
    -ahead * along,
  );
}

/**
 * THE LEG FROM ITS FOOT (inverse kinematics, two bones): the law of cosines gives the angle at the
 * hip; the thigh points towards the foot, tilted forward by that angle (the knee goes forward), the
 * shin goes from the knee to the foot, and the foot undoes both turns, to stay level.
 */
function leg(target: THREE.Vector3) {
  const d = Math.min(target.length(), THIGH + SHIN - 1e-4);
  const toFoot = target.clone().normalize();
  const atHip = Math.acos((THIGH ** 2 + d ** 2 - SHIN ** 2) / (2 * THIGH * d));
  const ahead = new THREE.Vector3(0, 0, -1).addScaledVector(toFoot, toFoot.z).normalize();
  const knee = toFoot
    .clone()
    .multiplyScalar(Math.cos(atHip))
    .addScaledVector(ahead, Math.sin(atHip));
  const thigh = new THREE.Quaternion().setFromUnitVectors(DOWN, knee);
  const below = toFoot.multiplyScalar(d).addScaledVector(knee, -THIGH); // from the knee to the foot
  const shin = new THREE.Quaternion().setFromUnitVectors(
    DOWN,
    below.normalize().applyQuaternion(thigh.clone().invert()),
  );
  return { thigh, shin, foot: thigh.clone().multiply(shin).invert() };
}

/** The pose at `t` of a cycle: a turn for each bone it moves (every bone in every clip, still or not). */
function poseAt(t: number, dir: [number, number], stride: number, s: Style) {
  const pose: Record<string, THREE.Quaternion> = {};
  pose.spine = about(X, -s.lean * dir[0]).multiply(about(Z, -s.tilt * dir[1]));
  for (const { side } of SIDES) {
    const foot = footAt(t, side, dir, stride, s.lift);
    const l = leg(foot);
    pose[`thigh_${side}`] = l.thigh;
    pose[`shin_${side}`] = l.shin;
    pose[`foot_${side}`] = l.foot;
    // Each arm against its leg: forward when its foot is back. Its elbow, bent the whole cycle.
    const swing = (s.arm * foot.z) / Math.max(stride / 4, 0.01);
    pose[`upper_arm_${side}`] = about(Z, side === 'L' ? -6 : 6).multiply(about(X, swing));
    pose[`forearm_${side}`] = about(X, s.elbow);
  }
  return pose;
}

/** One clip: the pose sampled on KEYS + 1 keys, one quaternion track per bone. */
function clip(name: string, length: number, dir: [number, number], stride: number, s: Style) {
  const times: number[] = [];
  const values: Record<string, number[]> = {};
  for (let k = 0; k <= KEYS; k++) {
    times.push((k / KEYS) * length);
    for (const [bone, q] of Object.entries(poseAt((k / KEYS) % 1, dir, stride, s))) {
      if (!values[bone]) values[bone] = [];
      values[bone].push(q.x, q.y, q.z, q.w);
    }
  }
  const tracks = Object.entries(values).map(
    ([bone, v]) => new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, v),
  );
  return new THREE.AnimationClip(name, length, tracks);
}

/** THE CLIPS: standing still, and four directions for each pace, one length per family. */
export function makeClips(): THREE.AnimationClip[] {
  const clips = [clip('idle', 1, [1, 0], 0, STYLE.idle)];
  for (const pace of PACE_NAMES) {
    const length = PACES[pace].along / PACES[pace].speed; // the forward cycle's time, at its speed
    for (const dir of DIRECTIONS)
      clips.push(
        clip(clipName(pace, dir), length, VECTORS[dir], strideLength(pace, dir), STYLE[pace]),
      );
  }
  return clips;
}
