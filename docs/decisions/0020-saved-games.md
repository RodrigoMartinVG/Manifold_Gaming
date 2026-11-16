# 0020. Saved games: the progress, as versioned data, brought forward step by step

- **Status:** accepted (it refines what [0012](0012-the-games.md) said about saving: "on top of the world's snapshots")
- **Date:** 2026-11-15

## Context

Phase 5's games need saving (decision 0017: a menu, a HUD, saving, credits), and the action adventure, which starts in stage 3k, needs it first: a dungeon is not played in one sitting. Decision 0012 said a saved game would sit "on top of the world's snapshots". Building it, that turns out to be the wrong ground:

- **A snapshot belongs to the engine version that made it**, like a replay (`SIMULATION_VERSION`, decision 0012): it holds Rapier's bytes and every component as this version has them. Every stage of phase 3 changed that version (3a to 3j: from 14 to 22). A saved game made of a snapshot would be erased by the next update, and players would lose their games for a change they cannot see.
- **A snapshot holds too much**: where every crate rolled to, the velocity of every ball, what a fragment was doing. A player's progress is much less: where they are, what they carry, what they already did.
- **The world can be built again from a seed and a level**: a dungeon from its seed (3j's maps, 3k's generator), a room from its file. What is left is what the player changed.

## Decision

**A saved game is the player's progress, as data the game defines, with its own version; never a snapshot.**

- **An envelope the engine knows**, the same for every game: `{ save: 1, game: 'adventure', version: 2, engine: 22, made: '2026-11-15', progress: {…} }`. `save` is the envelope's own version; `game` which game it is; `version` the version of the game's progress; `engine` the simulation version that wrote it, only to say it (nothing reads it to refuse). A save is JSON: it is kept in the browser (one per game, for now), and it can be copied and read.
- **The progress is the game's**: plain data (decision 0004), as small as what the player did. The adventure's: the dungeon's seed and depth, where the character is and where it looks, what it carries, what it already took.
- **Loading builds the world again**: the startup values the progress says (the seed, the depth), a new world born from them, and then the progress applied as one world change at its first step (`progress <data>`). It enters like every world change (decision 0010): in the session's history, played by a replay, the same in Node.
- **Old saves are brought forward, one version at a time**: the game declares, for each version it ever had, how to turn it into the next (`migrations[1]` takes a version 1 into a version 2). Loading runs the steps from the save's version to the current one; a save newer than the game, or of another game, is refused with why. A migration is a pure function of data, tested with a save of that old version kept as a file.
- **The engine's own version does not enter**: a save written by version 22 loads in version 23, because nothing in it is the engine's. A test loads a save that says another engine version.

## Consequences

- Updating the engine no longer threatens saved games; changing what a game saves asks for a migration and a test, at the moment it changes.
- What is not in the progress comes back as the level and the seed say: a crate pushed elsewhere is where it started. That is the game's choice of what to keep.
- A save is small and readable: it can be shown, copied and sent (a link, later).
- Snapshots keep their place: going back to a moment in a session (`snapshot`, `restore`), rollback and rewinding (phase 6), all within one engine version.

## Alternatives discarded

- **A snapshot of the world** (what 0012 said): erased by every engine update.
- **A snapshot plus migrations for the engine's versions**: a migration for every stage that touches a component, for data no player cares about.
- **A replay as the save** (the whole match, played again on load): it also belongs to one engine version, and it grows with every minute played.
