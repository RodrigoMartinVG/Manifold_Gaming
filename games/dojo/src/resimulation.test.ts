import { beforeAll, describe, expect, test } from 'vitest';
import { initPhysics, replayFromText, resimulateOwn } from '@manifold/core';
import { DojoCartridge } from './cartridge';
import { REFERENCE_REPLAYS } from './replays';

beforeAll(initPhysics);

/**
 * ONE'S OWN CHARACTER, RE-SIMULATED AS DECISION 0016 WILL (stage 5.5c, the harness's first cases): in windows
 * of 30 steps across a reference replay, one's own character goes back to where it was, the others are put
 * where the recording had them (their own simulation, given nothing to ask for, goes elsewhere), and it must
 * end every step as recorded. What carries or stops it has to be a function of the step or in the state.
 */
describe('one’s own character, re-simulated with the others where the recording had them (decision 0016)', () => {
  test('phase 1: with a second player who comes, moves and goes (its simulation overwritten every step)', () => {
    const windows = resimulateOwn(DojoCartridge, replayFromText(REFERENCE_REPLAYS['phase-1']!), 1, { window: 30, every: 45 });
    expect(windows.length).toBeGreaterThan(10);
    expect(windows.filter((w) => w.differs)).toEqual([]);
  });

  test('phase 2: on the platforms that carry it (the ferry, functions of the step) and the carousel (Rapier’s turn)', () => {
    const windows = resimulateOwn(DojoCartridge, replayFromText(REFERENCE_REPLAYS['phase-2']!), 1, { window: 30, every: 60 });
    expect(windows.length).toBeGreaterThan(20);
    expect(windows.filter((w) => w.differs)).toEqual([]);
  });
});
