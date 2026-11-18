import GUI from 'three/addons/libs/lil-gui.module.min.js';

/** A point of the figure, in the window's pixels (CSS pixels): x from the left, y from the top. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle of the window, in CSS pixels. */
export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Something the reader can drag: where it is now, and what to do when the pointer moves it. */
export interface Handle {
  /** Where it is, in the window's pixels; `null` while it cannot be grabbed. */
  at(): Point | null;
  /** The pointer moved it to `p`. */
  move(p: Point): void;
  /** How near the pointer must be to grab it, in pixels (16 if not said). */
  reach?: number;
}

/** The figure's colours, the lab's (src/lab/draw.ts) on a 2D canvas. */
export const INK = '#e8dfd0';
export const MUTED = '#8a7f70';
export const BACKGROUND = '#1b1713';
export const ACCENT = '#e5c07b';
export const BLUE = '#61afef';
export const RED = '#e06c75';
export const GREEN = '#98c379';

/** A flat figure: a 2D canvas the size of the window, its panel, and the reader's pointer. */
export interface Plane {
  canvas: HTMLCanvasElement;
  /** Draws in the window's pixels (the canvas is sharp on any screen: its scale is set). */
  pen: CanvasRenderingContext2D;
  /** The panel: settings the reader changes, and the numbers the figure shows. */
  gui: GUI;
  /** Where the figure may draw: the window, less the panel on the right when it is open and room is left. */
  area(): Area;
  /** What draws the figure; called again whenever something changes (a setting, a drag, the window). */
  onDraw(draw: (pen: CanvasRenderingContext2D) => void): void;
  /** Asks for the figure to be drawn again (once, on the next frame, however many times it is asked). */
  redraw(): void;
  /** Calls `update` on every frame with the seconds since the previous one (at most 0.25), then draws. */
  onFrame(update: (dt: number) => void): void;
  /** Something the reader can drag. */
  handle(h: Handle): void;
  /** A press that grabbed no handle, at `p`. */
  onPress(press: (p: Point) => void): void;
  /** Where the pointer is while nothing is dragged (`null` when it leaves). */
  onHover(hover: (p: Point | null) => void): void;
}

/**
 * A FIGURE IN THE PLANE, for the book's first part (docs/tutorial-v3.md §7, Parte I): what the 2D figures
 * share, as `createLab` is for the 3D ones. A canvas the size of the window, the panel docked on the right,
 * handles to drag, and a draw that runs only when something changed (or on every frame, with `onFrame`).
 */
export function createPlane(o: { title: string }): Plane {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;touch-action:none;display:block';
  document.body.style.margin = '0';
  document.body.style.background = BACKGROUND;
  document.body.append(canvas);
  const pen = canvas.getContext('2d')!;
  const gui = new GUI({ title: o.title });

  const draws: ((pen: CanvasRenderingContext2D) => void)[] = [];
  const handles: Handle[] = [];
  const presses: ((p: Point) => void)[] = [];
  const hovers: ((p: Point | null) => void)[] = [];

  function area(): Area {
    // Up to the panel's left edge, while that leaves room for a figure; under it, on a narrow window.
    const open = !gui.domElement.classList.contains('closed');
    const edge = open ? gui.domElement.getBoundingClientRect().left : innerWidth;
    const width = edge >= 320 ? edge : innerWidth;
    const pad = 12;
    return { x: pad, y: pad, width: width - 2 * pad, height: innerHeight - 2 * pad };
  }

  function draw() {
    const scale = Math.min(devicePixelRatio, 2);
    const [w, h] = [Math.round(innerWidth * scale), Math.round(innerHeight * scale)];
    if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
    pen.setTransform(scale, 0, 0, scale, 0, 0);
    pen.fillStyle = BACKGROUND;
    pen.fillRect(0, 0, innerWidth, innerHeight);
    for (const d of draws) {
      pen.save();
      d(pen);
      pen.restore();
    }
  }

  let asked = false;
  let animated = false;
  function redraw() {
    if (asked || animated) return;
    asked = true;
    requestAnimationFrame(() => {
      asked = false;
      draw();
    });
  }

  function onFrame(update: (dt: number) => void) {
    animated = true;
    let before = performance.now();
    const frame = (now: number) => {
      update(Math.min(0.25, (now - before) / 1000));
      before = now;
      draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // The pointer: a press grabs the nearest handle in reach, or else is a press on the figure.
  let held: Handle | null = null;
  const where = (e: PointerEvent): Point => ({ x: e.clientX, y: e.clientY });
  canvas.addEventListener('pointerdown', (e) => {
    const p = where(e);
    let best = Infinity;
    held = null;
    for (const h of handles) {
      const at = h.at();
      if (!at) continue;
      const d = Math.hypot(at.x - p.x, at.y - p.y);
      if (d <= (h.reach ?? 16) && d < best) [best, held] = [d, h];
    }
    if (held) canvas.setPointerCapture(e.pointerId);
    else for (const f of presses) f(p);
    redraw();
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = where(e);
    if (held) held.move(p);
    else for (const f of hovers) f(p);
    redraw();
  });
  const release = () => {
    held = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    if (!held) for (const f of hovers) f(null);
    redraw();
  });

  addEventListener('resize', redraw);
  // (The panel closes and opens by its title; lil-gui 0.17 does not announce it, but it changes its class.)
  new MutationObserver(redraw).observe(gui.domElement, { attributes: true, attributeFilter: ['class'] });
  gui.onChange(redraw);

  const plane: Plane = {
    canvas,
    pen,
    gui,
    area,
    onDraw: (d) => {
      draws.push(d);
      redraw();
    },
    redraw,
    onFrame,
    handle: (h) => handles.push(h),
    onPress: (f) => presses.push(f),
    onHover: (f) => hovers.push(f),
  };
  // In the browser's console, in the figure's frame, `plane` is the figure (and the browser tests read it).
  Object.assign(globalThis, { plane });
  return plane;
}

/** Text on the figure: small, in the lab's ink, from (x, y). */
export function write(
  pen: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: { color?: string; size?: number; align?: CanvasTextAlign; baseline?: CanvasTextBaseline; bold?: boolean } = {},
) {
  pen.save();
  pen.font = `${o.bold ? '600 ' : ''}${o.size ?? 12}px system-ui, sans-serif`;
  pen.fillStyle = o.color ?? INK;
  pen.textAlign = o.align ?? 'left';
  pen.textBaseline = o.baseline ?? 'alphabetic';
  pen.fillText(text, x, y);
  pen.restore();
}

/**
 * A VALUE DERIVED FROM THE FIGURE'S STATE (its pictures, its counts), computed again only when the state
 * changed. The panel's numbers and the drawing read the same value, and the numbers never wait for a frame
 * to be drawn: they are a function of the state, not a side effect of drawing it.
 */
export function derived<T>(state: () => unknown, compute: () => T): () => T {
  let key: string | null = null;
  let value: T;
  return () => {
    const now = JSON.stringify(state());
    if (now !== key) [key, value] = [now, compute()];
    return value;
  };
}
