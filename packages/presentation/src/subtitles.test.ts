import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import type { Vec3 } from '@manifold/common';
import { arrowFor, firedText, subtitleText } from './subtitles';
import { ENGINE_WORDS, sayer } from './words';

/** A camera at `from` looking at `to`, as the presentation's: its matrix's elements. */
function camera(from: Vec3, to: Vec3) {
  const c = new THREE.PerspectiveCamera();
  c.position.set(...from);
  c.lookAt(...to);
  c.updateMatrixWorld();
  return c.matrixWorld.elements;
}

describe('subtitles for sounds (stage 3i)', () => {
  test('a whole sentence for each sound and what it was on; a surface without words, or no surface, the sound alone', () => {
    const es = sayer([ENGINE_WORDS], 'es');
    const en = sayer([ENGINE_WORDS], 'en');
    expect(subtitleText(es, 'step', 'metal')).toBe('Pasos en metal');
    expect(subtitleText(es, 'step', null)).toBe('Pasos en piedra');
    expect(subtitleText(es, 'hit', 'wood')).toBe('Un golpe contra madera');
    expect(subtitleText(en, 'land', 'ice')).toBe('A landing on ice');
    expect(subtitleText(es, 'step', 'oil')).toBe('Pasos');
    expect(subtitleText(es, 'door', 'wood')).toBe('Una puerta');
    expect(subtitleText(en, 'break', null)).toBe('Something breaks');
  });

  test('(stage 5g) a weapon used, by its kind; what is thrown, without words of its own', () => {
    const es = sayer([ENGINE_WORDS], 'es');
    const en = sayer([ENGINE_WORDS], 'en');
    expect(firedText(es, 'shotgun')).toBe('Un escopetazo');
    expect(firedText(en, 'launcher')).toBe('A rocket');
    expect(firedText(es, 'grenade')).toBe('Algo que se tira');
  });

  test('the arrow: where it came from around the camera, along the ground, also with the camera looking down', () => {
    const up: Vec3 = [0, 1, 0];
    // Level, looking along −Z: ahead, to the right, behind, to the left.
    const level = camera([0, 1.6, 0], [0, 1.6, -1]);
    expect(arrowFor([0, 0, -5], level, up)).toBe('↑');
    expect(arrowFor([5, 0, 0], level, up)).toBe('→');
    expect(arrowFor([0, 0, 5], level, up)).toBe('↓');
    expect(arrowFor([-5, -1, 0], level, up)).toBe('←');
    expect(arrowFor([3, 0, -3], level, up)).toBe('↗');
    // Looking down 60° at a character ahead: a step behind the camera and below it came from behind
    // (with its forward not laid on the ground, it came out ahead).
    const down = camera([0, 5, 3], [0, 0, 0]);
    expect(arrowFor([0, -5, 1], down, up)).toBe('↓');
    expect(arrowFor([0, -5, -1], down, up)).toBe('↑');
    expect(arrowFor([2, -5, 0], down, up)).toBe('→');
    // Straight down: ahead is where the top of the screen points.
    const top = new THREE.PerspectiveCamera();
    top.position.set(0, 10, 0);
    top.up.set(0, 0, -1);
    top.lookAt(0, 0, 0);
    top.updateMatrixWorld();
    expect(arrowFor([0, -10, -3], top.matrixWorld.elements, up)).toBe('↑');
    expect(arrowFor([3, -10, 0], top.matrixWorld.elements, up)).toBe('→');
  });
});
