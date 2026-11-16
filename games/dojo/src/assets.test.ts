import { describe, expect, test } from 'vitest';
import { gltf, nameOf } from '@manifold/character/glb';
import list from '../assets/assets.json';

/**
 * THE DOJO'S ART (stage 2e, decision 0015): every file in `games/dojo/assets/` says where it comes
 * from, and every model fits what it is for. (The characters' mannequin is in packages/character since 4a.)
 */
// (Every file but the list itself.)
const files = import.meta.glob<string>(['../assets/*', '!../assets/assets.json'], {
  query: '?inline',
  import: 'default',
  eager: true,
});
const scripts = import.meta.glob('../../../art/*.py', { query: '?raw', eager: true });

const entries = list as Record<string, { what: string; madeBy?: string; source?: string; author?: string; license?: string }>;

describe("the Dojo's art (stage 2e)", () => {
  test('every file says where it comes from, and every entry has its file', () => {
    const present = Object.keys(files).map(nameOf).sort();
    expect(present.length).toBeGreaterThan(0);
    expect(Object.keys(entries).sort()).toEqual(present);
    for (const [file, entry] of Object.entries(entries)) {
      expect(entry.what, file).toBeTruthy();
      if (entry.madeBy) {
        // Made by a script of ours, which is in the repository (decision 0015: never by hand).
        expect(Object.keys(scripts).map(nameOf), file).toContain(nameOf(entry.madeBy));
      } else {
        // From outside: where, who, and a license that lets us (CC0, decision 0015).
        expect(entry.source && entry.author && entry.license, file).toBeTruthy();
        expect(entry.license, file).toBe('CC0-1.0');
      }
    }
  });

  test('the door (stage 3c) is the size of the box a level gives a door, its origin at its center, its hinges on its left edge', () => {
    const { size, json } = gltf(files['../assets/door.glb']!);
    const triangles = json.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + json.accessors[p.indices]!.count / 3, 0);
    expect(triangles).toBeLessThan(800);
    expect(json.materials?.length ?? 0).toBe(3); // the wood, the panels, the metal
    expect(json.textures?.length ?? 0).toBe(0);
    expect(json.animations ?? []).toEqual([]);
    expect(size).toBeLessThan(40_000);
    // Where it reaches, over all its pieces (in the engine's frame: x across, y up, z through it).
    const positions = json.meshes.flatMap((m) => m.primitives).map((p) => json.accessors[p.attributes.POSITION!]!);
    const min = [0, 1, 2].map((k) => Math.min(...positions.map((a) => a.min![k]!)));
    const max = [0, 1, 2].map((k) => Math.max(...positions.map((a) => a.max![k]!)));
    // Inside its box (1.2 × 2.2, centered) but for what sticks out of a door: the hinges, past its left
    // edge, and the handles, out of its faces.
    expect(max[1]!).toBeLessThanOrEqual(1.1);
    expect(min[1]!).toBeGreaterThanOrEqual(-1.1);
    expect(max[0]!).toBeLessThanOrEqual(0.6);
    expect(min[0]!, 'the hinges, on the left edge').toBeLessThan(-0.6);
    expect(Math.max(-min[2]!, max[2]!), 'the handles').toBeLessThan(0.12);
  });

  test('the lamp (stage 3e) is whole and broken in one model: the bulb in one node, its shards in the other, its origin at the bulb', () => {
    const { size, json } = gltf(files['../assets/lamp.glb']!);
    const triangles = json.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + json.accessors[p.indices]!.count / 3, 0);
    expect(triangles).toBeLessThan(800);
    expect(json.textures?.length ?? 0).toBe(0);
    expect(size).toBeLessThan(60_000);
    // What the presentation shows one or the other of, by name.
    const names = json.nodes.map((n) => n.name);
    expect(names).toEqual(expect.arrayContaining(['lamp', 'frame', 'whole', 'broken']));
    const materials = (json.materials ?? []) as { name?: string }[];
    expect(materials.map((m) => m.name).sort()).toEqual(['glass', 'metal', 'shard']);
    // The bulb: about 0.26 m across (an icosphere of radius 0.13: its vertices reach 0.12 to 0.13 on each
    // axis), centered on the origin, where the simulation puts the lamp and its ball (radius 0.15).
    const whole = json.nodes.find((n) => n.name === 'whole')!;
    const bulb = json.accessors[json.meshes[whole.mesh!]!.primitives[0]!.attributes.POSITION!]!;
    for (const k of [0, 1, 2]) {
      expect(-bulb.min![k]!).toBeGreaterThan(0.12);
      expect(bulb.max![k]!).toBeGreaterThan(0.12);
      expect(Math.max(-bulb.min![k]!, bulb.max![k]!)).toBeLessThanOrEqual(0.15);
    }
  });
});
