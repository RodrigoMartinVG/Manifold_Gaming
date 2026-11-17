import type { World } from '@manifold/core';
import type { GamePage, Piece } from './page';
import { addInterfaceStyles } from './ui';

/**
 * THE STORY, SHOWN (stage 4f): the objective to do now, at the top (what its key says in the player's
 * language: decision 0019), and a scene's lines as they play, one at a time under it, each with
 * who says it, for as long as it takes to read (a key or a click goes on). What the world says: its
 * `objective` and `scene` events, and its objectives' states when a session arrives. Only the view.
 */

/** How long a scene's line stays (s): a little over two seconds, and more for a longer one. */
const lineTime = (text: string) => 2.2 + text.length / 18;

export function mountStory(page: GamePage): Piece {
  addInterfaceStyles();
  const goal = document.createElement('div');
  goal.className = 'mg-objective';
  goal.hidden = true;
  const box = document.createElement('div');
  box.className = 'mg-scene';
  box.hidden = true;
  page.container.append(goal, box);
  let queue: { who: string; say: string }[] = [];
  let left = 0;

  const showObjective = (say: string | null) => {
    goal.hidden = say === null;
    goal.textContent = say === null ? '' : page.words('story.objective', [page.words(say)]);
    page.container.dataset.objective = say ?? '';
  };
  const next = () => {
    const line = queue.shift();
    if (!line) {
      box.hidden = true;
      delete page.container.dataset.scene;
      return;
    }
    const text = page.words(line.say);
    box.replaceChildren(
      Object.assign(document.createElement('b'), { textContent: page.words(line.who) }),
      document.createTextNode(text),
    );
    box.hidden = false;
    left = lineTime(text);
    page.container.dataset.scene = line.say;
  };
  const active = (world: World) => {
    for (const e of world.entities.values()) if (e.objective?.state === 'active') return e.objective.say;
    return null;
  };
  const skip = () => {
    if (!box.hidden) next();
  };
  box.addEventListener('click', skip);
  window.addEventListener('keydown', (ev) => {
    if (!box.hidden && (ev.code === 'Enter' || ev.code === 'Space')) skip();
  });

  return {
    welcome(session) {
      queue = [];
      next();
      showObjective(active(session.world));
    },
    event(ev, world) {
      if (ev.type === 'objective') showObjective(active(world));
      if (ev.type === 'scene') {
        const playing = !box.hidden;
        queue.push(...ev.lines);
        if (!playing) next();
      }
    },
    frame({ dt }) {
      if (box.hidden) return;
      left -= dt;
      if (left <= 0) next();
    },
  };
}
