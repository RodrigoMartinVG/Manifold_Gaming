import { formatValue, type CommandInfo, type Registry, type VariableInfo } from '@manifold/commands';
import { stateHash, type Cartridge, type PlayerInput, type Session, type World } from '@manifold/core';
import { Client, localPair, Server, type Channel, type Match, type ToClient, type ToServer } from '@manifold/net';
import { hex } from './page';
import { joinFromTabs, openToTabs } from './tabs';

/** What a piece asks the match to do around each step this page's copy takes. */
export interface StepHooks {
  before(): void;
  after(): void;
}

/** How this page plays: alone, with its match open to other tabs, or in another tab's match. */
export type NetMode = 'alone' | 'open' | 'joined';

export interface PageMatch {
  readonly session: Session;
  readonly me: number;
  readonly net: NetMode;
  /** Whether the match lives in this page (alone or open), and so its clock. */
  readonly hosting: boolean;
  readonly checks: number;
  readonly desyncs: number;
  readonly paused: boolean;
  readonly timescale: number;
  /** Where the drawing is between the last two steps, by the clock of the match (1: the last step). */
  readonly alpha: number;
  /** The players in the match, if this page hosts it. */
  readonly players: readonly number[] | null;
  /** Starts it: a match hosted in this page, born with the registry's values. */
  start(): void;
  /** The steps due after `dt` seconds of the page's clock (if this page holds the clock), and this page's copy takes them. */
  advance(dt: number): void;
  /** What this page's player asks for, from now on. */
  sendInput(input: PlayerInput): void;
  /** A request to the server (a restart, a snapshot, a replay to play, stop it). */
  request(message: Parameters<Client['request']>[0]): void;
  /** The world starts over, with the registry's current values. */
  restart(): void;
  stop(): void;
}

/** What this piece declares, as data (the site's console reference reads it). */
export const MATCH_VARIABLES = {
  timescale: {
    name: 'view.timescale',
    description:
      'Show the world slower (0.2) or faster (2). The world advances the same, by fixed steps: it does not change the physics or the hash.',
    scope: 'view',
    type: { kind: 'number', min: 0.05, max: 4 },
    default: 1,
  },
  paused: {
    name: 'view.paused',
    description: 'Stops the world (with `step` it advances one step at a time).',
    scope: 'view',
    type: { kind: 'boolean' },
    default: false,
  },
} as const satisfies Record<string, VariableInfo>;
export const MATCH_COMMANDS = {
  pause: {
    name: 'pause',
    description: 'Stops or resumes the world (the same as `toggle view.paused`).',
  },
  step: {
    name: 'step',
    description: 'Advances the world n steps (1, if not said), and leaves it paused.',
    args: [{ name: 'n', type: { kind: 'integer', min: 1, max: 600 }, optional: true }],
  },
  hash: {
    name: 'hash',
    description: "The world's step and its hash: a number that sums up its whole state.",
  },
  restart: {
    name: 'restart',
    description: 'The world starts over, with the current values.',
  },
  snapshot: {
    name: 'snapshot',
    description:
      'Saves this moment (`snapshot`), and goes back to it (`snapshot load`), like an emulator\'s "save state": the whole world, its physics included. From there, the same inputs give the same hash, and its replay still holds. In a match with others, everybody goes back.',
    args: [{ name: 'action', type: { kind: 'option', options: ['save', 'load'] }, optional: true }],
  },
  net: {
    name: 'net',
    description:
      "The match, and where it lives. Even alone, this page plays through a server of its own. `net open` lets other tabs of this browser join it; `net join` joins a match opened in another tab (you get your own character, if the level has characters); `net leave` goes back to playing alone. Every second, each copy checks its world with the server's hash.",
    args: [{ name: 'action', type: { kind: 'option', options: ['open', 'join', 'leave'] }, optional: true }],
  },
} as const satisfies Record<string, CommandInfo>;

/**
 * THE MATCH (stage 1e). Even playing alone, the page plays THROUGH A SERVER: one that lives in this
 * same page, and keeps the match. What is drawn is this page's own copy, its client's session,
 * simulated with what the server says entered at each step, and checked with its hash every second.
 * So every game, even alone, goes the network's way (and checks its determinism while it is played).
 *
 * It declares what is about the match and its clock: `pause`, `step`, `hash`, `restart`, `snapshot`,
 * `net`, and the view's `view.timescale` and `view.paused`.
 */
export function createMatch(o: {
  cartridge: Cartridge;
  registry: Registry<World>;
  container: HTMLElement;
  /** A new session to show: its pieces rebuild. */
  welcome(session: Session, match: Match): void;
  /** What to do around each step this page's copy takes. */
  hooks: StepHooks;
  say(text: string, level?: 'info' | 'warn' | 'error'): void;
}): PageMatch {
  const { cartridge, registry, container } = o;
  let session!: Session;
  /** The match, if this page hosts it (alone, or open to other tabs); null if it joined another tab's. */
  let server: Server | null = null;
  /** This page's place in the match. */
  let link: Client | null = null;
  let me = 1;
  let net: NetMode = 'alone';
  let tabs: { close(): void } | null = null;
  /** Whether the next welcome is the one of a match just joined (its number comes with it). */
  let joining = false;
  let timescale = 1;
  let paused = false;

  /** The recipe the match is born with: the startup and world values that are not at their defaults. */
  const birthOf = () =>
    registry
      .changed()
      .filter((v) => v.decl.scope !== 'view')
      .map((v) => `${v.decl.name} ${formatValue(v.value)}`)
      .join('\n');

  /** A match hosted in this page: a server here, and this page's client, joined to it in the same page. */
  function hostMatch() {
    leaveMatch();
    server = new Server(cartridge, { birth: birthOf(), now: () => performance.now() });
    const pair = localPair<ToClient, ToServer>();
    server.connect(pair.a);
    net = 'alone';
    connect(pair.b);
  }

  /** This page's client, on a channel to a server (this page's, or another tab's). */
  function connect(channel: Channel<ToServer, ToClient>) {
    const client: Client = new Client(cartridge, registry, channel, {
      welcome(next, match) {
        session = next;
        me = client.player;
        if (joining) {
          joining = false;
          o.say(`you joined the match: you are player ${me}`);
        }
        o.welcome(next, match);
      },
      say: (text, level) => o.say(text, level),
      desync: (step, mine, theirs) => {
        container.dataset.desyncs = String(client.desyncs);
        o.say(`DESYNC at step ${step}: this copy's hash is ${hex(mine)}, the server's ${hex(theirs)}`, 'error');
      },
    });
    link = client;
    client.hello();
  }

  /** Leaves the current match: this page's client, and its server (and its tabs) if it hosted one. */
  function leaveMatch() {
    link?.close();
    tabs?.close();
    tabs = null;
    server?.dispose();
    server = null;
  }

  /** This page's copy takes the steps that came from the server, one by one. */
  const drain = () => link!.drain(o.hooks);

  const restart = () => link!.request({ type: 'restart', birth: birthOf() });

  registry.declareVariable({
    ...MATCH_VARIABLES.timescale,
    onChange: (v) => (timescale = Number(v)),
  });
  registry.declareVariable({
    ...MATCH_VARIABLES.paused,
    onChange: (v) => (paused = v === true),
  });
  /** The match's clock is its host's: a page that joined another tab's match cannot stop it. */
  const hostsTheClock = (out: { write(t: string, l?: 'warn'): void }) => {
    if (server) return true;
    out.write("the match's clock is its host's: this page joined another tab's match", 'warn');
    return false;
  };
  registry.declareCommand({
    ...MATCH_COMMANDS.pause,
    run: (_, out) => {
      if (!hostsTheClock(out)) return;
      for (const m of registry.run(`view.paused ${paused ? 'off' : 'on'}`)) out.write(m.text, m.level);
    },
  });
  registry.declareCommand({
    ...MATCH_COMMANDS.step,
    run: ([n], out) => {
      if (!hostsTheClock(out)) return;
      registry.run('view.paused on');
      for (let i = 0; i < (typeof n === 'number' ? n : 1); i++) {
        server!.step();
        drain();
      }
      out.write(`step ${session.world.tick}`);
    },
  });
  registry.declareCommand({
    ...MATCH_COMMANDS.hash,
    run: (_, out) => out.write(`step ${session.world.tick} · hash ${hex(stateHash(session.world))}`),
  });
  registry.declareCommand({
    ...MATCH_COMMANDS.restart,
    run: (_, out) => {
      restart();
      out.write('the world started over');
    },
  });
  // Snapshots (stage 1d): the server's, so everybody in the match goes back.
  registry.declareCommand({
    ...MATCH_COMMANDS.snapshot,
    run: ([action]) => link!.request({ type: 'snapshot', action: action === 'load' ? 'load' : 'save' }),
  });
  // The match with other tabs (stage 1e).
  registry.declareCommand({
    ...MATCH_COMMANDS.net,
    run: ([action], out) => {
      if (action === 'open') {
        if (!server) return out.write("this page is in another tab's match: `net leave` first", 'warn');
        if (!tabs) tabs = openToTabs(cartridge.id, server);
        net = 'open';
        out.write('the match is open: in another tab of this browser, `net join` joins it');
      } else if (action === 'join') {
        out.write('looking for a match open in another tab…');
        void joinFromTabs(cartridge.id).then((channel) => {
          if (!channel) return o.say('no tab answered: open one there with `net open`', 'warn');
          leaveMatch();
          net = 'joined';
          joining = true;
          connect(channel);
          channel.onClose = () => {
            o.say('the match was closed: playing alone again', 'warn');
            hostMatch();
          };
        });
      } else if (action === 'leave') {
        if (net === 'joined') hostMatch();
        else {
          tabs?.close();
          tabs = null;
          net = 'alone';
        }
        out.write('playing alone');
      } else {
        const where =
          net === 'joined'
            ? "in another tab's match"
            : net === 'open'
              ? 'hosting a match open to other tabs'
              : 'alone, through a server in this page';
        const players = server ? ` · players ${server.players.join(', ')}` : '';
        out.write(`${where} · you are player ${me}${players} · ${link!.checks} hash checks, ${link!.desyncs} desyncs`);
      }
    },
  });

  return {
    get session() {
      return session;
    },
    get me() {
      return me;
    },
    get net() {
      return net;
    },
    get hosting() {
      return server !== null;
    },
    get checks() {
      return link?.checks ?? 0;
    },
    get desyncs() {
      return link?.desyncs ?? 0;
    },
    get paused() {
      return paused;
    },
    get timescale() {
      return timescale;
    },
    // A page that joined another tab's match draws the last step (smoothing what comes with lag is for phase 6).
    get alpha() {
      return server && !paused ? server.alpha : 1;
    },
    get players() {
      return server ? server.players : null;
    },
    start() {
      hostMatch();
      // Leaving the page leaves the match (and closes it for the tabs that joined it).
      window.addEventListener('pagehide', leaveMatch);
    },
    advance(dt) {
      // The match's clock is its host's: this page's server advances, and every copy takes those steps.
      if (server && !paused) server.advance(dt * timescale);
      drain();
    },
    sendInput: (input) => link!.sendInput(input),
    request: (message) => link!.request(message),
    restart,
    stop() {
      leaveMatch();
      window.removeEventListener('pagehide', leaveMatch);
      session?.world.dispose();
    },
  };
}
