import { declareHelp, type Message, type Registry } from '@manifold/commands';
import { registryFor, type Cartridge, type Session, type World } from '@manifold/core';
import { mountBodies } from './bodies';
import { mountCamera } from './camera';
import { mountConsole, type ConsoleOptions, type GameConsole } from './console';
import { mountDrive } from './drive';
import { mountInspect } from './inspect';
import { loadModels } from './models';
import { createMatch } from './match';
import { mountNotices } from './notices';
import type { Frame, GamePage, Piece } from './page';
import { mountPlayerControls, type GameButton } from './player';
import { mountProbe } from './probe';
import { mountReplays } from './replays';
import { createStage } from './stage';
import { mountStats } from './stats';
import { mountAudio } from './audio';
import { mountDebris } from './debris';
import { mountLights } from './lights';
import { mountSignals } from './signals';
import { mountViews } from './views';
import { mountHud, type Hud } from './hud';
import { mountMenu } from './menu';
import { mountSettings } from './settings';
import { mountSubtitles } from './subtitles';
import { ENGINE_WORDS, languageOf, sayer, type Words } from './words';

/** A recipe to start with, and where it comes from (for the warnings: "the link's recipe…"). */
export interface InitialRecipe {
  from: string;
  text: string;
}

export interface MountOptions {
  /**
   * The recipes the world is born with, in order (the room's, the link's…): the GAME gathers them,
   * because it knows where they come from (decision 0010). The presentation does not read the address.
   */
  recipes?: readonly InitialRecipe[];
  /** Whether the game mounts the console, and how. Each game decides (decision 0010). */
  console?: ConsoleOptions | false;
  /**
   * The camera. `orbit` is a lab's: dragging turns around the scene, the wheel (or a pinch) gets
   * closer, a click on an object inspects it in the console, and with a character it goes with it
   * (`view.camera`). `fixed` (the default) does not move.
   */
  camera?: 'orbit' | 'fixed';
  /** A replay to play when the world is born (its text): the world is born like it, and at the end it is checked. */
  replay?: string;
  /** A replay to race (its text): it runs as a ghost, next to the live player. */
  ghost?: string;
  /** The keys of the game's own buttons (stage 1d): the game declares the actions, and says what presses them. */
  buttons?: readonly GameButton[];
  /**
   * Pieces of the game's own (stage 2.5a: phase 3's interface, phase 4's first person…), put
   * together after the engine's, with the same page: they declare what they let people change, and
   * take part in every frame (see `Piece`).
   */
  pieces?: readonly ((page: GamePage) => Piece)[];
  /**
   * The game's models (stage 2e), by the name an appearance gives (`model`): where each glTF file is.
   * An appearance that names one is drawn with it, once it loaded.
   */
  models?: Readonly<Record<string, string>>;
  /**
   * The game's words (stage 3i, decision 0019): its notices, its HUD, its dialogue, in Spanish and in
   * English, by keys that start with its name. The page says them in its language.
   */
  words?: Words;
  /** What the game's HUD shows (stage 3i), read from the world on every frame. */
  hud?: Hud;
}

export interface Mount {
  readonly registry: Registry<World>;
  /** The current session (it changes on restart). */
  readonly session: Session;
  readonly console: GameConsole | null;
  /** Creates the world again, with the registry's current values. */
  restart(): void;
  /** Stops drawing and frees the GPU (when leaving the page, or in tests). */
  stop(): void;
}

/**
 * THE CLIENT: mounts a cartridge in an element of the page and makes it run, putting together the
 * pieces of the presentation (stage 2.5a: before, one function of 1,300 lines did it all). Each piece
 * is a module that declares what it lets people change and takes part in every frame (page.ts):
 *
 *   - the stage (the renderer, the scene, the camera's lens), and the match (match.ts: even alone,
 *     through a server in this page), which every piece leans on;
 *   - the bodies (bodies.ts: a mesh for each entity, drawn between steps), the debug views (views.ts),
 *     the replays and ghosts (replays.ts), the stats (stats.ts), the game's notices (notices.ts),
 *     looking inside the world (inspect.ts), the camera (camera.ts), driving the character
 *     (drive.ts), and what the browser tests read (probe.ts); then the game's own (`pieces`).
 *
 * On every screen frame:
 *   1. what the player asks for is sent to the match;
 *   2. the match's clock says how many fixed steps are due (V1's step 1: the simulation does not
 *      depend on FPS); its server takes them, and this page's copy takes the same, with what the
 *      server says entered at each one (the pieces are told before and after each step);
 *   3. the pieces read the events the world emitted (bodies created, removed, the game's notices);
 *   4. every thing is drawn between its previous pose and the current one, by `alpha`.
 *
 * The presentation READS the world and never writes it: what is seen is a consequence of the
 * simulation, not the other way round. What can be changed in the view is declared by each piece
 * (`show.*`, `view.*`), and the game decides whether to mount a console to touch it (decision 0010).
 *
 * `container` must be positioned (`position` fixed, absolute or relative): the overlays are drawn on
 * top, inside it. And the physics must be ready first (`await initPhysics()`, from the core): it
 * loads asynchronously, and every world has its own.
 */
export function mount(cartridge: Cartridge, container: HTMLElement, o: MountOptions = {}): Mount {
  const registry = registryFor(cartridge);
  const stage = createStage(container);
  const pieces: Piece[] = [];
  let gameConsole: GameConsole | null = null;
  const say = (text: string, level: 'info' | 'warn' | 'error' = 'info') =>
    gameConsole ? gameConsole.write(text, level) : level !== 'info' && console.warn(text);
  // The games' words (decision 0019): the game's tables first, then the engine's, in the page's language.
  const language = languageOf();
  const tables = o.words ? [o.words, ENGINE_WORDS] : [ENGINE_WORDS];
  const words = sayer(tables, language);
  /** How many panels hold the keys now (a menu, a dialogue box). */
  let holding = 0;

  // Around each step this page's copy takes: the pieces before, in order; after, in the opposite order.
  const match = createMatch({
    cartridge,
    registry,
    container,
    say,
    hooks: {
      before: () => pieces.forEach((p) => p.beforeStep?.()),
      after: () => [...pieces].reverse().forEach((p) => p.afterStep?.()),
    },
    welcome(session, m) {
      session.world.takeEvents(); // the world is already there: what it emitted until now is not news
      for (const p of pieces) p.welcome?.(session, m);
    },
  });
  const page: GamePage = {
    cartridge,
    registry,
    container,
    stage,
    get console() {
      return gameConsole;
    },
    get session() {
      return match.session;
    },
    get me() {
      return match.me;
    },
    player: () => [...match.session.world.entities.values()].find((e) => e.character?.player === match.me),
    say,
    language,
    words,
    wordsIn: (l) => sayer(tables, l),
    restart: () => match.restart(),
    hold() {
      holding++;
      let given = false;
      return () => {
        if (!given) holding--;
        given = true;
      };
    },
    get held() {
      return holding > 0;
    },
  };

  // The console, if the game mounts it.
  gameConsole = o.console ? mountConsole(container, registry, o.console, { restart: () => match.restart() }) : null;
  if (gameConsole) declareHelp(registry, { examples: o.console ? o.console.examples : undefined });

  // The pieces, in the order they draw (the bodies first, what is drawn on them after, the camera last).
  const playerControls = mountPlayerControls({ blocked: () => (gameConsole?.isOpen ?? false) || page.held, buttons: o.buttons });
  const bodies = mountBodies(page, loadModels(o.models), { timeScale: () => (match.paused ? 0 : match.timescale) });
  const replays = mountReplays(page, match, bodies);
  const rig = mountCamera(page, bodies, match, {
    kind: o.camera ?? 'fixed',
    stick: () => playerControls.cameraStick(),
    replaying: () => replays.playing,
  });
  pieces.push(
    bodies,
    mountViews(page, bodies),
    mountSignals(page, bodies),
    mountLights(page, bodies),
    mountDebris(page, { timeScale: () => (match.paused ? 0 : match.timescale) }),
    mountAudio(page),
    mountSubtitles(page),
    replays,
    mountStats(page, match),
    mountNotices(page),
    mountInspect(page, bodies, { click: o.camera === 'orbit', clickTaken: () => rig.takesClick() }),
    rig,
    mountDrive(page, match, rig, { controls: playerControls, buttons: o.buttons, replaying: () => replays.playing }),
    mountProbe(page, match),
    ...(o.hud ? [mountHud(page, o.hud)] : []),
    mountMenu(page, match, { blocked: () => gameConsole?.isOpen ?? false }),
    ...(o.pieces ?? []).map((make) => make(page)),
  );
  // The player's settings (stage 3i), once every piece declared its variables: before any recipe.
  pieces.push(mountSettings(page));

  // The recipes the world is born with (the startup one, if there is a console; then the game's). Their
  // view values are only kept, until every piece exists (below).
  const startup = gameConsole?.startupRecipe();
  const recipes = [...(startup ? [{ from: 'your startup recipe', text: startup }] : []), ...(o.recipes ?? [])];
  for (const recipe of recipes) warn(recipe.from, registry.run(recipe.text, 'recipe'));

  function warn(from: string, messages: Message[]) {
    const errors = messages.filter((m) => m.level === 'error');
    if (!errors.length) return;
    const title = `${from}: ${errors.length === 1 ? 'one line was not understood' : `${errors.length} lines were not understood`}`;
    if (gameConsole) {
      gameConsole.write(title, 'warn');
      for (const e of errors) gameConsole.write(`  ${e.text}`, 'warn');
    } else console.warn([title, ...errors.map((e) => e.text)].join('\n'));
  }

  // The match is born with the recipes' values, and its first session comes to every piece.
  match.start();
  // From now on, changing a startup value (from the console) makes the world start over.
  registry.onStartupChange = () => match.restart();
  // A replay or a ghost that came with the page (the game gathered them, from its link).
  replays.fromPage({ replay: o.replay, ghost: o.ghost });
  // Every piece of the view exists: the view values the recipes brought are applied now (until here
  // the registry only kept them), and from now on every change is applied right away.
  registry.applyToView();

  let last = performance.now();
  let request = 0;
  const frame = (now: number) => {
    request = requestAnimationFrame(frame);
    const dt = (now - last) / 1000;
    last = now;
    const before: Frame = { now, dt, alpha: 1, world: match.session.world, hero: page.player() };
    for (const p of pieces) p.beforeSteps?.(before);
    match.advance(dt);
    const world = match.session.world;
    for (const ev of world.takeEvents()) for (const p of pieces) p.event?.(ev, world);
    const f: Frame = { now, dt, alpha: match.alpha, world, hero: page.player() };
    for (const p of pieces) p.frame?.(f);
    stage.render();
    for (const p of pieces) p.afterRender?.(f);
  };
  request = requestAnimationFrame(frame);

  return {
    registry,
    get session() {
      return match.session;
    },
    console: gameConsole,
    restart: () => match.restart(),
    stop() {
      cancelAnimationFrame(request);
      gameConsole?.stop();
      playerControls.stop();
      for (const p of pieces) p.stop?.();
      match.stop();
      stage.stop();
    },
  };
}
