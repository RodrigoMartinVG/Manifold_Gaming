# 0028. Touch controls: keyboard, mouse and gamepad until phase 6; a phone is told so

- **Status:** accepted (2026-11-17, under the author's instruction to go through stage 4.5 following these recommendations; revisable, as every decision, by the author's word)
- **Date:** 2026-11-17

## Context

The site works on phones: the Bitácora, the tutorial and every page read on a small screen (decision 0002's static site). The games do not: they are played with a keyboard and a mouse, or a gamepad (2.5c, 3i's keys, 4a's first person). On a phone, today, a game's page opens, draws, and lets you turn the camera by dragging (the camera's pointer handling), but you cannot walk. The roadmap kept the question open until before phase 5: touch controls, or keyboard and gamepad only (its proposal: the second, until phase 6).

What touch controls would ask, measured against what the games are: phase 5's three games move in 3D with a camera of their own, and act in several ways at once: the platformer runs, jumps and grabs ledges; the adventure aims, locks on, blocks, rolls and strikes; the shooter aims in first person and shoots. On a screen, that is two virtual sticks and four to six buttons, each placed, sized and tested per game, and a camera that a thumb can steer without fighting the stick. And the GPU of a phone is smaller than the author's Iris Plus, where the citadel already costs 4 to 7 ms a frame (4.5f).

## Decision

- **Until phase 6, the games are played with a keyboard and a mouse, or a gamepad.** A phone with a gamepad connected (Bluetooth) plays them, since the page reads gamepads as it does on a computer.
- **A phone is told so, not left guessing:** a game's page on a device whose main pointer is coarse and that has no gamepad connected says, over the game, that it is played with a keyboard or a gamepad, and lets you look anyway (the camera still turns by dragging). The message goes away when a gamepad or a keyboard is used. Written in the player's language (0019). Built at the close of 4.5.
- **The engine stays ready for them:** inputs are already what a player asks for (move, face, actions: 2.5c), not keys; touch controls, when they come, are one more source of those inputs, like the gamepad was, without the simulation knowing.
- **Revisited in phase 6,** when the games exist and can be measured on a phone (their frames, their controls one by one), or earlier if the author wants one game on phones: then that game's touch layout is designed for that game.

## Consequences

- Phase 5's games are designed for a keyboard, a mouse and a gamepad; nothing in them waits for a thumb.
- A visitor on a phone reads the site and learns why a game does not move, instead of finding it broken.
- The level budget of 0026 is measured on the author's laptop; a phone's would be lower, and is measured when phones are revisited.

## Alternatives considered

- **Touch controls now, generic** (two sticks and a few buttons shared by every game): each game would play badly in its own way; and they would be tested on no phone, since the tests run where a phone's GPU and touch are not.
- **Touch controls per game in phase 5:** three layouts more to design and test while the games themselves are being made; better when the games are done.
- **Hiding the games on phones:** the pages would be inconsistent with the site, and a phone with a gamepad could not play.
