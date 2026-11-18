/** How the two pictures are shown: side by side across a divider, one alone, or where they differ. */
export type Mode = 'split' | 'ours' | 'the canvas’s' | 'differences';
export const MODES: Mode[] = ['split', 'ours', 'the canvas’s', 'differences'];

/**
 * A TOOL OF THE BOOK (docs/tutorial-v3.md §4): it makes the example work, and it is not the lesson; the chapter's
 * code is screen.ts and main.ts. It is read-only in the editor.
 *
 * HOW WE LOOK AT OUR PIXELS: two pictures of the same small size (ours and the canvas's), magnified to fill
 * the window (beside the panel, if given) with each pixel a sharp square. In `split`, ours to the left of a divider that can be dragged,
 * the canvas's to its right. Under the pointer, a magnifying glass. A press on the picture says which pixel.
 */
export function createView(width: number, height: number, beside?: HTMLElement) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;touch-action:none;display:block';
  document.body.style.margin = '0';
  document.body.style.background = '#1b1713';
  document.body.append(canvas);
  const pen = canvas.getContext('2d')!;

  // Each picture in a hidden canvas of its true size, to be drawn magnified.
  const picture = () => {
    const c = document.createElement('canvas');
    [c.width, c.height] = [width, height];
    return c;
  };
  const ours = picture();
  const theirs = picture();
  const apart = picture();

  let mode: Mode = 'split';
  let divider = 0.5; // where the divider is, as a share of the picture's width
  let pointer: { x: number; y: number } | null = null; // in the window's pixels
  let dragging = false;
  const presses: ((x: number, y: number) => void)[] = [];

  // Where the picture goes: as big as fits, centred, whole pixels of the window per pixel when it can; to the
  // left of the panel (`beside`) while that leaves it more than half the window, over it otherwise.
  const place = () => {
    const edge = beside && !beside.classList.contains('closed') ? beside.getBoundingClientRect().left - 8 : innerWidth;
    const room = edge > innerWidth / 2 ? edge : innerWidth;
    const scale = Math.min(room / width, innerHeight / height);
    const s = scale >= 2 ? Math.floor(scale) : scale;
    return { s, x: (room - width * s) / 2, y: (innerHeight - height * s) / 2 };
  };
  const toPixel = (p: { x: number; y: number }) => {
    const { s, x, y } = place();
    return { x: Math.floor((p.x - x) / s), y: Math.floor((p.y - y) / s) };
  };

  function draw() {
    const ratio = Math.min(devicePixelRatio, 2);
    const [w, h] = [Math.round(innerWidth * ratio), Math.round(innerHeight * ratio)];
    if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
    pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.imageSmoothingEnabled = false;
    pen.fillStyle = '#1b1713';
    pen.fillRect(0, 0, innerWidth, innerHeight);
    const { s, x, y } = place();
    const at = x + divider * width * s;

    if (mode === 'split') {
      pen.drawImage(ours, 0, 0, width * divider, height, x, y, width * divider * s, height * s);
      pen.drawImage(theirs, width * divider, 0, width * (1 - divider), height, at, y, width * (1 - divider) * s, height * s);
      pen.fillStyle = '#e5c07b';
      pen.fillRect(at - 1, y, 2, height * s);
      pen.beginPath();
      pen.arc(at, y + (height * s) / 2, 8, 0, 2 * Math.PI);
      pen.fill();
      label('el nuestro', x + 8, y + height * s - 8, 'left');
      label('el del canvas', x + width * s - 8, y + height * s - 8, 'right');
    } else {
      pen.drawImage(mode === 'ours' ? ours : mode === 'differences' ? apart : theirs, x, y, width * s, height * s);
    }

    // The magnifying glass: 15 × 15 pixels round the pointer, at 8 times the picture's size.
    if (pointer && !dragging) {
      const p = toPixel(pointer);
      if (p.x >= 0 && p.y >= 0 && p.x < width && p.y < height) {
        const source =
          mode === 'split' ? (pointer.x < at ? ours : theirs) : mode === 'ours' ? ours : mode === 'differences' ? apart : theirs;
        const r = 75;
        const zoom = (2 * r) / 15;
        pen.save();
        pen.beginPath();
        pen.arc(pointer.x, pointer.y, r, 0, 2 * Math.PI);
        pen.clip();
        pen.drawImage(source, p.x - 7, p.y - 7, 15, 15, pointer.x - r, pointer.y - r, 2 * r, 2 * r);
        pen.strokeStyle = 'rgba(232, 223, 208, 0.5)';
        pen.strokeRect(pointer.x - r + 7 * zoom, pointer.y - r + 7 * zoom, zoom, zoom); // the pixel pointed at
        pen.restore();
        pen.strokeStyle = '#e5c07b';
        pen.lineWidth = 2;
        pen.beginPath();
        pen.arc(pointer.x, pointer.y, r, 0, 2 * Math.PI);
        pen.stroke();
      }
    }
  }

  function label(text: string, x: number, y: number, align: CanvasTextAlign) {
    pen.font = '600 12px system-ui, sans-serif';
    pen.textAlign = align;
    pen.fillStyle = 'rgba(27, 23, 19, 0.7)';
    const w = pen.measureText(text).width;
    pen.fillRect(align === 'left' ? x - 4 : x - w - 4, y - 13, w + 8, 18);
    pen.fillStyle = '#e8dfd0';
    pen.fillText(text, x, y);
  }

  canvas.addEventListener('pointerdown', (e) => {
    const { s, x } = place();
    const at = x + divider * width * s;
    if (mode === 'split' && Math.abs(e.clientX - at) < 12) {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
    } else {
      const p = toPixel({ x: e.clientX, y: e.clientY });
      if (p.x >= 0 && p.y >= 0 && p.x < width && p.y < height) for (const f of presses) f(p.x, p.y);
    }
    draw();
  });
  canvas.addEventListener('pointermove', (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    if (dragging) {
      const { s, x } = place();
      divider = Math.min(1, Math.max(0, (e.clientX - x) / (width * s)));
    }
    draw();
  });
  canvas.addEventListener('pointerup', () => (dragging = false));
  canvas.addEventListener('pointerleave', () => {
    pointer = null;
    draw();
  });
  addEventListener('resize', draw);
  // (lil-gui closes and opens its panel by its title, and says so only in its class.)
  if (beside) new MutationObserver(draw).observe(beside, { attributes: true, attributeFilter: ['class'] });

  return {
    /** Shows these two pictures (RGBA, as our screen keeps them), and where they differ. */
    show(a: Uint8ClampedArray, b: Uint8ClampedArray) {
      ours.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(a), width, height), 0, 0);
      theirs.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(b), width, height), 0, 0);
      // Where they differ: black where they agree, and brighter the more they differ (a difference of one level
      // nearly black, of forty or more, bright orange), so the small ones do not hide the large ones.
      const d = new Uint8ClampedArray(a.length);
      for (let i = 0; i < a.length; i += 4) {
        const most = Math.max(Math.abs(a[i]! - b[i]!), Math.abs(a[i + 1]! - b[i + 1]!), Math.abs(a[i + 2]! - b[i + 2]!));
        d.set([Math.min(255, 6 * most), Math.min(255, 3 * most), 0, 255], i);
      }
      apart.getContext('2d')!.putImageData(new ImageData(d, width, height), 0, 0);
      draw();
    },
    setMode(m: Mode) {
      mode = m;
      draw();
    },
    /** A press on pixel (x, y) of the picture. */
    onPress(f: (x: number, y: number) => void) {
      presses.push(f);
    },
  };
}
