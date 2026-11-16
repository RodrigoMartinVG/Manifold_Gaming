import * as THREE from 'three';
import { rayPlane, type V3 } from './geometry';
import type { Lab } from './lab';

/** How close to a thing, on the screen, the pointer has to be to take it (px): small points stay easy to take. */
const REACH = 18;

/** The draggable things under the pointer, per canvas: the cursor is a hand while there is one. */
const hovered = new WeakMap<HTMLCanvasElement, Set<THREE.Object3D>>();
/** The canvases where something is being dragged: one press takes one thing, the first that answers. */
const taken = new WeakSet<HTMLCanvasElement>();

/**
 * DRAGGING a thing of the figure across a plane [n | d]: press on it (or near it), move, let go. While
 * dragging, the camera does not turn. `move` gets the point of the plane under the pointer; the lesson
 * decides what to do with it (round it, keep it on a circle...).
 */
export function draggable(
  lab: Lab,
  target: THREE.Object3D,
  o: {
    plane: () => { normal: V3; d: number };
    move: (p: THREE.Vector3) => void;
    start?: () => void;
    end?: () => void;
  },
) {
  const canvas = lab.renderer.domElement;
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const seen = new THREE.Vector3();
  let dragging = false;
  const aim = (e: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - box.left) / box.width) * 2 - 1, -((e.clientY - box.top) / box.height) * 2 + 1);
    ray.setFromCamera(pointer, lab.camera);
    return box;
  };
  /** Under the pointer: the ray touches it, or its centre is seen within REACH pixels. */
  const under = (e: PointerEvent) => {
    if (!target.visible) return false;
    const box = aim(e);
    if (ray.intersectObject(target, true).length > 0) return true;
    target.getWorldPosition(seen).project(lab.camera);
    if (seen.z > 1) return false;
    const x = box.left + ((seen.x + 1) / 2) * box.width;
    const y = box.top + ((1 - seen.y) / 2) * box.height;
    return Math.hypot(x - e.clientX, y - e.clientY) < REACH;
  };
  // In the capture phase, before the camera's controls hear the same press: taking a thing does not
  // also turn the camera.
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || taken.has(canvas) || !under(e)) return;
      dragging = true;
      taken.add(canvas);
      lab.controls.enabled = false;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      o.start?.();
    },
    { capture: true },
  );
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) {
      // Several things can share the canvas: each says whether it is under the pointer, and the cursor
      // follows all of them.
      const set = hovered.get(canvas) ?? new Set();
      hovered.set(canvas, set);
      if (under(e)) set.add(target);
      else set.delete(target);
      if (canvas.style.cursor !== 'grabbing') canvas.style.cursor = set.size > 0 ? 'grab' : '';
      return;
    }
    // A move with no button pressed: the release happened where we did not hear it (outside the
    // window, say). The buttons are the truth, not the events.
    if ((e.buttons & 1) === 0) return stop();
    aim(e);
    const { normal, d } = o.plane();
    const t = rayPlane(ray.ray.origin, ray.ray.direction, normal, d);
    if (t !== null) o.move(ray.ray.origin.clone().addScaledVector(ray.ray.direction, t));
  });
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    taken.delete(canvas);
    lab.controls.enabled = true;
    canvas.style.cursor = '';
    o.end?.();
  };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);
  canvas.addEventListener('lostpointercapture', stop);
}
