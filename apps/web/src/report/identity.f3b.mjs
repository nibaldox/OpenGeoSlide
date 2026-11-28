// Identidad de la web contra la v0.4.0 real: la carga del JSON, los avisos, el informe, los CSV y el PDF de un modelo v0.5 no cambian.
//
//   cd apps/web && OGS_BIN=$CARGO_TARGET_DIR/release/ogs node src/report/identity.f3b.mjs
//
// - `BASE_REF` (por defecto `v0.4.0`) es la referencia de git contra la que se compara; el script extrae `apps/web` de ese árbol con
//   `git archive` en `$TMPDIR/f3b-identity/base-<ref>` y le enlaza el `node_modules` del árbol actual (el `package.json` de la web no cambió desde la
//   v0.4.0). Con `BASE_WORKTREE=<ruta>` usa un worktree ya preparado, cuyo HEAD debe ser `BASE_REF`. No escribe nunca en el repositorio.
// - Cada modelo se calcula una sola vez con el motor real (`OGS_BIN`) y el mismo informe alimenta los dos árboles. En cada uno se ejecuta el camino
//   completo: `openOgsJson` → `EngineRun` → `buildReportInput` (con los avisos reales de `describeResultWarnings`) → `buildReportContent` → CSV → PDF,
//   más `issuesFromReport` (Diagnósticos) y, con los casos que las traen, las comprobaciones frente a lo publicado (`evaluateCheck`).
// - La muestra son seis modelos v0.5 o anteriores: el ejemplo sin cambios, grieta, refuerzos, Ito-Matsui, agua embalsada y polilínea fija.
// - El PDF es determinista con el reloj y el azar fijos (jsPDF toma la fecha de `new Date()` y el /ID de `Math.random()`): se comparan los bytes
//   brutos, sin y con compresión.
//
// Sale con código distinto de 0 si algo difiere o no se puede comparar.
import { createServer } from 'vite';
import { readFile, writeFile, mkdir, rm, symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(process.cwd()); // apps/web
const repo = resolve(root, '../..');
const bin = process.env.OGS_BIN;
const baseRef = process.env.BASE_REF ?? 'v0.4.0';
if (!bin) throw Error('Indique OGS_BIN (el binario ogs del árbol actual)');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const baseSha = git('rev-parse', '--verify', `${baseRef}^{commit}`);
const out = resolve(process.env.TMPDIR ?? '.', 'f3b-identity');
await mkdir(out, { recursive: true });

let baseWeb;
if (process.env.BASE_WORKTREE) {
  const head = execFileSync('git', ['-C', process.env.BASE_WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (head !== baseSha) throw Error(`BASE_WORKTREE está en ${head.slice(0, 7)} y ${baseRef} es ${baseSha.slice(0, 7)}`);
  baseWeb = resolve(process.env.BASE_WORKTREE, 'apps/web');
} else {
  const dir = resolve(out, `base-${baseRef.replace(/[^A-Za-z0-9._-]/g, '_')}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const tar = execFileSync('git', ['-C', repo, 'archive', baseRef, 'apps/web'], { maxBuffer: 256 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  baseWeb = resolve(dir, 'apps/web');
  await symlink(resolve(root, 'node_modules'), resolve(baseWeb, 'node_modules'));
}
console.log(`Base: ${baseRef} (${baseSha.slice(0, 7)}) en ${baseWeb}`);
console.log(`Actual: ${git('rev-parse', '--short=7', 'HEAD')} en ${root}`);

const servers = [];
async function modules(web) {
  const s = await createServer({
    root: web, configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error', ssr: { noExternal: ['papaparse'] },
    plugins: [{ name: 'papaparse-cjs-interop', enforce: 'pre', resolveId(id) { if (id === 'papaparse') return '\0f3b-papa'; }, load(id) { if (id === '\0f3b-papa') return `import { createRequire } from 'node:module'; const papa = createRequire(${JSON.stringify(resolve(root, 'package.json'))})('papaparse'); export const parse = papa.parse; export const unparse = papa.unparse;`; } }],
  });
  servers.push(s);
  const load = (p) => s.ssrLoadModule(resolve(web, `src/${p}`));
  return {
    content: await load('report/content.ts'), csv: await load('io/csv.ts'), reportInput: await load('editor/app/reportInput.ts'), pdf: await load('report/pdf.ts'),
    json: await load('io/ogsJson.ts'), diagnostics: await load('editor/app/diagnostics.ts'), runner: await load('analysis/runner.ts'), load,
  };
}

const RealDate = Date;
const FIXED = '2026-11-27T12:00:00.000Z';
async function frozen(fn) {
  const T = new RealDate(FIXED).getTime();
  const realRandom = Math.random; let seed = 12345;
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } };
  Math.random = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; // jsPDF saca el /ID de Math.random
  try { return await fn(); } finally { globalThis.Date = RealDate; Math.random = realRandom; }
}
const sha = (s) => createHash('sha256').update(s).digest('hex');
const loadFont = async (f) => new Uint8Array(await readFile(resolve(repo, 'apps/web/public/fonts', f)));

// [nombre, ruta, ¿anidado en {model, checks}?, mutación]: los cinco de la verificación independiente de R15 más el ejemplo sin cambios.
const SAMPLES = [
  ['ejemplo', 'examples/acads1a.ogs.json', false, () => {}],
  ['grieta', 'examples/acads1a.ogs.json', false, (m) => { m.version = '0.5'; m.analysis.tension_crack = { depth: 1, water_fill: 0 }; }],
  ['refuerzos', 'verification/cases/V010.json', true, (m) => { m.version = '0.5'; m.analysis.tension_crack = { depth: 1, water_fill: 0 }; }],
  ['ito_matsui', 'verification/differential/cases_f3g/D40.ogs.json', false, () => {}],
  ['agua_embalsada', 'verification/differential/cases_f3g/D28.ogs.json', false, () => {}],
  ['polilinea_fija', 'verification/differential/cases_f3/D17.ogs.json', false, () => {}],
];

const normalize = (b) => Buffer.from(b).toString('latin1').replace(/\/CreationDate \(D:[^)]+\)/g, '/CreationDate (D:FIXED)').replace(/\/ID \[\s*<[0-9a-fA-F]+>\s*<[0-9a-fA-F]+>\s*\]/g, '/ID [<FIXED> <FIXED>]');

/** Todo lo que produce un árbol para un modelo, con el camino completo de la aplicación. */
async function pipeline(m, { jsonText, report, caseChecks }) {
  const opened = m.json.openOgsJson(jsonText);
  const doc = opened.doc;
  const run = { revision: 1, doc, json: jsonText, sha256: sha(jsonText), report, elapsedMs: 10, checkedAt: FIXED };
  const input = m.reportInput.buildReportInput(run, new RealDate(FIXED));
  input.checks = caseChecks.map((c) => {
    const r = report.results.find((x) => x.method === c.method);
    const ev = m.runner.evaluateCheck(c, m.runner.convergedFos(r));
    return { method: c.method, published: c.published, fos: ev.fos, ok: ev.ok };
  });
  const pdfOf = (compress) => frozen(async () => Buffer.from(await (await m.pdf.buildReportPdfWith(input, { loadFont, compress })).arrayBuffer()));
  return {
    opened: JSON.stringify(opened),
    saved: m.json.saveOgsJson(doc),
    input: JSON.stringify(input),
    diagnostics: JSON.stringify(m.diagnostics.issuesFromReport(report)),
    structured: JSON.stringify(m.content.buildReportContent(input)),
    csv: m.csv.resultsToCsv(report.results, { units: doc.units }),
    modelCsv: m.csv.modelToCsv(doc, { units: doc.units }),
    exportable: JSON.stringify(m.reportInput.exportAvailability(run, true)),
    surface: m.reportInput.surfaceCoordsCsv(report.results, doc.units),
    forces: m.reportInput.reinforcementForcesCsv({ report, doc }),
    pdf: await pdfOf(false),
    pdfZ: await pdfOf(true),
  };
}

let failures = 0;
let excepted = 0;
// CM-W3A · E17f §2 (RCM-B-06): el informe dibuja la superficie del método que rige (el primero de `fsMinimum(report).methods` con dovelas), como el
// lienzo y el HUD, y no la del primer método convergido del arreglo. Con varios métodos y el mínimo en otro que el primero, cambian `structured` (el
// dibujo y su leyenda) y el PDF frente a v0.4.0 / b75f38a: es una excepción declarada, y solo vale donde la causa existe (el primero convergido no es el
// que rige). Comprobado: con la regla anterior de `primaryResult` los dos guiones dan 0 diferencias, así que no hay otra causa.
let figureCause = null;
const figureException = (now, report) => {
  const first = report.results.find((r) => r.status === 'converged' && r.slices.length > 0);
  const governing = now.content.primaryResult(report.results);
  return first && governing && first.method !== governing.method ? `la figura dibuja ${governing.method} (FS ${governing.fos}), el método que rige, y no ${first.method} (FS ${first.fos}), el primer convergido` : null;
};
const line = (name, key, equal, a, b, extra = '') => {
  const excepcion = !equal && figureCause && (key === 'structured' || key.startsWith('PDF'));
  console.log(`${name} ${key}: ${equal ? 'IGUAL' : excepcion ? 'EXCEPCIÓN E17f §2 (RCM-B-06: ' + figureCause + ')' : 'DIFERENTE'} sha256=${sha(a).slice(0, 16)}/${sha(b).slice(0, 16)}${extra}`);
  if (excepcion) excepted += 1;
  else if (!equal) failures += 1;
};

try {
  const old = await modules(baseWeb);
  const now = await modules(root);
  for (const [name, path, nested, mutate] of SAMPLES) {
    const raw = JSON.parse(await readFile(resolve(repo, path), 'utf8'));
    const model = nested ? raw.model : raw;
    mutate(model);
    const jsonText = JSON.stringify(model);
    const modelPath = resolve(out, `${name}.ogs.json`);
    await writeFile(modelPath, jsonText);
    const report = JSON.parse(execFileSync(bin, ['analyze', modelPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
    if (!report.results.some((r) => r.status === 'converged')) throw Error(`${name}: ningún método convergió`);
    const withWarnings = report.results.filter((r) => r.warnings.length > 0).length;
    const caseChecks = nested ? raw.checks ?? [] : [];
    // Calentamiento: la primera construcción de cada módulo consume un número de `Math.random()` distinto del de las siguientes (inicialización
    // perezosa de jsPDF y de las fuentes), lo que solo desplaza el /ID; se descarta para comparar bytes en igualdad de condiciones.
    for (const m of [old, now]) {
      const inp = m.reportInput.buildReportInput({ revision: 1, doc: m.json.openOgsJson(jsonText).doc, json: jsonText, sha256: sha(jsonText), report, elapsedMs: 10, checkedAt: FIXED }, new RealDate(FIXED));
      await frozen(async () => (await m.pdf.buildReportPdfWith(inp, { loadFont, compress: false })).arrayBuffer());
    }
    const a = await pipeline(old, { jsonText, report, caseChecks });
    const b = await pipeline(now, { jsonText, report, caseChecks });
    figureCause = figureException(now, report);
    console.log(`== ${name}: ${report.results.length} métodos, ${withWarnings} con avisos, ${caseChecks.length} comprobaciones, versión ${model.version}`);
    for (const k of ['opened', 'saved', 'input', 'diagnostics', 'structured', 'csv', 'modelCsv', 'exportable', 'surface', 'forces']) line(name, k, a[k] === b[k], a[k], b[k]);
    for (const k of ['pdf', 'pdfZ']) {
      const rawEq = a[k].equals(b[k]);
      const norm = normalize(a[k]) === normalize(b[k]);
      line(name, `PDF ${k === 'pdf' ? 'sin comprimir' : 'comprimido'} (reloj y azar fijos)`, rawEq, a[k], b[k], `; con metadatos normalizados ${norm ? 'IGUAL' : 'DIFERENTE'}; ${a[k].length}/${b[k].length} bytes`);
    }
  }

  figureCause = null;
  // Humo, sin comparar: un informe sintético con las dos leyes, la superficie no circular y las notas nuevas (no existe en la v0.4.0).
  const f = await now.load('report/f3bFixtures.ts');
  const hb = f.hoekBrownFixture(); const sh = f.shansepFixture(); const nc = f.nonCircularPolylineWinsFixture(true);
  const input = structuredClone(nc.input);
  input.model.materials = [hb.model.materials[1], sh.model.materials[0]];
  input.model.regions = [{ ...input.model.regions[0], material: input.model.materials[0].id }];
  input.results[0].strength = { passes: 11, slices: [{ index: 0, law: 'hoek_brown', normal_stress: 4.2 }, { index: 1, law: 'shansep', vertical_stress: 50, ocr: 1.5 }] };
  input.results[0].warnings = ['hoek_brown_low_confinement', 'shansep_nonpositive_stress', 'non_circular_large_change', 'negative_lambda', 'negative_effective_normal_major', 'non_circular_not_refined'];
  await writeFile(resolve(out, 'simulado-f3b.pdf'), Buffer.from(await (await now.pdf.buildReportPdfWith(input, { loadFont, compress: false })).arrayBuffer()));
  console.log('PDF simulado (sin comparar):', resolve(out, 'simulado-f3b.pdf'));
} finally {
  await Promise.all(servers.map((s) => s.close()));
}
if (failures > 0) {
  console.log(`RESULTADO: ${failures} diferencias contra ${baseRef}`);
  process.exitCode = 1;
} else {
  console.log(`RESULTADO: todo IGUAL contra ${baseRef} (${baseSha.slice(0, 7)})${excepted > 0 ? `, salvo ${excepted} excepciones declaradas (E17f §2, RCM-B-06)` : ''}`);
}
