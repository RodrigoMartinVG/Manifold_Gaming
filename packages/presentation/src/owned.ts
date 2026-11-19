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
 * (Lines too, since stage 3b: a grid is drawn with them, and they have a geometry and a material; and points,
 * since stage 5.5g: the debug views draw contacts with them.)
 */
type Drawn = THREE.Mesh | THREE.Line | THREE.Points;
const isDrawn = (o: THREE.Object3D): o is Drawn =>
  o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points;

export function own<T extends Drawn>(mesh: T, what: { geometry?: boolean; material?: boolean }): T {
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
    if (!isDrawn(o)) return;
    if (o.userData.ownMaterial) for (const m of [o.material].flat()) owned.add(m);
    if (o.userData.ownGeometry) owned.add(o.geometry);
  });
  for (const thing of owned) thing.dispose();
}

/**
 * THE MATERIALS ONE COPY MAY CHANGE (stage 5.5a): those `pick` chooses, made its own the first time it
 * asks (one copy of each, shared by its pieces as the original was) and kept after, freed with it by
 * `release`. What glows per entity changes its materials: shared with every other copy of the model, a
 * lamp put out put out every lamp's glass, and a guard who saw someone turned every character's visor red.
 */
export function ownedMaterials(object: THREE.Object3D, pick: (m: THREE.Material) => boolean): THREE.Material[] {
  const made = new Map<THREE.Material, THREE.Material>();
  const mine = new Set<THREE.Material>();
  object.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const m = o.material as THREE.Material;
    if (!pick(m)) return;
    if (o.userData.ownMaterial) return void mine.add(m);
    let copy = made.get(m);
    if (!copy) made.set(m, (copy = m.clone()));
    ownMaterial(o, copy);
    mine.add(copy);
  });
  return [...mine];
}
