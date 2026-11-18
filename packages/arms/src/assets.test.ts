import { describe, expect, test } from 'vitest';
import { gltf } from '@manifold/character/glb';
import weaponsGlb from '../assets/weapons.glb?inline';
import list from '../assets/assets.json';
import { RELOAD_LOOK, reloadLift, WEAPON_LOOKS, weaponModel } from './looks';
import { ARMS_MODELS } from './models';
import { RELOAD_IN, WEAPON_KINDS } from './weapons';

const scripts = import.meta.glob('../../../art/*.py', { query: '?raw', eager: true });

describe('the weapons’ model (stage 5g, decision 0015)', () => {
  const { json } = gltf(weaponsGlb);

  test('made by a script of ours, in the repository', () => {
    const entry = (list as Record<string, { what: string; madeBy?: string }>)['weapons.glb'];
    expect(entry?.what).toBeTruthy();
    expect(Object.keys(scripts).map((p) => p.replace(/^.*\//, ''))).toContain(entry!.madeBy!.replace(/^.*\//, ''));
  });

  test('each weapon a node at its own origin, none more; each its look’s model, by its name', () => {
    const nodes = json.nodes.filter((n) => n.mesh !== undefined);
    expect(nodes.map((n) => n.name).sort()).toEqual([...WEAPON_KINDS].sort());
    for (const n of nodes) expect(n.translation ?? [0, 0, 0], n.name).toEqual([0, 0, 0]);
    for (const kind of WEAPON_KINDS) {
      expect(WEAPON_LOOKS[kind].model).toBe(weaponModel(kind));
      expect(ARMS_MODELS[weaponModel(kind)]).toMatch(new RegExp(`#${kind}$`));
    }
  });

  test('each fits its look’s box (across, up, along: x, y, z), centered on its origin, its muzzle reaching the +Z end; few triangles', () => {
    for (const n of json.nodes.filter((n) => n.mesh !== undefined)) {
      const look = WEAPON_LOOKS[n.name as keyof typeof WEAPON_LOOKS];
      const primitives = json.meshes[n.mesh!]!.primitives;
      const lo = [Infinity, Infinity, Infinity];
      const hi = [-Infinity, -Infinity, -Infinity];
      let triangles = 0;
      for (const p of primitives) {
        const position = json.accessors[p.attributes.POSITION!]!;
        for (let k = 0; k < 3; k++) {
          lo[k] = Math.min(lo[k]!, position.min![k]!);
          hi[k] = Math.max(hi[k]!, position.max![k]!);
        }
        triangles += json.accessors[p.indices]!.count / 3;
      }
      for (let k = 0; k < 3; k++) {
        expect(hi[k]!, `${n.name} ${k}`).toBeLessThanOrEqual(look.size[k]! / 2 + 1e-3);
        expect(-lo[k]!, `${n.name} ${k}`).toBeLessThanOrEqual(look.size[k]! / 2 + 1e-3);
      }
      // Its far end is its muzzle: within 2 cm of the box's +Z end.
      expect(hi[2]!, n.name).toBeGreaterThan(look.size[2] / 2 - 0.02);
      expect(triangles, n.name).toBeLessThan(300);
    }
  });
});

describe('a reload, seen (stage 5o)', () => {
  test('down at once, a jolt up when the new magazine goes in, back up for the last eighth', () => {
    expect([0, 0.3, 0.6].map(reloadLift)).toEqual([RELOAD_LOOK.down, RELOAD_LOOK.down, RELOAD_LOOK.down]);
    expect(reloadLift(RELOAD_IN)).toBe(RELOAD_LOOK.jolt);
    expect(reloadLift(RELOAD_IN + RELOAD_LOOK.joltFor)).toBe(RELOAD_LOOK.down);
    expect([RELOAD_LOOK.upAt, 1].map(reloadLift)).toEqual([0, 0]);
  });
});
