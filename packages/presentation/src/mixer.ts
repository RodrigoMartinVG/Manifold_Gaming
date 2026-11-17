/** The kinds of what is heard, each through a channel of its own, with its own volume. */
export type Channel = 'sounds' | 'music';

/**
 * THE MIXER (stage 5b; decision 0027: the music goes through the mixer the sounds go through): one
 * audio context a page, made on the first key or click (the browser lets sound run only after one,
 * the same rule for both), and a channel for each kind of what is heard, each with its volume, into
 * the speakers. The sounds (audio.ts) and the music (music.ts) make their notes into their channel.
 */
export interface Mixer {
  /** The context, once a key or a click started it (null before, and where the browser has none). */
  readonly context: AudioContext | null;
  /** A channel's input, once started. */
  channel(kind: Channel): GainNode | null;
  /** What to do once it has started (at once, if it has). */
  onStart(f: (context: AudioContext) => void): void;
  /** A channel's volume, 0 to 1 (kept until it starts). */
  volume(kind: Channel, v: number): void;
  stop(): void;
}

export function createMixer(): Mixer {
  let context: AudioContext | null = null;
  const volumes: Record<Channel, number> = { sounds: 1, music: 1 };
  const channels = new Map<Channel, GainNode>();
  const started: ((context: AudioContext) => void)[] = [];
  const start = () => {
    if (context) return void context.resume();
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    context = new Context();
    for (const kind of ['sounds', 'music'] as const) {
      const gain = context.createGain();
      gain.gain.value = volumes[kind];
      gain.connect(context.destination);
      channels.set(kind, gain);
    }
    for (const f of started) f(context);
  };
  window.addEventListener('keydown', start);
  window.addEventListener('pointerdown', start);
  return {
    get context() {
      return context;
    },
    channel: (kind) => channels.get(kind) ?? null,
    onStart(f) {
      started.push(f);
      if (context) f(context);
    },
    volume(kind, v) {
      volumes[kind] = v;
      const gain = channels.get(kind);
      if (gain) gain.gain.value = v;
    },
    stop() {
      window.removeEventListener('keydown', start);
      window.removeEventListener('pointerdown', start);
      void context?.close();
    },
  };
}
