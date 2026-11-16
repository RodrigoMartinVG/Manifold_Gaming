import * as THREE from 'three';
import type { V3 } from './geometry';

/** A name at a point of the scene, centred on it: an HTML element moved, every frame, to where the point is seen. */
export interface Label {
  /** Where it is (in the world). */
  at(p: V3): Label;
  /** What it says. */
  text(s: string): Label;
  /** Its color (CSS). */
  color(css: string): Label;
  /**
   * Pushed, on the screen, `ahead` pixels along the direction `direction` as it is seen, and `side` pixels
   * to its left (to its right, if negative): past an arrow's tip or beside it, from any point of view.
   */
  along(direction: V3, ahead: number, side?: number): Label;
  /** Pushed `px` pixels up on the screen: over a point, not on it. */
  lift(px: number): Label;
  show(visible: boolean): Label;
}

/** The labels of a figure, placed on every frame (none behind the camera). */
export function createLabels(camera: THREE.Camera, canvas: HTMLCanvasElement) {
  const all: {
    element: HTMLDivElement;
    at: THREE.Vector3;
    visible: boolean;
    direction: THREE.Vector3;
    ahead: number;
    side: number;
    lift: number;
  }[] = [];
  const seen = new THREE.Vector3();
  const ahead = new THREE.Vector3();
  function label(text = ''): Label {
    const element = document.createElement('div');
    element.style.cssText =
      'position:fixed;transform:translate(-50%,-50%);font:600 16px/1.2 "Times New Roman",Times,serif;' +
      'color:#e8e2d6;text-align:center;white-space:pre;pointer-events:none;text-shadow:0 0 3px #000,0 0 3px #000';
    element.textContent = text;
    document.body.append(element);
    const one = {
      element,
      at: new THREE.Vector3(),
      visible: true,
      direction: new THREE.Vector3(),
      ahead: 0,
      side: 0,
      lift: 0,
    };
    all.push(one);
    const handle: Label = {
      at(p) {
        one.at.set(p.x, p.y, p.z);
        return handle;
      },
      text(s) {
        if (element.textContent !== s) element.textContent = s;
        return handle;
      },
      color(css) {
        element.style.color = css;
        return handle;
      },
      along(direction, ahead, side = 0) {
        one.direction.set(direction.x, direction.y, direction.z);
        one.ahead = ahead;
        one.side = side;
        return handle;
      },
      lift(px) {
        one.lift = px;
        return handle;
      },
      show(visible) {
        one.visible = visible;
        return handle;
      },
    };
    return handle;
  }
  function place() {
    const box = canvas.getBoundingClientRect();
    for (const one of all) {
      const { element, at, visible } = one;
      seen.copy(at).project(camera);
      element.style.display = !visible || seen.z > 1 ? 'none' : '';
      let x = box.left + ((seen.x + 1) / 2) * box.width;
      let y = box.top + ((1 - seen.y) / 2) * box.height - one.lift;
      if (one.ahead !== 0 || one.side !== 0) {
        // The direction as seen, (dx, dy) on the screen, where y grows downwards; its left is (dy, −dx).
        ahead.copy(at).add(one.direction).project(camera);
        const dx = ((ahead.x - seen.x) / 2) * box.width;
        const dy = (-(ahead.y - seen.y) / 2) * box.height;
        const l = Math.hypot(dx, dy);
        if (l > 1e-6) {
          x += (one.ahead * dx + one.side * dy) / l;
          y += (one.ahead * dy - one.side * dx) / l;
        }
      }
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    }
  }
  return { label, place };
}
