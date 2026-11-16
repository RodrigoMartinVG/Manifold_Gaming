import * as THREE from 'three';
import type { V3 } from './geometry';
import type { Lab } from './lab';
import type { Label } from './labels';

const v = (p: V3) => new THREE.Vector3(p.x, p.y, p.z);
const css = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
const UP = new THREE.Vector3(0, 1, 0);

/** A colored surface that reads on the dark background, lit from any side; see-through if opacity < 1. */
function paint(color: number, opacity = 1) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    roughness: 0.6,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity === 1,
  });
}

// The pieces of every arrow, 1 m long along +y from the origin: each arrow scales them.
const SHAFT = new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0);
const HEAD = new THREE.ConeGeometry(1, 1, 18).translate(0, 0.5, 0);

/** A vector drawn at a point. */
export interface Arrow {
  /** Draws the vector `vector` from the point `from` (nothing, if the vector is zero). */
  set(from: V3, vector: V3): Arrow;
  show(visible: boolean): Arrow;
  object: THREE.Group;
  label: Label | null;
}

/**
 * A VECTOR, drawn: a shaft and a head, seen from any side, whose head stays readable however long it is.
 * Its name goes a little past its tip, or, with `labelAt`, at that fraction of its length (0.5: the
 * middle); `labelSide` pushes it that many pixels to the arrow's left on the screen (right, if negative).
 * One that lies along another is drawn `over` it: never hidden, by it or by anything.
 */
export function arrow(
  lab: Lab,
  o: {
    color: number;
    label?: string;
    /** The shaft's radius (m). */
    width?: number;
    opacity?: number;
    labelAt?: number;
    labelSide?: number;
    over?: boolean;
  },
): Arrow {
  const radius = o.width ?? 0.04;
  const material = paint(o.color, o.opacity);
  const shaft = new THREE.Mesh(SHAFT, material);
  const head = new THREE.Mesh(HEAD, material);
  if (o.over) {
    material.depthTest = false;
    shaft.renderOrder = head.renderOrder = 10;
  }
  const object = new THREE.Group();
  object.add(shaft, head);
  lab.scene.add(object);
  const label = o.label === undefined ? null : lab.label(o.label).color(css(o.color));
  let visible = true;
  let drawn = false;
  const direction = new THREE.Vector3();
  const handle: Arrow = {
    set(from, vector) {
      const length = Math.hypot(vector.x, vector.y, vector.z);
      drawn = length > 1e-6;
      object.visible = visible && drawn;
      label?.show(visible && drawn);
      if (!drawn) return handle;
      direction.copy(v(vector)).divideScalar(length);
      object.position.copy(v(from));
      object.quaternion.setFromUnitVectors(UP, direction);
      const headLength = Math.min(10 * radius, 0.4 * length);
      shaft.scale.set(radius, length - headLength, radius);
      head.position.y = length - headLength;
      head.scale.set(radius * 3, headLength, radius * 3);
      label
        ?.at(v(from).addScaledVector(direction, length * (o.labelAt ?? 1)))
        .along(direction, o.labelAt === undefined ? 14 : 0, o.labelSide ?? 0);
      return handle;
    },
    show(on) {
      visible = on;
      object.visible = on && drawn;
      label?.show(on && drawn);
      return handle;
    },
    object,
    label,
  };
  return handle;
}

/** A POINT, drawn: a small ball, with an optional name over it. It is also something to drag. */
export function point(lab: Lab, o: { color: number; label?: string; radius?: number; opacity?: number }) {
  const radius = o.radius ?? 0.09;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 14), paint(o.color, o.opacity));
  lab.scene.add(mesh);
  const label = o.label === undefined ? null : lab.label(o.label).color(css(o.color)).lift(18);
  const handle = {
    mesh,
    label,
    set(p: V3) {
      mesh.position.set(p.x, p.y, p.z);
      label?.at(p);
      return handle;
    },
    show(on: boolean) {
      mesh.visible = on;
      label?.show(on);
      return handle;
    },
  };
  return handle;
}

/** A SEGMENT, solid or dashed, between two points (a line of one pixel: for guides, not for vectors). */
export function line(lab: Lab, o: { color: number; dashed?: boolean; opacity?: number }) {
  const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(1, 0, 0)]);
  const look = { color: o.color, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1 };
  const material = o.dashed
    ? new THREE.LineDashedMaterial({ ...look, dashSize: 0.12, gapSize: 0.08 })
    : new THREE.LineBasicMaterial(look);
  const object = new THREE.Line(geometry, material);
  lab.scene.add(object);
  const handle = {
    object,
    set(a: V3, b: V3) {
      geometry.setFromPoints([v(a), v(b)]);
      if (o.dashed) object.computeLineDistances();
      return handle;
    },
    show(on: boolean) {
      object.visible = on;
      return handle;
    },
  };
  return handle;
}

/** A PATH through several points, as a line of one pixel: an arc, a trail, a curve sampled. */
export function path(lab: Lab, o: { color: number; opacity?: number }) {
  const geometry = new THREE.BufferGeometry();
  const object = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: o.color, transparent: (o.opacity ?? 1) < 1, opacity: o.opacity ?? 1 }),
  );
  lab.scene.add(object);
  const handle = {
    object,
    set(points: readonly V3[]) {
      geometry.setFromPoints(points.map(v));
      return handle;
    },
    show(on: boolean) {
      object.visible = on;
      return handle;
    },
  };
  return handle;
}

/** A FAN: the region between a centre and a path around it, filled (an angle swept, a sector, a cone's cut). */
export function fan(lab: Lab, o: { color: number; opacity?: number }) {
  const geometry = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: o.color,
      transparent: true,
      opacity: o.opacity ?? 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  lab.scene.add(mesh);
  const handle = {
    mesh,
    set(centre: V3, points: readonly V3[]) {
      const corners: number[] = [];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        corners.push(centre.x, centre.y, centre.z, a.x, a.y, a.z, b.x, b.y, b.z);
      }
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners, 3));
      geometry.computeBoundingSphere();
      return handle;
    },
    show(on: boolean) {
      mesh.visible = on;
      return handle;
    },
  };
  return handle;
}

/** A CIRCLE of a given radius, a thin ring in the plane through `centre` perpendicular to `normal` (the floor, by default). */
export function circle(lab: Lab, o: { color: number; radius: number; width?: number; opacity?: number }) {
  const width = o.width ?? 0.03;
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(o.radius - width / 2, o.radius + width / 2, 128),
    new THREE.MeshBasicMaterial({
      color: o.color,
      side: THREE.DoubleSide,
      transparent: (o.opacity ?? 1) < 1,
      opacity: o.opacity ?? 1,
      depthWrite: false,
    }),
  );
  lab.scene.add(mesh);
  const handle = {
    mesh,
    set(centre: V3, normal: V3 = { x: 0, y: 1, z: 0 }) {
      mesh.position.copy(v(centre));
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v(normal).normalize());
      return handle;
    },
    show(on: boolean) {
      mesh.visible = on;
      return handle;
    },
  };
  return handle.set({ x: 0, y: 0, z: 0 });
}

/** A PLANE [n | d] (the points X with n · X + d = 0), drawn as a square around its point nearest the origin, with its normal. */
export function plane(lab: Lab, o: { color: number; size?: number; opacity?: number; normal?: boolean }) {
  const size = o.size ?? 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({
      color: o.color,
      transparent: true,
      opacity: o.opacity ?? 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  lab.scene.add(mesh);
  const normal = o.normal === false ? null : arrow(lab, { color: o.color, label: 'n' });
  const handle = {
    mesh,
    set(n: V3, d: number, centre?: V3) {
      const length = Math.hypot(n.x, n.y, n.z);
      const unit = v(n).divideScalar(length);
      // Its point nearest the origin is −(d / |n|) n̂, unless a point of the plane is given to centre it.
      const at = centre ? v(centre) : unit.clone().multiplyScalar(-d / length);
      mesh.position.copy(at);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), unit);
      normal?.set(at, unit.clone().multiplyScalar(0.8));
      return handle;
    },
  };
  return handle;
}

/** A FRAME: three arrows from an origin (red, green, blue: x, y, z, or any three directions), with names. */
export function frame(lab: Lab, o: { size?: number; names?: [string, string, string]; width?: number } = {}) {
  const names = o.names ?? ['x', 'y', 'z'];
  const axes = [0xe0605a, 0x6cc070, 0x5a9ae6].map((color, i) => arrow(lab, { color, label: names[i], width: o.width ?? 0.03 }));
  const handle = {
    axes,
    set(origin: V3, x: V3 = { x: 1, y: 0, z: 0 }, y: V3 = { x: 0, y: 1, z: 0 }, z: V3 = { x: 0, y: 0, z: 1 }) {
      const s = o.size ?? 1;
      [x, y, z].forEach((d, i) => axes[i]?.set(origin, { x: d.x * s, y: d.y * s, z: d.z * s }));
      return handle;
    },
  };
  return handle.set({ x: 0, y: 0, z: 0 });
}

/**
 * THE WORLD'S AXES: lines through the origin O along x and z (and y, if asked), named at their positive
 * ends, as the tutorial's conventions say: +X right, +Y up, +Z towards whoever looks from the front.
 */
export function axes(lab: Lab, o: { length?: number; y?: boolean } = {}) {
  const length = o.length ?? 5;
  const color = 0x8b93a3;
  const ends: [V3, V3, string][] = [
    [{ x: -length, y: 0, z: 0 }, { x: length, y: 0, z: 0 }, '+X'],
    [{ x: 0, y: 0, z: -length }, { x: 0, y: 0, z: length }, '+Z'],
  ];
  if (o.y) ends.push([{ x: 0, y: 0, z: 0 }, { x: 0, y: length, z: 0 }, '+Y']);
  for (const [a, b, name] of ends) {
    line(lab, { color }).set({ ...a, y: a.y + 0.004 }, { ...b, y: b.y + 0.004 });
    lab.label(name).color(css(color)).at(b);
  }
  lab.label('O').color(css(color)).at({ x: -0.25, y: 0, z: 0.25 });
}
