# 0014. The execution profile: the physics a world runs on, and who verifies it

- **Status:** accepted
- **Date:** 2026-11-15

## Context

Two things about how a match runs were fixed in the code, in two different places:

- **The physics.** The world created Rapier's deterministic build (decision [0012](0012-the-games.md)) directly: `new Physics(...)` in `world.ts`. Nothing else could run a world.
- **The verification.** Even alone, the page plays through a server of its own that simulates its own copy, and every copy compares its hash with it every 60 steps (stage 1e). That number was an option of the server.

Phase 8 (in the roadmap: optional) wants a single-player game that needs thousands of bodies with consequences to be able to give up the second copy, knowingly, and keep everything else: the same engine and the same game code. The measurements of stage 2.5a say what is at stake: playing alone costs 2.06–2.25 copies of the simulation. Whatever phase 8 does, it should be **a profile a game chooses, not a fork of the engine**, and a replay or a snapshot must not be played on a simulation other than the one it was made on.

## Decision

### One object, a game's choice

The **execution profile** says how a game's matches run. A game gives it in its cartridge (`Cartridge.profile`); without one, it is `VERIFIED`, which is exactly what there was before:

```ts
interface Profile {
  physics: 'rapier-deterministic';
  verify: { by: 'server'; hashEvery: number };
}
const VERIFIED = { physics: 'rapier-deterministic', verify: { by: 'server', hashEvery: 60 } };
```

### Its two parts do not weigh the same

- **The physics is part of the simulation.** The same inputs on another physics give another world. A replay or a snapshot made on another physics is **refused**, with why, as one of another simulation version is.
- **Who verifies is not.** It does not change what a step gives: a replay recorded while a server checked every half second plays the same where it checks every second, or, one day, where nobody checks. It is recorded, but it does not have to match.

### Where it lives

- **The world** takes its physics from the profile, through a table of the physics the engine has (`PHYSICS`, in `physics.ts`, the only file that imports Rapier). The world, the characters and the presentation talk to a `PhysicsBackend`, never to Rapier: the core no longer has a physics fixed.
- **Snapshots** keep the profile, and a world is restored with the same one. Loading a snapshot of another physics into a session is refused.
- **Replays** write it in a line (`profile rapier-deterministic server 60`), after the game's. An older replay, without the line, is the verified one: the links already shared still play.
- **The server** compares hashes as often as the profile says.

### What it does not do yet

There is one physics and one way of verifying. The type says so: the other values (phase 8's local profile, a physics without the second copy) are added when they are built, with their tests, not before. What this decision leaves is the place where they go.

## Consequences

- **Good:** phase 8's question ("can a single-player game give up the verification?") has a place to be answered without touching a game's code, and a replay can never be played, without saying so, on a simulation other than its own.
- **Good:** the physics is behind an interface the rest of the engine uses: a second backend (for phase 8, or for a test) is one more entry in `PHYSICS`.
- **Costs:** one more line in every replay (32 characters in a link), and one more field in every snapshot.
- **Rule:** the tests require the verified profile (the reference replays are recorded with it, and the browsers' determinism check plays them). A game that chooses another profile chooses it knowingly, and the site says so where it matters.

## Alternatives discarded

- **A flag for "local mode" in the presentation:** it would have put a simulation decision (whether there is a second copy) in the layer that only draws, and a replay would not know how it was made.
- **Refusing a replay made with another way of verifying too:** stricter than needed. Verifying does not change a step; refusing would only stop replays that would play the same.
- **Building phase 8's profile now:** without a game that asks for it, its numbers would be guesses. The seam is what is cheap and useful today.
