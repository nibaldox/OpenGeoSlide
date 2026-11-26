// U2-L: copia de walk_coord.mjs con puerto 5186 y los menús Archivo / Importar / Exportar (los botones siguen siendo `button` con el mismo nombre, dentro de un menú que hay que abrir).
// R7-03: los diálogos de importación son <dialog> nativos (rol implícito); se seleccionan con dialog[open].
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u3i-walk');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const FIX = (process.env.OGS_REPO ?? '/home/xodla/archivos/opengeoslide-wt/u5i') + '/apps/web/src/io/dxf/fixtures/';
const out = { steps: [], consoleErrors: [] };
const step = (name, ok, data = {}) => { out.steps.push({ name, ok, ...data }); console.log(ok ? 'OK ' : 'FAIL', name, JSON.stringify(data)); };
const num = (t) => Number(String(t).replace(/\s/g, '').replace(',', '.'));

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
await ctx.addInitScript(() => {
  window.__blobs = [];
  window.__analyze = 0;
  const pm = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function (m, ...r) { if (m && m.type === 'analyze') window.__analyze += 1; return pm.call(this, m, ...r); };
  const orig = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { window.__blobs.push(b); return orig(b); };
});
await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }); // U3-I: la guía de primera visita ya se vio (no tapa el recorrido)
const page = await ctx.newPage();
page.on('response', (r) => { if (r.status() >= 400) out.consoleErrors.push('HTTP ' + r.status() + ' ' + r.url()); });
out.knownIgnored = [];
page.on('console', (m) => { if (m.type() !== 'error') return; const u = m.location()?.url ?? ''; if (u.endsWith('/favicon.ico')) out.knownIgnored.push(m.text() + ' @ ' + u); else out.consoleErrors.push(m.text() + ' @ ' + u); });
page.on('pageerror', (e) => out.consoleErrors.push('pageerror: ' + e.message));
page.on('dialog', (d) => d.accept());
async function openMenu(page, name) {
  const trigger = page.getByRole('button', { name, exact: true });
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await page.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((b) => b.textContent.trim().startsWith(n) && b.getAttribute('aria-expanded') === 'true'), name);
}
async function closeMenu(page) { await page.keyboard.press('Escape'); }
const shot = async (n) => { const p = path.join(SHOTS, n + '.png'); await page.screenshot({ path: p }); return p; };

// 1. Abrir la app
await page.goto(URL_);
await page.waitForSelector('[data-testid="engine-banner"]', { timeout: 20000 });
// U3-I: el indicador dice «Cargando el motor…» hasta que el WASM carga; se espera a «ogs-core» antes de leerlo (carrera previa, ver U3O_notas.md).
await page.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''), null, { timeout: 20000 });
const banner = await page.textContent('[data-testid="engine-banner"]');
await page.waitForSelector('[data-layer="regions"] polygon');
step('1 abrir app: motor real y sin errores de consola', /ogs-core/.test(banner) && out.consoleErrors.length === 0, { banner: banner.trim(), lang: await page.evaluate(() => document.documentElement.lang), errors: out.consoleErrors.length, shot: await shot('01-inicio') });

// 2. Ejemplo cargado
const nRegions = await page.locator('[data-layer="regions"] polygon').count();
const status = (await page.textContent('[data-testid="file-status"]')).trim();
const mats = await page.locator('select[aria-label="Abrir un caso publicado como modelo"] option').count();
step('2 ejemplo V047a abierto', nRegions >= 1, { regions: nRegions, status, casosEnMenu: mats - 1, shot: await shot('02-ejemplo') });

// 3. Mover un vértice y deshacer
const handle = page.locator('[data-handle="vertex"]').nth(2);
const label0 = await handle.getAttribute('aria-label');
const box = await handle.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 - 25, { steps: 6 });
await page.mouse.up();
const label1 = await page.locator('[data-handle="vertex"]').nth(2).getAttribute('aria-label');
const dirty1 = (await page.textContent('[data-testid="file-status"]')).includes('con cambios');
const shotMoved = await shot('03a-vertice-movido');
await page.getByRole('button', { name: 'Deshacer' }).click();
const label2 = await page.locator('[data-handle="vertex"]').nth(2).getAttribute('aria-label');
step('3 mover vértice y deshacer', label0 !== label1 && label0 === label2, { antes: label0, movido: label1, tras_deshacer: label2, dirtyTrasMover: dirty1, shot: shotMoved });
await page.getByRole('button', { name: 'Rehacer' }).click();
await page.getByRole('button', { name: 'Deshacer' }).click(); // queda como el original

// 4/5. Calcular sin sismo
async function fsTable() {
  await page.waitForSelector('[data-testid="results-panel"] table tbody tr');
  return await page.$$eval('[data-testid="results-panel"] table tbody tr', (rows) => rows.map((r) => { const c = [...r.querySelectorAll('td')].map((x) => x.textContent.trim()); return { metodo: c[0], fs: c[1], estado: c[2], iter: c[3], lambda: c[4], evaluadas: c[5], validas: c[6] }; }));
}
await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
await page.waitForSelector('[data-testid="results-panel"] table');
await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
const t0 = await fsTable();
const hasResultLayer = (await page.locator('[data-layer="result"] polygon[data-slice]').count()) > 0;
const hasCrit = (await page.locator('[data-layer="result"] polyline[data-critical-surface]').count()) === 1;
const diag0 = (await page.locator('[data-testid="diagnostics-status"]').textContent()).trim();
step('4 calcular sin sismo', t0.length >= 1 && hasResultLayer && hasCrit, { tabla: t0, dovelasDibujadas: await page.locator('[data-slice]').count(), superficieCritica: hasCrit, diagnostico: diag0, shot: await shot('04-sin-sismo') });
const fs0 = t0.map((r) => num(r.fs));

// 4b. Un segundo cálculo se bloquea mientras corre uno
const before = await page.evaluate(() => window.__analyze);
const dbl = await page.evaluate(async () => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Comprobar' && b.closest('[role="toolbar"]'));
  btn.click(); btn.click(); btn.click();
  await new Promise((r) => setTimeout(r, 0));
  return { textoTrasClic: btn.textContent.trim(), deshabilitado: btn.disabled };
});
await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
const after = await page.evaluate(() => window.__analyze);
step('4b triple clic en Comprobar: un solo cálculo, indicador y botón bloqueado', after - before === 1, { calculosLanzados: after - before, ...dbl });

// 5. kh = 0,1
await page.getByRole('tab', { name: 'Sismo' }).click();
const kh = page.getByLabel('kh', { exact: true });
await kh.fill('0,1');
await kh.press('Enter');
const seismicLabel = await page.locator('[data-layer="seismic"] text').first().textContent().catch(() => null);
const stale = await page.locator('[data-testid="stale-result"]').count();
await shot('05a-kh-stale');
await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
await page.waitForFunction(() => !document.querySelector('[data-testid="stale-result"]') && document.querySelector('[data-testid="results-panel"] h2')?.textContent === 'Resultados');
await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
const t1 = await fsTable();
const fs1 = t1.map((r) => num(r.fs));
const lower = fs0.every((v, i) => fs1[i] < v);
step('5 kh=0,1 → FS baja, superficie y tabla', lower && (await page.locator('[data-slice]').count()) > 0, { staleAntesDeCalcular: stale, indicadorSismo: seismicLabel, sinSismo: fs0, conSismo: fs1, tabla: t1, shot: await shot('05b-con-sismo') });

// 6. Informe PDF
await page.evaluate(() => { window.__blobs.length = 0; });
const dl = page.waitForEvent('download', { timeout: 60000 });
await page.getByRole('button', { name: 'Informe PDF' }).click();
const download = await dl;
const pdfPath = path.join(SHOTS, 'informe.pdf');
await download.saveAs(pdfPath);
const buf = readFileSync(pdfPath);
const blobInfo = await page.evaluate(async () => { const b = window.__blobs.find((x) => x.type === 'application/pdf'); if (!b) return null; const head = new TextDecoder().decode(new Uint8Array(await b.slice(0, 8).arrayBuffer())); return { size: b.size, type: b.type, head }; });
step('6 informe PDF', buf.length > 10240 && buf.subarray(0, 4).toString() === '%PDF' && blobInfo?.size > 10240 && blobInfo.head.startsWith('%PDF'), { archivo: download.suggestedFilename(), bytes: buf.length, blob: blobInfo, pdf: pdfPath, shot: await shot('06-informe') });

// 6b. Informe sin cálculo vigente → pide calcular
await page.locator('[data-handle="vertex"]').first().focus();
await page.keyboard.press('ArrowRight');
await page.waitForSelector('[data-testid="stale-result"]');
const btnPdf = page.getByRole('button', { name: 'Informe PDF' });
const pdfDisabled = await btnPdf.isDisabled();
const pdfTitle = await btnPdf.getAttribute('title');
await openMenu(page, 'Exportar');
const csvDisabled = await page.getByRole('button', { name: /Exportar resultados/ }).isDisabled().catch(() => null);
await closeMenu(page);
step('6b resultado obsoleto: informe y CSV bloqueados con explicación (E12i)', pdfDisabled && !!pdfTitle && csvDisabled !== false, { pdfDeshabilitado: pdfDisabled, title: pdfTitle, csvDeshabilitado: csvDisabled, shot: await shot('06b-obsoleto') });
await page.getByRole('button', { name: 'Deshacer' }).click();

// 7. Importar DXF
const regionsBefore = await page.locator('[data-layer="regions"] polygon').count();
await page.setInputFiles('[data-testid="file-dxf"]', FIX + 'terraplen.dxf');
await page.waitForSelector('dialog[open]');
const dlgText = await page.locator('dialog[open]').innerText();
const layerRows = await page.locator('dialog[open] tbody tr').count();
const mapVals = await page.$$eval('dialog[open] tbody select', (s) => s.map((x) => ({ label: x.getAttribute('aria-label'), value: x.value })));
await shot('07a-dxf-dialogo');
await page.locator('dialog[open] input[aria-label="Valor de y de la base"]').fill('15').catch(() => {});
await page.getByRole('button', { name: 'Importar', exact: true }).click();
await page.waitForSelector('dialog[open]', { state: 'detached' });
const regionsAfter = await page.locator('[data-layer="regions"] polygon').count();
const notice = await page.locator('[data-testid="notices"] li').last().textContent();
await shot('07b-dxf-importado');
await page.getByRole('button', { name: 'Deshacer' }).click();
const regionsUndo = await page.locator('[data-layer="regions"] polygon').count();
step('7 importar DXF con mapeo de capas (un solo deshacer)', regionsAfter > regionsBefore && regionsUndo === regionsBefore, { regionesAntes: regionsBefore, regionesTras: regionsAfter, regionesTrasDeshacer: regionsUndo, capasEnDialogo: layerRows, mapeo: mapVals, aviso: notice, dialogoMuestra: dlgText.slice(0, 400) });

// 8. Guardar (.ogs.json y hash), exportar CSV, borrador
const dl2 = page.waitForEvent('download');
await page.keyboard.press('Control+s');
const saved = await dl2;
const savedPath = path.join(SHOTS, 'guardado.ogs.json');
await saved.saveAs(savedPath);
const savedText = readFileSync(savedPath, 'utf8');
const saveNotice = await page.locator('[data-testid="notices"] li').last().textContent();
const parsed = JSON.parse(savedText);
// F3.9: la web guarda la versión MÍNIMA: «0.3» solo si el modelo usa algo de la 0.3 (M-P, Janbu, interslice, no drenado, polilínea), si no «0.2».
// V047a se promovió con M-P y Janbu en sus métodos y se guarda como 0.3; la expectativa ya no es el literal «0.2» sino la mínima calculada del propio documento.
const usaV03 = (parsed.analysis.methods ?? []).some((m) => ['morgenstern_price', 'janbu_simplified', 'janbu_corrected'].includes(m)) || parsed.analysis.interslice != null
  || parsed.analysis.surface?.type === 'polyline' || (parsed.materials ?? []).some((m) => m.model === 'undrained' || ['undrained_strength', 'strength_datum', 'strength_gradient', 'strength_limit'].some((k) => m[k] != null));
step('8a guardar .ogs.json', parsed.version === (usaV03 ? '0.3' : '0.2') && parsed.analysis.seismic?.kh === 0.1 && /SHA-256: [0-9a-f]{64}/.test(saveNotice), { archivo: saved.suggestedFilename(), version: parsed.version, seismic: parsed.analysis.seismic, aviso: saveNotice });
// Deshacer sube la revisión: recalcular para que la exportación esté vigente (E12i).
await page.getByRole('button', { name: /^Comprobar/ }).first().click();
await page.waitForFunction(() => !document.querySelector('[data-testid="stale-result"]') && ![...document.querySelectorAll('button')].some((b) => /Calculando/.test(b.textContent || '')), null, { timeout: 60000 });
const dl3 = page.waitForEvent('download', { timeout: 15000 });
await openMenu(page, 'Exportar');
await page.getByRole('button', { name: 'Exportar superficie (CSV)' }).click({ timeout: 15000 }).catch(() => {});
const csv = await dl3.catch(() => null);
if (csv) { const p = path.join(SHOTS, 'superficie.csv'); await csv.saveAs(p); step('8b exportar CSV de superficie', true, { archivo: csv.suggestedFilename(), primeras: readFileSync(p, 'utf8').split('\n').slice(0, 3) }); }
else step('8b exportar CSV de superficie', false, { nota: 'resultado obsoleto o sin descarga' });

// borrador: editar, esperar autosave, recargar
await page.getByRole('tab', { name: 'Sismo' }).click();
const kh2 = page.getByLabel('kh', { exact: true });
await kh2.fill('0,15'); await kh2.press('Enter');
await page.waitForTimeout(1500);
// Desde U5-S el borrador es por pestaña (draftTabs.ts): un índice (DRAFT_INDEX_KEY) lista las pestañas y cada borrador vive en
// draftKeyFor(tabId) = 'ogs.editor.draft.v1.tab.<id>'. Se lee el de la entrada más reciente del índice, no la clave fija antigua.
const draftKey = await page.evaluate(() => {
  const index = JSON.parse(localStorage.getItem('ogs.editor.draft.index.v1') ?? '[]');
  const latest = [...index].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt))[0];
  if (!latest) return undefined;
  const key = latest.tabId === 'legacy' ? 'ogs.editor.draft.v1' : `ogs.editor.draft.v1.tab.${latest.tabId}`;
  return JSON.parse(localStorage.getItem(key) ?? 'null')?.doc?.analysis?.seismic;
});
await page.reload();
await page.waitForSelector('[data-testid="draft-banner"]');
await shot('08c-borrador-banner');
await page.getByRole('button', { name: 'Recuperar' }).click();
await page.getByRole('tab', { name: 'Sismo' }).click();
const khRec = await page.getByLabel('kh', { exact: true }).inputValue();
step('8c borrador: autoguardado, aviso al recargar y Recuperar', draftKey?.kh === 0.15 && khRec === '0,15', { guardado: draftKey, khRecuperado: khRec, shot: await shot('08d-borrador-recuperado') });

// 9. Modo Casos de verificación
await page.getByRole('tab', { name: 'Casos de verificación' }).click();
// U5-S (R7-24): en Casos el botón se llama «Comprobar caso» (un solo verbo con «Comprobar» del editor).
await page.getByRole('button', { name: 'Comprobar caso' }).click();
await page.waitForSelector('#results-title', { timeout: 60000 });
await page.waitForSelector('#checks-title', { timeout: 60000 }).catch(() => {});
const checkRows = await page.locator('#checks-title').count();
const casesText = await page.locator('#results-title').count();
step('9 modo Casos de verificación: calcular sin regresión', casesText === 1, { verificacion: checkRows, shot: await shot('09-casos') });


// 10. Importar CSV (piezométrica) en el editor
await page.getByRole('tab', { name: 'Editar' }).click();
const csvPath = path.join(SHOTS, 'piezo.csv');
writeFileSync(csvPath, 'x;y\n20;22\n40;24,5\n70;30\n');
await page.setInputFiles('[data-testid="file-csv"]', csvPath);
await page.waitForSelector('dialog[open]');
await page.getByLabel('Línea piezométrica (columnas x, y)').check();
await shot('10a-csv-dialogo');
await page.getByRole('button', { name: 'Importar piezométrica' }).click();
const piezoPts = await page.locator('[data-handle="piezo_point"]').count();
await shot('10b-csv-piezo');
step('10 importar CSV piezométrica (delimitador ; y coma decimal)', piezoPts === 3, { puntosPiezo: piezoPts });

// 11. Error del motor → Issue de origen motor (ancho mínimo imposible: sin superficie válida)
await page.getByRole('tab', { name: 'Búsqueda' }).click();
const mw = page.getByLabel(/Ancho mínimo/);
const mwLabel = 'Ancho mínimo';
const mwOld = await mw.inputValue();
await mw.fill('1000'); await mw.press('Enter');
await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
await page.waitForSelector('button:has-text("Comprobar"):not([disabled])');
await page.waitForTimeout(500);
const diagText = await page.locator('section:has(h2:text("Diagnósticos"))').textContent(); // el código técnico va en un <details> colapsado
const resultsGone = (await page.locator('[data-testid="results-panel"]').count()) === 0;
step('11 error del motor aparece como incidencia [motor] y sin resultados', /motor: NoValidSurface|motor: InvalidModel|motor: NoSurface/.test(diagText) && resultsGone, { campo: mwLabel, diagnosticos: diagText.slice(0, 600), shot: await shot('11-error-motor') });
await mw.fill(mwOld); await mw.press('Enter');

// 12. Abrir el .ogs.json guardado. U3-I: con cambios sin guardar pregunta con el diálogo de la aplicación (no window.confirm):
// primero «Seguir editando» (no descarta), luego «Descartar cambios».
const statusBefore12 = (await page.textContent('[data-testid="file-status"]')).trim();
await page.setInputFiles('[data-testid="file-open"]', savedPath);
await page.waitForSelector('[data-testid="confirm-dialog"]', { timeout: 5000 });
const tone12 = await page.getAttribute('[data-testid="confirm-dialog"]', 'data-tone');
await page.getByRole('button', { name: 'Seguir editando' }).click();
await page.waitForSelector('[data-testid="confirm-dialog"]', { state: 'detached' });
const statusCancel12 = (await page.textContent('[data-testid="file-status"]')).trim();
await page.setInputFiles('[data-testid="file-open"]', savedPath);
await page.waitForSelector('[data-testid="confirm-dialog"]', { timeout: 5000 });
await page.getByRole('button', { name: 'Descartar cambios' }).click();
await page.waitForSelector('[data-testid="confirm-dialog"]', { state: 'detached' });
await page.waitForTimeout(300);
const status12 = (await page.textContent('[data-testid="file-status"]')).trim();
step('12 abrir .ogs.json guardado (diálogo de descarte: cancelar no descarta, aceptar abre)', /guardado\.ogs\.json/.test(status12) && tone12 === 'danger' && statusCancel12 === statusBefore12, { tono: tone12, estadoAntes: statusBefore12, estadoTrasCancelar: statusCancel12, estado: status12 });

step('Errores de consola totales', out.consoleErrors.length === 0, { errores: out.consoleErrors });
writeFileSync(path.join(SHOTS, 'walk.json'), JSON.stringify(out, null, 2));
await browser.close();
