import { describe, expect, test } from 'vitest';
import { ENGINE_WORDS, languageOf, missingKeys, sayer, timeIn, type Words } from './words';

describe("the games' words (stage 3i, decision 0019)", () => {
  test("the engine's tables have the same keys in Spanish and in English", () => {
    expect(missingKeys(ENGINE_WORDS)).toEqual([]);
    expect(missingKeys({ es: { a: 'x', b: 'y' }, en: { a: 'x', c: 'z' } })).toEqual(['es: b', 'en: c']);
  });

  test("a key in the page's language, with its values in their places, as the language writes numbers", () => {
    const game: Words = {
      es: { 'g.star': 'Una estrella: {0} de {1}', 'g.time': '{0:2} s', 'g.only': 'solo en español' },
      en: { 'g.star': 'A star: {0} of {1}', 'g.time': '{0:2} s', 'g.only': 'only in English' },
    };
    const es = sayer([game, ENGINE_WORDS], 'es');
    const en = sayer([game, ENGINE_WORDS], 'en');
    expect(es('g.star', [1, 3])).toBe('Una estrella: 1 de 3');
    expect(en('g.star', [1, 3])).toBe('A star: 1 of 3');
    // With the decimals the sentence asks for, and the comma in Spanish.
    expect(es('g.time', [12.3456])).toBe('12,35 s');
    expect(en('g.time', [12.3])).toBe('12.30 s');
    // The game's tables first, then the engine's.
    expect(es('menu.resume')).toBe('Seguir');
    // Missing in a language: in English; in none: the key itself (a test asks that none is missing).
    expect(sayer([{ es: {}, en: { 'g.x': 'x' } }], 'es')('g.x')).toBe('x');
    expect(es('g.nothing')).toBe('g.nothing');
  });

  test('a time in minutes and seconds, to tenths', () => {
    expect(timeIn('es', 5.27)).toBe('0:05,2');
    expect(timeIn('en', 65.3)).toBe('1:05.3');
    expect(timeIn('es', 600)).toBe('10:00,0');
  });

  test("the page's language: Spanish if it says so, English otherwise", () => {
    const page = (lang: string) => ({ documentElement: { lang } }) as unknown as Document;
    expect(languageOf(page('es'))).toBe('es');
    expect(languageOf(page('es-AR'))).toBe('es');
    expect(languageOf(page('en'))).toBe('en');
    expect(languageOf(page(''))).toBe('en');
  });
});
