import type { GamePage, Piece } from './page';
import { addInterfaceStyles } from './ui';

/** How long a hit's glow takes to fade from its strongest (s). */
const FADE = 0.5;

/**
 * BEING HURT, SHOWN (the arena found it, after stage 4g): a red glow at the edges of the screen when
 * the page's character is hurt, stronger the more the hit took of its health, fading in half a second.
 * In first person nothing else showed a hit: the body is not drawn, so its flinch is not seen. What
 * the world says: its `hurt` events. Only the view. For the browser tests, `data-hurt`: how many hits
 * it showed.
 */
export function mountHurt(page: GamePage): Piece {
  addInterfaceStyles();
  const glow = document.createElement('div');
  glow.className = 'mg-hurt';
  page.container.append(glow);
  let level = 0;
  let hits = 0;
  const show = () => (glow.style.opacity = level.toFixed(3));
  return {
    welcome() {
      level = 0;
      show();
    },
    event(ev) {
      if (ev.type !== 'hurt') return;
      const hero = page.player();
      if (!hero || ev.target !== hero.id) return;
      level = Math.min(1, level + 0.35 + ev.amount / (hero.health?.most ?? 100));
      show();
      page.container.dataset.hurt = String(++hits);
    },
    frame({ dt }) {
      if (level <= 0) return;
      level = Math.max(0, level - dt / FADE);
      show();
    },
    stop() {
      glow.remove();
    },
  };
}
