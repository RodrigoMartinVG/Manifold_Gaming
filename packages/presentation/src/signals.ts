import * as THREE from 'three';
import type { CommandInfo, VariableInfo } from '@manifold/commands';
import type { Signal, World } from '@manifold/core';
import type { Bodies } from './bodies';
import type { GamePage, Piece } from './page';

/** What looking at the signals lets people do, as data (the site's console reference reads it). */
export const SIGNALS_VARIABLES = {
  signals: {
    name: 'show.signals',
    description:
      'The signals (stage 3c), as lines from each mechanism to the zones its signal comes from, through the logic in between: green while its signal is on, red while it is off.',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
} as const satisfies Record<string, VariableInfo>;

export const SIGNALS_COMMANDS = {
  signals: {
    name: 'signals',
    description:
      "The level's signals (stage 3c), in the order they are computed: each one's value, what it is made of, and which mechanisms follow it. The inputs can be set with `signal`.",
  },
} as const satisfies Record<string, CommandInfo>;

/** What a signal is made of, as the level writes it. */
const rule = (s: Readonly<Signal>) => (s.op === 'input' ? 'input' : `${s.op} ${s.reads.join(' ')}`);

/** The zones a signal comes from, through every signal it reads (they are declared above it: no cycles). */
function zonesOf(world: World, name: string, seen = new Set<string>()): string[] {
  if (seen.has(name)) return [];
  seen.add(name);
  const s = world.signals.find((x) => x.name === name);
  if (!s) return [];
  if (s.op === 'zone' || s.op === 'used') return [...s.reads];
  return s.reads.flatMap((r) => zonesOf(world, r, seen));
}

/**
 * THE SIGNALS, SEEN (stage 3c, decision 0018): `signals` lists them, with their values and what follows
 * each, and `show.signals` draws them: a line from every mechanism to every zone its signal comes from,
 * green while the signal is on. Off, it costs nothing.
 */
export function mountSignals(page: GamePage, bodies: Bodies): Piece {
  const { scene } = page.stage;
  const lines = (color: number) => {
    const l = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    l.visible = false;
    l.renderOrder = 2;
    l.frustumCulled = false;
    scene.add(l);
    return l;
  };
  const on = lines(0x5ad87a);
  const off = lines(0xd85a5a);
  page.registry.declareVariable({ ...SIGNALS_VARIABLES.signals, onChange: (v) => (on.visible = off.visible = v === true) });
  page.registry.declareCommand({
    ...SIGNALS_COMMANDS.signals,
    run: (_, out) => {
      const world = page.session.world;
      if (world.signals.length === 0) return out.write('no signals here: a level declares them (`signal gate toggle pressed`)');
      const followers = (name: string) =>
        [...world.entities.values()]
          .filter((e) => e.mechanism?.signal === name)
          .map((e) => `${e.mechanism!.door ? 'door' : 'lift'} ${e.name ?? e.id}`);
      out.write(
        world.signals
          .map((s) => {
            const after = followers(s.name);
            return `${s.name} = ${s.value}  (${rule(s)})${after.length ? ` → ${after.join(', ')}` : ''}`;
          })
          .join('\n'),
      );
    },
  });

  /** Where an entity is drawn now (between steps), or where it is. */
  const drawn = (world: World, id: number) =>
    bodies.meshes.get(id)?.position.toArray() ?? world.entities.get(id)?.transform?.position ?? null;

  return {
    frame({ world }) {
      if (!on.visible) return;
      const green: number[] = [];
      const red: number[] = [];
      for (const e of world.entities.values()) {
        if (!e.mechanism) continue;
        const from = drawn(world, e.id);
        if (!from) continue;
        const into = world.signal(e.mechanism.signal) !== 0 ? green : red;
        for (const zone of zonesOf(world, e.mechanism.signal)) {
          const to = world.named(zone)?.transform?.position;
          if (to) into.push(...from, ...to);
        }
      }
      on.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(green), 3));
      off.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(red), 3));
    },
  };
}
