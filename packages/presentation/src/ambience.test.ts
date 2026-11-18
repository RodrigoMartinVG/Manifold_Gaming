import { describe, expect, test } from 'vitest';
import { ambienceAt } from './ambience';
import { nightOf } from './stage';

/** The background sounds by the hour, and how much it is night (stage 5j, decision 0031). */
describe('the atmosphere, as numbers', () => {
  test('without a sky, only a little wind', () => {
    expect(ambienceAt(null)).toEqual({ wind: 0.15, crickets: 0, birds: 0, owl: 0 });
  });

  test('the tower’s dusk has birds, the fortress’s night crickets and an owl, the wall’s dawn birds again', () => {
    expect(ambienceAt(18)).toMatchObject({ birds: 1, crickets: 0, owl: 0 });
    expect(ambienceAt(22)).toMatchObject({ birds: 0, crickets: 1, owl: 1 });
    expect(ambienceAt(6.5)).toMatchObject({ birds: 1, crickets: 0 });
    expect(ambienceAt(12)).toMatchObject({ birds: 0, crickets: 0, owl: 0 });
    // Round midnight, the night's layers hold.
    expect(ambienceAt(0)).toMatchObject({ crickets: 1, owl: 1 });
    expect(ambienceAt(24)).toEqual(ambienceAt(0));
  });

  test('the crickets come in over an hour and a half, before the night', () => {
    expect(ambienceAt(19.25).crickets).toBeCloseTo(0.5, 5);
    expect(ambienceAt(18.5).crickets).toBe(0);
  });

  test('how much it is night: none with the sun up, all with it 15 degrees below', () => {
    expect(nightOf(0.1)).toBe(0);
    expect(nightOf(-0.1)).toBeCloseTo(0.4, 5);
    expect(nightOf(-0.25)).toBe(1);
    expect(nightOf(-1)).toBe(1);
  });
});
