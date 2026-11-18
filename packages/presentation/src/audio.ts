import type { VariableInfo } from '@manifold/commands';
import type { Event, World } from '@manifold/core';
import type { GamePage, Piece } from './page';
import * as synth from './synth';

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

/**
 * How much of each kind of sound goes to the place's echo (stage 5k): a step hardly, a shot a good
 * part, a blast most (it is the echo that tells how large it was).
 */
const ECHO: Readonly<Record<string, number>> = {
  step: 0.08,
  land: 0.15,
  hit: 0.25,
  impact: 0.3,
  door: 0.3,
  lift: 0.2,
  break: 0.35,
  blast: 0.9,
  shout: 0.4,
  ready: 0.2,
  fired: 0.55,
  whiz: 0.1,
};
/** The place's echo: how long it rings (s, its RT60), and how loud it comes back. */
const ROOM = { seconds: 1.6, gain: 0.5 };
/**
 * A shot passing within this many meters of the ears is heard going by (a fair gunner's first shot passes
 * 0.8 m to a side of its target, with an error as wide as 10° when it has just seen them: at 15 m, up to
 * 3.5 m off).
 */
const WHIZ = 4;
/** How far a rocket in flight is heard (m), and how loud its hiss is up close. */
const ROCKET = { heard: 30, gain: 0.22 };

/**
 * THE SOUND (stage 3f, decision 0015; rebuilt in 5k, decision 0031): what the simulation says happened,
 * made in the browser with Web Audio, without recorded files, each sound in layers (`synth.ts`: a
 * transient, a body, a low thump through a soft clip, and a tail). Heard from the camera as sound
 * travels (5k):
 *
 *   - quieter with distance, silent past the sound's own reach (and a little more, for how far the
 *     camera is behind the player), to the left or the right as it is;
 *   - the air takes the highs off with distance, and a far sound comes late, at 343 m/s (a far blast is
 *     seen before it is heard);
 *   - every sound sends a share to THE PLACE'S ECHO (a convolution reverb from a made impulse response),
 *     which falls with distance more slowly than the sound itself: far, it is mostly echo;
 *   - all of it through a compressor, which keeps many at once from clipping and gives them punch.
 *
 * Besides the world's sounds and the weapons used (`fired`): where a shot strikes what does not live, a
 * tick (and now and then a ricochet); a shot that passes near the ears, its whine; a rocket in flight,
 * its hiss following it, higher coming and lower going (Doppler). The browser lets audio start only
 * after a key or a click: until then nothing is made. (For the browser tests: `data-sounds`, how many
 * it made, `data-sound`, the last; `data-whizzes`, `data-echo`, the echo's RT60.)
 */
export function mountAudio(page: GamePage): Piece {
  // The page's mixer (stage 5b): its context, made on the first key or click, and the sounds' channel.
  let context: AudioContext | null = null;
  let kit: synth.Kit | null = null;
  let bus: GainNode | null = null;
  let echo: GainNode | null = null;
  let made = 0;
  let whizzes = 0;
  /** The rockets heard in flight: each its hiss, its pan, its gain, its rate. */
  const rockets = new Map<number, { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; last: number }>();
  page.mixer.volume('sounds', Number(AUDIO_VARIABLES.volume.default));
  page.registry.declareVariable({ ...AUDIO_VARIABLES.volume, onChange: (v) => page.mixer.volume('sounds', Number(v)) });
  page.mixer.onStart((c) => {
    const master = page.mixer.channel('sounds');
    if (!master) return;
    context = c;
    kit = synth.makeKit(c);
    // Everything into a compressor, then the channel.
    const squeeze = c.createDynamicsCompressor();
    squeeze.threshold.value = -14;
    squeeze.knee.value = 12;
    squeeze.ratio.value = 4;
    squeeze.attack.value = 0.003;
    squeeze.release.value = 0.25;
    squeeze.connect(master);
    bus = c.createGain();
    bus.connect(squeeze);
    // The place's echo.
    const reverb = c.createConvolver();
    const [left, right] = synth.impulseResponse(c.sampleRate, ROOM.seconds);
    const ir = c.createBuffer(2, left.length, c.sampleRate);
    ir.copyToChannel(left as Float32Array<ArrayBuffer>, 0);
    ir.copyToChannel(right as Float32Array<ArrayBuffer>, 1);
    reverb.buffer = ir;
    const back = c.createGain();
    back.gain.value = ROOM.gain;
    reverb.connect(back).connect(squeeze);
    echo = c.createGain();
    echo.connect(reverb);
    page.container.dataset.echo = ROOM.seconds.toFixed(1);
  });

  const live = () =>
    !!context && !!kit && !!bus && !!echo && context.state === 'running' && page.mixer.channel('sounds')!.gain.value > 0;

  /** The camera, where the ears are: its place and its right. */
  const ears = () => {
    const camera = page.stage.camera;
    const m = camera.matrixWorld.elements;
    return { at: camera.position, right: [m[0]!, m[1]!, m[2]!] as const };
  };

  /**
   * A sound at `at`, heard as far as `radius`: its chain from the ears' point of view (late by the
   * distance, its highs taken off, to its side, and its share to the echo), or null if it is not heard.
   */
  const placed = (at: readonly number[], radius: number, kind: string, loud = 1): { out: AudioNode; when: number } | null => {
    if (!live()) return null;
    const c = context!;
    const { at: listener, right } = ears();
    const dx = at[0]! - listener.x;
    const dy = at[1]! - listener.y;
    const dz = at[2]! - listener.z;
    const d = Math.hypot(dx, dy, dz);
    // (A little more room than its radius, for how far the camera is behind the player.)
    const h = synth.heardFrom(d, radius + 6);
    if (!h) return null;
    const pan = d > 1e-6 ? Math.max(-1, Math.min(1, (dx * right[0] + dy * right[1] + dz * right[2]) / d)) : 0;
    const input = c.createGain();
    input.gain.value = loud;
    const air = c.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = h.cutoff;
    air.Q.value = 0.5;
    const side = c.createStereoPanner();
    side.pan.value = pan * 0.8;
    const dry = c.createGain();
    dry.gain.value = h.dry;
    const wet = c.createGain();
    wet.gain.value = h.wet * (ECHO[kind] ?? 0.2);
    input.connect(air).connect(side);
    side.connect(dry).connect(bus!);
    side.connect(wet).connect(echo!);
    // The chain lets go once its sound is over (a few seconds at most, a blast's tail).
    return { out: input, when: c.currentTime + 0.01 + h.delay };
  };
  const counted = (name: string) => {
    made++;
    page.container.dataset.sounds = String(made);
    page.container.dataset.sound = name;
  };

  /** One of the world's sounds, made. */
  const make = (s: Sound) => {
    const p = placed(s.at, s.radius, s.sound);
    if (!p) return;
    const k = kit!;
    switch (s.sound) {
      case 'step':
        synth.step(k, p.out, p.when, s.surface, Math.min(1.4, 0.6 + s.speed / 10));
        break;
      case 'land':
        synth.land(k, p.out, p.when, s.surface, Math.min(1.6, 0.5 + s.speed / 10));
        break;
      case 'hit':
        synth.hit(k, p.out, p.when, s.surface, Math.min(1, Math.sqrt(s.energy) / 1.5));
        break;
      case 'door':
        synth.door(k, p.out, p.when);
        break;
      case 'lift':
        synth.lift(k, p.out, p.when);
        break;
      case 'break':
        synth.shatter(k, p.out, p.when);
        break;
      case 'blast':
        synth.blast(k, p.out, p.when);
        break;
      case 'shout':
        synth.shout(k, p.out, p.when);
        break;
      case 'ready':
        synth.ready(k, p.out, p.when);
        break;
    }
    counted(`${s.sound} ${s.surface ?? ''}`.trim());
  };

  /** What a shot struck, by what it is made of (its body's material), or null if it lives. */
  const struckSurface = (id: number | null): string | null | false => {
    if (id === null) return null;
    const e = page.session.world.entities.get(id);
    if (e?.health) return false;
    return e?.body?.material ?? null;
  };

  /** A shot from `start` to `end`: if it passed near the ears (and not from the page's own character), its whine. */
  const passing = (from: number, start: readonly number[], end: readonly number[]) => {
    const hero = page.player();
    if (hero && from === hero.id) return;
    const { at: l } = ears();
    const by = synth.passedBy(start, end, [l.x, l.y, l.z]);
    if (!by || by.distance > WHIZ) return;
    const p = placed(by.point, WHIZ + 2, 'whiz');
    if (!p) return;
    synth.whiz(kit!, p.out, p.when, 1 - by.distance / WHIZ);
    page.container.dataset.whizzes = String(++whizzes);
  };

  /** A rocket's hiss, following it: louder near, to its side, its pitch by how fast it comes or goes. */
  const rocketsHeard = (world: World) => {
    const seen = new Set<number>();
    if (live()) {
      const c = context!;
      const { at: l, right } = ears();
      for (const e of world.entities.values()) {
        if (e.projectile?.kind !== 'rocket' || !e.transform) continue;
        const [x, y, z] = e.transform.position;
        const d = Math.hypot(x - l.x, y - l.y, z - l.z);
        const h = synth.heardFrom(d, ROCKET.heard);
        if (!h) continue;
        seen.add(e.id);
        let r = rockets.get(e.id);
        if (!r) {
          const source = c.createBufferSource();
          source.buffer = kit!.pink;
          source.loop = true;
          const band = c.createBiquadFilter();
          band.type = 'bandpass';
          band.frequency.value = 1600;
          band.Q.value = 1.2;
          const gain = c.createGain();
          gain.gain.value = 0;
          const pan = c.createStereoPanner();
          source.connect(band).connect(gain).connect(pan).connect(bus!);
          source.start(c.currentTime, kit!.random());
          r = { source, gain, pan, last: d };
          rockets.set(e.id, r);
        }
        // Coming nearer, higher; going, lower: f' = f · c / (c + v), v the rate the distance grows.
        const v = e.projectile.velocity;
        const toward = d > 1e-6 ? ((x - l.x) * v[0] + (y - l.y) * v[1] + (z - l.z) * v[2]) / d : 0;
        r.source.playbackRate.setTargetAtTime(
          synth.SPEED_OF_SOUND / Math.max(100, synth.SPEED_OF_SOUND + toward),
          c.currentTime,
          0.03,
        );
        r.gain.gain.setTargetAtTime(ROCKET.gain * h.dry, c.currentTime, 0.03);
        r.pan.pan.setTargetAtTime(
          d > 1e-6 ? (0.8 * ((x - l.x) * right[0] + (y - l.y) * right[1] + (z - l.z) * right[2])) / d : 0,
          c.currentTime,
          0.03,
        );
        r.last = d;
      }
    }
    for (const [id, r] of rockets)
      if (!seen.has(id)) {
        if (context) r.source.stop(context.currentTime + 0.05);
        rockets.delete(id);
      }
  };

  return {
    event(ev) {
      if (!live()) return;
      if (ev.type === 'hurt' || ev.type === 'down') {
        // (Stage 5i) The page's own hits, heard: not placed (they are about the shot, as the marker is).
        const hero = page.player();
        if (hero && ev.from === hero.id && ev.target !== hero.id)
          synth.struck(kit!, bus!, context!.currentTime + 0.01, ev.type === 'down');
        return;
      }
      if (ev.type === 'fired') {
        const p = placed(ev.at, firedHeard(ev.kind), 'fired');
        if (!p) return;
        synth.fired(kit!, p.out, p.when, ev.kind);
        counted(`fired ${ev.kind}`);
        return;
      }
      if (ev.type === 'shot') {
        passing(ev.from, ev.start, ev.end);
        const surface = struckSurface(ev.hit);
        if (surface === false || ev.hit === null) return;
        const p = placed(ev.end, 18, 'impact');
        if (p) synth.impact(kit!, p.out, p.when, surface);
        return;
      }
      if (ev.type === 'impact') {
        if (ev.kind === 'rocket') return;
        const surface = struckSurface(ev.hit);
        if (surface === false) return;
        const p = placed(ev.at, 18, 'impact');
        if (p) synth.impact(kit!, p.out, p.when, surface);
        return;
      }
      if (ev.type === 'sound') make(ev);
    },
    frame({ world }) {
      rocketsHeard(world);
    },
    stop() {
      for (const r of rockets.values()) r.source.stop();
      rockets.clear();
    },
  };
}
