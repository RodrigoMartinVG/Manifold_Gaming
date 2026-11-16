import * as THREE from 'three';

/** A box, aligned with the world's axes: its lowest corner and its highest. */
export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/**
 * Where a segment from `a` to `b` is inside a box: the part of it, as fractions of the way (0 at `a`,
 * 1 at `b`), or null if it misses. The "slabs" method: along each axis, where it enters and leaves the
 * box's two planes; it is inside where the three overlap.
 */
export function through(a: THREE.Vector3, b: THREE.Vector3, box: Box): [number, number] | null {
  let enter = 0;
  let leave = 1;
  for (const k of ['x', 'y', 'z'] as const) {
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) {
      if (a[k] < box.min[k] || a[k] > box.max[k]) return null;
      continue;
    }
    const t0 = (box.min[k] - a[k]) / d;
    const t1 = (box.max[k] - a[k]) / d;
    enter = Math.max(enter, Math.min(t0, t1));
    leave = Math.min(leave, Math.max(t0, t1));
    if (enter > leave) return null;
  }
  return [enter, leave];
}

/** Whether something solid is between two points. */
export const blocked = (a: THREE.Vector3, b: THREE.Vector3, solids: readonly Box[]) =>
  solids.some((s) => through(a, b, s) !== null);

/**
 * What gets through a segment: 1 / (1 + Σ opacity × the length inside each fog). A rational falloff,
 * without `exp`: the same bits everywhere, and the same for light and for sight.
 */
export function transmission(
  a: THREE.Vector3,
  b: THREE.Vector3,
  fogs: readonly { box: Box; opacity: number }[],
) {
  const length = a.distanceTo(b);
  let sum = 0;
  for (const f of fogs) {
    const part = through(a, b, f.box);
    if (part) sum += f.opacity * (part[1] - part[0]) * length;
  }
  return 1 / (1 + sum);
}

export interface Lamp {
  at: THREE.Vector3;
  radius: number;
  intensity: number;
  on: boolean;
}

/**
 * HOW LIT A POINT IS: the ambient, plus every lamp that is on, reaches it and sees it (nothing solid in
 * between), falling linearly to its radius, through what the fogs let pass. Each lamp's part too.
 */
export function lightAt(
  p: THREE.Vector3,
  ambient: number,
  lamps: readonly Lamp[],
  solids: readonly Box[],
  fogs: readonly { box: Box; opacity: number }[],
) {
  const parts = lamps.map((l) => {
    const d = l.at.distanceTo(p);
    if (!l.on || d >= l.radius || blocked(l.at, p, solids)) return 0;
    return l.intensity * (1 - d / l.radius) * transmission(l.at, p, fogs);
  });
  return { light: ambient + parts.reduce((a, b) => a + b, 0), parts };
}
