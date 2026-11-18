import * as THREE from 'three';
import type { CommandInfo } from '@manifold/commands';
import {
  ghostAt,
  ghostFacing,
  ghostFromText,
  GhostRecorder,
  GHOST_HEADER,
  ghostToText,
  ghostTurn,
  newCharacter,
  replayFromText,
  replayOf,
  ReplayPlayer,
  replayToText,
  sessionFor,
  stateHash,
  STEP,
  upAt,
  type Cartridge,
  type Character,
  type Entity,
  type Ghost,
  type Replay,
} from '@manifold/core';
import type { Vec3 } from '@manifold/common';
import type { Match } from '@manifold/net';
import type { Bodies } from './bodies';
import { surroundingsOf } from './hands';
import { animate, turnBody, type ModelInstance } from './models';
import { ownMaterial, release } from './owned';
import type { PageMatch } from './match';
import { hex, type GamePage, type Piece } from './page';
import { GHOST_PREFIX, REPLAY_PREFIX, replayToFragment } from './replay-link';

export interface Replays extends Piece {
  /** Whether the server is playing a replay (the live player waits until it ends). */
  readonly playing: boolean;
  /** A replay or a ghost that came with the page (the game gathered them, from its link), as text. */
  fromPage(o: { replay?: string; ghost?: string }): void;
  /** The live player's strip since its world was born, as text (stage 5d: a game shares it). */
  strip(): string;
  /** A strip to race (its text), from the next world born (stage 5d: a game loads a level after); null, none. */
  race(text: string | null): void;
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
      'Races what you just did: the world starts over, with a ghost doing it again next to you (a strip of its poses: drawn, not simulated, so a newer engine still shows it). `ghost export` builds a link with it, for someone else to race; `ghost clear` removes it.',
    args: [{ name: 'action', type: { kind: 'option', options: ['export', 'clear'] }, optional: true }],
  },
} as const satisfies Record<string, CommandInfo>;

/**
 * REPLAYS AND GHOSTS (stage 1c). `replay` plays the world again from its birth (the server plays it,
 * and each copy checks at the end that it gave the same hash), or builds a link with it; `ghost` races
 * what was just done, drawn translucent beside you. A ghost is a strip of poses (stage 4.5c, decision
 * 0025: where the player was, where it looked and how it moved, every four steps, recorded as it
 * played): drawn between them, not simulated, so it costs no second world and a newer engine still
 * shows it. (It was another world, born like the replay and fed its inputs: as dear as the live one,
 * and broken by every new version.)
 */
export function mountReplays(page: GamePage, match: PageMatch, bodies: Bodies): Replays {
  const timeScale = () => (match.paused ? 0 : match.timescale);
  const { container } = page;
  /** The replay the server is playing: its last step and hash. */
  let replaying: Match['replay'] | null = null;
  /** A ghost: its strip, how it is drawn, the character its animations read, and where it was drawn last. */
  let ghost: {
    strip: Ghost;
    mesh: THREE.Object3D | null;
    model: ModelInstance | null;
    character: Character;
    /** Its body's turn as drawn (stage 2e2). */
    drawn: THREE.Quaternion | null;
  } | null = null;
  /** The live player's strip, recorded as it plays since its world was born. */
  let recorder = new GhostRecorder();

  /** The server plays the replay: the match starts over like it, and each copy checks its hash at the end. */
  const playNow = (replay: Replay) => match.request({ type: 'play', replay: replayToText(replay) });

  function startGhost(strip: Ghost) {
    clearGhost();
    ghost = { strip, mesh: null, model: null, character: newCharacter({ player: 0 }), drawn: null };
    const body = page.player();
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
    ghost.model?.mixer.stopAllAction();
    if (ghost.mesh) {
      page.stage.scene.remove(ghost.mesh);
      // Its own materials and a capsule's own shape, never its model's (before 2e, the capsule's stayed).
      release(ghost.mesh);
    }
    ghost = null;
    delete container.dataset.ghost;
  }

  /** The live player's strip so far. */
  const stripNow = (): Ghost => recorder.ghost(page.cartridge.id, replayOf(page.session).birth, page.session.world.tick);

  /** A replay, or a ghost's strip, as a link, written in the console (and copied, if the browser lets). */
  async function exportLink(text: string, prefix: string, what: string) {
    const link = `${location.origin}${location.pathname}#${await replayToFragment(text, prefix)}`;
    page.console?.write(link);
    page.console?.write(`(${what}: ${link.length} characters)`);
    navigator.clipboard?.writeText(link).then(
      () => page.console?.write('(link copied)'),
      () => undefined,
    );
  }

  page.registry.declareCommand({
    ...REPLAY_COMMANDS.replay,
    run: ([action], out) => {
      const replay = replayOf(page.session);
      if (action === 'export')
        void exportLink(replayToText(replay), REPLAY_PREFIX, `${replay.end.step} steps, ${replay.inputs.length} input changes`);
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
      const strip = ghost && action === 'export' ? ghost.strip : stripNow();
      if (action === 'export') {
        void exportLink(ghostToText(strip), GHOST_PREFIX, `a ghost of ${strip.end} steps, ${strip.poses.length} poses`);
        return;
      }
      if (strip.end === 0) {
        out.write('nothing to race yet: play first (the world records since it was born)');
        return;
      }
      startGhost(strip);
      match.restart();
      out.write(`a ghost of ${strip.end} steps: the world starts over, and it runs next to you`);
    },
  });

  return {
    get playing() {
      return replaying !== null;
    },
    strip: () => ghostToText(stripNow()),
    race(text) {
      if (text === null) return clearGhost();
      startGhost(ghostFromText(text));
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
      // A ghost's link carries its strip; an older one (before 4.5c) carried a replay, played here once
      // for the strip of its player (on this engine: if it is newer, near what was done, not checked).
      if (race) {
        try {
          startGhost(race.startsWith(GHOST_HEADER) ? ghostFromText(race) : stripOfReplay(page.cartridge, replayFromText(race)));
          match.restart();
        } catch (e) {
          page.say(`the link's ghost: ${(e as Error).message}`, 'warn');
        }
      }
    },
    welcome(session, m) {
      replaying = m.replay ?? null;
      if (replaying) container.dataset.replay = 'playing';
      // A new world records anew; a ghost starts over with it: both from step 0.
      recorder = new GhostRecorder();
      recorder.record(session.world, page.me);
      if (ghost) {
        if (session.world.tick === 0) startGhost(ghost.strip);
        else clearGhost();
      }
    },
    afterStep() {
      const world = page.session.world;
      recorder.record(world, page.me);
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
    // The ghost, where its strip has it at the step drawn (between two of its poses), moving as its
    // poses say (stage 2e): its animations read a character made of them.
    frame({ dt, world, alpha }) {
      if (!ghost?.mesh) return;
      const at = world.tick - 1 + alpha;
      const pose = ghostAt(ghost.strip, at);
      const was = ghostAt(ghost.strip, at - 1);
      if (!pose || !was) return;
      const time = dt * timeScale();
      const up = upAt(world, pose.position);
      // How it moved in its last step (as the live one's animations read it: bodies.ts), and so how fast.
      const moved: Vec3 = [
        pose.position[0] - was.position[0],
        pose.position[1] - was.position[1],
        pose.position[2] - was.position[2],
      ];
      const c = ghost.character;
      c.mode = pose.mode;
      c.facing = ghostFacing(pose);
      c.grounded = pose.mode !== 'air' && pose.mode !== 'glide';
      c.velocity = [moved[0] / STEP, moved[1] / STEP, moved[2] / STEP];
      ghost.mesh.position.set(...pose.position);
      // Its body turns as the live one's does: quickly, not at once (models.ts: turnBody).
      const target = new THREE.Quaternion(...ghostTurn(pose));
      ghost.drawn ??= target.clone();
      const turning = turnBody(ghost.drawn, target, up, time);
      ghost.mesh.quaternion.copy(ghost.drawn);
      if (ghost.model) animate(ghost.model, c, up, moved, turning, time, surroundingsOf(world, GHOST_BODY(c)));
    },
    afterRender() {
      const pose = ghost && ghostAt(ghost.strip, page.session.world.tick);
      if (pose) container.dataset.ghost = pose.position.map((n) => n.toFixed(2)).join(' ');
    },
    stop: clearGhost,
  };
}

/** A ghost as an entity for what its feet and hands ask the live world (its rays skip no one of it). */
const GHOST_BODY = (character: Character): Entity => ({ id: -1, character });

/**
 * An older ghost link's replay (before stage 4.5c), as the strip of its player: played once, without a
 * screen, on this engine (if it is newer than the replay's, near what was done: a ghost is not checked).
 */
function stripOfReplay(cartridge: Cartridge, replay: Replay): Ghost {
  const session = sessionFor(cartridge, replay);
  const player = new ReplayPlayer(replay);
  const recorder = new GhostRecorder();
  recorder.record(session.world, 1);
  while (!player.finished(session)) {
    player.feed(session);
    session.step();
    recorder.record(session.world, 1);
  }
  const strip = recorder.ghost(cartridge.id, replay.birth, session.world.tick);
  session.world.dispose();
  return strip;
}
