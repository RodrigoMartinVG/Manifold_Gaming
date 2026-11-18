import type { GamePage, Piece } from './page';

/** How much of each layer of the background sounds there is (0 to 1). */
export interface AmbienceLayers {
  wind: number;
  crickets: number;
  birds: number;
  owl: number;
}

/**
 * THE BACKGROUND SOUNDS BY THE HOUR (stage 5j, decision 0031: "a constant bed per zone, plus intermittent
 * details, plus rare sweeteners"): wind always; birds at dusk and at dawn, fewer as the light goes;
 * crickets from the evening through the night; now and then an owl, deep in the night. Without a sky
 * (a lab), only a little wind. A pure function: a test hears it without a speaker.
 */
export function ambienceAt(hour: number | null): AmbienceLayers {
  if (hour === null) return { wind: 0.15, crickets: 0, birds: 0, owl: 0 };
  const h = ((hour % 24) + 24) % 24;
  /** 1 inside [a, b], falling to 0 over `soft` hours on each side (round midnight too). */
  const between = (a: number, b: number, soft: number) => {
    const d = a <= b ? (h < a ? a - h : h > b ? h - b : 0) : h > b && h < a ? Math.min(h - b, a - h) : 0;
    return Math.max(0, 1 - d / soft);
  };
  return {
    wind: 0.35,
    crickets: between(20, 4.5, 1.5),
    birds: Math.max(between(17, 19, 1), between(5.5, 7.5, 1)),
    owl: between(22, 3.5, 1),
  };
}

/** How loud the whole bed is, under the sounds' volume (it accompanies; the sounds tell what happens). */
const BED = 0.35;

/**
 * THE BACKGROUND SOUNDS (stage 5j): a bed of wind (noise through a low band, its loudness wandering
 * slowly), and what comes now and then over it, each at a side, never twice the same: crickets' chirps
 * at night, birds' at dusk and dawn, an owl's two hoots. By the hour of the world's sky (`ambienceAt`),
 * the wind stronger the higher the page's character is (a tower's top is windy). Through the sounds'
 * channel, so their volume rules it. Only the view. For the browser tests, `data-ambience`: the
 * layers now, and `data-calls`: how many came.
 */
export function mountAmbience(page: GamePage): Piece {
  let context: AudioContext | null = null;
  let windGain: GainNode | null = null;
  let layers = ambienceAt(null);
  let gust = 0.5;
  let calls = 0;
  const due = { crickets: 0, birds: 0, owl: 0 };

  page.mixer.onStart((c) => {
    context = c;
    const out = page.mixer.channel('sounds');
    if (!out) return;
    const noise = c.createBuffer(1, 2 * c.sampleRate, c.sampleRate);
    const data = noise.getChannelData(0);
    // Brown noise: soft at the top, as wind is.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = 3.5 * last;
    }
    const source = c.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    const band = c.createBiquadFilter();
    band.type = 'lowpass';
    band.frequency.value = 420;
    windGain = c.createGain();
    windGain.gain.value = 0;
    source.connect(band).connect(windGain).connect(out);
    source.start();
  });

  /** One call over the bed, at `pan`: a few tones, each from a frequency to another, as loud as `gain`. */
  const call = (tones: readonly [from: number, to: number, start: number, seconds: number][], gain: number, pan: number) => {
    const out = page.mixer.channel('sounds');
    if (!context || !out) return;
    const at = context.currentTime + 0.02;
    const side = context.createStereoPanner();
    side.pan.value = pan;
    side.connect(out);
    for (const [from, to, start, seconds] of tones) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(from, at + start);
      osc.frequency.linearRampToValueAtTime(to, at + start + seconds);
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, at + start);
      envelope.gain.linearRampToValueAtTime(gain * BED, at + start + seconds * 0.2);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + start + seconds);
      osc.connect(envelope).connect(side);
      osc.start(at + start);
      osc.stop(at + start + seconds + 0.05);
    }
    page.container.dataset.calls = String(++calls);
  };
  const side = () => Math.random() * 1.6 - 0.8;

  return {
    frame({ world, dt }) {
      const hour = world.origin?.sky ?? null;
      layers = ambienceAt(hour);
      const hero = page.player();
      const height = hero?.transform ? Math.max(0, hero.transform.position[1]) : 0;
      page.container.dataset.ambience = `${layers.wind.toFixed(2)} ${layers.crickets.toFixed(2)} ${layers.birds.toFixed(2)} ${layers.owl.toFixed(2)}`;
      if (!context || context.state !== 'running' || !windGain) return;
      // The wind wanders, and rises with height (twice as strong 20 m up).
      gust = Math.max(0.2, Math.min(1, gust + (Math.random() - 0.5) * dt * 0.8));
      const wind = layers.wind * gust * (1 + height / 20) * BED;
      windGain.gain.setTargetAtTime(wind, context.currentTime, 0.4);
      // What comes over it, each when its time comes (sooner the more of it there is).
      for (const kind of ['crickets', 'birds', 'owl'] as const) {
        const amount = layers[kind];
        if (amount <= 0.02) continue;
        due[kind] -= dt;
        if (due[kind] > 0) continue;
        if (kind === 'crickets') {
          // Three quick high pulses.
          const f = 4300 + 600 * Math.random();
          call(
            [0, 0.07, 0.14].map((s) => [f, f * 0.98, s, 0.05] as [number, number, number, number]),
            0.08 * amount,
            side(),
          );
          due.crickets = (0.3 + 0.6 * Math.random()) / amount;
        } else if (kind === 'birds') {
          // Two or three quick rising and falling notes.
          const f = 2400 + 1600 * Math.random();
          call(
            [
              [f, f * 1.3, 0, 0.12],
              [f * 1.25, f * 0.9, 0.15, 0.14],
            ],
            0.1 * amount,
            side(),
          );
          due.birds = (1.5 + 3 * Math.random()) / amount;
        } else {
          // Two low hoots, the second longer.
          call(
            [
              [420, 380, 0, 0.35],
              [430, 360, 0.55, 0.6],
            ],
            0.18 * amount,
            side(),
          );
          due.owl = (9 + 8 * Math.random()) / amount;
        }
      }
    },
  };
}
