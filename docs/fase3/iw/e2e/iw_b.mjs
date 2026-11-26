// I-W tareas 1b, 1d, 1f y 1g (Chrome, vite preview en 5186, WASM real): modelo creado desde cero en la web con estrato no drenado
// (Su variable con la cota), superficie polilínea editada en el lienzo, M-P medio seno y Janbu corregido. Calcula, guarda en 0.3, reabre,
// recalcula y compara con `ogs analyze`; convierte SI → imperial; exporta el PDF y los CSV (se revisan después con pymupdf y pandas).
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node iw_b.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { launchTap, start, tab, step, summary, shot, axe, checkReport, openFile, compare, cli, saveText, openMenu, saveBlob } from './lib.mjs';

const T = process.env.TMPDIR;
const OUT = path.join(T, 'iw-b');
mkdirSync(OUT, { recursive: true });
const { browser, page } = await launchTap();
await start(page);

// 1. Talud simple con estrato inferior (contacto a 3 m bajo el pie)
await openMenu(page, 'Archivo');
await page.getByRole('button', { name: 'Talud simple…' }).click();
await page.waitForSelector('dialog[open]');
await page.getByLabel('Agregar un estrato inferior (material 2)').check();
await page.getByLabel('Contacto: profundidad bajo el pie (m)').fill('3');
await page.getByRole('button', { name: 'Crear talud' }).click();
const dlg = page.locator('[data-testid="confirm-dialog"]');
try { await dlg.waitFor({ state: 'visible', timeout: 1200 }); await dlg.getByRole('button', { name: 'Descartar cambios', exact: true }).click(); } catch {}
await page.waitForSelector('dialog[open]', { state: 'detached' });
await page.waitForSelector('[data-vertex-row]');

// 2. Material inferior no drenado con Su variable con la cota
await tab(page, 'Materiales');
const ids = await page.$$eval('fieldset.ep-card legend', (l) => l.map((x) => x.textContent.replace('Material ', '')));
const lower = ids[1];
await page.getByLabel(`Material ${lower}: Modelo`).selectOption('undrained');
const su = page.getByLabel(new RegExp(`^Material ${lower}: Su \\(kPa\\)$`));
await su.fill('30'); await su.press('Enter');
await page.getByLabel(new RegExp(`^Material ${lower}: Su variable con la cota$`)).check();
await page.waitForSelector('[data-path="/materials/1/strength_gradient"]');
const setField = async (p, v) => { const f = page.locator(`[data-path="${p}"]`); await f.fill(v); await f.press('Enter'); };
await setField('/materials/1/strength_datum', '-3');
await setField('/materials/1/strength_gradient', '2,5');
await setField('/materials/1/strength_limit', '90');
const m1 = JSON.parse((await saveText(page, 'iw-b0.ogs.json')).text).materials[1];
step('1b el estrato inferior es no drenado: Su 30, cota -3, gradiente 2,5, límite 90', m1.model === 'undrained' && m1.undrained_strength === 30 && m1.strength_datum === -3 && m1.strength_gradient === 2.5 && m1.strength_limit === 90, { m1 });
await shot(page, 'b-01-materiales');
await axe(page, 'materiales no drenados (claro)');

// 3. Círculo crítico de la búsqueda (CLI sobre el mismo archivo) como superficie fija, luego a polilínea
const c0 = cli(path.join(T, 'iw-b0.ogs.json'));
const circ = c0.results.find((r) => r.method === 'bishop').surface;
await tab(page, 'Superficie');
await page.getByRole('radio', { name: 'Fija', exact: true }).check();
for (const [k, v] of [['xc', circ.xc], ['yc', circ.yc], ['r', circ.r]]) await page.locator(`[data-path="/analysis/surface/${k}"]`).fill(String(v).replace('.', ','));
await page.locator('[data-path="/analysis/surface/r"]').press('Enter');
await page.getByRole('radio', { name: 'Polilínea', exact: true }).check();
await page.waitForSelector('[aria-label="Puntos de la polilínea de falla"]');
const pts0 = JSON.parse((await saveText(page, 'iw-b1.ogs.json')).text).analysis.surface.points;
step('1b la polilínea propuesta (cuerda del círculo) tiene x creciente y ≥ 3 puntos', pts0.length >= 3 && pts0.every((p, i) => i === 0 || p[0] > pts0[i - 1][0]), { n: pts0.length, pts0 });
// 4. Editar la polilínea en el lienzo: arrastrar el vértice central hacia abajo
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForSelector('[data-handle="surface_vertex"]');
// Arrastres con el puntero, sin píxeles fijos. Desde C-W (4ed4440) la polilínea propuesta ya es admisible por construcción (sus puntos
// caen en los vértices del terreno y no se pasa del pie, como antes) y tiene 7 puntos en lugar de 8: arrastrar «s-7» daba TimeoutError
// porque ese tirador ya no existe. Se pide una forma de cuenco por cota objetivo: la escala (px por metro) sale de dos tiradores y los
// vértices interiores bajan hasta el estrato no drenado (contacto en y = -3). Es una edición real del usuario.
const handle = async (key) => { const bb = await page.locator(`[data-handle-key=\"${key}\"]`).boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
const last = pts0.length - 1;
const pxPerM = ((await handle('s-3')).y - (await handle('s-1')).y) / (pts0[1][1] - pts0[3][1]);
const dragTo = async (i, yTarget) => {
  const h = await handle(`s-${i}`);
  await page.mouse.move(h.x, h.y); await page.mouse.down(); await page.mouse.move(h.x, h.y + (pts0[i][1] - yTarget) * pxPerM, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(500);
};
// Cuenco suave: el penúltimo y el antepenúltimo vértice quedan bajo el contacto (-3); los extremos se quedan en el terreno.
const bowl = { 2: 2.0, 3: -1.5, 4: -3.6, 5: -3.8 };
for (const [i, y] of Object.entries(bowl)) if (Number(i) < last) await dragTo(Number(i), y);
const ptsE = JSON.parse((await saveText(page, 'iw-b2.ogs.json')).text).analysis.surface.points;
step('1b los arrastres en el lienzo dieron a la polilínea un cuenco de x creciente que llega bajo el contacto (y < -3)', JSON.stringify(ptsE[2]) !== JSON.stringify(pts0[2]) && ptsE.every((p, i) => i === 0 || p[0] > ptsE[i - 1][0]) && ptsE[5][1] < -3 && ptsE.length === pts0.length, { pts: ptsE });
await shot(page, 'b-02-polilinea-lienzo');

// 5. Métodos: Bishop queda fuera; Spencer, M-P (medio seno) y Janbu corregido
await tab(page, 'Análisis');
await page.getByRole('checkbox', { name: 'Morgenstern-Price', exact: true }).check();
await page.getByRole('checkbox', { name: 'Janbu corregido', exact: true }).check();
const fn = await page.getByLabel('Función de fuerzas entre dovelas f(ξ)').inputValue();
step('1b M-P con «Medio seno» (selector) y Bishop deshabilitado', fn === 'half_sine' && (await page.getByRole('checkbox', { name: 'Bishop simplificado', exact: true }).isDisabled()), { fn });
await shot(page, 'b-03-analisis');
await axe(page, 'análisis con M-P (claro)');

// 6. Guardar en 0.3, calcular, comparar con la CLI
const s1 = await saveText(page, 'iw-b3.ogs.json');
const d1 = JSON.parse(s1.text);
step('1b guardado en formato 0.3 con polilínea, no drenado, M-P y Janbu corregido', d1.version === '0.3' && d1.analysis.surface.type === 'polyline' && d1.analysis.methods.includes('morgenstern_price') && d1.analysis.methods.includes('janbu_corrected') && d1.materials[1].model === 'undrained' && (d1.analysis.interslice === undefined || d1.analysis.interslice.function === 'half_sine'), { version: d1.version, methods: d1.analysis.methods, interslice: d1.analysis.interslice });
const rep1 = await checkReport(page);
const cli1 = cli(s1.path);
const cmp1 = compare(rep1, cli1.results);
step('1b la web calculó los métodos pedidos', cmp1.length === d1.analysis.methods.length && cli1.code === 0, { error: rep1.error, n: cmp1.length, cli: cli1.out.slice(0, 200) });
for (const r of cmp1) step(`1b ${r.method}: FS web = FS CLI (|Δ|rel ≤ 1e-9; ${r.status})`, r.same && r.web !== null, r);
const slices = rep1.results[0].slices ?? [];
step('1b la superficie atraviesa el estrato no drenado (dovelas con el material 1)', slices.some((s) => s.material === 1) && slices.some((s) => s.material === 0), { n: slices.length, mats: [...new Set(slices.map((s) => s.material))] });
step('1b la polilínea ajustada del informe web = la de la CLI', JSON.stringify(rep1.results[0].surface.points) === JSON.stringify(cli1.results[0].surface.points), { n: rep1.results[0].surface.points.length });
await page.evaluate(() => window.scrollTo(0, 0));
await shot(page, 'b-04-resultado');
await writeFileSync(path.join(OUT, 'fs_si.json'), JSON.stringify(cmp1));

// 7. PDF y CSV (modelo b, SI)
await page.getByRole('button', { name: 'Informe PDF' }).click();
await page.waitForFunction(() => window.__blobs.some((x) => x.type === 'application/pdf'), null, { timeout: 60000 });
const pdf = await saveBlob(page, 'application/pdf', path.join(OUT, 'informe-b.pdf'));
step('1f el PDF del modelo b se generó', pdf !== null, { pdf });
await openMenu(page, 'Exportar');
const [d2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar superficie (CSV)' }).click()]);
await d2.saveAs(path.join(OUT, 'superficie.csv'));
await page.waitForTimeout(600); // el menú se cierra tras la descarga; sin esperar, openMenu ve aún aria-expanded=true
await openMenu(page, 'Exportar');
const [d3] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportar resultados (CSV)' }).click()]);
await d3.saveAs(path.join(OUT, 'resultados.csv'));
step('1g los CSV se exportaron', true, { dir: OUT });

// 8. Reabrir el archivo guardado y recalcular: mismo FS
await openFile(page, s1.path);
await tab(page, 'Superficie');
step('1b reabierto, el modelo vuelve con «Polilínea» y sus puntos', (await page.getByRole('radio', { name: 'Polilínea', exact: true }).isChecked()) && (await page.locator('[aria-label="Puntos de la polilínea de falla"] tbody tr').count()) === ptsE.length);
const rep2 = await checkReport(page);
const same = rep2.results.every((r, i) => r.method === rep1.results[i].method && r.fos === rep1.results[i].fos && r.status === rep1.results[i].status);
step('1b reabrir y recalcular da exactamente los mismos FS (bit a bit)', same, { a: rep1.results.map((r) => r.fos), b: rep2.results.map((r) => r.fos) });
const s2 = await saveText(page, 'iw-b4.ogs.json');
step('1b guardar de nuevo reproduce el mismo archivo (byte a byte)', s2.text === s1.text, { n1: s1.text.length, n2: s2.text.length });

// 9. SI → imperial: el FS no cambia
await tab(page, 'Proyecto');
await page.locator('[data-path="/units"]').selectOption('imperial');
await page.getByRole('button', { name: /Convertir los valores/ }).click();
await page.waitForTimeout(300);
const s3 = await saveText(page, 'iw-b5.ogs.json');
const d3m = JSON.parse(s3.text);
step('1d el modelo convertido está en imperial, 0.3, con Su en psf', d3m.units === 'imperial' && d3m.version === '0.3' && Math.abs(d3m.materials[1].undrained_strength - 30 * 20.885434) < 0.05, { su: d3m.materials[1].undrained_strength });
const rep3 = await checkReport(page);
const cli3 = cli(s3.path);
const cmp3 = compare(rep3, cli3.results);
for (const r of rep3.results) {
  const w0 = rep1.results.find((x) => x.method === r.method);
  const rel = Math.abs(r.fos - w0.fos) / Math.abs(w0.fos);
  step(`1d ${r.method}: FS imperial vs FS SI, |Δ|rel ≤ 1e-9`, rel <= 1e-9, { si: w0.fos, imp: r.fos, rel });
}
for (const r of cmp3) step(`1d ${r.method}: FS web imperial = FS CLI del mismo archivo (1e-9)`, r.same, r);
await tab(page, 'Materiales');
step('1d las etiquetas de Su pasan a psf, ft y psf/ft', (await page.getByLabel(`Material ${lower}: Gradiente de Su (psf/ft)`, { exact: true }).count()) === 1);
await shot(page, 'b-05-imperial');
const failed = summary();
await browser.close();
process.exit(failed ? 1 : 0);
