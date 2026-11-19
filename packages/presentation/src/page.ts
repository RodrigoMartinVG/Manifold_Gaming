import type * as THREE from 'three';
import type { Registry } from '@manifold/commands';
import type { Cartridge, Entity, Event, Session, World } from '@manifold/core';
import type { Match } from '@manifold/net';
import type { GameConsole } from './console';
import type { CosmeticPhysics } from './cosmetic';
import type { Scope } from './scope';
import type { EntityIndex } from './entities';
import type { LightPool } from './light-pool';
import type { Tier } from './quality';
import type { Look } from './stage';
import type { Mixer } from './mixer';
import type { Language, Say } from './words';
import type { Feel } from './feel';
import type { ParticleService } from './particle-service';

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
  /**
   * The ghosts (stage 5d, for a game without a console): the live player's strip since its world was
   * born, as text; and a strip to race, beside the player from the next world born (a level loaded),
   * or none.
   */
  readonly ghosts: { strip(): string; race(text: string | null): void };
  /** The console, if the game mounts one. */
  readonly console: GameConsole | null;
  /** The session being drawn (it changes on restart, a snapshot load, a replay, a join). */
  readonly session: Session;
  /** This page's player number. */
  readonly me: number;
  /** This page's player's character, if the world has one (an entity with `character`). */
  player(): Entity | undefined;
  /** The entities of the world drawn now by what they have (stage 5.5g, entities.ts): what a piece looks in, not the whole world. */
  readonly index: EntityIndex;
  /** The physics of what is only seen (stage 5.5g, cosmetic.ts): fragments, rubble, the falls. */
  readonly cosmetic: CosmeticPhysics;
  /** The page's particles (stage 5.5g, particle-service.ts): what adds light, what covers; spawned into, moved on by the page. */
  readonly particles: ParticleService;
  /** How its game's weapons and projectiles feel (stage 5.5g, feel.ts: the library gives it; none, every one plain). */
  readonly feel: Feel;
  /** A scope for a piece (stage 5.5g, scope.ts): what it adds through it is given back when the page stops. */
  scope(): Scope;
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

/** What moves the camera besides the camera piece, asked during a frame (stage 5.5g: `Stage.effects`). */
export interface CameraEffects {
  /** A move (in the world) this frame, times `weight`. */
  move(by: THREE.Vector3, weight?: number): void;
  /** A turn about one of the camera's own axes this frame (radians), times `weight`. */
  turn(axis: 'x' | 'y' | 'z', angle: number, weight?: number): void;
  /** The camera taken over this frame, at this pose: of those that ask, the highest `priority`. */
  take(position: THREE.Vector3, quaternion: THREE.Quaternion, priority: number): void;
  /** The same, from `from` looking at `to` (plain numbers: a game needs no three.js for it). */
  look(from: readonly [number, number, number], to: readonly [number, number, number], priority: number): void;
}

/** What the 3D is drawn with: the renderer, the scene and the camera (stage.ts). */
export interface Stage {
  /** The quality tier it draws at (stage 5.5g, quality.ts): what a frame may cost, and every knob that decides it. */
  readonly quality: Tier;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /**
   * The scene's real lights (stage 5.5a): pieces ask for the lights they would like each frame, and the
   * stage gives them out before drawing; their number is set when a world is born, never while playing.
   */
  readonly lights: LightPool;
  /** How much of the day's light there is (stage 3d): the world's ambient light, from 0 to 1. */
  daylight(amount: number): void;
  /**
   * The hour the sky shows (stage 5a: a level's `sky`), or none: a dome painted as `skyAt` says, the
   * lights colored and turned by it (as bright as `daylight` says). Without one, the flat background
   * of before, darkening with the ambient.
   */
  sky(hour: number | null): void;
  /**
   * THE ATMOSPHERE (stage 5j, decision 0031), for a game's page (a lab's stays as it is): with a sky,
   * fog of the horizon's color, nearer at night; a night that feels dark and stays readable (a cool
   * fill that does not go below a floor, a weak moonlight for silhouettes); tone mapping; and, unless
   * `glow` turns it off, a glow on what gives light and a vignette, over the finished image. A look as
   * data (stage 5.5g): `true` is the games' (`ATMOSPHERE`), a `Look` another, `false` none; the camera's
   * far plane and the sky's dome follow its fog (`farOf`).
   */
  atmosphere(on: boolean | Look): void;
  /** The glow over the finished image (stage 5j): a setting, for looks or for a slow machine. */
  glow(on: boolean): void;
  render(): void;
  /**
   * THE CAMERA'S EFFECTS, ONE PIPELINE (stage 5.5g, the audit's V8). The camera piece places the camera each
   * frame (its base pose); what moves it besides asks here during its frame, and the stage applies it once, as
   * it draws: a pose that takes it over (the highest priority wins: the tower's finale), or else every move
   * (the walk's sway), then every turn about its own axes, in the order they were asked (the sway's lean, a
   * blast's shake, a shot's kick), each times its weight. At the next frame's start the camera is back at its
   * base pose (`settle`). Before, each effect moved the camera and put it back its own way, in the order the
   * pieces happened to be listed.
   */
  readonly effects: CameraEffects;
  /** The camera back at its base pose, as the camera piece left it (the page calls it as a frame starts). */
  settle(): void;
  /**
   * THE PLACE'S LIGHT (stage 5.5g: what the dust and the smoke were each working out from the scene's lights
   * on every frame): the sky's fill (half its ground's colour), the sun and the moon, as one colour, for what
   * covers rather than shines. Worked out once a frame; the colour is the stage's, to be read, not kept.
   */
  placeLight(): THREE.Color;
  /**
   * What drawing costs the page itself (stage 4.5f): the milliseconds `render` took, averaged over the
   * last frames (the draw calls handed to the GPU, not the GPU's own time, which the page cannot see).
   */
  readonly renderMs: number;
  /**
   * What the last frame's scene cost the GPU (stage 3d's budgets): its draw calls and triangles, the
   * scene's own (stage 5j: not the passes over the finished image, which would hide what a level draws).
   */
  readonly drawn: { readonly calls: number; readonly triangles: number };
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
