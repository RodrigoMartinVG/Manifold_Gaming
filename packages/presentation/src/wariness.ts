import * as THREE from 'three';
import type { Entity } from '@manifold/core';
import type { GamePage, Piece } from './page';
import { createParticles } from './particles';

/** What a watcher has noticed, as the view needs it (a game's: the fortress reads its guards'). */
export interface Noticed {
  /** How full its awareness is (0 to 1). */
  level: number;
  state: 'calm' | 'suspicious' | 'alerted' | 'searching';
  /** Where it last saw whoever it noticed (none: empty). */
  at: readonly number[];
}

export interface WarinessOptions {
  /** What an entity has noticed, if it notices (a guard), else undefined. */
  noticed(e: Entity): Noticed | undefined;
  /** How visible the page's character is now: 1 is as lit as a watcher needs to see it at all (null: no character). */
  exposure(hero: Entity): number | null;
}

/** How far a sign is shown (m), how high over a watcher's middle (m); how long the noise rings take to spread (s). */
const SIGNS = { far: 35, over: 1.25 };
const RING = { life: 0.55, most: 32 };

let styled = false;
function addStyles() {
  if (styled || document.getElementById('mg-wary-styles')) return;
  styled = true;
  const style = document.createElement('style');
  style.id = 'mg-wary-styles';
  style.textContent = `
    .mg-wary {
      position: absolute; left: 0; top: 0; z-index: 4; pointer-events: none;
      width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%;
      display: grid; place-items: center; --fill: 0; --c: #f2c14e;
      background: conic-gradient(var(--c) calc(var(--fill) * 1turn), rgb(0 0 0 / 0.45) 0);
      font: 700 19px/1 Georgia, serif; color: #1a1408;
      filter: drop-shadow(0 0 2px rgb(0 0 0 / 0.8));
      transition: transform 120ms ease-out;
    }
    .mg-wary::before {
      content: ''; position: absolute; inset: 4px; border-radius: 50%; background: rgb(20 16 10 / 0.85);
    }
    .mg-wary span { position: relative; color: var(--c); }
    .mg-wary[hidden] { display: none; }
    .mg-wary[data-state='alerted'] { --c: #ff5a4a; transform: scale(1.25); }
    .mg-wary[data-state='searching'] { --c: #9fb4e8; }
    .mg-gem {
      position: absolute; left: 14px; bottom: 14px; z-index: 6; pointer-events: none;
      display: flex; align-items: center; gap: 8px;
      font: 600 12px/1 'Cinzel Variable', Georgia, serif; letter-spacing: 0.06em; color: #e8dcc0;
      text-shadow: 0 1px 2px rgb(0 0 0 / 0.9);
    }
    .mg-gem i {
      width: 18px; height: 18px; transform: rotate(45deg); border: 1px solid rgb(232 220 192 / 0.7);
      background: rgb(var(--gem) / 1); box-shadow: 0 0 calc(var(--glow) * 14px) rgb(var(--gem) / 0.9);
    }
    .mg-gem[hidden] { display: none; }
  `;
  document.head.append(style);
}

/**
 * HOW EXPOSED, HOW NOTICED (stage 5l, decision 0031: the research's first two things every stealth game
 * needs, "the intruder can read their own exposure" and "guards' awareness is readable"). Only the view;
 * what it shows is the world's (the game says how to read it):
 *
 *   - over each watcher that has noticed something, a SIGN: a ring that fills as its awareness does, with
 *     a "?" (amber, suspicious; pale blue, searching) or a "!" (red, alerted);
 *   - where a searching watcher last saw the page's character, a pale SILHOUETTE of it (where they will
 *     look: Splinter Cell's last known position);
 *   - a LIGHT GEM in a corner, as Thief's: dark in the shadows, bright where a watcher would see it, with a
 *     word (hidden, in shadow, in sight);
 *   - the page's character's NOISE: each sound it makes spreads a faint ring on the ground as far as it is
 *     heard (Mark of the Ninja's rings), so what the guards hear can be seen.
 *
 * For the browser tests: `data-signs` (signs shown), `data-sign` (the most a watcher noticed: its state),
 * `data-gem` (the exposure), `data-rings` (rings spread so far), `data-last` (silhouettes shown).
 */
export function mountWariness(page: GamePage, o: WarinessOptions): Piece {
  // The page's size, measured when it changes (stage 5.5g), not read on every frame.
  const size = { w: page.container.clientWidth, h: page.container.clientHeight };
  const resized = new ResizeObserver(() => {
    size.w = page.container.clientWidth;
    size.h = page.container.clientHeight;
  });
  resized.observe(page.container);
  addStyles();
  const { scene, camera } = page.stage;
  const signs = new Map<number, HTMLDivElement>();
  const gem = document.createElement('div');
  gem.className = 'mg-gem';
  gem.innerHTML = '<i></i><span></span>';
  page.container.append(gem);
  const rings = createParticles(RING.most, true);
  scene.add(rings.mesh);
  let ringsMade = 0;
  // The last known places: a pale capsule each, kept.
  const ghostShape = new THREE.CapsuleGeometry(0.28, 1, 4, 10);
  const ghostLook = new THREE.MeshBasicMaterial({ color: 0x9fb4e8, transparent: true, opacity: 0.22, depthWrite: false });
  const ghosts: THREE.Mesh[] = [];
  const at = new THREE.Vector3();

  const signOf = (id: number) => {
    let s = signs.get(id);
    if (!s) {
      s = document.createElement('div');
      s.className = 'mg-wary';
      s.innerHTML = '<span></span>';
      s.hidden = true;
      page.container.append(s);
      signs.set(id, s);
    }
    return s;
  };

  return {
    welcome() {
      for (const s of signs.values()) s.remove();
      signs.clear();
      rings.clear();
    },
    event(ev) {
      // The page's character's own sounds: a ring as far as each is heard.
      const hero = page.player();
      if (!hero || ev.type !== 'sound' || ev.source !== hero.id || ev.radius <= 0) return;
      const size = (2 * ev.radius) / 0.78;
      rings.spawn({
        kind: 'ring',
        at: new THREE.Vector3(ev.at[0], ev.at[1] + 0.05, ev.at[2]),
        life: RING.life,
        size: [0.25 * size, size],
        stops: [
          [0, 1.1, 1.1, 1.2, 0.32],
          [1, 1, 1, 1.1, 0],
        ],
      });
      page.container.dataset.rings = String(++ringsMade);
    },
    frame({ dt, hero }) {
      // (Its size as last measured, stage 5.5g: read here, after the signs were written, it made the page lay itself out again.)
      const { w, h } = size;
      const seen = new Set<number>();
      let shown = 0;
      let most: Noticed['state'] | 'none' = 'none';
      const rank = { none: 0, calm: 1, suspicious: 2, searching: 3, alerted: 4 } as const;
      let ghostsShown = 0;
      // (What notices is a watcher, stage 5.5g: the page's index, not every entity.)
      for (const e of page.index.with('watcher')) {
        const n = o.noticed(e);
        if (!n || !e.transform) continue;
        seen.add(e.id);
        const down = (e.health?.down ?? -1) >= 0;
        const s = signOf(e.id);
        const showing = !down && (n.state !== 'calm' || n.level > 0.02);
        if (rank[n.state] > rank[most] && showing) most = n.state;
        // Where a searching one last saw the character: its silhouette.
        if (!down && n.state === 'searching' && n.at.length === 3) {
          const g = ghosts[ghostsShown] ?? ghosts[ghosts.push(new THREE.Mesh(ghostShape, ghostLook)) - 1]!;
          if (!g.parent) scene.add(g);
          g.visible = true;
          g.position.set(n.at[0]!, n.at[1]!, n.at[2]!);
          ghostsShown++;
        }
        at.set(...e.transform.position);
        at.y += SIGNS.over;
        const far = at.distanceTo(camera.position);
        at.project(camera);
        const onScreen = at.z < 1 && Math.abs(at.x) <= 1.1 && Math.abs(at.y) <= 1.1;
        s.hidden = !showing || !onScreen || far > SIGNS.far;
        if (s.hidden) continue;
        shown++;
        s.dataset.state = n.state;
        s.style.setProperty('--fill', String(n.state === 'alerted' || n.state === 'searching' ? 1 : Math.min(1, n.level)));
        s.firstElementChild!.textContent = n.state === 'alerted' ? '!' : '?';
        s.style.transform = `translate(${((at.x + 1) / 2) * w}px, ${((1 - at.y) / 2) * h}px)${n.state === 'alerted' ? ' scale(1.25)' : ''}`;
      }
      for (const [id, s] of signs)
        if (!seen.has(id)) {
          s.remove();
          signs.delete(id);
        }
      for (let i = ghostsShown; i < ghosts.length; i++) ghosts[i]!.visible = false;
      page.container.dataset.signs = String(shown);
      page.container.dataset.sign = most;
      page.container.dataset.last = String(ghostsShown);
      // The light gem.
      const exposure = hero ? o.exposure(hero) : null;
      gem.hidden = exposure === null;
      if (exposure !== null) {
        const k = Math.max(0, Math.min(1, exposure / 1.5));
        const rgb = [Math.round(40 + 215 * k), Math.round(44 + 180 * k), Math.round(60 + 100 * k)];
        gem.style.setProperty('--gem', rgb.join(' '));
        gem.style.setProperty('--glow', String(k));
        gem.lastElementChild!.textContent = page.words(exposure >= 1 ? 'gem.seen' : exposure >= 0.6 ? 'gem.dim' : 'gem.hidden');
        page.container.dataset.gem = exposure.toFixed(2);
      }
      rings.update(dt, camera);
    },
    stop() {
      for (const s of signs.values()) s.remove();
      signs.clear();
      gem.remove();
      rings.mesh.removeFromParent();
      rings.dispose();
      for (const g of ghosts) g.removeFromParent();
      ghostShape.dispose();
      ghostLook.dispose();
    },
  };
}
