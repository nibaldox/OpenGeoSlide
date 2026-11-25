// U4-M: dibujar un estrato bajo la base de un talud con «Dibujar región» (UX9-01) en Chrome, puerto 5186. Espacio libre del encuadre,
// ajuste a aristas (vértice compartido en la región vecina), autodesplazamiento al acercar el puntero al borde, teclado con la vista
// que sigue al cursor, un solo paso deshacible y cálculo con el estrato nuevo.
import { start, load, check, num, nRegions, polys, live, viewportOf, makeSlope } from './lib.mjs';

const { page, step, shot, finish } = await start('u4m-draw');
await load(page);
await makeSlope(page);

// 1. Encuadre por defecto: espacio libre bajo la base (≥ 25 % del alto del modelo) y a los lados
let vp = await viewportOf(page);
const [bx, by] = vp.px(0, -10);
const [rx] = vp.px(52.5, 0);
const [, ty] = vp.px(0, 15);
const alto = 25 * vp.scale;
const bajo = vp.box.y + vp.box.height - by;
step('1 el encuadre deja ≥ 25 % del alto del modelo bajo la base y a los lados', bajo >= 0.25 * alto - 1 && bx - vp.box.x >= 0.25 * alto - 1 && vp.box.x + vp.box.width - rx >= 0.25 * alto - 1, { bajoPx: Math.round(bajo), cuartoPx: Math.round(0.25 * alto), ladoIzq: Math.round(bx - vp.box.x), ladoDer: Math.round(vp.box.x + vp.box.width - rx), arribaPx: Math.round(ty - vp.box.y), escala: vp.scale });

// 2. Dibujar región con el ratón: tres puntos sobre la base (vértice, arista, vértice)
await page.getByRole('button', { name: 'Dibujar región', exact: true }).click();
await page.waitForSelector('[data-testid="draw-hint"]');
const click = async (x, y) => { const [sx, sy] = vp.px(x, y); await page.mouse.move(sx, sy); await page.waitForTimeout(60); await page.mouse.click(sx, sy); };
await click(0, -10);
const [mx, my] = vp.px(20, -10);
await page.mouse.move(mx + 2, my - 3);
await page.waitForTimeout(80);
const edgeSnap = await page.locator('[data-draw-edge-snap]').count();
await page.mouse.click(mx + 2, my - 3);
const anuncio2 = await live(page);
await click(52.5, -10);
step('2 el punto cerca de la base se apoya en la arista (indicador y anuncio)', edgeSnap === 1 && /sobre una arista/.test(anuncio2), { edgeSnap, anuncio: anuncio2 });

// 3. Autodesplazamiento: el puntero a menos de 24 px del borde inferior desplaza la vista
const before = (await viewportOf(page)).ty;
const bottomY = vp.box.y + vp.box.height - 6;
await page.mouse.move(vp.px(30, 0)[0], bottomY);
await page.waitForTimeout(900);
const scrolled = (await viewportOf(page));
step('3 con el puntero a 6 px del borde inferior la vista se desplaza sola (aparece espacio bajo la base)', scrolled.ty < before - 40, { tyAntes: Math.round(before), tyDespues: Math.round(scrolled.ty) });
await page.mouse.move(vp.px(30, 0)[0], vp.box.y + vp.box.height - 120); // fuera de la franja: se detiene
await page.waitForTimeout(150);
const stopA = (await viewportOf(page)).ty;
await page.waitForTimeout(300);
const stopB = (await viewportOf(page)).ty;
step('3b al salir de la franja el desplazamiento se detiene', Math.abs(stopA - stopB) < 0.5, { stopA, stopB });
vp = await viewportOf(page);

// 4. Puntos fuera de la extensión original: (52,5; y) debajo de la base y (0; y); cierre con Intro
const [, yLow] = vp.px(0, 0);
const worldY = vp.world(0, vp.box.y + vp.box.height - 120)[1];
await page.mouse.click(vp.px(52.5, worldY)[0], vp.box.y + vp.box.height - 120);
await page.mouse.move(vp.px(0, worldY)[0], vp.box.y + vp.box.height - 120);
await page.waitForTimeout(80);
await page.mouse.click(vp.px(0, worldY)[0], vp.box.y + vp.box.height - 120);
const hint = await page.textContent('[data-testid="draw-hint"]');
await page.keyboard.press('Enter');
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 2);
const fin = await live(page);
step('4 Intro cierra la región con puntos fuera de la extensión del modelo; comparte un vértice con la región 1', /5 puntos/.test(hint) && (await nRegions(page)) === 2 && /Comparte un vértice con la región 1/.test(fin), { hint: hint.slice(0, 90), anuncio: fin, shot: await shot('estrato') });
await page.getByRole('tab', { name: 'Geometría' }).click();
await page.locator('[data-region-card="0"] button', { hasText: 'Seleccionar en el lienzo' }).click();
const filas = await page.locator('[data-vertex-row]').count();
step('4b la región vecina recibió el vértice compartido: 7 vértices (antes 6)', filas === 7, { filas });

// 5. Un solo paso deshacible
await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
const trasUndo = await nRegions(page);
await page.locator('[data-region-card="0"] button', { hasText: 'Seleccionar en el lienzo' }).click();
const filasUndo = await page.locator('[data-vertex-row]').count();
await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
step('5 un solo Deshacer quita el estrato y el vértice compartido (y Rehacer los devuelve)', trasUndo === 1 && filasUndo === 6 && (await nRegions(page)) === 2, { trasUndo, filasUndo });

// 6. Calcula con el estrato nuevo
const res = await check(page);
const fs = res.rows.map((r) => num(r[1]));
step('6 el modelo con el estrato dibujado calcula con FS finito en Bishop y Spencer', fs.length === 2 && fs.every((x) => Number.isFinite(x)), { filas: res.rows.map((r) => r.slice(0, 3)), shot: await shot('resultados') });

// 7. Teclado: el cursor llega bajo el borde y la vista lo sigue
await page.getByRole('button', { name: 'Encuadrar' }).click();
await page.getByRole('button', { name: 'Dibujar región', exact: true }).click();
await page.waitForSelector('[data-testid="draw-hint"]');
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
vp = await viewportOf(page);
for (let i = 0; i < 4; i += 1) { await page.keyboard.down('Control'); await page.keyboard.press('ArrowDown'); await page.keyboard.up('Control'); }
const cur = await page.evaluate(() => { const c = document.querySelector('[data-draw-cursor] path'); const r = c.getBoundingClientRect(); const s = document.querySelector('svg.ec-svg').getBoundingClientRect(); return { top: r.top - s.top, bottom: s.bottom - r.bottom, h: s.height }; });
const anuncioCursor = await live(page);
step('7 con el teclado, 40 m abajo, la vista sigue al cursor y lo deja a ≥ 24 px del borde', cur.bottom >= 24 - 1 && cur.top >= 0 && /Cursor: x .*y -/.test(anuncioCursor), { cur, anuncioCursor });
await page.keyboard.press('Escape');
await finish();
