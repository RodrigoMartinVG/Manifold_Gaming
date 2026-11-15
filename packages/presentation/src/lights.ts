import * as THREE from 'three';
import { quat, vec3, type Vec3 } from '@manifold/common';
import type { VariableInfo } from '@manifold/commands';
import type { EntityId, World } from '@manifold/core';
import type { Bodies } from './bodies';
import type { GamePage, Piece } from './page';

/** What looking at the light and the vision lets people change, as data (the site's console reference reads it). */
export const LIGHTS_VARIABLES = {
  light: {
    name: 'show.light',
    description:
      "The lamps' reach (stage 3d), as wire balls: yellow while on, grey while off. The light is the simulation's: `inspect me` says how lit your character is (`character.light`).",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
  vision: {
    name: 'show.vision',
    description:
      'What each watcher looks at (stage 3d): the edge of its field of view, as far as it sees, and a line to every character in it: green if it sees it, red if not (in the dark, behind something, in a fog).',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
} as const satisfies Record<string, VariableInfo>;

/** How bright three.js draws a lamp of intensity 1 (decay 1: about linear, as the simulation's). */
const DRAWN_INTENSITY = 6;
const LAMP_LIGHT = 0xffd9a0;

/**
 * THE LIGHT, DRAWN (stage 3d): the simulation's, read and never written. The stage's daylight is the
 * world's ambient light; every lamp lights with a point light of its radius while it is on, and its
 * ball glows; a watcher that sees someone glows red. `show.light` draws the lamps' reach and
 * `show.vision` what each watcher looks at. (For the browser tests: how lit the player is, and how
 * many watchers see it.)
 */
export function mountLights(page: GamePage, bodies: Bodies): Piece {
  const { scene } = page.stage;
  const lamps = new Map<EntityId, THREE.PointLight>();
  const lines = (color: number) => {
    const l = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.85 }),
    );
    l.visible = false;
    l.renderOrder = 2;
    l.frustumCulled = false;
    scene.add(l);
    return l;
  };
  const reachOn = lines(0xffd27a);
  const reachOff = lines(0x6a6a6a);
  const cones = lines(0xb0a890);
  const seenLines = lines(0x5ad87a);
  const unseenLines = lines(0xd85a5a);
  page.registry.declareVariable({
    ...LIGHTS_VARIABLES.light,
    onChange: (v) => (reachOn.visible = reachOff.visible = v === true),
  });
  page.registry.declareVariable({
    ...LIGHTS_VARIABLES.vision,
    onChange: (v) => (cones.visible = seenLines.visible = unseenLines.visible = v === true),
  });

  const forget = (id: EntityId) => {
    const light = lamps.get(id);
    if (!light) return;
    scene.remove(light);
    light.dispose();
    lamps.delete(id);
  };
  /** A circle of `segments` around `axis` through `center`, of `radius`, as line pairs. */
  const circle = (out: number[], center: Vec3, a: Vec3, b: Vec3, radius: number, segments = 24) => {
    for (let i = 0; i < segments; i++)
      for (const j of [i, i + 1]) {
        const t = (j / segments) * Math.PI * 2;
        const p = vec3.add(center, vec3.add(vec3.scale(a, Math.cos(t) * radius), vec3.scale(b, Math.sin(t) * radius)));
        out.push(...p);
      }
  };
  const set = (l: THREE.LineSegments, xyz: number[]) =>
    l.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));

  return {
    welcome(session) {
      for (const id of [...lamps.keys()]) forget(id);
      void session;
    },
    event(ev) {
      if (ev.type === 'entityRemoved') forget(ev.id);
    },
    frame({ world, hero }) {
      page.stage.daylight(world.ambient);
      // What glows: a model's `glass` (stage 3e: the lamp's bulb), if it has one; if not, all of it.
      const glow = (id: EntityId, color: number) => {
        const drawn = bodies.meshes.get(id);
        if (!drawn) return;
        const parts: THREE.MeshLambertMaterial[] = [];
        drawn.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshLambertMaterial | undefined;
          if (m && 'emissive' in m) parts.push(m);
        });
        const glass = parts.filter((m) => m.name === 'glass');
        for (const m of glass.length ? glass : parts) if (m.emissive.getHex() !== color) m.emissive.setHex(color);
      };
      for (const e of world.entities.values()) {
        if (e.lamp && e.transform) {
          let light = lamps.get(e.id);
          if (!light) {
            light = new THREE.PointLight(LAMP_LIGHT, 0, e.lamp.radius, 1);
            scene.add(light);
            lamps.set(e.id, light);
          }
          light.position.set(...e.transform.position);
          light.intensity = e.lamp.on ? e.lamp.intensity * DRAWN_INTENSITY : 0;
          glow(e.id, e.lamp.on ? 0xb08a40 : 0x000000);
        }
        if (e.watcher) glow(e.id, e.watcher.sees.length ? 0x902020 : 0x000000);
      }
      if (reachOn.visible) {
        const on: number[] = [];
        const off: number[] = [];
        for (const e of world.entities.values()) {
          if (!e.lamp || !e.transform) continue;
          const out = e.lamp.on ? on : off;
          const c = e.transform.position;
          circle(out, c, [1, 0, 0], [0, 0, 1], e.lamp.radius);
          circle(out, c, [1, 0, 0], [0, 1, 0], e.lamp.radius);
          circle(out, c, [0, 1, 0], [0, 0, 1], e.lamp.radius);
        }
        set(reachOn, on);
        set(reachOff, off);
      }
      if (cones.visible) drawVision(world);
      // For the browser tests (probe.ts's way): how lit the player is, and how many watchers see it.
      const lit = hero?.character ? hero.character.light.toFixed(2) : '';
      if (page.container.dataset.light !== lit) page.container.dataset.light = lit;
      const seen = hero ? String([...world.entities.values()].filter((e) => e.watcher?.sees.includes(hero.id)).length) : '';
      if (page.container.dataset.seen !== seen) page.container.dataset.seen = seen;
    },
    stop() {
      for (const id of [...lamps.keys()]) forget(id);
    },
  };

  /** The edge of each watcher's field of view, as far as it sees, and a line to every character in it. */
  function drawVision(world: World) {
    const edge: number[] = [];
    const seen: number[] = [];
    const unseen: number[] = [];
    for (const eye of world.entities.values()) {
      const w = eye.watcher;
      if (!w || !eye.transform) continue;
      const from = eye.transform.position;
      const forward = quat.rotate(eye.transform.rotation, [0, 0, -1]);
      const right = quat.rotate(eye.transform.rotation, [1, 0, 0]);
      const upward = quat.rotate(eye.transform.rotation, [0, 1, 0]);
      const sin = Math.sqrt(Math.max(0, 1 - w.cone * w.cone));
      const center = vec3.add(from, vec3.scale(forward, w.range * w.cone));
      const radius = w.range * sin;
      circle(edge, center, right, upward, radius);
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2;
        edge.push(
          ...from,
          ...vec3.add(center, vec3.add(vec3.scale(right, Math.cos(t) * radius), vec3.scale(upward, Math.sin(t) * radius))),
        );
      }
      for (const e of world.entities.values()) {
        if (!e.character || !e.transform) continue;
        const to = vec3.sub(e.transform.position, from);
        const d = vec3.length(to);
        if (d > w.range || d < 1e-9 || vec3.dot(vec3.scale(to, 1 / d), forward) < w.cone) continue;
        const at = bodies.meshes.get(e.id)?.position.toArray() ?? e.transform.position;
        (w.sees.includes(e.id) ? seen : unseen).push(...from, ...at);
      }
    }
    set(cones, edge);
    set(seenLines, seen);
    set(unseenLines, unseen);
  }
}
