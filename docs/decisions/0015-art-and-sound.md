# 0015. Where the art and the sound come from: code, scripts and free packs, never by hand and never copied

- **Status:** accepted
- **Date:** 2026-11-15

## Context

Until now the Dojo draws boxes, spheres and capsules with one color each. Stage 2e brings models and animations, and phase 5 three complete games: they need level pieces, characters with their animations, and sound. Three things limit where they can come from:

- **Nothing copied.** No model, texture or sound taken from a game or a site without a license that lets us: the project is public, and so is its tutorial.
- **Nothing by hand.** The author does not want to use Blender by hand: the work is done by asking, and whatever is made must be made again by running something, not by remembering clicks.
- **A modest GPU.** The target is an integrated one (stage 1: an Iris Plus), at 60 frames per second, with two copies of the world simulating (2.5a: playing alone costs 2.06–2.25 copies).

And one rule of the engine: art never enters the simulation. The clip a character plays comes from its mode (`character.mode`); a model decides what is seen, never what happens.

## Decision

| What                                | Where it comes from                                                                                                                                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Level pieces and mechanisms**     | Generated with code: the level format's own shapes, parametric geometry, and Blender run from the command line by Python scripts that live in the repository. Never edited by hand                                          |
| **Characters and their animations** | Free packs with a CC0 license (public domain: the kind Kenney and Quaternius publish), brought into shape by a script: the capsule's scale, no root motion, clips named after the modes, sockets for the hands and the head |
| **Sound**                           | Synthesized by code in the browser (oscillators, noise, envelopes: Web Audio), without files. A recording only where synthesis cannot, and then CC0                                                                         |
| **The look**                        | Few polygons, vertex colors or one palette, no textures beyond it: what a modest GPU draws, and what generated pieces can match                                                                                             |

### The script is the source

A generated piece's source is its script. The files it produces (glTF) are committed too, so building the site does not need Blender; one command runs every script again, and a script that changes regenerates its files in the same commit. Blender is installed when stage 2e needs it, and only used this way.

### Every file says where it comes from

Every art or sound file has its entry in a list next to it: where it came from, its author and its license (or the script that made it). A test checks that no file is missing from the list, and the site's credits page is generated from it.

## Consequences

- **Good:** everything can be made again by running something; nothing depends on someone's hands or on a file nobody knows how to rebuild.
- **Good:** the license of everything is known and checked; the project can be shown, forked and taught without doubts.
- **Good:** synthesized sound weighs nothing and fits the deterministic mindset: the same parameters, the same sound.
- **Costs:** the art will be simple. That is a choice: phase 5 is about games that feel right, and a simple look done well reads better than a rich one done badly.
- **Costs:** a character from a free pack may not have every animation a mode asks for; the normalizing script says what is missing, and a mode can fall back to another clip.

## Alternatives discarded

- **Modeling by hand in Blender:** the author does not want to, and what is made by hand cannot be made again by asking.
- **Assets from other games, or of unclear license:** never; neither ripped nor "for testing".
- **Buying packs:** CC0 packs cover what three compact games need; a paid license would be one more thing to track, for little.
- **Recorded sound for everything:** files to carry and to license, for sounds (steps, jumps, hits, doors) that synthesis does well.

## Refinement (2026-11-15, stage 2e)

The free pack the table names for characters turned out to be hard to bring in by running something: its best candidate is downloaded through a page that asks for steps in a browser, and its listing does not say whether it brings a character or only the skeleton and its animations. The author chose, for the Dojo's character, the other way this decision allows for its pieces: **a mannequin made and animated by a script** (`art/mannequin.py`, run by Blender without a screen), with one animation per way of moving. Characters may come from either way; a CC0 pack can still replace the mannequin when a game of phase 5 asks for richer movement, through the same normalizing script and the same list. The mannequin keeps the contract the table asks of a pack (the capsule's size, its front at −Z, no root motion, the clips named after the modes, sockets for the hands and the head), and a test reads the file to hold it (`games/dojo/src/assets.test.ts`): whatever replaces it must pass the same test.
