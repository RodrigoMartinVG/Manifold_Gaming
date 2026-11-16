/**
 * SOUND WITHOUT FILES: a burst of noise through a band (where on the spectrum each surface is), and a
 * few tones that ring (metal rings long, wood short), with quick envelopes. Web Audio, in the browser:
 * it starts only after a click or a key (the browser's rule).
 */
const SURFACES: Record<string, { band: number; q: number; ring: number[]; seconds: number }> = {
  wood: { band: 420, q: 3, ring: [180, 360], seconds: 0.12 },
  stone: { band: 900, q: 1.2, ring: [], seconds: 0 },
  metal: { band: 2400, q: 6, ring: [1830, 2770, 4120], seconds: 0.45 },
};

let context: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** The audio, started (on the first click or key). */
export function startAudio() {
  if (context) return void context.resume();
  context = new AudioContext();
  noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

/** One sound, on a surface, as loud as `loudness` (0 to 1). */
export function play(surface: string, loudness: number) {
  if (!context || !noise || loudness <= 0) return;
  const s = SURFACES[surface] ?? SURFACES.stone!;
  const at = context.currentTime + 0.01;
  const out = context.createGain();
  out.gain.value = loudness;
  out.connect(context.destination);
  const source = context.createBufferSource();
  source.buffer = noise;
  const band = context.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = s.band;
  band.Q.value = s.q;
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(0.6, at + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.08);
  source.connect(band).connect(envelope).connect(out);
  source.start(at, Math.random() * 0.5);
  source.stop(at + 0.1);
  for (const f of s.ring) {
    const tone = context.createOscillator();
    tone.frequency.value = f;
    const fade = context.createGain();
    fade.gain.setValueAtTime(0.0001, at);
    fade.gain.exponentialRampToValueAtTime(0.08, at + 0.005);
    fade.gain.exponentialRampToValueAtTime(0.0001, at + s.seconds);
    tone.connect(fade).connect(out);
    tone.start(at);
    tone.stop(at + s.seconds + 0.02);
  }
}
