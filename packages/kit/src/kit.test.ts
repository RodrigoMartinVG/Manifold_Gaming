import { describe, expect, test } from 'vitest';
import kitGlb from '../assets/kit.glb?inline';
import provenance from '../assets/assets.json';
import { KIT, KIT_TRIANGLES, kitModel } from './index';

/** The GLB's JSON: what a glTF says it has (its nodes, meshes, materials). */
function gltfJson(dataUrl: string) {
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const length = view.getUint32(12, true);
  return {
    size: bytes.length,
    json: JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) as {
      nodes: { name: string; mesh?: number; children?: number[] }[];
      materials: { name: string }[];
      images?: unknown[];
    },
  };
}

describe('the kit of level pieces (stage 4.5e, decision 0026)', () => {
  const { size, json } = gltfJson(kitGlb);

  test('every piece the catalog has is a node of the model, at its origin, and none more; each with its boxes', () => {
    const nodes = json.nodes.filter((n) => n.mesh !== undefined).map((n) => n.name);
    expect(nodes.sort()).toEqual(Object.keys(KIT).sort());
    for (const [name, piece] of Object.entries(KIT)) {
      expect(piece.boxes.length, name).toBeGreaterThan(0);
      expect(piece.model).toBe(kitModel(name));
      for (const b of piece.boxes) expect(Math.min(...b.half), name).toBeGreaterThan(0);
      // Its size, positive, on a grid of a meter where it is a wall or a floor.
      expect(Math.min(...piece.size), name).toBeGreaterThan(0);
    }
    expect(Object.keys(KIT).length).toBeGreaterThanOrEqual(20);
  });

  test('within its budget: under 600 triangles a piece, 10,000 the kit, four materials, no textures', () => {
    for (const [name, triangles] of Object.entries(KIT_TRIANGLES)) expect(triangles, name).toBeLessThan(600);
    expect(Object.values(KIT_TRIANGLES).reduce((a, b) => a + b, 0)).toBeLessThan(10_000);
    expect(json.materials.map((m) => m.name).sort()).toEqual(['metal', 'stone', 'stone_dark', 'wood']);
    expect(json.images ?? []).toEqual([]);
    expect(size).toBeLessThan(400 * 1024);
  });

  test('it says where it comes from: a script of ours', () => {
    expect(provenance['kit.glb'].madeBy).toBe('art/kit.py');
  });

  test('a wall stands on the floor its origin is on, 3 m tall; a floor’s top is its origin; the stairs of a floor rise 3 m', () => {
    const top = (name: string) => Math.max(...KIT[name]!.boxes.map((b) => b.center[1] + b.half[1]));
    const bottom = (name: string) => Math.min(...KIT[name]!.boxes.map((b) => b.center[1] - b.half[1]));
    expect([bottom('wall_2'), top('wall_2')]).toEqual([0, 3]);
    expect(top('floor_4')).toBe(0);
    expect(top('stairs_3')).toBeCloseTo(3, 9);
    // The ramp: a meter up over four, turned 14.04° about x.
    expect(KIT.ramp_1!.boxes[0]!.turn).toEqual({ axis: 'x', degrees: 14.0362 });
  });

  test('each opening is as wide and as tall as it says: the doorways, the gate, the window', () => {
    /** The gap between a piece's two side boxes (standing on the floor), and what is under its lintel. */
    const round = (n: number) => +n.toFixed(4);
    const opening = (name: string) => {
      const boxes = KIT[name]!.boxes;
      const sides = boxes.filter((b) => b.center[1] - b.half[1] === 0 && b.half[1] === 1.5);
      const left = Math.max(...sides.filter((b) => b.center[0] < 0).map((b) => b.center[0] + b.half[0]));
      const right = Math.min(...sides.filter((b) => b.center[0] > 0).map((b) => b.center[0] - b.half[0]));
      const over = boxes.filter((b) => !sides.includes(b));
      const lintel = Math.max(...over.map((b) => b.center[1] - b.half[1]));
      const sill = Math.max(0, ...over.filter((b) => b.center[1] < 1.5).map((b) => b.center[1] + b.half[1]));
      // Nothing in between: what is over it spans the whole gap.
      for (const b of over)
        expect([round(b.center[0] - b.half[0]), round(b.center[0] + b.half[0])], name).toEqual([round(left), round(right)]);
      return { wide: round(right - left), from: round(sill), to: round(lintel) };
    };
    expect(opening('wall_door')).toEqual({ wide: 1, from: 0, to: 2.2 });
    expect(opening('wall_door_wide')).toEqual({ wide: 2, from: 0, to: 2.2 });
    expect(opening('wall_gate')).toEqual({ wide: 2.4, from: 0, to: 2.6 });
    expect(opening('wall_window')).toEqual({ wide: 1, from: 1, to: 2 });
  });
});
