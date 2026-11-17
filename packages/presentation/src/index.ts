export { mount, type Mount, type MountOptions, type InitialRecipe } from './client';
export { mountConsole, type GameConsole, type ConsoleOptions } from './console';
export type { Frame, GamePage, Piece, Stage } from './page';
export { GHOST_PREFIX, REPLAY_PREFIX, replayFromFragment, replayToFragment } from './replay-link';
export { openDialog, type DialogOptions } from './dialog';
export { mountHud, type Hud, type HudItem } from './hud';
export type { Tool, Tools } from './tools';
export { SETTINGS, type Setting } from './settings';
export {
  ENGINE_WORDS,
  LANGUAGES,
  dateIn,
  languageOf,
  missingKeys,
  numberIn,
  sayer,
  timeIn,
  type Language,
  type Phrase,
  type Plural,
  type Say,
  type WordTable,
  type Words,
} from './words';
