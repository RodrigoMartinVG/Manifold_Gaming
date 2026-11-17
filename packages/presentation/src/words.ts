/**
 * THE GAMES' WORDS (stage 3i, decision 0019): the world says what happened with keys and numbers
 * (`dojo.star`, 1, 2), and the page says it in the player's language, from tables like these: each key
 * with its sentence, with numbered places for the values (`{0}`, `{1}`; `{0:2}`, with two decimals). The engine has its own (the
 * menu, the settings, the subtitles); each game brings its own, its keys starting with its name.
 * Spanish and English, both complete: Spanish is this site's, English the console's (and the one to
 * fall back on).
 *
 * A sentence that says how many (`{0} estrellas`) is written whole for each form the number takes
 * (`Plural`): "1 estrella" and "3 estrellas" are two sentences, not one with an ending added. Which
 * form, the language says (`Intl.PluralRules`: Spanish and English have one and other; others have
 * more); with two numbers, the forms of one hold those of the other.
 */
export type Language = 'es' | 'en';
export const LANGUAGES: readonly Language[] = ['es', 'en'];

/**
 * A sentence, or (`Plural`) one for each form of the number in its place `by`: the form the language
 * gives that number (`one`, `few`, `many`, `other`…), or a number of its own (`=0`: "no queda
 * ninguna"); `other` when the language's is not there.
 */
export type Phrase = string | Plural;
export interface Plural {
  readonly by: number;
  readonly zero?: Phrase;
  readonly one?: Phrase;
  readonly two?: Phrase;
  readonly few?: Phrase;
  readonly many?: Phrase;
  readonly other: Phrase;
  readonly [exactly: `=${number}`]: Phrase | undefined;
}

/** One table: a sentence per key. */
export type WordTable = Readonly<Record<string, Phrase>>;
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
    'menu.save': 'Guardar la partida',
    'menu.load': 'Cargar la partida',
    'menu.saved': 'Partida guardada el {0}',
    'menu.nothing': 'No hay una partida guardada',
    'menu.unreadable': 'Esa partida no se puede cargar',
    'settings.title': 'Ajustes',
    'settings.volume': 'Volumen',
    'settings.mouse': 'Sensibilidad del mouse',
    'settings.stick': 'Sensibilidad del stick',
    'settings.invert': 'Invertir el eje vertical',
    'settings.subtitles': 'Subtítulos de los sonidos',
    'settings.calm': 'Menos movimiento de la cámara',
    'settings.fov': 'Campo de visión (grados, de arriba abajo)',
    'settings.crosshair': 'Mira al apuntar',
    'settings.saved': 'Se guardan en este navegador.',
    'touch.needs':
      'Este juego se juega con teclado y mouse, o con un gamepad: en un teléfono, conectá uno. Mientras, podés mirar: arrastrá para girar la cámara.',
    'touch.look': 'Mirar igual',
    'sound.step': 'Pasos',
    'sound.land': 'Un aterrizaje',
    'sound.hit': 'Un golpe',
    'sound.door': 'Una puerta',
    'sound.lift': 'Un ascensor',
    'sound.break': 'Algo se rompe',
    'sound.blast': 'Una explosión',
    'story.objective': 'Objetivo: {0}',
    'sound.step.stone': 'Pasos en piedra',
    'sound.step.wood': 'Pasos en madera',
    'sound.step.metal': 'Pasos en metal',
    'sound.step.glass': 'Pasos en vidrio',
    'sound.step.ice': 'Pasos en hielo',
    'sound.land.stone': 'Un aterrizaje en piedra',
    'sound.land.wood': 'Un aterrizaje en madera',
    'sound.land.metal': 'Un aterrizaje en metal',
    'sound.land.glass': 'Un aterrizaje en vidrio',
    'sound.land.ice': 'Un aterrizaje en hielo',
    'sound.hit.stone': 'Un golpe contra piedra',
    'sound.hit.wood': 'Un golpe contra madera',
    'sound.hit.metal': 'Un golpe contra metal',
    'sound.hit.glass': 'Un golpe contra vidrio',
    'sound.hit.ice': 'Un golpe contra hielo',
  },
  en: {
    'menu.title': 'Paused',
    'menu.online': 'Menu: the match goes on',
    'menu.resume': 'Resume',
    'menu.settings': 'Settings',
    'menu.restart': 'Start again',
    'menu.back': 'Back',
    'menu.hint': 'Esc or P: pause and settings',
    'menu.save': 'Save the game',
    'menu.load': 'Load the game',
    'menu.saved': 'Game saved on {0}',
    'menu.nothing': 'There is no saved game',
    'menu.unreadable': 'That game cannot be loaded',
    'settings.title': 'Settings',
    'settings.volume': 'Volume',
    'settings.mouse': 'Mouse sensitivity',
    'settings.stick': 'Stick sensitivity',
    'settings.invert': 'Invert the vertical axis',
    'settings.subtitles': 'Subtitles for sounds',
    'settings.calm': 'Less camera motion',
    'settings.fov': 'Field of view (degrees, top to bottom)',
    'settings.crosshair': 'Crosshair while aiming',
    'settings.saved': 'They are kept in this browser.',
    'touch.needs':
      'This game is played with a keyboard and a mouse, or a gamepad: on a phone, connect one. Meanwhile you can look around: drag to turn the camera.',
    'touch.look': 'Look anyway',
    'sound.step': 'Steps',
    'sound.land': 'A landing',
    'sound.hit': 'A hit',
    'sound.door': 'A door',
    'sound.lift': 'A lift',
    'sound.break': 'Something breaks',
    'sound.blast': 'An explosion',
    'story.objective': 'Objective: {0}',
    'sound.step.stone': 'Steps on stone',
    'sound.step.wood': 'Steps on wood',
    'sound.step.metal': 'Steps on metal',
    'sound.step.glass': 'Steps on glass',
    'sound.step.ice': 'Steps on ice',
    'sound.land.stone': 'A landing on stone',
    'sound.land.wood': 'A landing on wood',
    'sound.land.metal': 'A landing on metal',
    'sound.land.glass': 'A landing on glass',
    'sound.land.ice': 'A landing on ice',
    'sound.hit.stone': 'A hit against stone',
    'sound.hit.wood': 'A hit against wood',
    'sound.hit.metal': 'A hit against metal',
    'sound.hit.glass': 'A hit against glass',
    'sound.hit.ice': 'A hit against ice',
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

/**
 * A day ("2026-11-16", as a saved game keeps it) as the language writes it: "16 de noviembre de 2026",
 * "November 16, 2026". (As it is, a day: not moved by the player's time zone.) Anything else, as it came.
 */
export function dateIn(language: Language, day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  const at = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(at);
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
    const inLanguage = tables.map((t) => t[language][key]).find((s) => s !== undefined);
    const found = inLanguage ?? tables.map((t) => t.en[key]).find((s) => s !== undefined);
    if (found === undefined) return key;
    const sentence = formOf(found, values, inLanguage === undefined ? 'en' : language);
    return sentence.replace(/\{(\d+)(?::(\d+))?\}/g, (_, i: string, decimals?: string) => {
      const v = values[Number(i)];
      return v === undefined ? '' : valueIn(language, v, decimals === undefined ? undefined : Number(decimals));
    });
  };
}

/** The sentence of a phrase for these values: down its forms, by the numbers they ask for, in the language it is written in. */
function formOf(phrase: Phrase, values: readonly (number | string)[], language: Language): string {
  const rules = new Intl.PluralRules(language);
  let p = phrase;
  while (typeof p !== 'string') {
    const n = Number(values[p.by]);
    p = (Number.isFinite(n) ? (p[`=${n}`] ?? p[rules.select(n)]) : undefined) ?? p.other;
  }
  return p;
}

/** The keys one table has and the other does not, both ways ("es: x" is in Spanish only). */
export function missingKeys(words: Words): string[] {
  const out: string[] = [];
  for (const a of LANGUAGES)
    for (const b of LANGUAGES)
      if (a !== b) for (const key of Object.keys(words[a])) if (!(key in words[b])) out.push(`${a}: ${key}`);
  return out;
}
