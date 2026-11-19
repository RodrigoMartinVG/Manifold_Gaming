import { beforeAll, describe, expect, test } from 'vitest';
import { quat, vec3, type Vec3 } from '@manifold/common';
import { characterParts, CHARACTER_VERSION } from '@manifold/character';
import {
  buildLevel,
  component,
  initPhysics,
  levelFromText,
  playReplay,
  replayFromText,
  type Cartridge,
  type Entity,
  type World,
} from '@manifold/core';
import type { Game } from './index';
import { drive } from './drive';
import { referenceText } from './references';
import { byName, followPlayers, notice, SHELL_VERSION } from './run';

beforeAll(initPhysics);

/**
 * A GAME THAT IS ITS RULES, ITS LEVELS, ITS WORDS AND ITS MUSIC (stage 5.5h, decision 0033's "done when"),
 * here, in this test, with no file of its own and nothing copied from another game: the library gives the
 * rest (the level's run, the files by name, the driver, the references' kit). A walk to a goal past a
 * checkpoint, with a void to fall into.
 */
const LEVELS = byName(
  {
    '../levels/walk.level': `# Manifold level 10
title A walk
spawn 0 1 0
facing 0 0 -1
box 0 -0.5 -8  2 0.5 10
sensor checkpoint  0 1 -6  2 1 0.5
sensor fall  0 -6 -8  30 3 30
sensor goal  0 1 -15  2 1 0.5
`,
  },
  (text) => levelFromText(text, { zones: { checkpoint: {}, fall: {}, goal: {} } }),
);

/** How a walker is doing: where it comes back to, when it reached the goal (−1: not yet), its falls. */
type Walk = { spawn: Vec3; checkpoint: Vec3; finish: number; falls: number };
const WALK = 'fixture.walk';
const walkOf = (e: Entity) => component<Walk>(e, WALK);

function walker(world: World, player: number, at: Vec3) {
  const parts = characterParts({ player, facing: [0, 0, -1], color: 0x93d9c9 });
  world.createEntity({
    transform: { position: [...at], rotation: quat.identity() },
    body: parts.body,
    character: parts.character,
    appearance: parts.appearance,
    game: { [WALK]: { spawn: [...at], checkpoint: [...at], finish: -1, falls: 0 } satisfies Walk },
  });
}

const FIXTURE: Cartridge = {
  id: 'fixture',
  title: 'A fixture',
  versions: { fixture: 1, ...SHELL_VERSION, ...CHARACTER_VERSION },
  zones: { checkpoint: {}, fall: {}, goal: {} },
  onStart(world) {
    buildLevel(world, LEVELS.walk!);
    walker(world, 1, LEVELS.walk!.spawn);
  },
  onStep(world, events) {
    followPlayers(world, {
      ours: (e) => !!walkOf(e),
      spawn: (first) => (first && walkOf(first)?.spawn) ?? [0, 1, 0],
      make: (p, at) => walker(world, p, at),
    });
    for (const ev of events) {
      if (ev.type !== 'sensorEntered') continue;
      const zone = world.entities.get(ev.sensor);
      const e = world.entities.get(ev.entity);
      const w = e && walkOf(e);
      if (!zone?.sensor || !zone.transform || !e?.character || !w) continue;
      if (zone.sensor.kind === 'fall') {
        world.place(e, w.checkpoint);
        w.falls++;
        notice(world, e.character.player, 'fixture.fell');
      } else if (zone.sensor.kind === 'checkpoint' && !vec3.equals(w.checkpoint, zone.transform.position)) {
        w.checkpoint = [...zone.transform.position];
        notice(world, e.character.player, 'fixture.checkpoint');
      } else if (zone.sensor.kind === 'goal' && w.finish < 0) w.finish = world.tick;
    }
  },
};

const done = (_: World, hero: Entity | undefined) => {
  const w = hero && walkOf(hero);
  return w && w.finish >= 0 ? { steps: w.finish, stars: 0, falls: w.falls } : null;
};

/** The game as the shell takes it: its rules, its level, its words in both languages, and its music. */
const GAME: Game = {
  id: 'fixture',
  cartridge: FIXTURE,
  words: {
    es: {
      'fixture.title': 'Un paseo',
      'fixture.tagline': 'Hasta la meta.',
      'fixture.walk': 'El paseo',
      'fixture.fell': 'Te caíste.',
      'fixture.checkpoint': 'Punto de control.',
    },
    en: {
      'fixture.title': 'A walk',
      'fixture.tagline': 'To the goal.',
      'fixture.walk': 'The walk',
      'fixture.fell': 'You fell.',
      'fixture.checkpoint': 'Checkpoint.',
    },
  },
  title: 'fixture.title',
  tagline: 'fixture.tagline',
  levels: [{ id: 'walk', recipe: '', name: 'fixture.walk' }],
  done,
  thread: { opening: [], ending: [] },
  credits: [],
  music: {
    tempo: 90,
    root: 57,
    scale: [0, 2, 3, 5, 7, 8, 10],
    moods: { walk: { voices: [{ wave: 'sine', gain: 0.2, notes: [0, 2, 4, null], length: 4 }] }, done: { voices: [] } },
    mood: (world, hero) => (done(world, hero) ? 'done' : 'walk'),
  },
};

describe('a game that is only its rules, levels, words and music (stage 5.5h)', () => {
  test('played to its goal without a screen, past its checkpoint, said in its words; its reference replays to the same hash', () => {
    const d = drive(GAME.cartridge, GAME.levels[0]!.recipe, { done: (s, me) => GAME.done(s.world, me) !== null });
    const said: string[] = [];
    const listen = () => {
      for (const ev of d.session.world.stepEvents) if (ev.type === 'notice') said.push(ev.say);
    };
    for (let i = 0; i < 30; i++) {
      d.step();
      listen();
    }
    expect(d.go({ move: [0, 0, -1] }, () => (listen(), false), 600)).toBe(true);
    const result = GAME.done(d.session.world, d.me())!;
    expect(result.falls).toBe(0);
    expect(said).toContain('fixture.checkpoint');
    // Every key it says is in its words, in both languages.
    for (const key of said) for (const language of ['es', 'en'] as const) expect(GAME.words[language][key], key).toBeTruthy();
    // Its music by what the world says: walking, then done.
    expect(GAME.music!.mood(d.session.world, d.me())).toBe('done');
    // Its reference: the run's replay, written with the references' kit, plays back to its last hash.
    const text = referenceText(d.session, 'The fixture walk, to its goal.', 'shell/fixture.test.ts');
    expect(text).toMatch(/^# Manifold replay \d+\nrules character 1 fixture 1 shell 1\n/);
    const played = playReplay(GAME.cartridge, replayFromText(text));
    expect(played.same).toBe(true);
    played.session.world.dispose();
    d.session.world.dispose();
  });

  test('one who joins walks beside the first; one who falls comes back to its checkpoint, said', () => {
    const d = drive(GAME.cartridge, '');
    d.session.registry.run('players.join 2', 'console');
    d.step();
    d.step();
    const second = [...d.session.world.entities.values()].find((e) => e.character?.player === 2)!;
    expect(second.transform!.position[0]).toBeCloseTo(1.2, 6);
    // Off the floor's other side (the one who joined stands to its right), into the void: back where it
    // started (no checkpoint yet), once.
    d.go({ move: [-1, 0, 0] }, () => (walkOf(d.me())?.falls ?? 0) > 0, 600);
    expect(d.me().transform!.position[0]).toBeCloseTo(0, 1);
    expect(walkOf(d.me())!.falls).toBe(1);
    d.session.world.dispose();
  });
});
