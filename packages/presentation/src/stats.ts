import { stateHash } from '@manifold/core';
import type { PageMatch } from './match';
import { hex, overlay, type GamePage, type Piece } from './page';

/**
 * THE STATS (`show.stats`): the step, the world's hash, the entities and the bodies, the frames per
 * second, how long the physics takes per step (on average over the last second), and the match.
 */
export function mountStats(page: GamePage, match: PageMatch): Piece {
  const box = overlay(page.container, 'mg-stats', {
    position: 'absolute',
    top: '12px',
    right: '12px',
    padding: '6px 10px',
    borderRadius: '6px',
    background: 'rgb(18 16 13 / 0.82)',
    color: '#e6dccb',
    font: '12px/1.5 ui-monospace, Menlo, monospace',
    pointerEvents: 'none',
    whiteSpace: 'pre',
  });
  page.registry.declareVariable({
    name: 'show.stats',
    description: "The step, the world's hash, the entities and the frames per second.",
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
    onChange: (v) => (box.hidden = v !== true),
  });

  let stepTime = 0;
  let stepsTimed = 0;
  let msPerStep = 0;
  let stepStart = 0;
  let frames = 0;
  let secondStart = performance.now();
  let framesThisSecond = 0;
  let perSecond = 0;

  return {
    beforeStep: () => (stepStart = performance.now()),
    afterStep() {
      stepTime += performance.now() - stepStart;
      stepsTimed++;
    },
    afterRender({ now, world }) {
      framesThisSecond++;
      if (now - secondStart >= 1000) {
        perSecond = Math.round((framesThisSecond * 1000) / (now - secondStart));
        msPerStep = stepsTimed ? stepTime / stepsTimed : 0;
        framesThisSecond = 0;
        stepTime = 0;
        stepsTimed = 0;
        secondStart = now;
      }
      // Every 10 frames: the hash costs (it reads the whole world).
      if (++frames % 10 !== 0 || box.hidden) return;
      const where =
        match.net === 'joined' ? "in another tab's match" : match.net === 'open' ? 'match open to other tabs' : 'alone';
      box.textContent = [
        `step ${world.tick}${match.paused ? ' (paused)' : ''}`,
        `hash ${hex(stateHash(world))}`,
        `${world.entities.size} entities · ${world.physics.bodyCount} bodies · ${perSecond} fps`,
        `physics ${msPerStep.toFixed(2)} ms per step`,
        `${where} · player ${match.me} · ${match.checks} hash checks${match.desyncs ? ` · ${match.desyncs} DESYNCS` : ''}`,
        match.timescale !== 1 ? `timescale ${match.timescale}×` : '',
      ]
        .filter(Boolean)
        .join('\n');
    },
    stop: () => box.remove(),
  };
}
