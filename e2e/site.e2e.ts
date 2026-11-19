import { readdirSync, readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { afterSteps, position, settled } from './helpers';
import path from 'node:path';
import { devices, expect, test, type Page } from '@playwright/test';
import {
  initPhysics,
  levelFromText,
  levelOfWorld,
  levelToText,
  playRecipe,
  registryFor,
  replayOf,
  replayToText,
  Session,
} from '@manifold/core';
import { createDojo, DOJO_ZONES } from '@manifold/dojo/rules';
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
  // (The tutorial is the book, decision 0030: its first page carries the book's title.)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Construir un mundo');
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
    // At the jump's top (rising no more: falling), the second jump, pressed from here the moment the page
    // says so: pressed by the test after it polled that, under load (polls back off to a second) it came
    // after the landing, a jump from the ground, and no somersault (two runs in six, stage 4b).
    const space = (type: 'keydown' | 'keyup') => document.dispatchEvent(new KeyboardEvent(type, { code: 'Space', key: ' ' }));
    new MutationObserver(() => {
      if (seen.at(-1) !== el.dataset.clip) {
        seen.push(el.dataset.clip!);
        if (el.dataset.clip === 'fall' && seen.filter((c) => c === 'fall').length === 1) {
          space('keydown');
          setTimeout(() => space('keyup'), 50);
        }
      }
      const gesture = el.dataset.gesture?.split(' ')[1];
      if (gesture && el.dataset.gesture !== gestures.at(-1)) gestures.push(el.dataset.gesture!);
    }).observe(el, { attributes: true, attributeFilter: ['data-clip', 'data-gesture'] });
  });
  const gestures = () => page.evaluate(() => (window as unknown as { gestures: string[] }).gestures.map((g) => g.split(' ')[1]));
  const seen = () => page.evaluate(() => (window as unknown as { seen: string[] }).seen);
  // A jump; at its top, the second one, in the air (above).
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

/** A ghost's or a replay's text as a link's fragment: deflated, in base64url (replay-link.ts). */
const fragmentOf = (prefix: string, text: string) => `${prefix}${deflateRawSync(Buffer.from(text)).toString('base64url')}`;

test('a ghost link carries a strip of poses (stage 4.5c, decision 0025): the ghost walks it, drawn, without a second world', async ({
  page,
}) => {
  // A strip by hand: from the course's start, 30 cm towards −Z every six steps (3 m/s), for two seconds.
  const lines = ['# Manifold ghost 1', 'game dojo', 'birth dojo.level course', 'every 6', 'pose 0 82 0 0 walk', '0 0 -30 0'];
  for (let k = 0; k < 19; k++) lines.push('0 0 0 0');
  lines.push('end 120');
  const errorsSeen = errors(page);
  await page.goto(`jugar/dojo/course/#${fragmentOf('ghost=', lines.join('\n'))}`);
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // It goes 6 m along −Z over its two seconds, and stays at its end.
  await expect.poll(async () => (await position(page, 'ghost'))[2] ?? 99, { timeout: 30_000 }).toBeLessThan(-5.9);
  expect(errorsSeen).toEqual([]);
});

test('an older ghost link, carrying a replay (before 4.5c), is still raced: played once for its strip', async ({ page }) => {
  // A replay of walking −Z for a second and a half on the course, as the page recorded them before.
  await initPhysics();
  const course = levelFromText(readFileSync(path.join(process.cwd(), 'games/dojo/levels/course.level'), 'utf8'), {
    zones: DOJO_ZONES,
  });
  const dojo = createDojo({ course });
  const registry = registryFor(dojo);
  registry.run('dojo.level course', 'recipe');
  const session = new Session(dojo, { registry });
  for (let i = 0; i < 90; i++) {
    session.setInput(1, { move: [0, 0, -1] });
    session.step();
  }
  const text = replayToText(replayOf(session));
  session.world.dispose();
  await page.goto(`jugar/dojo/course/#${fragmentOf('ghost=', text)}`);
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // (From the course's start, z = 6, to about 0: as far as the replay went.)
  await expect.poll(async () => (await position(page, 'ghost'))[2] ?? 99, { timeout: 30_000 }).toBeLessThan(1);
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

// ---------------------------------------------------------------- the kit (stage 4.5e)

test('the kit room: every piece of the games’ kit drawn with its model, each a node of one file', async ({ page }) => {
  const list = errors(page);
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && /model/.test(m.text())) warnings.push(m.text());
  });
  await page.goto('jugar/dojo/kit/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // Its 32 pieces (the 24 kinds, some twice), the floor, the box that holds the stairs' landing up, the player.
  await expect.poll(async () => Number(await page.locator('#game').getAttribute('data-meshes')), { timeout: 20_000 }).toBe(35);
  // Drawn with their models (they loaded: no piece fell back to its box), and few triangles for so much.
  await afterSteps(page, 30);
  const triangles = Number(await page.locator('#game').getAttribute('data-triangles'));
  expect(triangles).toBeGreaterThan(3000);
  expect(warnings).toEqual([]);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- the citadel (stage 4.5f)

test('the citadel: built with the kit, drawn within its budget everywhere in it, with six lights for its fourteen lamps', async ({
  page,
}) => {
  const list = errors(page);
  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' && /model/.test(m.text())) warnings.push(m.text());
  });
  await page.goto('jugar/dojo/citadel/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect
    .poll(async () => Number(await page.locator('#game').getAttribute('data-meshes')), { timeout: 20_000 })
    .toBeGreaterThan(300);
  await expect(page.locator('#game')).toHaveAttribute('data-lights', '6');
  // At dusk (stage 5a): its sky's hour, its level's.
  await expect(page.locator('#game')).toHaveAttribute('data-sky', '19.5');
  // The budget (decision 0026, set in stage 4.5f from what it measured): at most 300 draw calls and
  // 50,000 triangles a frame, wherever you stand. Measured where it draws the most: the courtyard, the
  // hall from its gate, the library, the roofs, the tower's top.
  await page.keyboard.press('Backquote');
  for (const at of ['-2 1 9', '2 1 -2', '11 4 1.5', '13 7 4', '0 8 -24']) {
    await typeInConsole(page, `dojo.goto ${at}`);
    await afterSteps(page, 30);
    const [draws, triangles] = await Promise.all(
      ['data-draws', 'data-triangles'].map(async (a) => Number(await page.locator('#game').getAttribute(a))),
    );
    expect(draws, `draws at ${at}`).toBeLessThanOrEqual(300);
    expect(triangles, `triangles at ${at}`).toBeLessThanOrEqual(50_000);
    expect(triangles, `drawn at ${at}`).toBeGreaterThan(2000);
    // (Stage 5m) Its still pieces drawn in batches by squares of 16 m: up to 300 before, 39 to 81 measured.
    expect(draws, `batched at ${at}`).toBeLessThanOrEqual(150);
  }
  expect(Number(await page.locator('#game').getAttribute('data-batches'))).toBeGreaterThan(0);
  expect(warnings).toEqual([]);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- the metrics gym and the sky (stage 5a)

test('the metrics gym: `metrics` says what the character can do in meters, under the afternoon sky its level says', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/gym/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect(page.locator('#game')).toHaveAttribute('data-sky', '15.5');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'metrics');
  await expect(page.locator('.mg-console')).toContainText(
    'jump: its feet rise 2.10 m (2.15 without steps), at the top at step 39',
  );
  await expect(page.locator('.mg-console')).toContainText('its middle goes 5.92 m walking, 9.88 m running');
  await expect(page.locator('.mg-console')).toContainText('1.60 m tall, 1.10 m crouched');
  // `inspect me` says how to change the jump, and how to ask again.
  await typeInConsole(page, 'inspect me');
  await expect(page.locator('.mg-console')).toContainText(/set (\d+) character\.movement\.jump\.speed 6\.5\s+metrics \1/);
  // Another hour on this page only, and back to the level's.
  await typeInConsole(page, 'view.sky 0');
  await expect(page.locator('#game')).toHaveAttribute('data-sky', '0');
  await typeInConsole(page, 'view.sky -1');
  await expect(page.locator('#game')).toHaveAttribute('data-sky', '15.5');
  expect(list).toEqual([]);
});

test('a level without a sky keeps the flat background of before', async ({ page }) => {
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect(page.locator('#game')).toHaveAttribute('data-sky', 'none');
});

// ---------------------------------------------------------------- the games' shell (stage 5b)

/**
 * The tower's goal on a floor, reached at once (stage 5d: its floors are played to the end by
 * games/tower/src/floors.test.ts; here, the shell around them): a link's recipe, run after each floor's,
 * puts the climber on the goal a step after the floor is born.
 */
const atGoal = (x: number, y: number, z: number) => `recipe=wait+1;set+climber+transform.position+${x}+${y}+${z}`;

test('the tower: its title and credits, its lines, a floor done (its gold time) and kept, and its ghost as a link', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto(`jugar/torre/#${atGoal(0, 15.9, -46)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-sky', '18.6');
  // Its credits, from the asset lists of what it draws, and the engine's.
  await page.getByRole('button', { name: 'Créditos' }).click();
  await expect(page.locator('.mg-panel')).toContainText('kit.glb: lo hace un guion de este proyecto, art/kit.py');
  await expect(page.locator('.mg-panel')).toContainText('La física: Rapier (licencia Apache-2.0)');
  await page.getByRole('button', { name: 'Volver' }).click();
  // From the beginning: the thread's two lines, and the first floor, done at once by the link.
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-1');
  await expect(game).toHaveAttribute('data-dialog', 'La entrada: listo', { timeout: 60_000 });
  await expect(page.locator('.mg-panel')).toContainText('Tiempo de oro: 0:20,0');
  await expect(page.locator('.mg-panel')).toContainText('¡Mejor que el tiempo de oro!');
  expect(JSON.parse((await game.getAttribute('data-progress'))!)).toMatchObject({ version: 1, started: true, reached: 1 });
  // Its ghost, as a link: shown (copied, where the browser lets).
  await page.getByRole('button', { name: 'Compartir tu fantasma' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'El enlace de tu fantasma');
  await expect(game).toHaveAttribute('data-ghost-link', /\/jugar\/torre\/#ghost=/);
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-2');
  await expect(game).toHaveAttribute('data-sky', '19');
  expect(list).toEqual([]);
});

test('the tower: a ghost’s link races it on its floor, and opens no floor', async ({ page }) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  // A run of the first floor, its ghost's link made by the page.
  await page.goto(`jugar/torre/#${atGoal(0, 15.9, -46)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La entrada: listo', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Compartir tu fantasma' }).click();
  // (Made deflated, a moment later.)
  await expect(game).toHaveAttribute('data-ghost-link', /#ghost=/);
  const link = (await game.getAttribute('data-ghost-link'))!;
  // Someone else (nothing kept): the title offers the race; the floor, with the ghost beside.
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto(link);
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Correr contra un fantasma: La entrada' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-1');
  await expect.poll(() => game.getAttribute('data-ghost'), { timeout: 20_000 }).toMatch(/^-?\d/);
  expect(JSON.parse((await game.getAttribute('data-progress'))!).reached).toBe(0);
  expect(list).toEqual([]);
});

/** Where a camera looks along the ground: its heading, in radians (0 looking along −Z, the floors' ahead). */
const heading = (look: number[]) => Math.atan2(-look[0]!, -look[2]!);

test('the camera, steady: running to a side and jumping it does not turn, as following does, so forward stays put', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  // (The course: open ground in front of where the character is born.)
  await page.goto('jugar/dojo/course/');
  await expect.poll(() => page.locator('#game').getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  /** How much the camera turned along the ground while the character ran to its right and jumped. */
  const turned = async (mode: string) => {
    await page.keyboard.press('Backquote');
    await typeInConsole(page, `view.camera ${mode}`, 'camera.reset');
    await page.keyboard.press('Escape');
    await settled(page, 'camera');
    const before = heading(await position(page, 'look'));
    await page.keyboard.down('KeyD');
    await afterSteps(page, 50);
    await page.keyboard.press('Space');
    await afterSteps(page, 40);
    await page.keyboard.up('KeyD');
    // Read at once: left alone, following turns back to where the course's zone suggests looking (stage
    // 3h), more the longer it waits (a reading after it settled was a matter of timing: 0.086 one run).
    return Math.abs(heading(await position(page, 'look')) - before);
  };
  // Following, a step to a side turns it round the character, and with it where forward is (the tower's
  // wall jumps, after phase 5); steady, it goes along with the character without turning.
  expect(await turned('follow')).toBeGreaterThan(0.1);
  expect(await turned('steady')).toBeLessThan(0.01);
  expect(list).toEqual([]);
});

test('the tower’s camera is steady: a run to a side and a jump on its first floor leave forward where it was', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/torre/');
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-1');
  await settled(page, 'camera');
  const before = heading(await position(page, 'look'));
  const from = await position(page, 'player');
  await page.keyboard.down('KeyD');
  await afterSteps(page, 50);
  await page.keyboard.press('Space');
  await afterSteps(page, 40);
  await page.keyboard.up('KeyD');
  await settled(page, 'camera');
  expect(Math.abs((await position(page, 'player'))[0]! - from[0]!), 'it ran to its right').toBeGreaterThan(0.5);
  expect(Math.abs(heading(await position(page, 'look')) - before)).toBeLessThan(0.01);
  // (Stage 5p) Its feet left the ground and struck it again: dust, seen.
  expect(Number(await game.getAttribute('data-dust'))).toBeGreaterThan(0);
  expect(list).toEqual([]);
});

test('the tower’s end: the top done, the camera pulled out over the land (5p), the thread’s last lines, the credits, and the title again', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  // Five floors already done, kept in this browser (stage 5p: six floors).
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('kept')) {
      localStorage.setItem('manifold.tower.progress', JSON.stringify({ version: 1, started: true, reached: 5, best: {} }));
      sessionStorage.setItem('kept', '1');
    }
  });
  await page.goto(`jugar/torre/#${atGoal(0, 27.9, -45.5)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Seguir: La cima' }).click();
  await expect(game).toHaveAttribute('data-level', 'floor-6');
  await expect(game).toHaveAttribute('data-sky', '19.7');
  await expect(game).toHaveAttribute('data-dialog', 'La cima: listo', { timeout: 60_000 });
  // (Stage 5p) The summit reached: the camera pulls out over the land, behind the panel.
  await expect.poll(() => game.getAttribute('data-finale').then(Number), { timeout: 30_000 }).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'Créditos');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La torre');
  expect(JSON.parse((await game.getAttribute('data-progress'))!).reached).toBe(6);
  expect(list).toEqual([]);
});

/** The fortress's link recipe (stage 5f): its intruder taken somewhere a step after the level is born. */
const intruderAt = (x: number, y: number, z: number) => `recipe=wait+1;set+intruder+transform.position+${x}+${y}+${z}`;

test('the fortress: its title, its lines, a level done unseen (its gold time) and kept, at night', async ({ page }) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  // (Stage 5m: the first level's way out, past the gate.)
  await page.goto(`jugar/fortaleza/#${intruderAt(-0.5, 0.9, -22)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-sky', '22');
  await page.getByRole('button', { name: 'Créditos' }).click();
  await expect(page.locator('.mg-panel')).toContainText('kit.glb: lo hace un guion de este proyecto, art/kit.py');
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'wall');
  await expect(game).toHaveAttribute('data-dialog', 'La muralla: listo', { timeout: 60_000 });
  await expect(page.locator('.mg-panel')).toContainText('Tiempo de oro: 0:32,0');
  // (Stage 5m) Its recap: the scrolls taken of the level's two, the guards taken down.
  await expect(page.locator('.mg-panel')).toContainText('Pergaminos: ninguno de 2');
  await expect(page.locator('.mg-panel')).toContainText('No volteaste a nadie');
  await expect(page.locator('.mg-panel')).toContainText('Nadie te vio');
  await expect(page.locator('.mg-panel')).toContainText('No te atraparon');
  expect(JSON.parse((await game.getAttribute('data-progress'))!)).toMatchObject({ version: 1, started: true, reached: 1 });
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(game).toHaveAttribute('data-level', 'yard');
  expect(list).toEqual([]);
});

test('the fortress’s end: the flame carried out of the keep, the thread’s last lines, the credits, and the title again', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('kept')) {
      localStorage.setItem('manifold.fortress.progress', JSON.stringify({ version: 1, started: true, reached: 3, best: {} }));
      sessionStorage.setItem('kept', '1');
    }
  });
  // The flame taken (its zone, behind the guard at its post since 5m), then before that guard, carried, lit,
  // for half a second (stage 5l: long enough to be sure, a quarter; three steps were a glimpse, let go),
  // and out of the postern.
  await page.goto(
    'jugar/fortaleza/#recipe=wait+1;set+intruder+transform.position+0.3+0.9+-36.4;wait+2;set+intruder+transform.position+0.3+0.9+-29.6;wait+30;set+intruder+transform.position+-15.5+0.9+-2',
  );
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Seguir: La torre del homenaje' }).click();
  await expect(game).toHaveAttribute('data-level', 'keep');
  await expect(game).toHaveAttribute('data-dialog', 'La torre del homenaje: listo', { timeout: 60_000 });
  await expect(page.locator('.mg-panel')).toContainText('Te vieron');
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'Créditos');
  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza');
  expect(JSON.parse((await game.getAttribute('data-progress'))!).reached).toBe(4);
  expect(list).toEqual([]);
});

test('the fortress reads (stage 5l): in the dark the gem says hidden; under a lantern, in sight, a guard’s sign fills to “!”; its steps spread rings', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  // Under the breach's lantern, in the yard guard's beat.
  await page.goto(`jugar/fortaleza/#${intruderAt(-2.4, 0.9, -2.2)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'wall');
  await expect.poll(() => game.getAttribute('data-gem').then(Number), { timeout: 20_000 }).toBeGreaterThan(1);
  await expect(page.locator('.mg-gem')).toContainText('A la vista');
  await expect.poll(() => game.getAttribute('data-sign'), { timeout: 30_000 }).toBe('alerted');
  await expect(page.locator('.mg-wary:not([hidden])').first()).toContainText('!');
  // Walking: each step a ring as far as it is heard.
  await page.keyboard.down('KeyS');
  await expect.poll(() => game.getAttribute('data-rings').then(Number), { timeout: 10_000 }).toBeGreaterThan(0);
  await page.keyboard.up('KeyS');
  expect(list).toEqual([]);
});

test('the fortress, in the dark: the gem says hidden, and a guard that glimpses nothing has no sign', async ({ page }) => {
  test.setTimeout(90_000);
  const list = errors(page);
  const game = page.locator('#game');
  // Outside the outer wall, east of the breach, in the dark.
  await page.goto(`jugar/fortaleza/#${intruderAt(6, 0.9, 5)}`);
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'wall');
  await expect.poll(async () => Number(await game.getAttribute('data-gem')), { timeout: 20_000 }).toBeLessThan(0.6);
  await expect(page.locator('.mg-gem')).toContainText('Oculto');
  expect(await game.getAttribute('data-sign')).toBe('none');
  expect(list).toEqual([]);
});

/**
 * The wall's link recipe (stage 5h; levels to advance through since 5n): every attacker standing down at once,
 * and the defender at the first level's way out (since 5o, past the round tower's red door).
 */
const allDown = 'recipe=wait+30;wall.down;wait+5;set+defender+transform.position+12+0.9+-44.5';

test('the wall: its title, in first person, a level done (its gold time, its recap) and kept, at dawn’s edge', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto(`jugar/muralla/#${allDown}`);
  await expect(game).toHaveAttribute('data-dialog', 'La muralla', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-sky', '4.5');
  await page.getByRole('button', { name: 'Créditos' }).click();
  await expect(page.locator('.mg-panel')).toContainText('weapons.glb: lo hace un guion de este proyecto, art/weapons.py');
  await page.getByRole('button', { name: 'Volver' }).click();
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await expect(game).toHaveAttribute('data-dialog', 'La guardiana');
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'walk');
  await expect(page.locator('.mg-crosshair')).toBeVisible();
  // (Stage 5n) Its HUD: the weapon in its hands and its darts (5o: in its magazine, and carried besides).
  await expect(page.locator('.mg-hud')).toContainText('saeta 12/28');
  await expect(game).toHaveAttribute('data-dialog', 'El adarve: listo', { timeout: 200_000 });
  await expect(page.locator('.mg-panel')).toContainText('Tiempo de oro: 1:22,0');
  await expect(page.locator('.mg-panel')).toContainText('Sin caer');
  // Its recap: the secret not found; the attackers it brought down (the command's are not its own).
  await expect(page.locator('.mg-panel')).toContainText('Secretos: ninguno de 1');
  await expect(page.locator('.mg-panel')).toContainText('Atacantes: 0 de 12');
  expect(JSON.parse((await game.getAttribute('data-progress'))!)).toMatchObject({ version: 1, started: true, reached: 1 });
  await page.getByRole('button', { name: 'Seguir', exact: true }).click();
  await expect(game).toHaveAttribute('data-level', 'gatehouse');
  expect(list).toEqual([]);
});

test('the wall’s attackers are fair: each raises its weapon, seen and heard, before it shoots; a hit shakes the view', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const list = errors(page);
  const game = page.locator('#game');
  // In the yard's door, within the sentries' range (stage 5n: a fair gunner fires only within it, and a
  // page drawn without a GPU takes some ten steps a second: from the start they would take minutes).
  await page.goto('jugar/muralla/#recipe=wait+1;set+defender+transform.position+0+0.9+-5');
  await expect(game).toHaveAttribute('data-dialog', 'La muralla', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await page.getByRole('button', { name: 'Seguir' }).click();
  await expect(game).toHaveAttribute('data-level', 'walk');
  // (Stage 5o) A dart fired from its magazine; R, a reload (heard: its subtitle), and the magazine full again.
  await expect(page.locator('.mg-hud')).toContainText('saeta 12/28');
  await page.keyboard.press('KeyX');
  await expect(page.locator('.mg-hud')).toContainText('saeta 11/28', { timeout: 20_000 });
  await page.keyboard.press('KeyR');
  await expect(page.locator('.mg-hud')).toContainText('saeta recargando…', { timeout: 20_000 });
  await expect(page.locator('.mg-hud')).toContainText('saeta 12/27', { timeout: 60_000 });
  // There, the defender only watches: the yard's sentries see it in the door, and each raises its weapon
  // (a glint, `data-readies`; and its sound, heard and in subtitles) before the first hit.
  await expect.poll(() => game.getAttribute('data-hurt').then(Number), { timeout: 200_000 }).toBeGreaterThan(0);
  expect(Number(await game.getAttribute('data-readies')), 'warned before the first hit').toBeGreaterThan(0);
  // The hit shook the view (a trauma that decays in under a second: it was there).
  expect(await game.getAttribute('data-trauma')).not.toBeNull();
  // (Stage 5k) In first person, the camera is somewhere: three numbers (the walk's sway once made it "not a number").
  expect((await position(page, 'camera')).every(Number.isFinite)).toBe(true);
  expect(list).toEqual([]);
});

test('a shot that misses near the ears is heard going by (stage 5k): strafing before a guard of the arena, its aim behind', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/arena/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // On the east guard's beat, in its sight; going from side to side, its aim, which follows, trails behind.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.camera first', 'dojo.goto 8 1 1');
  await page.keyboard.press('Escape');
  await expect
    .poll(
      async () => {
        for (const key of ['KeyD', 'KeyA']) {
          await page.keyboard.down(key);
          await afterSteps(page, 36);
          await page.keyboard.up(key);
        }
        return Number(await game.getAttribute('data-whizzes'));
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  expect(list).toEqual([]);
});

test('explosions (stage 5k): the launcher’s rocket leaves a trail, and blows into a flash, fire, sparks, smoke, rubble and a flare of light', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/armory/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 5 1 8.5');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-hud')).toContainText('lanzador');
  // At a tenth of the speed, to see it as it happens (the effects go at the world's pace).
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.timescale 0.1');
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyX');
  // In flight: its trail.
  await expect.poll(() => game.getAttribute('data-particles').then(Number), { timeout: 20_000 }).toBeGreaterThan(5);
  await expect.poll(() => game.getAttribute('data-blasts'), { timeout: 60_000 }).toBe('1');
  // Its particles (a blast throws about ninety), its light, its rubble, its sound.
  expect(Number(await game.getAttribute('data-particles'))).toBeGreaterThan(60);
  expect(Number(await game.getAttribute('data-flare'))).toBeGreaterThan(0);
  await expect.poll(() => game.getAttribute('data-fragments').then(Number)).toBeGreaterThan(0);
  await expect(game).toHaveAttribute('data-sound', 'blast');
  // Paused, they hold; and at the world's own pace, they are gone in a few seconds but the scorch, if it struck the floor.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.timescale 1');
  await page.keyboard.press('Escape');
  await expect.poll(() => game.getAttribute('data-particles').then(Number), { timeout: 20_000 }).toBeLessThanOrEqual(1);
  expect(list).toEqual([]);
});

test('the walk’s sway (stage 5k): in first person the eyes dip with each step and sink on landing; with view.bob off they glide', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/course/');
  await expect.poll(() => game.getAttribute('data-player'), { timeout: 20_000 }).toBeTruthy();
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.camera first');
  await page.keyboard.press('Escape');
  /**
   * How far up and down the eyes went while it walked ahead for a second and a half of the world (m). (Stage
   * 5o: read every four of the world's steps, not by the clock: its cadence is about two steps a second of
   * the world, and a page drawn without a GPU takes some ten a second of the clock.)
   */
  const swayWalking = async () => {
    const heights: number[] = [];
    await page.keyboard.down('KeyW');
    await afterSteps(page, 20);
    for (let i = 0; i < 24; i++) {
      heights.push((await position(page, 'camera'))[1]!);
      await afterSteps(page, 4);
    }
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyS');
    await afterSteps(page, 60);
    await page.keyboard.up('KeyS');
    return Math.max(...heights) - Math.min(...heights);
  };
  const pitchBefore = (await position(page, 'look'))[1]!;
  // (Stage 5o: the dip at a walk is 2.2 cm, rebalanced from 3.5.)
  expect(await swayWalking()).toBeGreaterThan(0.012);
  expect(Number(await game.getAttribute('data-bob'))).toBeGreaterThan(1.5);
  // Walking ahead, the mouse still, where it looks up or down stays (the sway's dips once stayed in the
  // camera, frame after frame, and the aim rose by itself: the author found it).
  expect(Math.abs((await position(page, 'look'))[1]! - pitchBefore)).toBeLessThan(0.01);
  // A jump, and the eyes sink a few centimeters as it lands.
  await page.keyboard.press('Space');
  await expect.poll(() => game.getAttribute('data-dip').then(Number), { timeout: 10_000 }).toBeGreaterThan(2);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.bob false');
  await page.keyboard.press('Escape');
  // (The probe writes centimeters: gliding, the eyes move at most one of its steps, from rounding.)
  expect(await swayWalking()).toBeLessThan(0.015);
  expect((await position(page, 'camera')).every(Number.isFinite)).toBe(true);
  expect(list).toEqual([]);
});

test('the games’ atmosphere: a night with fog near, glow, crickets and an owl in the fortress; dusk birds at the tower', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/fortaleza/');
  await expect(game).toHaveAttribute('data-dialog', 'La fortaleza', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-atmosphere', 'on');
  await expect(game).toHaveAttribute('data-glow', 'on');
  // At 22 h: the night's fog, near (18 to 85 m), and the night's background sounds.
  await expect(game).toHaveAttribute('data-fog', '18 85');
  await expect(game).toHaveAttribute('data-ambience', '0.35 1.00 0.00 1.00');
  await page.goto('jugar/torre/');
  await expect(game).toHaveAttribute('data-dialog', 'La torre', { timeout: 20_000 });
  await expect(game).toHaveAttribute('data-atmosphere', 'on');
  await expect.poll(async () => Number((await game.getAttribute('data-ambience'))?.split(' ')[2])).toBeGreaterThan(0);
  expect(list).toEqual([]);
});

// ---------------------------------------------------------------- on a phone (decision 0028)

test.describe('on a phone', () => {
  // A phone's screen, touch and coarse pointer (its browser type is the project's: a group cannot change it).
  const { defaultBrowserType: _, ...phone } = devices['Pixel 7']!;
  test.use(phone);

  test('a game tells a phone it is played with a keyboard or a gamepad, and lets you look anyway', async ({ page }) => {
    const list = errors(page);
    await page.goto('jugar/dojo/course/');
    await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
    await expect(page.locator('#game')).toHaveAttribute('data-touch', 'told');
    await expect(page.locator('.mg-touch')).toContainText('teclado y mouse, o con un gamepad');
    await page.locator('.mg-touch button').tap();
    await expect(page.locator('.mg-touch')).toHaveCount(0);
    await expect(page.locator('#game')).not.toHaveAttribute('data-touch', /./);
    expect(list).toEqual([]);
  });
});

test('on a computer (a fine pointer), no such notice', async ({ page }) => {
  await page.goto('jugar/dojo/course/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await expect(page.locator('.mg-touch')).toHaveCount(0);
});

// ---------------------------------------------------------------- the camera before the levels (stage 4.5d)

/** A gamepad of the test's: its left stick (x, y) as `window.__stick`, nothing pressed. */
async function withPad(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __left: [number, number] };
    w.__left = [0, 0];
    const pad = () => ({
      id: 'test pad',
      index: 0,
      connected: true,
      mapping: 'standard',
      timestamp: performance.now(),
      axes: [w.__left[0], w.__left[1], 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    });
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad(), null, null, null] });
  });
}
const azimuth = async (page: Page) => {
  const [p, c] = [await position(page, 'player'), await position(page, 'camera')];
  return (Math.atan2(c[0]! - p[0]!, c[2]! - p[2]!) * 180) / Math.PI;
};
const turnOf = (a: number, b: number) => Math.abs(((b - a + 540) % 360) - 180);

test('follow: walking nearly straight at the camera (within 15°), it goes back without turning; further off, it turns', async ({
  page,
}) => {
  await withPad(page);
  const walk = async (x: number) => {
    await page.goto('jugar/dojo/course/#recipe=view.camera+follow');
    await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
    await afterSteps(page, 60);
    const from = await azimuth(page);
    // The stick back (towards the camera), a little to a side.
    await page.evaluate((x) => ((window as unknown as { __left: [number, number] }).__left = [x, 1]), x);
    await afterSteps(page, 60);
    await page.evaluate(() => ((window as unknown as { __left: [number, number] }).__left = [0, 0]));
    return turnOf(from, await azimuth(page));
  };
  // 11° off straight at it: it goes back, without turning; 31° off, it turns.
  expect(await walk(0.2)).toBeLessThan(2);
  expect(await walk(0.6)).toBeGreaterThan(3);
});

test('chase: turning on the spot, the camera stays; walking, it comes back behind where the character goes', async ({ page }) => {
  await page.goto('jugar/dojo/course/#recipe=view.camera+chase;controls.scheme+tank');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  const from = await azimuth(page);
  await page.keyboard.down('KeyA');
  await afterSteps(page, 45);
  await page.keyboard.up('KeyA');
  await afterSteps(page, 30);
  // It turned on its axis (tank: A turns it), and the camera stayed (it came back behind where it LOOKED).
  expect(turnOf(from, await azimuth(page))).toBeLessThan(5);
  await page.keyboard.down('KeyW');
  // Walking where it looks now, the camera comes behind it: looking along where it goes. (Eased by the
  // clock: on a loaded machine, it takes more of the world's steps.)
  const along = async () => {
    const [look, facing] = [await position(page, 'look'), await position(page, 'facing')];
    return (look[0]! * facing[0]! + look[2]! * facing[2]!) / Math.hypot(look[0]!, look[2]!);
  };
  await expect.poll(along, { timeout: 30_000 }).toBeGreaterThan(Math.cos((25 * Math.PI) / 180));
  await page.keyboard.up('KeyW');
});

test('over a wall: a wall right behind the character, with the sky above, and the camera rises to see over it', async ({
  page,
}) => {
  await page.goto('jugar/dojo/course/#recipe=view.camera+follow');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  const [x, , z] = await position(page, 'player');
  // A wall 3 m tall a meter behind it (the camera follows from +Z, behind it as it starts, looking −Z).
  await page.keyboard.press('Backquote');
  await typeInConsole(page, `add box ${x!.toFixed(2)} 1.5 ${(z! + 1.2).toFixed(2)}  3 1.5 0.1`);
  await page.keyboard.press('Escape');
  await afterSteps(page, 90);
  const [p, c] = [await position(page, 'player'), await position(page, 'camera')];
  // Above the wall's top (3 m), and not brought in to its back.
  expect(c[1]!).toBeGreaterThan(3);
  expect(Math.hypot(c[0]! - p[0]!, c[1]! - p[1]!, c[2]! - p[2]!)).toBeGreaterThan(2);
});

test('locked on someone: the camera behind the character, on the far side from the other, both in sight', async ({ page }) => {
  await page.goto('jugar/dojo/duel/#recipe=view.camera+follow');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  await page.keyboard.press('KeyT');
  await afterSteps(page, 120);
  const listed = await page.evaluate(() => (document.querySelector('#game') as HTMLElement).dataset.others ?? '');
  const [c, look, p] = [await position(page, 'camera'), await position(page, 'look'), await position(page, 'player')];
  // The character in sight: within the field of view's half (30° top to bottom; more across).
  const angle = (to: number[]) => {
    const d = [to[0]! - c[0]!, to[1]! + 0.6 - c[1]!, to[2]! - c[2]!];
    const cos = (d[0]! * look[0]! + d[1]! * look[1]! + d[2]! * look[2]!) / Math.hypot(...(d as [number, number, number]));
    return (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
  };
  expect(angle(p)).toBeLessThan(30);
  // And the other: the guard, as the page lists the other characters (`data-others`: player:x y z, each).
  const others = listed
    .split('|')
    .map((t) => (t.split(':')[1] ?? '').trim().split(' ').map(Number))
    .filter((v) => v.length >= 3);
  expect(others.length).toBeGreaterThan(0);
  expect(Math.min(...others.map((o) => angle(o)))).toBeLessThan(30);
});

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

test('the charge (stage 4b): F held, the HUD shows the throw filling up; let go, the ball goes and the meter with it', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  await page.goto('jugar/dojo/moves/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  const hud = page.locator('.mg-hud');
  await expect(hud).not.toContainText('Fuerza');
  await page.keyboard.down('KeyF');
  await afterSteps(page, 70);
  // Held more than a second: full.
  await expect(hud).toContainText('Fuerza');
  await expect(hud).toContainText('▮▮▮▮▮▮▮▮▮▮');
  await page.keyboard.up('KeyF');
  await expect(hud).not.toContainText('Fuerza', { timeout: 15_000 });
  expect(list).toEqual([]);
});

test('the training dummy (stage 4c): hit by balls it falls, a ragdoll, and three seconds later it is back on its feet', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const list = errors(page);
  await page.goto('jugar/dojo/moves/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  // Three meters from the dummy (at x = −8), turned to it (A walks to −X with the still camera, and the
  // character looks where it walks), then a tap of F every so often.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto -4.6 1 2');
  await page.keyboard.press('Escape');
  await afterSteps(page, 30);
  await page.keyboard.down('KeyA');
  await afterSteps(page, 4);
  await page.keyboard.up('KeyA');
  const falls = () => page.locator('#game').getAttribute('data-falls');
  for (let i = 0; i < 40 && (await falls()) !== '1'; i++) {
    await page.keyboard.press('KeyF');
    await afterSteps(page, 25);
  }
  expect(await falls()).toBe('1');
  await expect.poll(falls, { timeout: 30_000 }).toBe('0');
  expect(list).toEqual([]);
});

test('the weapons (stage 4c): a dart taken from its rack, held in both hands; four of them, X, and the dummy falls; its HUD says so', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const list = errors(page);
  await page.goto('jugar/dojo/moves/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 60);
  // Onto the dart's rack, and from there five meters from the dummy, turned to it (as above).
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto -6.5 1 8.2');
  await page.keyboard.press('Escape');
  await afterSteps(page, 20);
  const hud = page.locator('.mg-hud');
  await expect(hud).toContainText('dardo');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto -3 1 2');
  await page.keyboard.press('Escape');
  await afterSteps(page, 30);
  await page.keyboard.down('KeyA');
  await afterSteps(page, 4);
  await page.keyboard.up('KeyA');
  await afterSteps(page, 20);
  // Both hands on it.
  await expect.poll(() => page.locator('#game').getAttribute('data-holds')).toBe('tool tool');
  const falls = () => page.locator('#game').getAttribute('data-falls');
  for (let i = 0; i < 8 && (await falls()) !== '1'; i++) {
    await page.keyboard.press('KeyX');
    await afterSteps(page, 15);
  }
  expect(await falls()).toBe('1');
  expect(list).toEqual([]);
});

test('the keep’s navigation (stage 4d): show.nav draws its cells; nav.path from the start to the last plate presses the button, rides the lift', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  await page.goto('jugar/dojo/keep/#recipe=view.camera+free;show.nav+on');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect.poll(async () => Number(await page.locator('#game').getAttribute('data-nav'))).toBeGreaterThan(500);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'nav.path last_plate');
  await expect(page.locator('.mg-console-log')).toContainText('press use in button');
  await expect(page.locator('.mg-console-log')).toContainText('ride');
  const kinds = (await page.locator('#game').getAttribute('data-path'))!.split(' ');
  expect(kinds[0]).toBe('start');
  expect(kinds.indexOf('use')).toBeLessThan(kinds.indexOf('ride'));
  await typeInConsole(page, 'nav.path');
  await expect.poll(() => page.locator('#game').getAttribute('data-path')).toBeNull();
  expect(list).toEqual([]);
});

test('a guard in the keep (stage 4e): `bots` says what it does; `possess guard` drives it with the keys; `back` goes back', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const list = errors(page);
  await page.goto('jugar/dojo/guard/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await afterSteps(page, 120);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'bots');
  const log = page.locator('.mg-console-log');
  await expect(log).toContainText('guard (entity');
  await expect(log).toContainText('arms.guard on yard');
  // It heard the lift take you up: it is looking.
  await expect(log).toContainText(/look|chase|search/);
  // Its body, with the keys: the camera goes with it, and S walks it.
  await typeInConsole(page, 'possess guard');
  await expect(log).toContainText('you drive guard');
  await page.keyboard.press('Escape');
  // Where it stands, once it stands: taken over with no key down, it stands (it used to walk on with
  // what its brain asked for last, until a key changed: the server). And read from a frame drawn since:
  // until the next one, `data-player` is still your own character, up on the lift. (With either, W's
  // walk was measured from the wrong place, and passed; or not: 0.43 m, in continuous integration on
  // 2026-11-17.)
  const [x0, , z0] = await settled(page, 'player');
  // S, back into the yard (+Z): it stands at the door's button, by the wall, which W walks it into (0.3 m).
  await page.keyboard.down('KeyS');
  await afterSteps(page, 40);
  await page.keyboard.up('KeyS');
  const [x1, , z1] = await position(page, 'player');
  expect(Math.hypot(x1! - x0!, z1! - z0!)).toBeGreaterThan(0.5);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'possess');
  await expect(log).toContainText('you drive your own character again');
  await typeInConsole(page, 'back 1');
  await expect(log).toContainText('back at step');
  expect(list).toEqual([]);
});

test('the duel (stage 4f): a scene as you come in, the objective to do at the top, in Spanish; walking into the stick, the next one', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  await page.goto('jugar/dojo/duel/#recipe=view.camera+free');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // The master's first line, and the first objective.
  await expect(page.locator('.mg-scene')).toBeVisible();
  await expect(page.locator('.mg-scene')).toContainText('El maestro');
  await expect(page.locator('.mg-objective')).toHaveText('Objetivo: tomá el palo del soporte');
  // A click goes on (to its next line, or, on the last one, away).
  const line = await page.locator('#game').getAttribute('data-scene');
  await page.locator('.mg-scene').click();
  await expect.poll(() => page.locator('#game').getAttribute('data-scene')).not.toBe(line);
  // To the stick's rack: the next objective.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto -3 1 5');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-objective')).toHaveText('Objetivo: derribá al guardia');
  expect(list).toEqual([]);
});

test('the arena (stage 4g): in first person, three guards with darts, the objective; a dart from its rack', async ({ page }) => {
  test.setTimeout(120_000);
  const list = errors(page);
  await page.goto('jugar/dojo/arena/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect(page.locator('.mg-objective')).toHaveText('Objetivo: derribá a los tres guardias');
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.camera');
  const log = page.locator('.mg-console-log');
  await expect(log).toContainText('first');
  await typeInConsole(page, 'bots');
  await expect(log).toContainText('guard_3 (entity');
  await typeInConsole(page, 'dojo.goto -2 1 8.5');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-hud')).toContainText('dardo');
  expect(list).toEqual([]);
});

test('the armory (stage 5g): the shotgun from its rack, fired at a dummy: its flash, its sound, its pellets’ marker; the launcher’s rocket blows', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  const game = page.locator('#game');
  await page.goto('jugar/dojo/armory/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 3 1 8.5');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-hud')).toContainText('escopeta');
  // Two meters before the nearest dummy, looking at it: X fires.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 0 1 8.6');
  await page.keyboard.press('Escape');
  await afterSteps(page, 20);
  await page.keyboard.press('KeyX');
  await expect(game).toHaveAttribute('data-flashes', /^[1-9]/);
  await expect(game).toHaveAttribute('data-hits', /^[1-9]/);
  await expect(game).toHaveAttribute('data-sound', 'fired shotgun');
  // The launcher, fired down the range at the far wall: its rocket blows there.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 5 1 8.5');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-hud')).toContainText('lanzador');
  // (What one carries is ready again a second after the shotgun's shot, whichever it is now.)
  await afterSteps(page, 70);
  await page.keyboard.press('KeyX');
  await expect(game).toHaveAttribute('data-sound', 'blast', { timeout: 10_000 });
  expect(list).toEqual([]);
});

test('first person: the mouse, once taken, turns it wherever the character stands, as aiming does (the keep and moves found it)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const list = errors(page);
  // Headless Chromium refuses a real pointer lock: this stands in for the browser's (the canvas holds
  // the mouse once clicked) and the test sends the moves it would (`movementX`). What is checked is the
  // page's handling of them.
  await page.addInitScript(() => {
    let locked: Element | null = null;
    Object.defineProperty(Document.prototype, 'pointerLockElement', { get: () => locked, configurable: true });
    const lock = (to: Element) => {
      locked = to;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    };
    Element.prototype.requestPointerLock = function (this: Element) {
      return lock(this);
    };
  });
  // Where it starts in `moves`, nothing behind brings the camera in (there, the first version did not turn at all).
  await page.goto('jugar/dojo/moves/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  const turned = async (camera: string) => {
    await page.keyboard.press('Backquote');
    await typeInConsole(page, `view.camera ${camera}`);
    await page.keyboard.press('Escape');
    const box = (await page.locator('#game canvas').first().boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await afterSteps(page, 30);
    const angle = (f: number[]) => Math.atan2(f[0]!, -f[2]!);
    const before = angle(await position(page, 'facing'));
    // Moves worth a radian (20 of 20 px, at 0.0025 rad a pixel), to the right.
    await page.evaluate(() => {
      for (let i = 0; i < 20; i++) document.dispatchEvent(new MouseEvent('mousemove', { movementX: 20, bubbles: true }));
    });
    await afterSteps(page, 10);
    const d = angle(await position(page, 'facing')) - before;
    return Math.atan2(Math.sin(d), Math.cos(d));
  };
  // In first person, in the open (nothing behind to bring the camera in), as much as aiming from behind.
  expect(await turned('first')).toBeCloseTo(1, 1);
  expect(await turned('aim')).toBeCloseTo(1, 1);
  expect(list).toEqual([]);
});

test('first person (the author playing): crouched, the eyes come down to the head; a crosshair while aiming, none otherwise', async ({
  page,
}) => {
  const list = errors(page);
  await page.goto('jugar/dojo/moves/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  await expect(page.locator('.mg-crosshair')).toBeHidden();
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.camera first');
  await page.keyboard.press('Escape');
  const eyes = async () => (await position(page, 'camera'))[1]! - (await position(page, 'player'))[1]!;
  // Standing, the head's height (0.62 m over the center); crouched, the crouch's head (0.12 m); and back.
  await expect.poll(eyes).toBeCloseTo(0.62, 2);
  await expect(page.locator('.mg-crosshair')).toBeVisible();
  await page.keyboard.down('KeyC');
  await expect.poll(eyes).toBeCloseTo(0.12, 2);
  await page.keyboard.up('KeyC');
  await expect.poll(eyes).toBeCloseTo(0.62, 2);
  // Turned off, it is not drawn.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'view.crosshair off');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mg-crosshair')).toBeHidden();
  expect(list).toEqual([]);
});

test('down in first person (the arena found it): hits glow, the HUD says it, and the camera steps back to see the fall', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const list = errors(page);
  await page.goto('jugar/dojo/arena/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 15_000 }).toBe(3);
  // Every HUD the page shows, however briefly (a hit's health lasts until the next one).
  await page.evaluate(() => {
    const hud = document.querySelector<HTMLElement>('.mg-hud')!;
    const seen = new Set<string>();
    (window as unknown as { huds: Set<string> }).huds = seen;
    new MutationObserver(() => seen.add(hud.textContent ?? '')).observe(hud, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  const huds = () => page.evaluate(() => [...(window as unknown as { huds: Set<string> }).huds].join(' | '));
  const fromEyes = async () => {
    const [p, c] = [await position(page, 'player'), await position(page, 'camera')];
    return Math.hypot(c[0]! - p[0]!, c[1]! - p[1]! - 0.62, c[2]! - p[2]!);
  };
  // In the middle, where the three guards see you; standing, the camera is at the eyes.
  await page.keyboard.press('Backquote');
  await typeInConsole(page, 'dojo.goto 0 1 3');
  await page.keyboard.press('Escape');
  await expect.poll(fromEyes, { timeout: 15_000 }).toBeLessThan(0.05);
  // Hit: the edges glow red, and the HUD shows what is left; down, how long until you are back.
  await expect
    .poll(async () => Number(await page.locator('#game').getAttribute('data-hurt')), { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expect.poll(() => page.locator('#game').getAttribute('data-falls'), { timeout: 30_000 }).toBe('1');
  expect(await huds()).toMatch(/Vida\s*\d+ de 100/);
  await expect(page.locator('.mg-hud')).toContainText('volvés en');
  // Down, the camera is behind the head (a wall may bring it in, never nearer than 35 cm), and the
  // body is drawn, falling.
  expect(await fromEyes()).toBeGreaterThan(0.3);
  // Back at the entrance, standing: at the eyes again. (Three seconds of the world, 180 steps: without
  // a GPU, with other tests drawing alongside, the world may go at a fifth of the clock.)
  await afterSteps(page, 180, 60_000);
  await expect.poll(() => page.locator('#game').getAttribute('data-falls'), { timeout: 30_000 }).toBe('0');
  await expect.poll(fromEyes, { timeout: 15_000 }).toBeLessThan(0.05);
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
