// R2-I2, recorrido 1 (F4.8, F4.9, F4.11): tablestaca anclada con el WASM real, en claro y en oscuro, con axe.
//   1. dibujar la tablestaca con la herramienta «Dibujar refuerzo» y fijar su fuerza en el panel «Refuerzos»;
//   2. agregar un anclaje activo (adherencia en los últimos 8 m);
//   3. Comprobar (los cinco métodos) y comparar con `ogs analyze` del modelo guardado (1e-9);
//   4. flechas en el lienzo, tabla de fuerzas, texto del límite de F4.8 y PDF (%PDF, tamaño, texto y rasterizado).
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node r2i2_tablestaca.mjs
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { launchTap, start, tab, step, summary, shot, canvasShot, axe, checkReport, openFile, showView, saveBlob, saveText, cli, compare, baseModel, writeModel, viewportOf, setField, fieldOf } from './lib.mjs';

// R11B-07 (E14o-16): la tablestaca trazada en el lienzo ya no se llama «tablestaca-1»: el lienzo y el botón «Agregar» comparten ids (a1, n1, g1, p1, s1).
const T = process.env.TMPDIR;
const LIMIT = /No calcula el empuje sobre el elemento, el empotramiento, el momento flector, la deflexión ni las comprobaciones internas o externas de un muro/;
const model0Clean = ({ text }) => { const r = JSON.parse(text).reinforcements?.[0]; return r?.x1 === r?.x2 && Math.abs(r.y2 - 1) < 1e-9 && r.y2 === 1; };
const live = (page) => page.waitForTimeout(450).then(() => page.textContent('[data-testid="live-polite"]')).then((t) => (t ?? '').trim());

for (const scheme of ['light', 'dark']) {
  const tag = scheme === 'light' ? 'claro' : 'oscuro';
  const { browser, page } = await launchTap({ colorScheme: scheme, theme: scheme });
  await start(page);
  await openFile(page, writeModel(`r2i2-tablestaca-base-${scheme}.ogs.json`, baseModel()));
  await tab(page, 'Refuerzos');
  step(`(${tag}) 0 sin refuerzos: «Sin refuerzos.»`, (await page.getByText('Sin refuerzos.').count()) === 1);

  // 1. Dibujar la tablestaca (cabeza en el terreno, x = 40, y = 10; punta a 9 m de profundidad).
  await page.getByRole('button', { name: 'Dibujar refuerzo', exact: true }).click();
  await page.getByRole('button', { name: 'Tipo a dibujar: Tablestaca' }).click();
  const vp = await viewportOf(page);
  const [hx, hy] = vp.px(40, 10);
  const [tx, ty] = vp.px(40, 1);
  await page.mouse.click(hx, hy);
  step(`(${tag}) 1a cabeza colocada y anunciada`, /Cabeza colocada/.test(await live(page)), { live: await live(page) });
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.mouse.click(tx, ty);
  const ann = await live(page);
  step(`(${tag}) 1b tablestaca creada (un paso) y vuelve a «Seleccionar»`, /Refuerzo 1 \(Tablestaca\) creado/.test(ann) && (await page.getByRole('button', { name: 'Seleccionar', exact: true }).getAttribute('aria-pressed')) !== 'false', { ann });
  step(`(${tag}) 1c tarjeta «Refuerzo 1: Tablestaca» en el panel`, (await page.getByText('Refuerzo 1: Tablestaca').count()) >= 1);
  const handles = await page.$$eval('[data-handle^="reinforcement"]', (g) => g.map((x) => x.getAttribute('aria-label')));
  step(`(${tag}) 1d tres tiradores con nombre estable y la x fija`, handles.length === 3 && /Refuerzo 1 \(Tablestaca\), cabeza: x 40,0 m/.test(handles[0]) && /punta: x 40,0 m/.test(handles[1]) && /centro: x 40,0 m/.test(handles[2]), { handles });
  await setField(page, 1, 'Fuerza de corte', '90');
  await page.waitForTimeout(200);
  step(`(${tag}) 1e fuerza fijada en el panel (90 kN/m)`, (await fieldOf(page, 1, 'Fuerza de corte').inputValue()).replace(',', '.') === '90');
  step(`(${tag}) 1f el panel dice el límite de F4.8`, LIMIT.test((await page.locator('#ea-tabpanel').innerText()).replace(/\s+/g, ' ')));

  // 2. Anclaje activo desde la cabeza de la tablestaca, hacia el lado estable.
  await page.getByRole('button', { name: 'Agregar anclaje', exact: true }).click();
  await page.waitForTimeout(200);
  step(`(${tag}) 2a anclaje nuevo propone end1_capacity = tensile_capacity (E14m-2)`, (await fieldOf(page, 2, 'Capacidad del extremo 1').inputValue()) === (await fieldOf(page, 2, 'Capacidad a tracción').inputValue()), { t: await fieldOf(page, 2, 'Capacidad a tracción').inputValue() });
  for (const [label, v] of [['Cabeza x1', '40'], ['Cabeza y1', '8'], ['Punta x2', '58'], ['Punta y2', '13,5'], ['Capacidad a tracción', '200'], ['Capacidad del extremo 1', '200']]) await setField(page, 2, label, v);
  await page.getByLabel(/^Refuerzo 2: Modelo de arrancamiento/).selectOption('bond');
  await page.waitForTimeout(150);
  await setField(page, 2, 'Resistencia de adherencia por metro', '40');
  await setField(page, 2, 'Longitud adherida', '8');
  await shot(page, `tablestaca-${scheme}-1-panel`);
  const saved = await saveText(page, `r2i2-tablestaca-${scheme}.ogs.json`);
  const model = JSON.parse(saved.text);
  step(`(${tag}) 1g sin ruido de píxel en lo trazado: x 40, y de la punta 1 (redondeo a la escala)`, model0Clean(await saveText(page, `r2i2-tablestaca-${scheme}-0.ogs.json`)));
  step(`(${tag}) 2b modelo 0.4 con tablestaca y anclaje activo con bond`, model.version === '0.4' && model.reinforcements?.length === 2 && model.reinforcements[0].type === 'sheet_pile' && model.reinforcements[1].application === 'active' && model.reinforcements[1].pullout?.model === 'bond' && model.reinforcements[1].pullout.bonded_length === 8 && model.reinforcements[0].force === 90 && !('location' in model.reinforcements[0]), { r: model.reinforcements });
  await axe(page, `panel Refuerzos con tablestaca y anclaje (${tag})`);

  // 3. Calcular.
  const report = await checkReport(page);
  const rows = report.results ?? [];
  step(`(${tag}) 3a cinco métodos convergidos, sin error del motor`, rows.length === 5 && rows.every((r) => r.status === 'converged' && Number.isFinite(r.fos)), { fos: rows.map((r) => [r.method, r.status, r.fos]) });
  const ref = cli(saved.path);
  const cmp = compare(report, ref.results);
  step(`(${tag}) 3b la web da el FS de «ogs analyze» (1e-9) en los cinco métodos`, ref.code === 0 && cmp.length === 5 && cmp.every((c) => c.same), { cmp: cmp.map((c) => [c.method, c.web, c.cli, c.rel]) });
  const wf = rows[0].reinforcement_forces ?? [];
  step(`(${tag}) 3c fuerzas por cruce (JSON: cruce 0; tabla y PDF: cruce 1): tablestaca pasiva y anclaje activo, ambas aplicadas`, wf.length === 2 && wf.every((f) => f.status === 'applied') && wf.find((f) => f.id === 's1')?.application === 'passive' && wf.find((f) => f.id === 'a1')?.application === 'active', { wf });
  step(`(${tag}) 3d el aviso informativo «structural_checks_not_covered» está en cada método`, rows.every((r) => (r.warnings ?? []).includes('structural_checks_not_covered')));

  // 4. Lienzo, tabla, límite, PDF.
  await page.evaluate(() => window.scrollTo(0, 0));
  const arrows = await page.locator('[data-layer="reinforcement-forces"] [data-force-arrow]').count();
  step(`(${tag}) 4a el lienzo dibuja una flecha por fuerza aplicada`, arrows === 2, { arrows });
  const syms = await page.locator('[data-layer="reinforcements"] [data-reinforcement]').evaluateAll((g) => g.map((x) => x.getAttribute('data-reinforcement-type')));
  step(`(${tag}) 4b un símbolo por refuerzo (tablestaca y anclaje)`, syms.join() === 'sheet_pile,anchor', { syms });
  // UA: la tabla de fuerzas y las notas viven en la vista «Resultados»; se abre para leerlas y se vuelve a «Lienzo».
  await showView(page, 'Resultados');
  const tables = await page.locator('[data-testid="reinforcement-forces"] table').count();
  const tableText = (await page.locator('[data-testid="reinforcement-forces"]').innerText()).replace(/\s+/g, ' ');
  step(`(${tag}) 4c una tabla de fuerzas por método con id, tipo, cruce, estación, disponible, aplicada, movilizada y estado (E14o-14)`, tables === 5 && /Id Tipo Cruce Estación \(m\) Disponible \(kN\/m\) Aplicada fx; fy \(kN\/m\) Movilizada fx; fy \(kN\/m\) Aplicación Estado/.test(tableText) && /s1 Tablestaca 1/.test(tableText) && /a1 Anclaje 1/.test(tableText) && /Aplicada/.test(tableText), { tables, tableText: tableText.slice(0, 400) });
  step(`(${tag}) 4d el texto del límite de F4.8 está en los resultados`, LIMIT.test(tableText) && (await page.getByTestId('structural-limit').count()) === 1);
  await page.getByTestId('reinforcement-forces').scrollIntoViewIfNeeded();
  await shot(page, `tablestaca-${scheme}-2-tabla`);
  await axe(page, `tabla de fuerzas en la vista Resultados (${tag})`);
  await showView(page, 'Lienzo');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await shot(page, `tablestaca-${scheme}-3-resultado`);
  await canvasShot(page, `tablestaca-${scheme}-4-lienzo`);
  await axe(page, `resultado con flechas y tabla de fuerzas (${tag})`);

  const n0 = await page.evaluate(() => window.__blobs.length);
  await page.getByRole('button', { name: 'Informe PDF', exact: true }).click();
  await page.waitForFunction((n) => window.__blobs.length > n, n0, { timeout: 60000 });
  const pdf = path.join(T, `r2i2-tablestaca-${scheme}.pdf`);
  await saveBlob(page, 'application/pdf', pdf);
  const head = readFileSync(pdf).subarray(0, 5).toString('latin1');
  const size = statSync(pdf).size;
  step(`(${tag}) 4e PDF con cabecera %PDF y tamaño razonable`, head.startsWith('%PDF') && size > 20000, { head, size });
  const text = spawnSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).stdout.replace(/\s+/g, ' ');
  step(`(${tag}) 4f el PDF trae «Versión del formato 0.4», la sección Refuerzos, la tabla de fuerzas y el límite de F4.8`, /Versión del formato\s*0\.4/.test(text) && /Refuerzos/.test(text) && /Estación/.test(text) && /Disponible/.test(text) && /s1/.test(text) && /a1/.test(text) && LIMIT.test(text), { len: text.length });
  spawnSync('pdftoppm', ['-r', '70', '-png', pdf, path.join(T, 'r2i2-shots', `tablestaca-${scheme}-pdf`)]);
  const csvFile = path.join(T, `r2i2-tablestaca-${scheme}-fuerzas.csv`);
  await page.getByRole('button', { name: 'Exportar', exact: false }).first().click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar fuerzas de refuerzos (CSV)' }).click()]);
  await dl.saveAs(csvFile);
  const csv = readFileSync(csvFile, 'utf8');
  step(`(${tag}) 4g CSV de fuerzas: encabezado y 10 filas (2 cruces × 5 métodos)`, csv.trim().split('\n').length === 11 && /s1/.test(csv) && /a1/.test(csv), { lines: csv.trim().split('\n').length, head: csv.split('\n')[0] });
  step(`(${tag}) sin errores del motor ni de consola`, (await page.evaluate(() => window.__errors.length)) === 0);
  await browser.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
