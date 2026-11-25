// U4-M: «Dividir región» con toque en Chrome (puerto 5186, contexto táctil 1024×768): dos toques a ≤ 20 px de los bordes dividen la región
// (el ajuste a la arista usa el radio del dedo), y un arrastre con un dedo no coloca puntos (la página sigue desplazándose).
import { start, load, nRegions, live, makeSlope, viewportOf } from './lib.mjs';

const { page, step, shot, finish } = await start('u4m-split-touch', { width: 1024, height: 768 }, { hasTouch: true });
await load(page);
await makeSlope(page);
await page.getByRole('button', { name: 'Dividir región', exact: true }).tap();
await page.waitForSelector('[data-testid="split-hint"]');
const vp = await viewportOf(page);
const [lx, ly] = vp.px(0, -5);
const [rx, ry] = vp.px(52.5, -5);
await page.touchscreen.tap(lx + 18, ly);
await page.waitForTimeout(150);
const a1 = await live(page);
step('1 un toque a 18 px de la arista izquierda coloca el punto sobre ella', /Punto 1 colocado sobre una arista/.test(a1), { anuncio: a1 });
// un arrastre (movimiento > 6 px) no coloca punto
const cdp = await page.context().newCDPSession(page);
const mid = vp.px(26, -3);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mid[0], y: mid[1] }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mid[0] + 40, y: mid[1] + 30 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(150);
const draftPts = await page.locator('[data-layer="split"]').getAttribute('data-points');
step('2 un arrastre con el dedo no coloca puntos', draftPts === '1', { puntos: draftPts });
await page.touchscreen.tap(rx - 18, ry);
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 2, null, { timeout: 5000 }).catch(() => {});
step('3 un segundo toque a 18 px de la arista derecha divide la región en 2', (await nRegions(page)) === 2, { anuncio: await live(page), shot: await shot('dividido') });
await finish();
