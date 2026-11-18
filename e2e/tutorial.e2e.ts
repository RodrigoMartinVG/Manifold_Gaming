import { expect, test, type Locator, type Page } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * THE TUTORIAL, TESTED (decision 0007): every example of every lesson runs in Chromium and has to
 * work without errors. If a Three.js update (or a change of ours) breaks a lesson, it shows here,
 * before it is published, and a reader does not find it.
 *
 * The site's texts are in Spanish (decision 0011): its addresses and labels are looked for in Spanish.
 */
const DOCS = join(import.meta.dirname, '..', 'site', 'src', 'content', 'docs');

/** The tutorial's chapters, as addresses: `tutorial/dibujar/01-la-pantalla/`... (the book, decision 0030). */
function tutorialLessons(): string[] {
  const pages: string[] = [];
  const walk = (folder: string) => {
    for (const e of readdirSync(folder, { withFileTypes: true })) {
      const file = join(folder, e.name);
      if (e.isDirectory()) walk(file);
      else if (/\.mdx?$/.test(e.name))
        pages.push(
          relative(DOCS, file)
            .replace(/(index)?\.mdx?$/, '')
            .replace(/\/?$/, '/'),
        );
    }
  };
  walk(join(DOCS, 'tutorial'));
  // (The book's first page, the map and the syllabus, has no example.)
  return pages.filter((p) => p !== 'tutorial/').sort();
}

/**
 * Runs an example and waits until it works: an example that animates (its code asks for frames) has
 * to DRAW 20 frames; writing to the console is not enough (an example that wrote and then never drew
 * passed before). One that does not animate has to write to the console.
 */
async function runAndWait(example: Locator) {
  // (A figure in the book shows only what it draws, and starts when it comes on screen; if it does not, its cover.)
  if (await example.getAttribute('data-figure')) {
    await example.locator('.lc-result').scrollIntoViewIfNeeded();
    try {
      await expect(example).toHaveAttribute('data-state', 'running', { timeout: 3000 });
    } catch {
      await example.locator('.lc-cover').click();
    }
  } else await example.locator('.lc-run').click();
  // Chrome gives no frames to a cross-origin iframe that is off screen.
  await example.locator('.lc-result').scrollIntoViewIfNeeded();
  await expect(example).toHaveAttribute('data-state', 'running');
  const animates = (await example.getAttribute('data-animates')) === '1';
  await expect
    .poll(
      async () =>
        animates
          ? Number(await example.getAttribute('data-frames')) >= 20
          : (await example.locator('.lc-console .lc-line').count()) > 0,
      { timeout: 20_000 },
    )
    .toBe(true);
}

/** Replaces the code of the file open in the editor, typing like a person. */
async function typeCode(page: Page, example: Locator, code: string) {
  await example.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

for (const lesson of tutorialLessons()) {
  test(`every example of ${lesson} runs without errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(lesson);
    const examples = page.locator('.live-code');
    const count = await examples.count();
    expect(count, 'a lesson without code is not a lesson').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const example = examples.nth(i);
      await runAndWait(example);
      const output = await example.locator('.lc-console').innerText();
      expect(await example.getAttribute('data-errors'), `errors in the example's console:\n${output}`).toBe('0');
    }
    expect(errors).toEqual([]);
  });
}

/** A chapter's project: the example with its code in an editor (not a figure, whose code is a click away). */
const projectOf = (page: Page) => page.locator('.live-code:not([data-figure])').first();

test('a page only fetches the libraries it imports: chapter 1, in the plane, never three.js nor Rapier (4 MB)', async ({
  page,
}) => {
  const fetched: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/vendor/')) fetched.push(r.url().split('/vendor/')[1]!);
  });
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  await runAndWait(page.locator('.live-code').first());
  // The figures' kit in the plane, and the panel it needs (vendor.mjs wrote that it needs it).
  expect(fetched).toContain('lab-plane.js');
  expect(fetched).toContain('lil-gui.js');
  expect(fetched).not.toContain('three.js');
  expect(fetched).not.toContain('rapier.js');
});

test('every address the earlier tutorials had lands on the book’s first page, with the site’s base', async ({
  page,
  baseURL,
}) => {
  for (const old of [
    // The first tutorial, archived (decision 0021), at its archive's address and at the one it had before...
    'tutorial/archivo/etapa-0/01-primer-cubo/',
    'tutorial/etapa-0/01-primer-cubo/',
    'tutorial/archivo/',
    'tutorial/glosario/',
    // ...with stage 1's lessons that took other places in the deeper pass (decision 0013)...
    'tutorial/etapa-1/02-repeticiones/',
    // ...the second one, its pages and its pilot...
    'tutorial/parte-1/04-vectores/',
    'tutorial/notacion/',
    'tutorial-nuevo/parte-1/04-vectores/',
  ]) {
    await page.goto(old);
    // The whole address, with the site's base: a redirect without it leaves the site.
    await expect(page, old).toHaveURL(`${baseURL}tutorial/`);
    await expect(page.locator('h1')).toHaveText('Construir un mundo');
  }
});

test('the tutorial’s first page is the book’s: its map and its syllabus, no example, and the way to chapter 1', async ({
  page,
}) => {
  await page.goto('tutorial/');
  await expect(page.locator('h1')).toHaveText('Construir un mundo');
  await expect(page.locator('.live-code')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'El temario' })).toBeVisible();
  await page.getByRole('link', { name: 'La pantalla' }).first().click();
  await expect(page.locator('h1')).toHaveText('La pantalla');
});

test('a figure is to look at, not to read: no code, a caption; the project’s tools are last, read-only, and say so', async ({
  page,
}) => {
  // (docs/tutorial-v3.md §4: a figure, the reader's code after its consigna, and the book's tools apart.)
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  const figures = page.locator('.live-code[data-figure]');
  expect(await figures.count()).toBe(5);
  for (let i = 0; i < 5; i++) {
    const figure = figures.nth(i);
    await expect(figure.locator('.lc-editor')).toBeHidden();
    await expect(figure.locator('.lc-bar')).toBeHidden();
    await expect(figure.locator('.lc-caption')).toBeVisible();
    await expect(figure.locator('.lc-source')).toHaveAttribute('href', /\/site\/src\/lessons\/libro\//);
  }
  await expect(figures.first().locator('.lc-caption')).toContainText('Mové las tres luces');

  // The project: the consigna before it; the reader's files first, the book's tools last.
  const project = projectOf(page);
  await expect(page.locator('.mg-consigna')).toHaveCount(1);
  const tabs = project.locator('.lc-tabs button');
  expect(await tabs.allTextContents()).toEqual([
    'main.ts',
    'screen.ts',
    'sky.ts',
    'herramientas/panel.ts',
    'herramientas/random.ts',
    'herramientas/view.ts',
  ]);
  const note = project.locator('.lc-tool-note');
  await expect(note).toBeHidden();
  await tabs.last().click();
  await expect(tabs.last()).toHaveClass(/lc-tool/);
  await expect(note).toBeVisible();
  // Read-only: the editor does not take what is typed.
  await expect(project.locator('.cm-content')).toHaveAttribute('contenteditable', 'false');
  await tabs.first().click();
  await expect(note).toBeHidden();
  await expect(project.locator('.cm-content')).toHaveAttribute('contenteditable', 'true');
});

test('editing the code and running it; an error shows up with its file and its line', async ({ page }) => {
  // (Chapter 1's project: its main.ts writes how big the sky is.)
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  const example = projectOf(page);
  await typeCode(page, example, "console.log('edited in the test', { x: 1.23456789 });");
  await example.locator('.lc-run').click();
  await expect(example.locator('.lc-console')).toContainText('edited in the test {"x":1.2346}');

  await typeCode(page, example, "const x = 1;\nthrow new Error('on purpose ' + x);");
  await page.keyboard.press('ControlOrMeta+Enter'); // the shortcut runs it too
  await expect(example.locator('.lc-console')).toContainText('on purpose 1 (main.ts, línea 2)');
  await expect(example).toHaveAttribute('data-errors', '1');

  // ↺ Restaurar (reset) brings back the original code, which works.
  await example.locator('.lc-reset').click();
  await runAndWait(example);
  await expect(example.locator('.lc-console')).toContainText('A sky of 160 × 90 pixels');
});

test('full screen: the code and what it draws, side by side, without restarting the example', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  const example = projectOf(page);
  await runAndWait(example);
  // If the iframe moved in the page, the browser would reload it: its navigations are counted.
  let reloads = 0;
  page.on('framenavigated', (frame) => frame !== page.mainFrame() && reloads++);

  await example.locator('.lc-expand').click();
  await expect(example).toHaveAttribute('data-expanded', /^(screen|window)$/);
  await expect(example.locator('.lc-expand')).toHaveAttribute('aria-pressed', 'true');
  // It takes the screen, with the code to the left of what it draws.
  const editor = (await example.locator('.lc-editor').boundingBox())!;
  const result = (await example.locator('.lc-result').boundingBox())!;
  expect(editor.x + editor.width).toBeLessThanOrEqual(result.x);
  expect(result.x + result.width).toBeGreaterThan(1270);
  expect(result.height).toBeGreaterThan(650);
  // It is the same example as before, still running (the sky draws when something changes: no frames to count).
  await expect(example).toHaveAttribute('data-state', 'running');
  expect(reloads).toBe(0);

  // The divider, with the keyboard: twice → it gives the code 10 % more.
  const divider = example.locator('.lc-divider');
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '52');
  const widerEditor = (await example.locator('.lc-editor').boundingBox())!;
  expect(widerEditor.width).toBeGreaterThan(editor.width + 100);

  await example.locator('.lc-expand').click();
  await expect(example).not.toHaveAttribute('data-expanded');
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  expect(reloads).toBe(0);
});

test('without full screen (like on the iPhone), the example takes the window, and Esc brings it back', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false }));
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  const example = projectOf(page);
  await example.locator('.lc-expand').click();
  await expect(example).toHaveAttribute('data-expanded', 'window');
  const box = (await example.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect([box.x, box.y, box.width, box.height]).toEqual([0, 0, viewport.width, viewport.height]);
  await page.keyboard.press('Escape');
  await expect(example).not.toHaveAttribute('data-expanded');
});

test('the side panels hide and are remembered, and the example uses the width that is left', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('tutorial/dibujar/01-la-pantalla/');
  const example = projectOf(page);
  const sidebar = page.locator('header .mg-panels .mg-panel[data-panel="sidebar"]');
  const toc = page.locator('header .mg-panels .mg-panel[data-panel="toc"]');
  // (The page's text column, Starlight's; a note in the margin opens one of its own inside it.)
  const column = (await page.locator('.sl-container > .sl-markdown-content').boundingBox())!.width;
  expect((await example.boundingBox())!.width).toBeLessThan(column + 40);

  await sidebar.click();
  await toc.click();
  await expect(page.locator('.sidebar-pane')).toBeHidden();
  await expect(page.locator('.right-sidebar-container')).toBeHidden();
  // The example breaks out of the text's column, and puts the code and what it draws side by side.
  await expect(example).toHaveAttribute('data-side-by-side', '');
  expect((await example.boundingBox())!.width).toBeGreaterThan(1300);
  const editor = (await example.locator('.lc-editor').boundingBox())!;
  const result = (await example.locator('.lc-result').boundingBox())!;
  expect(editor.x + editor.width).toBeLessThanOrEqual(result.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);

  // On another page they are still hidden (it is remembered), until they are shown again.
  await page.goto('tutorial/dibujar/02-lineas/');
  await expect(page.locator('.sidebar-pane')).toBeHidden();
  await expect(sidebar).toHaveAttribute('aria-pressed', 'false');
  await sidebar.click();
  await toc.click();
  await expect(page.locator('.sidebar-pane')).toBeVisible();
  await expect(page.locator('.right-sidebar-container')).toBeVisible();

  // They also hide with the "Ocultar" (hide) button each panel has at the top.
  await page.locator('.sidebar-pane .mg-hide').click();
  await page.locator('.right-sidebar .mg-hide').click();
  await expect(page.locator('.sidebar-pane')).toBeHidden();
  await expect(page.locator('.right-sidebar-container')).toBeHidden();
  await expect(sidebar).toHaveAttribute('aria-pressed', 'false');

  // And they can always be shown again with the tabs at the screen's edge.
  await page.locator('header .mg-show-sidebar').click();
  await page.locator('header .mg-show-toc').click();
  await expect(page.locator('.sidebar-pane')).toBeVisible();
  await expect(page.locator('.right-sidebar-container')).toBeVisible();
  await expect(page.locator('header .mg-show-sidebar')).toBeHidden();
});
