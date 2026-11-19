/**
 * WHAT A FIELD IS WHEN NOTHING SAYS OTHERWISE (stage 5.5f, the audit's P2), by component: a field of these
 * may be absent, and absent it is its default. The hash and a snapshot leave out a field equal to its
 * default, and every `undefined` anywhere. So a lamp put out by a hand and lit again (`out: false`) is the
 * lamp that was never put out (`{}`): until version 49 they hashed apart; `{ x: undefined }` and `{}` are
 * the same (a JSON round trip, phase 6's wire, drops the first); and a field a later stage adds with its
 * default changes no world that never sets it, nor its hash. A component's own state that always has a
 * value is not here: its default is where it is made (`MAKERS`, `newCharacter`).
 */
export const DEFAULTS: Readonly<Record<string, Readonly<Record<string, number | boolean | string | null>>>> = {
  lamp: { out: false },
};

/** Whether a component's field is left out of the hash and a snapshot: undefined, or its default. */
export function leftOut(component: string, field: string, value: unknown): boolean {
  if (value === undefined) return true;
  const d = DEFAULTS[component];
  return d !== undefined && Object.hasOwn(d, field) && d[field] === value;
}

/** An entity as a snapshot keeps it: what is left out (`leftOut`) taken away from each of its components. */
export function withoutDefaults<T extends object>(entity: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entity)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object' && !Array.isArray(v) && DEFAULTS[k])
      out[k] = Object.fromEntries(Object.entries(v).filter(([f, x]) => !leftOut(k, f, x)));
    else out[k] = v;
  }
  return out as T;
}
