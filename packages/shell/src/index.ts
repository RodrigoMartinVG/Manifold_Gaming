import { formatValue, recipeFromLink } from '@manifold/commands';
import { ghostFromText, initPhysics, registryFor, type Cartridge, type Entity, type World } from '@manifold/core';
import {
  GHOST_PREFIX,
  mount,
  mountMusic,
  openDialog,
  replayFromFragment,
  replayToFragment,
  storage,
  timeIn,
  type GameButton,
  type GamePage,
  type Hud,
  type InitialRecipe,
  type Mount,
  type Piece,
  type Theme,
  type Tools,
  type Words,
} from '@manifold/presentation';
import { creditsFrom, ENGINE_CREDITS, type AssetList } from './credits';
import { finished, progressFrom, type LevelResult, type Progress } from './progress';
import { SHELL_WORDS } from './words';

export { creditsFrom, ENGINE_CREDITS, type AssetEntry, type AssetList, type CreditLine } from './credits';
export { finished, NEW_PROGRESS, PROGRESS_VERSION, progressFrom, type LevelResult, type Progress } from './progress';
export { SHELL_WORDS } from './words';

/**
 * A level of a game: its id (what its progress is kept by), the recipe that builds it, its name (a key
 * of its words), and its gold time (s, stage 5d: shown when it is done, the challenge apart).
 */
export interface GameLevel {
  id: string;
  recipe: string;
  name: string;
  gold?: number;
}

/** A line of the thread (3i's dialogue): who says it and what, keys of the game's words. */
export interface Line {
  who: string;
  say: string;
}

/**
 * A GAME, AS THE SHELL TAKES IT (stage 5b): its rules (the cartridge), its levels in order and when
 * one is done, its words, the thread's few lines at its beginning and its end, the asset lists of what
 * it draws, and its music. The shell does the rest: its title, the way through its levels, what each
 * one took kept in the browser, its credits.
 */
export interface Game {
  /** What its progress is kept under in the browser (`manifold.<id>`). */
  id: string;
  cartridge: Cartridge;
  /** Its words, in Spanish and English (decision 0019), with every key below. */
  words: Words;
  /** Its title and the line under it on the title screen (keys). */
  title: string;
  tagline: string;
  levels: readonly GameLevel[];
  /** Whether the level being played is done, and how it went: read from the world on every frame. */
  done(world: World, hero: Entity | undefined): LevelResult | null;
  thread: { opening: readonly Line[]; ending: readonly Line[] };
  /** The asset lists of every file it draws (decision 0015): its credits come from them. */
  credits: readonly AssetList[];
  music?: Theme;
  models?: Readonly<Record<string, string>>;
  hud?: Hud;
  buttons?: readonly GameButton[];
  tools?: Tools;
}

/** The game's words with the shell's: the game's first (it may say a shell key its own way). */
const wordsOf = (game: Game): Words => ({
  es: { ...SHELL_WORDS.es, ...game.words.es },
  en: { ...SHELL_WORDS.en, ...game.words.en },
});

/**
 * THE WAY THROUGH A GAME (stage 5b), a piece of its page. On the title (the level it would play next
 * behind it, still): play, or go on where it was, or start again, and its credits. Playing from the
 * beginning, the thread's first lines; then each level, and as one is done (the game says when), what
 * it took and its best, kept; the next; after the last, the thread's last lines, and the credits. For
 * the browser tests: `data-dialog` (the panel open, by its title), `data-level` (the level playing,
 * by its id) and `data-progress` (what is kept, as it is kept).
 *
 * And (stage 5d) the challenge apart: each level's gold time, shown when it is done; and its ghost, as
 * a link to share from that panel. Opened with one (`#ghost=`), the title offers to race it on its
 * level (what it keeps is the best, but no level is opened by it). A link's recipe (`#recipe=`) runs
 * after each level's, for the tests and for whoever makes it (`data-ghost-link`: the link made).
 */
function campaign(
  game: Game,
  start: Progress,
  o: { link?: string; race?: { text: string; level: number } },
): (page: GamePage) => Piece {
  return (page) => {
    const kept = storage(`manifold.${game.id}`);
    const ids = game.levels.map((l) => l.id);
    let progress = start;
    /** The level playing (an index of `game.levels`), or none while on the title. */
    let playing: number | null = null;
    /** Whether its end was taken (so it is taken once; a new world, from the menu's "start again", takes it again). */
    let ended = false;
    /** Whether the level playing is raced against someone's ghost (from a link). */
    let racing = false;
    const keep = () => {
      kept.write('progress', progress);
      page.container.dataset.progress = JSON.stringify(progress);
    };
    const say = page.words;
    const paused = (on: boolean) => page.registry.run(`view.paused ${on ? 'on' : 'off'}`, 'recipe');

    /** Lines one after another, each a box with who says it (a key or a click goes on), and then `then`. */
    const lines = (all: readonly Line[], then: () => void) => {
      const [first, ...rest] = all;
      if (!first) return then();
      openDialog(page, {
        title: say(first.who),
        lines: [say(first.say)],
        buttons: [{ label: say('shell.next'), then: () => lines(rest, then) }],
      });
    };
    const credits = (back: () => void) => {
      const lines = [
        say('shell.credits.made'),
        ...creditsFrom(game.credits).map((c) =>
          c.made === 'script'
            ? say('shell.credits.script', [c.file, c.by])
            : say('shell.credits.outside', [c.file, c.author, c.source, c.license]),
        ),
        say('shell.credits.sound'),
        ...ENGINE_CREDITS.map((e) => say(`shell.credits.${e.what}`, [e.name, e.license])),
      ];
      openDialog(page, { title: say('shell.credits'), lines, buttons: [{ label: say('shell.back'), then: back }] });
    };
    const play = (index: number, race: string | null = null) => {
      playing = index;
      ended = false;
      racing = race !== null;
      page.ghosts.race(race);
      page.container.dataset.level = game.levels[index]!.id;
      const recipe = game.levels[index]!.recipe;
      page.load(o.link ? `${recipe}\n${o.link}` : recipe);
      paused(false);
    };
    /** The level's ghost as a link (`#ghost=`), shown, and copied if the browser lets. */
    const share = async (then: () => void) => {
      const link = `${location.origin}${location.pathname}#${await replayToFragment(page.ghosts.strip(), GHOST_PREFIX)}`;
      page.container.dataset.ghostLink = link;
      let copied = false;
      try {
        await navigator.clipboard.writeText(link);
        copied = true;
      } catch {
        // (Not allowed: it is there to copy by hand.)
      }
      openDialog(page, {
        title: say('shell.shared'),
        lines: [say(copied ? 'shell.copied' : 'shell.copy'), link],
        buttons: [{ label: say('shell.next'), then }],
      });
    };
    const title = () => {
      playing = null;
      delete page.container.dataset.level;
      paused(true);
      const next = Math.min(progress.reached, game.levels.length - 1);
      const raceButton = o.race
        ? [{ label: say('shell.race', [say(game.levels[o.race.level]!.name)]), then: () => play(o.race!.level, o.race!.text) }]
        : [];
      const buttons = [
        ...raceButton,
        ...(progress.started && progress.reached > 0 && progress.reached < game.levels.length
          ? [
              { label: say('shell.continue', [say(game.levels[next]!.name)]), then: () => play(next) },
              { label: say('shell.again'), then: begin },
            ]
          : [{ label: say('shell.play'), then: begin }]),
      ];
      openDialog(page, {
        title: say(game.title),
        lines: [say(game.tagline)],
        buttons: [...buttons, { label: say('shell.credits'), then: () => credits(title) }],
        // (Escape does not leave the title: there is nowhere to go back to.)
        escape: 0,
      });
    };
    const begin = () => {
      progress = { ...progress, started: true };
      keep();
      lines(game.thread.opening, () => play(0));
    };
    const done = (result: LevelResult) => {
      const level = game.levels[playing!]!;
      progress = finished(progress, ids, level.id, result, { open: !racing });
      keep();
      const last = playing === game.levels.length - 1;
      const time = (steps: number) => timeIn(page.language, steps / 60);
      const best = progress.best[level.id]!;
      // On: the next level (after the last, the end); raced from a link, the title.
      const on = () => (racing ? title() : last ? lines(game.thread.ending, () => credits(title)) : play(playing! + 1));
      const panel = () =>
        openDialog(page, {
          title: say('shell.done', [say(level.name)]),
          lines: [
            say('shell.time', [time(result.steps)]),
            ...(best.steps < result.steps ? [say('shell.best', [time(best.steps)])] : []),
            ...(level.gold === undefined
              ? []
              : [
                  say('shell.gold', [timeIn(page.language, level.gold)]),
                  ...(result.steps / 60 <= level.gold ? [say('shell.golden')] : []),
                ]),
            say('shell.stars', [String(result.stars)]),
            say('shell.falls', [String(result.falls)]),
          ],
          buttons: [
            { label: say('shell.next'), then: on },
            { label: say('shell.share'), then: () => void share(on) },
          ],
          escape: 0,
        });
      panel();
    };

    page.container.dataset.progress = JSON.stringify(progress);
    // The title once the page is up (its first frame: the level behind it is there to be seen).
    let shown = false;
    return {
      welcome() {
        // A new world (the menu's "start again", a level loaded): its end is to be taken again.
        ended = false;
      },
      frame({ world }) {
        if (!shown) {
          shown = true;
          title();
          return;
        }
        if (playing === null || ended) return;
        const result = game.done(world, page.player());
        if (!result) return;
        ended = true;
        done(result);
      },
    };
  };
}

/**
 * STARTS A GAME (stage 5b) inside `container` (the site's `/jugar/<game>/`): its progress read from
 * the browser, its title over the level it would play next, its music if it has one. A finished game
 * has no console (decision 0010: each game decides); a link may still bring a recipe
 * (`#recipe=...`), run after the level's, for the tests and for whoever makes it.
 */
export async function startGame(container: HTMLElement, game: Game): Promise<Mount> {
  await initPhysics();
  const progress = progressFrom(storage(`manifold.${game.id}`).read('progress'));
  const next = game.levels[Math.min(progress.reached, game.levels.length - 1)]!;
  const recipes: InitialRecipe[] = [{ from: 'the level', text: next.recipe }];
  const fromLink = recipeFromLink(location.hash);
  if (fromLink) recipes.push({ from: "the link's recipe", text: fromLink });
  // A ghost to race (stage 5d), on the level its strip was born in: the one whose own birth (the values
  // its recipe changes) is in the strip's, the most of it (the first level, with every value as it
  // comes, has none, and is the one when no other is).
  const ghostText = await replayFromFragment(location.hash, GHOST_PREFIX);
  let race: { text: string; level: number } | undefined;
  if (ghostText) {
    try {
      const born = new Set(ghostFromText(ghostText).birth.split('\n').filter(Boolean));
      let best = -1;
      let most = -1;
      game.levels.forEach((l, k) => {
        const registry = registryFor(game.cartridge);
        registry.run(l.recipe, 'recipe');
        const own = registry
          .changed()
          .filter((v) => v.decl.scope !== 'view')
          .map((v) => `${v.decl.name} ${formatValue(v.value)}`);
        if (own.every((line) => born.has(line)) && own.length > most) {
          best = k;
          most = own.length;
        }
      });
      if (best >= 0) race = { text: ghostText, level: best };
    } catch {
      // (A broken strip: no race.)
    }
  }
  const music = game.music;
  return mount(game.cartridge, container, {
    recipes,
    console: false,
    camera: 'orbit',
    words: wordsOf(game),
    ...(game.models ? { models: game.models } : {}),
    ...(game.hud ? { hud: game.hud } : {}),
    ...(game.buttons ? { buttons: game.buttons } : {}),
    ...(game.tools ? { tools: game.tools } : {}),
    pieces: [
      campaign(game, progress, { ...(fromLink ? { link: fromLink } : {}), ...(race ? { race } : {}) }),
      ...(music ? [(page: GamePage) => mountMusic(page, music)] : []),
    ],
  });
}
