import * as THREE from 'three';
import type { Vec3 } from '@manifold/common';
import type { Event } from '@manifold/core';
import type { Bodies } from './bodies';
import { own, release } from './owned';
import type { GamePage, Piece } from './page';
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
 *     someone, red on the head, larger when it brings them down.
 *
 * Mounted right after the camera (its kick turns the camera as that piece placed it for the frame). Its
 * sound is the audio's (audio.ts: `fired`). For the browser tests: `data-hits` and `data-downs`
 * (the markers shown), `data-flashes`, `data-kick` (the view's kick now, in degrees).
 */

/** Each kind's flash (m across; none for what is thrown or swung) and kick (degrees up). */
export const FEEL: Readonly<Record<string, { flash: number; kick: number }>> = Object.freeze({
  dart: { flash: 0.14, kick: 1.2 },
  bolt: { flash: 0.1, kick: 2 },
  shotgun: { flash: 0.34, kick: 6 },
  launcher: { flash: 0.28, kick: 4.5 },
  stick: { flash: 0, kick: 0 },
  grenade: { flash: 0, kick: 0.6 },
  smoke: { flash: 0, kick: 0.6 },
  flare: { flash: 0, kick: 0.6 },
});

/** How long a flash lasts, sparks fly, a blast glows, a marker shows (s); how fast a kick comes back (its time constant, s). */
const FLASH = 0.05;
const SPARKS = 0.3;
const BLAST = 0.35;
const MARKER = 0.18;
const KICK_BACK = 0.09;
/** At most this kick at once (degrees): shots in a row do not throw the view over. */
const MOST_KICK = 10;

interface Glow {
  mesh: THREE.Mesh;
  left: number;
  life: number;
  grow?: number;
  velocity?: THREE.Vector3;
}

export function mountFire(page: GamePage, bodies: Bodies): Piece {
  addInterfaceStyles();
  const { scene, camera } = page.stage;
  // (Shared by every glow; let go when the page stops.)
  const ball = new THREE.SphereGeometry(0.5, 10, 8);
  const chip = new THREE.BoxGeometry(0.03, 0.03, 0.03);
  const glows: Glow[] = [];
  const marker = document.createElement('div');
  marker.className = 'mg-hitmarker';
  marker.hidden = true;
  page.container.append(marker);
  let markerLeft = 0;
  let kick = 0;
  let hits = 0;
  let downs = 0;
  let flashes = 0;

  const glow = (
    at: THREE.Vector3,
    size: number,
    color: number,
    life: number,
    o: { grow?: number; velocity?: THREE.Vector3; shape?: THREE.BufferGeometry } = {},
  ) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = own(new THREE.Mesh(o.shape ?? ball, material), { material: true });
    mesh.position.copy(at);
    mesh.scale.setScalar(size);
    scene.add(mesh);
    glows.push({ mesh, left: life, life, ...(o.grow ? { grow: o.grow } : {}), ...(o.velocity ? { velocity: o.velocity } : {}) });
  };
  /** Where a character's weapon's end is drawn (in its hands, or at the camera's in first person), or the world's start. */
  const muzzleOf = (id: number, fallback: Vec3) => {
    const holding = bodies.models.get(id)?.holding;
    return (holding?.inView ? holding.viewMuzzle : holding?.pose?.muzzle)?.clone() ?? new THREE.Vector3(...fallback);
  };
  /** Sparks off a surface (away from where the shot came), or a pale burst off someone hurt. */
  const sparks = (at: THREE.Vector3, back: THREE.Vector3, living: boolean) => {
    if (living) {
      glow(at, 0.22, 0xffe6d0, SPARKS * 0.6, { grow: 1.8 });
      return;
    }
    for (let k = 0; k < 7; k++) {
      const v = back
        .clone()
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(1.6))
        .normalize()
        .multiplyScalar(2 + 3 * Math.random());
      glow(at, 1, 0xffc46a, SPARKS * (0.6 + 0.4 * Math.random()), { velocity: v, shape: chip });
    }
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
      marker.hidden = true;
      for (const g of glows.splice(0)) {
        g.mesh.removeFromParent();
        release(g.mesh);
      }
    },
    event(ev: Event) {
      const hero = page.player();
      if (ev.type === 'fired') {
        const feel = FEEL[ev.kind];
        if (!feel) return;
        if (feel.flash > 0) {
          glow(muzzleOf(ev.from, ev.at), feel.flash, 0xffd890, FLASH);
          page.container.dataset.flashes = String(++flashes);
        }
        if (hero && ev.from === hero.id) {
          kick = Math.min(MOST_KICK, kick + feel.kick);
          page.container.dataset.kick = kick.toFixed(2);
        }
      } else if (ev.type === 'shot') {
        if (ev.hit === null) return;
        const end = new THREE.Vector3(...ev.end);
        const back = new THREE.Vector3(...ev.start).sub(end).normalize();
        sparks(end, back, !!page.session.world.entities.get(ev.hit)?.health);
      } else if (ev.type === 'impact') {
        const at = new THREE.Vector3(...ev.at);
        const back = new THREE.Vector3(...ev.velocity).normalize().negate();
        if (ev.kind !== 'rocket') sparks(at, back, ev.hit !== null && !!page.session.world.entities.get(ev.hit)?.health);
      } else if (ev.type === 'blast') {
        // From a third of a meter to most of its radius, fading.
        glow(new THREE.Vector3(...ev.at), 0.6, 0xffa850, BLAST, { grow: (1.6 * ev.radius) / 0.6 });
      } else if (ev.type === 'hurt') {
        if (!hero || ev.from !== hero.id || ev.target === hero.id) return;
        showMarker(ev.part === 'head', false);
        page.container.dataset.hits = String(++hits);
      } else if (ev.type === 'down') {
        if (!hero || ev.from !== hero.id || ev.target === hero.id) return;
        showMarker(false, true);
        page.container.dataset.downs = String(++downs);
      }
    },
    frame({ dt }) {
      for (let i = glows.length - 1; i >= 0; i--) {
        const g = glows[i]!;
        g.left -= dt;
        if (g.left <= 0) {
          g.mesh.removeFromParent();
          release(g.mesh);
          glows.splice(i, 1);
          continue;
        }
        const t = 1 - g.left / g.life;
        (g.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
        if (g.grow) g.mesh.scale.setScalar(g.mesh.scale.x * Math.pow(g.grow, dt / g.life));
        if (g.velocity) {
          g.velocity.y -= 9.8 * dt;
          g.mesh.position.addScaledVector(g.velocity, dt);
        }
      }
      if (markerLeft > 0) {
        markerLeft -= dt;
        if (markerLeft <= 0) marker.hidden = true;
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
      for (const g of glows.splice(0)) {
        g.mesh.removeFromParent();
        release(g.mesh);
      }
      ball.dispose();
      chip.dispose();
    },
  };
}
