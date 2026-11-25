// U4-M: «Dividir región» solo con el teclado en Chrome (puerto 5186): D, flechas (cursor de dibujo), Espacio (punto apoyado en la arista),
// Intro (divide), Esc y Retroceso; un mensaje accionable si la línea no atraviesa la región; Ctrl+Z deshace la división de una vez.
import { start, load, nRegions, polys, live, makeSlope, moveCursorTo } from './lib.mjs';

const { page, step, shot, finish } = await start('u4m-split-kbd');
await load(page);
await makeSlope(page);

// D con el foco fuera de un campo
await page.locator('[role="toolbar"]').getByRole('button', { name: 'Seleccionar', exact: true }).focus();
await page.keyboard.press('d');
await page.waitForSelector('[data-testid="split-hint"]');
const focusRole = await page.evaluate(() => document.activeElement?.getAttribute('role'));
const instr = await live(page);
step('1 D elige «Dividir región», el foco pasa al lienzo y se anuncian las instrucciones', focusRole === 'application' && /Dividir región: trace una línea/.test(instr), { focusRole, instr: instr.slice(0, 80) });

// Línea inválida primero: un solo punto dentro y Intro
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft');
await moveCursorTo(page, 20, -5);
await page.keyboard.press(' ');
await page.keyboard.press('Enter');
const hint1 = await page.textContent('[data-testid="split-hint"]');
await moveCursorTo(page, 30, -5);
await page.keyboard.press(' ');
await page.keyboard.press('Enter');
const hint = await page.textContent('[data-testid="split-hint"]');
step('2 una línea que no atraviesa la región no divide y dice qué hacer', (await nRegions(page)) === 1 && /necesita al menos 2 puntos/.test(hint1) && /Empiece y termine fuera de la región o sobre su borde/.test(hint), { conUnPunto: hint1.slice(130, 230), hint: hint.slice(130, 330) });
await page.keyboard.press('Backspace');
await page.keyboard.press('Backspace');
await page.keyboard.press('Escape'); // sin puntos: sale de la herramienta
await page.keyboard.press('d');

// Línea válida: de la arista izquierda a la derecha a y = −5
await moveCursorTo(page, 0, -5);
await page.keyboard.press(' ');
const a1 = await live(page);
await moveCursorTo(page, 52.5, -5);
const shotLine = await shot('linea');
await page.keyboard.press(' ');
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 2);
const a2 = await live(page);
step('3 Espacio en el borde izquierdo y Espacio en el derecho dividen el talud en 2 regiones', /sobre una arista/.test(a1) && /dividida en dos/.test(a2) && (await nRegions(page)) === 2, { primero: a1, anuncio: a2, poligonos: await polys(page), shot: shotLine });

// Ctrl+Z: un solo paso
await page.locator('svg.ec-svg').focus();
await page.keyboard.press('Control+z');
const afterUndo = await nRegions(page);
await page.keyboard.press('Control+Shift+z');
step('4 Ctrl+Z deshace la división de una vez y Ctrl+Mayús+Z la rehace', afterUndo === 1 && (await nRegions(page)) === 2, { afterUndo });

// Intro con puntos colocados: otra división en la región 2 (la de abajo): de (0,−7) a (52,5; −7)
await page.keyboard.press('d');
await moveCursorTo(page, 0, -7);
await page.keyboard.press(' ');
await moveCursorTo(page, 52.5, -7);
await page.keyboard.press('Enter'); // cursor movido: coloca el punto (en el borde) y divide
await page.waitForFunction(() => document.querySelectorAll('[data-layer="regions"] polygon').length === 3, null, { timeout: 5000 }).catch(() => {});
step('5 Intro (con el cursor movido) coloca el último punto sobre el borde y divide: 3 regiones', (await nRegions(page)) === 3, { anuncio: await live(page) });
await finish();
