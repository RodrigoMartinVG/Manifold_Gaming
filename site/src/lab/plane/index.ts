/**
 * THE LAB KIT IN THE PLANE: what the book's 2D figures share (docs/tutorial-v3.md §7, Parte I), as `lab` is
 * for the 3D ones. A figure imports it like any library: `import { createPlane, pixelGrid } from 'lab/plane'`.
 * It brings no three.js: only the browser's 2D canvas, and the panel.
 */
export {
  createPlane,
  derived,
  write,
  INK,
  MUTED,
  BACKGROUND,
  ACCENT,
  BLUE,
  RED,
  GREEN,
  type Plane,
  type Point,
  type Area,
  type Handle,
} from './plane';
export { pixelGrid, canvasPixels, difference, dot, type PixelGrid } from './grid';
export { numbers } from '../numbers';
