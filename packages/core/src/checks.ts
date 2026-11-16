import type { Output, Registry, Value } from '@manifold/commands';
import { entityNamed } from './building';
import type { World } from './world';

/** How close `~` asks two numbers to be: within a hundredth, or a percent of the bigger, whichever is more. */
const NEAR = 0.01;

/**
 * What a check reads (stage 3j): a variable (`physics.gravity`), a signal (`signal.open`), or a value
 * of an entity, by its id or name and its way in (`crate.transform.position.y`: `x`, `y`, `z` are a
 * vector's numbers; a number, a list's). Undefined if there is nothing there, with why.
 */
export function readValue(
  registry: Registry<World>,
  world: World | undefined,
  what: string,
): Value | number[] | { missing: string } {
  if (registry.variables().some((v) => v.decl.name === what)) return registry.value(what);
  if (!world) return { missing: 'there is no world yet' };
  if (what.startsWith('signal.')) {
    const name = what.slice('signal.'.length);
    const s = world.signals.find((x) => x.name === name);
    return s ? s.value : { missing: `no signal "${name}"` };
  }
  const [which, ...path] = what.split('.');
  const e = entityNamed(world, which ?? '');
  if (!e) return { missing: `no variable, signal or entity "${which}"` };
  let at: unknown = e;
  for (const key of path) {
    const index = key === 'x' ? 0 : key === 'y' ? 1 : key === 'z' ? 2 : /^\d+$/.test(key) ? Number(key) : null;
    if (Array.isArray(at) && index !== null) at = at[index];
    else if (at && typeof at === 'object' && !Array.isArray(at)) at = (at as Record<string, unknown>)[key];
    else at = undefined;
    if (at === undefined) return { missing: `${what}: nothing there` };
  }
  if (typeof at === 'number' || typeof at === 'boolean' || typeof at === 'string') return at;
  if (Array.isArray(at) && at.every((x) => typeof x === 'number')) return at as number[];
  return { missing: `${what} is not a value (a number, numbers, yes or no, a word)` };
}

/** A value as the console writes it: numbers rounded to 3 decimals. */
const written = (v: Value | number[]) =>
  Array.isArray(v) ? v.map((n) => +n.toFixed(3)).join(' ') : typeof v === 'number' ? String(+v.toFixed(3)) : String(v);

/**
 * WHAT A RECIPE CHECKS (stage 3j): `assert <what> <op> <value>`, with `=`, `!=`, `<`, `>`, `<=`, `>=`
 * or `~` (near: within a hundredth, or a percent). `assert crate.transform.position.y < 1`; `assert
 * signal.open = 1`; `assert physics.gravity ~ 0 -9.81 0`. It says yes, or no and what it is: a recipe
 * with `wait` and `assert` is a test (in a link, a lesson that checks itself).
 */
export function declareChecks(registry: Registry<World>) {
  registry.declareCommand({
    name: 'wait',
    description:
      'In a recipe, or a line with more after it (stage 3j): what comes after runs that many steps later (`wait 60`: a second). `add box 0 3 0  0.2 0.2 0.2  dynamic; wait 60; assert …`.',
    args: [{ name: 'steps', type: { kind: 'integer', min: 0 } }],
    inRecipes: true,
    // (The registry itself waits: this one is only what is said when nothing comes after it.)
    run: (_, out) => out.write('wait: nothing after it to wait for'),
  });
  registry.declareCommand({
    name: 'assert',
    description:
      "Checks something (stage 3j): `assert crate.transform.position.y < 1`, `assert signal.open = 1`, `assert physics.gravity ~ 0 -9.81 0` (`=`, `!=`, `<`, `>`, `<=`, `>=`, `~` near). A variable, a signal, or an entity's value by its id or name. Says yes, or no and what it is: with `wait`, a recipe is a test.",
    args: [{ name: 'check', type: { kind: 'rest' } }],
    inRecipes: true,
    run: ([check], out) => void assertThat(registry, String(check), out),
  });
}

/** One check, said: whether it holds. */
export function assertThat(registry: Registry<World>, check: string, out: Output): boolean {
  const words = check.trim().split(/\s+/);
  const [what, op, ...expected] = words;
  const OPS = ['=', '!=', '<', '>', '<=', '>=', '~'];
  if (!what || !op || !OPS.includes(op) || expected.length === 0) {
    out.write(`assert: \`assert <what> <${OPS.join(' ')}> <value>\`, like \`assert crate.transform.position.y < 1\``, 'error');
    return false;
  }
  const got = readValue(registry, registry.world?.(), what);
  if (typeof got === 'object' && !Array.isArray(got)) {
    out.write(`assert ${check}: ${got.missing}`, 'error');
    return false;
  }
  const holds = compare(got, op, expected);
  if (holds === null) {
    out.write(`assert ${check}: ${what} is ${written(got)}, which cannot be compared with that`, 'error');
    return false;
  }
  if (holds) out.write(`assert ${check}: yes`);
  else out.write(`assert ${check}: no, it is ${written(got)}`, 'error');
  return holds;
}

/** Whether a value compares as asked with what is written (null: it cannot be compared that way). */
function compare(got: Value | number[], op: string, words: string[]): boolean | null {
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(NEAR, NEAR * Math.max(Math.abs(a), Math.abs(b)));
  if (typeof got === 'number') {
    if (words.length !== 1 || !Number.isFinite(Number(words[0]))) return null;
    const b = Number(words[0]);
    return op === '='
      ? got === b
      : op === '!='
        ? got !== b
        : op === '<'
          ? got < b
          : op === '>'
            ? got > b
            : op === '<='
              ? got <= b
              : op === '>='
                ? got >= b
                : near(got, b);
  }
  if (Array.isArray(got)) {
    const b = words.map(Number);
    if (b.length !== got.length || b.some((n) => !Number.isFinite(n))) return null;
    if (op === '=') return got.every((n, i) => n === b[i]);
    if (op === '!=') return got.some((n, i) => n !== b[i]);
    if (op === '~') return got.every((n, i) => near(n, b[i]!));
    return null;
  }
  if (op !== '=' && op !== '!=') return null;
  const b = typeof got === 'boolean' ? ['on', 'true', 'yes', '1'].includes(words[0]!) : words.join(' ');
  return op === '=' ? got === b : got !== b;
}
