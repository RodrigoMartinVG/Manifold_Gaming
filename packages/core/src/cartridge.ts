import type { Registry } from '@manifold/commands';
import type { InputAction } from './input';
import type { Profile } from './profile';
import type { KitPieces, ZoneKinds } from './level';
import type { Progress } from './saved';
import type { Damage, Entity, Event, PlayerInput } from './types';
import type { World } from './world';

/**
 * THE CONTRACT BETWEEN THE ENGINE AND A GAME (decision 0000: "mechanism and policy").
 *
 * The engine simulates; it does not know what is being played. A game (the Dojo is the first) is a
 * CARTRIDGE the engine receives: it says what is in the world at the start and what happenings
 * mean. The engine never imports a game (the compiler and the linter watch it: decision 0003).
 *
 * Stage 0: the minimum. It will grow with what games ask for (in V1 they needed: capabilities,
 * weapons, saving the game, travelling between levels, the ending, teams...), and every new thing
 * comes with its test and its tutorial lesson.
 */
/** The versions of a game's rules, by name (`{ tower: 1, kit: 1 }`). */
export type Versions = Readonly<Record<string, number>>;

export interface Cartridge {
  /** For addresses and replays: "dojo". */
  readonly id: string;
  readonly title: string;
  /**
   * THE VERSIONS OF ITS RULES (stage 5.5c, decision 0033), by name: its own and those of the library's
   * packages its rules use (`{ tower: 1, character: 1, kit: 1 }`), each going up when what it decides
   * changes what a replay gives. A replay carries them, and a game whose versions differ refuses it; the
   * engine's own is `SIMULATION_VERSION`. So one game's change re-writes only its own replays, not every
   * game's. Without it, none.
   */
  readonly versions?: Versions;
  /** Its kit of level pieces (stage 4.5e, decision 0026), if it has one: its levels' `kit` lines build with it. */
  readonly kit?: KitPieces;
  /**
   * Its variables and commands (decision 0010): what this game lets people change and do. Each
   * game decides what it exposes: the Dojo, everything; a competitive game, maybe nothing. Called
   * once per registry, before the world is created.
   */
  onDeclare?(registry: Registry<World>): void;
  /**
   * What its players can ask for, besides what the character reads (stage 1d): its own buttons, axes
   * and vectors, with its namespace (`dojo.throw`). The session lets in only what was declared; the
   * game reads them in `onStep` (`pressed`, `isDown`…), and says in the presentation which keys press them.
   */
  readonly inputs?: readonly InputAction[];
  /**
   * In a match (stage 1e): whether this player may change the world, from the console (world values
   * and actions, a restart, a snapshot, a replay). Without it, only player 1, who opened the match.
   * The Dojo, a lab, lets everybody. (Finer permissions: phase 6, decision 0010.)
   */
  mayChange?(player: number): boolean;
  /**
   * How its matches run (stage 2.5b, decision 0014): the physics its worlds run on, and who verifies
   * them. Without it, `VERIFIED`: Rapier's deterministic build, and a server that checks every copy.
   */
  readonly profile?: Profile;
  /**
   * The zones it understands, and what each one carries (stage 3b): its levels are read with them, and
   * so is a line the console adds (`add sensor …`, stage 3j).
   */
  readonly zones?: ZoneKinds;
  /**
   * What a saved game keeps (stage 3k, decision 0020): the player's progress, as the game's own
   * versioned data, and how to put it back. Without it, the game saves nothing.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly progress?: Progress<any>;
  /**
   * Once, with the freshly created world: put whatever there is at the start. STARTUP values (how
   * many cubes, which room) are read from the registry, which already has the recipes applied.
   */
  onStart(world: World, registry: Registry<World>): void;
  /**
   * On every step, BEFORE the engine's phases (stage 2.5b, see `PHASES`): what they will use at this
   * step. A bot decides what it asks for (phase 4), a mechanism where its platform goes (phase 3), a
   * wind what a character carries. The world changes and the players' inputs of this step are in.
   */
  beforeStep?(world: World): void;
  /** On every step, AFTER the engine's phases: the game's rules, with that step's events. */
  onStep?(world: World, events: readonly Event[]): void;
  /**
   * How much of a hit is taken (stage 4c, decision 0000's hook): every hit goes through it before it
   * takes points (`World.hurt`). Armor, a head that takes double, friendly fire: each game's policy.
   * Without it, all of it. (Only arithmetic of the game's own: it runs on every copy.)
   */
  filterDamage?(world: World, damage: Damage): number;
  /**
   * Its brains (stage 4e, decision 0023), by name: what a bot asks for at the next step, from the world
   * as it is after this one (read only) and its own memory, which it may change. A character with a
   * `brain` component names one. Run once, where the match is hosted (the page alone, the server,
   * a test's harness: `BotHost`), never by the copies or by a replay, which get its inputs: so a brain
   * may use any arithmetic, and changing one breaks no replay.
   */
  readonly brains?: Readonly<Record<string, Brain>>;
}

/** What a bot remembers between its thoughts (decision 0023): plain data, kept by the host, out of the hash. */
export type Memory = Record<string, unknown>;

/** A brain: the world after a step, the bot it thinks for (its character's entity), and its memory; what it asks for next. */
export type Brain = (world: World, self: Entity, memory: Memory) => PlayerInput;
