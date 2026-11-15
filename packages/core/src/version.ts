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
 */
export const SIMULATION_VERSION = 15;
