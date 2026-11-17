import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import { initPhysics, RapierPhysics, STEP, type Character } from '@manifold/core';
import { animate, modelInstance } from '@manifold/presentation/models';
import { poseRagdoll, RAGDOLL, startRagdoll, stopRagdoll } from '@manifold/presentation/ragdoll';

/**
 * THE FALL (stage 4c): the mannequin as a passive ragdoll, in a physics of its own with a floor, as the
 * page draws it when a character goes down; and getting up.
 */
const files = import.meta.glob<string>('../assets/mannequin.glb', { query: '?inline', import: 'default', eager: true });

let model: { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
beforeAll(async () => {
  await initPhysics();
  const url = files['../assets/mannequin.glb']!;
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  model = { scene: gltf.scene, clips: gltf.animations };
});

const DT = 1 / 60;
const standing = {
  mode: 'walk',
  grounded: true,
  facing: [0, 0, -1],
  pitch: 0,
  wall: [0, 0, 0],
  velocity: [0, 0, 0],
  airJumps: 1,
  holding: 0,
  rolling: 0,
  movement: { roll: { speed: 5, time: 0.6 } },
  ground: { velocity: [0, 0, 0], spin: 0 },
} as unknown as Character;

/** A floor whose top is where the mannequin's soles are (0.8 m under its center, at the origin). */
function fallsWorld() {
  const physics = new RapierPhysics([0, -9.81, 0], STEP);
  physics.addBody(
    { type: 'fixed', shape: { kind: 'box', halfExtents: [10, 0.5, 10] } },
    { position: [0, -1.3, 0], rotation: quat.identity() },
  );
  return physics;
}

describe('the fall (stage 4c)', () => {
  test('pushed back, it falls and lies on the floor, through nothing, its joints holding; then it gets up into its animation', () => {
    const physics = fallsWorld();
    const copy = modelInstance(model);
    for (let i = 0; i < 20; i++) animate(copy, standing, [0, 1, 0], [0, 0, 0], 0, DT);
    copy.object.updateMatrixWorld(true);
    const ragdoll = startRagdoll(physics, copy.object, [0, 0, 2.5])!;
    expect(ragdoll.parts.map((p) => p.bone.name)).toEqual(RAGDOLL.map((p) => p.bone));
    for (let i = 0; i < 180; i++) {
      physics.step();
      poseRagdoll(physics, ragdoll);
    }
    copy.object.updateMatrixWorld(true);
    const head = copy.object.getObjectByName('head')!.getWorldPosition(new THREE.Vector3());
    // Lying: its head near the floor (0.8 m under the center), not 1.3 m above it.
    expect(head.y).toBeLessThan(-0.45);
    // Pushed towards +Z: it fell that way.
    expect(head.z).toBeGreaterThan(0.3);
    for (const part of ragdoll.parts) expect(part.transform.position[1], part.bone.name).toBeGreaterThan(-0.8 - 0.01);
    // Each joint holds: a part's start, where its body has it, is where its parent's bone puts it.
    for (const part of ragdoll.parts.slice(1)) {
      const body = new THREE.Vector3(...part.transform.position).add(
        new THREE.Vector3(0, -part.half, 0).applyQuaternion(new THREE.Quaternion(...part.transform.rotation)),
      );
      expect(body.distanceTo(part.bone.getWorldPosition(new THREE.Vector3())), part.bone.name).toBeLessThan(0.03);
    }
    // It gets up: its bodies gone, its animation back within a fifth of a second (by inertia).
    stopRagdoll(physics, ragdoll);
    copy.getUp = true;
    // (Down, its animations waited: as many frames played as a copy that never fell.)
    const fresh = modelInstance(model);
    for (let i = 0; i < 20 + 20; i++) animate(fresh, standing, [0, 1, 0], [0, 0, 0], 0, DT);
    for (let i = 0; i < 20; i++) animate(copy, standing, [0, 1, 0], [0, 0, 0], 0, DT);
    copy.object.updateMatrixWorld(true);
    fresh.object.updateMatrixWorld(true);
    for (const name of ['hips', 'spine', 'thigh_L', 'forearm_R'])
      expect(
        copy.object
          .getObjectByName(name)!
          .getWorldQuaternion(new THREE.Quaternion())
          .angleTo(fresh.object.getObjectByName(name)!.getWorldQuaternion(new THREE.Quaternion())),
        name,
      ).toBeLessThan(1e-3);
    expect(copy.object.getObjectByName('hips')!.position.distanceTo(fresh.object.getObjectByName('hips')!.position)).toBeLessThan(
      1e-3,
    );
    physics.dispose();
  });
});
