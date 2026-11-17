import * as THREE from 'three';
import { buildNav, findPath, type EdgeKind, type Nav, type Path } from '@manifold/bots';
import type { CommandInfo, VariableInfo } from '@manifold/commands';
import type { Vec3 } from '@manifold/common';
import type { World } from '@manifold/core';
import type { GamePage, Piece } from './page';

/** What the navigation's view lets people change, as data (the site's console reference reads it). */
export const NAV_VARIABLES = {
  nav: {
    name: 'show.nav',
    description:
      "Where a body can go (stage 4d, decision 0024): the navigation's cells, a dot every half meter where the games' character fits (amber, on a lift: there only while it is); the edges that are not walking: jumps and drops (blue), climbs (violet), across a gap (cyan), a lift's ride (amber), through a door (red); and the level's routes (white).",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
} as const satisfies Record<string, VariableInfo>;

export const NAV_COMMANDS = {
  path: {
    name: 'nav.path',
    description:
      'The way from your character to a point (`nav.path 0 5 -16`) or to an entity (`nav.path last_plate`), as a guard would plan it with what your character can do (stage 4d): drawn, and said step by step: what it walks, jumps, climbs or rides, and, when a door or a lift is not as it needs, the button it presses or the plate it stands on first. With nothing, it is taken away.',
    args: [{ name: 'to', type: { kind: 'rest' }, optional: true }],
  },
} as const satisfies Record<string, CommandInfo>;

const EDGE_COLORS: Partial<Record<EdgeKind, number>> = {
  drop: 0x5a8ae0,
  jump: 0x5a8ae0,
  climb: 0xb07ae0,
  across: 0x5ad0e0,
  ride: 0xe0b05a,
};
const DOOR = 0xe05a5a;
const CELL_COLOR = 0x7ab08a;
const LIFT_COLOR = 0xe0b05a;
const PATH_COLOR = 0xfff07a;

/** What the navigation is sampled from: the bodies that are not moved by the physics nor characters, by number. */
const signatureOf = (world: World) =>
  [...world.entities.values()]
    .filter((e) => e.body && !e.character && e.body.type !== 'dynamic')
    .map((e) => e.id)
    .join(' ');

/**
 * THE NAVIGATION, SHOWN (stage 4d): `show.nav` draws a level's navigation (bots: navigation.ts) and its
 * routes; `nav.path` plans a way from the player's character and draws it. The navigation is built when
 * it is first asked for, and again when what it is sampled from changes (a new level, the console's
 * `add` or `delete`). Only the view: the world is not touched.
 */
export function mountNav(page: GamePage): Piece {
  const { scene } = page.stage;
  let nav: Nav | null = null;
  let builtFor: { world: World; signature: string } | null = null;
  let path: Path | null = null;
  let frames = 0;

  const overlay = <T extends THREE.Object3D>(o: T) => {
    o.visible = false;
    o.renderOrder = 2;
    o.frustumCulled = false;
    scene.add(o);
    return o;
  };
  const cells = overlay(
    new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ vertexColors: true, size: 4, sizeAttenuation: false, depthTest: false }),
    ),
  );
  const edges = overlay(
    new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })),
  );
  const routes = overlay(
    new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false })),
  );
  const pathLine = overlay(
    new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: PATH_COLOR, depthTest: false })),
  );
  const pathPoints = overlay(
    new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ vertexColors: true, size: 10, sizeAttenuation: false, depthTest: false }),
    ),
  );
  const set = (o: THREE.Points | THREE.LineSegments | THREE.Line, xyz: number[], rgb?: number[]) => {
    o.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
    if (rgb) o.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(rgb), 3));
  };
  const color = new THREE.Color();
  const push = (rgb: number[], hex: number, times = 1) => {
    color.setHex(hex);
    for (let k = 0; k < times; k++) rgb.push(color.r, color.g, color.b);
  };
  const LIFT = 0.04;

  /** The navigation of the world being drawn: made again if what it is sampled from changed. */
  const current = (): Nav => {
    const world = page.session.world;
    const signature = signatureOf(world);
    if (!nav || builtFor?.world !== world || builtFor.signature !== signature) {
      nav = buildNav(world);
      builtFor = { world, signature };
      if (cells.visible) draw();
    }
    return nav;
  };

  const draw = () => {
    const n = nav!;
    const xyz: number[] = [];
    const rgb: number[] = [];
    for (const c of n.cells) {
      xyz.push(c.at[0], c.at[1] + LIFT, c.at[2]);
      push(rgb, c.when ? LIFT_COLOR : CELL_COLOR);
    }
    set(cells, xyz, rgb);
    const lines: number[] = [];
    const lineColors: number[] = [];
    for (const out of n.out)
      for (const e of out) {
        const hex = e.door ? DOOR : EDGE_COLORS[e.kind];
        if (hex === undefined) continue;
        const a = n.cells[e.from]!.at;
        const b = n.cells[e.to]!.at;
        lines.push(a[0], a[1] + LIFT, a[2], b[0], b[1] + LIFT, b[2]);
        push(lineColors, hex, 2);
      }
    set(edges, lines, lineColors);
    const routeLines: number[] = [];
    for (const e of page.session.world.entities.values()) {
      const r = e.route;
      if (!r) continue;
      const points = r.loop ? [...r.points, r.points[0]!] : r.points;
      for (let k = 1; k < points.length; k++) routeLines.push(...points[k - 1]!, ...points[k]!);
    }
    set(routes, routeLines);
    page.container.dataset.nav = String(n.cells.length);
  };

  const drawPath = () => {
    if (!path) {
      pathLine.visible = pathPoints.visible = false;
      delete page.container.dataset.path;
      return;
    }
    const xyz = path.steps.flatMap((s) => [s.at[0], s.at[1] + 0.1, s.at[2]]);
    set(pathLine, xyz);
    const marks: number[] = [];
    const rgb: number[] = [];
    for (const s of path.steps) {
      marks.push(s.at[0], s.at[1] + 0.1, s.at[2]);
      push(rgb, s.kind === 'use' ? DOOR : s.kind === 'stand' ? LIFT_COLOR : PATH_COLOR);
    }
    set(pathPoints, marks, rgb);
    pathLine.visible = pathPoints.visible = true;
    page.container.dataset.path = path.steps.map((s) => s.kind).join(' ');
  };

  page.registry.declareVariable({
    ...NAV_VARIABLES.nav,
    onChange(v) {
      const on = v === true;
      cells.visible = edges.visible = routes.visible = on;
      if (!on) return;
      const n = current();
      draw();
      if (n.reason) page.say(`show.nav: no navigation here: ${n.reason}`, 'warn');
    },
  });

  /** Where `nav.path` goes: three numbers, or an entity by its id or name (where it is). */
  const target = (words: string[]): Vec3 | string => {
    if (words.length === 3 && words.every((w) => Number.isFinite(Number(w)))) return words.map(Number) as Vec3;
    if (words.length !== 1) return 'nav.path: a point (x y z) or an entity (its id or its name)';
    const world = page.session.world;
    const e = /^\d+$/.test(words[0]!) ? world.entities.get(Number(words[0])) : world.named(words[0]!);
    if (!e?.transform) return `nav.path: no entity "${words[0]}" with a place`;
    return e.transform.position;
  };
  /** A path in words: each step, the same ones in a row counted (`walk ×3`). */
  const say = (p: Path) => {
    const words = p.steps
      .slice(1)
      .map((s) =>
        s.kind === 'use'
          ? `press use in ${s.zone}`
          : s.kind === 'stand'
            ? `stand in ${s.zone}`
            : s.door
              ? `${s.kind} through ${s.door}`
              : s.kind,
      );
    const runs: { word: string; count: number }[] = [];
    for (const word of words) {
      const last = runs.at(-1);
      if (last?.word === word) last.count++;
      else runs.push({ word, count: 1 });
    }
    return runs.map((r) => (r.count > 1 ? `${r.word} ×${r.count}` : r.word)).join(', ');
  };

  page.registry.declareCommand({
    ...NAV_COMMANDS.path,
    run: ([to], out) => {
      const words = String(to ?? '')
        .split(/\s+/)
        .filter(Boolean);
      if (words.length === 0) {
        path = null;
        drawPath();
        return out.write('nav.path: taken away');
      }
      const me = page.player();
      if (!me?.transform || !me.character) return out.write('nav.path: you have no character to go from', 'warn');
      const goal = target(words);
      if (typeof goal === 'string') return out.write(goal, 'warn');
      const n = current();
      if (n.reason) return out.write(`nav.path: no navigation here: ${n.reason}`, 'warn');
      path = findPath(page.session.world, n, me.transform.position, goal, { can: me.character.can, depth: 2 });
      drawPath();
      if (!path) return out.write('nav.path: no way there, even pressing what it could press', 'warn');
      out.write(`nav.path: ${say(path)} (${path.cost.toFixed(1)} s)`);
    },
  });

  return {
    welcome() {
      // Another world: its navigation, made when it is asked for; a path planned in the last one, gone.
      path = null;
      drawPath();
      if (cells.visible) {
        current();
        draw();
      }
    },
    frame() {
      // What it is sampled from may change (the console adds and takes away): looked at twice a second.
      if (cells.visible && ++frames % 30 === 0) current();
    },
  };
}
