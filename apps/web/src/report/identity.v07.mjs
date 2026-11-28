// CM-C1W · Identidad de la web con la búsqueda global (formato 0.7):
//
//   cd apps/web && OGS_BIN=$CARGO_TARGET_DIR/release/ogs node src/report/identity.v07.mjs
//   (con el motor nuevo: OGS_V07_ENGINE=1 OGS_BIN=<ogs con la 0.7> node src/report/identity.v07.mjs)
//
// 1. Sin `global`, la web produce lo mismo que antes de CM-C1W: la carga del JSON, los avisos, el informe, los CSV y el PDF de los modelos de
//    `SAMPLES` (v0.5 y anteriores más V001-nc, que es v0.6 con `non_circular` sin `global`) son byte a byte los del árbol `BASE_REF`
//    (por defecto `b75f38a`, la base de CM-C1W). Es el mismo camino que `identity.f3b.mjs`: cada modelo se calcula una vez con el motor
//    real (`OGS_BIN`) y el mismo informe alimenta los dos árboles.
// 2. Con `global`: un documento v0.7 se abre, se guarda y se vuelve a abrir sin cambios (los mismos bytes y el mismo documento), con la versión
//    0.7 y las claves de `global` en el orden canónico; al quitar `global`, el guardado vuelve a 0.6. Esto no necesita el motor.
// 3. Con `OGS_V07_ENGINE` definido y un `OGS_BIN` que conozca la 0.7: el motor acepta el archivo que guarda la web, `isAnalysisReport` lo da
//    por válido y el camino completo (informe, CSV, PDF) corre con las `GlobalStats` reales. Sin esa variable se informa «PENDIENTE».
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
const baseRef = process.env.BASE_REF ?? 'b75f38a';
if (!bin) throw Error('Indique OGS_BIN (el binario ogs del árbol actual)');
const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
const baseSha = git('rev-parse', '--verify', `${baseRef}^{commit}`);
const out = resolve(process.env.TMPDIR ?? '.', 'cm-c1w-identity');
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
  ['agua_embalsada', 'verification/differential/cases_f3g/D28.ogs.json', false, () => {}],
  ['polilinea_fija', 'verification/differential/cases_f3/D17.ogs.json', false, () => {}],
  ['no_circular_v06', 'verification/cases/V001-nc.json', true, () => {}],
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
const line = (name, key, equal, a, b, extra = '') => {
  console.log(`${name} ${key}: ${equal ? 'IGUAL' : 'DIFERENTE'} sha256=${sha(a).slice(0, 16)}/${sha(b).slice(0, 16)}${extra}`);
  if (!equal) failures += 1;
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
    console.log(`== ${name}: ${report.results.length} métodos, ${withWarnings} con avisos, ${caseChecks.length} comprobaciones, versión ${model.version}`);
    for (const k of ['opened', 'saved', 'input', 'diagnostics', 'structured', 'csv', 'modelCsv', 'exportable', 'surface', 'forces']) line(name, k, a[k] === b[k], a[k], b[k]);
    for (const k of ['pdf', 'pdfZ']) {
      const rawEq = a[k].equals(b[k]);
      const norm = normalize(a[k]) === normalize(b[k]);
      line(name, `PDF ${k === 'pdf' ? 'sin comprimir' : 'comprimido'} (reloj y azar fijos)`, rawEq, a[k], b[k], `; con metadatos normalizados ${norm ? 'IGUAL' : 'DIFERENTE'}; ${a[k].length}/${b[k].length} bytes`);
    }
  }

  // F7.1: ida y vuelta con `global`, sin motor.
  const base = JSON.parse(await readFile(resolve(repo, 'verification/cases/V001-nc.json'), 'utf8')).model;
  const withGlobal = (g) => ({ ...base, version: '0.7', analysis: { ...base.analysis, search: { ...base.analysis.search, non_circular: { ...base.analysis.search.non_circular, global: g } } } });
  const variants = [['vacio', {}], ['completo', { polish: false, seed: 9007199254740991, generated: 2000, algorithm: 'annealing' }], ['parcial_con_nulos', { generated: 60, seed: null }]];
  for (const [name, g] of variants) {
    const text = JSON.stringify(withGlobal(g));
    const a = now.json.openOgsJson(text);
    const okOpen = a.doc !== null && a.issues.every((x) => x.severity !== 'error') && a.doc.version === '0.7';
    const s1 = okOpen ? now.json.saveOgsJson(a.doc) : '';
    const b = okOpen ? now.json.openOgsJson(s1) : { doc: null };
    const s2 = b.doc ? now.json.saveOgsJson(b.doc) : '';
    const keys = okOpen ? Object.keys(JSON.parse(s1).analysis.search.non_circular.global) : [];
    const order = ['algorithm', 'generated', 'seed', 'polish'];
    const ordered = keys.every((k2, n) => n === 0 || order.indexOf(keys[n - 1]) < order.indexOf(k2));
    line(`global_${name}`, 'abrir→guardar→abrir→guardar', okOpen && s1 === s2 && JSON.stringify(a.doc) === JSON.stringify(b.doc) && JSON.parse(s1).version === '0.7' && ordered, s1, s2, `; claves ${keys.join(',') || '(vacío)'}`);
  }
  {
    const a = now.json.openOgsJson(JSON.stringify(withGlobal({})));
    const removed = { ...a.doc, analysis: { ...a.doc.analysis, search: { ...a.doc.analysis.search, non_circular: {} } } };
    const sv = JSON.parse(now.json.saveOgsJson(removed));
    line('global_quitado', 'la versión guardada vuelve a 0.6', sv.version === '0.6' && !('global' in sv.analysis.search.non_circular), JSON.stringify(sv.version), '"0.6"');
    const old6 = now.json.openOgsJson(JSON.stringify({ ...withGlobal({}), version: '0.6' }));
    const msg = old6.issues.find((x) => x.code === 'io.version_fields')?.text;
    line('global_en_0.6', 'rechazado con el mensaje del motor', old6.doc === null && msg === 'analysis.search.non_circular.global requiere version "0.7"', String(msg), 'analysis.search.non_circular.global requiere version "0.7"');
  }

  // F7.2: con el motor nuevo.
  if (process.env.OGS_V07_ENGINE === undefined) {
    console.log('PENDIENTE (OGS_V07_ENGINE): el binario de este árbol no conoce la 0.7; faltan el motor con `global`, sus GlobalStats y el camino completo con ellas');
  } else {
    const validate = await now.load('engine/validate.ts');
    for (const [name, g] of [['vacio', {}], ['bloque', { algorithm: 'block' }]]) {
      const text = now.json.saveOgsJson(now.json.openOgsJson(JSON.stringify(withGlobal(g))).doc);
      const modelPath = resolve(out, `global_${name}.ogs.json`);
      await writeFile(modelPath, text);
      const report = JSON.parse(execFileSync(bin, ['analyze', modelPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
      const stats = report.results.map((r) => r.search?.non_circular?.global);
      const ok = validate.isAnalysisReport(report) && stats.every((x) => x !== undefined);
      line(`motor_global_${name}`, 'informe válido con GlobalStats', ok, JSON.stringify(stats), JSON.stringify(stats), `; ganadores ${stats.map((x) => x?.winner).join(',')}`);
      const c = await pipeline(now, { jsonText: text, report, caseChecks: [] });
      line(`motor_global_${name}`, 'CSV con las columnas global_*', c.csv.split('\r\n')[0].includes('global_algoritmo') && c.csv.split('\r\n')[0].endsWith('global_ganador'), c.csv, c.csv);
      line(`motor_global_${name}`, 'PDF generado', c.pdf.length > 1000, c.pdf, c.pdf, `; ${c.pdf.length} bytes`);
    }
  }
} finally {
  await Promise.all(servers.map((s) => s.close()));
}
if (failures > 0) {
  console.log(`RESULTADO: ${failures} diferencias contra ${baseRef}`);
  process.exitCode = 1;
} else {
  console.log(`RESULTADO: todo IGUAL contra ${baseRef} (${baseSha.slice(0, 7)})`);
}
