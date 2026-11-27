// R2-I2, recorrido 3 (F4.2, F4.5/E14m-1, F4.9, F4.11): talud con clavos pasivos con `bond`, con el WASM real, en claro y en oscuro, con axe.
// Los clavos se agregan y ajustan en el panel; un tirador se arrastra con el dedo (eventos táctiles reales por CDP) y otro se mueve con las
// flechas. Un clavo empinado (vertical) queda en compresión: estado `compression_ignored` visible en la tabla, en el lienzo y en las notas.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node r2i2_clavos.mjs
import { launchTap, start, tab, step, summary, shot, canvasShot, axe, checkReport, openFile, showView, saveText, cli, compare, baseModel, writeModel, setField, fieldOf } from './lib.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const live = (page) => page.waitForTimeout(450).then(() => page.textContent('[data-testid="live-polite"]')).then((t) => (t ?? '').trim());

for (const scheme of ['light', 'dark']) {
  const tag = scheme === 'light' ? 'claro' : 'oscuro';
  const { browser, ctx, page } = await launchTap({ colorScheme: scheme, theme: scheme, hasTouch: true });
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  await start(page);
  await openFile(page, writeModel(`r2i2-clavos-base-${scheme}.ogs.json`, baseModel((m) => { m.analysis.methods = ['bishop', 'spencer', 'janbu_simplified']; })));
  await tab(page, 'Refuerzos');

  // 1. Tres clavos desde el panel.
  const geometry = [[33, '6,5', 48, '2,5'], [38, 9, 53, 5], [45, '12,5', 50, 8]];
  for (let k = 0; k < 3; k += 1) {
    const n = k + 1;
    await page.getByRole('button', { name: 'Agregar clavo', exact: true }).click();
    await page.waitForTimeout(120);
    const [x1, y1, x2, y2] = geometry[k];
    for (const [label, v] of [['Cabeza x1', x1], ['Cabeza y1', y1], ['Punta x2', x2], ['Punta y2', y2], ['Resistencia de adherencia por metro', '35'], ['Capacidad a tracción', '120']]) await setField(page, n, label, v);
  }
  await setField(page, 1, 'Longitud adherida', '10');
  step(`(${tag}) 1a tres clavos pasivos con adherencia (bond) creados desde el panel`, (await page.locator('fieldset[data-reinforcement-index]').count()) === 3 && (await fieldOf(page, 1, 'Aplicación').inputValue()) === 'passive' && (await fieldOf(page, 1, 'Modelo de arrancamiento').inputValue()) === 'bond');

  // 2. El dedo arrastra la punta del clavo 3 hasta dejarlo vertical (x = 45) y empinado.
  const tipSel = '[data-handle="reinforcement_end"][aria-label^="Refuerzo 3 (Clavo), punta"]';
  const tip = page.locator(tipSel);
  await tip.scrollIntoViewIfNeeded();
  const hb = await tip.boundingBox();
  const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
  const before = await tip.getAttribute('aria-label');
  const canvas = await page.locator('svg.ec-svg').boundingBox();
  // Destino: a 6 m bajo el terreno, en la vertical de la cabeza (x = 45); la escala sale de los tiradores (10,2 px/m aprox.).
  const head = await page.locator('[data-handle="reinforcement_end"][aria-label^="Refuerzo 3 (Clavo), cabeza"]').boundingBox();
  const hxc = head.x + head.width / 2, hyc = head.y + head.height / 2;
  const pxPerM = Math.abs(hx - hxc) / 5 || 10.2;
  const tx = hxc, ty = hyc + 11.5 * pxPerM; // y = 1 (la cabeza está en y = 12,5)
  const scrollY0 = await page.evaluate(() => Math.round(window.scrollY));
  await touch('touchStart', [[hx + 6, hy + 6]]);
  for (let i = 1; i <= 14; i += 1) { await touch('touchMove', [[hx + 6 + ((tx - hx) * i) / 14, hy + 6 + ((ty - hy) * i) / 14]]); await sleep(20); }
  await touch('touchEnd', []);
  await sleep(300);
  const after = await tip.getAttribute('aria-label');
  step(`(${tag}) 2a el dedo arrastra la punta del clavo 3 (la página no se desplaza)`, before !== after && (await page.evaluate(() => Math.round(window.scrollY))) === scrollY0, { before, after });
  step(`(${tag}) 2b la punta queda en la vertical de la cabeza (x 45) y profunda`, /x 45,0 m, y [0-3],\d+ m/.test(after ?? ''), { after });
  step(`(${tag}) 2c un solo paso de historial por arrastre: Deshacer lo devuelve y Rehacer lo repite`, await (async () => {
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click(); await page.waitForTimeout(200);
    const u = await tip.getAttribute('aria-label');
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click(); await page.waitForTimeout(200);
    const r = await tip.getAttribute('aria-label');
    return u === before && r === after;
  })(), {});
  // Toque (tap) sobre la cabeza del clavo 1: selecciona el refuerzo y su tarjeta.
  const h1 = await page.locator('[data-handle="reinforcement_end"][aria-label^="Refuerzo 1 (Clavo), cabeza"]').boundingBox();
  await touch('touchStart', [[h1.x + h1.width / 2, h1.y + h1.height / 2]]);
  await touch('touchEnd', []);
  await sleep(300);
  step(`(${tag}) 2d un toque sobre la cabeza del clavo 1 lo selecciona (tarjeta resaltada)`, (await page.locator('fieldset.ep-row-selected[data-reinforcement-index="0"]').count()) === 1);

  // 3. Flechas: la punta del clavo 1 baja 1 m con Mayús+↓ y 0,1 m con ↓; luego vuelve.
  const tip1 = page.locator('[data-handle="reinforcement_end"][aria-label^="Refuerzo 1 (Clavo), punta"]');
  await tip1.focus();
  const t0 = await tip1.getAttribute('aria-label');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(250);
  const t1 = await tip1.getAttribute('aria-label');
  step(`(${tag}) 3a las flechas mueven la punta del clavo 1 (Mayús ×10: −1,0 m, flecha: −0,1 m)`, /y 2,5 m/.test(t0) && /y 1,4 m/.test(t1), { t0, t1 });
  await page.keyboard.press('Shift+ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(250);
  step(`(${tag}) 3b y la devuelven a su sitio`, /y 2,5 m/.test((await tip1.getAttribute('aria-label')) ?? ''));
  await shot(page, `clavos-${scheme}-1-panel`);
  await axe(page, `panel Refuerzos con tres clavos (${tag})`);

  // 4. Calcular.
  const saved = await saveText(page, `r2i2-clavos-${scheme}.ogs.json`);
  const model = JSON.parse(saved.text);
  step(`(${tag}) 4a modelo 0.4: tres clavos pasivos con bond (el 1 con longitud adherida de 10 m)`, model.version === '0.4' && model.reinforcements.length === 3 && model.reinforcements.every((r) => r.type === 'nail' && r.application === 'passive' && r.pullout?.model === 'bond' && r.pullout.strength === 35) && model.reinforcements[0].pullout.bonded_length === 10, { r: model.reinforcements.map((r) => [r.id, r.x2, r.y2]) });
  const report = await checkReport(page, 120000);
  const rows = report.results ?? [];
  step(`(${tag}) 4b Bishop, Spencer y Janbu simplificado convergen`, rows.length === 3 && rows.every((r) => r.status === 'converged' && r.fos > 1), { fos: rows.map((r) => [r.method, r.fos]) });
  const ref = cli(saved.path);
  const cmp = compare(report, ref.results);
  step(`(${tag}) 4c el FS de la web es el de «ogs analyze» (1e-9)`, ref.code === 0 && cmp.every((c) => c.same), { cmp: cmp.map((c) => [c.method, c.web, c.cli, c.rel]) });
  const forces = rows[0].reinforcement_forces ?? [];
  const states = Object.fromEntries(forces.map((f) => [f.id, f.status]));
  step(`(${tag}) 4d el clavo vertical (n3) queda en compression_ignored y los otros aplicados`, states.n3 === 'compression_ignored' && forces.filter((f) => f.status === 'applied').length >= 1, { states });
  step(`(${tag}) 4e la nota reinforcement_compression_ignored viene del motor en cada método`, rows.every((r) => (r.warnings ?? []).includes('reinforcement_compression_ignored')));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);
  const inactive = await page.locator('[data-layer="reinforcement-forces"] [data-force-status="compression_ignored"] [data-force-inactive]').count();
  const arrows = await page.locator('[data-layer="reinforcement-forces"] [data-force-arrow]').count();
  step(`(${tag}) 4f el lienzo marca el cruce ignorado (aspa gris) y dibuja las flechas de los aplicados`, inactive === 1 && arrows >= 1, { inactive, arrows });
  const lbl = await page.locator('[data-layer="reinforcement-forces"] [data-force-status="compression_ignored"] text').first().textContent();
  step(`(${tag}) 4g el rótulo del cruce dice «ignorada por compresión»`, /ignorada por compresión/.test(lbl ?? ''), { lbl });
  await shot(page, `clavos-${scheme}-2-resultado`);
  await canvasShot(page, `clavos-${scheme}-3-lienzo`);
  // UA: la tabla de fuerzas y las notas viven en la vista «Resultados»; se abre para leerlas y se vuelve a «Lienzo».
  await showView(page, 'Resultados');
  const row = page.locator('[data-testid="reinforcement-forces"] tr.row-warn').first();
  await row.scrollIntoViewIfNeeded();
  const rowText = (await row.innerText()).replace(/\s+/g, ' ');
  step(`(${tag}) 4h la tabla de fuerzas marca la fila «Ignorada por compresión» (aviso, no solo color)`, /n3/.test(rowText) && /compresión/i.test(rowText), { rowText });
  const notes = (await page.locator('[data-testid="results-panel"]').innerText()).replace(/\s+/g, ' ');
  step(`(${tag}) 4i las notas dicen que el refuerzo pasivo queda comprimido y no aporta fuerza`, /quedaría comprimido por el deslizamiento y no aporta fuerza/.test(notes));
  await shot(page, `clavos-${scheme}-4-tabla`);
  await axe(page, `resultado con clavo en compresión (${tag})`);
  await showView(page, 'Lienzo');
  step(`(${tag}) sin errores del motor ni de consola`, (await page.evaluate(() => window.__errors.length)) === 0);
  await browser.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
