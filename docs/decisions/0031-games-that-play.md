# 0031. The three games, played as games

- **Status:** accepted (2026-11-18): "hagamos todo y sigamos tus recomendaciones". The stages 5i to 5n in the
  proposed order, with the recommended answer to each question (below). The tower's camera, the one concrete bug, was
  fixed first (commit `e6af334`). After 5j the author asked for better explosions and sounds, for the walk's
  sway in first person, and for a better calibrated jump ("quizás sea la gravedad"): a stage of its own, the new
  5k, and the later ones one letter on (5l to 5o).
- **Date:** 2026-11-18

## Context

The author played the three games of phase 5 (decision 0029) and wrote:

> la sensación en general es buena pero le falta más flow de ser un juego, jugabilidad, inmersión de que estoy en un
> juego... el de saltar contra las paredes tiene un problema grave con la cámara [...] respecto al de infiltrarse en la
> fortaleza, trataría de analizar cómo suelen funcionar esos juegos, porque este es el que menos jugabilidad tiene...
> respecto al shooter: los bots son muy perfectos; además no es un nivel en el que voy avanzando sino simplemente un
> salón en el que los bots aparecen; tiene que ser más como un nivel del Doom o del Quake, con varios niveles,
> diferentes cuestiones, llaves; también las armas tienen que ser mucho mejores y más variadas, con mejores efectos;
> tiene que estar mucho más balanceado y generar más atmósfera... lo de la atmósfera vale para los tres.

**What the games are today** (read from the code and the reports 5d, 5f, 5h):

- **The tower:** four floors, each one beat of the wall jump; gold times of 9 to 27 s. The controller has 0.1 s of
  coyote time and of jump buffering, and a stronger gravity once the jump is let go (5c). The camera turned round the
  climber on every sideways step, and forward with it: fixed with `view.camera steady` (`e6af334`).
- **The fortress:** three levels of 19 to 28 s (gold). The light is a sum (5f): a guard sees whoever stands in its
  12 m, 100° cone with `L · t · p ≥ 0.3`; it hears steps (6 m walking, 1.5 m crouched). Seen means chased at once:
  there is no suspicion that builds up, no sign of how lit or loud the intruder is, no mark over a guard; caught, the
  intruder is back at the checkpoint three seconds later. Tools: lanterns put out (and relit by wary guards), smoke, a
  flare, crates, a takedown from behind. Each level is one short path.
- **The wall:** three yards with waves (gold 28 to 48 s). The attackers see at 30 m and 120°, take 1 s, then down to
  0.5 s, to fire, and aim with an error of 0.15 to 0.3; health refills between waves. Weapons: dart, bolt, shotgun,
  launcher (5g). No keys, no doors, no exploration; one hall where bots appear.
- **The three:** no post-processing (no glow, no vignette, no exposure), sounds and music synthesized (stage 3), a
  ragdoll and debris (4.x). Sky by the hour (5a).

**What was read.** Three reports on how games of each kind are made, from their designers' own words where possible
(GDC talks and their write-ups, postmortems, released source code: id's Doom 1.10 and Quake, Valve's Source SDK
2013); the sources are listed at the end. Their conclusions, applied, are the decision below.

## Decision (proposed)

### For the three: flow, feel and atmosphere

The deepest cause of "no flow" is that **every level lasts seconds**. A game's arc (a goal in sight, learning a rule,
a twist, a finale) needs minutes: the research's levels are introduce, develop, twist, conclude (Nintendo's
kishōtenketsu), with breathers between the tense parts and a finale that lands (people judge a session by its peak
and its end). So each game's levels grow to **2 to 5 minutes**, built on that rhythm, with **checkpoints between
encounters** and a return to play in under a second.

A shared layer for the three, in the presentation only (the simulation, its replays, ghosts and gold times are not
touched):

1. **Night that feels dark and stays readable** ("make it feel dark, don't make it dark"): a cool shadowless fill, warm
   lamp pools with crisp edges, rim light on characters, fog tinted to the sky's horizon, exposure and tone mapping.
2. **Post-processing:** glow on what emits light (lamps, the flame, muzzle flashes), a vignette, a hurt vignette.
3. **Sound beds per zone** (wind, insects, a distant bell) with randomized one-shots placed in space, footsteps by
   surface (stone, wood, metal, grass) for everyone, and a reverb per kind of room.
4. **Music in layers** that follow the game: the climb's height, the fortress's alert, the wall's combat; a cadence
   at each finale.
5. **Feel for every action:** squash and dust on jumps and landings, a shadow straight under anything in the air, hit
   reactions, hit stop of a few hundredths, camera shake as seasoning, with settings to turn shake and head bob off
   (Xbox accessibility guideline 117).

### The tower

- Done: the steady camera.
- **Depth and contact:** a blob shadow under the climber always; dust on take-off, landing and wall contact; a slide
  sound and particles on the wall; a landing thud by speed.
- **Forgiveness for wall jumps** as Celeste does: accept a wall jump a little off the wall, the same coyote and buffer
  windows on walls as on the ground, a short hang at the jump's top while held.
- **Floors as rhythm:** more and longer floors, each one idea taught safely, developed, twisted, concluded; rest
  ledges; the summit always in sight, lit, as the landmark.
- **Atmosphere:** the dusk sky driving the palette, wind that thickens with height, music that adds a layer per floor
  and resolves at the top, a finale (the camera pulls out over the land at sunset).

### The fortress (the largest change in how it plays)

Against the research's checklist (Thief, Mark of the Ninja, Dishonored, Splinter Cell, Hitman, Monaco; GMTK's
"School of Stealth"), the fortress misses the first two items, which are the ones every stealth game needs:

1. **The intruder can read their own exposure.** A light gem in the HUD (from the light sum the game already does),
   the character drawn darker when hidden, and **noise rings** as large as the sound really carries.
2. **Guards' awareness is readable, and fills over time.** Not seen-and-chased at once: an awareness that rises with
   light and distance over a reaction time (faster up close and in light, slower far and in the dark), through
   **unaware → suspicious** (a "?", a bark, it walks to look) **→ alerted** (a "!", a shout) **→ searching** (a timer,
   the last place it saw you marked) **→ back on its round, wary**. Breaking the line of sight while suspicious lets you
   get away.
3. **Verbs that move guards, not only wait for them:** a pebble to throw (a noise a guard comes to check), with the
   lanterns (already relit by wary guards: a limit, as the research asks), smoke and the flare. Limited, so none
   becomes the only strategy.
4. **Levels with choices:** two or more real routes and loops, a safe spot that overlooks each area, long cover,
   patrols that give up ground, a path with no need to fail, never two dangers back to back.
5. **Failure you can recover from:** only guards within earshot join; searches by their senses, tens of seconds long;
   escaping and hiding work; checkpoints per encounter (they exist).
6. **Objectives with risk:** the flame, plus optional ones off the safe path (relics, no one alerted, no takedown),
   and a recap at the end.
7. **Fair guards:** you cannot be seen by a guard you cannot see; a guard off screen hears less; reactions
   deterministic, so a plan that worked works again.
8. **Sound and light for stealth:** guards' steps and barks in space, heard before they are seen; music in tiers by
   the highest awareness near you; crisp lamp pools.

Where it lives: the awareness in `packages/arms/src/brain.ts` (the simulation: it changes hashes and replays, a
version), the signs and rings in the presentation, the pebble in `packages/arms/src/stealth.ts`, the levels rebuilt in
`games/fortress/levels/`.

### The wall (a redesign)

**Bots you can beat** (the author's first complaint, and the cheapest fix), with the numbers the classics ship
(Doom's and Quake's source, Half-Life 2's): about 0.3 s to react when unaware; a spread that starts at three times
normal and narrows over 0.6 s; aiming where the player was 0.2 s before; at most two attacking at once (attack
tokens); a wind-up of 0.3 to 0.5 s with its sound before each shot; never two in a row; a flinch when hit; misses
you can see; enemy projectiles slow enough to dodge (0.6 to 1.2 times the player's run).

**Levels you advance through, not waves:** three or four levels, each a hub with two or three loops that come back,
one or two keys with doors of their colour, the way out seen early, two to four secrets with a visible tell and a real
reward, and a pacing script (an impressive quiet start, a lesson, a loop, the key's fight, a breather, a fair ambush,
a final arena). Taken from the genre's conventions, designed as Manifold's own: its fortress, its kit, its night.

**Enemies with roles,** one new per level: fodder, a ranged one with slow projectiles, a charger (fast, melee, loud),
a tank that hardly flinches, shown from afar before you fight it.

**Weapons with roles,** one new per level and placed before the fight that needs it: five to seven on three or four
kinds of ammunition (a sidearm, the shotgun, something rapid, the launcher with its explosion jumps, decision 0029's
mechanic, and a heavy one), pickups of health, armour and ammunition, each level playable from its start.

**Feel, in the order the research puts it:** hit reactions first (flinch, hit marker, a hit sound, a kill sound), then
impacts by material, a muzzle flash with a brief light, the view kicked and springing back, shake by "trauma", the
ragdoll on a kill that overshoots.

**Balance by placement first,** then the attack tokens and a damage multiplier per difficulty.

**The thread:** the wall at dawn can stay, as progression: the attackers broke in, and you take the wall back section
by section (the wall walk, the gatehouse, the towers) to close the gate before the sun rises (a question below).

### The order (proposed stages)

| Stage | What                                                                                                | Touches the simulation         |
| ----- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| 5i    | The wall's bots made fair, and the weapons' feel (hit reactions, impacts, flash, kick)              | Yes: the bots' aim (a version) |
| 5j    | The shared atmosphere: night lighting, post-processing, sound beds, footsteps, music layers         | No                             |
| 5k    | (The author's, after 5j) Explosions and sounds far better; the walk's sway; the jump calibrated     | Yes: the jump (a version)      |
| 5l    | The fortress's readability: light gem, noise rings, awareness that fills, guards' signs, the pebble | Yes: awareness (a version)     |
| 5m    | The fortress's levels rebuilt: longer, loops, vantage points, optional objectives                   | Levels only                    |
| 5n    | The wall's levels: keys, doors, secrets, enemy roles, new weapons and pickups                       | Yes: new enemies, weapons      |
| 5o    | The tower: contact, forgiveness, longer floors, the finale                                          | Forgiveness (a version)        |

Each stage keeps the project's rules: deterministic simulation, reference replays recorded again where the
simulation changes (with `SIMULATION_VERSION` raised, today 42), its tests, its report.

As it went (5j): footsteps by surface were already there (stage 3f), from every character and in space; the music's
layers depend on each game, so they go with its stage: tiers by the guards' awareness (5l), combat (5n), a layer per
floor (5o).

As it went (5k): the floaty jump was the world's gravity under the engine's old jump (6.5 m/s against 9.81 m/s², 2.15
m up and 1.3 s in the air); the fortress and the wall now jump as grounded characters (`GROUNDED`: 1.1 m in 0.36 s,
falling at 1.4 times that gravity), the world's gravity unchanged. The sounds stay made, not recorded (decision 0027),
in layers after Farnell's "Designing Sound", heard as sound travels (the highs off with distance, late at 343 m/s, a
made convolution echo, a compressor). The walk's sway is a comfort setting (`view.bob`), as the research asked.

As it went (5l): the awareness lives in the simulation (`noticing`, `arms.notice`), not in the brain's memory,
so the view can draw it and any host's brain reads the same; only guards whose wariness has `aware` have it
(the Dojo's do not). The fortress's star counts guards alerted, not glimpses. On the author's word mid-stage,
weapons no longer go through walls: what is held is drawn raised out of a wall in front of it, and what is
fired or thrown starts on this side of a near wall.

## The author's answers

The author took every recommendation (2026-11-18):

1. **The order:** the wall's bots and weapon feel first (5i), then the shared atmosphere (5j), the fortress's
   readability (5k) and levels (5l), the wall's levels (5m), the tower (5n). (Since 5j, one letter on: the author's
   5k came in first.)
2. **The shooter's thread:** the dawn stays, as progression: the attackers broke in, and the defender takes the wall
   back section by section to close the gate before the sun rises.
3. **Seen in the fortress:** a chase one escapes and hides from, the genre's norm; the takedown from behind stays, and
   no fight is asked for (caught is still back to the checkpoint).
4. **Length:** levels of 2 to 5 minutes: the tower six floors, the fortress four levels, the wall four levels.
5. **Comfort:** camera shake, head bob and the field of view in the games' settings.

## Sources

- **Stealth:** Nels Anderson on Mark of the Ninja
  ([five rules](https://www.gamedeveloper.com/design/-i-mark-of-the-ninja-i-s-five-stealth-design-rules),
  [reinventing stealth](https://www.gamedeveloper.com/design/reinventing-stealth-in-2d-with-i-mark-of-the-ninja-i-));
  [building Thief's stealth system](https://www.gamedeveloper.com/design/building-the-original-i-thief-s-i-revolutionary-stealth-system);
  [Thief's AI sensory system](https://www.gamedeveloper.com/programming/building-an-ai-sensory-system-examining-the-design-of-i-thief-the-dark-project-i-);
  [Splinter Cell: Blacklist's stealth AI](https://www.gamedeveloper.com/design/bringing-balance-to-stealth-ai-in-splinter-cell-blacklist);
  Randy Smith, [Level Building for Stealth](https://gdcvault.com/play/1013435/Level-Building-for-Stealth);
  Game Maker's Toolkit, School of Stealth ([part 1](https://www.youtube.com/watch?v=Ay-5g36oFfc),
  [part 3](https://www.youtube.com/watch?v=uF6c8KJuuEk));
  [Mark of the Ninja's sound](https://designingsound.org/2013/06/the-dynamics-of-mark-of-the-ninja).
- **Shooters:** [id's Doom source](https://github.com/id-Software/DOOM),
  [Quake's QuakeC](https://github.com/id-Software/quake-rerelease-qc),
  [Valve's Source SDK 2013](https://github.com/ValveSoftware/source-sdk-2013);
  [Romero on Doom's levels](https://www.shacknews.com/article/99662/stairway-to-badass-the-making-and-remaking-of-doom?page=6);
  [the AI of Doom (2016)](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-);
  [Halo's "illusion of intelligence"](https://www.jmeiners.com/shamans/papers/ai/the_illusion_of_intelligence.pdf);
  [Naughty Dog on weapon feel](https://media.gdcvault.com/gdc2024/Slides/GDC+slide+presentations/Mattson_Derek_ASecondShot_Notes.pdf);
  [making a gun come to life (Witchfire)](https://www.theastronauts.com/2019/03/making-gun-come-to-life/);
  [the Level Design Book on lighting](https://book.leveldesignbook.com/process/lighting).
- **Feel and atmosphere:** [Celeste and forgiveness](https://maddymakesgames.com/articles/celeste_and_forgiveness/);
  [Psychonauts 2's jump](https://www.doublefine.com/news/devin-article-raz-jump);
  [Koizumi on Mario Galaxy's camera](https://www.gamedeveloper.com/game-platforms/migs-2007-nintendo-s-koizumi-on-the-path-from-garden-to-i-galaxy-i-);
  [50 game camera mistakes](https://matellion.blogspot.com/2016/08/50-common-game-camera-mistakes-and-how.html);
  [Sakurai on hit stop](https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/);
  [Xbox accessibility guideline 117](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117);
  [darkness in level design](https://book.leveldesignbook.com/process/lighting/darkness);
  [the art of Firewatch](https://www.thumbsticks.com/gdc-2015-the-art-of-firewatch);
  [the lighting of INSIDE](https://blog.playdead.com/articles/the_lighting_of_inside/lighting_of_inside.html).
