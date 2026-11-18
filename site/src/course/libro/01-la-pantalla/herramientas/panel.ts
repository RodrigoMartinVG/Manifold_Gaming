import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { createView, MODES, type Mode } from './view';

/** A point of the picture, in its coordinates: a star at a pixel's centre is at (x + ½, y + ½). */
interface Spot {
  x: number;
  y: number;
}

/** What is compared: the two pictures, as functions that paint them, and how. */
export interface Comparison {
  /** The panel's title. */
  title: string;
  width: number;
  height: number;
  /** Points per side on smooth edges that the panel's slider starts at. */
  samples: number;
  /** Paints ours, with that many points per side, and the lines the reader joined; gives its pixels back. */
  ours: (samples: number, lines: [Spot, Spot][]) => Uint8ClampedArray;
  /** Paints the canvas's, with the same lines; gives its pixels back. */
  theirs: (lines: [Spot, Spot][]) => Uint8ClampedArray;
  /** Stars the reader can join, pressing one and then another (from chapter 2); without them, no lines. */
  stars?: Spot[];
}

/**
 * A TOOL OF THE BOOK (docs/tutorial-v3.md §4): it makes the example work, and it is not the lesson; the chapter's
 * code is what paints the two pictures. It is read-only in the editor.
 *
 * THE COMPARISON'S PANEL: the two pictures in the view (view.ts), and a panel that chooses how to look, how many
 * points per side smooth the edges, and counts where the two differ: in how many pixels, in how many by more than
 * one level, and by how much at most. A press on the picture reads that pixel's numbers in both; on a star, if there
 * are stars, it chooses it, and the next star chosen is joined to it by a line, in both.
 */
export function comparePanel(c: Comparison) {
  const lines: [Spot, Spot][] = [];
  let chosen: Spot | null = null;

  const settings = {
    view: 'split' as Mode,
    'samples per side': c.samples,
    'forget my lines': () => {
      lines.length = 0;
      chosen = null;
      paint();
    },
  };
  const counts = { 'pixels that differ': 0, 'by more than one level': 0, 'largest difference': 0, 'lines joined': 0 };
  const read = { pixel: '—', ours: '—', 'the canvas’s': '—' };
  const gui = new GUI({ title: c.title });
  const view = createView(c.width, c.height, gui.domElement);
  gui.add(settings, 'view', MODES).onChange((m: Mode) => view.setMode(m));
  gui.add(settings, 'samples per side', 1, 8, 1).onChange(paint);
  if (c.stars) gui.add(settings, 'forget my lines');
  gui.add(counts, 'pixels that differ').disable().listen();
  gui.add(counts, 'by more than one level').disable().listen();
  gui.add(counts, 'largest difference').disable().listen();
  if (c.stars) gui.add(counts, 'lines joined').disable().listen();
  gui.add(read, 'pixel').disable().listen();
  gui.add(read, 'ours').disable().listen();
  gui.add(read, 'the canvas’s').disable().listen();

  let a: Uint8ClampedArray = new Uint8ClampedArray(0);
  let b: Uint8ClampedArray = new Uint8ClampedArray(0);
  function paint() {
    a = c.ours(settings['samples per side'], lines);
    b = c.theirs(lines);
    let pixels = 0;
    let more = 0;
    let largest = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!));
      if (d > 0) pixels++;
      if (d > 1) more++;
      largest = Math.max(largest, d);
    }
    counts['pixels that differ'] = pixels;
    counts['by more than one level'] = more;
    counts['largest difference'] = largest;
    counts['lines joined'] = lines.length;
    view.show(a, b);
  }
  paint();

  view.onPress((x, y) => {
    const i = 4 * (y * c.width + x);
    read.pixel = `${x}, ${y}`;
    read.ours = `${a[i]}, ${a[i + 1]}, ${a[i + 2]}`;
    read['the canvas’s'] = `${b[i]}, ${b[i + 1]}, ${b[i + 2]}`;
    // A star within two pixels of the press is chosen; the second one chosen is joined to the first.
    const near = c.stars?.find((s) => Math.abs(s.x - (x + 0.5)) <= 2 && Math.abs(s.y - (y + 0.5)) <= 2);
    if (!near) return;
    if (chosen && (chosen.x !== near.x || chosen.y !== near.y)) {
      lines.push([chosen, near]);
      chosen = null;
      paint();
    } else chosen = near;
  });
}
