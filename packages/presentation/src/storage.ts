/**
 * SAVING IN THE BROWSER, separately for each game (`manifold.dojo.…`): the console's history, its key
 * bindings and its startup recipe (stage 1), the player's settings (stage 3i). If it cannot (a private
 * window, storage blocked), nothing happens: it lasts only while the page is open.
 */
export interface Saved {
  read<T>(key: string): T | null;
  write(key: string, value: unknown): void;
  remove(key: string): void;
}

export function storage(prefix: string): Saved {
  return {
    read<T>(key: string): T | null {
      try {
        const v = localStorage.getItem(`${prefix}.${key}`);
        return v === null ? null : (JSON.parse(v) as T);
      } catch {
        return null;
      }
    },
    write(key: string, value: unknown) {
      try {
        localStorage.setItem(`${prefix}.${key}`, JSON.stringify(value));
      } catch {
        // no storage: it lasts only while the page is open
      }
    },
    remove(key: string) {
      try {
        localStorage.removeItem(`${prefix}.${key}`);
      } catch {
        // idem
      }
    },
  };
}
