/**
 * THE EXECUTION PROFILE (stage 2.5b, decision 0014): how a match runs, in one object a game chooses
 * (`Cartridge.profile`; without one, `VERIFIED`, which is exactly what there was before). Two parts:
 *
 * - THE PHYSICS the world runs on. It is part of the simulation: a replay or a snapshot made with
 *   another one is refused, as one of another version is. Today there is one, Rapier's deterministic
 *   build (decision 0012), and the core no longer has it fixed: the world takes it from here.
 * - WHO VERIFIES, and how often. It is not part of the simulation: it does not change what a step
 *   gives. Today a server simulates its own copy and every copy compares its hash with it (stage 1e).
 *   Phase 8's local profile, for a single-player game that wants all the physics it can get, will
 *   be one more value here: chosen, not programmed.
 */
export interface Profile {
  readonly physics: 'rapier-deterministic';
  readonly verify: {
    /** Who verifies: a server that simulates its own copy. */
    readonly by: 'server';
    /** Every how many steps the copies compare their hash with the server's (60: once a second). */
    readonly hashEvery: number;
  };
}

/** The verified profile: Rapier's deterministic build, and a server that checks every copy once a second. */
export const VERIFIED: Profile = Object.freeze({
  physics: 'rapier-deterministic',
  verify: Object.freeze({ by: 'server', hashEvery: 60 }),
});

/** A profile as one line of words (for replays): `rapier-deterministic server 60`. */
export const profileText = (p: Profile) => `${p.physics} ${p.verify.by} ${p.verify.hashEvery}`;

/** Back from those words; or why not. */
export function profileFromText(text: string): Profile | string {
  const [physics, by, every] = text.trim().split(/\s+/);
  if (physics !== 'rapier-deterministic') return `"${physics}" is not a physics this engine has (it has rapier-deterministic)`;
  if (by !== 'server') return `"${by}" is not a way of verifying this engine has (it has server)`;
  const hashEvery = Number(every);
  if (!Number.isInteger(hashEvery) || hashEvery < 1) return `"${every}" is not a number of steps`;
  return { physics, verify: { by, hashEvery } };
}
