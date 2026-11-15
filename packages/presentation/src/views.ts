import * as THREE from 'three';
import { gravityAt } from '@manifold/core';
import type { VariableInfo } from '@manifold/commands';
import type { Bodies } from './bodies';
import type { GamePage, Piece } from './page';

const view = (name: string, description: string) =>
  ({ name, description, scope: 'view', type: { kind: 'boolean' }, default: false }) as const satisfies VariableInfo;

/** What the debug views let people change, as data (the site's console reference reads it). */
export const VIEWS_VARIABLES = {
  axes: view('show.axes', "The world's axes at the origin: x red, y green, z blue (3 meters)."),
  physics: view('show.physics', "What the physics sees: every body's collider, as lines (it may not match what is drawn)."),
  vectors: view(
    'show.vectors',
    "Every moving body's velocity, as a line to where it would be in a quarter of a second (yellow), and where each character looks (blue).",
  ),
  contacts: view(
    'show.contacts',
    'Where bodies touch now: each contact point the physics uses, and its normal (from the first body to the second).',
  ),
  gravity: view(
    'show.gravity',
    "The gravity field, as arrows: their length is the strength (1 m for every 6.5 m/s²; the Earth's, 1.5 m).",
  ),
};

/**
 * THE DEBUG VIEWS (decision 0010: `show.*`), each one declaring itself: the world's axes, what the
 * physics sees, the velocities and where each character looks, the contacts, and the gravity field.
 * Off, they cost nothing: they neither compute nor draw. (`show.wireframe` and `show.sensors` are the
 * bodies'; `show.stats`, the stats'.)
 */
export function mountViews(page: GamePage, bodies: Bodies): Piece {
  const { scene } = page.stage;
  const declare = (info: VariableInfo, show: (on: boolean) => void) =>
    page.registry.declareVariable({ ...info, onChange: (v) => show(v === true) });

  const axes = new THREE.AxesHelper(3);
  axes.visible = false;
  scene.add(axes);
  // What the physics sees (show.physics): Rapier's colliders, as lines, redrawn on every frame.
  const physicsLines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x7fe0c8, depthTest: false, transparent: true, opacity: 0.85 }),
  );
  physicsLines.visible = false;
  physicsLines.renderOrder = 1;
  physicsLines.frustumCulled = false;
  scene.add(physicsLines);
  /** Lines drawn on top of everything, rebuilt on every frame while they are shown (show.vectors, show.contacts). */
  const overlay = (color: number) => {
    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }),
    );
    lines.visible = false;
    lines.renderOrder = 2;
    lines.frustumCulled = false;
    scene.add(lines);
    return lines;
  };
  const setLines = (lines: THREE.LineSegments, xyz: number[]) =>
    lines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(xyz), 3));
  // show.vectors (stage 1f): every moving body's velocity (a quarter of a second ahead), and where each character looks.
  const velocityLines = overlay(0xd8e05a);
  const facingLines = overlay(0x5aa8e0);
  // show.contacts: where bodies touch, and the normal of each contact.
  const contactLines = overlay(0xe0705a);
  const contactPoints = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.PointsMaterial({ color: 0xe0705a, size: 6, sizeAttenuation: false, depthTest: false }),
  );
  contactPoints.visible = false;
  contactPoints.renderOrder = 2;
  contactPoints.frustumCulled = false;
  scene.add(contactPoints);
  // show.gravity: the field, as arrows on a grid above the floor (in phase 7 they will point to a planet).
  const gravityArrows = new THREE.Group();
  gravityArrows.visible = false;
  for (let x = -6; x <= 6; x += 3)
    for (let z = -6; z <= 6; z += 3) {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(x, 4, z), 1, 0x8a7ae0, 0.3, 0.15);
      gravityArrows.add(arrow);
    }
  scene.add(gravityArrows);

  declare(VIEWS_VARIABLES.axes, (on) => (axes.visible = on));
  declare(VIEWS_VARIABLES.physics, (on) => (physicsLines.visible = on));
  declare(VIEWS_VARIABLES.vectors, (on) => (velocityLines.visible = facingLines.visible = on));
  declare(VIEWS_VARIABLES.contacts, (on) => (contactLines.visible = contactPoints.visible = on));
  declare(VIEWS_VARIABLES.gravity, (on) => (gravityArrows.visible = on));

  return {
    frame({ world }) {
      if (physicsLines.visible) {
        const { vertices } = world.physics.debugLines();
        physicsLines.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      }
      if (velocityLines.visible) {
        const velocities: number[] = [];
        const facings: number[] = [];
        for (const e of world.entities.values()) {
          const mesh = bodies.meshes.get(e.id);
          if (!e.transform || !e.body || e.body.type === 'fixed') continue;
          // From where it is drawn (between steps), so the line does not lag behind the body.
          const at = mesh ? mesh.position.toArray() : e.transform.position;
          const v = e.character ? e.character.velocity : e.body.linearVelocity;
          velocities.push(...at, at[0]! + v[0] * 0.25, at[1]! + v[1] * 0.25, at[2]! + v[2] * 0.25);
          if (e.character) {
            const f = e.character.facing;
            facings.push(at[0]!, at[1]! + 0.5, at[2]!, at[0]! + f[0], at[1]! + 0.5 + f[1], at[2]! + f[2]);
          }
        }
        setLines(velocityLines, velocities);
        setLines(facingLines, facings);
      }
      if (contactLines.visible) {
        const { points, normals } = world.physics.contacts();
        const lines: number[] = [];
        for (let i = 0; i < points.length; i += 3)
          lines.push(
            points[i]!,
            points[i + 1]!,
            points[i + 2]!,
            points[i]! + normals[i]! * 0.3,
            points[i + 1]! + normals[i + 1]! * 0.3,
            points[i + 2]! + normals[i + 2]! * 0.3,
          );
        setLines(contactLines, lines);
        contactPoints.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(points), 3));
        page.container.dataset.contacts = String(points.length / 3);
      }
      if (gravityArrows.visible)
        for (const arrow of gravityArrows.children as THREE.ArrowHelper[]) {
          const g = new THREE.Vector3(...gravityAt(world.gravity, arrow.position.toArray()));
          const strength = g.length();
          arrow.visible = strength > 0;
          if (strength > 0) {
            arrow.setDirection(g.divideScalar(strength));
            arrow.setLength(strength / 6.5, 0.3, 0.15);
          }
        }
    },
  };
}
