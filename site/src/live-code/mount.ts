import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Prec } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { iframeDocument } from './iframe';
import { mountFullscreen } from './fullscreen';
import { importedLibraries, moduleName, transpile } from './transpile';

/**
 * A LIVE EXAMPLE (decision 0007): an editor with one file per tab, and when run, the code runs in
 * an isolated iframe below it, with its console.
 *
 * Only one runs at a time in the whole page: every 3D example uses a WebGL context (browsers allow
 * about 16, and an integrated GPU suffers with several). Running one stops the one that was
 * running: its iframe is removed, and its context with it.
 *
 * For the browser tests, the element writes its state in `data-` attributes: `state` (running /
 * stopped), `frames` (how many it drew) and `errors`.
 *
 * (What the reader sees, the iframe's title and the error texts, is the site's text, in Spanish.)
 */

/**
 * The workshop's colors on top of One Dark: warm charcoal instead of bluish gray, and a bronze
 * cursor. The code's colors (keywords, strings, numbers) are still One Dark's.
 * `Prec.high`: between two themes, the one with more precedence wins.
 */
const workshop = Prec.high(
  EditorView.theme(
    {
      '&': { backgroundColor: '#1a1714', color: '#dcd2c3' },
      '.cm-content': { caretColor: '#e9c48c' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#e9c48c' },
      '.cm-gutters': { backgroundColor: '#1a1714', color: '#6f6454', borderRight: '1px solid #2c2620' },
      '.cm-activeLine': { backgroundColor: '#221e19' },
      '.cm-activeLineGutter': { backgroundColor: '#221e19', color: '#b9a98f' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: '#41362a' },
    },
    { dark: true },
  ),
);

interface File {
  name: string;
  code: string;
  /** In a step of the tutorial's project: whether this step added or changed the file (decision 0021). */
  changed?: boolean;
}

interface Running {
  stop(): void;
}

let active: Running | null = null;

/** The vendored libraries (site/scripts/vendor.mjs): each one's file, and the libraries it imports itself. */
type Libraries = Record<string, { file: string; needs: string[] }>;

/**
 * The libraries (Three.js, Rapier...): each one fetched once per page, the first time a lesson
 * imports it (stage 1f: before, all of them, the first time anything ran; with Rapier, 4 MB more for
 * lessons that do not use it).
 */
let manifest: Promise<Libraries> | null = null;
const fetched = new Map<string, Promise<string>>();

async function loadLibraries(base: string, wanted: readonly string[]): Promise<Record<string, string>> {
  const get = async (file: string) => {
    const response = await fetch(`${base}/vendor/${file}`);
    if (!response.ok) throw new Error(`No se pudo cargar ${file} (${response.status})`);
    return response;
  };
  manifest ??= get('manifest.json').then((r) => r.json() as Promise<Libraries>);
  const libraries = await manifest;
  // What the lesson imports, and what those import in turn (the lab kit: three.js, its orbit controls and
  // lil-gui; an addon of three.js: three.js), as the vendoring wrote it down: the same modules for everyone.
  const needed = new Set<string>();
  const add = (s: string) => {
    if (needed.has(s) || !(s in libraries)) return;
    needed.add(s);
    for (const n of libraries[s]!.needs) add(n);
  };
  for (const s of wanted) add(s);
  const texts = await Promise.all(
    [...needed].map(async (specifier) => {
      if (!fetched.has(specifier))
        fetched.set(
          specifier,
          get(libraries[specifier]!.file).then((r) => r.text()),
        );
      return [specifier, await fetched.get(specifier)!] as const;
    }),
  );
  return Object.fromEntries(texts);
}

export function mountLiveCode(root: HTMLElement) {
  if (root.dataset.mounted) return;
  root.dataset.mounted = '1';
  const files = JSON.parse(root.dataset.files ?? '[]') as File[];
  const base = (root.dataset.base ?? '/').replace(/\/$/, '');
  const tabs = root.querySelector<HTMLElement>('.lc-tabs')!;
  const editorPlace = root.querySelector<HTMLElement>('.lc-editor')!;
  const result = root.querySelector<HTMLElement>('.lc-result')!;
  const cover = root.querySelector<HTMLButtonElement>('.lc-cover')!;
  const output = root.querySelector<HTMLElement>('.lc-console')!;
  const running: Running = { stop };

  // ---------- The editor: one state per file; the view shows the chosen tab's ----------
  const extensions = [
    Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => (void run(), true) }])),
    basicSetup,
    javascript({ typescript: true }),
    oneDark,
    workshop,
    EditorView.lineWrapping, // the editor is narrow: long lines continue below, with no horizontal bar
  ];
  // A tool of the book's (a project's `herramientas/`, docs/tutorial-v3.md §4): it makes the example work, it is not
  // the lesson, so it is read-only, and a note over it says so.
  const isTool = (f: File) => f.name.startsWith('herramientas/');
  const readOnly = [EditorState.readOnly.of(true), EditorView.editable.of(false)];
  const createState = (code: string, tool = false) =>
    EditorState.create({ doc: code, extensions: tool ? [...extensions, ...readOnly] : extensions });
  let states = files.map((f) => createState(f.code, isTool(f)));
  let current = 0;
  const view = new EditorView({ state: states[0], parent: editorPlace });
  const toolNote = root.querySelector<HTMLElement>('.lc-tool-note');

  const markTab = () => {
    tabs.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(i === current)));
    if (toolNote) toolNote.hidden = !(files[current] && isTool(files[current]));
  };
  files.forEach((f, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.textContent = f.name;
    if (isTool(f)) {
      button.classList.add('lc-tool');
      button.title = 'Herramienta del libro: no es parte de la lección';
    } else if (f.changed === false) {
      button.classList.add('lc-kept');
      button.title = 'Sin cambios en esta lección';
    }
    button.addEventListener('click', () => {
      states[current] = view.state;
      current = i;
      view.setState(states[i]!);
      markTab();
    });
    tabs.append(button);
  });
  markTab();

  // ---------- The console ----------
  let errors = 0;
  const write = (level: string, text: string) => {
    const line = document.createElement('div');
    line.className = `lc-line lc-${level}`;
    line.textContent = text;
    output.append(line);
    while (output.childElementCount > 200) output.firstElementChild?.remove();
    output.hidden = false;
    output.scrollTop = output.scrollHeight;
  };
  const reportError = (text: string) => {
    root.dataset.errors = String(++errors);
    write('error', `✖ ${text}`);
  };

  // ---------- Running ----------
  let iframe: HTMLIFrameElement | null = null;
  let modules: Record<string, string> | null = null;

  window.addEventListener('message', (e: MessageEvent) => {
    if (!iframe || e.source !== iframe.contentWindow || !e.data?.fromLiveCode) return;
    const m = e.data as { type: string; level?: string; text?: string; n?: number };
    if (m.type === 'ready' && modules) iframe.contentWindow?.postMessage({ type: 'run', modules }, '*');
    else if (m.type === 'console') write(m.level ?? 'log', m.text ?? '');
    else if (m.type === 'error') reportError(m.text ?? 'error');
    else if (m.type === 'frames') root.dataset.frames = String(m.n ?? 0);
  });

  async function run() {
    states[current] = view.state;
    active?.stop();
    output.replaceChildren();
    output.hidden = true;
    errors = 0;
    root.dataset.errors = '0';
    root.dataset.frames = '0';
    try {
      const own = Object.fromEntries(files.map((f, i) => [moduleName(f.name), transpile(states[i]!.doc.toString(), f.name)]));
      const wanted = Object.values(own).flatMap(importedLibraries);
      modules = { ...(await loadLibraries(base, wanted)), ...own };
    } catch (e) {
      // A syntax error shows up here, before anything runs.
      reportError((e as Error).message);
      return;
    }
    cover.hidden = true;
    iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.title = 'Lo que dibuja el código';
    iframe.srcdoc = iframeDocument();
    result.append(iframe);
    root.dataset.state = 'running';
    active = running;
  }

  function stop() {
    iframe?.remove();
    iframe = null;
    modules = null;
    cover.hidden = false;
    root.dataset.state = 'stopped';
    if (active === running) active = null;
  }

  root.querySelector('.lc-run')?.addEventListener('click', () => void run());
  cover.addEventListener('click', () => void run());
  root.querySelector('.lc-reset')?.addEventListener('click', () => {
    states = files.map((f) => createState(f.code, isTool(f)));
    view.setState(states[current]!);
  });

  mountFullscreen(root, {
    onEnter: () => {
      if (root.dataset.state !== 'running') void run();
      view.focus(); // to type right away
    },
  });

  // In the book (docs/tutorial-v3.md), the example in front of the reader is the one alive: each one that
  // `follows` the reading starts when most of it comes on screen, and stops the one that was running (only one
  // runs at a time). So a page with a figure every few paragraphs keeps one WebGL context, the one being read.
  // "On screen" is said of the drawing, not of the whole block: a project's block (its editor, its console) can
  // be taller than the window, and would never be mostly on screen. And only on the way in: the observer also
  // calls on the way out, while the drawing is still partly visible, and that must not take the run back from
  // the next one.
  if (root.dataset.follow) {
    const MOSTLY = 0.6;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.intersectionRatio >= MOSTLY) && root.dataset.state !== 'running') void run();
      },
      { threshold: MOSTLY },
    );
    observer.observe(result);
  } else if (root.dataset.autorun) {
    // A lesson's first example starts by itself when it shows up on screen (if nothing else is running).
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      if (!active) void run();
    });
    observer.observe(root);
  }
}
