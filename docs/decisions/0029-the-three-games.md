# 0029. The three games: one world, one night, three corners

- **Status:** accepted (2026-11-17, from the author's answers to sixteen questions, each asked with a recommendation; revisable by the author's word)
- **Date:** 2026-11-17

## Context

Decision 0017 framed phase 5: three compact games of 10 to 15 minutes, each with a beginning, a climax and an end, a menu, a HUD, saving and credits; three to five dense levels; the same world, character and kit; one distinctive mechanic and at most one natural multiplayer mode each; levels designed from a metrics gym; and when a game is done. It left open what each game is. Before breaking phase 5 into stages, the author answered four rounds of questions, one round for the three games together and one for each game, each question with options and a recommendation.

## Decision

### The three together

- **One world, three corners of it,** joined by a light thread: the land of the citadel, on one night. **At dusk you climb the tower; at night you infiltrate the fortress; before dawn you defend its wall.** The thread is told in a few lines in each game (0017 keeps cutscenes out); its words are written with each game.
- **Dusk, and lanterns.** Warm stone, an evening and then a night sky, lanterns that matter: the light is the simulation's (3d), the guards see by it (4e), the drawing lights with the lamps the camera sees (0026). The kit's stone and wood are the look; what a game needs beyond them is added to the kit.
- **Accessible, with the challenge apart.** A first playthrough of 10 to 15 minutes that does not frustrate someone who did not make it (0017's measure); the difficulty in what is optional: stars, ghosts, times.
- **In this order: the platformer, the adventure, the shooter.** The platformer asks the most of the controller and of designing by measure, and leaves the metrics gym and the controls tuned for the other two; the adventure has the most pieces built; the shooter goes last.

### The platformer: the tower, at dusk

- **Climb the tower to its top before night falls:** a clear aim, and levels that go up, floor by floor (what the kit and the citadel already do well).
- **Its distinctive mechanic, the wall jump:** sliding down a wall and jumping off it, and between two walls; it stands on the climb's wall ray (2c), and gives a mechanic's four beats plainly (shown, demanded, twisted, mastered).
- **Its camera, the follow** of 4.5d (rising over walls), with the levels' zones suggesting where to look (3h): the player does not fight the camera in a precise jump.
- **Its multiplayer, ghosts by link** (4.5c's strips), raced asynchronously, without a network.
- Its controller, as the roadmap planned: the jump defined by its height and its time to the top, a stronger gravity when the button is released and when falling, a top falling speed, corner correction, ledges grabbed and climbed onto (the simulation's hold, the hands drawn on it).

### The adventure: the fortress, at night

- **Infiltrate a guarded fortress at night to take something back:** guards that see by the light and hear, doors and mechanisms; almost everything phases 3 and 4 built, with the citadel as its model.
- **Stealth first:** passing unseen (the light, the sounds, crouching) is the best way; combat is there but costs (and the stick's even trade, found in 4.5f, is avoided rather than made the centre).
- **Its distinctive mechanic, the light as a tool:** lanterns broken or put out, smoke that blinds, a flare that lights; the guards already see by the simulation's light, so they hardly change.
- **Its levels, made by hand** with the kit (as the citadel), three to five, designed by measure; the dungeons from a seed (3k) stay as an extra to play again.

### The shooter: the wall, before dawn

- **Defend the fortress's wall against waves of bots through the night:** bounded arenas (walls and yards), a rising pace, and a clear end: the dawn. On the arena of 4g and its gunners.
- **Its distinctive mechanic, explosion jumps** (rocket and grenade) with control in the air: on 4f's blast and `thrown`; a skill ceiling.
- **Its weapons, done well: in a shooter they are the heart.** The author's word: the weapons today can be much better. A stage of their own: how each one feels (its kick, its flash, its tracer, what it does where it hits, its sound, a marker when it strikes), its model, and a role each, not only numbers; today's dart, bolt, stick and grenades reconsidered, and a shotgun (its pellets on a shot's own dice, 4c).
- **No multiplayer until phase 6,** where the shooter goes online (the roadmap).

## Consequences

- Phase 5 is broken into stages in this order: the metrics gym and the games' shell first (shared by the three), then each game's pieces and then its levels, the platformer first.
- Each game's distinctive mechanic is known before its levels: the levels teach it in four beats.
- The feature radar's picks narrow: the wall jump (the platformer), smoke, a flare and the guards noticing a lamp out (the adventure), pellets and explosion jumps (the shooter).
- The tone asks for a sky (a dusk, a night, a dawn), which the engine does not draw yet (its background is a flat colour that darkens with the ambient light).

## Alternatives considered

Each question's other options, as the author saw them: three separate fictions or none (the world); a bright toy-like or a dark oppressive look (the tone); the adventure or the shooter first (the order); a demanding precision game or a stroll (the difficulty); a race against ghosts or a collect-a-thon (the platformer); gliding with updrafts or a ground pound (its mechanic); a free orbit or fixed cameras (its camera); none or co-op in two tabs (its multiplayer); a dungeon descent or an escort (the adventure); combat or puzzles first (its balance); parry and kick or systemic chemistry (its mechanic); all from a seed or mixed (its levels); a linear campaign or a tournament of arenas (the shooter); ricochets or a piercing rifle (its mechanic); co-op in two tabs or score ghosts (its multiplayer).
