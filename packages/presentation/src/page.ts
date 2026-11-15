import type * as THREE from 'three';
import type { Registry } from '@manifold/commands';
import type { Cartridge, Entity, Event, Session, World } from '@manifold/core';
import type { Match } from '@manifold/net';
import type { GameConsole } from './console';

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
}

/** What the 3D is drawn with: the renderer, the scene and the camera (stage.ts). */
export interface Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** How much of the day's light there is (stage 3d): the world's ambient light, from 0 to 1. */
  daylight(amount: number): void;
  render(): void;
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
