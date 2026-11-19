import type { Level } from '@manifold/commands';
import {
  BotHost,
  Clock,
  NO_INPUT,
  registryFor,
  replayFromText,
  ReplayPlayer,
  Session,
  sessionFor,
  SIMULATION_VERSION,
  stateHash,
  type Cartridge,
  type SessionSave,
  type World,
} from '@manifold/core';
import type { Channel } from './channel';
import type { Match, Tick, ToClient, ToServer } from './protocol';

export interface ServerOptions {
  /** How the match is born: a recipe with its startup and world values. */
  birth?: string;
  /** A clock in milliseconds, for saying how long a snapshot took (the page gives `performance.now`). */
  now?: () => number;
}

interface Connection {
  readonly channel: Channel<ToClient, ToServer>;
  /** Its player number, once it said hello. */
  player: number | null;
}

const hex = (n: number) => n.toString(16).padStart(8, '0');

/** Every how many steps the server keeps a snapshot to go back to (stage 4e), and how many: half a second, ten seconds. */
const BACK_EVERY = 30;
const BACK_KEPT = 20;

/**
 * THE SERVER (stage 1e): it keeps THE match, the one that counts. It has no screen and no transport of
 * its own: it lives in the page that plays alone, in the tab that opens a match to others, and (phase
 * 6) on a machine of its own.
 *
 * - Each connection that says hello becomes a player (the lowest number free), and the match gets a
 *   `players.join` at its next step. When it leaves, a `players.leave`.
 * - What a player asks for enters at the next step, like in a session (it is a session).
 * - A world change from a player's console enters if the game lets that player change the world
 *   (`mayChange`; without it, only player 1), and if it is one: a world value or a world action.
 * - On every step, everybody receives a tick: what entered at that step, and every `hashEvery` steps
 *   the hash, to check that their copies are the same world.
 * - Restarting, going back to a snapshot or playing a replay make a new session: everybody gets a
 *   new `welcome` with it.
 * - It HOSTS THE BOTS (stage 4e, decision 0023): before each step, the game's brains think for the
 *   characters that have one, and what they ask for enters like anyone's input (not while a replay
 *   plays: its inputs are the recorded ones). A player can drive a bot (`possess`), and the match can
 *   go back a few seconds (`back`: it keeps a snapshot every half second, with the bots' memories).
 */
export class Server {
  private session: Session;
  private readonly connections = new Set<Connection>();
  private playback: ReplayPlayer | null = null;
  private saved: SessionSave | null = null;
  private savedBots: ReturnType<BotHost['save']> = [];
  private readonly clock = new Clock();
  private readonly now: () => number;
  /** The bots it thinks for (stage 4e). */
  readonly bots = new BotHost();
  /** Its last few seconds, a snapshot every `BACK_EVERY` steps (with the bots' memories), the newest last. */
  private behind: { save: SessionSave; bots: ReturnType<BotHost['save']> }[] = [];

  constructor(
    readonly cartridge: Cartridge,
    o: ServerOptions = {},
  ) {
    // How long taking a snapshot took, said to people: a measure of this machine, never the world's time.
    // eslint-disable-next-line no-restricted-properties
    this.now = o.now ?? Date.now;
    this.session = this.born(o.birth ?? '');
  }

  /**
   * Every how many steps the ticks bring the hash, so each client checks its world: what the game's
   * profile says (decision 0014; 60, once a second, in the verified one).
   */
  get hashEvery(): number {
    return this.session.world.profile.verify.hashEvery;
  }

  /** The match's world (the presentation draws its own copy, the client's: this one is for tests and checks). */
  get world(): World {
    return this.session.world;
  }

  /** How far its clock is between two steps (the page that hosts it draws by it). */
  get alpha(): number {
    return this.clock.alpha;
  }

  /** The players connected now. */
  get players(): number[] {
    return [...this.connections].flatMap((c) => (c.player === null ? [] : [c.player])).sort((a, b) => a - b);
  }

  /** A new connection: it becomes a player when it says hello. */
  connect(channel: Channel<ToClient, ToServer>) {
    const c: Connection = { channel, player: null };
    this.connections.add(c);
    channel.onMessage = (m) => this.receive(c, m);
    channel.onClose = () => this.drop(c);
  }

  /** The steps its clock says are due after `dt` seconds (at most 5: see Clock); returns how many. */
  advance(dt: number): number {
    const steps = this.clock.advance(dt);
    for (let i = 0; i < steps; i++) this.step();
    return steps;
  }

  /** One step of the match, and its tick to everybody. */
  step() {
    if (this.playback) this.playback.feed(this.session);
    else this.bots.think(this.session);
    this.session.step();
    const step = this.session.world.tick;
    const tick: Tick = { type: 'tick', step, inputs: [], changes: [] };
    // What entered at this step is at the end of the session's history (it only grows).
    for (let i = this.session.inputs.length - 1; i >= 0 && this.session.inputs[i]!.step === step; i--)
      tick.inputs.unshift([this.session.inputs[i]!.player, this.session.inputs[i]!.input]);
    for (let i = this.session.history.length - 1; i >= 0 && this.session.history[i]!.step === step; i--)
      tick.changes.unshift(this.session.history[i]!.line);
    if (step % this.hashEvery === 0) tick.hash = stateHash(this.session.world);
    this.broadcast(tick);
    if (this.playback?.finished(this.session)) {
      this.playback = null;
      this.syncPlayers();
    }
    if (step % BACK_EVERY === 0 && !this.playback) {
      this.behind.push({ save: this.session.save(), bots: this.bots.save() });
      if (this.behind.length > BACK_KEPT) this.behind.shift();
    }
  }

  /** Frees the match's world. */
  dispose() {
    this.session.world.dispose();
    for (const c of this.connections) c.channel.close();
    this.connections.clear();
  }

  // ---------------------------------------------------------------- what comes from the players

  private receive(c: Connection, m: ToServer) {
    if (m.type === 'hello') return this.hello(c);
    const player = c.player;
    if (player === null) return;
    const may = this.cartridge.mayChange ? this.cartridge.mayChange(player) : player === 1;
    const refuse = () => this.say(c, 'in this match, only its host changes the world', 'warn');
    switch (m.type) {
      case 'input': {
        if (this.playback) return;
        // Driving a bot: the keys go to it, and its own character stands still.
        const bot = [...this.bots.possessed].find(([, by]) => by === player)?.[0];
        if (bot === undefined) this.session.setInput(player, m.input);
        else {
          this.session.setInput(bot, m.input);
          this.session.setInput(player, NO_INPUT);
        }
        return;
      }
      case 'possess':
        return this.possess(c, player, m.bot);
      case 'back':
        if (!may) return refuse();
        return this.back(c, m.seconds);
      case 'change': {
        if (!may) return refuse();
        if (!this.session.registry.isWorldChange(m.line))
          return this.say(c, `"${m.line}" is not a world change: only those go to the server`, 'warn');
        for (const e of this.session.registry.run(m.line, 'console')) if (e.level !== 'info') this.say(c, e.text, e.level);
        return;
      }
      case 'restart':
        if (!may) return refuse();
        this.replace(this.born(m.birth));
        return;
      case 'snapshot':
        if (!may) return refuse();
        return this.snapshot(c, m.action);
      case 'play':
        if (!may) return refuse();
        return this.play(c, m.replay);
      case 'stop':
        if (!may) return refuse();
        if (!this.playback) return this.say(c, 'no replay is playing');
        this.playback = null;
        this.syncPlayers();
        this.say(c, 'stopped: the control is yours');
        return;
    }
  }

  private hello(c: Connection) {
    if (c.player !== null) return;
    const taken = new Set(this.players);
    let player = 1;
    while (taken.has(player)) player++;
    c.player = player;
    this.welcome(c);
    this.syncPlayers();
  }

  private drop(c: Connection) {
    this.connections.delete(c);
    this.syncPlayers();
  }

  // ---------------------------------------------------------------- the match

  private born(birth: string): Session {
    const registry = registryFor(this.cartridge);
    registry.run(birth, 'recipe');
    return new Session(this.cartridge, { registry });
  }

  /** Another session (a restart, a replay): the old one is freed, and everybody is welcomed to the new one. */
  private replace(session: Session, playback: ReplayPlayer | null = null, replay?: Match['replay']) {
    this.session.world.dispose();
    this.session = session;
    this.saved = null;
    this.savedBots = [];
    this.behind = [];
    this.bots.load();
    this.bots.possessed.clear();
    // (Before welcoming and syncing the players: a replay's world must not get any `players.join`.)
    this.playback = playback;
    for (const c of this.connections) if (c.player !== null) this.welcome(c, replay);
    this.syncPlayers();
  }

  /**
   * Who is in the world, as who is connected: a `players.join` for whoever came, a `players.leave` for
   * whoever left (at the next step). Not while a replay plays: its world is the recorded one.
   */
  private syncPlayers() {
    if (this.playback) return;
    const connected = new Set(this.players);
    const world = this.session.world;
    for (const p of connected) if (!world.players.has(p)) this.session.registry.run(`players.join ${p}`);
    for (const p of world.players) if (!connected.has(p)) this.session.registry.run(`players.leave ${p}`);
  }

  private welcome(c: Connection, replay?: Match['replay']) {
    const s = this.session;
    const atBirth = s.world.tick === 0;
    const match: Match = { birth: s.birth, ...(atBirth ? {} : { session: s.state() }), ...(replay ? { replay } : {}) };
    c.channel.send({
      type: 'welcome',
      player: c.player!,
      game: this.cartridge.id,
      version: SIMULATION_VERSION,
      versions: this.cartridge.versions ?? {},
      match,
    });
  }

  private snapshot(c: Connection, action: 'save' | 'load') {
    const hash = () => hex(stateHash(this.session.world));
    if (action === 'save') {
      const start = this.now();
      this.saved = this.session.save();
      this.savedBots = this.bots.save();
      const ms = this.now() - start;
      const kb = (bytes: number) => (bytes / 1024).toFixed(1);
      const entities = JSON.stringify(this.saved.world.entities).length;
      this.say(
        c,
        `a snapshot at step ${this.session.world.tick} · hash ${hash()} · ${kb(this.saved.world.physics.length)} KB of physics and about ${kb(entities)} KB of entities · in ${ms.toFixed(2)} ms. \`snapshot load\` comes back here.`,
      );
      return;
    }
    if (!this.saved) return this.say(c, 'there is no snapshot of this match: `snapshot` takes one', 'warn');
    if (this.playback) return this.say(c, 'a replay is playing: `replay stop` first', 'warn');
    const start = this.now();
    this.session.load(this.saved);
    this.bots.load(this.savedBots);
    this.behind = this.behind.filter((b) => b.save.world.tick <= this.session.world.tick);
    const ms = this.now() - start;
    for (const other of this.connections) if (other.player !== null) this.welcome(other);
    this.syncPlayers();
    this.say(c, `back at step ${this.session.world.tick} · hash ${hash()} · in ${ms.toFixed(2)} ms`);
  }

  private play(c: Connection, text: string) {
    let session: Session;
    let replay;
    try {
      replay = replayFromText(text);
      session = sessionFor(this.cartridge, replay);
    } catch (e) {
      return this.say(c, `the replay: ${(e as Error).message}`, 'warn');
    }
    this.replace(session, new ReplayPlayer(replay), { step: replay.end.step, hash: replay.end.hash });
  }

  /**
   * A player drives a bot (stage 4e): its brain waits, and the player's keys go to it; null lets it go.
   * The keys go over AT ONCE, as they are: a page sends its input only when it changes, so until then
   * a bot taken over would go on with what its brain asked for last (the guard walked on, 4 m a second,
   * with no key down), and a character given back would ignore a key already held.
   */
  private possess(c: Connection, player: number, bot: number | null) {
    // What the player asks for now: where its keys went, the bot it drove, or else its own character.
    let keys = this.session.inputOf(player);
    for (const [b, by] of this.bots.possessed)
      if (by === player) {
        keys = this.session.inputOf(b);
        this.bots.possessed.delete(b);
      }
    // Driving nothing, the keys are its own character's again (its brain asks for the bot it let go).
    const own = () => this.session.setInput(player, keys);
    if (bot === null) {
      own();
      return this.say(c, 'you drive your own character again');
    }
    const e = [...this.session.world.entities.values()].find((x) => x.character?.player === bot && x.brain);
    if (!e) {
      own();
      return this.say(c, `no bot is player ${bot}`, 'warn');
    }
    const by = this.bots.possessed.get(bot);
    if (by !== undefined) {
      own();
      return this.say(c, `player ${by} drives it already`, 'warn');
    }
    this.bots.possessed.set(bot, player);
    this.session.setInput(bot, keys);
    this.session.setInput(player, NO_INPUT);
    this.say(c, `you drive ${e.name ?? `entity ${e.id}`} (player ${bot}): its brain waits until \`possess\` with nothing`);
  }

  /** Back `seconds` (stage 4e): to the newest snapshot it kept that far back, everybody with it. */
  private back(c: Connection, seconds: number) {
    if (this.playback) return this.say(c, 'a replay is playing: `replay stop` first', 'warn');
    const to = this.session.world.tick - Math.round(seconds * 60);
    const kept = [...this.behind].reverse().find((b) => b.save.world.tick <= to);
    if (!kept) {
      const oldest = this.behind[0];
      const most = oldest ? ((this.session.world.tick - oldest.save.world.tick) / 60).toFixed(1) : '0';
      return this.say(c, `it keeps only the last ${most} s: \`back ${most}\` at most`, 'warn');
    }
    this.session.load(kept.save);
    this.bots.load(kept.bots);
    this.behind = this.behind.filter((b) => b.save.world.tick <= kept.save.world.tick);
    for (const other of this.connections) if (other.player !== null) this.welcome(other);
    this.syncPlayers();
    this.say(
      c,
      `back at step ${this.session.world.tick}, ${((to + Math.round(seconds * 60) - this.session.world.tick) / 60).toFixed(1)} s ago`,
    );
  }

  private say(c: Connection, text: string, level: Level = 'info') {
    c.channel.send({ type: 'say', text, level });
  }

  private broadcast(m: ToClient) {
    for (const c of this.connections) if (c.player !== null) c.channel.send(m);
  }
}
