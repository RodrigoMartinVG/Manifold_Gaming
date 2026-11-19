import { declareHelp, type Message, type Registry, type Waiting } from '@manifold/commands';
import { registryFor, type Cartridge, type Session, type World } from '@manifold/core';
import { mountBodies } from './bodies';
import { mountCamera } from './camera';
import { mountConsole, type ConsoleOptions, type GameConsole } from './console';
import { mountDrive } from './drive';
import { mountInspect } from './inspect';
import { mountNav } from './nav';
import { mountHurt } from './hurt';
import { mountStory } from './story';
import { createAssets } from './assets';
import { loadModels } from './models';
import { createMatch } from './match';
import { mountNotices } from './notices';
import type { Frame, GamePage, Piece } from './page';
import { createCosmeticPhysics } from './cosmetic';
import { createScope, type Scope } from './scope';
import { createEntityIndex } from './entities';
import { pieceCaller } from './pieces';
import { mountPlayerControls, type GameButton } from './player';
import { mountProbe } from './probe';
import { mountReplays } from './replays';
import { createStage, GLOW_VARIABLE, type Look } from './stage';
import { mountStats } from './stats';
import { mountAmbience } from './ambience';
import { mountAudio } from './audio';
import { createMixer } from './mixer';
import { mountDebris } from './debris';
import { mountContact } from './contact';
import { mountFire } from './fire';
import { mountSway } from './sway';
import { mountLights } from './lights';
import { mountSignals } from './signals';
import { mountViews } from './views';
import { mountHud, type Hud } from './hud';
import { mountMenu } from './menu';
import { mountSettings } from './settings';
import { mountSubtitles } from './subtitles';
import { mountTouchNotice } from './touch';
import type { Tools } from './tools';
import { ENGINE_WORDS, languageOf, sayer, type Words } from './words';
import { NO_FEEL, type Feel } from './feel';
import { createParticleService } from './particle-service';

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
  /** (Stage 5j) A game's atmosphere: fog, a readable night, tone mapping, glow (stage.ts), and the background sounds. */
  atmosphere?: boolean | Look;
  /**
   * Where the Basis transcoder is served (stage 5.5g: three's `basis_transcoder.js` and `.wasm`), for models
   * with KTX2 textures; without it, a model that has them does not load.
   */
  ktx2?: string;
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
  /**
   * What each character carries in its hands, as the game says (stage 4c: tools.ts): drawn along its
   * aim, its arms brought to it. The world keeps it in the game's own component; the view asks here.
   */
  tools?: Tools;
  /** How the game's weapons and projectiles feel (stage 5.5g, feel.ts): the arms library's `ARMS_FEEL`, for a game that uses it. */
  feel?: Feel;
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
  const mixer = createMixer();
  const pieces: Piece[] = [];
  // The physics of what is only seen (stage 5.5g: cosmetic.ts), one for the page.
  const cosmetic = createCosmeticPhysics();
  // The page's particles (stage 5.5g: particle-service.ts), one pair for every piece.
  const particles = createParticleService(stage);
  // The pieces' scopes (stage 5.5g: scope.ts), ended when the page stops.
  const scopes: Scope[] = [];
  // The entities by what they have, and this page's player (stage 5.5g: entities.ts), of the world drawn now.
  const index = createEntityIndex(
    () => match.session.world,
    () => match.driving ?? match.me,
  );
  let gameConsole: GameConsole | null = null;
  const say = (text: string, level: 'info' | 'warn' | 'error' = 'info') =>
    gameConsole ? gameConsole.write(text, level) : level !== 'info' && console.warn(text);
  // Every piece called on its own (stage 5.5a): one that throws is told once, and the frame goes on.
  const pieceCalls = pieceCaller(pieces, (text, error) => {
    console.error(error);
    say(text, 'warn');
  });
  // The games' words (decision 0019): the game's tables first, then the engine's, in the page's language.
  const language = languageOf();
  const tables = o.words ? [o.words, ENGINE_WORDS] : [ENGINE_WORDS];
  const words = sayer(tables, language);
  /** How many panels hold the keys now (a menu, a dialogue box). */
  let holding = 0;

  /**
   * What the room does after its first step (stage 3j: the lines after a recipe's `wait`): done again
   * when the world starts over (the menu, `restart`), not when a startup value changes (another room).
   */
  let roomWaits: Waiting[] = [];
  // Around each step this page's copy takes: the pieces before, in order; after, in the opposite order;
  // then the recipe lines that waited for it (stage 3j).
  const match = createMatch({
    cartridge,
    registry,
    container,
    say,
    hooks: {
      before: () => pieceCalls.call('beforeStep'),
      after: () => {
        pieceCalls.callReversed('afterStep');
        registry.stepped();
      },
    },
    beforeRestart: () => {
      registry.forgetWaiting();
      registry.queue(roomWaits);
    },
    welcome(session, m) {
      session.world.takeEvents(); // the world is already there: what it emitted until now is not news
      particles.clear();
      pieceCalls.call('welcome', session, m);
      // (After the pieces let go of the last world's: the physics of what is only seen, made for this one now.)
      cosmetic.ready(session.world);
    },
  });
  const page: GamePage = {
    cartridge,
    registry,
    container,
    stage,
    mixer,
    // (The replays piece is made below, with the page: by then it is there.)
    ghosts: { strip: () => replays.strip(), race: (text) => replays.race(text) },
    get console() {
      return gameConsole;
    },
    get session() {
      return match.session;
    },
    get me() {
      return match.me;
    },
    // (Driving a bot, stage 4e: that one, and the camera goes with it.)
    player: () => index.hero(),
    index,
    cosmetic,
    feel: o.feel ?? NO_FEEL,
    particles,
    scope() {
      const scope = createScope();
      scopes.push(scope);
      return scope;
    },
    say,
    language,
    words,
    wordsIn: (l) => sayer(tables, l),
    restart: () => match.restart(),
    load(recipe) {
      const onStartupChange = registry.onStartupChange;
      registry.onStartupChange = null;
      registry.forgetWaiting();
      warn('the recipe', registry.run(recipe, 'recipe'));
      registry.onStartupChange = onStartupChange;
      roomWaits = registry.waits();
      match.restart();
    },
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
  // (A room the console loads: what it does after its first step is the room's now.)
  gameConsole = o.console
    ? mountConsole(container, registry, o.console, {
        restart: () => {
          roomWaits = registry.waits();
          match.restart();
        },
      })
    : null;
  if (gameConsole) declareHelp(registry, { examples: o.console ? o.console.examples : undefined });

  // The pieces, in the order they draw (the bodies first, what is drawn on them after, the camera last).
  const playerControls = mountPlayerControls({ blocked: () => (gameConsole?.isOpen ?? false) || page.held, buttons: o.buttons });
  // (Stage 5.5g) The page's assets: each file loaded once for every page, counted, freed when no page uses it.
  const models = loadModels(
    o.models,
    stage.quality,
    createAssets({ renderer: stage.renderer, ...(o.ktx2 ? { ktx2: o.ktx2 } : {}) }),
  );
  const bodies = mountBodies(page, models, {
    timeScale: () => (match.paused ? 0 : match.timescale),
    ...(o.tools ? { tools: o.tools } : {}),
  });
  const replays = mountReplays(page, match, bodies);
  const rig = mountCamera(page, bodies, match, {
    kind: o.camera ?? 'fixed',
    stick: () => playerControls.cameraStick(),
    replaying: () => replays.playing,
  });
  pieces.push(
    bodies,
    mountViews(page, bodies),
    mountNav(page),
    mountStory(page),
    mountHurt(page),
    mountSignals(page, bodies),
    mountLights(page, bodies),
    mountDebris(page, { timeScale: () => (match.paused ? 0 : match.timescale) }),
    // (Stage 5p) Dust where feet strike or leave the ground, and off a wall slid down.
    mountContact(page, { timeScale: () => (match.paused ? 0 : match.timescale) }),
    mountAudio(page),
    mountSubtitles(page),
    mountTouchNotice(page),
    replays,
    mountStats(page, match),
    mountNotices(page),
    mountInspect(page, bodies, { click: o.camera === 'orbit', clickTaken: () => rig.takesClick() }),
    rig,
    // (Stage 5k) After the camera: the walk's sway moves the eyes the rig placed, before the kick and the shake.
    mountSway(page, bodies),
    // (Stage 5g) After the camera: its kick turns the camera as the rig placed it.
    mountFire(page, bodies, { timeScale: () => (match.paused ? 0 : match.timescale) }),
    mountDrive(page, match, rig, { controls: playerControls, buttons: o.buttons, replaying: () => replays.playing }),
    mountProbe(page, match),
    ...(o.hud ? [mountHud(page, o.hud)] : []),
    mountMenu(page, match, { blocked: () => gameConsole?.isOpen ?? false }),
    ...(o.atmosphere ? [mountAmbience(page)] : []),
    ...(o.pieces ?? []).map((make) => make(page)),
  );
  if (o.atmosphere) {
    stage.atmosphere(o.atmosphere);
    page.registry.declareVariable({ ...GLOW_VARIABLE, onChange: (v) => stage.glow(v === true) });
  }
  // The player's settings (stage 3i), once every piece declared its variables: before any recipe.
  pieces.push(mountSettings(page));

  // The recipes the world is born with (the startup one, if there is a console; then the game's). Their
  // view values are only kept, until every piece exists (below).
  const startup = gameConsole?.startupRecipe();
  const recipes = [...(startup ? [{ from: 'your startup recipe', text: startup }] : []), ...(o.recipes ?? [])];
  for (const recipe of recipes) warn(recipe.from, registry.run(recipe.text, 'recipe'));
  roomWaits = registry.waits();
  // What the lines that waited say when they run (stage 3j: a check, an error): in the console.
  registry.onLater = (messages) => {
    if (gameConsole) for (const m of messages) gameConsole.write(m.text, m.level);
    else for (const m of messages.filter((x) => x.level === 'error')) console.warn(m.text);
  };

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
  // From now on, changing a startup value (from the console) makes the world start over: another
  // room, which does not do what the one before did after its first step.
  registry.onStartupChange = () => {
    roomWaits = [];
    match.restart();
  };
  // A replay or a ghost that came with the page (the game gathered them, from its link).
  replays.fromPage({ replay: o.replay, ghost: o.ghost });
  // Every piece of the view exists: the view values the recipes brought are applied now (until here
  // the registry only kept them), and from now on every change is applied right away.
  registry.applyToView();

  let last = performance.now();
  let request = 0;
  const frame = (now: number) => {
    request = requestAnimationFrame(frame);
    // The camera back at its base pose: the effects of the last frame were for it alone (stage 5.5g).
    stage.settle();
    const dt = (now - last) / 1000;
    last = now;
    const before: Frame = { now, dt, alpha: 1, world: match.session.world, hero: page.player() };
    pieceCalls.call('beforeSteps', before);
    match.advance(dt);
    const world = match.session.world;
    for (const ev of world.takeEvents()) {
      if (ev.type === 'entityCreated') index.made(ev.id);
      else if (ev.type === 'entityRemoved') index.gone(ev.id);
      pieceCalls.call('event', ev, world);
    }
    const f: Frame = { now, dt, alpha: match.alpha, world, hero: page.player() };
    pieceCalls.call('frame', f);
    // (At the world's pace, as the debris: paused, they hold; at half speed, half as fast.)
    particles.update(dt * (match.paused ? 0 : match.timescale));
    stage.render();
    pieceCalls.call('afterRender', f);
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
      pieceCalls.call('stop');
      for (const scope of scopes.splice(0)) scope.end();
      models.release();
      cosmetic.dispose();
      particles.dispose();
      mixer.stop();
      match.stop();
      stage.stop();
    },
  };
}
