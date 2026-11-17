import * as THREE from 'three';
import type { Vec3 } from '@manifold/common';
import type { Body, PhysicsBackend, Transform } from '@manifold/core';

/**
 * THE FALL, A PASSIVE RAGDOLL (stage 4c): when a character goes down, its model stops playing its
 * animations and falls as bodies: one capsule for each bone, where the bone is drawn at that moment,
 * moving as the character moved and pushed the way the hit went, joined to its parent where the child
 * bone starts (ball joints, no motors: passive). In a physics of the presentation's own, with the
 * level's fixed boxes to fall on, that no gameplay ray sees and nobody hashes (as the fragments of
 * 3e): the world keeps the capsule and its state. Each frame, the bodies are written back into the
 * bones.
 */

/** A part of the ragdoll: the bone it moves, how long it is along the bone (its +Y), and how thick. */
export interface RagdollPart {
  bone: string;
  length: number;
  radius: number;
}

/** The mannequin's (art/mannequin.py), parents before children. */
export const RAGDOLL: readonly RagdollPart[] = [
  { bone: 'hips', length: 0.12, radius: 0.14 },
  { bone: 'spine', length: 0.36, radius: 0.16 },
  { bone: 'head', length: 0.33, radius: 0.13 },
  { bone: 'upper_arm_L', length: 0.28, radius: 0.05 },
  { bone: 'forearm_L', length: 0.3, radius: 0.045 },
  { bone: 'upper_arm_R', length: 0.28, radius: 0.05 },
  { bone: 'forearm_R', length: 0.3, radius: 0.045 },
  { bone: 'thigh_L', length: 0.36, radius: 0.07 },
  { bone: 'shin_L', length: 0.36, radius: 0.06 },
  { bone: 'thigh_R', length: 0.36, radius: 0.07 },
  { bone: 'shin_R', length: 0.36, radius: 0.06 },
];

/** A ragdoll falling: each part's bone, its body, and where the physics has it. */
export interface Ragdoll {
  parts: { bone: THREE.Object3D; half: number; body: Body; transform: Transform }[];
}

const position = new THREE.Vector3();
const turn = new THREE.Quaternion();
const center = new THREE.Vector3();
const anchor = new THREE.Vector3();

/** The world's place of a point `along` a bone's own +Y from where it starts. */
const alongBone = (start: THREE.Vector3, q: THREE.Quaternion, along: number, out: THREE.Vector3) =>
  out.set(0, along, 0).applyQuaternion(q).add(start);

/**
 * A ragdoll for a model as it is drawn now (`object`, its matrices the frame's), in `physics`, moving at
 * `velocity` (m/s). Null if the model does not have the bones.
 */
export function startRagdoll(physics: PhysicsBackend, object: THREE.Object3D, velocity: Vec3): Ragdoll | null {
  object.updateMatrixWorld(true);
  const bones = RAGDOLL.map((p) => object.getObjectByName(p.bone));
  if (bones.some((b) => !b)) return null;
  const parts: Ragdoll['parts'] = [];
  RAGDOLL.forEach((spec, i) => {
    const bone = bones[i]!;
    bone.getWorldPosition(position);
    bone.getWorldQuaternion(turn);
    alongBone(position, turn, spec.length / 2, center);
    const transform: Transform = { position: center.toArray(), rotation: turn.toArray() as Transform['rotation'] };
    const body = physics.addBody(
      {
        type: 'dynamic',
        shape: { kind: 'capsule', halfHeight: Math.max(0.01, spec.length / 2 - spec.radius), radius: spec.radius },
        density: 1000,
        friction: 0.8,
        restitution: 0.05,
        linearDamping: 0.1,
        // Limp, not flailing.
        angularDamping: 2,
        linearVelocity: [...velocity],
      },
      { position: [...transform.position], rotation: [...transform.rotation] },
    );
    parts.push({ bone, half: spec.length / 2, body, transform });
  });
  // Each part to its nearest parent among them, where it starts.
  parts.forEach((part, i) => {
    let up = part.bone.parent;
    let parent = -1;
    while (up && parent < 0) {
      parent = parts.findIndex((p) => p.bone === up);
      up = up.parent;
    }
    if (parent < 0) return;
    const p = parts[parent]!;
    part.bone.getWorldPosition(anchor);
    const inParent = anchor
      .clone()
      .sub(new THREE.Vector3(...p.transform.position))
      .applyQuaternion(new THREE.Quaternion(...p.transform.rotation).invert());
    physics.join(p.body.handle, parts[i]!.body.handle, inParent.toArray(), [0, -part.half, 0]);
  });
  return { parts };
}

const parentTurn = new THREE.Quaternion();

/**
 * Where the physics has the ragdoll now, written into its bones (parents first): every bone's turn,
 * and the first one's place (the hips); the others hang where their parents put them, as when they are
 * animated (the joints keep the bodies there too).
 */
export function poseRagdoll(physics: PhysicsBackend, ragdoll: Ragdoll) {
  for (const [i, part] of ragdoll.parts.entries()) {
    physics.read(part.body.handle, part.transform, part.body);
    turn.set(...part.transform.rotation);
    // Where the bone starts: half the part back from its body's center, along the bone.
    alongBone(center.set(...part.transform.position), turn, -part.half, position);
    const parent = part.bone.parent!;
    parent.updateMatrixWorld(true);
    part.bone.quaternion.copy(parent.getWorldQuaternion(parentTurn).invert().multiply(turn));
    if (i === 0) part.bone.position.copy(parent.worldToLocal(position.clone()));
    part.bone.updateMatrixWorld(true);
  }
}

/** The ragdoll's bodies, gone from the physics. */
export function stopRagdoll(physics: PhysicsBackend, ragdoll: Ragdoll) {
  for (const part of ragdoll.parts) physics.removeBody(part.body.handle);
}
