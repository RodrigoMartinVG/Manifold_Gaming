import type { FiredSound } from './feel';
/**
 * THE SOUNDS, MADE (stage 5k, decision 0031: the author asked for far better sounds and explosions). Still
 * without recorded files (decision 0027: a recording only where one cannot be made, and only by the
 * author's call), but made as sound designers make them: each sound in LAYERS, the way Andy Farnell's
 * "Designing Sound" (MIT Press, 2010) takes an explosion or a gunshot apart:
 *
 *   - a TRANSIENT: the first few milliseconds, broadband, that tell the ear something happened, and where;
 *   - a BODY: the sound's own color (a filtered noise, a pitch that falls), tens to hundreds of ms;
 *   - a LOW THUMP: a sine falling in pitch, driven through a soft clip so its harmonics are heard on small
 *     speakers too (a laptop does not play 40 Hz; it plays 80, 120, 160);
 *   - a TAIL: what the place gives back (the reverb, audio.ts) and, for the large ones, what falls after.
 *
 * Every builder here takes a `BaseAudioContext`, so the same sound renders live or offline (a test, or
 * a file to listen to), and starts its layers at `at` into `out`. None keeps anything: the nodes go when
 * their sources stop. Small random changes (pitch, timing, which noise) on every call, so a sound heard
 * twice is never the same (a repeated sample is the first thing the ear catches).
 */

/** What every sound is made from: the context, three noises, a soft clip, and a source of randomness. */
export interface Kit {
  context: BaseAudioContext;
  /** White (flat), pink (−3 dB an octave: rain, a rush) and brown (−6 dB an octave: wind, a rumble). */
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
  /** A tanh curve: a soft clip, for grit and for the harmonics of a low thump. */
  grit: Float32Array<ArrayBuffer>;
  random: () => number;
}

/** Two seconds of each noise, and the soft clip, for a context. */
export function makeKit(context: BaseAudioContext, random: () => number = Math.random): Kit {
  const n = 2 * context.sampleRate;
  const buffer = (fill: (data: Float32Array) => void) => {
    const b = context.createBuffer(1, n, context.sampleRate);
    fill(b.getChannelData(0));
    return b;
  };
  const white = buffer((d) => {
    for (let i = 0; i < d.length; i++) d[i] = random() * 2 - 1;
  });
  // Pink, by Paul Kellet's economy filter: three one-pole sums of white.
  const pink = buffer((d) => {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const w = random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  });
  // Brown: white, summed and leaking back to zero.
  const brown = buffer((d) => {
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      last = (last + 0.02 * (random() * 2 - 1)) / 1.02;
      d[i] = 3.5 * last;
    }
  });
  const grit = new Float32Array(1024);
  for (let i = 0; i < grit.length; i++) grit[i] = Math.tanh(3 * ((2 * i) / (grit.length - 1) - 1)) / Math.tanh(3);
  return { context, white, pink, brown, grit, random };
}

/** A filtered noise under an envelope. Times in seconds; `delay` after `at`. */
export interface NoiseLayer {
  noise?: 'white' | 'pink' | 'brown';
  filter?: BiquadFilterType;
  /** The filter's frequency (Hz), and where it sweeps to (exponentially) over `sweep` s (the decay, if not said). */
  from: number;
  to?: number;
  sweep?: number;
  q?: number;
  gain: number;
  attack?: number;
  decay: number;
  delay?: number;
  /** Through the soft clip. */
  grit?: boolean;
}

/** A tone under an envelope, its pitch sweeping as a noise's filter does. */
export interface ToneLayer {
  wave?: OscillatorType;
  from: number;
  to?: number;
  sweep?: number;
  gain: number;
  attack?: number;
  decay: number;
  delay?: number;
  grit?: boolean;
}

/** An envelope: from 0 up to `gain` in `attack`, then down to silence (exponentially) over `decay`. */
function envelope(kit: Kit, at: number, gain: number, attack: number, decay: number): GainNode {
  const g = kit.context.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

/** The soft clip, driven (louder in, more harmonics out): what goes in, and what comes out. */
function clip(kit: Kit, drive: number): [input: AudioNode, output: AudioNode] {
  const pre = kit.context.createGain();
  pre.gain.value = drive;
  const shaper = kit.context.createWaveShaper();
  shaper.curve = kit.grit;
  shaper.oversample = '2x';
  const post = kit.context.createGain();
  post.gain.value = 1 / Math.max(1, drive * 0.6);
  pre.connect(shaper).connect(post);
  return [pre, post];
}

/** A noise layer, made. Returns when it is silent (s). */
export function noise(kit: Kit, out: AudioNode, at: number, l: NoiseLayer): number {
  const c = kit.context;
  const t = at + (l.delay ?? 0);
  const attack = l.attack ?? 0.002;
  const source = c.createBufferSource();
  source.buffer = kit[l.noise ?? 'white'];
  const filter = c.createBiquadFilter();
  filter.type = l.filter ?? 'bandpass';
  filter.frequency.setValueAtTime(l.from, t);
  if (l.to !== undefined) filter.frequency.exponentialRampToValueAtTime(l.to, t + (l.sweep ?? attack + l.decay));
  filter.Q.value = l.q ?? 0.8;
  const env = envelope(kit, t, l.gain, attack, l.decay);
  let last: AudioNode = source.connect(filter);
  if (l.grit) {
    const [input, output] = clip(kit, 2.5);
    last.connect(input);
    last = output;
  }
  last.connect(env).connect(out);
  const end = t + attack + l.decay + 0.02;
  // From a random place in the noise: no two the same.
  source.start(t, kit.random() * 1.5);
  source.stop(end);
  return end;
}

/** A tone layer, made. Returns when it is silent (s). */
export function tone(kit: Kit, out: AudioNode, at: number, l: ToneLayer): number {
  const c = kit.context;
  const t = at + (l.delay ?? 0);
  const attack = l.attack ?? 0.003;
  const osc = c.createOscillator();
  osc.type = l.wave ?? 'sine';
  osc.frequency.setValueAtTime(l.from, t);
  if (l.to !== undefined) osc.frequency.exponentialRampToValueAtTime(l.to, t + (l.sweep ?? attack + l.decay));
  const env = envelope(kit, t, l.gain, attack, l.decay);
  let last: AudioNode = osc;
  if (l.grit) {
    const [input, output] = clip(kit, 3);
    last.connect(input);
    last = output;
  }
  last.connect(env).connect(out);
  const end = t + attack + l.decay + 0.02;
  osc.start(t);
  osc.stop(end);
  return end;
}

/** A number near `x`: within `share` of it either way, at random. */
const near = (kit: Kit, x: number, share: number) => x * (1 + share * (kit.random() * 2 - 1));

/**
 * Each surface's color (stage 3f, made richer in 5k): where its noise sits (Hz) and how narrow; its
 * partials if it rings (Hz, and how long, s); and its grit, the small crackles of what is loose on it.
 */
export const SURFACES: Readonly<
  Record<string, { noise: number; q: number; ring?: readonly [frequencies: readonly number[], seconds: number]; grit: number }>
> = Object.freeze({
  stone: { noise: 900, q: 1.2, grit: 0.5 },
  wood: { noise: 420, q: 3, ring: [[180, 360], 0.12], grit: 0.1 },
  metal: { noise: 2400, q: 6, ring: [[1830, 2770, 4120], 0.45], grit: 0 },
  glass: { noise: 3600, q: 8, ring: [[4200, 6100], 0.18], grit: 0 },
  ice: { noise: 3000, q: 0.8, grit: 0.8 },
});
const surfaceOf = (name: string | null | undefined) => SURFACES[name ?? 'stone'] ?? SURFACES.stone!;

/** A few tiny crackles, scattered over `seconds`: what is loose underfoot, or what falls after a blast. */
function crackles(kit: Kit, out: AudioNode, at: number, n: number, seconds: number, gain: number, from = 2200, to = 5200) {
  for (let i = 0; i < n; i++)
    noise(kit, out, at, {
      from: from + (to - from) * kit.random(),
      q: 4,
      gain: gain * (0.4 + 0.6 * kit.random()),
      attack: 0.001,
      decay: 0.006 + 0.012 * kit.random(),
      delay: seconds * kit.random(),
    });
}

/**
 * A STEP: a heel and then a toe (two thuds 30 to 60 ms apart, the second softer and higher), each the
 * surface's noise over a low knock, the loose grit of the surface on top; louder and sharper the faster.
 */
export function step(kit: Kit, out: AudioNode, at: number, surface: string | null | undefined, hard = 1) {
  const s = surfaceOf(surface);
  const toe = 0.03 + 0.03 * kit.random();
  for (const [delay, share] of [
    [0, 1],
    [toe, 0.55],
  ] as const) {
    const f = near(kit, s.noise, 0.12) * (delay ? 1.25 : 1);
    noise(kit, out, at, { noise: 'pink', from: f, q: s.q, gain: 0.55 * hard * share, attack: 0.002, decay: 0.05 * hard, delay });
    tone(kit, out, at, { from: near(kit, 95, 0.1), to: 55, gain: 0.32 * hard * share, decay: 0.06, delay });
    if (s.ring)
      for (const r of s.ring[0]) tone(kit, out, at, { from: near(kit, r, 0.03), gain: 0.05 * share, decay: s.ring[1], delay });
  }
  if (s.grit > 0) crackles(kit, out, at, Math.round(3 * s.grit + kit.random() * 2), 0.07, 0.12 * s.grit * hard);
}

/** A LANDING: a heavy thud and a rush of cloth, the surface's noise under it; more the harder it came down. */
export function land(kit: Kit, out: AudioNode, at: number, surface: string | null | undefined, hard = 1) {
  const s = surfaceOf(surface);
  tone(kit, out, at, { from: 80, to: 38, gain: 0.7 * hard, decay: 0.16, grit: true });
  noise(kit, out, at, { noise: 'pink', from: near(kit, s.noise * 0.7, 0.1), q: s.q * 0.7, gain: 0.6 * hard, decay: 0.12 });
  noise(kit, out, at, { from: 2400, q: 0.7, gain: 0.08 * hard, attack: 0.01, decay: 0.08 });
  if (s.ring) for (const r of s.ring[0]) tone(kit, out, at, { from: r * 0.95, gain: 0.08 * hard, decay: s.ring[1] * 1.4 });
  if (s.grit > 0) crackles(kit, out, at, Math.round(6 * s.grit), 0.15, 0.14 * s.grit * hard);
}

/** A HIT of things (stage 3f): as hard as its energy, in its surface's color, a crack first when it is hard. */
export function hit(kit: Kit, out: AudioNode, at: number, surface: string | null | undefined, strength: number) {
  const s = surfaceOf(surface);
  if (strength > 0.4) noise(kit, out, at, { filter: 'highpass', from: 2500, gain: 0.3 * strength, attack: 0.001, decay: 0.015 });
  noise(kit, out, at, { noise: 'pink', from: near(kit, s.noise * 0.8, 0.1), q: s.q, gain: 0.6 * strength + 0.1, decay: 0.12 });
  tone(kit, out, at, { from: near(kit, 120, 0.1), to: 60, gain: 0.5 * strength + 0.1, decay: 0.12, grit: strength > 0.6 });
  if (s.ring)
    for (const f of s.ring[0])
      tone(kit, out, at, { from: near(kit, f * 0.9, 0.04), gain: 0.15 * strength, decay: s.ring[1] * 1.5 });
}

/**
 * WHERE A SHOT STRUCK something that does not live (5k: until now it was silent): a sharp tick in the
 * surface's color, a puff of grit; off hard surfaces, now and then (a third of the time), the falling
 * whine of a ricochet.
 */
export function impact(kit: Kit, out: AudioNode, at: number, surface: string | null | undefined) {
  const s = surfaceOf(surface);
  noise(kit, out, at, { filter: 'highpass', from: 3000, gain: 0.45, attack: 0.0005, decay: 0.01 });
  noise(kit, out, at, { noise: 'pink', from: near(kit, s.noise * 1.4, 0.15), q: s.q * 0.8, gain: 0.4, decay: 0.07 });
  if (s.ring) for (const f of s.ring[0]) tone(kit, out, at, { from: near(kit, f, 0.05), gain: 0.08, decay: s.ring[1] });
  crackles(kit, out, at, 4, 0.12, 0.12 + 0.1 * s.grit);
  if ((surface === 'metal' || surface === 'stone' || !surface) && kit.random() < 0.33) {
    const f = near(kit, 2600, 0.25);
    tone(kit, out, at, { wave: 'triangle', from: f, to: f * 0.45, gain: 0.07, attack: 0.01, decay: 0.32, delay: 0.01 });
  }
}

/**
 * A SHOT PASSING NEAR (5k): the snap and the whine of what flew past the ear, its pitch falling as it
 * goes by (Doppler); louder the nearer it passed. How near is `closeness`, 0 to 1.
 */
export function whiz(kit: Kit, out: AudioNode, at: number, closeness: number) {
  const f = near(kit, 3400, 0.15);
  noise(kit, out, at, { filter: 'highpass', from: 4500, gain: 0.4 * closeness, attack: 0.0005, decay: 0.008 });
  noise(kit, out, at, { from: f, to: f * 0.4, sweep: 0.16, q: 5, gain: 0.8 * closeness, attack: 0.03, decay: 0.14 });
  tone(kit, out, at, { wave: 'triangle', from: f * 0.5, to: f * 0.22, gain: 0.08 * closeness, attack: 0.03, decay: 0.15 });
}

/**
 * A WEAPON FIRED (stage 5g, rebuilt in 5k), each kind its own layers:
 *   - the dart: a crack, a short body at 1.2 kHz, a thump at 150 Hz, the bolt of its mechanism after;
 *   - the bolt: a string's twang falling in pitch, a thwack, a wooden knock;
 *   - the shotgun: a wide crack, a body of pink noise closing from 2.5 kHz down, a gritty thump at 70 Hz,
 *     and half a second later its pump, back and forth;
 *   - the launcher: a thump, the rocket's ignition, a hiss that rises as it leaves;
 *   - (5n) the repeater, the dart's lighter; an attacker's orb, a hum that rises;
 *   - (5o) the longshot, a sharper crack and a long ring, its bolt worked; the flame lance, a breath of
 *     roar that runs into the next;
 *   - what is swung or thrown: a whoosh.
 */
export function fired(kit: Kit, out: AudioNode, at: number, kind: FiredSound) {
  switch (kind) {
    case 'crack':
      noise(kit, out, at, { filter: 'highpass', from: 2000, gain: 0.7, attack: 0.0005, decay: 0.015 });
      noise(kit, out, at, { from: near(kit, 1200, 0.08), q: 1, gain: 0.55, decay: 0.07 });
      tone(kit, out, at, { from: near(kit, 150, 0.06), to: 60, gain: 0.55, decay: 0.09, grit: true });
      noise(kit, out, at, { from: 4200, q: 6, gain: 0.08, attack: 0.001, decay: 0.008, delay: 0.11 + 0.02 * kit.random() });
      break;
    case 'twang':
      tone(kit, out, at, { wave: 'triangle', from: near(kit, 330, 0.05), to: 200, gain: 0.25, decay: 0.28 });
      tone(kit, out, at, { wave: 'sawtooth', from: near(kit, 660, 0.05), to: 400, gain: 0.04, decay: 0.12 });
      noise(kit, out, at, { from: 1800, q: 2, gain: 0.3, decay: 0.04 });
      tone(kit, out, at, { from: 130, to: 80, gain: 0.3, decay: 0.05 });
      break;
    case 'boom':
      noise(kit, out, at, { filter: 'highpass', from: 1500, gain: 0.9, attack: 0.0005, decay: 0.025 });
      noise(kit, out, at, {
        noise: 'pink',
        filter: 'lowpass',
        from: 2500,
        to: 380,
        sweep: 0.3,
        q: 0.7,
        gain: 1,
        decay: 0.38,
        grit: true,
      });
      tone(kit, out, at, { from: near(kit, 72, 0.05), to: 34, gain: 1, decay: 0.34, grit: true });
      // The pump, back and forth.
      for (const [delay, f] of [
        [0.48, 1300],
        [0.62, 2300],
      ] as const) {
        noise(kit, out, at, { from: f, q: 3, gain: 0.16, attack: 0.001, decay: 0.03, delay });
        noise(kit, out, at, { from: 800, q: 1.5, gain: 0.06, attack: 0.01, decay: 0.05, delay: delay - 0.04 });
      }
      break;
    case 'thump':
      tone(kit, out, at, { from: near(kit, 110, 0.05), to: 45, gain: 0.8, decay: 0.26, grit: true });
      noise(kit, out, at, { filter: 'highpass', from: 1800, gain: 0.4, attack: 0.001, decay: 0.03 });
      noise(kit, out, at, {
        noise: 'pink',
        from: 600,
        to: 2600,
        sweep: 0.5,
        q: 1.2,
        gain: 0.45,
        attack: 0.03,
        decay: 0.6,
        delay: 0.02,
      });
      break;
    case 'tick':
      // (Stage 5n) The dart's, lighter and shorter: it fires ten a second.
      noise(kit, out, at, { filter: 'highpass', from: 2400, gain: 0.45, attack: 0.0005, decay: 0.01 });
      noise(kit, out, at, { from: near(kit, 1500, 0.1), q: 1.2, gain: 0.35, decay: 0.04 });
      tone(kit, out, at, { from: near(kit, 180, 0.08), to: 90, gain: 0.3, decay: 0.05, grit: true });
      break;
    case 'ring':
      // (Stage 5o) A crack sharper than the dart's, a heavier body, a thump and a long ring; then its bolt
      // worked, back and forth.
      noise(kit, out, at, { filter: 'highpass', from: 2600, gain: 0.95, attack: 0.0003, decay: 0.012 });
      noise(kit, out, at, { from: near(kit, 950, 0.06), to: 380, sweep: 0.2, q: 0.9, gain: 0.7, decay: 0.22, grit: true });
      tone(kit, out, at, { from: near(kit, 110, 0.05), to: 42, gain: 0.85, decay: 0.3, grit: true });
      noise(kit, out, at, {
        noise: 'pink',
        filter: 'lowpass',
        from: 1400,
        to: 300,
        sweep: 0.8,
        gain: 0.25,
        attack: 0.02,
        decay: 0.8,
      });
      for (const [delay, f] of [
        [0.36, 1700],
        [0.5, 2700],
      ] as const)
        noise(kit, out, at, { from: f, q: 4, gain: 0.14, attack: 0.001, decay: 0.03, delay });
      break;
    case 'roar':
      // (Stage 5o) A breath of roaring flame, fifteen a second (they run together into one roar), and now
      // and then a crackle.
      noise(kit, out, at, {
        noise: 'pink',
        filter: 'lowpass',
        from: near(kit, 1100, 0.15),
        to: 500,
        sweep: 0.15,
        q: 0.6,
        gain: 0.32,
        attack: 0.025,
        decay: 0.14,
      });
      noise(kit, out, at, {
        noise: 'brown',
        filter: 'lowpass',
        from: 260,
        q: 0.7,
        gain: 0.35,
        attack: 0.03,
        decay: 0.12,
        grit: true,
      });
      if (kit.random() < 0.35) crackles(kit, out, at, 1, 0.1, 0.12);
      break;
    case 'hum':
      // (Stage 5n) An attacker's orb leaving: a hum that rises, and a crackle.
      tone(kit, out, at, { wave: 'sawtooth', from: 140, to: 420, sweep: 0.35, gain: 0.12, attack: 0.03, decay: 0.4 });
      noise(kit, out, at, { noise: 'pink', from: 1800, to: 3200, q: 2, gain: 0.15, attack: 0.02, decay: 0.3 });
      break;
    default:
      // The stick, a grenade, smoke, a flare: a whoosh, rising and falling.
      noise(kit, out, at, {
        noise: 'pink',
        from: near(kit, 450, 0.1),
        to: 1400,
        sweep: 0.12,
        q: 1.4,
        gain: 0.3,
        attack: 0.05,
        decay: 0.16,
      });
  }
}

/**
 * A BLAST (stage 4f, rebuilt in 5k), as large as its radius (m; the launcher's is 3.5), in five layers:
 * the crack; the thump (a sine from 90 Hz down to 30, through the soft clip: felt and, by its
 * harmonics, heard); the roar (brown noise under a filter that closes from 2.4 kHz to 180 Hz over a
 * second and a half, crackling); the rumble that stays (under 120 Hz, three seconds); and what falls
 * after (grit and a few chunks, from a third of a second to two). Far away, audio.ts takes the highs
 * off and lets the place's echo carry it.
 */
export function blast(kit: Kit, out: AudioNode, at: number, radius = 3.5) {
  const size = Math.max(0.5, Math.min(2, radius / 3.5));
  noise(kit, out, at, { filter: 'highpass', from: 1200, gain: 0.9, attack: 0.0005, decay: 0.03 });
  tone(kit, out, at, {
    from: near(kit, 90, 0.06) / Math.sqrt(size),
    to: 30,
    sweep: 0.4,
    gain: 1,
    attack: 0.004,
    decay: 0.9 * size,
    grit: true,
  });
  noise(kit, out, at, {
    noise: 'brown',
    filter: 'lowpass',
    from: 2400,
    to: 180,
    sweep: 1.6,
    q: 0.7,
    gain: 1,
    attack: 0.006,
    decay: 2 * size,
    grit: true,
  });
  // The roar's crackle: short bands of noise, scattered over its first half second.
  for (let i = 0; i < 9; i++)
    noise(kit, out, at, {
      noise: 'pink',
      from: 400 + 1800 * kit.random(),
      q: 2,
      gain: 0.35 * (1 - i / 10),
      attack: 0.002,
      decay: 0.03 + 0.05 * kit.random(),
      delay: 0.02 + 0.5 * kit.random() * kit.random(),
    });
  noise(kit, out, at, { noise: 'brown', filter: 'lowpass', from: 120, q: 0.5, gain: 0.7, attack: 0.12, decay: 3 * size });
  // What falls after: grit, and a few chunks.
  crackles(kit, out, at + 0.3, Math.round(16 * size), 1.6, 0.1, 1800, 5000);
  for (let i = 0; i < 4; i++)
    tone(kit, out, at, { from: near(kit, 140, 0.3), to: 70, gain: 0.12, decay: 0.07, delay: 0.4 + 1.2 * kit.random() });
}

/** A DOOR (stage 3f, 5k): a creak that bends, the latch, and the weight of it. */
export function door(kit: Kit, out: AudioNode, at: number) {
  tone(kit, out, at, { wave: 'sawtooth', from: near(kit, 210, 0.05), to: 140, gain: 0.05, attack: 0.08, decay: 0.55 });
  noise(kit, out, at, { from: 700, to: 450, q: 6, gain: 0.08, attack: 0.08, decay: 0.5 });
  noise(kit, out, at, { from: 2200, q: 4, gain: 0.15, attack: 0.001, decay: 0.03 });
  tone(kit, out, at, { from: 90, to: 60, gain: 0.25, decay: 0.15, delay: 0.55 });
}

/** A LIFT (stage 3f): its motor's hum and its rattle. */
export function lift(kit: Kit, out: AudioNode, at: number) {
  tone(kit, out, at, { wave: 'square', from: 70, to: 76, gain: 0.07, attack: 0.1, decay: 0.8 });
  tone(kit, out, at, { wave: 'sawtooth', from: 140, to: 150, gain: 0.03, attack: 0.1, decay: 0.8 });
  noise(kit, out, at, { from: 500, q: 1, gain: 0.05, attack: 0.1, decay: 0.8 });
}

/** SOMETHING BREAKING (stage 3e): the crack, and the shards, each its own small ring. */
export function shatter(kit: Kit, out: AudioNode, at: number) {
  noise(kit, out, at, { filter: 'highpass', from: 3000, gain: 0.6, attack: 0.0005, decay: 0.05 });
  noise(kit, out, at, { from: 4000, q: 0.7, gain: 0.5, decay: 0.35 });
  for (let i = 0; i < 12; i++)
    tone(kit, out, at, {
      from: 2200 + 4500 * kit.random(),
      gain: 0.08,
      decay: 0.1 + 0.25 * kit.random(),
      delay: 0.25 * kit.random(),
    });
}

/**
 * A GUARD'S CALL (stage 5e, made a voice in 5k): a buzz (a sawtooth, a voice's folds) through two
 * bands where a voice's "a" and "e" resonate (its formants), the pitch rising and falling as a shout's
 * does, and breath under it.
 */
export function shout(kit: Kit, out: AudioNode, at: number) {
  const c = kit.context;
  const pitch = near(kit, 190, 0.12);
  for (const [delay, seconds, f1, f2] of [
    [0, 0.2, 750, 1250],
    [0.24, 0.32, 600, 1900],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    const t = at + delay;
    osc.frequency.setValueAtTime(pitch * 1.1, t);
    osc.frequency.linearRampToValueAtTime(pitch * 1.25, t + seconds * 0.3);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.85, t + seconds);
    const env = envelope(kit, t, 0.8, 0.02, seconds);
    for (const f of [f1, f2]) {
      const band = c.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = f;
      band.Q.value = 7;
      osc.connect(band).connect(env);
    }
    env.connect(out);
    osc.start(t);
    osc.stop(t + seconds + 0.05);
  }
  noise(kit, out, at, { from: 1400, q: 1.5, gain: 0.06, attack: 0.03, decay: 0.45 });
}

/**
 * A VOICE'S SYLLABLE (stage 5l): a buzz through two formant bands (as `shout`), its pitch from `from` to
 * `to` times its own over `seconds`, as loud as `gain`, `delay` after `at`.
 */
function syllable(
  kit: Kit,
  out: AudioNode,
  at: number,
  o: { pitch: number; from: number; to: number; seconds: number; f1: number; f2: number; gain: number; delay?: number },
) {
  const c = kit.context;
  const t = at + (o.delay ?? 0);
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(o.pitch * o.from, t);
  osc.frequency.exponentialRampToValueAtTime(o.pitch * o.to, t + o.seconds);
  const env = envelope(kit, t, o.gain, 0.03, o.seconds);
  for (const f of [o.f1, o.f2]) {
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = 8;
    osc.connect(band).connect(env);
  }
  env.connect(out);
  osc.start(t);
  osc.stop(t + o.seconds + 0.05);
}

/** A GUARD'S "HUH?" (stage 5l): suspicious, a short hum rising in pitch, as a question does. */
export function huh(kit: Kit, out: AudioNode, at: number) {
  const pitch = near(kit, 150, 0.1);
  syllable(kit, out, at, { pitch, from: 0.9, to: 1.45, seconds: 0.32, f1: 500, f2: 1100, gain: 0.7 });
  noise(kit, out, at, { from: 1200, q: 1.5, gain: 0.04, attack: 0.02, decay: 0.25 });
}

/** A GUARD'S "NOTHING" (stage 5l): letting it go, a falling hum and a breath out, as a shrug. */
export function calm(kit: Kit, out: AudioNode, at: number) {
  const pitch = near(kit, 140, 0.1);
  syllable(kit, out, at, { pitch, from: 1.15, to: 0.8, seconds: 0.5, f1: 450, f2: 900, gain: 0.5 });
  noise(kit, out, at, { from: 900, to: 500, q: 1, gain: 0.08, attack: 0.05, decay: 0.5, delay: 0.1 });
}

/** A PEBBLE'S CLATTER (stage 5l): two or three small knocks on stone, each higher and softer. */
export function pebble(kit: Kit, out: AudioNode, at: number) {
  let delay = 0;
  for (let i = 0; i < 3; i++) {
    noise(kit, out, at, {
      from: near(kit, 2800, 0.2) * (1 + 0.15 * i),
      q: 5,
      gain: 0.5 / (1 + i),
      attack: 0.0008,
      decay: 0.03,
      delay,
    });
    tone(kit, out, at, { from: near(kit, 1800, 0.15), gain: 0.06 / (1 + i), decay: 0.04, delay });
    delay += 0.08 + 0.07 * kit.random();
  }
}

/**
 * A RELOAD (stage 5o), in two parts, as the world says them: the old magazine out (a release's click and
 * the slide of it coming free), and later the new one `in` (a slap, a lower knock, and the action worked,
 * two clicks back and forth).
 */
export function reload(kit: Kit, out: AudioNode, at: number, goingIn: boolean) {
  if (!goingIn) {
    noise(kit, out, at, { from: near(kit, 2300, 0.08), q: 6, gain: 0.4, attack: 0.001, decay: 0.025 });
    noise(kit, out, at, { from: 1300, to: 700, sweep: 0.14, q: 1.5, gain: 0.16, attack: 0.02, decay: 0.12, delay: 0.06 });
    return;
  }
  noise(kit, out, at, { from: near(kit, 900, 0.1), q: 2, gain: 0.5, attack: 0.001, decay: 0.04 });
  tone(kit, out, at, { from: near(kit, 190, 0.08), to: 120, gain: 0.25, decay: 0.06 });
  for (const [delay, f] of [
    [0.16, 1500],
    [0.27, 2600],
  ] as const)
    noise(kit, out, at, { from: f, q: 4, gain: 0.3, attack: 0.001, decay: 0.03, delay });
}

/**
 * A HORN (stage 5o), the wall's alarm: a low brass note (a sawtooth at 98 Hz under a filter that opens as it
 * swells and closes as it dies), its fifth above it, softer, and the breath in it; a second and a half.
 */
export function horn(kit: Kit, out: AudioNode, at: number) {
  const c = kit.context;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(300, at);
  filter.frequency.linearRampToValueAtTime(1400, at + 0.35);
  filter.frequency.exponentialRampToValueAtTime(400, at + 1.5);
  filter.connect(out);
  tone(kit, filter, at, { wave: 'sawtooth', from: 98, to: 96, sweep: 1.4, gain: 0.5, attack: 0.18, decay: 1.3 });
  tone(kit, filter, at, { wave: 'sawtooth', from: 147, to: 144, sweep: 1.4, gain: 0.22, attack: 0.22, decay: 1.2 });
  noise(kit, out, at, { noise: 'pink', from: 700, q: 1, gain: 0.05, attack: 0.15, decay: 1.1 });
}

/** A WEAPON RAISED (stage 5i): a metal click and a short rising whine, the warning. */
export function ready(kit: Kit, out: AudioNode, at: number) {
  noise(kit, out, at, { from: 2600, q: 6, gain: 0.5, attack: 0.001, decay: 0.03 });
  noise(kit, out, at, { from: 1600, q: 4, gain: 0.25, attack: 0.001, decay: 0.02, delay: 0.05 });
  tone(kit, out, at, { wave: 'triangle', from: 520, to: 980, gain: 0.26, attack: 0.02, decay: 0.32, delay: 0.02 });
}

/** THE PAGE'S OWN HITS (stage 5i): a short tick for a hit; a deeper thud and a low chime for bringing someone down. */
export function struck(kit: Kit, out: AudioNode, at: number, down: boolean) {
  if (down) {
    tone(kit, out, at, { wave: 'triangle', from: 320, to: 120, gain: 0.35, decay: 0.22 });
    noise(kit, out, at, { from: 700, q: 1.2, gain: 0.25, decay: 0.12 });
    tone(kit, out, at, { from: 880, gain: 0.08, decay: 0.3, delay: 0.03 });
  } else {
    tone(kit, out, at, { wave: 'square', from: 1900, to: 1500, gain: 0.18, decay: 0.05 });
    noise(kit, out, at, { filter: 'highpass', from: 4000, gain: 0.1, attack: 0.0005, decay: 0.01 });
  }
}

/**
 * HOW NEAR A SHOT PASSED A POINT (stage 5k): the shot from `start` to `end`, the point `at` (the ears).
 * The point of the segment nearest `at` is at t = (at − start)·v / |v|² along it (v = end − start), held
 * within [0, 1]; the distance from there. Null if that nearest point is its end: it struck before it got
 * past (a shot that hit you, or the wall in front of you, did not go by).
 */
export function passedBy(
  start: readonly number[],
  end: readonly number[],
  at: readonly number[],
): { distance: number; point: number[] } | null {
  const v = [end[0]! - start[0]!, end[1]! - start[1]!, end[2]! - start[2]!];
  const length2 = v[0]! ** 2 + v[1]! ** 2 + v[2]! ** 2;
  if (length2 < 1e-12) return null;
  const t = ((at[0]! - start[0]!) * v[0]! + (at[1]! - start[1]!) * v[1]! + (at[2]! - start[2]!) * v[2]!) / length2;
  if (t >= 1) return null;
  const k = Math.max(0, t);
  const point = [start[0]! + k * v[0]!, start[1]! + k * v[1]!, start[2]! + k * v[2]!];
  return { distance: Math.hypot(point[0]! - at[0]!, point[1]! - at[1]!, point[2]! - at[2]!), point };
}

/** The speed of sound in air at 20 °C (m/s): a far blast is seen before it is heard. */
export const SPEED_OF_SOUND = 343;

/**
 * HOW A SOUND ARRIVES FROM `distance` m, when it is heard as far as `reach` (stage 5k): the direct sound
 * falls as the square of what is left of the reach; the air takes the highs off first (a low-pass from
 * 18 kHz near down to 700 Hz at the edge); the place's echo falls more slowly (its square root), so a
 * far sound is mostly echo; and it comes late, at the speed of sound. Null past its reach.
 */
export function heardFrom(distance: number, reach: number): { dry: number; wet: number; cutoff: number; delay: number } | null {
  if (!(distance < reach)) return null;
  const left = 1 - Math.max(0, distance) / reach;
  return {
    dry: left * left,
    wet: Math.sqrt(left),
    cutoff: 700 + 17300 * left * left,
    delay: Math.max(0, distance) / SPEED_OF_SOUND,
  };
}

/**
 * WHAT A PLACE GIVES BACK (stage 5k): an impulse response for a convolution reverb, made, not recorded.
 * A few early reflections (the walls nearest: 11 to 53 ms, each its own way in each ear), then a tail of
 * noise falling by 60 dB over `seconds` (its RT60, the measure of a room's reverberation), its highs
 * dying sooner (a filter closing from 12 kHz to 2 kHz along it, as air and stone absorb them). The two
 * ears get different noise: the echo is wide, not in the middle of the head.
 */
export function impulseResponse(
  sampleRate: number,
  seconds: number,
  random: () => number = Math.random,
): [Float32Array, Float32Array] {
  const n = Math.max(1, Math.round(sampleRate * seconds));
  const k = Math.log(1000) / seconds;
  const taps = [
    [0.011, 0.6],
    [0.019, 0.45],
    [0.027, 0.4],
    [0.041, 0.3],
    [0.053, 0.25],
  ] as const;
  return [0, 1].map((ear) => {
    const data = new Float32Array(n);
    let y = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      const fc = 12000 * Math.pow(2000 / 12000, t / seconds);
      const a = Math.exp((-2 * Math.PI * fc) / sampleRate);
      y = (1 - a) * (random() * 2 - 1) * Math.exp(-k * t) + a * y;
      data[i] = y;
    }
    for (const [t, g] of taps) {
      const i = Math.round((t + (ear ? 0.0035 : 0)) * sampleRate * (ear ? 1.07 : 1));
      if (i < n) data[i] = data[i]! + g * (ear ? -1 : 1);
    }
    return data;
  }) as [Float32Array, Float32Array];
}
