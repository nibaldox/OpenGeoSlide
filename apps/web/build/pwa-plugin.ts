import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/** Lo que NO se precachea: el propio service worker, mapas de fuentes y las fuentes del informe (bajo demanda). */
const EXCLUDE = [/^sw\.js$/, /\.map$/, /^fonts\//];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Genera `dist/sw.js` a partir de `build/sw-template.js` con la lista de archivos del build.
 * La versión del caché es un hash del contenido de cada archivo precacheado: cambia solo si cambia algo.
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
      const files = walk(outDir)
        .map((f) => relative(outDir, f).split(sep).join('/'))
        .filter((f) => !EXCLUDE.some((re) => re.test(f)))
        .sort();
      const hash = createHash('sha256');
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
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
