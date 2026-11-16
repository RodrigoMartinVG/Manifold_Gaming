/**
 * THE GAMES' WORDS (stage 3i, decision 0019): the world says what happened with keys and numbers
 * (`dojo.star`, 1, 2), and the page says it in the player's language, from tables like these: each key
 * with its sentence, with numbered places for the values (`{0}`, `{1}`; `{0:2}`, with two decimals). The engine has its own (the
 * menu, the settings, the subtitles); each game brings its own, its keys starting with its name.
 * Spanish and English, both complete: Spanish is this site's, English the console's (and the one to
 * fall back on).
 */
export type Language = 'es' | 'en';
export const LANGUAGES: readonly Language[] = ['es', 'en'];

/** One table: a sentence per key. */
export type WordTable = Readonly<Record<string, string>>;
/** A table per language, the same keys in each (a test asks for it). */
export type Words = Readonly<Record<Language, WordTable>>;

/** What the engine's own interface says. */
export const ENGINE_WORDS = {
  es: {
    'menu.title': 'Pausa',
    'menu.online': 'Menú: la partida sigue',
    'menu.resume': 'Seguir',
    'menu.settings': 'Ajustes',
    'menu.restart': 'Empezar de nuevo',
    'menu.back': 'Volver',
    'menu.hint': 'Esc o P: pausa y ajustes',
    'settings.title': 'Ajustes',
    'settings.volume': 'Volumen',
    'settings.mouse': 'Sensibilidad del mouse',
    'settings.stick': 'Sensibilidad del stick',
    'settings.invert': 'Invertir el eje vertical',
    'settings.subtitles': 'Subtítulos de los sonidos',
    'settings.calm': 'Menos movimiento de la cámara',
    'settings.saved': 'Se guardan en este navegador.',
    'sound.step': 'Pasos',
    'sound.land': 'Un aterrizaje',
    'sound.hit': 'Un golpe',
    'sound.door': 'Una puerta',
    'sound.lift': 'Un ascensor',
    'sound.break': 'Algo se rompe',
    'surface.stone': 'en piedra',
    'surface.wood': 'en madera',
    'surface.metal': 'en metal',
    'surface.glass': 'en vidrio',
    'surface.ice': 'en hielo',
  },
  en: {
    'menu.title': 'Paused',
    'menu.online': 'Menu: the match goes on',
    'menu.resume': 'Resume',
    'menu.settings': 'Settings',
    'menu.restart': 'Start again',
    'menu.back': 'Back',
    'menu.hint': 'Esc or P: pause and settings',
    'settings.title': 'Settings',
    'settings.volume': 'Volume',
    'settings.mouse': 'Mouse sensitivity',
    'settings.stick': 'Stick sensitivity',
    'settings.invert': 'Invert the vertical axis',
    'settings.subtitles': 'Subtitles for sounds',
    'settings.calm': 'Less camera motion',
    'settings.saved': 'They are kept in this browser.',
    'sound.step': 'Steps',
    'sound.land': 'A landing',
    'sound.hit': 'A hit',
    'sound.door': 'A door',
    'sound.lift': 'A lift',
    'sound.break': 'Something breaks',
    'surface.stone': 'on stone',
    'surface.wood': 'on wood',
    'surface.metal': 'on metal',
    'surface.glass': 'on glass',
    'surface.ice': 'on ice',
  },
} as const satisfies Words;

/** The page's language (`<html lang>`): Spanish if it says so, English otherwise. */
export function languageOf(doc: Document = document): Language {
  return doc.documentElement.lang.toLowerCase().startsWith('es') ? 'es' : 'en';
}

/** A number as a language writes it: "12,5" in Spanish, "12.5" in English. */
export function numberIn(language: Language, n: number, decimals = 0): string {
  const text = n.toFixed(decimals);
  return language === 'es' ? text.replace('.', ',') : text;
}

/** A time in minutes and seconds, to tenths: "1:05,3" in Spanish. */
export function timeIn(language: Language, seconds: number): string {
  const tenths = Math.floor(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = numberIn(language, (tenths - minutes * 600) / 10, 1);
  return `${minutes}:${rest.padStart(4, '0')}`;
}

/** A value for a sentence: a number as the language writes it (with the decimals asked for, or as it came), or text. */
const valueIn = (language: Language, v: number | string, decimals?: number) =>
  typeof v !== 'number'
    ? v
    : numberIn(language, v, decimals ?? (Number.isInteger(v) ? 0 : Math.min(6, String(v).split('.')[1]?.length ?? 0)));

/** What says a key: its sentence, with its values in their places. */
export type Say = (key: string, values?: readonly (number | string)[]) => string;

/**
 * What says a key in a language, from tables (the first that has it wins: a game's before the
 * engine's); in English if that language does not have it, and the key itself if no table does (a
 * test asks that none is missing).
 */
export function sayer(tables: readonly Words[], language: Language): Say {
  return (key, values = []) => {
    const found =
      tables.map((t) => t[language][key]).find((s) => s !== undefined) ??
      tables.map((t) => t.en[key]).find((s) => s !== undefined);
    if (found === undefined) return key;
    return found.replace(/\{(\d+)(?::(\d+))?\}/g, (_, i: string, decimals?: string) => {
      const v = values[Number(i)];
      return v === undefined ? '' : valueIn(language, v, decimals === undefined ? undefined : Number(decimals));
    });
  };
}

/** The keys one table has and the other does not, both ways ("es: x" is in Spanish only). */
export function missingKeys(words: Words): string[] {
  const out: string[] = [];
  for (const a of LANGUAGES)
    for (const b of LANGUAGES)
      if (a !== b) for (const key of Object.keys(words[a])) if (!(key in words[b])) out.push(`${a}: ${key}`);
  return out;
}
