// Abre y guarda con los módulos reales de la web (`openOgsJson` + `saveOgsJson`), sin dependencias nuevas.
//
//   node --experimental-strip-types verification/tools/web_roundtrip_save.mjs <dir_entrada> <dir_salida>
//
// Por cada `*.json` de <dir_entrada> (un modelo, no un caso con `checks`) escribe en <dir_salida> el texto que
// guardaría el editor. Si el archivo se rechaza al abrir, escribe `<nombre>.rejected` con las incidencias.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openOgsJson, saveOgsJson } from '../../apps/web/src/io/ogsJson.ts';

const [inDir, outDir] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error('uso: web_roundtrip_save.mjs <dir_entrada> <dir_salida>');
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });
let rejected = 0;
for (const name of readdirSync(inDir).filter((f) => f.endsWith('.json')).sort()) {
  const opened = openOgsJson(readFileSync(join(inDir, name), 'utf8'));
  if (opened.doc === null) {
    rejected += 1;
    writeFileSync(join(outDir, `${name}.rejected`), JSON.stringify(opened.issues, null, 2));
    continue;
  }
  writeFileSync(join(outDir, name), saveOgsJson(opened.doc));
}
process.exit(rejected > 0 ? 1 : 0);
