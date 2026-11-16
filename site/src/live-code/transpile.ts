import { transform } from 'sucrase';

/**
 * From TypeScript to JavaScript, in the browser (decision 0007).
 *
 * The browser does not understand TypeScript. Sucrase REMOVES the types (it does not check them:
 * the compiler does that in the repository, and continuous integration) and leaves everything else
 * in place, even the line numbers: an error on line 12 in the browser is line 12 of the editor.
 */

/** How a lesson's files are named in the import map: `lesson/main`, `lesson/view`... */
export const LESSON_PREFIX = 'lesson/';

export function moduleName(file: string): string {
  return LESSON_PREFIX + file.replace(/\.(ts|js)$/, '');
}

/**
 * Imports between a lesson's files (`./view`, `./view/screen.ts`, `../world` from inside `view/`) are
 * renamed by where the file they name is, from the lesson's root: `lesson/view`, `lesson/view/screen`,
 * `lesson/world`. In the iframe every file is a loose module (a `blob:`), and a `blob:` has no folder to
 * resolve `./` against. With a fixed name, the import map finds it. `from` is the importing file's name.
 */
export function rewriteImports(js: string, from = 'main.ts'): string {
  return js.replace(
    /(\bfrom\s*|\bimport\s*\(?\s*)(['"])(\.\.?\/[\w\-/.]+?)(?:\.ts|\.js)?\2/g,
    (whole: string, before: string, quote: string, spec: string) => {
      const name = resolve(from, spec);
      // (Out of the lesson's root, it is left as written: it names nothing the lesson has.)
      return name === null ? whole : `${before}${quote}${LESSON_PREFIX}${name}${quote}`;
    },
  );
}

/**
 * `resolve('view/view.ts', '../world')` → `world`: a relative path, from the importing file's folder; null if
 * it climbs out of the lesson's root.
 */
function resolve(from: string, spec: string): string | null {
  const parts = from.split('/').slice(0, -1);
  for (const segment of spec.split('/')) {
    if (segment === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else if (segment !== '.' && segment !== '') parts.push(segment);
  }
  return parts.join('/');
}

/**
 * The libraries a lesson's code imports (stage 1f): `three`, `three/addons/…`, the physics engine…
 * Not its own files (`lesson/…`). Only those are fetched: Rapier weighs 4 MB, and the lessons that do
 * not use it should not wait for it.
 */
export function importedLibraries(js: string): string[] {
  const found = new Set<string>();
  for (const m of js.matchAll(/\b(?:from|import)\s*\(?\s*(['"])([^'"]+)\1/g)) {
    const specifier = m[2]!;
    if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.startsWith(LESSON_PREFIX)) found.add(specifier);
  }
  return [...found].sort();
}

/** A lesson's file, from TypeScript to JavaScript; `file` is its name (`view/view.ts`), for its imports. */
export function transpile(code: string, file = 'main.ts'): string {
  const { code: js } = transform(code, { transforms: ['typescript'], disableESTransforms: true });
  return rewriteImports(js, file);
}
