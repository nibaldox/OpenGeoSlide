// U4-P: recorrido en Chrome de los hallazgos de pulido (UX-13, UX-19, UX9-02…07). Uso: OGS_URL=http://127.0.0.1:5187/ node u4p_polish.mjs
// Requiere el parche docs/fase2/ux/u4p-e2e/EditorApp_integracion.patch (NoticeList) aplicado a EditorApp.tsx.
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5187/';
const SHOTS = path.join(process.env.TMPDIR, 'u4p-shots');
mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
let fails = 0;
const step = (name, ok, extra) => { if (!ok) fails += 1; console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra === undefined ? '' : ' ' + JSON.stringify(extra)}`); };

async function fresh(theme = 'light', size = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport: size, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem('ogs.theme.v1', t); localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(URL_);
  await page.waitForSelector('[data-testid="editor-app"]');
  await page.waitForSelector('[data-layer="regions"] polygon');
  return { ctx, page };
}
const openFile = (page, name, text) => page.setInputFiles('[data-testid="file-open"]', { name, mimeType: 'application/json', buffer: Buffer.from(text) });
const notices = (page) => page.locator('[data-testid="notices"] li');
async function openMenu(page, name) {
  const t = page.getByRole('button', { name, exact: true });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
}

// ── 1. UX-13: línea y columna del error JSON ───────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await fresh();
  await openFile(page, 'roto.ogs.json', '{\n"a": x}');
  await notices(page).first().waitFor();
  const t1 = (await notices(page).first().innerText()).replace(/\s+/g, ' ');
  step('1a token inválido: «línea 2, columna 6»', /línea 2, columna 6/.test(t1), t1.slice(0, 120));
  await openFile(page, 'roto2.ogs.json', '{\n  "format": "opengeoslide",\n}');
  await page.waitForFunction(() => /línea 3, columna 1\b/.test(document.querySelector('[data-testid="notices"]')?.textContent ?? ''));
  step('1b coma final: «línea 3, columna 1»', true);
  await openFile(page, 'vacio.ogs.json', '   ');
  await page.waitForFunction(() => /está vacío/.test(document.querySelector('[data-testid="notices"]')?.textContent ?? ''));
  step('1c archivo vacío: mensaje de vacío', true);
  await ctx.close();
}

// ── 2. UX9-06: avisos deduplicados, máximo visible, «Ver más» y «Cerrar todos» ────────────────────────────────────
{
  const { ctx, page } = await fresh();
  for (let i = 0; i < 4; i++) { await openFile(page, 'repetido.ogs.json', '{\n"a": x}'); await page.waitForTimeout(150); }
  const n1 = await notices(page).count();
  const count = await page.locator('[data-testid="notice-count"]').first().innerText().catch(() => '');
  step('2a el mismo error 4 veces = 1 aviso con contador «4 veces»', n1 === 1 && /4 veces/.test(count), { n1, count });
  for (let i = 0; i < 4; i++) { await openFile(page, `d${i}.ogs.json`, '{\n' + ' '.repeat(i + 1) + '"a": x}'); await page.waitForTimeout(150); }
  const shown = await notices(page).count();
  const more = await page.getByRole('button', { name: /^Ver \d+ más$/ }).count();
  step('2b con 5 avisos distintos se ven 3 y aparece «Ver 2 más»', shown === 3 && more === 1, { shown, more });
  await page.screenshot({ path: path.join(SHOTS, 'u4p-avisos.png') });
  await page.getByRole('button', { name: /^Ver \d+ más$/ }).click();
  step('2c «Ver más» muestra los 5', (await notices(page).count()) === 5);
  await page.waitForTimeout(7000);
  step('2d los errores no se cierran solos (7 s)', (await notices(page).count()) === 5);
  await page.getByRole('button', { name: 'Cerrar todos' }).click();
  step('2e «Cerrar todos» vacía la lista', (await notices(page).count()) === 0);
  await ctx.close();
}

// ── 3. UX9-02: material nuevo con nombres únicos y foco en el primer campo ────────────────────────────────────────
{
  const { ctx, page } = await fresh();
  await page.getByRole('tab', { name: 'Materiales' }).click();
  await page.getByRole('button', { name: 'Nuevo material…' }).click();
  const focused = await page.evaluate(() => { const e = document.activeElement; return e?.labels?.[0]?.textContent ?? e?.getAttribute('aria-label') ?? null; });
  step('3a el foco va al primer campo de «Nuevo material»', /Nuevo material: Identificador/.test(focused ?? ''), focused);
  const names = await page.evaluate(() => [...document.querySelectorAll('.ep-panel input')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => (e.getAttribute('aria-label') ?? e.labels?.[0]?.textContent ?? '').replace(/\s+/g, ' ').trim()));
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  step('3b ningún nombre accesible repetido en el panel', dup.length === 0 && names.length > 10 && names.includes('Nuevo material: Nombre'), { n: names.length, dup });
  const legend = await page.locator('fieldset.ep-new legend').innerText();
  step('3c leyenda «Nuevo material»', legend.trim() === 'Nuevo material', legend);
  await page.locator('fieldset.ep-new').getByRole('button', { name: 'Cancelar' }).click();
  const back = await page.evaluate(() => document.activeElement?.textContent?.trim());
  step('3d al cancelar el foco vuelve a «Nuevo material…»', back === 'Nuevo material…', back);
  await ctx.close();
}

// ── 4. UX9-03: cargas y la corona ─────────────────────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await fresh();
  await page.getByRole('tab', { name: 'Cargas' }).click();
  await page.getByRole('button', { name: 'Agregar carga distribuida' }).click();
  const hint = (await page.locator('.ep-placement').first().innerText()).replace(/\s+/g, ' ');
  step('4a el formulario indica terreno y corona', /Terreno: x de 20 a 70 m\. Corona: x de 50 a 70 m\./.test(hint), hint);
  const x1 = page.getByLabel('Carga 1: Inicio x1 (m)'), x2 = page.getByLabel('Carga 1: Fin x2 (m)');
  await x1.fill('25'); await x1.press('Enter');
  const note = await page.locator('.ep-note').first().innerText().catch(() => '');
  step('4b una carga sobre el talud avisa que no está sobre la corona', /no queda sobre la corona/.test(note), note);
  await page.getByRole('button', { name: /Usar la corona/ }).first().click();
  step('4c «Usar la corona» rellena x1 = 50 y x2 = 70', (await x1.inputValue()) === '50' && (await x2.inputValue()) === '70', { x1: await x1.inputValue(), x2: await x2.inputValue() });
  await x1.fill('10'); await x1.press('Enter');
  const err = await page.locator('.ep-error').first().innerText().catch(() => '');
  step('4d x1 fuera del terreno: mensaje con el rango', /dentro del ancho del modelo \(de 20 a 70\)/.test(err), err);
  await page.screenshot({ path: path.join(SHOTS, 'u4p-cargas.png') });
  await ctx.close();
}

// ── 5. UX9-04: ejemplos en español ───────────────────────────────────────────────────────────────────────────────
{
  const { ctx, page } = await fresh();
  const status = (await page.locator('.ea-status strong').first().innerText()).trim();
  step('5a título inicial en español', status === 'Ejemplo: ACADS 1(a): talud homogéneo seco', status);
  await openMenu(page, 'Archivo');
  const labels = await page.locator('select[aria-label="Abrir un caso publicado como modelo"] option').allInnerTexts();
  const english = labels.filter((l) => /\b(slope|dry|water table|homogeneous|layer|wall|cutting|surcharge|earth dam|example)\b/i.test(l));
  // El número de ejemplos sale de verification/cases/INDEX.md («Casos convertidos e incluidos: **N**»), no de un literal que se
  // queda viejo con cada promoción (21 → 61 → 93). El selector trae además la opción vacía: N + 1 opciones.
  const repoRoot = process.env.OGS_REPO ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..');
  const nIncluidos = Number(/Casos convertidos e incluidos: \*\*(\d+)\*\*/.exec(readFileSync(path.join(repoRoot, 'verification/cases/INDEX.md'), 'utf8'))?.[1]);
  step(`5b los ${nIncluidos} ejemplos con nombre en español`, Number.isInteger(nIncluidos) && nIncluidos > 0 && labels.length === nIncluidos + 1 && english.length === 0, { n: labels.length, esperado: nIncluidos + 1, english });
  step('5c el id se conserva en el listado', labels.some((l) => l.startsWith('V047a: ACADS 1(a): talud homogéneo seco (Giam y Donald, 1989)')), labels.slice(0, 3));
  await ctx.close();
}

// ── 6. UX9-05: FS con 3 decimales y acceso a la tabla ─────────────────────────────────────────────────────────────
{
  const { ctx, page } = await fresh();
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.waitForSelector('[data-testid="fs-spencer"]', { timeout: 60000 });
  const fs = await page.locator('[data-testid="fs-spencer"]').innerText();
  const fsB = await page.locator('[data-testid="fs-bishop"]').innerText();
  step('6a FS de Bishop y Spencer con 3 decimales', /\d,\d{3}$/.test(fs.trim()) && /\d,\d{3}$/.test(fsB.trim()), { fsB, fs });
  const tbl = await page.locator('[data-results-table] tbody td.num').first().innerText();
  step('6b la tabla también (columna FS)', /^\d,\d{3}$/.test(tbl.trim()), tbl);
  const before = await page.evaluate(() => window.scrollY);
  await page.getByRole('button', { name: 'Ver tabla de resultados' }).click();
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => ({ focus: document.activeElement?.tagName, hasMark: document.activeElement?.hasAttribute('data-results-table'), top: Math.round(document.querySelector('[data-results-table]').getBoundingClientRect().top), scrollY: window.scrollY }));
  step('6c «Ver tabla de resultados» desplaza y enfoca la tabla', info.focus === 'TABLE' && info.hasMark && info.top < 400 && info.scrollY > before, info);
  await ctx.close();
}

// ── 7. UX-19: Instalar app con beforeinstallprompt simulado ───────────────────────────────────────────────────────
{
  const { ctx, page } = await fresh();
  const none = await page.locator('[data-testid="install-app"]').count();
  const prevented = await page.evaluate(() => {
    window.__prompted = 0;
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = async () => { window.__prompted += 1; };
    e.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  await page.waitForSelector('[data-testid="install-app"]', { timeout: 3000 });
  const name = await page.locator('[data-testid="install-app"]').innerText();
  await page.locator('[data-testid="install-app"]').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="install-app"]').length === 0, null, { timeout: 3000 });
  const prompted = await page.evaluate(() => window.__prompted);
  step('7 «Instalar app»: sin oferta no hay botón; con beforeinstallprompt aparece, prompt() se llama una vez y se oculta', none === 0 && prevented && name.trim() === 'Instalar app' && prompted === 1, { none, prevented, name: name.trim(), prompted });
  await ctx.close();
}

// ── 8. UX9-07: dovelas en oscuro (capturas) ───────────────────────────────────────────────────────────────────────
for (const theme of ['dark', 'light']) {
  const { ctx, page } = await fresh(theme);
  await page.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.waitForSelector('[data-testid="fs-bishop"]', { timeout: 60000 });
  await page.waitForTimeout(500);
  const css = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return { edge: s.getPropertyValue('--canvas-slice-edge').trim(), fill: s.getPropertyValue('--canvas-slice-fill').trim() }; });
  await page.locator('[data-testid="editor-canvas"]').screenshot({ path: path.join(SHOTS, `u4p-dovelas-${theme}.png`) });
  await page.locator('ul.legend').first().screenshot({ path: path.join(SHOTS, `u4p-leyenda-${theme}.png`) });
  step(`8 dovelas ${theme}: tokens y capturas`, css.edge !== '', css);
  await ctx.close();
}

await b.close();
console.log(fails === 0 ? 'TODO OK' : `${fails} FALLOS`);
process.exit(fails === 0 ? 0 : 1);
