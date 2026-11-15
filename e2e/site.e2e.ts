import { readdirSync, readFileSync } from 'node:fs';
import { afterSteps, position, settled } from './helpers';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/** Collects the page's errors (exceptions and `console.error`) to demand there are none. */
function errors(page: Page) {
  const list: string[] = [];
  page.on('pageerror', (e) => list.push(`exception: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') list.push(`console: ${m.text()}`);
  });
  return list;
}

// The site's texts are in Spanish (decision 0011): the links and headings are looked for in Spanish.
test('the home page opens and leads to the Dojo, the tutorial and the project', async ({ page }) => {
  const list = errors(page);
  await page.goto('./');
  await expect(page).toHaveTitle(/Manifold/);
  await expect(page.getByRole('link', { name: 'Entrar al Dojo' })).toBeVisible();
  await page.getByRole('link', { name: 'Empezar el tutorial' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('El tutorial');
  await page.locator('header nav.mg-sections').getByRole('link', { name: 'Proyecto' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('El proyecto');
  expect(list).toEqual([]);
});

test("the home page's showcase lights up and its simulation advances", async ({ page }) => {
  const list = errors(page);
  await page.goto('./');
  // Three.js arrives after the page (dynamic import): the showcase goes from "loading" to "ready"
  // once it drew its first frame. With a GPU it takes less than 1 s; without one (as in continuous
  // integration) about 3 s, and with another test running alongside, more than 15 s once in a while.
  await expect(page.locator('.showcase')).toHaveAttribute('data-state', 'ready', { timeout: 40_000 });
  // Then it has to keep DRAWING and its simulation to ADVANCE: progress, not a frame rate. Without a
  // GPU, with other tests drawing alongside, it drew 10 frames in 15 s (it used to be asked for 30,
  // and failed there). The showcase writes its frames and its step on every frame.
  const view = page.locator('.showcase-window');
  const read = async (name: 'frames' | 'step') => Number(await view.getAttribute(`data-${name}`));
  const [frames, step] = [await read('frames'), await read('step')];
  await expect.poll(() => read('frames')).toBeGreaterThanOrEqual(frames + 3);
  await expect.poll(() => read('step')).toBeGreaterThan(step); // (a frame shorter than a step takes none)
  // The plate shows a step the simulation went through (it is written every 10 frames, to be read).
  const plate = Number((await page.locator('.showcase-step b').textContent())?.replace(/\D/g, ''));
  expect(plate).toBeGreaterThan(0);
  expect(plate).toBeLessThanOrEqual(await read('step'));
  expect(list).toEqual([]);
});

// What is drawn in the empty Dojo: the big cube, the floor (its grid, since stage 3b) and the cubes.
for (const [address, drawn] of [
  ['jugar/dojo/empty/', 2],
  ['jugar/dojo/empty/#recipe=dojo.cubes+20;seed+3', 22],
  // An old link (before 2026-11-14 the empty Dojo was `/jugar/dojo/`): it goes to the empty room, recipe and all.
  ['jugar/dojo/#recipe=dojo.cubes+20;seed+3', 22],
] as const) {
  test(`the Dojo draws without errors, one thing drawn per entity (${address})`, async ({ page }) => {
    const list = errors(page);
    await page.goto(address);
    await expect(page.locator('#game canvas')).toBeVisible();
    // The client writes down how many frames it drew: at least 30 must go by (half a second).
    await expect
      .poll(async () => Number(await page.locator('#game').getAttribute('data-frames')), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(30);
    // One mesh per entity, not one more (in step 0, every cube was drawn twice).
    expect(Number(await page.locator('#game').getAttribute('data-meshes'))).toBe(drawn);
    expect(list).toEqual([]);
  });
}

// ---------------------------------------------------------------- the console and the recipes (decision 0010)

const meshes = (page: Page) => page.locator('#game').getAttribute('data-meshes').then(Number);
const consoleLog = (page: Page) => page.locator('.mg-console-log');

async function typeInConsole(page: Page, ...lines: string[]) {
  for (const line of lines) {
    await page.locator('.mg-console input').fill(line);
    await page.locator('.mg-console input').press('Enter');
  }
}

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
  await expect(consoleLog(page)).toContainText('Named: start, rink, stream_bed, far_side, stream.');
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
  await expect(page.locator('.mg-notice')).toContainText('the watcher sees you');
  await go('dojo.goto 0 1 9');
  await expect.poll(() => page.locator('#game').getAttribute('data-seen'), { timeout: 15_000 }).toBe('0');
  await expect(page.locator('.mg-notice')).toContainText('the watcher lost you');
  expect(list).toEqual([]);
});

// Stage 3d: what is drawn has its budgets too, as the simulation's (stage 2.5a): what a room costs the
// GPU, as three.js counts it. Measured on 2026-11-15 (Chromium, without a GPU): the watcher room, 28
// draw calls and 5,024 triangles (its four lamps' balls are 3,072 of them); the circuit, 45 and 1,992;
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
  'show.signals': 'on',
  'show.light': 'on',
  'show.vision': 'on',
  'show.stats': 'on',
  'view.timescale': '0.5',
  'view.paused': 'on',
  'controls.scheme': 'tank',
  'view.camera': 'aim',
};

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

// ---------------------------------------------------------------- the character (stage 1b)

test('in the course, the keys drive the character: it walks where the camera looks, jumps, and the camera follows', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/');
  // It falls onto the floor and stands still (its position stops changing).
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await settled(page, 'player');
  const [, y0, z0] = await position(page, 'player');
  const camera0 = await position(page, 'camera');
  // W held: the camera is behind it, looking at the course (−Z), so it walks towards −Z. (Held until it
  // advances 2 m, not for a fixed time: without a GPU, as in these tests, there are few frames per
  // second, and the fixed step runs at most 5 steps per frame, so the world goes slower than the clock.)
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 20_000 }).toBeLessThan(z0! - 2);
  await page.keyboard.up('KeyW');
  // The camera came along: as far as the character, less what drawing between two steps lags (the
  // camera follows the body as drawn, at most one step behind: 7.5 cm walking). Both read from the
  // same frame. (It asked for 2 m from both: the character just past them, the camera a step short.)
  const [player, camera] = await page
    .locator('#game')
    .evaluate((el) => [el.dataset.player!, el.dataset.camera!].map((v) => v.split(' ').map(Number)));
  expect(camera0[2]! - camera![2]!).toBeGreaterThan(z0! - player![2]! - 0.1);
  // Space, pressed and released at once (maybe between two frames): it jumps all the same.
  await page.keyboard.press('Space');
  // (With time: without a GPU and after many tests, a frame can take long.)
  await expect.poll(async () => (await position(page, 'player'))[1], { timeout: 15_000 }).toBeGreaterThan(y0! + 1);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- models and animations (stage 2e)

test("in the course, the character is the Dojo's mannequin: its animation follows how it moves, and a jump does not bounce the camera", async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/');
  // The model loaded (through the site's own build, as a visitor gets it), and it stands quiet.
  await expect.poll(() => page.locator('#game').getAttribute('data-clip'), { timeout: 15_000 }).toBe('idle');
  await settled(page, 'player');
  // Everything the page writes from now on, frame by frame: a jump fits between two readings.
  type Seen = { clip: string; player: number; camera: number };
  await page.locator('#game').evaluate((el) => {
    const seen: Seen[] = [];
    (window as unknown as { seen: Seen[] }).seen = seen;
    const height = (v: string | undefined) => Number(v?.split(' ')[1]);
    new MutationObserver(() =>
      seen.push({ clip: el.dataset.clip!, player: height(el.dataset.player), camera: height(el.dataset.camera) }),
    ).observe(el, { attributes: true, attributeFilter: ['data-clip', 'data-player', 'data-camera'] });
  });
  const seen = () => page.evaluate(() => (window as unknown as { seen: Seen[] }).seen);
  const last = async () => (await seen()).at(-1)?.clip;
  // Walking, it walks (or runs); stopping, it is quiet again.
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => (await seen()).some((s) => s.clip === 'walk' || s.clip === 'run'), { timeout: 20_000 })
    .toBe(true);
  await page.keyboard.up('KeyW');
  await expect.poll(last, { timeout: 20_000 }).toBe('idle');
  // A jump from standing: in the air, its own animations (rising, falling). The character rises 2 m; the camera does
  // not go with it (the vertical dead zone: before it, the whole world bounced on the screen).
  await settled(page, 'player');
  const from = (await seen()).length;
  await page.keyboard.press('Space');
  await expect
    .poll(async () => (await seen()).slice(from).some((s) => s.clip === 'rise' || s.clip === 'fall'), { timeout: 15_000 })
    .toBe(true);
  await expect.poll(last, { timeout: 20_000 }).toBe('idle');
  const jump = (await seen()).slice(from);
  const rise = (key: 'player' | 'camera') => Math.max(...jump.map((s) => s[key])) - Math.min(...jump.map((s) => s[key]));
  expect(rise('player')).toBeGreaterThan(1.5);
  expect(rise('camera'), 'the camera, during the jump').toBeLessThan(0.1);
  expect(list).toEqual([]);
});

test('the mannequin moves where it really goes: backwards, to a side, and against a wall it does not walk in place (stage 2e2)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  // Tank controls: S goes back from where it looks, E to its right, and neither turns it.
  await page.goto('jugar/dojo/course/#recipe=controls.scheme+tank;view.camera+chase');
  const clip = () => page.locator('#game').getAttribute('data-clip');
  await expect.poll(clip, { timeout: 15_000 }).toBe('idle');
  await settled(page, 'player');
  for (const [key, cycle] of [
    ['KeyS', 'walk_back'],
    ['KeyE', 'walk_right'],
    ['KeyQ', 'walk_left'],
  ] as const) {
    await page.keyboard.down(key);
    await expect.poll(clip, { timeout: 20_000, message: key }).toBe(cycle);
    await page.keyboard.up(key);
    await expect.poll(clip, { timeout: 20_000 }).toBe('idle');
  }
  // In front of the tower (climbing is off), still looking at it (−Z): W walks into it, and pushing on
  // against it, it stands. In 2e it walked in place: the view read the velocity it asked for.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 8 1 5');
  await page.keyboard.press('Escape');
  await settled(page, 'player');
  // Every animation it plays from now on, in order: it walks only 1.5 m before the tower (a third of a
  // second), which a poll can miss on a loaded machine (it did, once).
  await page.locator('#game').evaluate((el) => {
    const seen: string[] = [];
    (window as unknown as { clipsSeen: string[] }).clipsSeen = seen;
    new MutationObserver(() => {
      if (seen.at(-1) !== el.dataset.clip) seen.push(el.dataset.clip!);
    }).observe(el, { attributes: true, attributeFilter: ['data-clip'] });
  });
  const seen = () => page.evaluate(() => (window as unknown as { clipsSeen: string[] }).clipsSeen);
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await seen()).includes('walk'), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 30_000 }).toBeLessThan(3.8);
  await expect.poll(clip, { timeout: 20_000 }).toBe('idle');
  await afterSteps(page, 60);
  expect(await clip(), 'pushing on against the tower').toBe('idle');
  expect((await seen()).at(-1), (await seen()).join(' → ')).toBe('idle');
  await page.keyboard.up('KeyW');
  expect(list).toEqual([]);
});

test('a jump in the air is a somersault, and coming down from high up, the landing weighs (stage 2e2)', async ({ page }) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/#recipe=dojo.doublejump+on');
  await expect.poll(() => page.locator('#game').getAttribute('data-clip'), { timeout: 15_000 }).toBe('idle');
  await settled(page, 'player');
  // Every animation the page says it plays, in order; and every gesture it starts (stage 3b: a landing
  // lasts 0.3 s and comes in from nothing, and at a few frames per second it never weighed most in a
  // frame: the test failed one time in three).
  await page.locator('#game').evaluate((el) => {
    const seen: string[] = [];
    const gestures: string[] = [];
    (window as unknown as { seen: string[]; gestures: string[] }).seen = seen;
    (window as unknown as { seen: string[]; gestures: string[] }).gestures = gestures;
    new MutationObserver(() => {
      if (seen.at(-1) !== el.dataset.clip) seen.push(el.dataset.clip!);
      const gesture = el.dataset.gesture?.split(' ')[1];
      if (gesture && el.dataset.gesture !== gestures.at(-1)) gestures.push(el.dataset.gesture!);
    }).observe(el, { attributes: true, attributeFilter: ['data-clip', 'data-gesture'] });
  });
  const seen = () => page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  const gestures = () => page.evaluate(() => (window as unknown as { gestures: string[] }).gestures.map((g) => g.split(' ')[1]));
  // A jump, and at its top (rising no more: falling), a second one in the air.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await seen()).includes('fall'), { timeout: 15_000 }).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await gestures()).includes('flip'), { timeout: 15_000 }).toBe(true);
  // Down from 4.7 m (about 9 m/s): the landing, over everything else; then quiet.
  await expect.poll(async () => (await gestures()).includes('land'), { timeout: 20_000 }).toBe(true);
  await expect.poll(async () => (await seen()).at(-1), { timeout: 20_000 }).toBe('idle');
  expect(await gestures()).toEqual(['flip', 'land']);
  expect(list).toEqual([]);
});

test('a link can leave the camera free: the character walks, and the camera stays', async ({ page }) => {
  const list = errors(page);
  // (A recipe runs before the world exists: view.camera must not need anything that comes later.)
  await page.goto('jugar/dojo/course/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [, , z0] = await position(page, 'player');
  const camera0 = await position(page, 'camera');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 20_000 }).toBeLessThan(z0! - 1.5);
  await page.keyboard.up('KeyW');
  expect(await position(page, 'camera')).toEqual(camera0);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- replays, ghosts and aiming (stage 1c)

test('ghost: the world starts over and a ghost does what you did, next to you', async ({ page }) => {
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [, , z0] = await position(page, 'player');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 30_000 }).toBeLessThan(z0! - 1.5);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'ghost');
  await expect(consoleLog(page)).toContainText('a ghost of');
  await page.keyboard.press('Escape');
  // Back at the start, the player waits; the ghost walks the same way again.
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 15_000 }).toBeGreaterThan(z0! - 0.1);
  await expect.poll(async () => (await position(page, 'ghost'))[2] ?? 99, { timeout: 30_000 }).toBeLessThan(z0! - 1.5);
  expect((await position(page, 'player'))[2]).toBeGreaterThan(z0! - 0.1);
});

test('aim: the character looks where the camera looks, and walks sideways without turning', async ({ page }) => {
  await page.goto('jugar/dojo/course/#recipe=view.camera+aim');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [x0] = await position(page, 'player');
  // D: to the right of the camera (+X); the character keeps looking ahead (−Z).
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'player'))[0], { timeout: 30_000 }).toBeGreaterThan(x0! + 1);
  await page.keyboard.up('KeyD');
  // It kept looking ahead (−Z) while it walked to the side.
  expect(await page.locator('#game').getAttribute('data-facing')).toBe('0.00 0.00 -1.00');
});

// ---------------------------------------------------------------- turning and the camera (stage 1c2)

test('follow is a leash: going to a side turns the camera towards the character', async ({ page }) => {
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [x0] = await position(page, 'player');
  // D: to the camera's right (+X). Before, the camera moved as much as the character and never turned.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'player'))[0], { timeout: 30_000 }).toBeGreaterThan(x0! + 3);
  await page.keyboard.up('KeyD');
  const [px, , pz] = await position(page, 'player');
  const [cx, , cz] = await position(page, 'camera');
  // Where the camera looks along the ground now has a good part of +X.
  expect((px! - cx!) / Math.hypot(px! - cx!, pz! - cz!)).toBeGreaterThan(0.3);
});

test('tank controls: A and D turn the character on its own axis, W goes where it looks, and chase puts the camera behind', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/#recipe=controls.scheme+tank;view.camera+chase');
  await expect.poll(async () => (await position(page, 'facing')).length, { timeout: 15_000 }).toBe(3);
  const [x0, , z0] = await settled(page, 'player');
  // D held: it turns right, from −Z towards +X, without going anywhere.
  await page.keyboard.down('KeyD');
  await expect.poll(async () => (await position(page, 'facing'))[0], { timeout: 30_000 }).toBeGreaterThan(0.5);
  await page.keyboard.up('KeyD');
  const [fx, , fz] = await settled(page, 'facing');
  const [x1, , z1] = await position(page, 'player');
  expect(Math.hypot(x1! - x0!, z1! - z0!)).toBeLessThan(0.1);
  // W: forward, where it looks now.
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => Math.hypot((await position(page, 'player'))[0]! - x1!, (await position(page, 'player'))[2]! - z1!), {
      timeout: 30_000,
    })
    .toBeGreaterThan(2);
  await page.keyboard.up('KeyW');
  const [x2, , z2] = await settled(page, 'player');
  const along = ((x2! - x1!) * fx! + (z2! - z1!) * fz!) / Math.hypot(x2! - x1!, z2! - z1!);
  expect(along).toBeGreaterThan(0.95);
  // The chasing camera came back behind it: on the side opposite to where it looks.
  const [cx, , cz] = await settled(page, 'camera');
  expect(((cx! - x2!) * fx! + (cz! - z2!) * fz!) / Math.hypot(cx! - x2!, cz! - z2!)).toBeLessThan(-0.9);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- snapshots and a game's own button (stage 1d)

test('snapshot: save, walk and throw, load: the character is back, the ball is gone, and the hash is the same', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'pause', 'snapshot');
  await expect(consoleLog(page)).toContainText('a snapshot at step');
  const [, step, hash] = /a snapshot at step (\d+) · hash ([0-9a-f]{8})/.exec(await consoleLog(page).innerText())!;
  const saved = await position(page, 'player');
  const shown = await meshes(page);
  await typeInConsole(page, 'pause');
  await page.keyboard.press('Escape');
  // Forward, and a ball thrown (F: the Dojo's own button).
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 30_000 }).toBeLessThan(saved[2]! - 1.5);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyF');
  await expect.poll(() => meshes(page), { timeout: 15_000 }).toBe(shown + 1);
  // Back: where it was, without the ball, with the same hash.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'pause', 'snapshot load');
  await expect(consoleLog(page)).toContainText(`back at step ${step} · hash ${hash}`);
  await expect.poll(() => position(page, 'player')).toEqual(saved);
  await expect.poll(() => meshes(page)).toBe(shown);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- a level's loop (stage 2a)

test("the course's loop: falling off the floor brings the character back, with a notice; its zones can be seen", async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/course/#recipe=show.sensors+on');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  const [x0, , z0] = await position(page, 'player');
  // Where it is in the very frame the notice comes. (Read after a poll, it could be a second later
  // with S still held: in continuous integration it had walked 4 m back towards the edge, and the
  // test failed once in two. The notice and the position are written in the same frame: notices.ts
  // when it reads the world's events, probe.ts after drawing.)
  // (A name of its own on the window: `back` was taken, an element with that id answers to it.)
  await page.locator('#game').evaluate((el) => {
    const w = window as unknown as { fellBackAt?: string };
    new MutationObserver(() => {
      if (w.fellBackAt === undefined && el.dataset.notice === 'you fell: back to the checkpoint')
        w.fellBackAt = el.dataset.player;
    }).observe(el, { attributes: true, attributeFilter: ['data-notice', 'data-player'] });
  });
  // S: towards the camera, off the floor's edge (4 m behind), into the void.
  await page.keyboard.down('KeyS');
  const back = () => page.evaluate(() => (window as unknown as { fellBackAt?: string }).fellBackAt);
  await expect.poll(back, { timeout: 30_000 }).toBeDefined();
  await page.keyboard.up('KeyS');
  await expect(page.locator('.mg-notice')).toBeVisible();
  // Back on the floor, where it started (its first checkpoint is where it was born): in that frame it
  // can only have walked what the steps of one frame take it (at most 5 steps: 37.5 cm).
  const [x1, y1, z1] = (await back())!.split(' ').map(Number);
  expect(y1).toBeGreaterThan(0.5);
  expect(y1).toBeLessThan(1.2);
  expect(Math.abs(x1! - x0!)).toBeLessThan(0.5);
  expect(Math.abs(z1! - z0!)).toBeLessThan(0.5);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- capabilities (stage 2c)

test('capabilities, live: in front of the tower, a character stays below; with dojo.climb on, it climbs it and takes its star', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const list = errors(page);
  // (A still camera: with the one that follows, "forward" would turn with it.)
  await page.goto('jugar/dojo/course/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  // In front of the tower (dojo.goto, a lab's command: the page tells where the character is every
  // few frames, too late to turn at an exact place).
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 8 1 5');
  await page.keyboard.press('Escape');
  // Forward (−Z), against it: without climbing, it stays below.
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 30_000 }).toBeLessThan(4);
  await afterSteps(page, 90);
  expect((await position(page, 'player'))[1]).toBeLessThan(1);
  await page.keyboard.up('KeyW');
  // Climbing on, from the console: pushing on, it climbs, and over the top it takes the star.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.climb on');
  await page.keyboard.press('Escape');
  await page.keyboard.down('KeyW');
  await expect(consoleLog(page)).toContainText('a star (1 taken, 2 left)', { timeout: 90_000 });
  await page.keyboard.up('KeyW');
  expect(list).toEqual([]);
});
