import * as THREE from 'three';
import type { CommandInfo } from '@manifold/commands';
import {
  replayFromText,
  replayOf,
  ReplayPlayer,
  replayToText,
  sessionFor,
  stateHash,
  upAt,
  type Replay,
  type Session,
} from '@manifold/core';
import type { Match } from '@manifold/net';
import type { Bodies } from './bodies';
import { animate, type ModelInstance } from './models';
import { ownMaterial, release } from './owned';
import type { PageMatch } from './match';
import { hex, type GamePage, type Piece } from './page';
import { GHOST_PREFIX, REPLAY_PREFIX, replayToFragment } from './replay-link';

export interface Replays extends Piece {
  /** Whether the server is playing a replay (the live player waits until it ends). */
  readonly playing: boolean;
  /** A replay or a ghost that came with the page (the game gathered them, from its link), as text. */
  fromPage(o: { replay?: string; ghost?: string }): void;
}

/** What replays and ghosts let people do, as data (the site's console reference reads it). */
export const REPLAY_COMMANDS = {
  replay: {
    name: 'replay',
    description:
      'The replay of this world since it was born: `replay export` builds a link with it (whoever opens it sees the same, and it checks that it gave the same hash), `replay play` plays it again from the start, `replay stop` gives the control back.',
    args: [{ name: 'action', type: { kind: 'option', options: ['export', 'play', 'stop'] }, optional: true }],
  },
  ghost: {
    name: 'ghost',
    description:
      'Races what you just did: the world starts over, with a ghost doing it again next to you. `ghost export` builds a link with it, for someone else to race; `ghost clear` removes it.',
    args: [{ name: 'action', type: { kind: 'option', options: ['export', 'clear'] }, optional: true }],
  },
} as const satisfies Record<string, CommandInfo>;

/**
 * REPLAYS AND GHOSTS (stage 1c). `replay` plays the world again from its birth (the server plays it,
 * and each copy checks at the end that it gave the same hash), or builds a link with it; `ghost` races
 * what was just done: another world, born like the replay and fed its inputs, run in step with this
 * one, drawn translucent.
 */
export function mountReplays(page: GamePage, match: PageMatch, bodies: Bodies): Replays {
  const timeScale = () => (match.paused ? 0 : match.timescale);
  const { container } = page;
  /** The replay the server is playing: its last step and hash. */
  let replaying: Match['replay'] | null = null;
  /** A ghost: another world, born like a replay and fed its inputs, run in step with this one. */
  let ghost: {
    replay: Replay;
    session: Session;
    player: ReplayPlayer;
    mesh: THREE.Object3D | null;
    model: ModelInstance | null;
  } | null = null;

  /** The server plays the replay: the match starts over like it, and each copy checks its hash at the end. */
  const playNow = (replay: Replay) => match.request({ type: 'play', replay: replayToText(replay) });

  function startGhost(replay: Replay) {
    clearGhost();
    ghost = { replay, session: sessionFor(page.cartridge, replay), player: new ReplayPlayer(replay), mesh: null, model: null };
    const body = [...ghost.session.world.entities.values()].find((e) => e.character?.player === 1);
    if (body?.appearance) {
      // The same look, translucent: a ghost. (Its own materials: a model's are shared by every copy,
      // and the live character must not turn translucent with it.)
      const { object, model } = bodies.meshFor(body.appearance);
      // (What it replaces is freed if it was the copy's own, its color: owned.ts.)
      const meshes: THREE.Mesh[] = [];
      object.traverse((o) => o instanceof THREE.Mesh && meshes.push(o));
      for (const mesh of meshes) {
        const m = (mesh.material as THREE.Material).clone();
        m.transparent = true;
        m.opacity = 0.35;
        m.depthWrite = false;
        ownMaterial(mesh, m);
      }
      object.userData.ghost = true;
      ghost.mesh = object;
      ghost.model = model;
      page.stage.scene.add(object);
    }
  }

  function clearGhost() {
    if (!ghost) return;
    ghost.session.world.dispose();
    ghost.model?.mixer.stopAllAction();
    if (ghost.mesh) {
      page.stage.scene.remove(ghost.mesh);
      // Its own materials and a capsule's own shape, never its model's (before 2e, the capsule's stayed).
      release(ghost.mesh);
    }
    ghost = null;
    delete container.dataset.ghost;
  }

  /** A replay as a link, written in the console (and copied, if the browser lets). */
  async function exportReplay(replay: Replay, prefix: string) {
    const text = replayToText(replay);
    const link = `${location.origin}${location.pathname}#${await replayToFragment(text, prefix)}`;
    page.console?.write(link);
    page.console?.write(`(${replay.end.step} steps, ${replay.inputs.length} input changes: ${link.length} characters)`);
    navigator.clipboard?.writeText(link).then(
      () => page.console?.write('(link copied)'),
      () => undefined,
    );
  }

  page.registry.declareCommand({
    ...REPLAY_COMMANDS.replay,
    run: ([action], out) => {
      const replay = replayOf(page.session);
      if (action === 'export') void exportReplay(replay, REPLAY_PREFIX);
      else if (action === 'play') {
        playNow(replay);
        out.write(`playing the replay: ${replay.end.step} steps`);
      } else if (action === 'stop') {
        if (replaying) {
          replaying = null;
          container.dataset.replay = 'stopped';
        }
        match.request({ type: 'stop' });
      } else
        out.write(
          `recorded since the world was born: ${replay.end.step} steps, ${replay.inputs.length} input changes, ${replay.changes.length} world changes. \`replay export\` builds a link, \`replay play\` plays it again, \`ghost\` races it.`,
        );
    },
  });
  page.registry.declareCommand({
    ...REPLAY_COMMANDS.ghost,
    run: ([action], out) => {
      if (action === 'clear') {
        clearGhost();
        out.write('no ghost');
        return;
      }
      const replay = ghost && action === 'export' ? ghost.replay : replayOf(page.session);
      if (action === 'export') {
        void exportReplay(replay, GHOST_PREFIX);
        return;
      }
      if (replay.end.step === 0) {
        out.write('nothing to race yet: play first (the world records since it was born)');
        return;
      }
      startGhost(replay);
      match.restart();
      out.write(`a ghost of ${replay.end.step} steps: the world starts over, and it runs next to you`);
    },
  });

  return {
    get playing() {
      return replaying !== null;
    },
    fromPage({ replay, ghost: race }) {
      const use = (text: string | undefined, what: string, then: (r: Replay) => void) => {
        if (!text) return;
        try {
          then(replayFromText(text));
        } catch (e) {
          page.say(`${what}: ${(e as Error).message}`, 'warn');
        }
      };
      use(replay, "the link's replay", playNow);
      use(race, "the link's ghost", (r) => {
        startGhost(r);
        match.restart();
      });
    },
    welcome(session, m) {
      replaying = m.replay ?? null;
      if (replaying) container.dataset.replay = 'playing';
      // A ghost starts over with the world: both are born at step 0, and run in step.
      if (ghost) {
        if (session.world.tick === 0) startGhost(ghost.replay);
        else clearGhost();
      }
    },
    beforeStep() {
      if (ghost && !ghost.player.finished(ghost.session)) {
        ghost.player.feed(ghost.session);
        ghost.session.step();
      }
    },
    afterStep() {
      const world = page.session.world;
      if (!replaying || world.tick !== replaying.step) return;
      const hash = stateHash(world);
      const same = hash === replaying.hash;
      container.dataset.replay = same ? 'same' : 'different';
      page.console?.write(
        same
          ? `the replay ended at step ${world.tick}: the same hash (${hex(hash)}), the same world. The control is yours.`
          : `the replay ended at step ${world.tick} with ANOTHER hash: ${hex(hash)} instead of ${hex(replaying.hash)}`,
        same ? 'info' : 'error',
      );
      replaying = null;
    },
    // The ghost, where its world has it (its own world: what it pushes does not move here), and
    // moving as its state asks (stage 2e).
    frame({ dt }) {
      if (!ghost?.mesh) return;
      const body = [...ghost.session.world.entities.values()].find((e) => e.character?.player === 1);
      const g = body?.transform;
      if (!g) return;
      ghost.mesh.position.set(...g.position);
      ghost.mesh.quaternion.set(...g.rotation);
      if (ghost.model && body.character)
        animate(ghost.model, body.character, upAt(ghost.session.world, g.position), dt * timeScale());
    },
    afterRender() {
      const body = ghost && [...ghost.session.world.entities.values()].find((e) => e.character?.player === 1);
      if (body?.transform) container.dataset.ghost = body.transform.position.map((n) => n.toFixed(2)).join(' ');
    },
    stop: clearGhost,
  };
}
