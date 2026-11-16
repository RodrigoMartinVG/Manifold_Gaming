import type { GamePage } from './page';
import { button, panel } from './ui';

export interface DialogOptions {
  title: string;
  /** Its lines of text. */
  lines?: readonly string[];
  /** Its buttons, in order: what each says and does (the dialogue closes first). */
  buttons: readonly { label: string; then?: () => void }[];
  /** Which button Escape presses (the last one, if not said). */
  escape?: number;
}

/**
 * A DIALOGUE BOX (stage 3i): a title, a few lines and buttons, over the game, that works with the
 * keyboard alone (the focus on its first button, the arrows go along them, Escape presses one). While
 * it is open the player's character does not take keys. For the browser tests: `data-dialog`, its
 * title while it is open.
 */
export function openDialog(page: GamePage, o: DialogOptions): { close(): void } {
  const release = page.hold();
  let open = true;
  const close = () => {
    if (!open) return;
    open = false;
    p.remove();
    release();
    delete page.container.dataset.dialog;
  };
  const p = panel(page.container, {
    title: o.title,
    onKey: (e) => {
      if (e.key !== 'Escape') return false;
      buttons[o.escape ?? buttons.length - 1]?.click();
      return true;
    },
  });
  for (const line of o.lines ?? []) {
    const text = document.createElement('p');
    text.textContent = line;
    p.box.append(text);
  }
  const row = document.createElement('div');
  row.className = 'mg-actions mg-row';
  const buttons = o.buttons.map((b) =>
    button(b.label, () => {
      close();
      b.then?.();
    }),
  );
  row.append(...buttons);
  p.box.append(row);
  page.container.dataset.dialog = o.title;
  p.focus();
  return { close };
}
