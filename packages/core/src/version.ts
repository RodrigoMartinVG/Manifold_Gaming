/**
 * THE SIMULATION'S VERSION. A replay or a snapshot belongs to the engine that made it, not only to
 * its format: if the simulation keeps one more number, or reads its inputs another way, the same
 * inputs give another hash. So it goes up whenever the simulation changes what a replay or a
 * snapshot gives, and one of another version says so, instead of playing to a different world.
 *
 *   1  stage 1c: the first replays
 *   2  stage 1c2: turning (`ahead`, `side`, `turn`), the character's `turnSpeed`
 *   3  stage 1d: inputs as named values; the hash includes the id counter and the previous inputs
 *   4  stage 1e: who is in the match (`players`), in the hash and in snapshots
 *   5  stage 2a: zones (`sensor`) and a game's data on its entities (`game`)
 *   6  stage 2b: a character's movement as data, its mode, and what it carries
 *   7  stage 2c: capabilities (double jump, glide, climb), the wall it touches, its jumps in the air
 *   8  stage 2d: moving platforms (`mover`), what a character stands on (`ground`) and the turn they gave it (`carriedTurn`)
 *   9  stage 2.5b: what a character stands on, found with its whole capsule (not a ray from its center);
 *      stepping down from a moving platform keeps its velocity; a body's collision groups
 *  10  stage 2.5b: a game's components by name and nested (`game: { 'dojo.runner': {…} }`)
 *  11  stage 2.5c: directions on the ground (`move`, `face`) in whole degrees, changing only past 1°;
 *      written `@37` in a replay
 *  12  stage 2e: an appearance may name a model (`model`): the Dojo's characters, its mannequin
 *  13  closing phase 2: climbing along a wall past its side edge, it lets go (before, it got the hop
 *      for the wall's top); and in the Dojo, the void takes what the physics moves, not a platform
 *  14  stage 3a: a platform is found by its edge too (caught there, a character gets on), and its carry
 *      is swept through what is in the way (a beam stops it)
 *  15  stage 3b: the world's materials (in the hash and snapshots), a body's friction from its own; a
 *      character's feet push as much as the floor's friction lets them (on ice, it slides); entities
 *      with names, zones with parameters; and in the Dojo, a level brings its whole ground
 *  16  stage 3b, after it: in the Dojo, a current carries a character standing in it, not one jumping
 *      over it (it takes hold through the feet)
 *  17  stage 3c: the world's signals (in the hash and snapshots) and their phase at the end of every
 *      step; mechanisms, doors and lifts, that follow them; the character's `use`
 *  18  stage 3d: the light, the simulation's: the world's ambient, lamps, how lit every character is,
 *      and watchers that see by it (their phase, before the signals'); zones that attenuate
 *  19  stage 3e: what breaks: a threshold by the energy of a hit, its phase after the physics', a few
 *      large pieces in the hash, and the break as an event with a seed
 *  20  stage 3f: what is heard: a character's stride (in the hash), and sounds as events, steps,
 *      landings, hits, doors, lifts and breaks, with a hearing radius
 *  21  stage 3g: a body's density from its material; a character pushes what it walks into with a
 *      force its friction must beat (not Rapier's impulses); a game pushes what the physics moves
 *      (World.push); grabbing and holding (`holding`, in the hash)
 *  22  stage 3j: what a level built keeps its line (`source`) and the world the level's title, start
 *      and ambient (`origin`), both in the hash and snapshots; the console builds (`add`, `clone`,
 *      `delete`, `set`), world changes like any other
 *  23  the engine pass after the tutorial: a body created or put somewhere between two steps (or before
 *      the first) is in the queries at once, and the controller stops at it (Rapier's see it only from
 *      its next step), and a snapshot keeps which ones those are; a ray that starts inside a body gives
 *      a zero normal; Rapier does not put to sleep what slides past its friction angle or rolls down a
 *      slope; a map's floor goes under its walls too (fewer seams)
 *  24  stage 4a: the games' character, shared (@manifold/character): its model is named
 *      `character.mannequin`, and the adventure's explorer is the mannequin, with its poses
 *  25  stage 4a: a map's floor is one body, a compound of its slabs (`kind: 'compound'`) on the map's
 *      grid, which the physics makes Rapier's voxels: what rolls or slides across it does not hop or trip
 */
export const SIMULATION_VERSION = 25;
