import { describe, expect, test } from 'vitest';
import { skyAt, sunDirection, sunElevation, SUNRISE, SUNSET } from './sky';

describe('the sky at an hour (stage 5a)', () => {
  test('the sun: up between sunrise and sunset and down the rest, highest at the middle of the day, lowest at the middle of the night', () => {
    for (let h = 0; h < 24; h += 0.25) {
      const up = h > SUNRISE && h < SUNSET;
      expect(sunElevation(h) > 0, `at ${h}`).toBe(up);
    }
    expect(sunElevation(SUNRISE)).toBeCloseTo(0, 9);
    expect(sunElevation(SUNSET)).toBeCloseTo(0, 9);
    expect(sunElevation((SUNRISE + SUNSET) / 2)).toBeCloseTo(62, 9);
    expect(sunElevation((SUNSET + SUNRISE + 24) / 2)).toBeCloseTo(-34, 9);
  });

  test('it rises in the east, is south at the middle of the day and sets in the west (up +Y, north −Z, east +X)', () => {
    expect(sunDirection(SUNRISE)[0]).toBeGreaterThan(0.9);
    expect(sunDirection((SUNRISE + SUNSET) / 2)[2]).toBeGreaterThan(0.4);
    expect(sunDirection((SUNRISE + SUNSET) / 2)[0]).toBeCloseTo(0, 9);
    expect(sunDirection(SUNSET)[0]).toBeLessThan(-0.9);
    for (let h = 0; h < 24; h += 1.5) {
      const [x, y, z] = sunDirection(h);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    }
  });

  test('a day and a night: at noon the light from the sun and no stars; at midnight from the moon, pale blue, and all the stars', () => {
    const noon = skyAt(13);
    expect(noon.key).toEqual({ from: noon.sun, color: noon.key.color, share: 1 });
    expect([noon.moonGlow, noon.stars]).toEqual([0, 0]);
    const midnight = skyAt(0);
    expect(midnight.key.from).toEqual(midnight.moon);
    expect(midnight.key.share).toBe(1);
    expect(midnight.key.color[2]).toBe(1);
    expect(midnight.key.color[0]).toBeLessThan(0.8);
    expect([midnight.sunGlow, midnight.moonGlow, midnight.stars]).toEqual([0, 1, 1]);
    expect(midnight.moon[1]).toBeGreaterThan(0.5);
    // Hues, as bright at every hour: how lit the world is, is the level's ambient.
    for (const h of [0, 6, 13, 19.5, 21]) expect(Math.max(...skyAt(h).fill)).toBe(1);
    // A day's sky is blue up and light at the horizon; a night's, dark.
    expect(noon.zenith[2]).toBeGreaterThan(noon.zenith[0]);
    expect(Math.max(...midnight.zenith)).toBeLessThan(0.1);
  });

  test('the citadel’s hour, 19.5: the sun on the horizon in the west, a warm horizon under a darkening blue, its glow still out', () => {
    const dusk = skyAt(19.5);
    expect(Math.abs(sunElevation(19.5))).toBeLessThan(2);
    expect(dusk.sun[0]).toBeLessThan(-0.9);
    expect(dusk.horizon[0]).toBeGreaterThan(dusk.horizon[2]);
    expect(dusk.zenith[2]).toBeGreaterThan(dusk.zenith[0]);
    expect(dusk.sunGlow).toBeGreaterThan(0.5);
    // Its light still the sun's, low from the west and warm, almost all of its share.
    expect(dusk.key.from).toEqual(dusk.sun);
    expect(dusk.key.share).toBeGreaterThan(0.8);
    expect(dusk.key.color[0]).toBe(1);
    expect(dusk.key.color[2]).toBeLessThan(0.5);
  });

  test('the light changes from the sun to the moon in the middle of the twilight, with no share there', () => {
    let least = 1;
    for (let h = SUNSET; h < SUNSET + 2; h += 0.01) least = Math.min(least, skyAt(h).key.share);
    expect(least).toBeLessThan(0.02);
    expect(skyAt(SUNSET + 2).key.from).toEqual(skyAt(SUNSET + 2).moon);
  });

  test('no jumps: a hundredth of an hour (36 s) changes nothing by more than 4% anywhere in the day, and 24 is 0', () => {
    let worst = 0;
    for (let h = 0; h < 24; h += 0.01) {
      const a = skyAt(h);
      const b = skyAt(h + 0.01);
      for (const k of ['zenith', 'horizon', 'ground', 'fill', 'sunColor'] as const)
        for (let i = 0; i < 3; i++) worst = Math.max(worst, Math.abs(a[k][i]! - b[k][i]!));
      // The light, as it lights: its hue by its share (its hue changes where its share is 0).
      for (let i = 0; i < 3; i++)
        worst = Math.max(worst, Math.abs(a.key.color[i]! * a.key.share - b.key.color[i]! * b.key.share));
      worst = Math.max(worst, Math.abs(a.stars - b.stars), Math.abs(a.sunGlow - b.sunGlow), Math.abs(a.moonGlow - b.moonGlow));
    }
    // (The fastest: the light's share, from all of it to none in about 25 minutes after sunset.)
    expect(worst).toBeLessThan(0.04);
    expect(skyAt(24)).toEqual(skyAt(0));
    expect(skyAt(-4.5).hour).toBe(19.5);
  });
});
