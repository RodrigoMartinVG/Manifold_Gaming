/**
 * THE GAME'S WORDS, a table per language: each key with its whole sentence, with numbered places
 * for the values ({0}, {1}; {0:1}, with one decimal). The world never reads this file: it tells a
 * key and its numbers, and the page says them here, in the player's language.
 */
export type Language = 'es' | 'en';

/**
 * A sentence that changes with one of its numbers (`by`: which one): a text for each plural form
 * the language has (Spanish and English: `one` and `other`), and one for exactly none, if it wants.
 */
interface Plural {
  by: number;
  none?: string;
  one?: string;
  other: string;
}
type Sentence = string | Plural;

export const WORDS: Record<Language, Record<string, Sentence>> = {
  es: {
    'hud.time': 'Tiempo',
    'hud.stars': 'Estrellas',
    'hud.of': '{0} de {1}',
    'hud.lap': 'Vuelta',
    // In Spanish the verb changes with the number ("queda 1", "quedan 3"); in English it does not.
    'notice.star': {
      by: 1,
      none: '¡La última! Ya están las {0}.',
      one: '¡Una estrella! Queda {1}.',
      other: '¡Una estrella! Quedan {1}.',
    },
    'notice.goal': '¡Vuelta completa en {0:1} s!',
    // Whole sentences, one for each sound and floor: not "Pasos" glued to "en madera".
    'sound.step.wood': 'Pasos en madera',
    'sound.step.metal': 'Pasos en metal',
    'sound.chime': 'Un tintineo',
    'sound.door': 'Una puerta',
  },
  en: {
    'hud.time': 'Time',
    'hud.stars': 'Stars',
    'hud.of': '{0} of {1}',
    'hud.lap': 'Lap',
    'notice.star': { by: 1, none: 'The last one! All {0} found.', other: 'A star! {1} left.' },
    'notice.goal': 'Lap done in {0:1} s!',
    'sound.step.wood': 'Steps on wood',
    'sound.step.metal': 'Steps on metal',
    'sound.chime': 'A chime',
    'sound.door': 'A door',
  },
};

/** The page's language (`<html lang>`): Spanish if it says so, English otherwise. */
export const languageOf = (): Language =>
  document.documentElement.lang.toLowerCase().startsWith('es') ? 'es' : 'en';

/** The keys one table has and the other lacks ("en: x": x is missing in English). A test asks for none. */
export function missingKeys(): string[] {
  const lacking = (a: Language, b: Language) =>
    Object.keys(WORDS[a])
      .filter((key) => !(key in WORDS[b]))
      .map((key) => `${b}: ${key}`);
  return [...lacking('es', 'en'), ...lacking('en', 'es')];
}

/** How a language says things: a key with its values, a number, a time. */
export function wordsIn(language: Language) {
  // NUMBERS AT THE EDGE: the world keeps 10.2667; here it becomes "10,3" or "10.3".
  const formats = new Map<number, Intl.NumberFormat>();
  const number = (n: number, decimals = -1) => {
    let format = formats.get(decimals);
    if (!format) {
      const fixed = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
      format = new Intl.NumberFormat(language, decimals < 0 ? {} : fixed);
      formats.set(decimals, format);
    }
    return format.format(n);
  };
  // PLURALS, as the language counts: "one" for 1, "other" for 2… (Spanish says "many" for a million,
  // and a sentence without that form uses "other"; Polish would need "few" and "many" here too).
  const plural = new Intl.PluralRules(language);
  /** A key's sentence (in English if this table lacks it, the key itself if none has it), with its values. */
  const say = (key: string, values: readonly number[] = []): string => {
    const sentence = WORDS[language][key] ?? WORDS.en[key];
    if (sentence === undefined) return key;
    let text: string;
    if (typeof sentence === 'string') text = sentence;
    else {
      const n = values[sentence.by] ?? 0;
      const form = plural.select(n);
      text = (n === 0 && sentence.none) || (form === 'one' && sentence.one) || sentence.other;
    }
    return text.replace(/\{(\d+)(?::(\d+))?\}/g, (_, i: string, decimals?: string) => {
      const v = values[Number(i)];
      return v === undefined ? '' : number(v, decimals === undefined ? -1 : Number(decimals));
    });
  };
  /** A time in minutes and seconds, to tenths ("1:05,3"): cut, not rounded, as a clock does. */
  const clock = new Intl.NumberFormat(language, {
    minimumIntegerDigits: 2,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const time = (seconds: number) => {
    const tenths = Math.floor(seconds * 10);
    return `${Math.floor(tenths / 600)}:${clock.format((tenths % 600) / 10)}`;
  };
  return { language, say, number, time };
}
