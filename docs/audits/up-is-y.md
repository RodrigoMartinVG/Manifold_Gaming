# What assumes "up" is +Y (an audit, stage 4.5's close)

Phase 7 brings gravity that changes from place to place (planets, tori) and walking on walls (adhesion: the character's own "up"). Before the games are built on the engine, this lists what still assumes that "up" is the world's +Y, instead of asking the gravity (`gravityAt`, `upAt`). Nothing here is changed for phase 7 yet; what was cheap and wrong already today was mended (marked **mended**). Made on 2026-11-17 by reading the code (packages/core, bots, presentation, character; games/dojo), most structural first.

## Already relative

The character controller and its modes take `up` from the gravity (`upAt`, character.ts); hits read the poses' turns (hits.ts); the animation layers (models, feet, hands, ik, locomotion, tools), the shadows, `drive.ts`'s pitch, the subtitles' arrows and the audio work in the character's frame or in 3D. The Dojo's shots and throws use `upAt` and the eyes (`eyeHeightOf` reads the body's own frame, right since its turn is `look(facing, up)`).

## Structural

- **The navigation** (packages/bots/src/navigation.ts, path.ts): refuses a gravity not along −Y (its grid is sampled along one "down"); tops are the faces most along +Y; columns are cells in x and z, sorted by height (`at[1]`); steps, jumps and drops compare heights; the bodies it sweeps are upright capsules moving across x and z; the path's estimate is a distance in x and z. Phase 7: a navigation per surface or region of gravity, each in its own frame. **Mended:** its falls and jumps went by the Earth's gravity (wrong on the Dojo's moon), and it was not built again when the gravity changed, or when a fixed body was put elsewhere with `set`.
- **The guards** (games/dojo/src/guard.ts): flat distances and directions drop y; the feet, the ground under a point (a ray along −Y), the eyes (`center[1] + eye`) and the pitch (against the x–z plane) are along Y. One line each to `upAt`, but they follow the navigation's frame.
- **Inputs, replays and ghosts** (input.ts, replay.ts, ghost.ts): a direction on the ground is degrees from −Z towards +X, with y = 0 (`move`, `face`; `@12.3` in a replay's text); a ghost's pose keeps only a yaw, turned about +Y. On a wall, "up the wall" is lost before the character projects it back on its plane. Phase 7: directions in a frame carried with `up`, which changes the replay and ghost formats (a new format each, read from the old).
- **Maps drawn with characters** (map.ts, level.ts): a grid in x and z, walls rising along +Y, no turn. Phase 7: a map with its frame, or maps kept to flat ground. (A level's `rotate x 18` boxes and ramps are world-frame data: fine.)
- **Uniform gravity, not +Y:** the physics is given the gravity at the origin (world.ts); a hit's energy and the rest rule take that one gravity off; the ragdolls' and the sparks' small worlds too. Phase 7: a force per body.

## Small (a line or two each)

- **The camera** (camera.ts): `camera.up` is set from `upAt` only when it is reset, while the orbit and every `lookAt` use it: copy an eased `up` every frame. The leash keeps its offset in the world's frame (carry it with `up`); the vertical dead zone measures height along a fixed axis (measure from the last ground).
- **The character** (character.ts): `facing` is put back on the up-plane only when something sets it (standing still while `up` turns, it drifts off it; project it every step); with no gravity, `up` falls back to +Y (keep the last one instead).
- **The world:** a blast's push with no direction goes along +Y; a break's pieces fly with y between 0.2 and 1 (both: along `up`).
- **The Dojo:** a current pushes in x and z (`onPlane(…, up)`); extra players and spawned cubes are placed by y (setup only).
- **The drawing:** the hemisphere light's sky is +Y and the sun fixed in the world (cosmetic: under a planet, lit from below); the gravity arrows (`show.gravity`) and the navigation's marks are drawn on +Y.

Nothing to change in the sound: distances are 3D, and steps and landings are placed along `up`.
