import * as THREE from 'three';
import type { Vec3 } from '@manifold/common';
import type { Event } from '@manifold/core';
import type { Bodies } from './bodies';
import { blastEffect, flameEffect, impactEffect, muzzleEffect, trailEffect, type Effect } from './effects';
import type { GamePage, Piece } from './page';
import { createParticles } from './particles';
import { addInterfaceStyles } from './ui';

/**
 * HOW A WEAPON FEELS (stage 5g; decision 0029: in a shooter the weapons are the heart). What the world
 * says a weapon did, shown, never changing it (the world's `fired`, `shot`, `impact`, `blast`, `hurt`
 * and `down` events):
 *
 *   - its flash: a short glow at the end of what fired, as large as the weapon is loud;
 *   - its kick: the page's own shots punch the view up and it comes back (what is aimed at does not
 *     move: the shot went where the aim was, and the next one goes where it is);
 *   - where it struck: sparks off what does not live, a pale burst off whoever it hurt;
 *   - a blast, seen: a ball of light that grows to most of its radius and fades;
 *   - a marker when it strikes: four short strokes round the crosshair when the page's own shot hurts
 *     someone, red on the head, larger when it brings them down;
 *   - (stage 5i, decision 0031) the flash lights what is round it for an instant (one light, kept and
 *     lit only then, so the scene's lights never change in number and nothing is compiled again);
 *   - (5i) a weapon raised to take aim (the world's `ready` sound) glints at its end: the warning before
 *     a fair gunner's shot, seen as well as heard;
 *   - (5i) a hit taken, or a blast near, shakes the view: a "trauma" that decays, the shake its square,
 *     smooth (turned off by `view.shake`, a comfort setting);
 *   - (stage 5k, decision 0031: the author asked for far better explosions) all of it drawn as PARTICLES
 *     (particles.ts, effects.ts): a blast is a flash, a fireball, sparks and embers, smoke that rises,
 *     and near the ground a ring, dust and a scorch; the flash's light flares with it, orange, larger,
 *     flickering out (the same light: the scene's lights never change in number);
 *     a weapon's flash has rays, the large ones throw sparks, and each leaves a breath of smoke; where a
 *     shot strikes, sparks bounce off and the surface's dust puffs; a rocket leaves a trail. Two draws
 *     for all of it, however many.
 *
 * Mounted right after the camera (its kick turns the camera as that piece placed it for the frame). Its
 * sound is the audio's (audio.ts: `fired`). For the browser tests: `data-hits` and `data-downs`
 * (the markers shown), `data-flashes`, `data-kick` (the view's kick now, in degrees), `data-readies`
 * (the glints shown), `data-trauma` (the shake's trauma now), and (5k) `data-blasts`, `data-scorches`
 * (the blasts seen, the scorches left), `data-particles` (how many live) and `data-flare` (the blast
 * light's brightest yet); (5o) `data-flames`, the flame lance's breaths seen.
 */

/** Each kind's flash (m across; none for what is thrown or swung) and kick (degrees up). */
export const FEEL: Readonly<Record<string, { flash: number; kick: number }>> = Object.freeze({
  dart: { flash: 0.14, kick: 1.2 },
  bolt: { flash: 0.1, kick: 2 },
  shotgun: { flash: 0.34, kick: 6 },
  launcher: { flash: 0.28, kick: 4.5 },
  // (Stage 5n) Quick and light; the orb's, an attacker's, has no flash (it glows itself).
  repeater: { flash: 0.12, kick: 0.7 },
  orb: { flash: 0, kick: 0 },
  // (Stage 5o) The longshot, a heavy flash and a hard kick; the flame lance, its flames instead (`flameEffect`).
  longshot: { flash: 0.2, kick: 3.5 },
  flamer: { flash: 0, kick: 0.2 },
  stick: { flash: 0, kick: 0 },
  grenade: { flash: 0, kick: 0.6 },
  smoke: { flash: 0, kick: 0.6 },
  flare: { flash: 0, kick: 0.6 },
});

/** How long a marker shows (s); how fast a kick comes back (its time constant, s). */
const MARKER = 0.18;
const KICK_BACK = 0.09;
/** At most this kick at once (degrees): shots in a row do not throw the view over. */
const MOST_KICK = 10;
/** A raised weapon's glint (s); the flash's light, how long and how bright for the loudest flash. */
const GLINT = 0.45;
const LIGHT = 0.08;
const LIGHT_MOST = 12;
/** The shake: at full trauma, this many degrees; how fast the trauma goes (per second). */
const SHAKE = 2.5;
const SETTLE = 1.4;
/**
 * (5k) A blast's light: how bright at the launcher's radius, how far it reaches (radii), how quickly it
 * goes (its time constant, s) and for how long it flickers (s). How many particles each system holds.
 */
const FLARE = { most: 60, reach: 7, fade: 0.11, life: 0.6 };
const CAPACITY = { adds: 900, covers: 500 };

/** Whether a hit shakes the view (stage 5i): a comfort setting, on as it comes. */
export const SHAKE_VARIABLE = {
  name: 'view.shake',
  description:
    'A hit taken, or a blast near, shakes the view (stage 5i): briefly, more the harder it was. Off, the view stays still; for whoever gets dizzy, with `view.calm`.',
  scope: 'view',
  type: { kind: 'boolean' },
  default: true,
} as const;

/** Smooth noise for the shake: two waves of unrelated frequencies, from −1 to 1. */
const wobble = (t: number, k: number) => 0.6 * Math.sin(13.1 * t + 1.7 * k) + 0.4 * Math.sin(7.3 * t + 4.1 * k);

export function mountFire(page: GamePage, bodies: Bodies, o: { timeScale(): number } = { timeScale: () => 1 }): Piece {
  addInterfaceStyles();
  const { scene, camera } = page.stage;
  // (5k) The two systems of particles: what adds light, and what covers.
  const adds = createParticles(CAPACITY.adds, true);
  const covers = createParticles(CAPACITY.covers, false);
  scene.add(covers.mesh, adds.mesh);
  const throwing = (e: Effect) => {
    for (const p of e.adds) adds.spawn(p);
    for (const p of e.covers) covers.spawn(p);
  };
  const marker = document.createElement('div');
  marker.className = 'mg-hitmarker';
  marker.hidden = true;
  page.container.append(marker);
  let markerLeft = 0;
  let kick = 0;
  let hits = 0;
  let downs = 0;
  let flashes = 0;
  let flames = 0;
  let readies = 0;
  // The flash's light: one, kept in the scene and lit only for an instant.
  const light = new THREE.PointLight(0xffd08a, 0, 9, 2);
  scene.add(light);
  let lightLeft = 0;
  let lightMost = 0;
  // (5k) A blast's flare: the same light, orange and larger, for longer.
  const MUZZLE_COLOR = new THREE.Color(0xffd08a);
  const FLARE_COLOR = new THREE.Color(0xffa048);
  let flareAge = FLARE.life;
  let flareMost = 0;
  let flareTop = 0;
  let blasts = 0;
  let scorches = 0;
  // (5k) Where each rocket was last frame, for its trail.
  const rockets = new Map<number, THREE.Vector3>();
  // The place's light, for the smoke: what fills the scene, and the flare.
  const placeLight = new THREE.Color();
  const lit = new THREE.Color();
  // The shake.
  let trauma = 0;
  let shakeOn = true;
  let shakeTime = 0;
  page.registry.declareVariable({ ...SHAKE_VARIABLE, onChange: (v) => (shakeOn = v === true) });

  /** Where a character's weapon's end is drawn (in its hands, or at the camera's in first person), or the world's start. */
  const muzzleOf = (id: number, fallback: Vec3) => {
    const holding = bodies.models.get(id)?.holding;
    return (holding?.inView ? holding.viewMuzzle : holding?.pose?.muzzle)?.clone() ?? new THREE.Vector3(...fallback);
  };
  /** Where a shot struck: sparks and dust off a surface (away from where it came), a pale burst off someone hurt. */
  const sparks = (at: THREE.Vector3, back: THREE.Vector3, hit: number | null) => {
    const e = hit === null ? undefined : page.session.world.entities.get(hit);
    throwing(impactEffect(at, back, !!e?.health, e?.body?.material ?? null));
  };
  /** A blast, seen: its particles (the ground's too, if it is near under it), its light, a scorch. */
  const blast = (at: THREE.Vector3, radius: number) => {
    const world = page.session.world;
    const reach = 0.6 * radius + 0.3;
    const under = world.castRay([at.x, at.y + 0.3, at.z], [0, -1, 0], reach, { dynamic: false, characters: false });
    const ground = under && under.normal[1] > 0.7 ? { y: under.point[1] } : null;
    throwing(blastEffect(at, radius, ground));
    if (ground) page.container.dataset.scorches = String(++scorches);
    page.container.dataset.blasts = String(++blasts);
    light.position.copy(at).y += 0.5;
    light.color.copy(FLARE_COLOR);
    light.distance = FLARE.reach * radius;
    flareMost = FLARE.most * (radius / 3.5);
    flareAge = 0;
    flareTop = Math.max(flareTop, flareMost);
    page.container.dataset.flare = flareTop.toFixed(0);
  };
  const showMarker = (head: boolean, down: boolean) => {
    marker.hidden = false;
    marker.classList.toggle('mg-hitmarker-head', head);
    marker.classList.toggle('mg-hitmarker-down', down);
    markerLeft = MARKER * (down ? 1.8 : 1);
  };

  return {
    welcome() {
      kick = 0;
      trauma = 0;
      lightLeft = 0;
      light.intensity = 0;
      marker.hidden = true;
      adds.clear();
      covers.clear();
      rockets.clear();
      flareAge = FLARE.life;
    },
    event(ev: Event) {
      const hero = page.player();
      if (ev.type === 'fired') {
        const feel = FEEL[ev.kind];
        if (!feel) return;
        // (Stage 5o) The flame lance: its flames, from where its end is drawn.
        if (ev.kind === 'flamer') {
          throwing(flameEffect(muzzleOf(ev.from, ev.at), new THREE.Vector3(...ev.direction).normalize()));
          page.container.dataset.flames = String(++flames);
        }
        if (feel.flash > 0) {
          const at = muzzleOf(ev.from, ev.at);
          // (In first person its end is under a meter from the eyes: half as large there, or it fills the view.)
          const near = bodies.models.get(ev.from)?.holding.inView ? 0.5 : 1;
          throwing(muzzleEffect(at, new THREE.Vector3(...ev.direction).normalize(), feel.flash * near));
          page.container.dataset.flashes = String(++flashes);
          // (Unless a blast's flare has it now.)
          if (flareAge >= FLARE.life) {
            light.position.copy(at);
            light.color.copy(MUZZLE_COLOR);
            light.distance = 9;
            lightMost = LIGHT_MOST * (feel.flash / FEEL.shotgun!.flash);
            lightLeft = LIGHT;
          }
        }
        if (hero && ev.from === hero.id) {
          kick = Math.min(MOST_KICK, kick + feel.kick);
          page.container.dataset.kick = kick.toFixed(2);
        }
      } else if (ev.type === 'shot') {
        // (The flame lance's strikes are its flames: no sparks.)
        if (ev.hit === null || ev.kind === 'flamer') return;
        const end = new THREE.Vector3(...ev.end);
        const back = new THREE.Vector3(...ev.start).sub(end).normalize();
        sparks(end, back, ev.hit);
      } else if (ev.type === 'impact') {
        const at = new THREE.Vector3(...ev.at);
        const back = new THREE.Vector3(...ev.velocity).normalize().negate();
        if (ev.kind !== 'rocket') sparks(at, back, ev.hit);
      } else if (ev.type === 'blast') {
        blast(new THREE.Vector3(...ev.at), ev.radius);
        // Near the page's character, it shakes the view: more the nearer, up to half again its radius.
        if (hero?.transform) {
          const d = new THREE.Vector3(...hero.transform.position).distanceTo(new THREE.Vector3(...ev.at));
          const reach = 1.5 * ev.radius;
          if (d < reach) trauma = Math.min(1, trauma + 0.6 * (1 - d / reach));
        }
      } else if (ev.type === 'sound' && ev.sound === 'ready') {
        // A weapon raised: a cold glint at its end, growing a little and fading.
        adds.spawn({
          kind: 'flash',
          at: muzzleOf(ev.source, ev.at),
          life: GLINT,
          size: [0.3, 0.5],
          stops: [
            [0, 3, 3.6, 4.5, 1],
            [1, 1, 1.3, 1.8, 0],
          ],
        });
        page.container.dataset.readies = String(++readies);
      } else if (ev.type === 'hurt') {
        // The page's character hurt: the view shakes, more the more it took.
        if (hero && ev.target === hero.id && ev.amount > 0)
          trauma = Math.min(1, trauma + 0.25 + ev.amount / (hero.health?.most ?? 100));
        if (!hero || ev.from !== hero.id || ev.target === hero.id) return;
        showMarker(ev.part === 'head', false);
        page.container.dataset.hits = String(++hits);
      } else if (ev.type === 'down') {
        if (!hero || ev.from !== hero.id || ev.target === hero.id) return;
        showMarker(false, true);
        page.container.dataset.downs = String(++downs);
      }
    },
    frame({ dt, world }) {
      // (5k) Each rocket's trail, from where it was to where it is.
      const flying = new Set<number>();
      for (const e of world.entities.values()) {
        if (e.projectile?.kind !== 'rocket' || !e.transform) continue;
        flying.add(e.id);
        const now = new THREE.Vector3(...e.transform.position);
        const was = rockets.get(e.id);
        if (was) throwing(trailEffect(was, now));
        rockets.set(e.id, now);
      }
      for (const id of rockets.keys()) if (!flying.has(id)) rockets.delete(id);
      // The blast's light: a flare that goes in a tenth of a second, flickering.
      if (flareAge < FLARE.life) {
        flareAge += dt * o.timeScale();
        lightLeft = 0;
        light.intensity =
          flareAge < FLARE.life ? flareMost * Math.exp(-flareAge / FLARE.fade) * (0.75 + 0.25 * Math.random()) : 0;
      }
      // The place's light, for what covers: what fills the scene, and the flare near it, for an instant.
      placeLight.setRGB(0, 0, 0);
      // (The stage's lights, at the scene's top: the sky's fill, the sun, the moon.)
      for (const o of scene.children) {
        if (o instanceof THREE.HemisphereLight)
          placeLight.add(
            lit
              .copy(o.color)
              .lerp(o.groundColor, 0.5)
              .multiplyScalar(o.intensity * 0.7),
          );
        else if (o instanceof THREE.AmbientLight) placeLight.add(lit.copy(o.color).multiplyScalar(o.intensity));
        else if (o instanceof THREE.DirectionalLight) placeLight.add(lit.copy(o.color).multiplyScalar(o.intensity * 0.35));
      }
      if (flareAge < FLARE.life) placeLight.add(lit.copy(light.color).multiplyScalar(light.intensity * 0.04));
      covers.light(placeLight);
      // (At the world's pace, as the debris: paused, they hold; at half speed, half as fast.)
      const pace = dt * o.timeScale();
      adds.update(pace, camera);
      covers.update(pace, camera);
      const live = String(adds.count + covers.count);
      if (page.container.dataset.particles !== live) page.container.dataset.particles = live;
      if (markerLeft > 0) {
        markerLeft -= dt;
        if (markerLeft <= 0) marker.hidden = true;
      }
      // The flash's light, out in an instant.
      if (lightLeft > 0) {
        lightLeft -= dt;
        light.intensity = lightLeft > 0 ? lightMost * (lightLeft / LIGHT) : 0;
      }
      // The shake, on the camera as the camera piece placed it for this frame: its square, smooth, and the
      // trauma going down.
      if (trauma > 0) {
        shakeTime += dt;
        if (shakeOn) {
          const a = THREE.MathUtils.degToRad(SHAKE * trauma * trauma);
          camera.rotateZ(a * wobble(shakeTime, 1));
          camera.rotateX(0.6 * a * wobble(shakeTime, 2));
          camera.rotateY(0.6 * a * wobble(shakeTime, 3));
        }
        trauma = Math.max(0, trauma - SETTLE * dt);
        page.container.dataset.trauma = trauma.toFixed(2);
      }
      // The kick, put on the camera as the camera piece placed it for this frame (it places it anew every
      // frame: mounted after it, this turns it up by what is left of the kick), and eased back.
      if (kick > 1e-3) {
        camera.rotateX(THREE.MathUtils.degToRad(kick));
        kick *= Math.exp(-dt / KICK_BACK);
        if (kick <= 1e-3) kick = 0;
        page.container.dataset.kick = kick.toFixed(2);
      }
    },
    stop() {
      marker.remove();
      light.removeFromParent();
      light.dispose();
      adds.mesh.removeFromParent();
      covers.mesh.removeFromParent();
      adds.dispose();
      covers.dispose();
    },
  };
}
