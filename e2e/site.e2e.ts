import { readdirSync, readFileSync } from 'node:fs';
import { afterSteps, position, settled } from './helpers';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { initPhysics, levelFromText, levelOfWorld, levelToText, playRecipe } from '@manifold/core';
import { createDojo } from '@manifold/dojo/rules';
import { dungeon } from '@manifold/adventure/dungeon';

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
  'view.subtitles': 'on',
  'view.hud': 'off',
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

// ---------------------------------------------------------------- the camera against walls (stage 3h)

// Holding W the whole way: in the tunnels the camera is behind the character, and at each turn a zone
// says where to look, the camera turns there, and W, which goes where the camera looks, goes with it.
// On every frame the camera has to be out of every box of the level, and a little more (the ball it
// sweeps keeps 25 cm), and see the character's head: nothing in between. Before 3h, in the tunnels, it
// was above the ceiling, which hid the character; at the turns, inside the walls.
test('the corridor: holding W walks it all, and the camera never ends inside a wall or a ceiling (stage 3h)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const level = levelFromText(readFileSync(path.join(process.cwd(), 'games/dojo/levels/corridor.level'), 'utf8'));
  expect(level.boxes.every((b) => !b.turn)).toBe(true);
  await page.goto('jugar/dojo/corridor/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await settled(page, 'player');
  // The camera and the character, from the same frame (the page writes both before the observer runs).
  type Seen = { camera: number[]; player: number[] };
  await page.locator('#game').evaluate((el) => {
    const seen: Seen[] = [];
    (window as unknown as { seen: Seen[] }).seen = seen;
    const numbers = (v: string | undefined) => (v ?? '').split(' ').map(Number);
    new MutationObserver(() => seen.push({ camera: numbers(el.dataset.camera), player: numbers(el.dataset.player) })).observe(
      el,
      { attributes: true, attributeFilter: ['data-camera'] },
    );
  });
  await page.keyboard.down('KeyW');
  // Into the room at the end, past both turns.
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 80_000 }).toBeLessThan(-16);
  await page.keyboard.up('KeyW');
  const seen = await page.evaluate(() => (window as unknown as { seen: Seen[] }).seen);
  expect(seen.length).toBeGreaterThan(30);
  type Box = (typeof level.boxes)[number];
  /** How far a point is from a box (0 inside it). */
  const away = (p: number[], b: Box) =>
    Math.hypot(...[0, 1, 2].map((k) => Math.max(0, Math.abs(p[k]! - b.center[k]!) - b.half[k]!)));
  /** Whether the segment from `a` to `b` goes through a box made `shrink` smaller on every side (slabs). */
  const through = (a: number[], z: number[], b: Box, shrink: number) => {
    let [from, to] = [0, 1];
    for (let k = 0; k < 3; k++) {
      const [lo, hi] = [b.center[k]! - b.half[k]! + shrink, b.center[k]! + b.half[k]! - shrink];
      const d = z[k]! - a[k]!;
      if (Math.abs(d) < 1e-9) {
        if (a[k]! < lo || a[k]! > hi) return false;
        continue;
      }
      const [t0, t1] = [(lo - a[k]!) / d, (hi - a[k]!) / d].sort((x, y) => x - y);
      [from, to] = [Math.max(from, t0!), Math.min(to, t1!)];
      if (from > to) return false;
    }
    return true;
  };
  const nearest = Math.min(...seen.map(({ camera }) => Math.min(...level.boxes.map((b) => away(camera, b)))));
  // (Rounded to the centimeter as the page writes it: 25 cm, less a little.)
  expect(nearest, 'how near a box the camera came').toBeGreaterThan(0.2);
  // The head, 60 cm above the character's center (as the camera looks at it). The character is where
  // the last step put it, and drawn up to a step behind (7.5 cm walking): boxes 5 cm smaller.
  const hidden = seen.filter(({ camera, player }) =>
    level.boxes.some((b) => through(camera, [player[0]!, player[1]! + 0.6, player[2]!], b, 0.05)),
  );
  expect(hidden, 'frames where something was between the camera and the head').toEqual([]);
  // And it did come in: under the ceilings (at 3 m), where without walls it would be at 3.6.
  expect(seen.some(({ camera }) => camera[1]! < 2.9 && camera[2]! < 0)).toBe(true);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- the game's interface (stage 3i)

test('pausing (stage 3i): Escape opens the menu and the steps stop; Enter on "Seguir" resumes; P too', async ({ page }) => {
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/circuit/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await page.keyboard.press('Escape');
  await expect.poll(() => game.getAttribute('data-menu')).toBe('pause');
  await expect(page.getByRole('dialog', { name: 'Pausa' })).toBeVisible();
  // While the page keeps drawing (20 frames more), the world takes no step.
  const step = await game.getAttribute('data-step');
  const frames = Number(await game.getAttribute('data-frames'));
  await expect.poll(async () => Number(await game.getAttribute('data-frames')), { timeout: 30_000 }).toBeGreaterThan(frames + 20);
  expect(await game.getAttribute('data-step')).toBe(step);
  // The focus is on "Seguir": Enter, and the world goes on.
  await expect(page.getByRole('button', { name: 'Seguir' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => game.getAttribute('data-menu')).toBe(null);
  await afterSteps(page, 10);
  // P opens it too, and closes it.
  await page.keyboard.press('KeyP');
  await expect.poll(() => game.getAttribute('data-menu')).toBe('pause');
  await page.keyboard.press('KeyP');
  await expect.poll(() => game.getAttribute('data-menu')).toBe(null);
  expect(list).toEqual([]);
});

test('the menus work with the keyboard alone, and the settings are still there next time (stage 3i)', async ({ page }) => {
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/circuit/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  // Escape, down to "Ajustes", Enter.
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Ajustes' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => game.getAttribute('data-menu')).toBe('settings');
  // The volume first: four steps to the left (0.6 → 0.4). Then down to "invert", and Space ticks it.
  const volume = page.locator('input[name="view.volume"]');
  await expect(volume).toBeFocused();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await expect(volume).toHaveValue('0.4');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  const invert = page.locator('input[name="view.invert"]');
  await expect(invert).toBeFocused();
  await page.keyboard.press('Space');
  await expect(invert).toBeChecked();
  // Escape goes back, and Escape again resumes.
  await page.keyboard.press('Escape');
  await expect.poll(() => game.getAttribute('data-menu')).toBe('pause');
  await page.keyboard.press('Escape');
  await expect.poll(() => game.getAttribute('data-menu')).toBe(null);
  // Kept in this browser, for this game, and there after a reload.
  const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('manifold.dojo.settings') ?? 'null'));
  expect(await kept()).toEqual({ 'view.volume': 0.4, 'view.invert': true });
  await page.reload();
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ajustes' }).click();
  await expect(volume).toHaveValue('0.4');
  await expect(invert).toBeChecked();
  // Back at its default, it is forgotten.
  await invert.press('Space');
  expect(await kept()).toEqual({ 'view.volume': 0.4 });
  expect(list).toEqual([]);
});

test("the HUD (stage 3i): the course's time, falls and stars, in Spanish; at the goal, a box that starts it over", async ({
  page,
}) => {
  const list = errors(page);
  const game = page.locator('#game');
  const hud = () => game.getAttribute('data-hud');
  await page.goto('jugar/dojo/course/');
  await expect.poll(hud, { timeout: 20_000 }).toMatch(/^Tiempo \d:\d\d,\d \| Caídas 0 \| Estrellas 0 de 3$/);
  // A fall into the void: one more.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 20 -6 20');
  await page.locator('.mg-console input').press('Escape');
  await expect.poll(hud).toContain('Caídas 1');
  // The goal: the time stops, and a box says how it went; its first button, "Otra vez", starts over.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto -3 4.4 -7');
  await page.locator('.mg-console input').press('Escape');
  await expect.poll(() => game.getAttribute('data-dialog')).toBe('¡Llegaste!');
  const box = page.getByRole('dialog', { name: '¡Llegaste!' });
  await expect(box).toContainText('caídas 1 · estrellas 0 de 3');
  await expect(page.getByRole('button', { name: 'Otra vez' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => game.getAttribute('data-dialog')).toBe(null);
  await expect.poll(hud).toContain('Caídas 0');
  expect(list).toEqual([]);
});

test('subtitles for sounds (stage 3i): walking on stone, written with where it comes from, with or without sound', async ({
  page,
}) => {
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/surfaces/#recipe=view.subtitles+on');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await settled(page, 'player');
  // (Each line stays a couple of seconds: the start is stone for 4 m, then the rink, ice.)
  await page.keyboard.down('KeyW');
  await expect(page.locator('.mg-subtitles')).toContainText('Pasos en piedra', { timeout: 20_000 });
  await page.keyboard.up('KeyW');
  // Ahead of the camera, below it: an arrow up.
  await expect(page.locator('.mg-subtitles')).toContainText(/Pasos en piedra ↑/);
  expect(await game.getAttribute('data-subtitle')).toMatch(/^Pasos en /);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- making levels (stage 3j)

// The workshop builds itself on the yard after its first step (add, clone, set), checks itself
// (assert), and writes back what it built (level.export): the same text as Node writes, playing the same
// recipe without a screen, and level.diff says what was added.
test('the workshop (stage 3j): built from the console, it checks itself, and exports what it built, as Node does', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/workshop/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await expect(consoleLog(page)).toContainText('assert crate.transform.position.y < 2: yes', { timeout: 30_000 });
  await expect(consoleLog(page)).toContainText('assert lamp.lamp.intensity = 1.5: yes');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'level.export');
  await expect(consoleLog(page)).toContainText('name bench');
  // (The last thing in the console: the level, from its first line.)
  const log = await consoleLog(page).innerText();
  const text = log.slice(log.lastIndexOf('# Manifold level')).trim();
  // Node plays the same recipe and writes the same level.
  await initPhysics();
  const dojo = createDojo(
    Object.fromEntries(
      readdirSync(path.join(process.cwd(), 'games/dojo/levels'))
        .filter((f) => f.endsWith('.level'))
        .map((f) => [
          f.replace(/\.level$/, ''),
          levelFromText(readFileSync(path.join(process.cwd(), 'games/dojo/levels', f), 'utf8')),
        ]),
    ),
  );
  const { session } = playRecipe(dojo, readFileSync(path.join(process.cwd(), 'games/dojo/recipes/workshop.txt'), 'utf8'));
  expect(text).toBe(levelToText(levelOfWorld(session.world)).trim());
  session.world.dispose();
  // What changed since it was born: the four lines it added, and the clone.
  await typeInConsole(page, 'level.diff');
  await expect(consoleLog(page)).toContainText('+ box 0 0.75 -6  2 0.75 0.3  material wood  color #8a6a42');
  await expect(consoleLog(page)).toContainText('+ lamp 3 3 -4.5  8 1.5  name lamp');
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- saving the game (stage 3k)

// The adventure's start: a gem taken (the console puts the character on it), the game saved from the
// menu; the page opened again (a new world: nothing taken), the game loaded: the gem in the inventory,
// the character where it was, and the gem not in the dungeon.
test('the adventure (stage 3k): a gem taken, the game saved; the page again, the game loaded: as it was', async ({ page }) => {
  const list = errors(page);
  const game = page.locator('#game');
  const hud = () => game.getAttribute('data-hud');
  await page.goto('jugar/aventura/');
  await expect.poll(hud, { timeout: 20_000 }).toBe('Profundidad 1 | Gemas 0 | Llave no');
  // The first gem of the dungeon of seed 1 (the default), from Node's own generator.
  const d = dungeon(1, 1);
  const row = d.rows.findIndex((r) => r.includes('*'));
  const col = d.rows[row]!.indexOf('*');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, `set hero transform.position ${(col + 0.5) * 2} 1 ${(row + 0.5) * 2}`);
  await page.locator('.mg-console input').press('Escape');
  await expect.poll(hud).toBe('Profundidad 1 | Gemas 1 | Llave no');
  await settled(page, 'player');
  const where = await position(page, 'player');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Guardar la partida' }).click();
  await expect.poll(() => game.getAttribute('data-saved')).toMatch(/^Partida guardada/);
  await page.keyboard.press('Escape');
  // Again: a new world.
  await page.reload();
  await expect.poll(hud, { timeout: 20_000 }).toBe('Profundidad 1 | Gemas 0 | Llave no');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cargar la partida' }).click();
  await expect.poll(hud, { timeout: 20_000 }).toBe('Profundidad 1 | Gemas 1 | Llave no');
  const back = await position(page, 'player');
  expect(Math.hypot(back[0]! - where[0]!, back[2]! - where[2]!)).toBeLessThan(0.1);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- models and animations (stage 2e)

test("in the course, the character is the games' mannequin: its animation follows how it moves, and a jump does not bounce the camera", async ({
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
      if (w.fellBackAt === undefined && el.dataset.notice === 'dojo.fell') w.fellBackAt = el.dataset.player;
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
  await expect(consoleLog(page)).toContainText('a star: 1 taken, 2 left', { timeout: 90_000 });
  await page.keyboard.up('KeyW');
  expect(list).toEqual([]);
});

test('crouching (stage 4b): standing, the low passage stops it; crouched (C), it goes through, playing its crouch', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const list = errors(page);
  await page.goto('jugar/dojo/moves/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  // Every animation that weighed most, however briefly.
  await page.evaluate(() => {
    const game = document.querySelector<HTMLElement>('#game')!;
    const seen = new Set<string>();
    (window as unknown as { clips: Set<string> }).clips = seen;
    new MutationObserver(() => seen.add(game.dataset.clip ?? '')).observe(game, { attributeFilter: ['data-clip'] });
  });
  // In front of the passage (its slab from z = 0 to −4), looking into it (−Z): W, standing, stops at it.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 0 1 2');
  await page.keyboard.press('Escape');
  await page.keyboard.down('KeyW');
  await afterSteps(page, 120);
  expect((await position(page, 'player'))[2]).toBeGreaterThan(0.2);
  // With C held too, it goes through, and out the other end.
  await page.keyboard.down('KeyC');
  await expect.poll(async () => (await position(page, 'player'))[2], { timeout: 60_000 }).toBeLessThan(-4.5);
  await page.keyboard.up('KeyC');
  await page.keyboard.up('KeyW');
  const clips = await page.evaluate(() => [...(window as unknown as { clips: Set<string> }).clips]);
  expect(clips, clips.join(', ')).toContain('crouch');
  expect(list).toEqual([]);
});

test('rolling (stage 4b): V rolls it about 3 m the way it goes, playing its roll', async ({ page }) => {
  test.setTimeout(120_000);
  const list = errors(page);
  await page.goto('jugar/dojo/moves/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  await page.evaluate(() => {
    const game = document.querySelector<HTMLElement>('#game')!;
    const seen = new Set<string>();
    (window as unknown as { clips: Set<string> }).clips = seen;
    new MutationObserver(() => seen.add(game.dataset.clip ?? '')).observe(game, { attributeFilter: ['data-clip'] });
  });
  // From the spawn, on the open floor, looking at −Z: V, and nothing else.
  const [, , z] = await position(page, 'player');
  await page.keyboard.press('KeyV');
  await afterSteps(page, 60);
  const moved = z! - (await position(page, 'player'))[2]!;
  expect(moved).toBeGreaterThan(2.7);
  expect(moved).toBeLessThan(3.4);
  const clips = await page.evaluate(() => [...(window as unknown as { clips: Set<string> }).clips]);
  expect(clips, clips.join(', ')).toContain('roll');
  expect(list).toEqual([]);
});

test('its hands on the tower (stage 4a): on its wall while it climbs, on its top before it gets over; show.ik draws them', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const list = errors(page);
  await page.goto('jugar/dojo/capabilities/#recipe=view.camera+free;show.ik+on');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 90);
  // Every hold the hands take, as the page writes it ("wall -": the left hand on the wall, the right
  // one on nothing), however briefly: a frame may last several steps here.
  await page.evaluate(() => {
    const game = document.querySelector<HTMLElement>('#game')!;
    const seen = new Set<string>();
    (window as unknown as { holds: Set<string> }).holds = seen;
    new MutationObserver(() => seen.add(game.dataset.holds ?? '')).observe(game, { attributeFilter: ['data-holds'] });
  });
  const holds = () => page.evaluate(() => [...(window as unknown as { holds: Set<string> }).holds]);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 8 1 5');
  await page.keyboard.press('Escape');
  await page.keyboard.down('KeyW');
  await expect.poll(async () => (await holds()).some((h) => h.includes('wall')), { timeout: 60_000 }).toBe(true);
  // While a hand holds, show.ik draws more than the legs' two lines: a shoulder's to its hold.
  await expect
    .poll(async () => Number(await page.locator('#game').getAttribute('data-ik')), { timeout: 30_000 })
    .toBeGreaterThan(2);
  await expect(consoleLog(page)).toContainText('a star: 1 taken, 2 left', { timeout: 90_000 });
  await page.keyboard.up('KeyW');
  const all = await holds();
  expect(all, all.join(', ')).toContain('ledge ledge');
  expect(list).toEqual([]);
});
