import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { beforeAll, describe, expect, test } from 'vitest';
import { FAMILIES } from '@manifold/presentation/locomotion';
import { modelInstance } from '@manifold/presentation/models';
import { POSES } from './index';

/**
 * THE MANNEQUIN CROUCHED (stage 4b): what is drawn fits the body the controller moves, so that under a
 * low gap the head does not go through it. Measured on the file, in Node.
 */
const files = import.meta.glob<string>('../assets/mannequin.glb', { query: '?inline', import: 'default', eager: true });

let model: { scene: THREE.Object3D; clips: THREE.AnimationClip[] };
beforeAll(async () => {
  const url = files['../assets/mannequin.glb']!;
  const bytes = Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  model = { scene: gltf.scene, clips: gltf.animations };
});

describe('the mannequin crouched (stage 4b)', () => {
  test('quiet and moving every way, it stays inside its crouched body, and its knees above the floor', () => {
    const pose = POSES.crouch!;
    if (pose.shape.kind !== 'capsule') throw new Error('a capsule');
    const top = pose.offset[1] + pose.shape.halfHeight + pose.shape.radius;
    const copy = modelInstance(model);
    const box = new THREE.Box3();
    for (const clip of ['crouch_idle', ...FAMILIES.crouch]) {
      const action = copy.actions.get(clip)!;
      for (const a of copy.actions.values()) a.setEffectiveWeight(a === action ? 1 : 0);
      for (let k = 0; k < 32; k++) {
        action.time = (k / 32) * action.getClip().duration;
        copy.mixer.update(0);
        copy.object.updateMatrixWorld(true);
        box.setFromObject(copy.object, true);
        expect(box.max.y, `${clip} at ${k}/32: its top`).toBeLessThan(top);
        for (const side of ['L', 'R'])
          expect(
            copy.object.getObjectByName(`shin_${side}`)!.getWorldPosition(new THREE.Vector3()).y,
            `${clip}: a knee`,
          ).toBeGreaterThan(-0.75);
      }
    }
  });
});
