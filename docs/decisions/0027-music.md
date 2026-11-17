# 0027. Music: made in the browser like the sounds, sparse, its own volume

- **Status:** accepted (2026-11-17, under the author's instruction to go through stage 4.5 following these recommendations; revisable, as every decision, by the author's word)
- **Date:** 2026-11-17

## Context

Decision 0015 settled where the art and the sounds come from: scripts of ours or CC0, made without a screen; the sounds are synthesized in the browser from the simulation's events (3f), so there is no sound file in the repository and nothing to license. It left music out. Phase 5 makes three compact games, each with a beginning, a climax and an end (decision 0017); music is part of how a player feels where they are in one, and the roadmap kept the question open until before phase 5: music generated like the sounds, music under CC0, or none.

What this project already is constrains it: everything published is ours or CC0, with its provenance recorded (`assets.json`); the site is static on GitHub Pages (decision 0002), so every byte a page loads is a byte every player downloads; the simulation is deterministic and the presentation only reads it (music, like sound, must never feed back into the world); and the player's settings are kept and respected (3i: volume, subtitles for sounds).

## Decision

- **Music is made in the browser, as the sounds are:** short generated pieces (a few voices of WebAudio oscillators and noise, through the same mixer as the sounds), written in code by us, no audio files. What it plays follows the game's state as the presentation reads it, not the clock alone: calm while exploring, tense while a guard hunts you, quiet at the end. It never touches the simulation, and it is not in a replay.
- **Sparse:** a game's music is mostly silence and long notes; it does not fill every second. Each game gets at most one theme with its few states; the Dojo has none (it is a lab: its sounds tell what the world does, music would cover them).
- **Its own volume,** in the settings menu beside the sounds' (3i), kept with the player's preferences; at first half the sounds' (music accompanies, the sounds tell what happens), and the browser's rule that sound waits for a first gesture is the same as for the sounds.
- **A CC0 recording is allowed only when a game needs one that cannot be generated,** under decision 0015's rules (its source and license recorded, made smaller to fit), and only by the author's call; a recording costs every player its download, and the budget for a page (0015) counts it.
- **When:** with the games in phase 5, each game's theme with the game; not before. Nothing in the engine changes for this decision: the mixer that plays the sounds (3f) plays the music.

## Consequences

- No music file, no license to track, no download beyond the code that makes it: the site stays as light as it is.
- Music generated from the game's state can follow it precisely (a guard's alarm, the climax) and be tested like the rest of the presentation: what it plays for a given state is a pure function.
- It will sound like what it is: simple, synthesized. A game that wants a composed score must make that case, and pay its bytes.
- A setting more for the player; the subtitles of 3i do not describe music (it carries no information the game does not already show).

## Alternatives considered

- **CC0 recordings** for every game: rich, but megabytes per track on a static site, provenance to keep for each one, and a recording does not follow the game's state (it loops, or it is cut).
- **None:** the cheapest, and the Dojo keeps it; for the games, their beginning, climax and end lose a way to be felt.
- **Music from the simulation's events** (a note per step, per hit): the sounds already do that; music on top of the same events would double them, not accompany them.
