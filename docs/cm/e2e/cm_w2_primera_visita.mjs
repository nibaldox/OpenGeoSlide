// CM-W2: lo que encontró la prueba a ciegas de los 5 minutos, comprobado en Chrome con un contexto limpio.
//   A. El HUD nombra el método que rige el FS mínimo (píldora y cifra), sin desbordar a 1440 × 900, 390 × 844 y 320 × 568.
//   B. Importar terraplen.dxf (y regiones.csv) con «Reemplazar» sobre el modelo de arranque sin cambios crea un modelo nuevo:
//      título del archivo, solo sus materiales, sin agua, búsqueda y análisis de «Nuevo» (se lee el .ogs.json que descarga «Guardar»).
//   C. Sobre un documento con cambios, «Reemplazar» sigue cambiando solo las regiones.
//   D. El diálogo del DXF explica la cota de la base de la polilínea abierta y el área de la región.
//   E. «Omitir» cierra la guía al primer clic en cada paso y no deja el texto de ningún paso en la página (en 1440 × 900, 390 × 844,
//      780 × 437 y 320 × 568).
// Uso: OGS_URL=http://127.0.0.1:5185/ OGS_REPO=<repo> [OGS_OUT=<carpeta de capturas>] node cm_w2_primera_visita.mjs
// Salida: líneas «OK …» y «FAIL …» y, al final, «OK=n FAIL=m». Sale con 0 aunque falle: cuente las líneas ^FAIL.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5185/';
const REPO = process.env.OGS_REPO ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const OUT = process.env.OGS_OUT ?? path.join(process.env.TMPDIR ?? '.', 'cm-w2', 'e2e');
fs.mkdirSync(OUT, { recursive: true });
const DXF = path.join(REPO, 'apps/web/src/io/dxf/fixtures/terraplen.dxf');
const CSV = path.join(REPO, 'apps/web/public/examples/regiones.csv');
let ok = 0;
let fail = 0;
const check = (cond, msg, extra) => {
  if (cond) ok += 1;
  else fail += 1;
  console.log(cond ? 'OK  ' : 'FAIL', msg, extra === undefined ? '' : JSON.stringify(extra));
};

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const errors = [];
async function open(w = 1440, h = 900, { seen = true } = {}) {
  const mobile = w <= 760;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'es-ES', isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  if (seen) await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch { /* sin almacenamiento */ } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) errors.push(m.text()); });
  await page.goto(URL_);
  await page.getByText(/ogs-core/).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}
const calc = async (page) => {
  await page.getByRole('button', { name: 'Comprobar', exact: true }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-testid="result-summary"]')?.getAttribute('data-state') === 'current', null, { timeout: 60000 });
  await page.waitForTimeout(500);
};
const openMenu = async (page, name) => {
  const trigger = page.locator('button.dd-trigger', { hasText: new RegExp(`^${name}`) });
  for (let i = 0; i < 3; i += 1) {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
    await page.waitForTimeout(250);
    if ((await trigger.getAttribute('aria-expanded')) === 'true') return;
  }
};
/** Descarga el documento abierto con «Guardar» y lo devuelve ya leído. */
async function savedDoc(page) {
  await openMenu(page, 'Archivo');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByRole('button', { name: /^Guardar/ }).first().click()]);
  const file = path.join(OUT, `guardado_${Date.now()}.ogs.json`);
  await dl.saveAs(file);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
async function importFile(page, kind, file) {
  await openMenu(page, 'Archivo');
  const input = page.locator(`[data-testid="file-${kind}"]`);
  await input.setInputFiles(file);
  await page.locator('dialog[open]').waitFor({ timeout: 15000 });
}
const dialogText = (page) => page.locator('dialog[open]').innerText();
const radioChecked = (page, re) => page.locator('dialog[open] label', { hasText: re }).locator('input').first().isChecked();
const modelTitleText = (page) => page.locator('.ua-main-head').first().innerText().then((t) => t.replace(/\s+/g, ' ').trim());

// ───────── A. El HUD nombra el método ─────────
for (const [w, h] of [[1440, 900], [390, 844], [320, 568]]) {
  for (const ex of ['arranque', 'V001']) {
    const { ctx, page } = await open(w, h);
    if (ex === 'V001') {
      await openMenu(page, 'Archivo');
      const sel = page.locator('select[aria-label="Abrir un caso publicado como modelo"]');
      const v = await page.evaluate(() => [...document.querySelectorAll('select[aria-label="Abrir un caso publicado como modelo"] option')].find((o) => o.textContent.startsWith('V001:'))?.value);
      await sel.selectOption(v);
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }
    await calc(page);
    const read = () => page.evaluate(() => {
      const rs = document.querySelector('[data-testid="result-summary"]');
      const pill = rs.querySelector('.rs-pill');
      const minItems = [...rs.querySelectorAll('.rs-item-min .rs-method')].map((e) => e.textContent.trim());
      return {
        collapsed: rs.getAttribute('data-collapsed') === 'true',
        body: rs.querySelector('[data-testid="fs-min-method"]')?.textContent ?? null,
        pillText: pill ? pill.innerText.replace(/\s+/g, ' ').trim() : null,
        pillLabel: pill?.getAttribute('aria-label') ?? null,
        minItems,
        fsMin: rs.querySelector('[data-testid="fs-min"]')?.textContent ?? null,
        hscroll: document.documentElement.scrollWidth > innerWidth,
        rsRight: Math.round(rs.getBoundingClientRect().right),
        pillOverflow: pill ? pill.scrollWidth > pill.clientWidth + 1 : null,
      };
    });
    let s = await read();
    // Con el HUD desplegado se lee la línea de la cifra; con la píldora, el texto de la píldora. Se comprueban los dos estados.
    const both = [];
    both.push(s);
    const toggle = s.collapsed ? page.locator('.rs-pill') : page.getByRole('button', { name: 'Ocultar resultado' });
    await toggle.click();
    await page.waitForTimeout(300);
    both.push(await read());
    const pillS = both.find((x) => x.collapsed);
    const bodyS = both.find((x) => !x.collapsed);
    const tag = `${w}x${h} ${ex}`;
    check(bodyS?.body !== null && bodyS.body !== '', `A ${tag}: la cifra del HUD desplegado nombra el método («${bodyS?.body}»)`);
    check(pillS?.pillText?.includes(`${pillS.fsMin ?? ''}`) || /^FS mín\. \d,\d{3} · /.test(pillS?.pillText ?? ''), `A ${tag}: la píldora dice «FS mín. n,nnn · método» («${pillS?.pillText}»)`);
    check(pillS?.pillLabel?.startsWith('Mostrar resultado, ') && pillS.pillLabel.includes(pillS.pillText.replace(/ (FS < 1,0|Desactualizado)$/, '')), `A ${tag}: el nombre accesible de la píldora lleva el método`, { label: pillS?.pillLabel });
    check(pillS?.pillLabel?.endsWith(pillS.pillText), `A ${tag}: el nombre accesible termina en el texto visible (WCAG 2.5.3)`);
    // El método de la píldora es el de la fila marcada como mínima (un empate nombra los dos).
    const named = (bodyS.body ?? '').split(' · ');
    const full = { 'M-P': 'Morgenstern-Price', 'Janbu corr.': 'Janbu corregido', Bishop: 'Bishop simplificado', Janbu: 'Janbu simplificado' };
    check(named.length === bodyS.minItems.length && named.every((n) => bodyS.minItems.includes(full[n] ?? n)), `A ${tag}: el método nombrado coincide con la(s) fila(s) del mínimo`, { named, filas: bodyS.minItems });
    if (ex === 'V001') check(bodyS.body === 'Morgenstern-Price' && /· Morgenstern-Price/.test(pillS.pillText), `A ${tag}: con un solo método, su nombre completo`);
    if (ex === 'arranque') check(/ · /.test(bodyS.body), `A ${tag}: en el empate del arranque (0,984) se nombran los dos`);
    check(!pillS.hscroll && !bodyS.hscroll && pillS.rsRight <= w && !pillS.pillOverflow, `A ${tag}: no hay scroll horizontal y la píldora entra en el ancho`, { rsRight: pillS.rsRight });
    await page.screenshot({ path: path.join(OUT, `hud_${tag.replace(' ', '_')}.png`) });
    await ctx.close();
  }
}

// ───────── B. Importar sobre el arranque: modelo nuevo ─────────
{
  const { ctx, page } = await open();
  const rotuloAntes = await modelTitleText(page);
  check(/ACADS/.test(rotuloAntes), 'B arranque: el rótulo del lienzo nombra el ejemplo de arranque', { rotuloAntes });
  await importFile(page, 'dxf', DXF);
  const txt = await dialogText(page);
  check(await radioChecked(page, /Reemplazar/), 'B DXF: «Reemplazar» viene marcado con el arranque sin cambios');
  check(txt.includes('Reemplazar: crea un modelo nuevo con este archivo'), 'B DXF: el rótulo dice «Reemplazar: crea un modelo nuevo con este archivo»');
  check(!txt.includes('Reemplazar las regiones actuales'), 'B DXF: no dice «Reemplazar las regiones actuales»');
  check(/Se creará un modelo nuevo titulado «terraplen»/.test(txt), 'B DXF: el resumen anuncia el título del modelo nuevo');
  // D. La base de la polilínea abierta.
  const help = await page.locator('dialog[open] [data-testid="open-base-help"]').innerText();
  check(/cota mínima del dibujo \(25 m\)/.test(help) && /menos 1 m/.test(help), 'D DXF: explica que la cota sugerida es la mínima del dibujo menos 1', { help });
  check(/TERRENO: 20 m²/.test(help), 'D DXF: dice el área de la región cerrada (TERRENO: 20 m²)');
  check(await page.locator('dialog[open] input[aria-label="Valor de y de la base"]').getAttribute('aria-describedby') !== null, 'D DXF: la explicación describe el campo de la base (aria-describedby)');
  // Al escribir otra base, el área sigue al valor.
  const baseInput = page.locator('dialog[open] input[aria-label="Valor de y de la base"]');
  await baseInput.fill('20');
  await page.waitForTimeout(150);
  const help20 = await page.locator('dialog[open] [data-testid="open-base-help"]').innerText();
  check(/y = 20 m/.test(help20) && !/TERRENO: 20 m²/.test(help20), 'D DXF: con otra base el área cambia', { help20 });
  await baseInput.fill('24');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT, 'dialogo_dxf_base.png') });
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await page.waitForTimeout(600);
  const rotulo = await modelTitleText(page);
  check(/terraplen/.test(rotulo) && !/ACADS|Ejemplo/.test(rotulo), 'B DXF: el rótulo del lienzo pasa a «terraplen» (ya no es el ejemplo)', { rotulo });
  const doc = await savedDoc(page);
  check(doc.meta?.title === 'terraplen', 'B DXF: título = nombre del archivo sin extensión', { title: doc.meta?.title });
  check(JSON.stringify(doc.materials.map((m) => m.name).sort()) === JSON.stringify(['SUELO_1', 'TERRENO', 'arcilla']), 'B DXF: solo los materiales de la importación (sin «Soil»)', { materiales: doc.materials.map((m) => m.name) });
  check(doc.regions.length === 3 && doc.materials.every((m) => doc.regions.some((r) => r.material === m.id)), 'B DXF: 3 regiones y todo material en uso');
  check(doc.water === undefined || doc.water === null, 'B DXF: sin agua');
  check(doc.analysis?.search?.entry == null && doc.analysis?.search?.exit == null && doc.analysis?.search?.n_entry === 15, 'B DXF: búsqueda de un modelo nuevo (ventanas sin fijar, malla 15 × 15 × 10)', { search: doc.analysis?.search });
  check(JSON.stringify(doc.analysis?.methods) === JSON.stringify(['bishop', 'spencer']), 'B DXF: análisis de un modelo nuevo (Bishop y Spencer)', { methods: doc.analysis?.methods });
  await calc(page);
  const fs0 = await page.locator('[data-testid="fs-min"]').innerText();
  check(/^\d,\d{3}$/.test(fs0.trim()), 'B DXF: «Comprobar» da un FS', { fs: fs0 });
  await page.screenshot({ path: path.join(OUT, 'dxf_importado_fs.png') });
  // Un Ctrl+Z devuelve el ejemplo de arranque.
  await page.locator('[data-testid="editor-app"]').press('Control+z').catch(() => {});
  await ctx.close();
}
{
  const { ctx, page } = await open();
  await importFile(page, 'csv', CSV);
  const txt = await dialogText(page);
  check(txt.includes('Reemplazar: crea un modelo nuevo con este archivo') && /titulado «regiones»/.test(txt), 'B CSV: mismo rótulo y título «regiones»');
  const btn = page.getByRole('button', { name: 'Importar regiones', exact: true });
  await btn.click();
  await page.waitForTimeout(600);
  const doc = await savedDoc(page);
  check(doc.meta?.title === 'regiones' && doc.materials.length === 2 && (doc.water ?? null) === null, 'B CSV: modelo nuevo «regiones» con 2 materiales y sin agua', { title: doc.meta?.title, n: doc.materials.length });
  await ctx.close();
}

// ───────── C. Sobre un documento con cambios, «Reemplazar» no cambia de comportamiento ─────────
{
  const { ctx, page } = await open();
  await page.getByRole('tab', { name: 'Geometría', exact: true }).click();
  const xs = '[data-path="/regions/0/polygon/0/x"]';
  await page.fill(xs, '-1');
  await page.press(xs, 'Enter');
  await page.waitForTimeout(400);
  const antes = await savedDoc(page);
  await page.getByRole('tab', { name: 'Geometría', exact: true }).click().catch(() => {});
  await importFile(page, 'dxf', DXF);
  const txt = await dialogText(page);
  check(!(await radioChecked(page, /Reemplazar/)), 'C DXF con cambios: «Agregar» es el destino por defecto');
  check(txt.includes('Reemplazar las regiones actuales (se conservan materiales, agua y análisis)'), 'C DXF con cambios: el rótulo de «Reemplazar» dice qué se conserva');
  check(!txt.includes('crea un modelo nuevo') && !/Se creará un modelo nuevo/.test(txt), 'C DXF con cambios: no anuncia un modelo nuevo');
  await page.locator('dialog[open] label', { hasText: /Reemplazar/ }).click();
  await page.getByRole('button', { name: 'Importar', exact: true }).click();
  await page.waitForTimeout(600);
  const doc = await savedDoc(page);
  check(doc.meta?.title === antes.meta?.title, 'C: se conserva el título', { antes: antes.meta?.title, despues: doc.meta?.title });
  check(JSON.stringify(doc.analysis) === JSON.stringify(antes.analysis), 'C: se conserva el análisis y la búsqueda');
  check(JSON.stringify(doc.water ?? null) === JSON.stringify(antes.water ?? null), 'C: se conserva el agua');
  check(doc.materials.length === antes.materials.length + 3 && antes.materials.every((m) => doc.materials.some((d) => d.id === m.id)), 'C: se conservan los materiales y se agregan los de las capas', { n: doc.materials.length });
  check(doc.regions.length === 3, 'C: las regiones son las del archivo');
  await ctx.close();
}

// ───────── E. «Omitir» en la guía de primera visita ─────────
const tourState = (page) => page.evaluate(() => {
  const t = document.querySelector('[data-testid="guided-tour"]');
  const btn = (n) => { const e = [...(t?.querySelectorAll('button') ?? [])].find((x) => x.textContent.trim() === n); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  return { open: !!t && t.matches(':popover-open'), inDom: !!t, prog: t?.querySelector('.tour-progress')?.textContent ?? null, omitir: btn('Omitir'), anterior: btn('Anterior'), bodyTextTienePaso: /Paso \d de \d/.test(document.body.textContent), bodyHasOmitir: /Omitir/.test(document.body.textContent) };
});
for (const [w, h] of [[1440, 900], [390, 844], [780, 437], [320, 568]]) {
  for (let step = 1; step <= 5; step += 1) {
    for (const how of ['selector', 'coordenadas']) {
      const { ctx, page } = await open(w, h, { seen: false });
      await page.getByTestId('guided-tour').waitFor({ timeout: 10000 });
      await page.waitForTimeout(400);
      for (let i = 1; i < step; i += 1) {
        await page.getByTestId('guided-tour').getByRole('button', { name: 'Siguiente', exact: true }).click();
        await page.waitForTimeout(300);
      }
      const s = await tourState(page);
      if (how === 'selector') await page.getByTestId('guided-tour').getByRole('button', { name: 'Omitir', exact: true }).click();
      else await page.mouse.click(s.omitir.x + s.omitir.w / 2, s.omitir.y + s.omitir.h / 2);
      await page.waitForTimeout(450);
      const a = await tourState(page);
      check(s.prog === `Paso ${step} de 5` && !a.open && !a.inDom && !a.bodyTextTienePaso && !a.bodyHasOmitir, `E ${w}x${h} paso ${step} (${how}): «Omitir» cierra al primer clic y no deja texto de la guía en la página`, { antes: s.prog, despues: a });
      if (how === 'selector' && step === 2 && w === 1440) await page.screenshot({ path: path.join(OUT, 'omitir_paso2_cerrada.png') });
      await ctx.close();
    }
  }
}
{
  // Omitir no reabre la guía al recargar; «Ayuda» la repite desde el paso 1.
  const { ctx, page } = await open(1440, 900, { seen: false });
  await page.getByTestId('guided-tour').waitFor();
  await page.getByTestId('guided-tour').getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.getByTestId('guided-tour').getByRole('button', { name: 'Omitir', exact: true }).click();
  await page.reload();
  await page.getByText(/ogs-core/).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
  check(!(await tourState(page)).inDom, 'E: tras «Omitir» y recargar, la guía no se abre sola');
  await page.getByRole('button', { name: 'Ayuda', exact: true }).first().click();
  await page.getByTestId('help-start-tour').click();
  await page.waitForTimeout(600);
  const again = await tourState(page);
  check(again.open && again.prog === 'Paso 1 de 5', 'E: «Ayuda» repite la guía desde el paso 1', { again: again.prog });
  await page.getByTestId('guided-tour').getByRole('button', { name: 'Omitir', exact: true }).click();
  await page.waitForTimeout(400);
  check(!(await tourState(page)).inDom, 'E: «Omitir» la cierra también cuando se abrió desde la Ayuda');
  await ctx.close();
}

check(errors.length === 0, 'sin errores de página ni de consola', errors.slice(0, 3));
await browser.close();
console.log(`OK=${ok} FAIL=${fail}`);
