import { overlay, type GamePage, type Piece } from './page';

/**
 * THE GAME'S NOTICES (stage 2a): "checkpoint", "the goal in 23.4 s"… The world emits them, for one
 * player or for everybody, as a key of the game's words and its numbers (stage 3i, decision 0019);
 * this page shows the ones for its player, a few seconds in the middle of the screen, in the player's
 * language (and in the console, if there is one, in English, the console's). For the browser tests:
 * `data-notice`, the last one's key.
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
  const english = page.wordsIn('en');
  const show = (say: string, values: readonly number[]) => {
    box.textContent = page.words(say, values);
    box.hidden = false;
    box.style.opacity = '1';
    page.container.dataset.notice = say;
    page.console?.write(english(say, values));
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      box.style.opacity = '0';
      timer = window.setTimeout(() => (box.hidden = true), 400);
    }, 2600);
  };
  return {
    event(ev) {
      if (ev.type === 'notice' && (ev.player === undefined || ev.player === page.me)) show(ev.say, ev.values ?? []);
    },
    stop() {
      clearTimeout(timer);
      box.remove();
    },
  };
}
