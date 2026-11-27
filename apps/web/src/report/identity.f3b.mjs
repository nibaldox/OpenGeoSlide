// Identidad del informe y del CSV de un modelo v0.5 contra el código base (34d4ba0), no contra sí mismo.
//   git worktree add $TMPDIR/f3b1-w2-base 34d4ba0 && (cd $TMPDIR/f3b1-w2-base/apps/web && pnpm install --frozen-lockfile --prefer-offline)
//   cd apps/web && BASE_WORKTREE=$TMPDIR/f3b1-w2-base OGS_BIN=$CARGO_TARGET_DIR/release/ogs node src/report/identity.f3b.mjs
// No escribe en el worktree base. Cada modelo v0.5 se calcula una sola vez con el motor real y el mismo informe alimenta las
// dos versiones del código. El PDF es determinista con el reloj fijo (jsPDF toma la fecha de `new Date()` y el /ID de `Math.random()`): con el reloj
// y el azar fijos se comparan los bytes brutos, sin y con compresión. Sale con código distinto de 0 si algo difiere.
import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.cwd()); // apps/web
const repo = resolve(root, '../..');
const base = process.env.BASE_WORKTREE;
const bin = process.env.OGS_BIN;
const out = resolve(process.env.TMPDIR ?? '.', 'f3b1-w2/identity');
if (!base || !bin) throw Error('Indique BASE_WORKTREE y OGS_BIN');
const head = execFileSync('git', ['-C', base, 'rev-parse', '--short=7', 'HEAD'], {encoding:'utf8'}).trim();
if (head !== '34d4ba0') throw Error(`El worktree base debe estar en 34d4ba0 (está en ${head})`);
if (execFileSync('git', ['-C', base, 'status', '--porcelain', '--untracked-files=no'], {encoding:'utf8'}).trim()) throw Error('El worktree base tiene cambios');
await mkdir(out, { recursive: true });
const servers = [];
async function modules(web) {
  const s = await createServer({ root: web, configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', ssr: { noExternal: ['papaparse'] }, plugins: [{name:'papaparse-cjs-interop', enforce:'pre', resolveId(id) { if (id === 'papaparse') return '\0f3b-papa'; }, load(id) { if (id === '\0f3b-papa') return `import { createRequire } from 'node:module'; const papa = createRequire(${JSON.stringify(resolve(root,'package.json'))})('papaparse'); export const parse = papa.parse; export const unparse = papa.unparse;`; }}] });
  servers.push(s);
  const load = p => s.ssrLoadModule(resolve(web, `src/${p}`));
  return { content: await load('report/content.ts'), csv: await load('io/csv.ts'), reportInput: await load('editor/app/reportInput.ts'), pdf: await load('report/pdf.ts'), json: await load('io/ogsJson.ts'), load };
}
const RealDate = Date;
async function frozen(fn) {
  const T = new RealDate('2026-11-27T12:00:00.000Z').getTime();
  const realRandom = Math.random; let seed = 12345;
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } };
  Math.random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; // jsPDF saca el /ID de Math.random
  try { return await fn(); } finally { globalThis.Date = RealDate; Math.random = realRandom; }
}
const sha = s => createHash('sha256').update(s).digest('hex');
const normalize = b => Buffer.from(b).toString('latin1').replace(/\/CreationDate \(D:[^)]+\)/g, '/CreationDate (D:FIXED)').replace(/\/ID \[\s*<[0-9a-fA-F]+>\s*<[0-9a-fA-F]+>\s*\]/g, '/ID [<FIXED> <FIXED>]');
try {
 const old = await modules(resolve(base, 'apps/web'));
 const now = await modules(root);
 for (const [name, path, nested] of [['ejemplo', 'examples/acads1a.ogs.json', false], ['refuerzos', 'verification/cases/V010.json', true]]) {
  const raw = JSON.parse(await readFile(resolve(repo,path),'utf8'));
  const model = nested ? raw.model : raw;
  model.version = '0.5';
  // Un campo genuino de v0.5: sin él el informe indicaría la versión mínima anterior.
  model.analysis.tension_crack = { depth: 1, water_fill: 0 };
  const modelPath = resolve(out, `${name}.ogs.json`);
  await writeFile(modelPath, JSON.stringify(model));
  const report = JSON.parse(execFileSync(bin, ['analyze', modelPath], {encoding:'utf8', maxBuffer: 64*1024*1024}));
  if (!report.results.some(r => r.status === 'converged')) throw Error(`${name}: ningún método convergió`);
  const doc = now.json.openOgsJson(JSON.stringify(model)).doc;
  const input = {generatedAt:'2026-11-27T12:00:00.000Z',engineName:report.engine,model:doc,modelSha256:sha(JSON.stringify(model)),results:report.results,warnings:[],checks:[],disclaimer:''};
  const outputs = [];
  // Calentamiento: la primera construcción de cada módulo consume un número de `Math.random()` distinto del de las siguientes
  // (inicialización perezosa de jsPDF/fuentes), lo que solo desplaza el /ID; se descarta para comparar bytes en igualdad de condiciones.
  for (const m of [old, now]) await frozen(async () => (await m.pdf.buildReportPdfWith(input,{loadFont:async f => new Uint8Array(await readFile(resolve(repo,'apps/web/public/fonts',f))),compress:false})).arrayBuffer());
  for (const [label, m] of [['base',old],['actual',now]]) {
    const structured = JSON.stringify(m.content.buildReportContent(input));
    const csv = m.csv.resultsToCsv(report.results, {units:doc.units});
    const surface = m.reportInput.surfaceCoordsCsv(report.results, doc.units);
    const forces = m.reportInput.reinforcementForcesCsv({report,doc});
    const loadFont = async f => new Uint8Array(await readFile(resolve(repo,'apps/web/public/fonts',f)));
    const pdfOf = compress => frozen(async () => Buffer.from(await (await m.pdf.buildReportPdfWith(input,{loadFont,compress})).arrayBuffer()));
    const pdf = await pdfOf(false);
    const pdfZ = await pdfOf(true);
    await writeFile(resolve(out,`${name}-${label}.json`), structured);
    await writeFile(resolve(out,`${name}-${label}.csv`), csv);
    await writeFile(resolve(out,`${name}-${label}.pdf`), pdf);
    outputs.push({structured,csv,surface,forces,pdf,pdfZ});
  }
  for (const k of ['structured','csv','surface','forces']) { const equal=outputs[0][k]===outputs[1][k]; console.log(`${name} ${k}: ${equal?'IGUAL':'DIFERENTE'} sha256=${sha(outputs[0][k])}/${sha(outputs[1][k])}`); if(!equal) process.exitCode=1; }
  for (const k of ['pdf','pdfZ']) {
   const raw=outputs[0][k].equals(outputs[1][k]);
   const norm=normalize(outputs[0][k])===normalize(outputs[1][k]);
   console.log(`${name} PDF ${k==='pdf'?'sin comprimir':'comprimido'} (reloj y azar fijos): bytes brutos ${raw?'IGUALES':'DIFERENTES'}; con metadatos normalizados ${norm?'IGUAL':'DIFERENTE'}; ${outputs[0][k].length}/${outputs[1][k].length} bytes sha256=${sha(outputs[0][k])}/${sha(outputs[1][k])}`);
   if(!raw) process.exitCode=1;
  }
 }
 // Un único informe sintético combina ambas leyes y la superficie no circular; nunca se envía al motor.
 const f = await now.load('report/f3bFixtures.ts');
 const hb = f.hoekBrownFixture(); const sh = f.shansepFixture(); const nc = f.nonCircularPolylineWinsFixture(true);
 const input = structuredClone(nc.input);
 input.model.materials = [hb.model.materials[1], sh.model.materials[0]];
 input.model.regions = [{...input.model.regions[0], material: input.model.materials[0].id}];
 input.results[0].strength = {passes: 11, slices: [{index:0,law:'hoek_brown',normal_stress:4.2},{index:1,law:'shansep',vertical_stress:50,ocr:1.5}]};
 input.results[0].warnings = ['hoek_brown_low_confinement','shansep_nonpositive_stress','non_circular_large_change'];
 const loadFont = async file => new Uint8Array(await readFile(resolve(repo,'apps/web/public/fonts',file)));
 await writeFile(resolve(out,'simulado-f3b.pdf'), Buffer.from(await (await now.pdf.buildReportPdfWith(input,{loadFont,compress:false})).arrayBuffer()));
 console.log('PDF simulado:',resolve(out,'simulado-f3b.pdf'));
} finally { await Promise.all(servers.map(s=>s.close())); }
