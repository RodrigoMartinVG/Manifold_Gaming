// @ts-check
/**
 * THE ART, MADE AGAIN AND COMPARED (stage 5.5d, decision 0015): every `art:*` script of package.json run
 * headless into a temporary folder, and each file it writes compared, byte for byte, with the committed one.
 * The assets are made by scripts so that anyone can make them again; this says whether they still give the
 * same bytes (another Blender, a script edited without making its asset again). Blender: `$BLENDER`, or
 * where macOS installs it. With `--hashes`, it only writes each asset's hash into its `assets.json`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

const root = join(import.meta.dirname, '..');

// `--hashes`: writes each listed asset's hash into its `assets.json` (after making one again on purpose).
if (process.argv.includes('--hashes')) {
  const { createHash } = await import('node:crypto');
  const { writeFileSync } = await import('node:fs');
  for (const top of ['packages', 'games'])
    for (const dir of readdirSync(join(root, top))) {
      const list = join(root, top, dir, 'assets', 'assets.json');
      if (!existsSync(list)) continue;
      /** @type {Record<string, { sha256?: string }>} */
      const entries = JSON.parse(readFileSync(list, 'utf8'));
      for (const [file, entry] of Object.entries(entries))
        entry.sha256 = createHash('sha256')
          .update(readFileSync(join(dirname(list), file)))
          .digest('hex');
      writeFileSync(list, JSON.stringify(entries, null, 2) + '\n');
      console.log(`${list.slice(root.length + 1)}: ${Object.keys(entries).join(', ')}`);
    }
  process.exit(0);
}
const blender = process.env.BLENDER ?? '/Applications/Blender.app/Contents/MacOS/Blender';
/** @type {Record<string, string>} */
const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts;
const jobs = Object.entries(scripts)
  .filter(([name]) => name.startsWith('art:') && name !== 'art:check')
  .map(([name, command]) => {
    const m = /--python (\S+) -- (\S+)$/.exec(command);
    if (!m) throw new Error(`${name}: not "… --python <script> -- <output>"`);
    return { name, script: m[1], output: m[2] };
  });
let different = 0;
for (const { name, script, output } of jobs) {
  const folder = mkdtempSync(join(tmpdir(), 'manifold-art-'));
  execFileSync(blender, ['--background', '--factory-startup', '--python', script, '--', join(folder, basename(output))], {
    cwd: root,
    stdio: 'ignore',
  });
  // Each file it wrote beside its output (the kit writes kit.json too), against the committed one.
  for (const file of readdirSync(folder)) {
    const committed = join(root, dirname(output), file);
    const same = existsSync(committed) && readFileSync(committed).equals(readFileSync(join(folder, file)));
    if (!same) different++;
    console.log(`${same ? '✓' : '✗'} ${name.padEnd(14)} ${join(dirname(output), file)}${same ? '' : ': other bytes'}`);
  }
}
console.log(different ? `\n${different} file(s) with other bytes` : '\nevery asset, the same bytes');
process.exit(different ? 1 : 0);
