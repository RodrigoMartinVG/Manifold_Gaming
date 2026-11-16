/**
 * THE LEVEL, DRAWN: one character per cell of 1 m. `#` is a wall, `.` floor, a space nothing (a pit),
 * and each letter LEGEND names is floor with that zone on it. The ball starts at S, and the board
 * leans toward G. The first row is the one after `MAP = \``.
 */
export const CELL = 1;
export const LEGEND: Record<string, string> = { S: 'start', G: 'goal' };
export const MAP = `
###############
#S......#######
#######.#######
#####.......###
#####.......###
#####.......###
###########.###
###########..G#
###############`;

/**
 * ITS TEST: a recipe that runs with the level, step by step. `drop` puts the ball at the start: a
 * change of the world, which enters at the next step. `wait n` leaves what follows for n steps later.
 * `assert <what> <op> <value>` says yes, or no and what it is (`=`, `<`, `>`, `~` near).
 */
export const RECIPE = `
# Cheap to build: few boxes.
assert boxes < 30
drop
# One second after the ball came in, exactly here: the simulation is deterministic.
wait 60
assert ball.x = 2.9361681938171387
# Nine seconds later, in the goal.
wait 540
assert ball.zone = goal`;
