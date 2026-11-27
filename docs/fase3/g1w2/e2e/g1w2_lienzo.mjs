// F3G-G1 W2 (revisado por I-W): agua embalsada y grieta de tracción en el lienzo, Resultados, Diagnósticos, CSV, PDF, Casos y Ayuda,
// en Chrome, en claro y oscuro, con el MOTOR REAL (WASM). Ya no hay datos simulados: se quitó INJECT/DRY (el motor integrado calcula la grieta).
// Tres recorridos sobre V047a (v0.3) con la piezométrica 2 m sobre el pie (y = 27):
//   agua  = sin grieta (v0.3: solo el agua embalsada automática);
//   fija  = grieta de 2 m llena (tension_crack {depth: 2, water_fill: 1}, v0.5);
//   auto  = grieta automática llena ({depth: 'auto', water_fill: 1}, v0.5).
// El «oráculo» de cada cifra es el binario `ogs analyze` (OGS_BIN, el mismo núcleo que el WASM): x_c, profundidad y Pw que la web muestra
// (capa del lienzo, tabla de resultados, Diagnósticos, CSV, PDF y Casos) deben coincidir con las del motor.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=$PWD OGS_BIN=$PWD/target/release/ogs TMPDIR=<scratch> node docs/fase3/g1w2/e2e/g1w2_lienzo.mjs
//   (playwright-core desde docs/node_modules; axe-core: AXE=<axe.min.js> o <scratch>/x8-ux/node_modules/axe-core/axe.min.js). SHOTS=<carpeta> cambia las capturas.
// Los PDF se rasterizan con `pdftoppm` (si existe) para revisarlos con visión.
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const TMP = process.env.TMPDIR ?? os.tmpdir();
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const REPO = process.env.OGS_REPO ?? process.cwd();
const OGS_BIN = process.env.OGS_BIN ?? path.join(REPO, 'target/release/ogs');
const SHOTS = process.env.SHOTS ?? path.join(TMP, 'g1w2-real-shots');
mkdirSync(SHOTS, { recursive: true });
const AXE = [process.env.AXE, path.join(TMP, 'x8-ux/node_modules/axe-core/axe.min.js'), path.join(TMP, 'w2-e2e/node_modules/axe-core/axe.min.js')].find((p) => p && existsSync(p));

const base = JSON.parse(readFileSync(path.join(REPO, 'verification/cases/V047a.json'), 'utf8')).model;
const withWater = { ...base, water: { piezometric_line: [[20, 27], [70, 27]], unit_weight: 9.81 } };
const SCENARIOS = {
  agua: { model: withWater, crack: null },
  fija: { model: { ...withWater, version: '0.5', analysis: { ...withWater.analysis, tension_crack: { depth: 2, water_fill: 1 } } }, crack: { depth: 2, water_fill: 1 } },
  auto: { model: { ...withWater, version: '0.5', analysis: { ...withWater.analysis, tension_crack: { depth: 'auto', water_fill: 1 } } }, crack: { depth: 'auto', water_fill: 1 } },
};

let failed = 0;
const step = (n, ok, data = {}) => {
  if (!ok) failed += 1;
  console.log(ok ? 'OK  ' : 'FAIL', n, JSON.stringify(data));
};
// Misma regla que `num` de report/crackReport.ts: coma decimal, hasta 3 decimales y sin ceros de relleno.
const num = (n) => String(Number(n.toFixed(3))).replace('.', ',');

const modelPaths = {};
const oracle = {}; // escenario → { método → { x, depth, water_force, fos } }
for (const [name, s] of Object.entries(SCENARIOS)) {
  modelPaths[name] = path.join(SHOTS, `v047a-2m-${name}.ogs.json`);
  writeFileSync(modelPaths[name], JSON.stringify(s.model));
  const r = spawnSync(OGS_BIN, ['analyze', modelPaths[name]], { encoding: 'utf8', maxBuffer: 1 << 28 });
  const rep = JSON.parse(r.stdout);
  oracle[name] = Object.fromEntries(rep.results.map((m) => [m.method, { ...(m.tension_crack ?? null), fos: m.fos, slices: m.slices.length }]));
}
step('oráculo (ogs analyze): sin grieta no hay tension_crack; con grieta lo trae cada método', Object.values(oracle.agua).every((m) => m.x === undefined) && Object.values(oracle.fija).every((m) => m.x > 0 && m.depth === 2 && m.water_force > 0) && Object.values(oracle.auto).every((m) => m.x > 0 && m.depth > 0), { fija: oracle.fija.bishop, auto: oracle.auto.bishop });
writeFileSync(path.join(SHOTS, 'oraculo.json'), JSON.stringify(oracle, null, 1));

async function openMenu(p, name) {
  const t = p.getByRole('button', { name, exact: true });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
  await p.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((x) => x.textContent.trim().startsWith(n) && x.getAttribute('aria-expanded') === 'true'), name);
}

async function axe(p, label) {
  await p.addScriptTag({ path: AXE });
  const r = await p.evaluate(async () => {
    const out = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] });
    return out.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
  const sc = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  step(`axe sin serious/critical: ${label}`, sc.length === 0, { sc, otras: r.filter((v) => !sc.includes(v)).map((v) => `${v.id}:${v.impact}`) });
}

step('axe-core disponible', !!AXE, { AXE });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
for (const theme of ['light', 'dark']) {
  for (const [name, sc] of Object.entries(SCENARIOS)) {
    const tag = `${theme}/${name}`;
    const exp = oracle[name];
    const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: theme, acceptDownloads: true });
    await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
    const errors = [];
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
    p.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errors.push(`HTTP ${r.status()} ${r.url()}`); });
    await p.goto(URL_);
    await p.waitForSelector('[data-testid="editor-app"]');
    await p.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''), null, { timeout: 30000 });
    await p.locator('[data-testid="file-open"]').setInputFiles(modelPaths[name]);
    await p.waitForSelector('[data-layer="regions"] polygon');
    await p.waitForTimeout(400);

    // Agua embalsada, antes de calcular.
    const pond = await p.locator('[data-layer="pond"] polygon').count();
    step(`${tag}: capa del agua embalsada con un polígono antes de calcular`, pond === 1, { pond });
    const fill = await p.locator('[data-layer="pond"] polygon').first().evaluate((el) => getComputedStyle(el).fill);
    step(`${tag}: el relleno resuelve --canvas-pond (azul)`, /rgb/.test(fill), { fill });
    const order = await p.evaluate(() => { const l = [...document.querySelectorAll('svg [data-layer]')].map((g) => g.getAttribute('data-layer')); return [l.indexOf('regions'), l.indexOf('pond'), l.indexOf('piezometric')]; });
    step(`${tag}: orden de capas regiones < agua < piezométrica`, order[0] < order[1] && order[1] < order[2], { order });
    step(`${tag}: sin cálculo no hay capa de la grieta`, (await p.locator('[data-layer="tension-crack"]').count()) === 0);
    if (name === 'agua') await p.screenshot({ path: path.join(SHOTS, `${theme}-${name}-1-sin-calcular.png`) });

    // Calcular con el motor real.
    await p.getByRole('button', { name: 'Comprobar', exact: true }).click();
    await p.waitForSelector('[data-testid="result-summary"][data-state="current"]', { timeout: 60000 }); // UA: el resultado se espera en el HUD (la tabla está en la vista «Resultados»)
    await p.waitForTimeout(600);
    const legend = await p.locator('ul.legend').innerText();
    step(`${tag}: la leyenda dice «Agua embalsada»`, legend.includes('Agua embalsada'));
    const crack = p.locator('[data-layer="tension-crack"]');
    if (!sc.crack) {
      step(`${tag}: sin grieta no hay capa, tabla ni resumen de la grieta`, (await crack.count()) === 0 && (await p.locator('[data-testid="crack-results"]').count()) === 0 && (await p.locator('[data-testid="crack-summary"]').count()) === 0);
      step(`${tag}: la leyenda no nombra la grieta`, !legend.includes('Grieta de tracción'));
    } else {
      step(`${tag}: capa de la grieta presente (resultado del motor real)`, (await crack.count()) === 1);
      const attrs = await crack.evaluate((g) => ({ x: +g.dataset.crackX, depth: +g.dataset.crackDepth, force: +g.dataset.crackWaterForce }));
      const hit = Object.entries(exp).find(([, m]) => Math.abs(m.x - attrs.x) < 1e-6 && Math.abs(m.depth - attrs.depth) < 1e-6 && Math.abs(m.water_force - attrs.force) < 1e-6);
      step(`${tag}: x_c, profundidad y Pw del lienzo = los del motor (ogs analyze)`, !!hit, { lienzo: attrs, motor: hit ? hit[0] : exp });
      step(`${tag}: línea discontinua vertical`, (await crack.locator('[data-crack-line]').getAttribute('stroke-dasharray')) === '5 4');
      const geo = await p.evaluate(() => {
        const g = document.querySelector('[data-layer="tension-crack"]');
        const ln = g.querySelector('[data-crack-line]');
        const ar = g.querySelector('[data-crack-arrow]');
        const xs = [...document.querySelectorAll('[data-layer="result"] polygon[data-slice]')].flatMap((pl) => pl.getAttribute('points').trim().split(/\s+/).map((q) => +q.split(',')[0]));
        return {
          x1: +ln.getAttribute('x1'), x2: +ln.getAttribute('x2'), y1: +ln.getAttribute('y1'), y2: +ln.getAttribute('y2'),
          arrow: ar ? { at: +ar.getAttribute('x1'), tip: +ar.getAttribute('x2') } : null,
          sliceMin: Math.min(...xs), sliceMax: Math.max(...xs),
        };
      });
      step(`${tag}: la línea es vertical y cae en el borde de la masa (x_c)`, Math.abs(geo.x1 - geo.x2) < 1e-6 && (Math.abs(geo.x1 - geo.sliceMax) < 0.75 || Math.abs(geo.x1 - geo.sliceMin) < 0.75), geo);
      const massSide = (geo.sliceMin + geo.sliceMax) / 2 > geo.x1 ? 1 : -1;
      step(`${tag}: la flecha de Pw apunta hacia la masa, en el sentido del deslizamiento`, !!geo.arrow && Math.sign(geo.arrow.tip - geo.arrow.at) === massSide, { massSide, arrow: geo.arrow });
      step(`${tag}: el agua de la grieta (relleno azul) se dibuja`, (await crack.locator('[data-crack-water]').count()) === 1);
      const labels = await crack.locator('text').evaluateAll((els) => els.map((e) => e.textContent));
      step(`${tag}: rótulos de profundidad y Pw`, labels.some((t) => t.startsWith('Grieta d =')) && labels.some((t) => t.startsWith('Pw =')), { labels });
      step(`${tag}: leyenda con «Grieta de tracción»`, legend.includes('Grieta de tracción'));
      // Tabla bajo Resultados: x_c, profundidad y Pw del motor por método.
      await p.locator('#view-results').click(); // UA: la tabla de la grieta y su resumen (Diagnósticos) están en la vista «Resultados»
      const rows = await p.locator('[data-testid="crack-results"] tbody tr').allInnerTexts();
      const want = Object.values(exp).map((v) => [num(v.x), num(v.depth), num(v.water_force)]);
      const allShown = rows.length >= 1 && rows.every((r) => want.some((w) => w.every((c) => r.includes(c))));
      step(`${tag}: tabla de la grieta con x_c, profundidad y Pw del motor`, allShown, { filas: rows, esperado: want.slice(0, 2) });
      const sum = await p.locator('[data-testid="crack-summary"]').innerText().catch(() => '');
      step(`${tag}: resumen de la grieta en Diagnósticos con x_c y Pw del motor`, sum.includes(num(Object.values(exp)[0].x).replace(/(\.|,)\d+$/, '')) && sum.includes('Pw ='), { sum: sum.slice(0, 200) });
      await p.locator('#mode-edit').click(); // UA: de vuelta al lienzo
    }
    await p.locator('[data-testid="editor-canvas"]').screenshot({ path: path.join(SHOTS, `${theme}-${name}-2-lienzo.png`) });
    await p.screenshot({ path: path.join(SHOTS, `${theme}-${name}-3-pagina.png`), fullPage: true });

    // CSV de resultados.
    await openMenu(p, 'Exportar');
    const [dl] = await Promise.all([p.waitForEvent('download'), p.getByText('Exportar resultados (CSV)').click()]);
    const csvPath = path.join(SHOTS, `${theme}-${name}-resultados.csv`);
    await dl.saveAs(csvPath);
    const csv = readFileSync(csvPath, 'utf8');
    const lines = csv.replace(/^\ufeff/, '').split('\r\n');
    const header = lines[0];
    if (sc.crack) {
      step(`${tag}: CSV con columnas de la grieta`, /grieta_x_m,grieta_profundidad_m,grieta_pw_kn_m$/.test(header), { header });
      const first = lines[1].split(',').slice(-3).map(Number);
      const hit = Object.values(exp).some((m) => Math.abs(m.x - first[0]) < 1e-3 && Math.abs(m.depth - first[1]) < 1e-3 && Math.abs(m.water_force - first[2]) < 1e-3);
      step(`${tag}: CSV con x_c, profundidad y Pw del motor`, hit, { primeraFila: first });
    } else {
      step(`${tag}: CSV sin columnas de la grieta`, !header.includes('grieta'), { header });
    }
    step(`${tag}: CSV con el aviso water_above_ground en la columna avisos`, csv.includes('water_above_ground'));

    // PDF: se guarda, se comprueba el texto y se rasteriza para la revisión con visión.
    await p.keyboard.press('Escape');
    const [pdf] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }).catch(() => null), p.getByRole('button', { name: 'Informe PDF', exact: true }).click()]);
    if (pdf) {
      const pdfPath = path.join(SHOTS, `${theme}-${name}-informe.pdf`);
      await pdf.saveAs(pdfPath);
      const head = readFileSync(pdfPath).subarray(0, 5).toString('latin1');
      step(`${tag}: PDF generado`, head === '%PDF-', { bytes: readFileSync(pdfPath).length });
      const txt = spawnSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' }).stdout ?? '';
      if (sc.crack) {
        const f = Object.values(exp)[0];
        step(`${tag}: el PDF nombra la grieta con x_c, profundidad y Pw del motor`, /Grieta de tracci/i.test(txt) && txt.includes(num(f.x)) && txt.includes(num(f.depth)) && txt.includes(num(f.water_force)), { x: num(f.x), d: num(f.depth), pw: num(f.water_force) });
      } else {
        step(`${tag}: el PDF no trae tabla de grieta pero sí la nota del agua embalsada`, /agua embalsada/i.test(txt) && !/Grieta de tracci.n en la superficie/i.test(txt));
      }
      spawnSync('pdftoppm', ['-r', '70', '-png', pdfPath, path.join(SHOTS, `${theme}-${name}-pdf`)]);
    } else {
      step(`${tag}: PDF generado`, false, { nota: 'sin descarga' });
    }

    // Casos: el mismo modelo cargado como archivo en «Casos de verificación», calculado con el motor real.
    await p.getByRole('tab', { name: 'Casos de verificación' }).click();
    await p.waitForSelector('.cases-view');
    await p.locator('.cases-view input[type="file"]').setInputFiles(modelPaths[name]);
    await p.waitForTimeout(300);
    await p.getByRole('button', { name: 'Comprobar caso', exact: true }).click();
    await p.waitForSelector('.cases-view #results-title', { timeout: 60000 });
    await p.waitForFunction(() => document.querySelector('.cases-view table') && !/Comprobando/.test(document.body.innerText), null, { timeout: 60000 });
    await p.waitForTimeout(600);
    const crackCasos = await p.locator('.cases-view [data-testid="crack-results"] tbody tr').allInnerTexts();
    if (sc.crack) {
      const want = Object.values(exp).map((v) => [num(v.x), num(v.depth), num(v.water_force)]);
      step(`${tag}: Casos muestra la tabla de la grieta con las cifras del motor`, crackCasos.length >= 1 && crackCasos.every((r) => want.some((w) => w.every((c) => r.includes(c)))), { filas: crackCasos.slice(0, 2) });
    } else {
      step(`${tag}: Casos sin grieta no muestra su tabla`, crackCasos.length === 0);
    }
    await p.screenshot({ path: path.join(SHOTS, `${theme}-${name}-4-casos.png`), fullPage: true });
    if (name === 'fija') await axe(p, `${tag} Casos con la grieta`);

    if (name === 'fija') {
      // Ayuda y axe del editor con la grieta (una vez por tema).
      await p.getByRole('button', { name: 'Ayuda', exact: true }).click();
      await p.waitForSelector('[data-testid="help-dialog"]');
      const help = await p.locator('[data-testid="help-dialog"]').innerText();
      step(`${tag}: Ayuda con «Agua embalsada» y «Grieta de tracción»`, help.includes('Agua embalsada') && help.includes('Grieta de tracción'));
      await p.locator('[data-testid="help-dialog"] dt', { hasText: 'Agua embalsada' }).scrollIntoViewIfNeeded();
      await p.screenshot({ path: path.join(SHOTS, `${theme}-${name}-5-ayuda-agua.png`) });
      await axe(p, `${tag} Ayuda abierta`);
      await p.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await p.waitForTimeout(200);
    }
    await axe(p, `${tag} vista final`);
    step(`${tag}: consola sin errores ni HTTP ≥ 400`, errors.length === 0, { errors });
    await ctx.close();
  }
}
await b.close();
console.log(failed === 0 ? 'TODO OK' : `${failed} FALLOS`);
process.exit(failed === 0 ? 0 : 1);
