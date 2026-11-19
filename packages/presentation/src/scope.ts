import type * as THREE from 'three';
import { release } from './owned';

/**
 * WHAT A PIECE ADDED, GIVEN BACK (stage 5.5g, the audit's V9). Before, cleanup depended on each piece
 * remembering: the bodies had no `stop` (their meshes, batches and the falls' physics outlived the page),
 * nine more had none, and the story left a key listener on the window. A piece takes a scope from its page
 * (`GamePage.scope`) and adds through it; when the page stops, every scope ends, and gives back what it was
 * given: objects out of their parent and freed (what they own: owned.ts), elements out of the page,
 * listeners removed, and whatever else it was asked to do. A piece may end its own sooner.
 */
export interface Scope {
  /** An object added to `parent` (the scene), taken out and freed when the scope ends. */
  add<T extends THREE.Object3D>(parent: THREE.Object3D, object: T): T;
  /** An element added to `parent` (the page's container), taken out when it ends. */
  append<T extends Element>(parent: Element, element: T): T;
  /** A listener, removed when it ends. */
  listen<K extends keyof WindowEventMap>(target: Window, type: K, f: (ev: WindowEventMap[K]) => void): void;
  listen(target: EventTarget, type: string, f: EventListener): void;
  /** Something done when it ends (in the opposite order to how they were asked: the last first). */
  defer(f: () => void): void;
  /** Gives everything back (once). */
  end(): void;
}

export function createScope(): Scope {
  const undo: (() => void)[] = [];
  return {
    add(parent, object) {
      parent.add(object);
      undo.push(() => {
        parent.remove(object);
        release(object);
      });
      return object;
    },
    append(parent, element) {
      parent.append(element);
      undo.push(() => element.remove());
      return element;
    },
    listen(target: EventTarget, type: string, f: EventListener) {
      target.addEventListener(type, f);
      undo.push(() => target.removeEventListener(type, f));
    },
    defer(f) {
      undo.push(f);
    },
    end() {
      for (const f of undo.splice(0).reverse()) f();
    },
  };
}
