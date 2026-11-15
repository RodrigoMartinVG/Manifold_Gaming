import * as THREE from 'three';

/**
 * WHO FREES WHAT (stage 2e). What is drawn for an entity is made of meshes, and a mesh's geometry
 * and material may be its own or another's: a box or a sphere shares one shape scaled; a model's copy
 * shares the model's geometry and materials with every other copy (one model on the GPU, however many
 * characters). Freeing a shared one with a copy would take it from the others.
 *
 * So each mesh says what is its own (`userData.ownGeometry`, `userData.ownMaterial`), marked where it
 * is made, and only that is freed with it. A mesh that says nothing owns nothing: a model's copy is
 * born like that, and becomes the owner only of what is made for it (its color, a ghost's look).
 */
export function own(mesh: THREE.Mesh, what: { geometry?: boolean; material?: boolean }): THREE.Mesh {
  if (what.geometry) mesh.userData.ownGeometry = true;
  if (what.material) mesh.userData.ownMaterial = true;
  return mesh;
}

/** Gives a mesh a material of its own in place of the one it has (freed, if that one was its own). */
export function ownMaterial(mesh: THREE.Mesh, material: THREE.Material) {
  if (mesh.userData.ownMaterial) for (const m of [mesh.material].flat()) m.dispose();
  mesh.material = material;
  mesh.userData.ownMaterial = true;
}

/** Frees what an object's meshes own, each thing once (its pieces may share it: a copy's color), and nothing they share with others. */
export function release(object: THREE.Object3D) {
  const owned = new Set<THREE.Material | THREE.BufferGeometry>();
  object.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    if (o.userData.ownMaterial) for (const m of [o.material].flat()) owned.add(m);
    if (o.userData.ownGeometry) owned.add(o.geometry);
  });
  for (const thing of owned) thing.dispose();
}
