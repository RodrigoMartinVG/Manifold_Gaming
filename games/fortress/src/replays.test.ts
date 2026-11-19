import { beforeAll } from 'vitest';
import { initPhysics } from '@manifold/core';
import { describeReferences } from '@manifold/shell/references';
import { FORTRESS_CARTRIDGE, FORTRESS_LEVEL_LIST } from './cartridge';
import { FORTRESS_REPLAYS } from './replays';

beforeAll(initPhysics);

/** Its reference replays (stage 5f; four since 5m): one for each level, by its file (`level-1`…). */
describeReferences(
  'the fortress’s reference replays',
  FORTRESS_CARTRIDGE,
  FORTRESS_REPLAYS,
  FORTRESS_LEVEL_LIST.map((_, i) => `level-${i + 1}`),
);
