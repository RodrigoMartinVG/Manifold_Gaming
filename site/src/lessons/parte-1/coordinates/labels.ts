import * as THREE from 'three';

/** A label: where it is (move `at`), and what it says. */
export interface Label {
  at: THREE.Vector3;
  say: (text: string) => void;
}

/**
 * NAMES ON THE DRAWING: a line or two of text that stays over a point of the scene. Not part of the
 * lesson: an HTML element, moved every frame to where that point falls on the screen.
 */
export function createLabels(camera: THREE.Camera) {
  const all: { element: HTMLDivElement; at: THREE.Vector3 }[] = [];
  const onScreen = new THREE.Vector3();

  /** A new label; change `at` to move it, and its text with `say`. */
  function label(): Label {
    const element = document.createElement('div');
    element.style.cssText =
      'position:fixed;transform:translate(-50%,-100%);font:11px/1.25 system-ui,sans-serif;' +
      'color:#e8e2d6;text-align:center;white-space:pre;pointer-events:none;' +
      'text-shadow:0 0 3px #000';
    document.body.append(element);
    const one = { element, at: new THREE.Vector3() };
    all.push(one);
    const say = (text: string) => {
      if (element.textContent !== text) element.textContent = text;
    };
    return { at: one.at, say };
  }

  /** Puts every label where its point is seen now (none behind the camera). */
  function place() {
    for (const { element, at } of all) {
      onScreen.copy(at).project(camera);
      element.style.display = onScreen.z > 1 ? 'none' : '';
      element.style.left = `${((onScreen.x + 1) / 2) * innerWidth}px`;
      element.style.top = `${((1 - onScreen.y) / 2) * innerHeight}px`;
    }
  }

  return { label, place };
}
