import { expect, test } from '@playwright/test';
import { afterSteps, position, settled, errors, meshes, consoleLog, typeInConsole } from './helpers';

/**
 * THE DOJO'S ROOMS (stages 1d to 4g): snapshots, a level's loop, capabilities, a body, weapons, guards, first person.
 */

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

// ---------------------------------------------------------------- what leaks (stage 5.5g)

test('a world born a hundred times in one page leaves nothing behind: what the GPU keeps, and the scene, as they were', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const list = errors(page);
  const game = page.locator('#game');
  const counts = async () =>
    Promise.all(['data-geometries', 'data-textures', 'data-scene'].map(async (a) => Number(await game.getAttribute(a))));
  // The keep: a level with models, lamps, guards with weapons, a lamp that breaks.
  await page.goto('jugar/dojo/keep/');
  await expect.poll(async () => (await position(page, 'player')).length, { timeout: 20_000 }).toBe(3);
  await page.keyboard.press('Backquote');
  // Born again twice first: what is made once for the page (the models, the shared shapes) is made by then.
  for (let i = 0; i < 2; i++) await typeInConsole(page, 'restart');
  await afterSteps(page, 30);
  const before = await counts();
  for (let i = 0; i < 100; i++) await typeInConsole(page, 'restart');
  await afterSteps(page, 30);
  const after = await counts();
  // As many geometries, textures and things in the scene as after the first two (a world's own, made again).
  expect(after, `geometries, textures, scene: ${before} → ${after}`).toEqual(before);
  expect(list).toEqual([]);
});
