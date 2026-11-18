import type { CommandInfo, VariableInfo } from '@manifold/commands';
import { AUDIO_VARIABLES } from './audio';
import { HUD_VARIABLES } from './hud';
import { SUBTITLE_VARIABLES } from './subtitles';
import { BODIES_VARIABLES } from './bodies';
import { CAMERA_COMMANDS, CAMERA_VARIABLES } from './camera';
import { CONSOLE_COMMANDS } from './console';
import { DRIVE_COMMANDS, DRIVE_VARIABLES } from './drive';
import { SHAKE_VARIABLE } from './fire';
import { INSPECT_COMMANDS } from './inspect';
import { LIGHTS_VARIABLES } from './lights';
import { MATCH_COMMANDS, MATCH_VARIABLES } from './match';
import { NAV_COMMANDS, NAV_VARIABLES } from './nav';
import { REPLAY_COMMANDS } from './replays';
import { SIGNALS_COMMANDS, SIGNALS_VARIABLES } from './signals';
import { STATS_VARIABLES } from './stats';
import { VIEWS_VARIABLES } from './views';

/**
 * EVERYTHING THE PRESENTATION DECLARES, as data (stage 2.5a): the variables and commands of every
 * piece and of the console, without what they do. The pieces declare these same objects, with their
 * behavior; the site's console reference is generated from them, without mounting anything (a test
 * checks that the console of a mounted Dojo declares exactly what the reference lists).
 */
export const PRESENTATION_VARIABLES: readonly VariableInfo[] = [
  ...Object.values(STATS_VARIABLES),
  ...Object.values(BODIES_VARIABLES),
  ...Object.values(VIEWS_VARIABLES),
  ...Object.values(NAV_VARIABLES),
  ...Object.values(SIGNALS_VARIABLES),
  ...Object.values(LIGHTS_VARIABLES),
  ...Object.values(AUDIO_VARIABLES),
  ...Object.values(SUBTITLE_VARIABLES),
  ...Object.values(HUD_VARIABLES),
  ...Object.values(MATCH_VARIABLES),
  ...Object.values(DRIVE_VARIABLES),
  ...Object.values(CAMERA_VARIABLES),
  // (Stage 5i: every page has the weapons' feel. Not the glow of 5j, nor the music of 5b: only a game's
  // page with them declares them, and the Dojo's has neither.)
  SHAKE_VARIABLE,
];

export const PRESENTATION_COMMANDS: readonly CommandInfo[] = [
  ...Object.values(INSPECT_COMMANDS),
  ...Object.values(NAV_COMMANDS),
  ...Object.values(SIGNALS_COMMANDS),
  ...Object.values(DRIVE_COMMANDS),
  ...Object.values(MATCH_COMMANDS),
  ...Object.values(CAMERA_COMMANDS),
  ...Object.values(CONSOLE_COMMANDS),
  ...Object.values(REPLAY_COMMANDS),
];
