import { beforeAll } from 'vitest';
import { initPhysics } from '@manifold/core';
import { describeReferences } from '@manifold/shell/references';
import { WALL_CARTRIDGE, WALL_LEVEL_LIST } from './cartridge';
import { WALL_REPLAYS } from './replays';

beforeAll(initPhysics);

/** Its reference replays (stage 5h): one for each level, by its file (`level-1`…). */
describeReferences(
  'the wall’s reference replays',
  WALL_CARTRIDGE,
  WALL_REPLAYS,
  WALL_LEVEL_LIST.map((_, i) => `level-${i + 1}`),
);
