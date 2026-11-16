import { describe, expect, test } from 'vitest';
import { dateIn, ENGINE_WORDS, languageOf, missingKeys, sayer, timeIn, type Words } from './words';

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

  test('how many: a whole sentence for each form the number takes, by the language (with two numbers, one inside the other)', () => {
    const game: Words = {
      es: {
        'g.left': { by: 0, '=0': 'No queda ninguna', one: 'Queda {0} estrella', other: 'Quedan {0} estrellas' },
        'g.both': {
          by: 0,
          one: { by: 1, one: '{0} caída, {1} estrella', other: '{0} caída, {1} estrellas' },
          other: { by: 1, one: '{0} caídas, {1} estrella', other: '{0} caídas, {1} estrellas' },
        },
      },
      en: {
        'g.left': { by: 0, '=0': 'None left', one: '{0} star left', other: '{0} stars left' },
        'g.both': { by: 0, other: 'falls: {0}, stars: {1}' },
        'g.only': { by: 0, one: 'one in English', other: '{0} in English' },
      },
    };
    const es = sayer([game], 'es');
    const en = sayer([game], 'en');
    expect([0, 1, 2, 12].map((n) => es('g.left', [n]))).toEqual([
      'No queda ninguna',
      'Queda 1 estrella',
      'Quedan 2 estrellas',
      'Quedan 12 estrellas',
    ]);
    expect([0, 1, 2].map((n) => en('g.left', [n]))).toEqual(['None left', '1 star left', '2 stars left']);
    expect(es('g.both', [1, 1])).toBe('1 caída, 1 estrella');
    expect(es('g.both', [1, 3])).toBe('1 caída, 3 estrellas');
    expect(es('g.both', [2, 1])).toBe('2 caídas, 1 estrella');
    expect(es('g.both', [0, 0])).toBe('0 caídas, 0 estrellas');
    // A form the language does not need: its `other`. And missing in Spanish: the English one, by English's forms.
    expect(en('g.both', [1, 1])).toBe('falls: 1, stars: 1');
    expect(es('g.only', [1])).toBe('one in English');
  });

  test('a day as the language writes it, not moved by the time zone', () => {
    expect(dateIn('es', '2026-11-16')).toBe('16 de noviembre de 2026');
    expect(dateIn('en', '2026-11-16')).toBe('November 16, 2026');
    expect(dateIn('es', '2027-01-01')).toBe('1 de enero de 2027');
    expect(dateIn('en', 'someday')).toBe('someday');
    const es = sayer([ENGINE_WORDS], 'es');
    expect(es('menu.saved', [dateIn('es', '2026-11-16')])).toBe('Partida guardada el 16 de noviembre de 2026');
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
