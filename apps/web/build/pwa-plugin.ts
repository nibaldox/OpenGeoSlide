import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Lo que no entra en el build ni en el hash: el propio service worker y los mapas de fuentes. */
const EXCLUDE = [/^sw\.js$/, /\.map$/];
/** Lo que no se precachea (sí entra en el hash de la versión): las fuentes del informe, que se piden bajo demanda. */
const NOT_PRECACHED = [/^fonts\//];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Genera `dist/sw.js` a partir de `build/sw-template.js` con la lista de archivos del build.
 * La versión es un hash del contenido de todos los archivos del build (fuentes del informe incluidas, aunque no se
 * precacheen): cambia solo si cambia algo, y versiona tanto el precache como el caché de fuentes.
 */
export function pwaPrecache(): Plugin {
  let outDir = 'dist';
  return {
    name: 'ogs-pwa-precache',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const built = walk(outDir)
        .map((f) => relative(outDir, f).split(sep).join('/'))
        .filter((f) => !EXCLUDE.some((re) => re.test(f)))
        .sort();
      const hash = createHash('sha256');
      for (const f of built) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const files = built.filter((f) => !NOT_PRECACHED.some((re) => re.test(f)));
      // Las rutas van relativas al alcance del service worker, así que valen bajo cualquier `base`.
      const template = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8');
      if (!template.includes("'__VERSION__'") || !template.includes('= __PRECACHE__;')) {
        throw new Error('[pwa] sw-template.js no contiene los marcadores esperados');
      }
      const sw = template
        .replace("'__VERSION__'", () => JSON.stringify(version))
        .replace('= __PRECACHE__;', () => `= ${JSON.stringify(files, null, 2)};`);
      writeFileSync(join(outDir, 'sw.js'), sw);
      console.log(`[pwa] sw.js: ${files.length} archivos en el precache, versión ${version}`);
    },
  };
}
