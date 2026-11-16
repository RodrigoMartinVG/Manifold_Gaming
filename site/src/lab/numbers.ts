import type GUI from 'three/addons/libs/lil-gui.module.min.js';

/**
 * THE FIGURE'S NUMBERS on the panel, read on every frame from functions: each row shows what its
 * function returns now (a number, or a string such as "3.00, 0.00, -1.00"). They are the numbers the
 * lesson's mathematics talks about, and the ones its browser test reads.
 */
export function numbers(gui: GUI, rows: Record<string, () => number | string>) {
  const shown: Record<string, number | string> = {};
  for (const [name, read] of Object.entries(rows)) {
    Object.defineProperty(shown, name, { get: read, enumerable: true });
    // (lil-gui picks the row's kind from the value it reads, number or text; its typings want one kind.)
    gui
      .add(shown as Record<string, string>, name)
      .disable()
      .listen();
  }
}
