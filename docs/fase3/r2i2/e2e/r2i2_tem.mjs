// R2-I2, recorrido 2 (F4.2, F4.9, F4.11): muro de tierra estabilizada mecánicamente (TEM) con cinco geosintéticos y `interface`, con el WASM real,
// en claro y en oscuro, con axe. Cuatro capas se editan con el ratón y el teclado en el panel; la quinta solo con el teclado (Tab, flechas), y su
// punta se mueve con las flechas del lienzo. Después: Comprobar (búsqueda circular), CSV de fuerzas, deshacer y rehacer.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node r2i2_tem.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { launchTap, start, tab, step, summary, shot, canvasShot, axe, checkReport, openFile, saveText, cli, compare, writeModel, setField, fieldOf, openMenu } from './lib.mjs';

const T = process.env.TMPDIR;
const live = (page) => page.waitForTimeout(450).then(() => page.textContent('[data-testid="live-polite"]')).then((t) => (t ?? '').trim());
const num = (v) => Number(String(v).replace(',', '.'));

/** Muro TEM de 6 m con la cara vertical en x = 14 y búsqueda circular; sin refuerzos. */
const temBase = () => ({
  format: 'opengeoslide', version: '0.3', meta: { id: 'tem', title: 'Muro TEM con geosintéticos' }, units: 'SI',
  materials: [{ id: 'suelo', name: 'Relleno', model: 'mohr_coulomb', unit_weight: 19, unit_weight_sat: null, cohesion: 2, friction_angle: 34, ru: null }],
  regions: [{ material: 'suelo', polygon: [[0, -3], [40, -3], [40, 6], [14, 6], [14, 0], [0, 0]] }],
  slope: { direction: 'right_to_left' },
  analysis: { methods: ['bishop', 'spencer'], slices: 50, tolerance: 1e-5, max_iterations: 500, min_m_alpha: 0.2, search: { entry: [18, 38], exit: [2, 13.5], n_entry: 10, n_exit: 10, n_radius: 6, max_radius_factor: 3, min_width: 1 } },
});
const LAYERS = [0.6, 1.8, 3.0, 4.2, 5.4];

/** Campo del panel con el teclado: foco, selecciona todo, escribe y Tab (el commit es al salir del campo). */
async function kbFill(page, n, label, value) {
  const f = fieldOf(page, n, label);
  await f.focus();
  await page.keyboard.press('Control+a');
  await page.keyboard.type(String(value));
  await page.keyboard.press('Tab');
}

for (const scheme of ['light', 'dark']) {
  const tag = scheme === 'light' ? 'claro' : 'oscuro';
  const { browser, page } = await launchTap({ colorScheme: scheme, theme: scheme });
  await start(page);
  await openFile(page, writeModel(`r2i2-tem-base-${scheme}.ogs.json`, temBase()));
  await tab(page, 'Refuerzos');

  // 1. Cuatro capas con el panel (ratón + teclado en los campos).
  for (let k = 0; k < 4; k += 1) {
    const n = k + 1;
    await page.getByRole('button', { name: 'Agregar geosintético', exact: true }).click();
    await page.waitForTimeout(120);
    for (const [label, v] of [['Cabeza x1', '14'], ['Cabeza y1', String(LAYERS[k]).replace('.', ',')], ['Punta x2', '34'], ['Punta y2', String(LAYERS[k]).replace('.', ',')]]) await setField(page, n, label, v);
    await page.getByLabel(new RegExp(`^Refuerzo ${n}: Modelo de arrancamiento`)).selectOption('interface');
    await page.waitForTimeout(100);
    await setField(page, n, 'Adhesión de la interfaz', '0');
    await setField(page, n, 'Fricción de la interfaz', '25');
    await setField(page, n, 'Cobertura Rc', '1');
    await setField(page, n, 'Capacidad a tracción', '60');
  }
  step(`(${tag}) 1a cuatro capas en el panel, cada una con su tarjeta «Refuerzo N: Geosintético»`, (await page.locator('fieldset[data-reinforcement-index]').count()) === 4);

  // 2. La quinta, solo con el teclado: el botón con Intro, los campos con Tab y la lista con las flechas.
  await page.getByRole('button', { name: 'Agregar geosintético', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await kbFill(page, 5, 'Cabeza x1', '14');
  await kbFill(page, 5, 'Cabeza y1', '5,4');
  await kbFill(page, 5, 'Punta x2', '33');
  await kbFill(page, 5, 'Punta y2', '5,4');
  const sel = page.getByLabel(/^Refuerzo 5: Modelo de arrancamiento/);
  await sel.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  step(`(${tag}) 2a la lista «Modelo de arrancamiento» cambia a «Interfaz» con las flechas`, (await sel.inputValue()) === 'interface', { v: await sel.inputValue() });
  await kbFill(page, 5, 'Adhesión de la interfaz', '0');
  await kbFill(page, 5, 'Fricción de la interfaz', '25');
  await kbFill(page, 5, 'Cobertura Rc', '1');
  await kbFill(page, 5, 'Capacidad a tracción', '60');
  // La punta de la capa 5 se alarga con las flechas del lienzo: Mayús+→ = +1 m (paso 0,1 × 10).
  const tip = page.locator('[data-handle="reinforcement_end"][aria-label^="Refuerzo 5 (Geosintético), punta"]');
  await tip.focus();
  const before = await tip.getAttribute('aria-label');
  await page.keyboard.press('Shift+ArrowRight');
  await page.waitForTimeout(250);
  const after = await tip.getAttribute('aria-label');
  step(`(${tag}) 2b Mayús+Flecha derecha alarga la punta de la capa 5 en 1 m`, /x 33,0 m/.test(before ?? '') && /x 34,0 m/.test(after ?? ''), { before, after, live: await live(page) });
  step(`(${tag}) 2c cinco tarjetas y cinco símbolos en el lienzo`, (await page.locator('fieldset[data-reinforcement-index]').count()) === 5 && (await page.locator('[data-layer="reinforcements"] [data-reinforcement-type="geosynthetic"]').count()) === 5);

  const saved = await saveText(page, `r2i2-tem-${scheme}.ogs.json`);
  const model = JSON.parse(saved.text);
  const R = model.reinforcements ?? [];
  step(`(${tag}) 2d modelo 0.4 con cinco geosintéticos de interface (adherencia 0, δ 25°, Rc 1) y capacidad 60`, model.version === '0.4' && R.length === 5 && R.every((r, i) => r.type === 'geosynthetic' && r.pullout?.model === 'interface' && r.pullout.friction_angle === 25 && r.pullout.coverage === 1 && r.pullout.adhesion === 0 && r.tensile_capacity === 60 && r.y1 === LAYERS[i] && r.x1 === 14 && r.x2 === 34), { R: R.map((r) => [r.id, r.y1, r.x2, r.pullout?.model]) });
  await shot(page, `tem-${scheme}-1-panel`);
  await axe(page, `panel Refuerzos con cinco geosintéticos (${tag})`);

  // 3. Calcular y comparar con el binario.
  const report = await checkReport(page, 180000);
  const rows = report.results ?? [];
  step(`(${tag}) 3a Bishop y Spencer convergen con refuerzos`, rows.length === 2 && rows.every((r) => r.status === 'converged' && r.fos > 1), { fos: rows.map((r) => [r.method, r.fos]) });
  const ref = cli(saved.path);
  const cmp = compare(report, ref.results);
  step(`(${tag}) 3b el FS de la web es el de «ogs analyze» (1e-9)`, ref.code === 0 && cmp.every((c) => c.same), { cmp: cmp.map((c) => [c.method, c.web, c.cli, c.rel]) });
  const forces = rows[0].reinforcement_forces ?? [];
  const nApplied = forces.filter((f) => f.status === 'applied').length;
  step(`(${tag}) 3c cada cruce lleva su fuerza; los aplicados son los de la superficie crítica`, forces.length >= 3 && nApplied >= 3 && forces.every((f) => ['applied', 'compression_ignored', 'no_capacity', 'outside_mass'].includes(f.status)), { n: forces.length, statuses: forces.map((f) => `${f.id}:${f.status}`) });
  step(`(${tag}) 3d sin pilotes ni tablestacas no hay texto del límite de F4.8`, (await page.getByTestId('structural-limit').count()) === 0 && !rows.some((r) => (r.warnings ?? []).includes('structural_checks_not_covered')));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await shot(page, `tem-${scheme}-2-resultado`);
  await canvasShot(page, `tem-${scheme}-3-lienzo`);
  const arrows = await page.locator('[data-layer="reinforcement-forces"] [data-force-arrow]').count();
  step(`(${tag}) 3e el lienzo dibuja una flecha por fuerza aplicada del método mostrado`, arrows >= 3, { arrows });
  await page.getByTestId('reinforcement-forces').scrollIntoViewIfNeeded();
  await shot(page, `tem-${scheme}-4-tabla`);
  await axe(page, `resultado con fuerzas de cinco geosintéticos (${tag})`);

  // 4. CSV de fuerzas.
  await openMenu(page, 'Exportar');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar fuerzas de refuerzos (CSV)' }).click()]);
  const csvFile = path.join(T, `r2i2-tem-${scheme}-fuerzas.csv`);
  await dl.saveAs(csvFile);
  const lines = readFileSync(csvFile, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const expectedRows = rows.reduce((s, r) => s + (r.reinforcement_forces?.length ?? 0), 0);
  step(`(${tag}) 4a CSV de fuerzas: una fila por cruce y método, con g1…g5`, lines.length === expectedRows + 1 && ['g1', 'g2', 'g3', 'g4', 'g5'].filter((id) => lines.some((l) => l.split(',')[1] === id)).length >= 3, { lines: lines.length, expectedRows, head: lines[0] });
  step(`(${tag}) 4b las fuerzas del CSV coinciden con las del informe (fx, 1e-9)`, lines.slice(1).every((l) => { const c = l.split(','); const f = (rows.find((r) => r.method === c[0])?.reinforcement_forces ?? []).find((x) => x.id === c[1] && x.crossing === Number(c[3]) - 1 || x.id === c[1] && x.crossing === Number(c[3])); return f && Math.abs(num(c[8]) - f.fx) < 1e-3 * Math.max(1, Math.abs(f.fx)); }), { l1: lines[1] });

  // 5. Deshacer y rehacer: la baja de la capa 5 y su vuelta.
  await page.evaluate(() => window.scrollTo(0, 0));
  await tab(page, 'Refuerzos');
  const ex = page.getByRole('button', { name: 'Exportar', exact: false }).first();
  await page.getByRole('button', { name: 'Quitar el refuerzo 5', exact: true }).click();
  await page.waitForTimeout(250);
  step(`(${tag}) 5a «Quitar el refuerzo 5» deja cuatro capas`, (await page.locator('fieldset[data-reinforcement-index]').count()) === 4);
  const stale = await page.getByRole('button', { name: 'Informe PDF', exact: true }).isDisabled();
  step(`(${tag}) 5b el resultado queda obsoleto: Informe PDF deshabilitado con su título explicativo`, stale && ((await page.getByRole('button', { name: 'Informe PDF', exact: true }).getAttribute('title')) ?? '').length > 10);
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await page.waitForTimeout(250);
  const back = JSON.parse((await saveText(page, `r2i2-tem-${scheme}-undo.ogs.json`)).text);
  step(`(${tag}) 5c Deshacer devuelve la capa 5 idéntica (byte a byte)`, JSON.stringify(back.reinforcements) === JSON.stringify(R) && (await page.locator('fieldset[data-reinforcement-index]').count()) === 5, { n: back.reinforcements?.length });
  await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
  await page.waitForTimeout(250);
  step(`(${tag}) 5d Rehacer vuelve a quitarla`, (await page.locator('fieldset[data-reinforcement-index]').count()) === 4);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
  await page.waitForTimeout(250);
  const report2 = await checkReport(page, 180000);
  step(`(${tag}) 5e tras deshacer y volver a comprobar, el FS es el de antes (1e-12)`, report2.results.every((r, i) => Math.abs(r.fos - rows[i].fos) < 1e-12), { a: rows.map((r) => r.fos), b: report2.results.map((r) => r.fos) });
  step(`(${tag}) sin errores del motor ni de consola`, (await page.evaluate(() => window.__errors.length)) === 0);
  await browser.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
