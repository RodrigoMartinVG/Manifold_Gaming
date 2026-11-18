import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * THE SITE'S NAVIGATION: four sections always in reach (in the header, or at the bottom on a
 * phone), each with its own sidebar whose previous/next never leave it, a home page whose doors
 * lead somewhere real, and a Dojo that says how to start. The labels are the site's, in Spanish.
 */
const DOCS = join(import.meta.dirname, '..', 'site', 'src', 'content', 'docs');
const SECTIONS = ['jugar', 'tutorial', 'bitacora', 'proyecto'];

/** The Bitácora's reports, from their files: name and order in the sidebar. */
function reports() {
  const folder = join(DOCS, 'bitacora');
  return readdirSync(folder)
    .filter((f) => /^etapa-.*\.mdx?$/.test(f))
    .map((f) => {
      const text = readFileSync(join(folder, f), 'utf8');
      return {
        title: text.match(/^title:\s*'?(.+?)'?\s*$/m)![1]!,
        order: Number(text.match(/^\s+order:\s*(-?\d+)/m)![1]),
      };
    })
    .sort((a, b) => b.order - a.order);
}

const pagesBySection: [string, string | null][] = [
  ['', null],
  ['jugar/', 'jugar'],
  ['jugar/dojo/', 'jugar'],
  ['jugar/consola/', 'jugar'],
  ['tutorial/', 'tutorial'],
  ['tutorial/dibujar/01-la-pantalla/', 'tutorial'],
  ['tutorial/dibujar/02-lineas/', 'tutorial'],
  ['bitacora/', 'bitacora'],
  ['bitacora/etapa-0e/', 'bitacora'],
  ['proyecto/', 'proyecto'],
];

for (const [address, section] of pagesBySection) {
  test(`every section is one click away, and the current one is marked (/${address})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    // Only the markup matters here: no need to wait for the showcase or the images.
    await page.goto(address, { waitUntil: 'domcontentloaded' });
    const links = page.locator('header nav.mg-sections a');
    await expect(links).toHaveCount(4);
    for (const [i, id] of SECTIONS.entries()) {
      await expect(links.nth(i)).toHaveAttribute('href', new RegExp(`/${id}/$`));
      if (id === section) await expect(links.nth(i)).toHaveAttribute('aria-current', /^(page|true)$/);
      else await expect(links.nth(i)).not.toHaveAttribute('aria-current');
    }
    await expect(page.locator('nav.mg-tabbar')).toBeHidden();
  });
}

test('on a phone, the sections are in a bar at the bottom, also on the home page, and it hides nothing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const bar = page.locator('nav.mg-tabbar');
  await expect(bar).toBeVisible();
  await expect(page.locator('header nav.mg-sections')).toBeHidden();
  expect(Math.round((await bar.boundingBox())!.y + (await bar.boundingBox())!.height)).toBe(844);

  await bar.getByRole('link', { name: 'Bitácora' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('La Bitácora');
  await expect(page.locator('nav.mg-tabbar a[aria-current]')).toHaveText('Bitácora');

  // At the end of a chapter, previous/next stay above the bar.
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const next = (await page.locator('.pagination-links a[rel="next"]').boundingBox())!;
  expect(next.y + next.height).toBeLessThanOrEqual((await bar.boundingBox())!.y);
});

test('each section has its own sidebar, and previous/next never leave it', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const sidebarLinks = (section: string) => page.locator(`.sidebar-pane a[href*="/${section}/"]`);

  await page.goto('tutorial/dibujar/01-la-pantalla/');
  // The book: its first page and its chapters, nothing of the earlier tutorials (decision 0030).
  expect(await sidebarLinks('tutorial').count()).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.sidebar-pane a[href*="/archivo/"], .sidebar-pane a[href*="/parte-"]')).toHaveCount(0);
  await expect(sidebarLinks('bitacora')).toHaveCount(0);

  await page.goto('bitacora/etapa-0b/');
  expect(await sidebarLinks('bitacora').count()).toBe(reports().length + 1);
  await expect(sidebarLinks('tutorial')).toHaveCount(0);

  // Chapter 1 comes after the book's first page and before chapter 2; the last chapter's "next" never leaves the
  // section (before, the tutorial's last page went on to the Bitácora).
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  await expect(page.locator('.pagination-links a[rel="prev"]')).toHaveAttribute('href', /\/tutorial\/$/);
  await expect(page.locator('.pagination-links a[rel="next"]')).toHaveAttribute('href', /\/tutorial\/dibujar\/02-lineas\/$/);
  await page.goto('tutorial/dibujar/02-lineas/');
  await expect(page.locator('.pagination-links a[rel="next"]')).toHaveCount(0);
  await page.goto('bitacora/etapa-0/');
  await expect(page.locator('.pagination-links a[rel="prev"]')).toHaveAttribute('href', /\/bitacora\/$/);

  // Jugar: the games first, then what they all share (the controls, the console, the same hash).
  await page.goto('jugar/');
  const paths = await sidebarLinks('jugar').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).pathname));
  for (const p of ['jugar/', 'jugar/dojo/', 'jugar/como-se-juega/', 'jugar/consola/', 'jugar/la-misma-huella/'])
    expect(
      paths.some((x) => x.endsWith(`/${p}`)),
      p,
    ).toBe(true);
  await expect(sidebarLinks('tutorial')).toHaveCount(0);

  // A section with a single page shows no sidebar, and reads at the usual width.
  for (const address of ['proyecto/']) {
    await page.goto(address);
    await expect(page.locator('html')).not.toHaveAttribute('data-has-sidebar');
    await expect(page.locator('.pagination-links a')).toHaveCount(0);
    // (The page's text column, Starlight's: notes in the margin open their own inside it.)
    expect((await page.locator('.sl-container > .sl-markdown-content').boundingBox())!.width).toBeLessThanOrEqual(730);
  }
});

test("the home page's doors lead to pages that exist, with what is new in each section", async ({ page }) => {
  await page.goto('./');
  // The Dojo goes first (the main action), then the tutorial.
  const actions = page.locator('.hero-actions a');
  await expect(actions.nth(0)).toHaveText(/Entrar al Dojo/);
  await expect(actions.nth(0)).toHaveAttribute('href', /jugar\/dojo\/course\/$/);
  await expect(actions.nth(1)).toHaveText(/Empezar el tutorial/);

  const doors = page.locator('.mg-doors .mg-door');
  await expect(doors).toHaveCount(3);
  // The rooms to start with and the demonstrations (their recipes say so), and a link to all the others.
  const recipes = join(import.meta.dirname, '..', 'games', 'dojo', 'recipes');
  const rooms = readdirSync(recipes).filter((f) => f.endsWith('.txt'));
  const featured = rooms.filter((f) => /^# group: (start|demos)$/m.test(readFileSync(join(recipes, f), 'utf8')));
  await expect(page.locator('.mg-rooms li:not(.mg-rooms-more) a')).toHaveCount(featured.length);
  await expect(page.locator('.mg-rooms-more a')).toHaveText(`y ${rooms.length - featured.length} salas más`);
  // The number of chapters, and the latest report.
  // (The book's chapters, in their parts' folders: tutorial/dibujar/01-la-pantalla.mdx…)
  const chapters = readdirSync(join(DOCS, 'tutorial'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(join(DOCS, 'tutorial', d.name)).filter((f) => /^\d+.*\.mdx$/.test(f)));
  await expect(doors.nth(1)).toContainText(`${chapters.length} capítulos`);
  await expect(doors.nth(2).locator('.mg-door-next a')).toHaveText(reports()[0]!.title);

  const hrefs = await page.locator('.mg-doors a, .mg-stages a').evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.length).toBeGreaterThanOrEqual(9);
  for (const href of hrefs) expect((await page.request.get(href)).status(), href).toBe(200);
});

test("the Bitácora's index lists every report, newest first", async ({ page }) => {
  await page.goto('bitacora/');
  const items = page.locator('.mg-reports li a');
  const expected = reports();
  await expect(items).toHaveCount(expected.length);
  await expect(items).toHaveText(expected.map((r) => r.title));
});

test('the Dojo says how to start the first time, and only the first time', async ({ page }) => {
  await page.goto('jugar/dojo/empty/');
  const hint = page.locator('#hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('help');
  // Opening the console is what the hint asks for: it goes away, and it does not come back.
  await expect.poll(() => page.locator('#game').getAttribute('data-meshes').then(Number), { timeout: 15_000 }).toBe(2);
  await page.keyboard.press('Backquote');
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(hint).toBeHidden();
  // Leaving goes to the Dojo's page in the site.
  await expect(page.locator('#back')).toHaveAttribute('href', /\/jugar\/dojo\/$/);
});

test('a room with a character has its own hint, which says how to drive it', async ({ page }) => {
  await page.goto('jugar/dojo/rain/');
  await page.locator('#hint button').click();
  // Seen in a room without a character; the course's is another one, and it says how to walk.
  await page.goto('jugar/dojo/course/');
  await expect(page.locator('#hint')).toBeVisible();
  await expect(page.locator('#hint')).toContainText('para caminar');
});

test("the play section: the games as cards, the Dojo first, and the Dojo's page with its rooms as cards", async ({ page }) => {
  await page.goto('jugar/');
  const games = page.locator('.mg-games li');
  await expect(games.first()).toContainText('El Dojo');
  await expect(games.first().getByRole('link', { name: 'El Dojo' })).toHaveAttribute('href', /jugar\/dojo\/$/);
  expect(await games.count()).toBeGreaterThan(1);

  await page.goto('jugar/dojo/');
  // By groups, in order (stage 4a); every recipe has its card, in its group.
  const groups = page.locator('.mg-room-group');
  await expect(groups.locator('h3')).toHaveText([
    'Para empezar',
    'Las demostraciones',
    'El personaje',
    'El mundo que responde',
    'El motor por dentro',
  ]);
  const recipes = readdirSync(join(import.meta.dirname, '..', 'games', 'dojo', 'recipes')).filter((f) => f.endsWith('.txt'));
  await expect(page.locator('.mg-room-cards li')).toHaveCount(recipes.length);
  // In each group, the rooms with a character first: the course before the empty Dojo.
  const start = groups.first().locator('li');
  await expect(start.first()).toContainText('con personaje');
  await expect(start.first()).toContainText('load course');
  await expect(start.first().locator('a')).toHaveAttribute('href', /jugar\/dojo\/course\/$/);
  // The recipe is behind "ver la receta".
  await expect(start.first().locator('.mg-room-lines')).toBeHidden();
  await start.first().locator('summary').click();
  await expect(start.first().locator('.mg-room-lines')).toContainText('dojo.level course');
});

test("the Dojo's hint can be closed by hand, too", async ({ page }) => {
  await page.goto('jugar/dojo/rain/');
  await page.locator('#hint button').click();
  await expect(page.locator('#hint')).toBeHidden();
  await page.goto('jugar/dojo/empty/');
  await expect(page.locator('#game canvas')).toBeVisible();
  await expect(page.locator('#hint')).toBeHidden();
});
