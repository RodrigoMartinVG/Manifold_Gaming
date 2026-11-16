import { describe, expect, test } from 'vitest';
import { CHARACTER_CLIPS, FAMILIES } from '@manifold/presentation/locomotion';
import list from '../assets/assets.json';
import { gltf, nameOf } from './glb';

/**
 * THE CHARACTERS' ART (stage 2e; shared since 4a, decision 0015): every file in `packages/character/assets/`
 * says where it comes from, and the mannequin fits what a modest GPU draws, with an animation for each
 * way of moving.
 */
// (Every file but the list itself.)
const files = import.meta.glob<string>(['../assets/*', '!../assets/assets.json'], {
  query: '?inline',
  import: 'default',
  eager: true,
});
const scripts = import.meta.glob('../../../art/*.py', { query: '?raw', eager: true });
const entries = list as Record<string, { what: string; madeBy?: string; source?: string; author?: string; license?: string }>;

describe("the characters' art (stage 2e, shared since 4a)", () => {
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
    // No root motion: the simulation moves the character; an animation turns its bones, and only the
    // hips go up and down, never along the ground (after the tutorial's pass: walking and running, a
    // foot reaching the floor ahead or behind needs the hips lower than they are built, where a leg
    // straight down just reaches it). (Blender writes every bone's place and size too: the rest must
    // not change, from the first key to the last.)
    const root = json.scenes[0]!.nodes[0]!;
    const hipsNode = json.nodes.findIndex((n) => n.name === 'hips');
    const built = json.nodes[hipsNode]!.translation ?? [0, 0, 0];
    for (const a of json.animations ?? [])
      for (const c of a.channels) {
        expect(c.target.node, `${a.name} moves the root`).not.toBe(root);
        if (c.target.path === 'rotation') continue;
        // (To a micron: Blender takes each sample apart from a matrix, and its last bits wobble.)
        const values = glb.floats(a.samplers[c.sampler]!.output, json);
        const what = `${a.name}: ${json.nodes[c.target.node]?.name}'s ${c.target.path} changes`;
        const bounce = c.target.node === hipsNode && c.target.path === 'translation';
        for (let i = 3; i < values.length; i++) {
          if (bounce && i % 3 === 1) {
            // Up and down (glTF's Y): never above where they are built, and not much below.
            expect(values[i]! - built[1]!, `${a.name}: the hips' height`).toBeLessThan(1e-6);
            expect(values[i]! - built[1]!, `${a.name}: the hips' height`).toBeGreaterThan(-0.15);
          } else expect(Math.abs(values[i]! - values[i % 3]!), what).toBeLessThan(1e-6);
        }
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
});
