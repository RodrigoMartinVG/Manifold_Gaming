import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { afterSteps, position, errors, meshes, consoleLog, typeInConsole } from './helpers';

/**
 * THE CONSOLE AND THE RECIPES (decision 0010): the Dojo's console and rooms, links with a recipe, what it tells.
 */

/** The Dojo's saved rooms, read from their files: a new room gets tested by itself. */
function dojoRooms() {
  const folder = path.join(process.cwd(), 'games/dojo/recipes');
  return readdirSync(folder)
    .filter((f) => f.endsWith('.txt'))
    .map((f) => {
      const text = readFileSync(path.join(folder, f), 'utf8');
      // The level it builds, if any: each of its boxes and stars is drawn (zones are not, unless asked;
      // nor, since stage 3b, a hidden box).
      const level = text.match(/^dojo\.level\s+(\S+)/m)?.[1];
      const pieces = level
        ? readFileSync(path.join(process.cwd(), `games/dojo/levels/${level}.level`), 'utf8')
            .split('\n')
            .filter((line) => /^sensor star\s/.test(line) || (/^box\s/.test(line) && !/\shidden(\s|$)/.test(line))).length
        : 0;
      return {
        name: f.replace(/\.txt$/, ''),
        title: text.match(/^#\s*(.+)$/m)![1]!,
        cubes: Number(text.match(/^dojo\.cubes\s+(\d+)/m)?.[1] ?? 0),
        pieces,
      };
    });
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A value other than the default for each of the view's variables. A test below checks that this is
 * all of them (the console lists them): a new view variable fails it until it is written here.
 */
const VIEW_VALUES: Record<string, string> = {
  'show.wireframe': 'on',
  'show.axes': 'on',
  'show.physics': 'on',
  'show.vectors': 'on',
  'show.contacts': 'on',
  'show.sensors': 'on',
  'show.gravity': 'on',
  'show.ik': 'on',
  'show.nav': 'on',
  'show.signals': 'on',
  'show.light': 'on',
  'show.vision': 'on',
  'show.stats': 'on',
  'view.timescale': '0.5',
  'view.volume': '0.3',
  'view.mouse': '2',
  'view.stick': '0.5',
  'view.invert': 'on',
  'view.calm': 'on',
  'view.fov': '75',
  'view.crosshair': 'off',
  'view.shake': 'off',
  'view.bob': 'off',
  'view.subtitles': 'on',
  'view.hud': 'off',
  'view.sky': '20.5',
  'view.paused': 'on',
  'controls.scheme': 'tank',
  'view.camera': 'aim',
};

// The console is the engine's: its page lists every command and variable the engine declares, and the
// Dojo's page the Dojo's own. The site generates those tables from the declarations, as data, without
// mounting anything (stage 2.5a); here, the other side: a mounted Dojo's console (`help`, `vars`)
// declares exactly what the tables list, nothing missing and nothing extra.
test('the console page and the Dojo page list exactly the commands and variables the Dojo declares', async ({ page }) => {
  await page.goto('jugar/dojo/empty/');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(2);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'help', 'vars');
  const log = await consoleLog(page).innerText();
  const commands = log
    .match(/^Commands: (.*)$/m)![1]!
    .trim()
    .split(/\s+/);
  const variables = [...log.matchAll(/^ {2}([a-z][\w.]*) {2,}/gm)].map((m) => m[1]!);
  expect(commands.length).toBeGreaterThan(20);
  expect(variables.length).toBeGreaterThan(15);
  const listed = async (address: string) => {
    await page.goto(address);
    return page.locator('.console-reference tr[data-name]').evaluateAll((rows) => rows.map((r) => r.getAttribute('data-name')!));
  };
  const engine = await listed('jugar/consola/');
  const dojo = await listed('jugar/dojo/');
  const live = [...commands, ...variables];
  expect([...engine].sort()).toEqual(live.filter((name) => !name.startsWith('dojo.')).sort());
  expect([...dojo].sort()).toEqual(live.filter((name) => name.startsWith('dojo.')).sort());
});

test("the Dojo's console opens with the º key and changes the world", async ({ page }) => {
  const list = errors(page);
  await page.goto('jugar/dojo/empty/');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(2);
  await page.keyboard.press('Backquote');
  await expect(page.locator('.mg-console')).toHaveAttribute('data-open', 'true');

  // Startup: the world starts over with 20 more cubes.
  await typeInConsole(page, 'dojo.cubes 20');
  await expect.poll(() => meshes(page)).toBe(22);
  // World: a new cube, at the next step.
  await typeInConsole(page, 'dojo.spawn 0 2 0');
  await expect.poll(() => meshes(page)).toBe(23);
  // A misspelled name suggests the similar one.
  await typeInConsole(page, 'dojo.cube 3');
  // The whole line, corrected, as a button: a click puts it in the line.
  await expect(consoleLog(page)).toContainText('Did you mean dojo.cubes 3?');
  // Export builds the link with the recipe of what changed.
  await typeInConsole(page, 'export');
  await expect(consoleLog(page)).toContainText('/jugar/dojo/empty/#recipe=dojo.cubes+20');
  // Esc closes.
  await page.locator('.mg-console input').press('Escape');
  await expect(page.locator('.mg-console')).toHaveAttribute('data-open', 'false');
  expect(list).toEqual([]);
});

for (const room of dojoRooms()) {
  test(`the saved room "${room.name}" has its address and is born with its recipe`, async ({ page }) => {
    const list = errors(page);
    await page.goto(`jugar/dojo/${room.name}/`);
    await expect(page).toHaveTitle(new RegExp(escapeRegExp(room.title)));
    // The big cube (or, with a level, the character), the room's cubes, and every box and star of its
    // level, at least: a level drawn halfway does not pass.
    await expect.poll(() => meshes(page), { timeout: 15_000 }).toBeGreaterThanOrEqual(1 + room.cubes + room.pieces);
    expect(list).toEqual([]);
  });
}

test('a link with the recipe inside: it applies what it understands, reports the rest, and does not touch the preferences', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/empty/#recipe=dojo.cubes+5;startup+save;made.up+3');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(7);
  await page.keyboard.press('Backquote');
  await expect(consoleLog(page)).toContainText("the link's recipe: 2 lines were not understood");
  await expect(consoleLog(page)).toContainText('"startup" cannot be used in a recipe');
  expect(await page.evaluate(() => localStorage.getItem('manifold.dojo.startup'))).toBeNull();
  expect(list).toEqual([]);
});

test('the startup recipe and the key bindings are saved, and hold the next time', async ({ page }) => {
  await page.goto('jugar/dojo/empty/');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.cubes 4', 'startup save', 'bind t toggle show.wireframe');
  await page.reload();
  // It is born with the startup recipe...
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(6);
  // ...and the binding works with the console closed. (The click goes to an empty corner: a click on an
  // object would inspect it, and open the console.)
  await page.locator('#game canvas').click({ position: { x: 40, y: 40 } });
  await page.keyboard.press('t');
  await page.keyboard.press('Backquote');
  await expect(consoleLog(page)).toContainText('(bind t)');
  await expect(consoleLog(page)).toContainText('show.wireframe = on');
});

// ---------------------------------------------------------------- the console, friendlier (before stage 1b)

test("help's examples are buttons: a click puts one in the line, and Enter runs it", async ({ page }) => {
  await page.goto('jugar/dojo/empty/');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(2);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'help');
  await consoleLog(page).getByRole('button', { name: 'dojo.spawn 0 5 0' }).click();
  await expect(page.locator('.mg-console input')).toHaveValue('dojo.spawn 0 5 0 ');
  await page.locator('.mg-console input').press('Enter');
  await expect.poll(() => meshes(page)).toBe(3);
  // A suggestion is a button too, with the whole line corrected.
  await typeInConsole(page, 'show.phisics on');
  // (The last one: help's examples have one with the same text.)
  await consoleLog(page).getByRole('button', { name: 'show.physics on' }).last().click();
  await expect(page.locator('.mg-console input')).toHaveValue('show.physics on ');
});

test('the free camera turns with a drag, camera.reset brings it back, and a click on an object inspects it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('jugar/dojo/empty/');
  const game = page.locator('#game');
  await expect.poll(() => game.getAttribute('data-camera'), { timeout: 15_000 }).toBe('3.20 2.40 4.20');
  // Dragging turns the camera around the scene (the world does not change: only the view). A quick
  // drag: let go, the camera keeps turning a little, slowing down.
  await page.keyboard.press('Backquote');
  await page.locator('.mg-console input').fill('camera.reset');
  await page.mouse.move(900, 600);
  await page.mouse.down();
  await page.mouse.move(700, 620, { steps: 4 });
  await page.mouse.up();
  // camera.reset at once, while it still turns: it goes back, and it STAYS there. (1a2: with three.js's
  // OrbitControls, what was left of the turn moved it again after the reset; stage 2.5a: the camera's
  // own orbit, whose leftover turn the reset sets to zero.)
  await page.locator('.mg-console input').press('Enter');
  await expect(consoleLog(page)).toContainText('the camera is back where it started');
  await expect.poll(() => game.getAttribute('data-camera')).toBe('3.20 2.40 4.20');
  await afterSteps(page, 30);
  expect(await game.getAttribute('data-camera')).toBe('3.20 2.40 4.20');
  await page.keyboard.press('Escape');
  // The camera looks at the big cube: a click in the middle of the screen inspects it.
  await page.mouse.click(640, 400);
  await expect(page.locator('.mg-console')).toHaveAttribute('data-open', 'true');
  await expect(consoleLog(page)).toContainText('entity 1 (cube), at step');
  await expect(consoleLog(page)).toContainText('body');
  await expect(consoleLog(page)).toContainText('type kinematic');
  // inspect with no id counts the entities; the stats show the physics.
  await typeInConsole(page, 'inspect', 'show.stats on');
  await expect(consoleLog(page)).toContainText('2 entities: 1 kinematic, 1 fixed');
  await expect(page.locator('.mg-stats')).toContainText('ms per step');
});

test('a level names its things, and the console finds them by name (stage 3b)', async ({ page }) => {
  const list = errors(page);
  await page.goto('jugar/dojo/surfaces/');
  await expect.poll(() => page.locator('#game').getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  await page.keyboard.press('Backquote');
  // With nothing, how many there are, and their names.
  await typeInConsole(page, 'inspect');
  await expect(consoleLog(page)).toContainText('Named: start_wood, start, start_metal, rink, stream_bed, far_side, stream.');
  // A zone with what it carries, and a box with what it is made of.
  await typeInConsole(page, 'inspect stream');
  await expect(consoleLog(page)).toContainText('(stream), at step');
  await expect(consoleLog(page)).toContainText('flow 3 0 0');
  await typeInConsole(page, 'inspect rink');
  await expect(consoleLog(page)).toContainText('material ice');
  await typeInConsole(page, 'inspect river');
  await expect(consoleLog(page)).toContainText('no entity named "river"');
  expect(list).toEqual([]);
});

test("E presses a button (stage 3c): in the machines room, it flips the door's signal, and `signals` says so", async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/machines/');
  await expect.poll(() => page.locator('#game').getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  // In front of the button, in the middle of its zone, standing.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 4.4 1 2.7');
  await page.keyboard.press('Escape');
  await afterSteps(page, 60);
  await page.keyboard.press('KeyE');
  await afterSteps(page, 10);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'signals');
  await expect(consoleLog(page)).toContainText('gate = 1  (toggle pressed) → door door');
  // A computed signal is not set from the console: it says what it is made of.
  await typeInConsole(page, 'signal gate 0');
  await expect(consoleLog(page)).toContainText('"gate" is computed (toggle pressed): set what it reads');
  expect(list).toEqual([]);
});

test('the watcher (stage 3d): in a pool of light it sees you, in the dark it loses you, and the page says so', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/watch/');
  await expect.poll(() => page.locator('#game').getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  // At the start, in the dark: how lit it is, the room's ambient; nobody sees it.
  await expect.poll(() => page.locator('#game').getAttribute('data-light'), { timeout: 15_000 }).toBe('0.08');
  expect(await page.locator('#game').getAttribute('data-seen')).toBe('0');
  const go = async (line: string) => {
    await page.keyboard.press('Backquote');
    await typeInConsole(page, line);
    await page.keyboard.press('Escape');
  };
  await go('dojo.goto -4 1 3');
  await expect.poll(() => page.locator('#game').getAttribute('data-seen'), { timeout: 15_000 }).toBe('1');
  await expect(page.locator('.mg-notice')).toContainText('El vigía te ve');
  await go('dojo.goto 0 1 9');
  await expect.poll(() => page.locator('#game').getAttribute('data-seen'), { timeout: 15_000 }).toBe('0');
  await expect(page.locator('.mg-notice')).toContainText('El vigía te perdió');
  expect(list).toEqual([]);
});

// Stage 3d: what is drawn has its budgets too, as the simulation's (stage 2.5a): what a room costs the
// GPU, as three.js counts it. Measured on 2026-11-15 (Chromium, without a GPU): the watcher room, 28
// draw calls and 5,024 triangles (its four lamps' balls were 3,072 of them; 672 since stage 4.5's close,
// a simpler sphere for what is small); the circuit, 45 and 1,992;
// the stress room, 226 and 4,152 (a draw call for every cube: one shape for all would be one).
for (const [room, draws, triangles] of [
  ['watch', 40, 8000],
  ['circuit', 60, 4000],
  ['stress', 260, 6000],
] as const)
  test(`what the room "${room}" costs the GPU stays in its budget: ${draws} draw calls, ${triangles} triangles`, async ({
    page,
  }) => {
    await page.goto(`jugar/dojo/${room}/`);
    await expect
      .poll(() => page.locator('#game').getAttribute('data-draws').then(Number), { timeout: 30_000 })
      .toBeGreaterThan(0);
    await afterSteps(page, 60);
    const drawn = {
      draws: Number(await page.locator('#game').getAttribute('data-draws')),
      triangles: Number(await page.locator('#game').getAttribute('data-triangles')),
    };
    expect(drawn.draws, `draw calls (${JSON.stringify(drawn)})`).toBeLessThanOrEqual(draws);
    expect(drawn.triangles, `triangles (${JSON.stringify(drawn)})`).toBeLessThanOrEqual(triangles);
  });

test('the sound (stage 3f): steps on metal and on wood are made in the browser, each its own, without errors', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/surfaces/');
  await expect.poll(() => page.locator('#game').getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  const walkOn = async (x: number, surface: string) => {
    await page.keyboard.press('Backquote');
    await typeInConsole(page, `dojo.goto ${x} 1 10`);
    await page.keyboard.press('Escape');
    await afterSteps(page, 30);
    await page.keyboard.down('KeyW');
    await expect.poll(() => page.locator('#game').getAttribute('data-sound'), { timeout: 15_000 }).toBe(`step ${surface}`);
    await page.keyboard.up('KeyW');
  };
  // (The keys pressed are what lets the browser start the sound.)
  await walkOn(2.75, 'metal');
  await walkOn(-2.75, 'wood');
  // (Each walk stops at its first step heard: two at least.)
  expect(Number(await page.locator('#game').getAttribute('data-sounds'))).toBeGreaterThanOrEqual(2);
  expect(list).toEqual([]);
});

test('G grabs the crate in front (stage 3g), and the console says what the character holds', async ({ page }) => {
  const list = errors(page);
  await page.goto('jugar/dojo/machines/');
  await expect.poll(() => page.locator('#game').getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 0.3 1 5');
  await page.keyboard.press('Escape');
  await afterSteps(page, 30);
  // A short step towards it (D: +X), so it looks at it; then G.
  await page.keyboard.down('KeyD');
  await afterSteps(page, 2);
  await page.keyboard.up('KeyD');
  await afterSteps(page, 10);
  await page.keyboard.press('KeyG');
  await afterSteps(page, 20);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'inspect me');
  await expect(consoleLog(page)).toContainText(/holding [1-9]/);
  expect(list).toEqual([]);
});

test('the wheel gets the camera closer, and the right button moves it sideways', async ({ page }) => {
  const list = errors(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('jugar/dojo/empty/');
  const game = page.locator('#game');
  await expect.poll(() => game.getAttribute('data-camera'), { timeout: 15_000 }).toBe('3.20 2.40 4.20');
  // How far it is from what it looks at when it starts (0 1 0): 5.8 m.
  const away = async () => {
    const [x, y, z] = (await game.getAttribute('data-camera'))!.split(' ').map(Number);
    return Math.hypot(x!, y! - 1, z!);
  };
  const far = await away();
  await page.mouse.move(640, 500);
  await page.mouse.wheel(0, -400);
  await expect.poll(away).toBeLessThan(far - 0.5);
  // The right button: sideways and up or down (no menu comes up: it is the camera's).
  const before = await game.getAttribute('data-camera');
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(520, 470, { steps: 5 });
  await page.mouse.up({ button: 'right' });
  await expect.poll(() => game.getAttribute('data-camera')).not.toBe(before);
  expect(list).toEqual([]);
});

// Stage 2.5a: a link's recipe runs before the view is built, and the registry keeps its view values
// until every piece exists (applyToView). Before, the same bug came back three times (0d, 1b, 2a): a
// link with one view variable broke the page, because its onChange ran while the view was half built.
test('a link can bring every view variable at once: the page is built, and each one is applied', async ({ page }) => {
  const list = errors(page);
  const recipe = Object.entries(VIEW_VALUES)
    .map(([name, value]) => `${name}+${value}`)
    .join(';');
  await page.goto(`jugar/dojo/course/#recipe=${recipe}`);
  await expect.poll(async () => (await position(page, 'player')).length).toBe(3);
  // They are all of them, and each one changed.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'vars');
  const log = await consoleLog(page).innerText();
  const view = log.slice(log.lastIndexOf('view: only what is seen'));
  const listed = [...view.matchAll(/^ {2}([a-z][\w.]*) {2,}(.*)$/gm)];
  expect(listed.map((m) => m[1]).sort()).toEqual(Object.keys(VIEW_VALUES).sort());
  for (const m of listed) expect(m[2], m[1]).toContain('(changed');
  // And applied: what can be seen from outside the 3D (the stats say the world is paused, and slower).
  await expect(page.locator('.mg-stats')).toBeVisible();
  await expect(page.locator('.mg-stats')).toContainText('(paused)');
  await expect(page.locator('.mg-stats')).toContainText('timescale 0.5×');
  expect(list).toEqual([]);
});

test('reset puts everything back to its default value, and vars shows it by scope', async ({ page }) => {
  await page.goto('jugar/dojo/empty/');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(2);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.cubes 5', 'show.axes on', 'vars');
  await expect(consoleLog(page)).toContainText('startup: changing them restarts the world');
  await expect(consoleLog(page)).toContainText('(changed; default 0)');
  await expect.poll(() => meshes(page)).toBe(7);
  await typeInConsole(page, 'reset', 'changed');
  await expect.poll(() => meshes(page)).toBe(2);
  await expect(consoleLog(page)).toContainText('nothing changed: everything is at its default value');
});
