import * as THREE from 'three';
import type { Lab } from './lab';

/** A point of a picture, in its pixels: x from the left, y from the top. */
export interface Pixel {
  x: number;
  y: number;
}

/**
 * A PICTURE TAKEN FROM INSIDE THE FIGURE, small, in the bottom left corner: three.js draws the scene from
 * another camera (`camera`, which sees only layer 0: not what is `figureOnly`), and over it the lesson draws
 * marks in the picture's own pixels, where its numbers say things fall. `take(width, height)` draws a picture
 * of that many pixels, as big as fits in the corner; `ring` and `line` then mark it.
 */
export function inset(lab: Lab, camera: THREE.Camera) {
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
    renderer.render(lab.scene, camera);
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
  function ring(at: Pixel, color: string, radius = 6) {
    if (!pen) return;
    pen.strokeStyle = color;
    pen.lineWidth = 1.5;
    pen.setLineDash([]);
    pen.beginPath();
    pen.arc(at.x * scale, at.y * scale, radius, 0, 2 * Math.PI);
    pen.stroke();
  }

  /** A line between two pixels of the picture. */
  function line(from: Pixel, to: Pixel, color: string, dashed = false) {
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
