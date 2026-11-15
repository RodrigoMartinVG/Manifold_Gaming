import type { CommandInfo } from '@manifold/commands';
import type { World } from '@manifold/core';
import type { Bodies } from './bodies';
import { overlay, type GamePage, type Piece } from './page';

/** What looking inside the world lets people do, as data (the site's console reference reads it). */
export const INSPECT_COMMANDS = {
  inspect: {
    name: 'inspect',
    description:
      'What an entity is made of: its components, with their numbers (a click on an object does it too). Its id, its name (a level gives names: `inspect floor`), `me` (your character) or `it` (the last one inspected or clicked). With nothing: how many entities there are, and their names.',
    args: [{ name: 'id', type: { kind: 'text' }, optional: true }],
  },
  watch: {
    name: 'watch',
    description:
      'Pins an entity on the screen, its values updated while you play (the console can be closed): `watch me`, or what to show, `watch me character.mode character.ground`. Its id, its name, `me` or `it`. `watch clear` takes them all away; with nothing, what is watched.',
    args: [
      { name: 'entity', type: { kind: 'text' }, optional: true },
      { name: 'what', type: { kind: 'rest' }, optional: true },
    ],
  },
} as const satisfies Record<string, CommandInfo>;

/**
 * LOOKING INSIDE THE WORLD: `inspect` (what an entity is made of), `watch` (entities pinned on the
 * screen, their values updated while playing, stage 2d) and, if the game wants it (a lab's), a click
 * on an object inspects it in the console. An entity is named by its id, its name (stage 3b: a
 * level's `name door_north`), `me` (this page's player's character) or `it` (the last one inspected,
 * clicked or watched).
 */
export function mountInspect(
  page: GamePage,
  bodies: Bodies,
  o: {
    /** Whether a click on an object inspects it. */
    click: boolean;
    /** Whether someone else takes the click now (aiming, a click takes the mouse). */
    clickTaken(): boolean;
  },
): Piece {
  const box = overlay(page.container, 'mg-watch', {
    position: 'absolute',
    bottom: '56px',
    right: '12px',
    maxWidth: '46ch',
    padding: '6px 10px',
    borderRadius: '6px',
    background: 'rgb(18 16 13 / 0.82)',
    color: '#e6dccb',
    font: '12px/1.5 ui-monospace, Menlo, monospace',
    pointerEvents: 'none',
    whiteSpace: 'pre-wrap',
  });
  /** The watched entities, and what of each (`character.mode`…); nothing: a few useful things. */
  const watched: { id: number; paths: string[] }[] = [];
  /** The last entity inspected, clicked or watched: what `it` names. */
  let it: number | null = null;
  /** An entity by what is typed: its id, its name, `me` or `it`; or why not. */
  const entityNamed = (word: string): number | string => {
    const world = page.session.world;
    if (word === 'me') {
      const mine = page.player();
      return mine ? mine.id : 'you have no character here (`me` is your character: try a room with one, like `load course`)';
    }
    if (word === 'it') return it ?? 'nothing inspected yet: click an object, or `inspect` an id (`it` is the last one)';
    if (/^\d+$/.test(word)) {
      const id = Number(word);
      return world.entities.has(id) ? id : `no entity ${id} (there are ${world.entities.size}: \`inspect\` counts them)`;
    }
    const named = world.named(word);
    if (named) return named.id;
    return `no entity named "${word}": an id (a whole number), a name, \`me\` or \`it\` (\`inspect\` lists the names)`;
  };

  page.registry.declareCommand({
    ...INSPECT_COMMANDS.inspect,
    run: ([which], out) => {
      if (which === undefined || which === '') return out.write(countEntities(page.session.world));
      const id = entityNamed(String(which));
      if (typeof id === 'string') return out.write(id, 'warn');
      it = id;
      out.write(inspectEntity(page.session.world, id));
    },
  });
  page.registry.declareCommand({
    ...INSPECT_COMMANDS.watch,
    run: ([which, what], out) => {
      if (which === undefined || which === '') {
        if (watched.length === 0) return out.write('nothing watched: `watch me`, or `watch 1 transform.position`');
        return out.write(watched.map((w) => `watching ${w.id}${w.paths.length ? ` ${w.paths.join(' ')}` : ''}`).join('\n'));
      }
      if (which === 'clear') {
        watched.length = 0;
        box.hidden = true;
        return out.write('nothing watched any more');
      }
      const id = entityNamed(String(which));
      if (typeof id === 'string') return out.write(id, 'warn');
      it = id;
      const paths = String(what ?? '')
        .split(/\s+/)
        .filter(Boolean);
      const known = watched.find((w) => w.id === id);
      if (known) known.paths = paths;
      else watched.push({ id, paths });
      box.hidden = false;
      out.write(`watching entity ${id}${paths.length ? `: ${paths.join(', ')}` : ''} (\`watch clear\` takes it away)`);
    },
  });

  // A click (not a drag: dragging turns the camera) on an object inspects it in the console.
  const canvas = page.stage.renderer.domElement;
  let down: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => (down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null);
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    if (o.clickTaken() || !page.console) return;
    const rect = canvas.getBoundingClientRect();
    const id = bodies.entityAt(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    if (id === undefined) return;
    it = id;
    page.console.open();
    page.console.run(`inspect ${id}`);
  };
  if (o.click) {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
  }

  return {
    // What is watched, on every frame: it is for seeing a value change while playing.
    afterRender({ world }) {
      if (!box.hidden) box.textContent = watched.map((w) => describeWatched(world, w.id, w.paths)).join('\n');
    },
    stop() {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      box.remove();
    },
  };
}

/** A number for reading: three decimals at most, and no "-0" or "1e-17". */
const readable = (n: number) => (Math.abs(n) < 5e-4 ? '0' : String(+n.toFixed(3)));

/** A component's value, in one line: numbers rounded, vectors as "x y z", nested parts in braces, colors in hex. */
function describeValue(v: unknown, key = ''): string {
  if (typeof v === 'number') return key === 'color' ? `#${v.toString(16).padStart(6, '0')}` : readable(v);
  if (Array.isArray(v)) return v.map((x) => describeValue(x)).join(' ');
  if (v && typeof v === 'object')
    return Object.entries(v)
      .map(([k, x]) =>
        x && typeof x === 'object' && !Array.isArray(x) ? `${k} {${describeValue(x)}}` : `${k} ${describeValue(x, k)}`,
      )
      .join(' · ');
  return String(v);
}

/** An entity, component by component (whatever components it has: new ones show up by themselves). */
function inspectEntity(world: World, id: number): string {
  const e = world.entities.get(id);
  if (!e) return `no entity ${id} (there are ${world.entities.size}: \`inspect\` counts them)`;
  const lines = [`entity ${id}${e.name ? ` (${e.name})` : ''}, at step ${world.tick}`];
  for (const [k, v] of Object.entries(e)) if (k !== 'id' && k !== 'name') lines.push(`  ${k.padEnd(11)}${describeValue(v)}`);
  return lines.join('\n');
}

/**
 * A watched entity, for its box on the screen (`watch`): the values asked for, by their path in its
 * components (`character.mode`); with none asked, where it is, and if it is a character, its mode,
 * its velocity, whether it stands, and what it stands on.
 */
function describeWatched(world: World, id: number, paths: readonly string[]): string {
  const e = world.entities.get(id);
  if (!e) return `entity ${id}: gone`;
  const shown = paths.length
    ? paths
    : [
        'transform.position',
        ...(e.character ? ['character.mode', 'character.velocity', 'character.grounded', 'character.ground'] : []),
      ];
  const valueAt = (path: string) =>
    path
      .split('.')
      .reduce<unknown>((at, key) => (at && typeof at === 'object' ? (at as Record<string, unknown>)[key] : undefined), e);
  return [
    `entity ${id}${e.name ? ` (${e.name})` : ''} · step ${world.tick}`,
    ...shown.map((path) => {
      const value = valueAt(path);
      return `  ${path} ${value === undefined ? '(none)' : describeValue(value, path.split('.').pop())}`;
    }),
  ].join('\n');
}

/** How many entities there are, by the kind of body they have. */
function countEntities(world: World): string {
  const kinds = new Map<string, number>();
  for (const e of world.entities.values()) {
    const kind = e.body?.type ?? 'without a body';
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  const parts = [...kinds].map(([k, n]) => `${n} ${k}`).join(', ');
  const names = [...world.entities.values()].flatMap((e) => (e.name ? [e.name] : []));
  const named = names.length ? ` Named: ${names.join(', ')}.` : '';
  return `${world.entities.size} entities: ${parts}.${named} A click on an object inspects it, or \`inspect 1\`.`;
}
