import { describe, expect, test } from 'vitest';
import { lampsToLight, MOST_LIGHTS, type DrawnLamp } from './lights';

const lamp = (id: number, x: number, radius = 4, intensity = 1): DrawnLamp => ({ id, at: [x, 2, 0], radius, intensity });
const everywhere = () => true;

describe('which lamps get a light (stage 4.5f)', () => {
  test('at most as many as there are lights, the nearest first: by how far the camera is from their reach', () => {
    const lamps = [lamp(1, 30), lamp(2, 10), lamp(3, 20), lamp(4, 50), lamp(5, 40)];
    expect(lampsToLight(lamps, [0, 2, 0], everywhere, 3).map((l) => l.id)).toEqual([2, 3, 1]);
    // A wide reach far away can be nearer than a small one close by: 3 m from the one, 4 from the other.
    expect(lampsToLight([lamp(1, 5, 1), lamp(2, 14, 11)], [0, 2, 0], everywhere, 1).map((l) => l.id)).toEqual([2]);
  });

  test('inside several reaches, the brighter first; a lamp that is off, or whose reach is out of view, gets none', () => {
    const lamps = [lamp(1, 1, 8, 0.5), lamp(2, 2, 8, 1), lamp(3, 0, 8, 0), lamp(4, 3, 8, 0.8)];
    const notFour = (l: DrawnLamp) => l.id !== 4;
    expect(lampsToLight(lamps, [0, 2, 0], everywhere, 6).map((l) => l.id)).toEqual([2, 4, 1]);
    expect(lampsToLight(lamps, [0, 2, 0], notFour, 6).map((l) => l.id)).toEqual([2, 1]);
  });

  test('the same choice for the same view, whatever order the lamps come in', () => {
    const lamps = Array.from({ length: 14 }, (_, i) => lamp(i + 1, (i * 7) % 23, 3 + (i % 4)));
    const once = lampsToLight(lamps, [4, 2, 0], everywhere, MOST_LIGHTS).map((l) => l.id);
    const again = lampsToLight([...lamps].reverse(), [4, 2, 0], everywhere, MOST_LIGHTS).map((l) => l.id);
    expect(again).toEqual(once);
    expect(once).toHaveLength(MOST_LIGHTS);
  });
});
