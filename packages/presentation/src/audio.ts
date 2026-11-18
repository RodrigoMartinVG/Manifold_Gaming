import type { VariableInfo } from '@manifold/commands';
import type { Event } from '@manifold/core';
import type { GamePage, Piece } from './page';

/** What the sound lets people change, as data (the site's console reference reads it). */
export const AUDIO_VARIABLES = {
  volume: {
    name: 'view.volume',
    description:
      'How loud the sounds are, from 0 (none) to 1 (stage 3f). They are made in the browser from what the simulation says happened (a step on metal, a hit, a door), without recorded files; the browser lets them be heard once a key is pressed or the page is clicked.',
    scope: 'view',
    type: { kind: 'number', min: 0, max: 1 },
    default: 0.6,
  },
} as const satisfies Record<string, VariableInfo>;

type Sound = Extract<Event, { type: 'sound' }>;

/**
 * How far a weapon used (stage 5g: `fired`) is heard (m), by its kind: what fires loudly, far; what is
 * swung or thrown, near. Only the view's (its sound, its subtitle): the world's sounds are its own.
 */
const FIRED_HEARD: Readonly<Record<string, number>> = { dart: 30, bolt: 20, shotgun: 45, launcher: 40 };
export const firedHeard = (kind: string) => FIRED_HEARD[kind] ?? 8;

/** The tone of a step or a hit on each surface: where its noise is (Hz), and a ring if it has one (Hz, and how long, s). */
const SURFACES: Record<string, { noise: number; q: number; ring?: [frequencies: number[], seconds: number] }> = {
  stone: { noise: 900, q: 1.2 },
  wood: { noise: 420, q: 3, ring: [[180, 360], 0.12] },
  metal: { noise: 2400, q: 6, ring: [[1830, 2770, 4120], 0.45] },
  glass: { noise: 3600, q: 8, ring: [[4200, 6100], 0.18] },
  ice: { noise: 3000, q: 0.8 },
};

/**
 * THE SOUND (stage 3f, decision 0015): what the simulation's sounds say, synthesized in the browser
 * with Web Audio (noise through a filter, a few partials that ring, envelopes), without recorded
 * files. A step's tone is its surface's (stone thuds, wood knocks, metal rings, glass tinkles, ice
 * crunches), as loud as how fast it went; a hit, as loud as its energy; a door creaks, a lift hums, a
 * break shatters. Heard from the camera, quieter with distance until the sound's own radius (and a
 * little more, for how far the camera is behind the player), to the left or the right as it is. The browser lets audio start only after a
 * key or a click: until then nothing is made. (For the browser tests: how many it made, and the last.)
 */
export function mountAudio(page: GamePage): Piece {
  // The page's mixer (stage 5b): its context, made on the first key or click, and the sounds' channel.
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let made = 0;
  page.mixer.volume('sounds', Number(AUDIO_VARIABLES.volume.default));
  page.registry.declareVariable({ ...AUDIO_VARIABLES.volume, onChange: (v) => page.mixer.volume('sounds', Number(v)) });
  page.mixer.onStart((c) => {
    context = c;
    master = page.mixer.channel('sounds');
    noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  });

  /** A burst of noise through a band, with a quick envelope. */
  const burst = (out: AudioNode, at: number, frequency: number, q: number, gain: number, seconds: number) => {
    const source = context!.createBufferSource();
    source.buffer = noise;
    const band = context!.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = frequency;
    band.Q.value = q;
    const envelope = context!.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    source.connect(band).connect(envelope).connect(out);
    source.start(at, Math.random() * 0.5);
    source.stop(at + seconds + 0.02);
  };
  /** A tone that rings and fades (a partial of metal, of wood, of glass). */
  const ring = (
    out: AudioNode,
    at: number,
    frequency: number,
    gain: number,
    seconds: number,
    type: OscillatorType = 'sine',
    to?: number,
  ) => {
    const osc = context!.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, at);
    if (to) osc.frequency.linearRampToValueAtTime(to, at + seconds);
    const envelope = context!.createGain();
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(gain, at + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
    osc.connect(envelope).connect(out);
    osc.start(at);
    osc.stop(at + seconds + 0.02);
  };

  /** One sound, made: through a gain for how loud it is from here, and a pan for which side. */
  const make = (s: Sound, loudness: number, pan: number) => {
    const at = context!.currentTime + 0.01;
    const out = context!.createGain();
    out.gain.value = loudness;
    const side = context!.createStereoPanner();
    side.pan.value = pan;
    out.connect(side).connect(master!);
    const surface = SURFACES[s.surface ?? 'stone'] ?? SURFACES.stone!;
    switch (s.sound) {
      case 'step':
      case 'land': {
        const hard = s.sound === 'land' ? 1.6 : 1;
        burst(out, at, surface.noise, surface.q, 0.5 * hard, 0.07 * hard);
        ring(out, at, 80 * hard, 0.35 * hard, 0.08);
        if (surface.ring) for (const f of surface.ring[0]) ring(out, at, f, 0.08, surface.ring[1]);
        break;
      }
      case 'hit': {
        const strength = Math.min(1, Math.sqrt(s.energy) / 1.5);
        burst(out, at, surface.noise * 0.8, surface.q, 0.6 * strength + 0.1, 0.12);
        ring(out, at, 110, 0.5 * strength + 0.1, 0.12);
        if (surface.ring) for (const f of surface.ring[0]) ring(out, at, f * 0.9, 0.15 * strength, surface.ring[1] * 1.5);
        break;
      }
      case 'door':
        ring(out, at, 220, 0.08, 0.6, 'sawtooth', 130);
        burst(out, at, 600, 2, 0.12, 0.5);
        break;
      case 'lift':
        ring(out, at, 70, 0.12, 0.9, 'square', 75);
        break;
      case 'break':
        burst(out, at, 4000, 0.7, 0.7, 0.35);
        for (let i = 0; i < 8; i++)
          ring(out, at + Math.random() * 0.2, 2200 + Math.random() * 4500, 0.12, 0.15 + Math.random() * 0.2);
        break;
      case 'blast':
        // (Stage 4f) A deep thump and a long rush of noise.
        ring(out, at, 45, 0.9, 0.7, 'sine', 30);
        burst(out, at, 900, 0.5, 0.9, 1.1);
        break;
      case 'shout':
        // (Stage 5e) A guard's call: two short voiced tones, falling, and breath.
        ring(out, at, 240, 0.12, 0.22, 'sawtooth', 200);
        ring(out, at + 0.24, 210, 0.12, 0.3, 'sawtooth', 170);
        burst(out, at, 1400, 1.5, 0.08, 0.4);
        break;
    }
    made++;
    page.container.dataset.sounds = String(made);
    page.container.dataset.sound = `${s.sound} ${s.surface ?? ''}`.trim();
  };

  /**
   * A weapon used (stage 5g: `fired`), heard: each kind its own, made like the rest. The dart cracks,
   * the bolt twangs, the shotgun booms (a low thump under a wide rush), the launcher thumps and its
   * rocket hisses away; what is swung or thrown is a whoosh.
   */
  const fire = (kind: string, loudness: number, pan: number) => {
    const at = context!.currentTime + 0.01;
    const out = context!.createGain();
    out.gain.value = loudness;
    const side = context!.createStereoPanner();
    side.pan.value = pan;
    out.connect(side).connect(master!);
    switch (kind) {
      case 'dart':
        burst(out, at, 3200, 0.9, 0.5, 0.06);
        ring(out, at, 170, 0.35, 0.09, 'sine', 70);
        break;
      case 'bolt':
        ring(out, at, 330, 0.2, 0.16, 'triangle', 210);
        burst(out, at, 1800, 2, 0.25, 0.05);
        break;
      case 'shotgun':
        ring(out, at, 75, 0.85, 0.32, 'sine', 38);
        burst(out, at, 650, 0.45, 0.9, 0.3);
        burst(out, at, 2600, 0.8, 0.35, 0.09);
        break;
      case 'launcher':
        ring(out, at, 95, 0.6, 0.3, 'sine', 50);
        burst(out, at + 0.03, 1300, 0.6, 0.35, 0.55);
        break;
      default:
        // The stick, a grenade, smoke, a flare: a whoosh.
        burst(out, at, 700, 0.7, 0.22, 0.18);
    }
    made++;
    page.container.dataset.sounds = String(made);
    page.container.dataset.sound = `fired ${kind}`;
  };

  /** How loud a sound at `at` is from the camera, and to which side; null past its reach. */
  const heard = (at: readonly number[], radius: number): { loudness: number; pan: number } | null => {
    // Heard from the camera: what the player sees is what it hears.
    const camera = page.stage.camera;
    const listener = camera.position;
    const dx = at[0]! - listener.x;
    const dy = at[1]! - listener.y;
    const dz = at[2]! - listener.z;
    const d = Math.hypot(dx, dy, dz);
    // Quieter with distance, silent past its radius (with a little more room for the camera's distance).
    const reach = radius + 6;
    if (d >= reach) return null;
    // Which side: the camera's right, as the screen has it.
    const right = {
      x: camera.matrixWorld.elements[0]!,
      y: camera.matrixWorld.elements[1]!,
      z: camera.matrixWorld.elements[2]!,
    };
    const pan = d > 1e-6 ? Math.max(-1, Math.min(1, (dx * right.x + dy * right.y + dz * right.z) / d)) : 0;
    return { loudness: (1 - d / reach) ** 2, pan: pan * 0.8 };
  };

  return {
    event(ev) {
      if (
        (ev.type !== 'sound' && ev.type !== 'fired') ||
        !context ||
        !master ||
        context.state !== 'running' ||
        master.gain.value === 0
      )
        return;
      if (ev.type === 'fired') {
        const h = heard(ev.at, firedHeard(ev.kind));
        if (h) fire(ev.kind, h.loudness, h.pan);
        return;
      }
      const h = heard(ev.at, ev.radius);
      if (h) make(ev, h.loudness, h.pan);
    },
  };
}
