import type * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

/** A file, loaded once for every page that asks for it, and how many of them use it now. */
interface Held {
  gltf: GLTF | null;
  error: unknown;
  users: number;
  waiting: { done: (gltf: GLTF) => void; failed: (error: unknown) => void }[];
}

/** Every file loaded, by its address: shared by the pages that use it (a page mounted again reloads nothing). */
const held = new Map<string, Held>();
let loader: GLTFLoader | null = null;
let ktx2: KTX2Loader | null = null;

/**
 * THE LOADER, SET UP ONCE (stage 5.5g, the audit's V6: before, each mount made its own, and nothing could read
 * compressed files): meshopt's decoder always (a file compressed with it loads as any other), and, once a page
 * gives where the Basis transcoder is (`ktx2`), KTX2 textures, which the GPU keeps compressed. KTX2 needs the
 * renderer, to know which compressed formats this GPU reads: the loader was never given one before.
 */
function loaderFor(renderer: THREE.WebGLRenderer | null, transcoder: string | null): GLTFLoader {
  loader ??= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  if (!ktx2 && renderer && transcoder) {
    ktx2 = new KTX2Loader().setTranscoderPath(transcoder).detectSupport(renderer);
    loader.setKTX2Loader(ktx2);
  }
  return loader;
}

/** Everything a file holds on the GPU, freed: its geometries, its materials and their textures. */
function free(gltf: GLTF) {
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    for (const m of [mesh.material ?? []].flat() as THREE.Material[]) {
      for (const value of Object.values(m)) if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
      m.dispose();
    }
  });
}

/**
 * A PAGE'S ASSETS (stage 5.5g, V6): the files it uses, each loaded once however many pages use it, counted,
 * and freed when the last page that used it lets it go (`release`, when it stops: before, nothing was ever
 * freed). How far its loading has got (`progress`), and when all of it has (`ready`).
 */
export interface Assets {
  /** A file's glTF, when it has loaded (at once, if it already had); `failed` if it does not. This page uses it until `release`. */
  use(file: string, done: (gltf: GLTF) => void, failed: (error: unknown) => void): void;
  /** The files this page asked for, and how many of them have loaded (or failed: there is no more to wait for). */
  progress(): { loaded: number; total: number };
  /** Every file this page asked for so far, loaded (or failed). */
  readonly ready: Promise<void>;
  /** This page lets go of every file it used: one no page uses any longer is freed. */
  release(): void;
}

export function createAssets(o: { renderer?: THREE.WebGLRenderer; ktx2?: string } = {}): Assets {
  const mine = new Set<string>();
  const settled = new Set<string>();
  let whenReady: () => void = () => {};
  let ready = Promise.resolve();
  const check = () => {
    if (settled.size === mine.size) whenReady();
  };
  return {
    use(file, done, failed) {
      const first = !mine.has(file);
      if (first) {
        if (settled.size === mine.size) ready = new Promise((resolve) => (whenReady = resolve));
        mine.add(file);
      }
      let h = held.get(file);
      const settle = () => {
        settled.add(file);
        check();
      };
      if (!h) {
        h = { gltf: null, error: null, users: 0, waiting: [] };
        held.set(file, h);
        const entry = h;
        loaderFor(o.renderer ?? null, o.ktx2 ?? null).load(
          file,
          (gltf) => {
            entry.gltf = gltf;
            for (const w of entry.waiting.splice(0)) w.done(gltf);
          },
          undefined,
          (error) => {
            entry.error = error;
            for (const w of entry.waiting.splice(0)) w.failed(error);
          },
        );
      }
      // (A page counts once for a file, however many times it asks for it.)
      if (first) h.users++;
      if (h.gltf) {
        done(h.gltf);
        settle();
      } else if (h.error) {
        failed(h.error);
        settle();
      } else
        h.waiting.push({
          done: (gltf) => {
            done(gltf);
            settle();
          },
          failed: (error) => {
            failed(error);
            settle();
          },
        });
    },
    progress: () => ({ loaded: settled.size, total: mine.size }),
    get ready() {
      return ready;
    },
    release() {
      for (const file of mine) {
        const h = held.get(file);
        if (!h || --h.users > 0) continue;
        if (h.gltf) free(h.gltf);
        held.delete(file);
      }
      mine.clear();
      settled.clear();
    },
  };
}
