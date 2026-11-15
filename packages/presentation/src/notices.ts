import { overlay, type GamePage, type Piece } from './page';

/**
 * THE GAME'S NOTICES (stage 2a): "checkpoint", "the goal in 23.4 s"… The world emits them, for one
 * player or for everybody; this page shows the ones for its player, a few seconds in the middle of
 * the screen (and in the console, if there is one).
 */
export function mountNotices(page: GamePage): Piece {
  const box = overlay(page.container, 'mg-notice', {
    position: 'absolute',
    top: '18%',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '0.5rem 1.2rem',
    borderRadius: '0.4rem',
    background: 'rgb(18 16 13 / 0.78)',
    color: '#f0d59a',
    font: "600 18px/1.4 'Cinzel Variable', Georgia, serif",
    letterSpacing: '0.04em',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    transition: 'opacity 0.4s',
  });
  let timer = 0;
  const show = (text: string) => {
    box.textContent = text;
    box.hidden = false;
    box.style.opacity = '1';
    page.container.dataset.notice = text;
    page.console?.write(text);
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      box.style.opacity = '0';
      timer = window.setTimeout(() => (box.hidden = true), 400);
    }, 2600);
  };
  return {
    event(ev) {
      if (ev.type === 'notice' && (ev.player === undefined || ev.player === page.me)) show(ev.text);
    },
    stop() {
      clearTimeout(timer);
      box.remove();
    },
  };
}
