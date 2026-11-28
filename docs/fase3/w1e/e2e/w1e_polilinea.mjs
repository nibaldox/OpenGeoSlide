// W1e: superficie polilínea, Bishop deshabilitado, función entre dovelas de M-P, validación local, apertura de 0.3 y vista Casos (Chrome, puerto 5186).
// I-W: la lista de errores de las tablas es ahora un <div role="alert"> con un <ul> dentro (un <ul role="alert"> daba axe «listitem» serious).
// NO pulsa «Comprobar» con polilíneas ni con M-P/Janbu (el motor de esta rama aún no los calcula): comprueba lo que el editor guarda y valida.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { launch, start, newSlope, tab, step, summary, saveText, shot, axe, openMenu } from './lib.mjs';

const { browser, page } = await launch();
await start(page);
await newSlope(page);
const undo = () => page.getByRole('button', { name: 'Deshacer', exact: true }).click();
const redo = () => page.getByRole('button', { name: 'Rehacer', exact: true }).click();
const pt = (i, a) => page.getByLabel(`Polilínea, punto ${i}: ${a}`, { exact: true });
const bishopBox = () => page.getByRole('checkbox', { name: 'Bishop simplificado', exact: true });
const rowsOf = () => page.locator('[aria-label="Puntos de la polilínea de falla"] tbody tr').count();
const points = async () => JSON.parse((await saveText(page, 'w1e-p.ogs.json')).text).analysis.surface;

// 1. Superficie fija con círculo; luego polilínea: tabla de 5 puntos propuesta
await tab(page, 'Superficie');
await page.getByRole('radio', { name: 'Fija', exact: true }).check();
step('1 «Fija» muestra «Círculo» y «Polilínea»', (await page.getByRole('radio', { name: 'Círculo', exact: true }).isChecked()) && (await page.getByRole('radio', { name: 'Polilínea', exact: true }).count()) === 1);
await tab(page, 'Análisis');
step('1b antes: Bishop marcado', await bishopBox().isChecked());
await tab(page, 'Superficie');
await page.getByRole('radio', { name: 'Polilínea', exact: true }).check();
await page.waitForSelector('[aria-label="Puntos de la polilínea de falla"]');
const n0 = await rowsOf();
const xs0 = [];
for (let i = 1; i <= n0; i += 1) xs0.push(Number((await pt(i, 'x').inputValue()).replace(',', '.')));
// C-W (F3A-C): la propuesta ya no es solo la cuerda de 5 puntos del círculo. Para ser admisible por construcción (F3.3) añade un punto en cada
// vértice del terreno que cae dentro del arco (el pie y el codo de la corona): son 5 puntos del arco más esos vértices (7 en este modelo).
step('2 al pasar a polilínea se propone una polilínea admisible: ≥ 5 puntos del arco (más un punto en cada vértice del terreno), con x creciente', n0 >= 5 && xs0.every((x, i) => i === 0 || x > xs0[i - 1]), { n0, xs0 });
await shot(page, '03-polilinea-tabla');
await tab(page, 'Análisis');
step('2b Bishop queda desmarcado y deshabilitado; Spencer marcado (mismo paso)', !(await bishopBox().isChecked()) && (await bishopBox().isDisabled()) && (await page.getByRole('checkbox', { name: 'Spencer', exact: true }).isChecked()));
const note = await page.getByText(/Bishop simplificado no se ofrece en superficies no circulares/).first().isVisible();
step('2c la explicación es visible en el panel Análisis y la casilla la enlaza (aria-describedby)', note && (await bishopBox().getAttribute('aria-describedby')) !== null);
await undo();
await tab(page, 'Superficie');
step('2d un Deshacer devuelve el círculo y Bishop (un solo paso)', (await page.getByRole('radio', { name: 'Círculo', exact: true }).isChecked()) && (await page.locator('[data-path="/analysis/surface/xc"]').count()) === 1);
await tab(page, 'Análisis');
step('2e …y Bishop vuelve a estar marcado', await bishopBox().isChecked());
await redo();
await tab(page, 'Superficie');
await page.waitForSelector('[aria-label="Puntos de la polilínea de falla"]');

// 3. Editar un punto
const y2 = await pt(2, 'y').inputValue();
await pt(2, 'y').fill('-1,5');
await pt(2, 'y').press('Enter');
let surf = await points();
step('3 editar y del punto 2 se guarda (coma decimal) y el archivo es 0.3 con tipo polyline', surf.type === 'polyline' && surf.points[1][1] === -1.5 && surf.points.length === n0, { surf: surf.points });
await undo();
step('3b un Deshacer devuelve el valor anterior', (await pt(2, 'y').inputValue()) === y2);

// 4. x no creciente: error en línea y no se aplica
const xOld = await pt(3, 'x').inputValue();
await pt(3, 'x').fill(await pt(2, 'x').inputValue());
const inv = await pt(3, 'x').getAttribute('aria-invalid');
const errTxt = await page.locator('[aria-label="Puntos de la polilínea de falla"]').locator('xpath=following-sibling::div[@role="alert"]').textContent();
await pt(3, 'x').press('Enter');
surf = await points();
step('4 x no creciente: error de la tabla visible y la tabla no se guarda', inv === 'true' && /ordene los puntos de izquierda a derecha/.test(errTxt) && surf.points[2][0] === Number(xOld.replace(',', '.')), { errTxt });
await pt(3, 'x').press('Escape');
step('4b Esc descarta el borrador', (await pt(3, 'x').inputValue()) === xOld);

// 5. Ordenar por x
const x2 = await pt(2, 'x').inputValue();
const x4 = await pt(4, 'x').inputValue();
await pt(2, 'x').fill(String(Number(x4.replace(',', '.')) + 1).replace('.', ','));
const sortBtn = page.getByRole('button', { name: 'Ordenar por x', exact: true });
const enabledBefore = await sortBtn.isEnabled();
await sortBtn.click();
surf = await points();
const sx = surf.points.map((p) => p[0]);
step('5 «Ordenar por x» reordena las filas y guarda con x creciente', enabledBefore && sx.every((x, i) => i === 0 || x > sx[i - 1]) && (await sortBtn.isDisabled()), { sx });
await undo();

// 6. Agregar y quitar
const before = await rowsOf();
await page.getByRole('button', { name: 'Agregar un punto después del punto 2 de la polilínea', exact: true }).click();
step('6 «Agregar» inserta un punto a medio camino (una fila más)', (await rowsOf()) === before + 1);
await page.getByRole('button', { name: 'Quitar el punto 3 de la polilínea', exact: true }).click();
step('6b «Quitar» quita la fila', (await rowsOf()) === before);
// con 2 puntos no se puede quitar
let removed = 0;
while ((await rowsOf()) > 2) { await page.getByRole('button', { name: 'Quitar el punto 1 de la polilínea', exact: true }).click(); removed += 1; }
step('6c con 2 puntos «Quitar» está deshabilitado', await page.getByRole('button', { name: 'Quitar el punto 1 de la polilínea', exact: true }).isDisabled());
for (let i = 0; i < 2 + removed; i += 1) await undo();
await page.waitForSelector('[aria-label="Puntos de la polilínea de falla"]');

// 7. Teclado: Tab recorre x, y, Agregar, Quitar de la fila; Enter confirma
await pt(1, 'x').focus();
const order = [];
for (let i = 0; i < 5; i += 1) { order.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent)); await page.keyboard.press('Tab'); }
step('7 el teclado recorre x, y, Agregar y Quitar de cada fila', order[0] === 'Polilínea, punto 1: x' && order[1] === 'Polilínea, punto 1: y' && /Agregar un punto después del punto 1/.test(order[2]) && /Quitar el punto 1/.test(order[3]) && order[4] === 'Polilínea, punto 2: x', { order });

// 8. Función entre dovelas de M-P
await tab(page, 'Análisis');
const mp = page.getByRole('checkbox', { name: 'Morgenstern-Price', exact: true });
step('8 sin M-P no hay selector de función', (await page.getByLabel('Función de fuerzas entre dovelas f(ξ)').count()) === 0);
await mp.check();
const sel = page.getByLabel('Función de fuerzas entre dovelas f(ξ)');
step('8b con M-P aparece el selector con «Medio seno» por defecto y las cinco funciones', (await sel.inputValue()) === 'half_sine' && (await sel.locator('option').allTextContents()).join('|') === 'Constante|Medio seno|Seno recortado (mín. 0,35)|Trapezoidal (20 %-80 %)|Definida por puntos');
await sel.selectOption('trapezoidal');
let saved = JSON.parse((await saveText(page, 'w1e-p2.ogs.json')).text);
step('8c elegir «Trapezoidal» guarda interslice y la versión 0.3', saved.version === '0.3' && saved.analysis.interslice.function === 'trapezoidal' && saved.analysis.methods.includes('morgenstern_price'), { interslice: saved.analysis.interslice, methods: saved.analysis.methods });
await sel.selectOption('data_points');
await page.waitForSelector('[aria-label="Puntos de la función entre dovelas"]');
const dpRows = () => page.locator('[aria-label="Puntos de la función entre dovelas"] tbody tr').count();
step('8d «Definida por puntos» muestra la tabla de partida de 3 puntos', (await dpRows()) === 3 && (await page.getByLabel('Función entre dovelas, punto 2: ξ', { exact: true }).inputValue()) === '0,5');
await page.getByLabel('Función entre dovelas, punto 2: ξ', { exact: true }).fill('1,2');
// La regla que falla es «ξ creciente» en el punto 3 (1 no es mayor que 1,2): ese es el campo que se marca.
const dInv = await page.getByLabel('Función entre dovelas, punto 3: ξ', { exact: true }).getAttribute('aria-invalid');
const dErr = await page.locator('[aria-label="Puntos de la función entre dovelas"]').locator('xpath=following-sibling::div[@role="alert"]').textContent();
await page.getByLabel('Función entre dovelas, punto 2: ξ', { exact: true }).press('Enter');
saved = JSON.parse((await saveText(page, 'w1e-p3.ogs.json')).text);
step('8e ξ fuera de orden: error visible y no se guarda', dInv === 'true' && /ξ debe ser estrictamente creciente|terminar en ξ = 1/.test(dErr) && saved.analysis.interslice.points[1][0] === 0.5, { dErr });
await page.getByLabel('Función entre dovelas, punto 2: ξ', { exact: true }).press('Escape');
await page.getByLabel('Función entre dovelas, punto 2: f', { exact: true }).fill('2');
await page.getByLabel('Función entre dovelas, punto 2: f', { exact: true }).press('Enter');
await page.getByRole('button', { name: 'Agregar un punto después del punto 1 de la función entre dovelas', exact: true }).click();
saved = JSON.parse((await saveText(page, 'w1e-p4.ogs.json')).text);
step('8f editar f y agregar un punto: la tabla guardada tiene 4 puntos con ξ creciente', saved.analysis.interslice.points.length === 4 && saved.analysis.interslice.points[1][0] === 0.25 && saved.analysis.interslice.points[2][1] === 2, { points: saved.analysis.interslice.points });
await page.getByLabel('Función entre dovelas, punto 2: f', { exact: true }).fill('-1');
const negMsg = await page.locator('[aria-label="Puntos de la función entre dovelas"]').locator('xpath=following-sibling::div[@role="alert"]').textContent();
step('8g f negativa: «f debe ser igual o mayor que 0»', /f debe ser igual o mayor que 0/.test(negMsg), { negMsg });
await page.getByLabel('Función entre dovelas, punto 2: f', { exact: true }).press('Escape');
await shot(page, '04-mp-puntos');
await mp.uncheck();
saved = JSON.parse((await saveText(page, 'w1e-p5.ogs.json')).text);
step('8h desmarcar M-P quita la función del archivo y el selector desaparece', !('interslice' in saved.analysis) && (await page.getByLabel('Función de fuerzas entre dovelas f(ξ)').count()) === 0);
await undo();
step('8i un Deshacer devuelve M-P y su tabla en un solo paso', await mp.isChecked() && (await dpRows()) === 4);
for (const m of ['Janbu simplificado', 'Janbu corregido']) await page.getByRole('checkbox', { name: m, exact: true }).check();
saved = JSON.parse((await saveText(page, 'w1e-p6.ogs.json')).text);
step('8j los cinco métodos existen; Janbu simplificado y corregido se guardan', saved.analysis.methods.includes('janbu_simplified') && saved.analysis.methods.includes('janbu_corrected'), { methods: saved.analysis.methods });
await page.getByRole('checkbox', { name: 'Janbu simplificado', exact: true }).uncheck();
await page.getByRole('checkbox', { name: 'Janbu corregido', exact: true }).uncheck();

// 9. Abrir archivos: un 0.3 con polilínea + Bishop (inválido), y un 0.2 con campos de 0.3 (rechazado)
const base = JSON.parse((await saveText(page, 'w1e-base.ogs.json')).text);
const bad = JSON.parse(JSON.stringify(base));
bad.analysis.methods = ['bishop', 'spencer'];
delete bad.analysis.interslice;
const f1 = path.join(process.env.TMPDIR, 'w1e-bishop-polilinea.ogs.json');
writeFileSync(f1, JSON.stringify(bad));
await page.getByTestId('file-open').setInputFiles(f1);
const dlg = page.locator('[data-testid="confirm-dialog"]');
try { await dlg.waitFor({ state: 'visible', timeout: 1500 }); await dlg.getByRole('button', { name: 'Descartar cambios', exact: true }).click(); } catch {}
await page.waitForTimeout(500);
await tab(page, 'Análisis');
const diag = await page.locator('main').textContent();
step('9 abrir polilínea + Bishop: Diagnósticos bloquea con el mensaje del motor', /el método 'bishop' solo admite superficies circulares; use spencer, morgenstern_price o janbu/.test(diag));
step('9b …y la casilla de Bishop sigue habilitada (para poder desmarcarla), con el aviso «Desmarque Bishop»', (await bishopBox().isEnabled()) && (await page.getByText('Desmarque Bishop para poder comprobar el modelo.').count()) === 1);
await bishopBox().uncheck();
await page.waitForTimeout(300);
step('9c al desmarcarla se vuelve a deshabilitar y el error del motor desaparece de Diagnósticos', (await bishopBox().isDisabled()) && !/el método 'bishop' solo admite/.test(await page.locator('main').textContent()));
const old = JSON.parse(JSON.stringify(base));
old.version = '0.2';
const f2 = path.join(process.env.TMPDIR, 'w1e-v02-con-campos-v03.ogs.json');
writeFileSync(f2, JSON.stringify(old));
await page.getByTestId('file-open').setInputFiles(f2);
try { await dlg.waitFor({ state: 'visible', timeout: 1200 }); await dlg.getByRole('button', { name: 'Descartar cambios', exact: true }).click(); } catch {}
await page.waitForTimeout(600);
const body = await page.locator('body').textContent();
step('9d abrir un 0.2 con campos de la 0.3: se rechaza con «declara el formato 0.2, que no admite…»', /declara el formato 0\.2, que no admite/.test(body), {});

// 10. Casos: los cinco métodos; con una polilínea fija Bishop se deshabilita
await page.getByRole('tab', { name: 'Casos de verificación' }).click();
const casesBoxes = await page.locator('#mode-cases-panel fieldset input[type="checkbox"]').evaluateAll((els) => els.map((e) => e.closest('label').textContent.trim()));
step('10 Casos ofrece los cinco métodos con las etiquetas de F3.9', casesBoxes.join('|') === 'Bishop simplificado|Spencer|Morgenstern-Price|Janbu simplificado|Janbu corregido', { casesBoxes });
const bishopCases = page.locator('#mode-cases-panel').getByRole('checkbox', { name: 'Bishop simplificado' });
step('10b con un caso circular Bishop está habilitado y marcado', (await bishopCases.isEnabled()) && (await bishopCases.isChecked()));
const f3 = path.join(process.env.TMPDIR, 'w1e-caso-polilinea.json');
writeFileSync(f3, JSON.stringify({ id: 'POLI', title: 'Polilínea fija', model: { ...base, analysis: { ...base.analysis, methods: ['spencer'] } }, checks: [] }));
await page.locator('#mode-cases-panel input[type="file"]').setInputFiles(f3);
await page.waitForTimeout(500);
step('10c cargar un caso con polilínea fija: Bishop se deshabilita con la explicación visible', (await bishopCases.isDisabled()) && (await page.locator('#cases-bishop-note').isVisible()), { nota: await page.locator('#cases-bishop-note').textContent().catch(() => null) });
await shot(page, '05-casos-polilinea');
await axe(page, 'Casos con polilínea (claro)');
await page.locator('#mode-edit').click(); // UA: la pestaña «Editar» pasó a «Lienzo» (id mode-edit, tablist «Vistas»)

// 11. axe en claro con cada panel
await tab(page, 'Superficie');
await axe(page, 'Superficie (polilínea, claro)');
await tab(page, 'Análisis');
await axe(page, 'Análisis (claro)');
await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
await page.waitForSelector('dialog[open]');
const help = await page.locator('dialog[open]').textContent();
step('12 la Ayuda trae el glosario de M-P, función de interfaz, Janbu y f₀, Su y polilínea y la limitación de Bishop', ['Morgenstern-Price (M-P)', 'Función de interfaz f(ξ)', 'Janbu simplificado, Janbu corregido y f₀', 'Su (resistencia no drenada)', 'Superficie polilínea', 'Bishop no se ofrece en superficies no circulares'].every((t) => help.includes(t)));
await shot(page, '06-ayuda');
await axe(page, 'Ayuda (claro)');
const failed = summary();
await browser.close();
process.exit(failed ? 1 : 0);
