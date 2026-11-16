# 0019. The games' words: keys in the world, the player's language on the screen

- **Status:** accepted (it settles the open question of the games' language, and completes [0011](0011-languages.md))
- **Date:** 2026-11-15

## Context

Decision 0011 split the project in two: what explains or informs, on the site, in Spanish; everything else (the code, the console, the recipes) in English. It left the games' own words out: the menus, the HUD, the dialogue boxes, what a game tells its player ("checkpoint", "a star"). The roadmap kept it as an open question, to settle before phase 5, or before phase 3's interface if it needed words. Stage 3i's interface has words: a pause menu, the settings, a HUD, a box at the goal.

Until now the Dojo's few words came from the world, in English: a notice event carried its text (`'you fell: back to the checkpoint'`), and the page showed it as it came. The site around it speaks Spanish. Two things pull against each other:

- **The player reads the game, as they read the site.** A menu that says "Resume" in a page that says "Salir del Dojo" is the site's interface in two languages.
- **The world is the same everywhere.** It is simulated in Node and in every browser, replayed, sent over the network (decisions 0012, 0016). A text chosen by a language has no place in it: two players in two languages share one world.

## Decision

**The world says what happened with keys and numbers; the presentation says it in the player's language, from tables of words.**

- **The world never carries a sentence for a player.** A notice is a key and its numbers: `{ say: 'dojo.star', values: [1, 2] }` ("a star: 1 taken, 2 left"). The tests compare keys, which do not change when a sentence is rewritten.
- **Words are tables by language**, each key with its sentence, with numbered places for the values (`'Una estrella ({0} de {1})'`). The engine has its own (the pause menu, the settings, the subtitles of sounds); each game brings its own (its notices, its HUD, its dialogue), and its keys start with its name (`dojo.`).
- **Spanish and English, both complete.** Spanish is the player's language on this site; English is the console's (it writes the notices too) and the one a game falls back on. A test asks every table for the same keys in both, and every key a game uses to be in its tables.
- **The language is the page's** (`<html lang>`): the site is in Spanish, so the games are. When the site has an English version, its pages will say `en`, and the games will follow them without a change.
- **The console stays in English** (0011): it is a small programming language, not the game's interface.
- **Names in the code and in the tables' keys are English**, as all code is (0011).

## Consequences

- The interface's labels are found in Spanish by the browser tests, like the site's.
- Adding a sentence is adding a key in two tables; forgetting one is a failed test, not a hole on the screen.
- The world's events lose their texts: the Dojo's notices become keys (the tests that read them, too).
- Dialogue (phase 4) is data with keys too: a level or a story says which key, the table says the words.

## Alternatives discarded

- **The games in Spanish, as text in the world:** the simplest, but the world would carry a language, and the English site (0011: "later") would need every game rewritten.
- **The games in English, like the console:** consistent with the code, but the player of a Spanish site would read a game in another language than the page around it.
- **Only Spanish tables for now, English later:** the console already shows the notices, in English: both are needed from the start, and keeping them complete costs a test.
