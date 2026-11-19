// @ts-check
/**
 * THE TYPE CHECK, IN PARALLEL (stage 5.5d, decision 0033): every workspace's own `check` (its `tsc`, the
 * site's `astro check`), and the configurations of the browser tests, the performance budgets and the
 * repository's own files, side by side, as many at once as this machine has cores. Before, one after another:
 * 77 s. Each `tsc` is incremental (`tsconfig.base.json`): after a change, only what it touches is checked again.
 * What failed is printed whole; the rest, a line each with its time.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
/** @type {string[]} */
const globs = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).workspaces;
const workspaces = globs.flatMap((glob) =>
  glob.endsWith('/*')
    ? readdirSync(join(root, glob.slice(0, -2)))
        .map((d) => `${glob.slice(0, -2)}/${d}`)
        .filter((d) => existsSync(join(root, d, 'package.json')))
    : [glob],
);
/** @type {{ name: string; command: string; cwd: string }[]} */
const jobs = [
  ...workspaces
    .filter((d) => JSON.parse(readFileSync(join(root, d, 'package.json'), 'utf8')).scripts?.check)
    .map((d) => ({ name: d, command: 'npm run check --silent', cwd: join(root, d) })),
  ...['e2e/tsconfig.json', 'perf/tsconfig.json', 'tsconfig.repo.json'].map((p) => ({
    name: p,
    command: `npx tsc -p ${p}`,
    cwd: root,
  })),
];

/** @returns {Promise<{ name: string; ok: boolean; seconds: number; output: string }>} */
const run = ({ name, command, cwd }) =>
  new Promise((resolve) => {
    const start = performance.now();
    const child = spawn(command, { cwd, shell: true, env: process.env });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => resolve({ name, ok: code === 0, seconds: (performance.now() - start) / 1000, output }));
  });

const start = performance.now();
const queue = [...jobs];
/** @type {Awaited<ReturnType<typeof run>>[]} */
const results = [];
await Promise.all(
  Array.from({ length: Math.min(availableParallelism(), jobs.length) }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) results.push(await run(job));
  }),
);
for (const r of results.sort((a, b) => b.seconds - a.seconds))
  console.log(`${r.ok ? '✓' : '✗'} ${r.name.padEnd(24)} ${r.seconds.toFixed(1)} s`);
const failed = results.filter((r) => !r.ok);
for (const r of failed) console.log(`\n── ${r.name} ──\n${r.output.trim()}`);
console.log(`\n${results.length - failed.length} of ${results.length} in ${((performance.now() - start) / 1000).toFixed(1)} s`);
process.exit(failed.length ? 1 : 0);
