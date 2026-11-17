import type { GamePage, Piece } from './page';
import { addInterfaceStyles } from './ui';

/**
 * A PHONE IS TOLD (decision 0028): until phase 6 the games are played with a keyboard and a mouse, or a
 * gamepad. On a device whose main pointer is a finger (`pointer: coarse`) and with no gamepad, the page
 * says so over the game, in the player's language, and lets you look anyway: the camera still turns by
 * dragging. It goes away at a key, at a gamepad, or at its button. (For the browser tests: `data-touch`,
 * `told` while it shows.)
 */
export function mountTouchNotice(page: GamePage): Piece {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const pad = () => typeof navigator.getGamepads === 'function' && navigator.getGamepads().some((p) => p !== null);
  if (!coarse || pad()) return {};
  addInterfaceStyles();
  const box = document.createElement('div');
  box.className = 'mg-touch';
  box.setAttribute('role', 'note');
  const text = document.createElement('p');
  text.textContent = page.words('touch.needs');
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = page.words('touch.look');
  box.append(text, button);
  page.container.append(box);
  page.container.dataset.touch = 'told';
  const close = () => {
    box.remove();
    delete page.container.dataset.touch;
    window.removeEventListener('keydown', close);
    window.removeEventListener('gamepadconnected', close);
  };
  button.addEventListener('click', close);
  window.addEventListener('keydown', close);
  window.addEventListener('gamepadconnected', close);
  return { stop: close };
}
