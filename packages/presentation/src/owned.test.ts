import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { describe, expect, test } from 'vitest';
import { own, ownMaterial, release } from './owned';

/** Which of these were freed (three.js says so with a `dispose` event). */
function watch(...things: (THREE.BufferGeometry | THREE.Material)[]) {
  const freed = new Set<THREE.BufferGeometry | THREE.Material>();
  for (const t of things) t.addEventListener('dispose', () => freed.add(t));
  return freed;
}

describe('who frees what (stage 2e)', () => {
  test("a model's copy frees its own color and a ghost's look, never what every copy shares", () => {
    // A model as it loads: two pieces of body and a joint, sharing nothing with anyone yet.
    const body = new THREE.MeshStandardMaterial({ name: 'body' });
    const joint = new THREE.MeshStandardMaterial({ name: 'joint' });
    const torso = new THREE.BoxGeometry();
    const head = new THREE.BoxGeometry();
    const knee = new THREE.BoxGeometry();
    const model = new THREE.Group().add(new THREE.Mesh(torso, body), new THREE.Mesh(head, body), new THREE.Mesh(knee, joint));
    const freed = watch(body, joint, torso, head, knee);

    // Two copies, as the bodies make them: each one's body in its player's color (one for all its pieces).
    const copies = [cloneSkeleton(model), cloneSkeleton(model)];
    const colors = copies.map((copy) => {
      const pieces = (copy.children as THREE.Mesh[]).filter((m) => (m.material as THREE.Material).name === 'body');
      const color = (pieces[0]!.material as THREE.MeshStandardMaterial).clone();
      for (const piece of pieces) ownMaterial(piece, color);
      return color;
    });
    const freedColors = watch(...colors);

    // The second becomes a ghost: translucent, in materials of its own (its color is replaced, and freed).
    const ghostly = (copies[1]!.children as THREE.Mesh[]).map((mesh) => {
      const m = (mesh.material as THREE.Material).clone();
      m.transparent = true;
      ownMaterial(mesh, m);
      return m;
    });
    const freedGhost = watch(...ghostly);
    expect(freedColors.has(colors[1]!), "the ghost's replaced color").toBe(true);

    // Both go: each frees what it owns, and the model's geometry and materials stay for the next copy.
    copies.forEach(release);
    expect(freedColors.has(colors[0]!), "the first copy's color").toBe(true);
    expect(freedGhost.size, "the ghost's own materials").toBe(ghostly.length);
    expect([...freed], 'nothing the copies shared').toEqual([]);
  });

  test('a shape frees its own geometry and material, never the box every box shares', () => {
    const box = new THREE.BoxGeometry();
    const crate = own(new THREE.Mesh(box, new THREE.MeshLambertMaterial()), { material: true });
    const capsule = own(new THREE.Mesh(new THREE.CapsuleGeometry(), new THREE.MeshLambertMaterial()), {
      geometry: true,
      material: true,
    });
    const freed = watch(box, crate.material as THREE.Material, capsule.geometry, capsule.material as THREE.Material);
    release(crate);
    release(capsule);
    expect(freed.has(box), 'the shared box').toBe(false);
    expect(freed.size).toBe(3);
  });

  test("a grid's lines free their own geometry and material too (stage 3b: before, only meshes were freed)", () => {
    const grid = own(new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()), {
      geometry: true,
      material: true,
    });
    const freed = watch(grid.geometry, grid.material as THREE.Material);
    release(grid);
    expect(freed.size).toBe(2);
  });
});
