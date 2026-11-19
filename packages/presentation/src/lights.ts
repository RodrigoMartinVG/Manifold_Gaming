import * as THREE from 'three';
import { quat, vec3, type Vec3 } from '@manifold/common';
import type { VariableInfo } from '@manifold/commands';
import type { EntityId } from '@manifold/core';
import type { Bodies } from './bodies';
import { ownedMaterials } from './owned';
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
  sky: {
    name: 'view.sky',
    description:
      "The hour the sky shows on this page (stage 5a), from 0 to 24: `view.sky 6` a dawn, `view.sky 20.5` the blue hour, `view.sky 0` a night with stars. Only the drawing: how lit the world is stays the level's (its `ambient`). −1, the level's own hour (its `sky` line), or none.",
    scope: 'view',
    type: { kind: 'number', min: -1, max: 24 },
    default: -1,
  },
} as const satisfies Record<string, VariableInfo>;

/** How bright three.js draws a lamp of intensity 1 (decay 1: about linear, as the simulation's). */
const DRAWN_INTENSITY = 6;

const LAMP_LIGHT = 0xffd9a0;

/**
 * What glows of something drawn: a model's `glass` (stage 3e: the lamp's bulb), if it has one; if not,
 * all of it. Its own materials (stage 5.5a, `ownedMaterials`): the model's are every copy's.
 */
export function glow(drawn: THREE.Object3D, color: number) {
  let glass = false;
  drawn.traverse((o) => {
    if ((o as THREE.Mesh).material && ((o as THREE.Mesh).material as THREE.Material).name === 'glass') glass = true;
  });
  const glows = (m: THREE.Material) => 'emissive' in m && (!glass || m.name === 'glass');
  for (const m of ownedMaterials(drawn, glows) as THREE.MeshLambertMaterial[])
    if (m.emissive.getHex() !== color) m.emissive.setHex(color);
}

/**
 * THE LIGHT, DRAWN (stage 3d): the simulation's, read and never written. The stage's daylight is the
 * world's ambient light; every lamp asks the stage's light pool for a light of its radius while it is on
 * (stage 5.5a: the pool gives its few lights to the nearest, `light-pool.ts`), and its ball glows; a
 * watcher that sees someone glows red. `show.light` draws the lamps' reach and
 * `show.vision` what each watcher looks at. (For the browser tests: how lit the player is, and how
 * many watchers see it.)
 */
export function mountLights(page: GamePage, bodies: Bodies): Piece {
  const { scene, lights } = page.stage;
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
  /** The hour this page's sky shows instead of the level's (`view.sky`); less than 0, the level's. */
  let hour = -1;
  page.registry.declareVariable({ ...LIGHTS_VARIABLES.sky, onChange: (v) => (hour = Number(v)) });

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
      // The pool's size for this world (stage 5.5a): its lamps at the start, and what is reserved (the flash).
      let lamps = 0;
      for (const e of session.world.entities.values()) if (e.lamp) lamps++;
      lights.resize(lamps);
      // For the browser tests: how many lights it draws with.
      page.container.dataset.lights = String(lights.size);
    },
    frame({ world, hero }) {
      page.stage.daylight(world.ambient);
      page.stage.sky(hour >= 0 ? hour : (world.origin?.sky ?? null));
      const glowing = (id: EntityId, color: number) => {
        const drawn = bodies.meshes.get(id);
        if (drawn) glow(drawn, color);
      };
      // (The lamps and the watchers from the page's index, stage 5.5g: not every entity of the world.)
      for (const e of page.index.with('lamp')) {
        if (e.transform) {
          glowing(e.id, e.lamp.on ? 0xb08a40 : 0x000000);
          // A light asked for: the pool gives its few to those that matter most to what the camera sees.
          if (e.lamp.on && e.lamp.intensity > 0)
            lights.ask({
              key: `lamp:${e.id}`,
              at: e.transform.position,
              radius: e.lamp.radius,
              intensity: e.lamp.intensity * DRAWN_INTENSITY,
              color: LAMP_LIGHT,
              decay: 1,
              priority: 0,
            });
        }
      }
      for (const e of page.index.with('watcher')) glowing(e.id, e.watcher.sees.length ? 0x902020 : 0x000000);
      if (reachOn.visible) {
        const on: number[] = [];
        const off: number[] = [];
        for (const e of page.index.with('lamp')) {
          if (!e.transform) continue;
          const out = e.lamp.on ? on : off;
          const c = e.transform.position;
          circle(out, c, [1, 0, 0], [0, 0, 1], e.lamp.radius);
          circle(out, c, [1, 0, 0], [0, 1, 0], e.lamp.radius);
          circle(out, c, [0, 1, 0], [0, 0, 1], e.lamp.radius);
        }
        set(reachOn, on);
        set(reachOff, off);
      }
      if (cones.visible) drawVision();
      // For the browser tests (probe.ts's way): how lit the player is, and how many watchers see it.
      const light = hero?.character ? hero.character.light.toFixed(2) : '';
      if (page.container.dataset.light !== light) page.container.dataset.light = light;
      const seen = hero ? String(page.index.with('watcher').filter((e) => e.watcher.sees.includes(hero.id)).length) : '';
      if (page.container.dataset.seen !== seen) page.container.dataset.seen = seen;
    },
    stop() {},
  };

  /** The edge of each watcher's field of view, as far as it sees, and a line to every character in it. */
  function drawVision() {
    const edge: number[] = [];
    const seen: number[] = [];
    const unseen: number[] = [];
    for (const eye of page.index.with('watcher')) {
      const w = eye.watcher;
      if (!eye.transform) continue;
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
      for (const e of page.index.with('character')) {
        if (!e.transform) continue;
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
