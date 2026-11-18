import { MUTED, write, type Area, type Point } from './plane';

/**
 * A SMALL SCREEN, MAGNIFIED: `cols` × `rows` pixels drawn as squares big enough to see one by one. Its
 * coordinates are the screen's, as the book's first part counts them: x from the left, y DOWNWARDS, and
 * pixel (i, j) is the square from (i, j) to (i + 1, j + 1), its centre at (i + ½, j + ½).
 */
export interface PixelGrid {
  readonly cols: number;
  readonly rows: number;
  /** Where it is drawn: its top left corner, and the side of one pixel, in the window's pixels. */
  readonly x: number;
  readonly y: number;
  readonly cell: number;
  /** Places it in `box`: square pixels as big as fit, centred (leaving `top` pixels over it for a caption). */
  fit(box: Area, top?: number): void;
  /** Draws the pixels (RGBA, four numbers each, row after row), and the lines between them when there is room. */
  paint(pen: CanvasRenderingContext2D, pixels: Uint8ClampedArray): void;
  /** A caption over the grid. */
  caption(pen: CanvasRenderingContext2D, text: string, color?: string): void;
  /** From the window's pixels to the grid's coordinates, and back. */
  toGrid(p: Point): Point;
  toScreen(p: Point): Point;
  /** The pixel under a point of the window, or `null` off the grid. */
  pixelAt(p: Point): { x: number; y: number } | null;
  /** A frame round pixel (i, j). */
  outline(pen: CanvasRenderingContext2D, i: number, j: number, color: string, width?: number): void;
}

export function pixelGrid(cols: number, rows: number): PixelGrid {
  const picture = document.createElement('canvas');
  [picture.width, picture.height] = [cols, rows];
  const painter = picture.getContext('2d')!;
  const g = {
    cols,
    rows,
    x: 0,
    y: 0,
    cell: 1,
    fit(box: Area, top = 18) {
      g.cell = Math.max(1, Math.min(box.width / cols, (box.height - top) / rows));
      g.x = box.x + (box.width - g.cell * cols) / 2;
      g.y = box.y + top + (box.height - top - g.cell * rows) / 2;
    },
    paint(pen: CanvasRenderingContext2D, pixels: Uint8ClampedArray) {
      painter.putImageData(new ImageData(new Uint8ClampedArray(pixels), cols, rows), 0, 0);
      pen.imageSmoothingEnabled = false; // each pixel a sharp square, not a blur
      pen.drawImage(picture, g.x, g.y, cols * g.cell, rows * g.cell);
      if (g.cell < 6) return;
      pen.strokeStyle = 'rgba(232, 223, 208, 0.14)';
      pen.lineWidth = 1;
      pen.beginPath();
      for (let i = 0; i <= cols; i++) {
        const x = Math.round(g.x + i * g.cell) + 0.5;
        pen.moveTo(x, g.y);
        pen.lineTo(x, g.y + rows * g.cell);
      }
      for (let j = 0; j <= rows; j++) {
        const y = Math.round(g.y + j * g.cell) + 0.5;
        pen.moveTo(g.x, y);
        pen.lineTo(g.x + cols * g.cell, y);
      }
      pen.stroke();
    },
    caption(pen: CanvasRenderingContext2D, text: string, color = MUTED) {
      write(pen, text, g.x, g.y - 6, { color });
    },
    toGrid: (p: Point): Point => ({ x: (p.x - g.x) / g.cell, y: (p.y - g.y) / g.cell }),
    toScreen: (p: Point): Point => ({ x: g.x + p.x * g.cell, y: g.y + p.y * g.cell }),
    pixelAt(p: Point) {
      const q = g.toGrid(p);
      const [i, j] = [Math.floor(q.x), Math.floor(q.y)];
      return i >= 0 && i < cols && j >= 0 && j < rows ? { x: i, y: j } : null;
    },
    outline(pen: CanvasRenderingContext2D, i: number, j: number, color: string, width = 2) {
      pen.strokeStyle = color;
      pen.lineWidth = width;
      pen.strokeRect(g.x + i * g.cell + width / 2, g.y + j * g.cell + width / 2, g.cell - width, g.cell - width);
    },
  };
  return g;
}

/**
 * THE CANVAS'S WAY: draws with the browser's own 2D drawing (`fillRect`, `arc`, `lineTo`...) on a hidden canvas
 * of `cols` × `rows` pixels, painted `background` first, and returns its pixels (RGBA), to set beside ours.
 */
export function canvasPixels(
  cols: number,
  rows: number,
  background: string,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Uint8ClampedArray {
  const c = document.createElement('canvas');
  [c.width, c.height] = [cols, rows];
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, cols, rows);
  draw(ctx);
  return ctx.getImageData(0, 0, cols, rows).data;
}

/** How two pictures of the same size differ: how many pixels, and the largest difference in one colour (0 to 255). */
export function difference(a: Uint8ClampedArray, b: Uint8ClampedArray): { pixels: number; largest: number } {
  let pixels = 0;
  let largest = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!));
    if (d > 0) pixels++;
    largest = Math.max(largest, d);
  }
  return { pixels, largest };
}

/** A handle's dot: a ring the reader can see is there to drag. */
export function dot(pen: CanvasRenderingContext2D, p: Point, color: string, r = 6) {
  pen.beginPath();
  pen.arc(p.x, p.y, r, 0, 2 * Math.PI);
  pen.fillStyle = color;
  pen.fill();
  pen.lineWidth = 2;
  pen.strokeStyle = '#1b1713';
  pen.stroke();
}
