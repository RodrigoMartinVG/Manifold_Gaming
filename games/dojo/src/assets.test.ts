import { describe, expect, test } from 'vitest';
import { CHARACTER_CLIPS, FAMILIES } from '@manifold/presentation/locomotion';
import list from '../assets/assets.json';

/**
 * THE DOJO'S ART (stage 2e, decision 0015): every file in `games/dojo/assets/` says where it comes
 * from, and every model fits what a modest GPU draws, with an animation for each way of moving.
 */
// (Every file but the list itself.)
const files = import.meta.glob<string>(['../assets/*', '!../assets/assets.json'], {
  query: '?inline',
  import: 'default',
  eager: true,
});
const scripts = import.meta.glob('../../../art/*.py', { query: '?raw', eager: true });

const nameOf = (path: string) => path.replace(/^.*\//, '');
const entries = list as Record<string, { what: string; madeBy?: string; source?: string; author?: string; license?: string }>;

/** A GLB: its JSON (what a glTF says it has) and its binary chunk (the numbers). */
function gltf(dataUrl: string) {
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(',') + 1)), (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  expect(view.getUint32(0, true)).toBe(0x46546c67); // "glTF"
  const length = view.getUint32(12, true);
  const binary = 20 + length + 8;
  return {
    size: bytes.length,
    /** An accessor's floats (an animation's keyframe values). */
    floats(
      index: number,
      json: {
        accessors: { bufferView?: number; byteOffset?: number; count: number; type: string; min?: number[]; max?: number[] }[];
        bufferViews: { byteOffset?: number }[];
      },
    ) {
      const a = json.accessors[index]!;
      const width = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type] ?? 1;
      const start = binary + (json.bufferViews[a.bufferView!]!.byteOffset ?? 0) + (a.byteOffset ?? 0);
      return Array.from({ length: a.count * width }, (_, i) => view.getFloat32(start + i * 4, true));
    },
    json: JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length))) as {
      bufferViews: { byteOffset?: number }[];
      meshes: { primitives: { indices: number; material?: number; attributes: Record<string, number> }[] }[];
      accessors: { bufferView?: number; byteOffset?: number; count: number; type: string; min?: number[]; max?: number[] }[];
      materials?: unknown[];
      textures?: unknown[];
      nodes: { name?: string; mesh?: number; children?: number[]; rotation?: number[]; translation?: number[] }[];
      animations?: {
        name: string;
        channels: { sampler: number; target: { node: number; path: string } }[];
        samplers: { input: number; output: number }[];
      }[];
      scenes: { nodes: number[] }[];
    },
  };
}

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

  test('the mannequin fits a modest GPU, and has an animation for each way of moving, without root motion', () => {
    const glb = gltf(files['../assets/mannequin.glb']!);
    const { size, json } = glb;
    const triangles = json.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + json.accessors[p.indices]!.count / 3, 0);
    // The budget (stage 2e): an integrated GPU draws several of these with two copies of the world.
    expect(triangles).toBeLessThan(3000);
    expect(json.materials?.length ?? 0).toBeLessThanOrEqual(4);
    expect(json.textures?.length ?? 0).toBe(0); // colors, not textures: one palette
    expect(json.nodes.length).toBeLessThan(40);
    expect(size).toBeLessThan(300_000);
    // The animations the presentation mixes (stage 2e2: locomotion.ts says which), exactly those.
    const clips = (json.animations ?? []).map((a) => a.name).sort();
    expect(clips).toEqual([...CHARACTER_CLIPS].sort());
    // Each one from 0 s (from frame 1, a cycle held its first pose two frames: stage 2e2), and the
    // cycles of a family of one length: mixed, at one phase, their feet are in step.
    const animation = (name: string) => json.animations!.find((a) => a.name === name)!;
    const span = (name: string) => {
      const inputs = animation(name).samplers.map((s) => json.accessors[s.input]!);
      return { start: Math.min(...inputs.map((a) => a.min![0]!)), length: Math.max(...inputs.map((a) => a.max![0]!)) };
    };
    for (const clip of CHARACTER_CLIPS) expect(span(clip).start, `${clip} starts`).toBe(0);
    for (const [family, members] of Object.entries(FAMILIES))
      for (const clip of members)
        expect(span(clip).length, `${clip}, as long as ${family}`).toBeCloseTo(span(members[0]!).length, 6);
    // The jump in the air is a whole somersault: the hips turn all the way round. Added up from one
    // key to the next (the angle between two quaternions, 2·acos|q1·q2|: the file writes each one with
    // w ≥ 0, so no single key says "a whole turn", and three.js goes the short way between two).
    const hips = json.nodes.findIndex((n) => n.name === 'hips');
    const flip = animation('flip');
    const somersault = flip.channels.find((c) => c.target.node === hips && c.target.path === 'rotation')!;
    const q = glb.floats(flip.samplers[somersault.sampler]!.output, json);
    let turned = 0;
    for (let i = 4; i < q.length; i += 4) {
      const dot = q[i]! * q[i - 4]! + q[i + 1]! * q[i - 3]! + q[i + 2]! * q[i - 2]! + q[i + 3]! * q[i - 1]!;
      turned += (2 * Math.acos(Math.min(1, Math.abs(dot))) * 180) / Math.PI;
    }
    expect(turned, 'the hips, a whole turn (degrees)').toBeCloseTo(360, 0);
    // No root motion: the simulation moves the character; an animation only turns its bones. (Blender
    // writes every bone's place and size too: they must not change, from the first key to the last.)
    const root = json.scenes[0]!.nodes[0]!;
    for (const a of json.animations ?? [])
      for (const c of a.channels) {
        expect(c.target.node, `${a.name} moves the root`).not.toBe(root);
        if (c.target.path === 'rotation') continue;
        // (To a micron: Blender takes each sample apart from a matrix, and its last bits wobble.)
        const values = glb.floats(a.samplers[c.sampler]!.output, json);
        const what = `${a.name}: ${json.nodes[c.target.node]?.name}'s ${c.target.path} changes`;
        for (let i = 3; i < values.length; i++) expect(Math.abs(values[i]! - values[i % 3]!), what).toBeLessThan(1e-6);
      }
    // And every bone turns where its animation says, also where it stays still (an elbow bent all
    // through a walk): one rotation channel per bone in every animation.
    const bones = new Set((json.animations ?? []).flatMap((a) => a.channels.map((c) => c.target.node)));
    for (const a of json.animations ?? [])
      expect(a.channels.filter((c) => c.target.path === 'rotation').length, `${a.name}'s turns`).toBe(bones.size);
    // It looks where the character looks, the engine's forward (−Z). Its visor is built on glTF's front
    // (+Z, its vertices), and its root turns it half a turn around the vertical: in the engine, the
    // visor is at −Z. (The first version had no half turn: it looked backwards and walked backwards.)
    const node = (name: string) => json.nodes.find((n) => n.name === name)!;
    const turn = node('mannequin').rotation ?? [0, 0, 0, 1];
    expect(Math.abs(turn[1]!), 'the root, half a turn around the vertical').toBeCloseTo(1, 6);
    const visor = json.meshes[node('visor_piece').mesh!]!.primitives[0]!;
    const box = json.accessors[visor.attributes.POSITION!]!;
    expect((box.min![2]! + box.max![2]!) / 2, "the visor, on glTF's front").toBeGreaterThan(0.05);
    // Names that three.js finds an animation's bones by: each one once.
    const names = json.nodes.map((n) => n.name);
    expect(new Set(names).size).toBe(names.length);
    // Its sockets (decision 0015), where something is held or worn: empty points, each hanging from
    // the bone it follows, found by name (phase 4 holds and wears things there).
    const parentOf = (name: string) => json.nodes.find((n) => n.children?.includes(json.nodes.indexOf(node(name))))?.name;
    for (const [socket, bone] of [
      ['hand_L_socket', 'forearm_L'],
      ['hand_R_socket', 'forearm_R'],
      ['head_socket', 'head'],
    ] as const) {
      expect(names, socket).toContain(socket);
      expect(node(socket).mesh, `${socket} draws nothing`).toBeUndefined();
      expect(parentOf(socket), `${socket} follows ${bone}`).toBe(bone);
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
});
