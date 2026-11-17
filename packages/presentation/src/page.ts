import type * as THREE from 'three';
import type { Registry } from '@manifold/commands';
import type { Cartridge, Entity, Event, Session, World } from '@manifold/core';
import type { Match } from '@manifold/net';
import type { GameConsole } from './console';
import type { Mixer } from './mixer';
import type { Language, Say } from './words';

/**
 * THE PAGE A GAME IS MOUNTED IN (stage 2.5a): what every piece of the presentation shares. The
 * pieces (the bodies, the debug views, the camera, the match…) are modules of their own, each one
 * declaring what it lets people change; `mount` puts together the ones a game asks for.
 */
export interface GamePage {
  readonly cartridge: Cartridge;
  readonly registry: Registry<World>;
  /** The element it is mounted in (positioned: the overlays are drawn on top, inside it). */
  readonly container: HTMLElement;
  readonly stage: Stage;
  /** What is heard goes through it (stage 5b): the sounds' channel and the music's. */
  readonly mixer: Mixer;
  /** The console, if the game mounts one. */
  readonly console: GameConsole | null;
  /** The session being drawn (it changes on restart, a snapshot load, a replay, a join). */
  readonly session: Session;
  /** This page's player number. */
  readonly me: number;
  /** This page's player's character, if the world has one (an entity with `character`). */
  player(): Entity | undefined;
  /** Says something: in the console if there is one; if not, warnings and errors go to the browser's. */
  say(text: string, level?: 'info' | 'warn' | 'error'): void;
  /** The player's language (stage 3i, decision 0019: the page's). */
  readonly language: Language;
  /** What a key of the games' words says in it (the game's tables first, then the engine's). */
  words: Say;
  /** The same, in another language (the console's notices, in English). */
  wordsIn(language: Language): Say;
  /** The world created again, with the registry's current values (the menu's "start again"). */
  restart(): void;
  /**
   * The world created again from a recipe, as a room is loaded (stage 3k: a saved game is one): its
   * startup values, and what it does after its first step, also when it starts over.
   */
  load(recipe: string): void;
  /**
   * Takes the keys from the player's character while a panel is open (a menu, a dialogue box): call
   * what it returns to give them back. Several can hold them at once.
   */
  hold(): () => void;
  /** Whether a panel holds them now. */
  readonly held: boolean;
}

/** What the 3D is drawn with: the renderer, the scene and the camera (stage.ts). */
export interface Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** How much of the day's light there is (stage 3d): the world's ambient light, from 0 to 1. */
  daylight(amount: number): void;
  /**
   * The hour the sky shows (stage 5a: a level's `sky`), or none: a dome painted as `skyAt` says, the
   * lights colored and turned by it (as bright as `daylight` says). Without one, the flat background
   * of before, darkening with the ambient.
   */
  sky(hour: number | null): void;
  render(): void;
  /**
   * What drawing costs the page itself (stage 4.5f): the milliseconds `render` took, averaged over the
   * last frames (the draw calls handed to the GPU, not the GPU's own time, which the page cannot see).
   */
  readonly renderMs: number;
  stop(): void;
}

/** What a piece is told on every frame. */
export interface Frame {
  /** The frame's time (`requestAnimationFrame`'s), in milliseconds. */
  now: number;
  /** Seconds since the last frame. */
  dt: number;
  /** Where the drawing is between the last two steps (0: the previous one; 1: the last one). */
  alpha: number;
  world: World;
  /** This page's player's character, if there is one. */
  hero: Entity | undefined;
}

/**
 * A PIECE of the presentation: what it does at each moment of a frame, all optional. In a frame:
 *   1. `beforeSteps`: before the match takes its steps (what the player asks for);
 *   2. for each step this page's copy takes: `beforeStep`, in the order the pieces were put
 *      together, and `afterStep`, in the opposite order (like nested brackets);
 *   3. `event`: each event the world emitted;
 *   4. `frame`: in order, before drawing (the bodies, then what is drawn on them, the camera last);
 *   5. `afterRender`: after drawing.
 * And `welcome` when a new session comes, `stop` when the page is left.
 */
export interface Piece {
  beforeSteps?(f: Frame): void;
  beforeStep?(): void;
  afterStep?(): void;
  event?(ev: Event, world: World): void;
  frame?(f: Frame): void;
  afterRender?(f: Frame): void;
  welcome?(session: Session, match: Match): void;
  stop?(): void;
}

/** A hash as eight hexadecimal digits. */
export const hex = (n: number) => n.toString(16).padStart(8, '0');

/** A box of text over the game (the stats, what is watched, the notices), with its own style. */
export function overlay(container: HTMLElement, className: string, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const box = document.createElement('div');
  box.className = className;
  box.hidden = true;
  Object.assign(box.style, style);
  container.append(box);
  return box;
}
