// U4-M: T2 de X9 completada en Chrome por dos vías (puerto 5186). Talud de 15 m a 1,5H:1V, arcilla (c=25, φ=20, γ=18) sobre roca (c=200, φ=40,
// γ=24), contacto 5 m bajo el pie, piezométrica en el pie; calcular y leer el FS y la profundidad mínima de la superficie.
//   Vía A: «Talud simple…» con «Agregar un estrato inferior».   Vía B: «Talud simple…» de un material y «Dividir región» (D) con el ratón.
import { start, load, openMenu, discardIfAsked, check, num, nRegions, polys, live, viewportOf, surfaceDepth } from './lib.mjs';

const { page, step, shot, finish } = await start('u4m-t2');
await load(page);

async function slopeDialog({ lower }) {
  await openMenu(page, 'Archivo');
  await page.getByRole('button', { name: 'Talud simple…' }).click();
  await page.waitForSelector('dialog[open]');
  await page.getByLabel('Altura H').fill('15');
  await page.getByLabel('Pendiente H:V', { exact: true }).check();
  await page.getByLabel(/Pendiente H:V \(horizontal/).fill('1,5');
  await page.getByLabel('Nombre', { exact: true }).fill('Arcilla');
  await page.getByLabel(/Peso unitario γ/).first().fill('18');
  await page.getByLabel(/Cohesión c/).first().fill('25');
  await page.getByLabel(/Ángulo de fricción φ/).first().fill('20');
  await page.getByLabel('Línea piezométrica').selectOption('toe');
  if (lower) {
    await page.getByLabel('Agregar un estrato inferior (material 2)').check();
    await page.getByLabel('Contacto: profundidad bajo el pie').fill('5');
    await page.getByLabel('Estrato inferior: nombre').fill('Roca');
    await page.getByLabel(/Estrato inferior: peso unitario/).fill('24');
    await page.getByLabel(/Estrato inferior: cohesión/).fill('200');
    await page.getByLabel(/Estrato inferior: ángulo/).fill('40');
  }
  return shot(lower ? 'A-dialogo' : 'B-dialogo');
}
async function create() {
  await page.getByRole('button', { name: 'Crear talud' }).click();
  await discardIfAsked(page);
  await page.waitForSelector('dialog[open]', { state: 'detached' });
}
const fsOf = (res) => res.rows.map((r) => ({ metodo: r[0], fs: num(r[1]), fila: r }));

// ── Vía A ──
const dlgA = await slopeDialog({ lower: true });
const previewRegions = await page.locator('[data-testid="slope-preview"] [data-preview-region]').count();
await create();
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 2);
const polyA = await polys(page);
step('A1 «Talud simple…» con estrato inferior crea 2 regiones (vista previa con 2)', previewRegions === 2 && (await nRegions(page)) === 2, { previewRegions, poligonos: polyA, dlg: dlgA });
await page.getByRole('tab', { name: 'Geometría' }).click();
const cards = await page.locator('[data-region-card]').count();
const mats = await page.locator('[data-region-card] .gp-material').allTextContents();
const swatches = await page.locator('[data-region-card] .gp-swatch').evaluateAll((els) => els.map((e) => e.style.background));
step('A2 el panel Geometría muestra cada región con su material y su muestra de color', cards === 2 && mats.map((t) => t.trim()).join('|') === 'Arcilla|Roca' && swatches.join('|') === 'var(--canvas-mat-0)|var(--canvas-mat-1)', { mats, swatches });
const resA = await check(page);
const depthA = await surfaceDepth(page);
const fa = fsOf(resA);
step('A3 Bishop y Spencer calculan con FS finito (arcilla sobre roca, piezométrica en el pie)', fa.length === 2 && fa.every((x) => Number.isFinite(x.fs) && x.fs > 0.5 && x.fs < 5), { filas: resA.rows.map((r) => r.slice(0, 3)), head: resA.head, shot: await shot('A-resultados') });
step('A4 la superficie crítica no entra en la roca de forma absurda (el contacto está en y = −5)', depthA !== null && depthA.minY > -8, { profundidadMinimaY: depthA?.minY });

// ── Vía B ──
await slopeDialog({ lower: false });
await create();
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 1);
// rejilla de 1 m (Geometría ▸ Ajuste): el corte cae exactamente en y = −5 sobre las aristas verticales
await page.getByRole('tab', { name: 'Geometría' }).click();
await page.getByLabel('Rejilla de ajuste').selectOption('1');
await page.getByRole('button', { name: 'Dividir región', exact: true }).click();
await page.waitForSelector('[data-testid="split-hint"]');
const hint0 = await page.textContent('[data-testid="split-hint"]');
const vp = await viewportOf(page);
const [lx, ly] = vp.px(0, -5);
const [rx, ry] = vp.px(52.5, -5);
await page.mouse.move(lx + 3, ly + 2);
await page.waitForTimeout(80);
const edgeSnap = await page.locator('[data-draw-edge-snap]').count();
await page.mouse.click(lx + 3, ly + 2);
await page.mouse.move((lx + rx) / 2, ly - 40);
await page.waitForTimeout(80);
const rubber = await page.locator('[data-draw-rubber]').count();
await page.mouse.move(rx - 4, ry + 2);
await page.waitForTimeout(80);
const shotSplit = await shot('B-linea');
await page.mouse.click(rx - 4, ry + 2);
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 2);
const anuncio = await live(page);
const polyB = await polys(page);
step('B1 «Dividir región»: un clic en cada borde divide el talud en 2 regiones (ajuste a la arista visible)', edgeSnap === 1 && rubber === 1 && (await nRegions(page)) === 2 && /dividida en dos/.test(anuncio), { hint0, anuncio, poligonos: polyB, shot: shotSplit });
const toolBtnPressed = await page.getByRole('button', { name: 'Seleccionar', exact: true }).first().getAttribute('aria-pressed');
step('B2 al dividir, la herramienta vuelve a «Seleccionar» y la región nueva queda seleccionada', toolBtnPressed === 'true' && (await page.locator('[data-region-card="1"].ep-row-selected').count()) === 1, { toolBtnPressed });
// Deshacer: un solo paso
await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
const afterUndo = await nRegions(page);
await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
step('B3 un solo Deshacer revierte la división entera (y Rehacer la devuelve)', afterUndo === 1 && (await nRegions(page)) === 2, { trasDeshacer: afterUndo });
// Material de la región nueva → roca (tarjeta 2 de Materiales)
await page.getByRole('tab', { name: 'Materiales' }).click();
await page.waitForTimeout(200);
const setField = async (label, i, v) => { const f = page.getByLabel(label, { exact: true }).nth(i); await f.fill(v); await f.press('Enter'); };
await setField('Nombre', 1, 'Roca');
await setField('Peso unitario γ (kN/m³)', 1, '24');
await setField('Cohesión c (kPa)', 1, '200');
await setField('Ángulo de fricción φ (°)', 1, '40');
const resB = await check(page);
const depthB = await surfaceDepth(page);
const fb = fsOf(resB);
const polyBfinal = await polys(page);
step('B4 tras asignar roca a la región nueva, Bishop y Spencer calculan con FS finito', fb.length === 2 && fb.every((x) => Number.isFinite(x.fs)), { filas: resB.rows.map((r) => r.slice(0, 3)), shot: await shot('B-resultados') });
step('B5 el FS de la vía B coincide con el de la vía A (misma geometría y materiales)', fb.every((x, i) => Math.abs(x.fs - fa[i].fs) < 5e-3), { A: fa.map((x) => x.fs), B: fb.map((x) => x.fs) });
step('B6 la superficie crítica de la vía B tampoco entra en la roca', depthB !== null && depthB.minY > -8, { profundidadMinimaY: depthB?.minY, poligonos: polyBfinal });
await finish();
