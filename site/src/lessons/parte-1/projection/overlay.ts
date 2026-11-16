import * as THREE from 'three';
import type { Flat } from './projection';

/**
 * NAMES ON THE FIGURE: a word that stays over a point of the scene. Not part of the lesson: an
 * HTML element, moved every frame to where that point is seen.
 */
export function createLabels(camera: THREE.Camera) {
  const all: { element: HTMLDivElement; at: THREE.Vector3 }[] = [];
  const onScreen = new THREE.Vector3();

  /** A label that says `text`: move its point `at`, and it goes along (hide it with `element`). */
  function label(text: string) {
    const element = document.createElement('div');
    element.textContent = text;
    element.style.cssText =
      'position:fixed;transform:translate(-50%,-130%);font:11px/1.2 system-ui,sans-serif;' +
      'color:#e8e2d6;white-space:pre;pointer-events:none;text-shadow:0 0 3px #000';
    document.body.append(element);
    const one = { element, at: new THREE.Vector3() };
    all.push(one);
    return one;
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

/**
 * THE PICTURE THE EYE TAKES, small, in the bottom left corner. three.js draws the world from its
 * own camera (`photo`, at the eye: its own numbers), and over it we draw marks where OUR numbers
 * say things fall. The camera sees only layer 0: the figure's lines and plane are on layer 1.
 */
export function createPicture(scene: THREE.Scene, photo: THREE.PerspectiveCamera) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const marks = document.createElement('canvas');
  for (const canvas of [renderer.domElement, marks]) {
    canvas.style.cssText = 'position:fixed;left:10px;bottom:10px;pointer-events:none';
    document.body.append(canvas);
  }
  renderer.domElement.style.outline = '1px solid #9fc2e8';
  const pen = marks.getContext('2d');
  let scale = 1; // pixels of the corner per pixel of the picture
  let size = '';

  /** Draws a picture of `width` × `height` pixels; `ring` and `line` then mark it, in its pixels. */
  function take(width: number, height: number) {
    // As big as fits in the corner: at most 30% of the window wide, and 40% high.
    scale = Math.min((0.3 * innerWidth) / width, (0.4 * innerHeight) / height);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const ratio = Math.min(devicePixelRatio, 2);
    if (size !== `${w}×${h}`) {
      size = `${w}×${h}`;
      renderer.setPixelRatio(ratio);
      renderer.setSize(w, h);
      marks.width = w * ratio;
      marks.height = h * ratio;
      marks.style.width = `${w}px`;
      marks.style.height = `${h}px`;
    }
    renderer.render(scene, photo);
    if (!pen) return;
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.clearRect(0, 0, w, h);
    // Where the pixels count from: (0, 0) at the top left, and the size at the bottom right.
    pen.font = '10px system-ui, sans-serif';
    pen.fillStyle = '#e8e2d6';
    pen.textAlign = 'left';
    pen.textBaseline = 'top';
    pen.fillText('(0, 0)', 3, 3);
    pen.textAlign = 'right';
    pen.textBaseline = 'bottom';
    pen.fillText(`${width} × ${height}`, w - 3, h - 3);
  }

  /** A ring around a pixel of the picture. */
  function ring(at: Flat, color: string, radius = 6) {
    if (!pen) return;
    pen.strokeStyle = color;
    pen.lineWidth = 1.5;
    pen.setLineDash([]);
    pen.beginPath();
    pen.arc(at.x * scale, at.y * scale, radius, 0, 2 * Math.PI);
    pen.stroke();
  }

  /** A line between two pixels of the picture. */
  function line(from: Flat, to: Flat, color: string, dashed = false) {
    if (!pen) return;
    pen.strokeStyle = color;
    pen.lineWidth = 1;
    pen.setLineDash(dashed ? [4, 3] : []);
    pen.beginPath();
    pen.moveTo(from.x * scale, from.y * scale);
    pen.lineTo(to.x * scale, to.y * scale);
    pen.stroke();
  }

  return { take, ring, line };
}
