import { beforeAll, describe, expect, test } from 'vitest';
import { quat } from '@manifold/common';
import type { Cartridge } from './cartridge';
import { checkReplays } from './determinism';
import { initPhysics } from './physics';
import { replayOf, replayToText } from './replay';
import { Session } from './session';

beforeAll(initPhysics);

/** A floor and a ball dropped on it: something to play. */
const Drop: Cartridge = {
  id: 'drop',
  title: 'Drop',
  versions: { drop: 1 },
  onStart(world) {
    world.createEntity({
      transform: { position: [0, -0.5, 0], rotation: quat.identity() },
      body: { type: 'fixed', shape: { kind: 'box', halfExtents: [5, 0.5, 5] } },
    });
    world.createEntity({
      transform: { position: [0, 3, 0], rotation: quat.identity() },
      body: { type: 'dynamic', shape: { kind: 'ball', radius: 0.2 } },
    });
  },
};

describe('the determinism check, of every game (stage 5.5c)', () => {
  test('each replay of each game played here, its hash against its file’s; one that ends elsewhere says so', async () => {
    const session = new Session(Drop);
    for (let i = 0; i < 90; i++) session.step();
    const text = replayToText(replayOf(session));
    session.world.dispose();
    const tampered = text.replace(/^end (\d+) [0-9a-f]{8}$/m, 'end $1 00000000');
    const seen: string[] = [];
    let pauses = 0;
    const results = await checkReplays([{ cartridge: Drop, replays: { fall: text, other: tampered } }], {
      every: 30,
      pause: async () => void pauses++,
      onProgress: (game, name, step) => seen.push(`${game}/${name} ${step}`),
    });
    expect(results.map((r) => [r.game, r.name, r.steps, r.same])).toEqual([
      ['drop', 'fall', 90, true],
      ['drop', 'other', 90, false],
    ]);
    expect(pauses).toBe(6);
    expect(seen.slice(0, 4)).toEqual(['drop/fall 30', 'drop/fall 60', 'drop/fall 90', 'drop/fall 90']);
  });
});
