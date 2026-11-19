import { beforeAll } from 'vitest';
import { initPhysics } from '@manifold/core';
import { describeReferences } from '@manifold/shell/references';
import { TOWER_CARTRIDGE, TOWER_LEVEL_LIST } from './cartridge';
import { TOWER_REPLAYS } from './replays';

beforeAll(initPhysics);

/** Its reference replays (stage 5d): one for each floor, by its id. */
describeReferences(
  'the tower’s reference replays',
  TOWER_CARTRIDGE,
  TOWER_REPLAYS,
  TOWER_LEVEL_LIST.map((l) => l.id),
);
