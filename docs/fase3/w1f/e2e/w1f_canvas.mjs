// F3-W1f: la polilínea fija en el lienzo (puntero, teclado, táctil), el resultado con polilínea, Casos, CSV y PDF.
//
// (Nota de I-W: con el motor integrado el WASM sí calcula polilíneas; este guion sigue usando el informe falso porque comprueba
// la presentación con valores exactos. El cálculo real está en docs/fase3/iw/e2e/.)
// El motor de esta rama no calcula polilíneas: el Worker se sustituye por uno que responde a `analyze` con un informe FALSO
// (M-P con interslice, Janbu corregido con correction_factor, superficie `{points}`), así que «Comprobar» nunca llega al WASM.
// La web de esta rama tampoco abre un .ogs.json con polilínea (es de W1e): el modelo se carga con `window.__ogsStore`, que solo
// existe en una compilación con el gancho temporal de e2e (una línea en EditorApp.tsx que NO se commitea).
//
// Uso: OGS_URL=http://127.0.0.1:5187/ OGS_REPO=<repo> TMPDIR=<scratch> node w1f_canvas.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.env.TMPDIR, 'f3w1f');
mkdirSync(OUT, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const REPO = process.env.OGS_REPO ?? process.cwd();
const AXE = readFileSync(path.join(process.env.TMPDIR, 'x8-ux/node_modules/axe-core/axe.min.js'), 'utf8');
let failed = 0;
const rows = [];
const step = (name, ok, data = {}) => {
  if (!ok) failed += 1;
  rows.push({ name, ok });
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Modelo base: V047a sin búsqueda, con la polilínea de F3.8.
const V047A = JSON.parse(readFileSync(path.join(REPO, 'verification/cases/V047a.json'), 'utf8')).model;
const PTS = [[30, 25.000001], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35]];
const polyDoc = () => {
  const d = JSON.parse(JSON.stringify(V047A));
  d.analysis = { ...d.analysis, methods: ['spencer', 'morgenstern_price', 'janbu_corrected'], surface: { type: 'polyline', points: PTS } };
  delete d.analysis.search;
  return d;
};

// Informe falso: la polilínea ajustada (extremos recortados al terreno) y dovelas de 1 m sobre ella.
const FITTED = [[30, 25], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35]];
function fakeSlices() {
  const out = [];
  const yAt = (x) => { for (let i = 0; i + 1 < FITTED.length; i++) { const [a, b] = [FITTED[i], FITTED[i + 1]]; if (x >= a[0] && x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]); } return 35; };
  for (let x = 30; x < 51; x += 1) {
    const x1 = Math.min(x + 1, 51.29111842105263);
    out.push({ x_left: x, x_right: x1, y_base_left: yAt(x), y_base_right: yAt(x1), y_top_mid: Math.min(35, 25 + (x + 0.5 - 30) * 0.47), width: x1 - x, alpha: 0.3, base_length: 1.05, weight: 100, cohesion: 3, tan_phi: 0.36, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0 });
  }
  return out;
}
const FAKE_REPORT = {
  engine: 'ogs-core 0.1.0 (informe falso de W1f)',
  results: [
    { method: 'spencer', fos: 0.9981, status: 'converged', iterations: 7, lambda: 0.21, surface: { points: FITTED }, slices: fakeSlices(), search: null, warnings: [] },
    { method: 'morgenstern_price', fos: 0.9991, status: 'converged', iterations: 8, lambda: 0.33, surface: { points: FITTED }, slices: fakeSlices(), search: null, warnings: [], interslice: { function: 'half_sine' } },
    { method: 'janbu_corrected', fos: 0.9993, status: 'converged', iterations: 5, lambda: null, surface: { points: FITTED }, slices: fakeSlices(), search: null, warnings: [], correction_factor: 1.0482 },
  ],
};

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });

async function newPage(scheme = 'light', opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme, acceptDownloads: true, ...opts });
  await ctx.addInitScript(([report]) => {
    localStorage.setItem('ogs.onboarding.v1', 'seen');
    // Worker falso para `analyze` (el motor real no calcula polilíneas en esta rama); `engine`/`version` pasan al real.
    const Real = window.Worker;
    window.__analyzeCount = 0;
    window.Worker = class extends Real {
      postMessage(msg, ...rest) {
        if (msg && msg.type === 'analyze') {
          window.__analyzeCount += 1;
          setTimeout(() => this.dispatchEvent(new MessageEvent('message', { data: { id: msg.id, ok: true, result: JSON.stringify(report), elapsed_ms: 12.5 } })), 30);
          return;
        }
        super.postMessage(msg, ...rest);
      }
    };
    // Guarda los Blob de descargas para leer el PDF y los CSV.
    window.__blobs = [];
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { window.__blobs.push(b); return create(b); };
  }, [FAKE_REPORT]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(URL_);
  await page.waitForFunction(() => document.querySelector('[data-testid="engine-banner"]')?.textContent?.includes('ogs-core'), null, { timeout: 30000 });
  return { ctx, page };
}

async function loadPolyline(page) {
  await page.evaluate((doc) => window.__ogsStore.dispatch({ type: 'doc/load', doc, fileName: 'poly.ogs.json' }), polyDoc());
  await page.waitForSelector('[data-handle="surface_vertex"]');
  await sleep(300);
}
const labelOf = (page, key) => page.locator(`[data-handle-key="${key}"]`).getAttribute('aria-label');
const live = (page) => page.locator('[data-testid="live-polite"]').textContent();
const surfPts = (page) => page.evaluate(() => window.__ogsStore.getState().doc.analysis.surface.points);
const histLen = (page) => page.evaluate(() => window.__ogsStore.getState().history.past.length);

// ───────── 1. Puntero ─────────
{
  const { ctx, page } = await newPage('light');
  await loadPolyline(page);
  const n = await page.locator('[data-handle="surface_vertex"]').count();
  step('1 polilínea dibujada con un tirador por punto (5) y sin tiradores de círculo', n === 5 && (await page.locator('[data-handle="circle_center"]').count()) === 0, { n });
  const poly = await page.locator('[data-fixed-polyline]').getAttribute('points');
  step('2 la polilínea fija es una línea de 5 puntos', poly.trim().split(' ').length === 5, { poly });
  const stroke = await page.locator('[data-fixed-polyline]').getAttribute('stroke');
  step('3 color de la superficie por token (--canvas-surface)', stroke === 'var(--canvas-surface)', { stroke });
  const tab0 = await page.locator('[data-handle][tabindex="0"]').count();
  step('4 una sola parada de tabulación en el lienzo', tab0 === 1, { tab0 });
  await page.screenshot({ path: path.join(OUT, 'w1f-01-polilinea.png') });

  const h2 = page.locator('[data-handle-key="s-2"]');
  const before = await labelOf(page, 's-2');
  const b = await h2.boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const hist0 = await histLen(page);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 6, cy - 14, { steps: 6 });
  await page.mouse.up();
  await sleep(450);
  const after = await labelOf(page, 's-2');
  const pts = await surfPts(page);
  step('5 arrastrar con el puntero mueve el vértice y cambia su etiqueta', before !== after && pts.length === 5, { before, after });
  step('6 el arrastre es una sola entrada de historial', (await histLen(page)) === hist0 + 1, { hist0, hist: await histLen(page) });
  step('7 el arrastre se anuncia', /Punto 3 de la polilínea de falla/.test(await live(page)), { live: await live(page) });
  await page.keyboard.press('Control+z');
  await sleep(200);
  step('8 Ctrl+Z devuelve el vértice en un paso', (await labelOf(page, 's-2')) === before, { label: await labelOf(page, 's-2') });

  // x no cruza la del vecino (vértice 2 hacia más allá del 3: x = 45)
  const b2 = await h2.boundingBox();
  const b3 = await page.locator('[data-handle-key="s-3"]').boundingBox();
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.mouse.down();
  await page.mouse.move(b3.x + b3.width / 2 + 40, b2.y + b2.height / 2, { steps: 8 });
  await sleep(120);
  const warn = await page.locator('[data-testid="polyline-crossing-warning"]').textContent().catch(() => null);
  step('9 al arrastrar más allá del vecino aparece el aviso visible', Boolean(warn && /no puede cruzar/.test(warn)), { warn });
  await page.screenshot({ path: path.join(OUT, 'w1f-02-aviso-cruce.png') });
  await page.mouse.up();
  await sleep(450);
  const p2 = await surfPts(page);
  step('10 la x quedó acotada junto al vecino (x2 < x3) y se anunció', p2[2][0] < p2[3][0] && p2[3][0] - p2[2][0] < 0.01 && /no puede cruzar/.test(await live(page)), { x2: p2[2][0], x3: p2[3][0], live: await live(page) });
  await page.keyboard.press('Control+z');
  await sleep(200);

  // Doble clic quita; Agregar vértice inserta sobre un tramo
  const hb = await page.locator('[data-handle-key="s-1"]').boundingBox();
  await page.mouse.dblclick(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await sleep(200);
  step('11 doble clic quita el punto (quedan 4)', (await surfPts(page)).length === 4, {});
  await page.keyboard.press('Control+z');
  await sleep(150);
  await page.getByRole('button', { name: 'Agregar vértice', exact: true }).click();
  const a = await page.locator('[data-handle-key="s-1"]').boundingBox();
  const c = await page.locator('[data-handle-key="s-2"]').boundingBox();
  await page.mouse.click((a.x + c.x) / 2 + a.width / 2, (a.y + c.y) / 2 + a.height / 2);
  await sleep(250);
  step('12 «Agregar vértice»: un clic sobre un tramo inserta un punto (6) y queda seleccionado', (await surfPts(page)).length === 6 && (await page.evaluate(() => window.__ogsStore.getState().ui.selection.kind)) === 'surface_vertex', { n: (await surfPts(page)).length });
  await page.keyboard.press('Control+z');
  await page.getByRole('button', { name: 'Seleccionar', exact: true }).click();
  step('13 sin errores de página (puntero)', page.errors.length === 0, { errors: page.errors });
  await ctx.close();
}

// ───────── 2. Teclado ─────────
{
  const { ctx, page } = await newPage('light');
  await loadPolyline(page);
  await page.focus('[data-handle-key="v-0-0"]');
  // `]` recorre hasta el primer punto de la polilínea: tras los vértices de regiones y los de la piezométrica (sin piezométrica en V047a)
  const regionHandles = await page.locator('[data-handle="vertex"]').count();
  for (let i = 0; i < regionHandles; i++) await page.keyboard.press(']');
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-handle-key'));
  step('14 `]` recorre los vértices de regiones y llega al primer punto de la polilínea', focused === 's-0', { focused });
  await page.keyboard.press(']');
  const l0 = await labelOf(page, 's-1');
  await page.keyboard.press('ArrowRight');
  await sleep(450);
  const l1 = await labelOf(page, 's-1');
  step('15 → mueve el punto 0,1 m y se anuncia', l0 !== l1 && /Punto 2 de la polilínea de falla: x 35,1 m/.test(await live(page)), { l0, l1, live: await live(page) });
  await page.keyboard.press('Shift+ArrowUp');
  await sleep(150);
  const p = await surfPts(page);
  step('16 Mayús+↑ mueve ×10 (1 m) en y', Math.abs(p[1][1] - (25.520953 + 1)) < 1e-9, { y: p[1][1] });
  await page.keyboard.press('i');
  await sleep(450);
  step('17 `i` inserta un punto en el medio del tramo siguiente y le pasa el foco', (await surfPts(page)).length === 6 && (await page.evaluate(() => document.activeElement?.getAttribute('data-handle-key'))) === 's-2' && /Punto insertado/.test(await live(page)), { live: await live(page) });
  await page.keyboard.press('Delete');
  await sleep(450);
  step('18 Supr quita el punto y el foco pasa al anterior', (await surfPts(page)).length === 5 && (await page.evaluate(() => document.activeElement?.getAttribute('data-handle-key'))) === 's-1' && /Punto eliminado/.test(await live(page)), { live: await live(page) });
  // la x no cruza: Mayús+→ repetidas contra el vecino (x=40)
  for (let k = 0; k < 8; k++) await page.keyboard.press('Shift+ArrowRight');
  await sleep(450);
  const q = await surfPts(page);
  step('19 Mayús+→ contra el vecino se acota (x1 < x2) y se avisa', q[1][0] < q[2][0] && /no puede cruzar/.test(await live(page)), { x1: q[1][0], x2: q[2][0], live: await live(page) });
  // mínimo de puntos
  await page.evaluate(() => window.__ogsStore.dispatch({ type: 'surface/set', surface: { type: 'polyline', points: [[30, 25], [50, 34]] } }));
  await sleep(200);
  await page.focus('[data-handle-key="s-0"]');
  await page.keyboard.press('Delete');
  await sleep(450);
  step('20 con 2 puntos Supr no quita y lo explica', (await surfPts(page)).length === 2 && /al menos 2 puntos/.test(await live(page)), { live: await live(page) });
  await page.keyboard.press('Escape');
  const tabStops = await page.locator('[data-handle][tabindex="0"]').count();
  step('21 sigue habiendo una sola parada de tabulación', tabStops === 1, { tabStops });
  step('22 sin errores de página (teclado)', page.errors.length === 0, { errors: page.errors });
  await ctx.close();
}

// ───────── 3. Táctil ─────────
{
  const { ctx, page } = await newPage('light', { viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  await loadPolyline(page);
  await page.evaluate(() => document.querySelector('svg[role="application"]').scrollIntoView({ block: 'start' }));
  await sleep(300);
  const key = 's-2';
  const hb = await page.locator(`[data-handle-key="${key}"]`).boundingBox();
  const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
  const label0 = await labelOf(page, key);
  const sy0 = await page.evaluate(() => Math.round(window.scrollY));
  // el dedo cae a ~16 px: dentro del radio táctil (22 px)
  const fx = hx + 12, fy = hy + 10;
  await touch('touchStart', [[fx, fy]]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [[fx, fy - i * 5]]); await sleep(16); }
  await touch('touchEnd', []);
  await sleep(450);
  const label1 = await labelOf(page, key);
  step('23 un dedo arrastra un vértice de la polilínea (radio táctil) y la página no se desplaza', label0 !== label1 && (await page.evaluate(() => Math.round(window.scrollY))) === sy0, { label0, label1 });
  step('24 el arrastre táctil es una entrada de historial', (await histLen(page)) === 1, { hist: await histLen(page) });
  // Pellizco: no cambia la polilínea
  const r = await page.evaluate(() => { const b = document.querySelector('svg[role="application"]').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const ptsBefore = JSON.stringify(await surfPts(page));
  const cx = r.x + r.w / 2, cy = r.y + r.h - 30;
  await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [[cx - 40 - i * 8, cy], [cx + 40 + i * 8, cy]]); await sleep(16); }
  await touch('touchEnd', []);
  await sleep(150);
  step('25 el pellizco acerca la vista sin tocar la polilínea', JSON.stringify(await surfPts(page)) === ptsBefore, {});
  const sizes = await page.evaluate(() => ({ hit: Math.min(...[...document.querySelectorAll('[data-handle="surface_vertex"] [data-hit-area]')].map((e) => e.getBoundingClientRect().width)), shape: Math.min(...[...document.querySelectorAll('[data-handle-shape="surface_vertex"]')].map((e) => e.getBoundingClientRect().width)) }));
  step('26 objetivos: área de acierto ≥ 24 px y marca visible ≥ 12 px', sizes.hit >= 24 && sizes.shape >= 12, sizes);
  await page.screenshot({ path: path.join(OUT, 'w1f-03-tactil.png') });
  step('27 sin errores de página (táctil)', page.errors.length === 0, { errors: page.errors });
  await ctx.close();
}

// ───────── 4. Resultado con polilínea, tabla, CSV y PDF (informe falso) ─────────
for (const scheme of ['light', 'dark']) {
  const { ctx, page } = await newPage(scheme);
  await loadPolyline(page);
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.waitForSelector('[data-layer="result"]', { timeout: 15000 });
  await sleep(300);
  const tag = scheme === 'light' ? '' : ' (oscuro)';
  const count = await page.evaluate(() => window.__analyzeCount);
  step(`28${tag} «Comprobar» respondió el informe falso, sin llegar al WASM`, count === 1, { count });
  const pts = await page.locator('[data-critical-surface]').getAttribute('points');
  step(`29${tag} el resultado se dibuja con la polilínea ajustada del informe (5 puntos) y dovelas`, pts.trim().split(' ').length === 5 && (await page.locator('[data-slice]').count()) === 21, { pts: pts.split(' ').length, dovelas: await page.locator('[data-slice]').count() });
  const legend = await page.locator('ul.legend[aria-label="Leyenda de la sección"]').innerText();
  step(`30${tag} la leyenda dice «Superficie fija (polilínea)»`, /Superficie fija \(polilínea\)/.test(legend) && !/Superficie crítica/.test(legend), { legend });
  const table = await page.locator('[data-results-table]').innerText();
  step(`31${tag} la tabla muestra «Polilínea (5 puntos)», la función de M-P y f₀`, /Polilínea \(5 puntos\)/.test(table) && /Función: Medio seno/.test(table) && /f₀ = 1,048/.test(table) && !/Centro \(xc/.test(table), { table: table.slice(0, 400) });
  await page.evaluate(() => document.querySelector('[data-results-table]').scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: path.join(OUT, `w1f-04-resultado-${scheme}.png`) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT, `w1f-05-lienzo-resultado-${scheme}.png`) });
  if (scheme === 'light') {
    // CSV de superficie
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar superficie (CSV)' }).click()]);
    await dl.saveAs(path.join(OUT, 'superficie.csv'));
    // I-W: el CSV empieza con BOM (UTF-8, para Excel); se quita antes de comparar la cabecera.
    const csv = readFileSync(path.join(OUT, 'superficie.csv'), 'utf8').replace(/^\uFEFF/, '').split('\r\n');
    step('32 CSV de superficie: una fila por punto de la polilínea ajustada, con x_m, y_m y unidades', csv[0] === 'metodo,estado,punto,x_m,y_m,unidades' && csv.length === 1 + 3 * 5 && csv[1] === 'spencer,converged,1,30,25,SI', { cab: csv[0], filas: csv.length - 1, f1: csv[1] });
    await page.getByRole('button', { name: 'Exportar', exact: true }).click();
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar resultados (CSV)' }).click()]);
    await dl2.saveAs(path.join(OUT, 'resultados.csv'));
    const rcsv = readFileSync(path.join(OUT, 'resultados.csv'), 'utf8').replace(/^\uFEFF/, '').split('\r\n');
    step('33 CSV de resultados: superficie polilínea, función y f0', rcsv[0].endsWith('unidades,superficie,funcion_interslice,f0') && /morgenstern_price.*SI,polilinea,half_sine,$/.test(rcsv[2]) && /janbu_corrected.*SI,polilinea,,1\.0482$/.test(rcsv[3]), { cab: rcsv[0], r2: rcsv[2], r3: rcsv[3] });
    // PDF
    await page.getByRole('button', { name: 'Informe PDF' }).click();
    await page.waitForFunction(() => window.__blobs.some((b) => b.type === 'application/pdf'), null, { timeout: 30000 });
    const pdfB64 = await page.evaluate(async () => { const b = window.__blobs.filter((x) => x.type === 'application/pdf').pop(); const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (const c of buf) s += String.fromCharCode(c); return btoa(s); });
    writeFileSync(path.join(OUT, 'informe-polilinea.pdf'), Buffer.from(pdfB64, 'base64'));
    step('34 el PDF se generó (%PDF) con el informe de polilínea', Buffer.from(pdfB64, 'base64').subarray(0, 5).toString() === '%PDF-', { bytes: Buffer.from(pdfB64, 'base64').length });
  }
  // axe
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate((s) => { window.eval(s); }, AXE);
  const res = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].target.join(' ').slice(0, 100) })));
  const serious = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  step(`35${tag} axe en el editor con polilínea y resultado: 0 serious/critical`, serious.length === 0, { total: res.length, serious });
  for (const v of res) console.log('     axe', scheme, v.impact, v.id, v.n, v.sample);
  step(`36${tag} sin errores de página`, page.errors.length === 0, { errors: page.errors });
  await ctx.close();
}

// ───────── 5. Casos con un informe falso de polilínea ─────────
for (const scheme of ['light', 'dark']) {
  const { ctx, page } = await newPage(scheme);
  // I-W: desde U2 «Casos de verificación» es una pestaña (role=tab), no un botón.
  await page.getByRole('tab', { name: 'Casos de verificación' }).click();
  await page.waitForSelector('button:has-text("Comprobar caso")');
  await page.getByRole('button', { name: 'Comprobar caso' }).click();
  await page.waitForSelector('[data-results-table]', { timeout: 15000 });
  await sleep(500);
  const tag = scheme === 'light' ? '' : ' (oscuro)';
  // I-W: Casos tiene dos leyendas (materiales y bandas, y la de la sección): se juntan.
  const legend = (await page.locator('ul.legend').allInnerTexts()).join(' | ');
  step(`37${tag} Casos: la leyenda dice «Superficie fija (polilínea)»`, /Superficie fija \(polilínea\)/.test(legend), { legend });
  const table = await page.locator('[data-results-table]').innerText();
  step(`38${tag} Casos: la tabla muestra «Polilínea (5 puntos)», la función y f₀`, /Polilínea \(5 puntos\)/.test(table) && /Función: Medio seno/.test(table) && /f₀ = 1,048/.test(table), { table: table.slice(0, 300) });
  // Casos dibuja en un <canvas> 2D: se comprueba que hay píxeles del color de la superficie (rojo) y se revisa la captura con visión.
  // I-W: el color de la superficie es el token --canvas-surface (rojo en claro, rosa en oscuro): se lee de la página y se cuentan sus píxeles.
  const px = await page.evaluate(() => {
    const probe = document.createElement('i'); probe.style.color = 'var(--canvas-surface)'; document.body.appendChild(probe);
    const [r0, g0, b0] = getComputedStyle(probe).color.match(/[\d.]+/g).map(Number); probe.remove();
    const c = document.querySelector('canvas'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let reds = 0;
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) < 60) reds++;
    return { w: c.width, h: c.height, token: [r0, g0, b0], reds };
  });
  step(`39${tag} Casos: el lienzo 2D dibuja la polilínea (píxeles de superficie)`, px.reds > 150, px);
  await page.locator('canvas').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `w1f-06-casos-${scheme}.png`) });
  await page.evaluate((s) => { window.eval(s); }, AXE);
  const res = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } })).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0].target.join(' ').slice(0, 100) })));
  const serious = res.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  step(`40${tag} axe en Casos con polilínea: 0 serious/critical`, serious.length === 0, { total: res.length, serious });
  for (const v of res) console.log('     axe casos', scheme, v.impact, v.id, v.n, v.sample);
  step(`41${tag} Casos sin errores de página`, page.errors.length === 0, { errors: page.errors });
  await ctx.close();
}

await browser.close();
writeFileSync(path.join(OUT, 'w1f_canvas_result.json'), JSON.stringify(rows, null, 1));
console.log(failed === 0 ? `\nTODO OK (${rows.length} pasos)` : `\nFALLARON ${failed} de ${rows.length}`);
process.exit(failed === 0 ? 0 : 1);
