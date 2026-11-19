import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { glow } from './lights';
import { release } from './owned';

describe('what glows is each copy’s own (stage 5.5a)', () => {
  /** A model as it loads, and two copies as the bodies make them: its glass on two pieces, shared. */
  function lamps() {
    const glass = new THREE.MeshStandardMaterial({ name: 'glass' });
    const iron = new THREE.MeshStandardMaterial({ name: 'iron' });
    const model = new THREE.Group().add(
      new THREE.Mesh(new THREE.BoxGeometry(), glass),
      new THREE.Mesh(new THREE.BoxGeometry(), glass),
      new THREE.Mesh(new THREE.BoxGeometry(), iron),
    );
    return { glass, iron, a: model.clone(), b: model.clone() };
  }
  const emissives = (o: THREE.Object3D) =>
    (o.children as THREE.Mesh[]).map((m) => (m.material as THREE.MeshStandardMaterial).emissive.getHex());

  test('a lamp turned on lights its own glass, not every lamp’s (they shared it: all showed the last one’s)', () => {
    const { a, b } = lamps();
    glow(a, 0xb08a40);
    glow(b, 0x000000);
    expect(emissives(a)).toEqual([0xb08a40, 0xb08a40, 0x000000]);
    expect(emissives(b)).toEqual([0x000000, 0x000000, 0x000000]);
    // Its glass is one material for its two pieces, as the model's was; the iron, not glowing, stays shared.
    const [g1, g2, i] = (a.children as THREE.Mesh[]).map((m) => m.material);
    expect(g1).toBe(g2);
    expect(i).toBe((b.children[2] as THREE.Mesh).material);
  });

  test('without glass, all of it glows (a watcher), its own; made its own once, freed with it, the model’s kept', () => {
    const iron = new THREE.MeshStandardMaterial({ name: 'iron' });
    const model = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), iron));
    const [a, b] = [model.clone(), model.clone()];
    glow(a, 0x902020);
    expect(emissives(a)).toEqual([0x902020]);
    expect(emissives(b)).toEqual([0x000000]);
    const mine = (a.children[0] as THREE.Mesh).material;
    glow(a, 0x000000);
    expect((a.children[0] as THREE.Mesh).material).toBe(mine);
    let freed = 0;
    (mine as THREE.Material).addEventListener('dispose', () => freed++);
    iron.addEventListener('dispose', () => (freed += 10));
    release(a);
    expect(freed).toBe(1);
  });
});
