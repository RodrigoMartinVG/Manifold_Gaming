import { beforeAll } from 'vitest';
import { initPhysics } from '@manifold/core';
import { describeReferences } from '@manifold/shell/references';
import { DojoCartridge } from './cartridge';
import { REFERENCE_REPLAYS } from './replays';

beforeAll(initPhysics);

/** Its reference replays (stage 2.5a): one per phase (two for phase 3: its machines and its light; and 4.5, the citadel). */
describeReferences('the Dojo’s reference replays, as they are in their files', DojoCartridge, REFERENCE_REPLAYS, [
  'phase-0',
  'phase-1',
  'phase-2',
  'phase-3',
  'phase-3-light',
  'phase-4',
  'phase-4.5-citadel',
]);
