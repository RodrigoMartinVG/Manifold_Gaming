# 0017. Phase 5's scope: three compact games, of 10 to 15 minutes each

- **Status:** accepted
- **Date:** 2026-11-15

## Context

Decision [0012](0012-the-games.md) chose the games: a third-person platformer, an action adventure and a shooter, the same character and world in all three, each one complete in phase 5. It did not say how big. "Complete" with no size is an endless phase: a game can always grow another level, another enemy, another system. And each of the three must also be a case study the tutorial can tell, which a long game is not.

## Decision

### Each game, a compact piece

- **10 to 15 minutes** for a first playthrough, by someone who did not make it.
- **A beginning, a climax and an end**; a menu, a HUD, saving, and credits (generated from the list of where every file comes from: decision [0015](0015-art-and-sound.md)).
- **Three to five dense levels**, with the same world, character and kit as the other two games.
- **One distinctive extra mechanic** per game, and **at most one natural multiplayer mode** (0012).
- **Its own control scheme and camera by default**, from those the engine has.

### Levels designed by measure

- **A metrics gym first:** the jump's heights and distances, the slopes, the corridors' widths, frozen in grey boxes, from which every level is built.
- **A mechanic in four beats:** shown safely, demanded, twisted, mastered.

### When a game is done

- It can be played from beginning to end **without the console**, by someone who did not make it.
- Its **reference replay plays it from beginning to end**, and gives the same hash in every browser (the safety net of stage 2.5a, one per game).
- It stays **within the budgets**: the GPU's (stage 2e) and the step's (2.5a).
- Its replays and ghosts by link work, and the tutorial has its lessons.

### Out of scope

Long campaigns, cutscenes beyond a few lines, voices, and content without end. (The adventure's dungeons from a seed, of phase 3, are not content without end: they are a few rooms put together differently, from the same pieces.)

## Consequences

- **Good:** phase 5 has an end that can be checked; three games of this size take months, not years.
- **Good:** a short game is played to its end, by the author and by whoever opens the link; and it is a case study the tutorial can tell whole.
- **Costs:** each game shows only part of what its genre can be. That is the point: the engine is what is being tested, and a short game done well tests it better than a long one half done.

## Alternatives discarded

- **No size:** an endless phase, the risk 0012 already saw in an eleven-game catalog.
- **One big game instead of three:** 0012 decided three, so the character, the camera and the kit are tested three ways.
- **Prototypes instead of games:** a prototype does not test the hard parts (a menu, saving, a game that ends, a level that teaches its mechanic).
