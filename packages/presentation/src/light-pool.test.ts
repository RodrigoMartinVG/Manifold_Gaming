import * as THREE from 'three';
import { describe, expect, test } from 'vitest';
import { chooseLights, createLightPool, KEEP, MOST_LIGHTS, type LightAsk } from './light-pool';

const lamp = (id: number, x: number, radius = 4, intensity = 1): LightAsk => ({
  key: `lamp:${id}`,
  at: [x, 2, 0],
  radius,
  intensity,
  color: 0xffd9a0,
  decay: 1,
  priority: 0,
});
const everywhere = () => true;
const none = new Set<string>();
const keys = (asks: LightAsk[]) => asks.map((a) => a.key);

describe('which lights are drawn (stage 4.5f; one pool for every light since 5.5a)', () => {
  test('at most as many as there are slots, the nearest first: by how far the camera is from their reach', () => {
    const lamps = [lamp(1, 30), lamp(2, 10), lamp(3, 20), lamp(4, 50), lamp(5, 40)];
    expect(keys(chooseLights(lamps, none, [0, 2, 0], everywhere, 3))).toEqual(['lamp:2', 'lamp:3', 'lamp:1']);
    // A wide reach far away can be nearer than a small one close by: 3 m from the one, 4 from the other.
    expect(keys(chooseLights([lamp(1, 5, 1), lamp(2, 14, 11)], none, [0, 2, 0], everywhere, 1))).toEqual(['lamp:2']);
  });

  test('inside several reaches, the brighter first; a lamp that is off, or whose reach is out of view, gets none', () => {
    const lamps = [lamp(1, 1, 8, 0.5), lamp(2, 2, 8, 1), lamp(3, 0, 8, 0), lamp(4, 3, 8, 0.8)];
    const notFour = (a: LightAsk) => a.key !== 'lamp:4';
    expect(keys(chooseLights(lamps, none, [0, 2, 0], everywhere, 6))).toEqual(['lamp:2', 'lamp:4', 'lamp:1']);
    expect(keys(chooseLights(lamps, none, [0, 2, 0], notFour, 6))).toEqual(['lamp:2', 'lamp:1']);
  });

  test('the same choice for the same view, whatever order the asks come in', () => {
    const lamps = Array.from({ length: 14 }, (_, i) => lamp(i + 1, (i * 7) % 23, 3 + (i % 4)));
    const once = keys(chooseLights(lamps, none, [4, 2, 0], everywhere, MOST_LIGHTS));
    expect(keys(chooseLights([...lamps].reverse(), none, [4, 2, 0], everywhere, MOST_LIGHTS))).toEqual(once);
    expect(once).toHaveLength(MOST_LIGHTS);
  });

  test('a flash before every lamp, however far; a lamp already lit keeps its light until another is KEEP m nearer', () => {
    const flash = { ...lamp(0, 40, 9, 12), key: 'flash', decay: 2, priority: 1 };
    expect(keys(chooseLights([lamp(1, 5), lamp(2, 6), flash], none, [0, 2, 0], everywhere, 2))).toEqual(['flash', 'lamp:1']);
    // Lamp 2 lit, lamp 1 a meter nearer: lamp 2 keeps it; KEEP m and more nearer, it goes to lamp 1.
    const lit = new Set(['lamp:2']);
    expect(keys(chooseLights([lamp(1, 10), lamp(2, 11)], lit, [0, 2, 0], everywhere, 1))).toEqual(['lamp:2']);
    expect(keys(chooseLights([lamp(1, 10), lamp(2, 10 + KEEP + 0.5)], lit, [0, 2, 0], everywhere, 1))).toEqual(['lamp:1']);
  });
});

describe('the light pool (stage 5.5a)', () => {
  /** A scene, a camera looking down −Z from the origin, and the pool; how many point lights the scene has. */
  function room() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 200);
    const pool = createLightPool(scene);
    const count = () => scene.children.filter((o) => o instanceof THREE.PointLight).length;
    const at = (id: number, z: number): LightAsk => ({ ...lamp(id, 0), at: [0, 0, z] });
    return { scene, camera, pool, count, at };
  }

  test('its size set when a world is born, the reserved slots in it, at most six; never changed by what is asked', () => {
    const { camera, pool, count, at } = room();
    pool.reserve('flash', 1);
    pool.resize(2);
    expect([pool.size, count()]).toEqual([3, 3]);
    // Eight lamps asked for (two made while playing, flares, among them): the same three lights.
    for (let frame = 0; frame < 5; frame++) {
      for (let i = 1; i <= 8; i++) pool.ask(at(i, -3 * i));
      pool.assign(camera);
      expect(count()).toBe(3);
    }
    expect(pool.lit).toEqual(['lamp:1', 'lamp:2', 'lamp:3']);
    pool.resize(14);
    expect([pool.size, count()]).toEqual([MOST_LIGHTS, MOST_LIGHTS]);
  });

  test('the flash takes a slot, and gives it back; what stays lit stays in its light', () => {
    const { camera, pool, scene, at } = room();
    pool.reserve('flash', 1);
    pool.resize(1);
    const lights = scene.children.filter((o): o is THREE.PointLight => o instanceof THREE.PointLight);
    pool.ask(at(1, -5));
    pool.assign(camera);
    expect(pool.lit).toEqual(['lamp:1', null]);
    pool.ask(at(1, -5));
    pool.ask({ ...at(0, -2), key: 'flash', priority: 1, decay: 2, intensity: 12, color: 0xffd08a });
    pool.assign(camera);
    expect(pool.lit).toEqual(['lamp:1', 'flash']);
    expect([lights[1]!.intensity, lights[1]!.decay, lights[1]!.color.getHex()]).toEqual([12, 2, 0xffd08a]);
    // Out: its slot dark, the lamp where it was.
    pool.ask(at(1, -5));
    pool.assign(camera);
    expect(pool.lit).toEqual(['lamp:1', null]);
    expect(lights[1]!.intensity).toBe(0);
  });

  test('what is behind the camera gets no light', () => {
    const { camera, pool, at } = room();
    pool.resize(2);
    pool.ask(at(1, 30));
    pool.ask(at(2, -6));
    pool.assign(camera);
    expect(pool.lit).toEqual(['lamp:2', null]);
  });
});
