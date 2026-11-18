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
 *  26  stage 4a: a climbing character comes to its wall (a centimeter from touching it), instead of
 *      climbing where its ray found it, up to 55 cm away: the view's hands hold on to it
 *  27  stage 4b: a character aims (`pitch`, from its input): where it aims is part of its state, and
 *      the Dojo's ball leaves along the aim
 *  28  stage 4b: crouching, a mode with its capability and numbers (`crouch`): the controller moves a
 *      lower body, it stands only where it fits, and it is seen and heard less
 *  29  stage 4b: rolling, a mode with its capability, its numbers and its state (`roll`, `rolling`):
 *      a dodge, low, for its time, the way it was asked
 *  30  stage 4b: the Dojo's throw charges while held and goes when let go (`dojo.charge`), near or far
 *  31  stage 4c (decision 0022): every character keeps the history of its last 16 poses, and its hit
 *      parts by mode (`history`, `hits`)
 *  32  stage 4c: health (`health`), what hits take through each game's filter, down and back; a hit
 *      sound says what it struck; the Dojo's training dummies, hurt by its balls
 *  33  stage 4c: weapons: the world's seed is part of its state, for each shot's own dice; shots look
 *      back (`back`); projectiles fly in their own phase and strike what they meet (`projectile`,
 *      `shot`, `impact`); the Dojo's dart, bolt and stick, taken from their racks
 *  34  stage 4e: a character may carry a brain (`brain`: which of its game's brains thinks for it, and
 *      its route), and the Dojo's players have health (a guard can fight them; down, they are back at
 *      their checkpoint three seconds later)
 *  35  stage 4f: moving for combat: blocking, a mode with its capability and numbers (`block`); a
 *      lock-on that circles without drifting (`lock`); a blast that throws (`World.explode`, `thrown`);
 *      the story's pieces, objectives that chain and short scenes (a phase, `story`); the Dojo's stick
 *      strikes along its whole length, and its grenades
 *  36  stage 4g: the Dojo's shots leave the eyes (where a first-person camera is); its guards may carry a
 *      dart or a bolt (`gunner` zones) and are back on their feet ten seconds after they go down
 *  37  stage 4.5b: the debts that change the simulation, in one version: against a wall, a character
 *      keeps no velocity into it; down a slope too steep to stand on, it slides, less its floor's
 *      friction; what is lighter than 5 kg does not move it (it pushes it); what leaves the world is
 *      gone; our cosine has its last term; the Dojo's shots leave the head in each way of moving
 *  38  stage 4.5's close: a hit is heard (and, in the Dojo, hurts) only as a contact begins, and for
 *      what it did beyond holding a body up against gravity (at rest, a heavy one was heard on every
 *      step); a push is part of a body's velocity as the world knows it; what is held is held short of
 *      what is in the way, not pushed into it
 *  39  stage 5c: the platformer's controller: a jump by its height and its time to the top, its own
 *      gravity, stronger let go and falling, a top falling speed, corner correction (`arc`); down a wall
 *      and off it (`wallJump`, the `slide` mode); a ledge grabbed, hung from and climbed onto (`ledge`,
 *      the `hang` mode). A character without them moves as in 38 to the bit; its state has their fields
 *  40  stage 5d: a ledge is grabbed only on what stays where it is (on a lift's edge, a character hung
 *      in the air where the edge had been, as the lift went on)
 *  41  stage 5e: the weapons and the guards are the games' (`@manifold/arms`), out of the Dojo's rules:
 *      their state named `arms.weapon`, `arms.fuse`, `arms.thrown`, `arms.gunner`, the attack
 *      `arms.attack`, the guard's brain `arms.guard`. The same behavior to the bit (the old replays,
 *      their names put back, give their old hashes)
 *  42  stage 5g: thrown by a blast, a character steers in the air by `airStrafe` (the part of its velocity
 *      along the way asked rises to the speed asked, never past it; until 41 it grew for as long as it
 *      was asked); the shooter's weapons: a shotgun (its pellets on the shot's dice) and a launcher (a
 *      rocket that blows where it strikes)
 *  43  stage 5i: fair gunners (decision 0031): a weapon raised (`arms.raised`, held by `arms.ready`, heard
 *      as `ready`) before a fair gunner's shot; its aim where the target was, its error on the shot's own
 *      dice, at most two raised at once, the first shot a miss, a flinch when hit (`arms.gunner`'s
 *      `fair`). A gunner without `fair` fights as in 42 to the bit (the Dojo's replays keep their hashes)
 *  44  stage 5k: the fortress's intruder and the wall's defender jump as grounded characters
 *      (`GROUNDED`: an arc of 1.1 m in 0.36 s, falling 1.4 times as fast), no longer 2.15 m on the
 *      world's gravity; the engine, the Dojo and the tower as in 43
 *  45  stage 5l: an aware guard's awareness fills while it sees someone and empties when it does not
 *      (`arms.notice`: calm, suspicious, alerted, searching; its barks `huh` and `calm`), and its brain
 *      goes after them only once alerted; a pebble thrown clatters where it strikes (`pebble`); the
 *      fortress counts a guard alerted as seen. Guards without `aware` (the Dojo's) as in 44
 *  46  stage 5m: the fortress's four levels, drawn as plans (levelFromPlan), and its intruder counting
 *      the scrolls it takes (`scroll` zones) and the guards it takes down, for a level's recap; the
 *      engine, the Dojo, the tower and the wall as in 45
 */
export const SIMULATION_VERSION = 46;
