// W1e: material no drenado en el editor (Chrome, puerto 5186): selector de modelo, un solo paso deshacible, Su variable con la cota y cálculo
// con círculo (Bishop y Spencer) comparado con `ogs analyze` sobre el mismo archivo guardado. No pulsa «Comprobar» con polilíneas ni con M-P/Janbu.
import { launch, start, newSlope, tab, step, summary, num, saveText, cli, check, shot, axe } from './lib.mjs';

const { browser, page } = await launch();
await start(page);
await newSlope(page);
await tab(page, 'Materiales');
const cards = page.locator('fieldset.ep-card');
const nCards = await cards.count();
step('1 hay tarjetas de material con selector «Modelo» (Mohr-Coulomb por defecto)', nCards >= 1 && (await page.getByLabel(/^Material .*: Modelo$/).first().inputValue()) === 'mohr_coulomb', { nCards });

// 2. Cambiar el modelo del primer material: un solo paso deshacible
const ids = await page.$$eval('fieldset.ep-card legend', (l) => l.map((x) => x.textContent.replace('Material ', '')));
const id0 = ids[0];
const modelSel = page.getByLabel(`Material ${id0}: Modelo`);
const cohName = new RegExp(`^Material ${id0}: Cohesión c`);
await modelSel.selectOption('undrained');
await page.waitForSelector(`[data-path="/materials/0/undrained_strength"]`);
const suField = page.getByLabel(new RegExp(`^Material ${id0}: Su \\(kPa\\)$`));
step('2 «No drenado (Su)» muestra Su (kPa) y oculta cohesión y φ', (await suField.count()) === 1 && (await page.getByLabel(cohName).count()) === 0 && (await page.locator('[data-path="/materials/0/friction_angle"]').count()) === 0, { su: await suField.inputValue() });
await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
step('2b un Deshacer devuelve a Mohr-Coulomb (un solo paso)', (await modelSel.inputValue()) === 'mohr_coulomb' && (await page.getByLabel(cohName).count()) === 1);
await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
step('2c Rehacer vuelve a no drenado', (await modelSel.inputValue()) === 'undrained');

// 3. Editar Su y pasar el segundo material a no drenado
await suField.fill('40');
await suField.press('Enter');
step('3 Su editable', (await suField.inputValue()) === '40');
const sh1 = await shot(page, '01-materiales-no-drenado');

// 4. Su inválida: error en línea y no se aplica
await suField.fill('-3');
const inv = await suField.getAttribute('aria-invalid');
const msg = await page.locator('fieldset.ep-card').first().locator('.ep-error').first().textContent();
await suField.press('Enter');
await suField.press('Escape');
step('4 Su negativa: error en línea con el rango y sin aplicar', inv === 'true' && /Su: use un valor igual o mayor que 0/i.test(msg) && (await suField.inputValue()) === '40', { msg });

// 5. Comprobar con búsqueda (por defecto) y comparar con el CLI
const saved1 = await saveText(page, 'w1e-1.ogs.json');
const doc1 = JSON.parse(saved1.text);
step('5 el archivo guardado es 0.3 con model undrained y sin cohesión ni fricción', doc1.version === '0.3' && doc1.materials[0].model === 'undrained' && doc1.materials[0].undrained_strength === 40 && !('cohesion' in doc1.materials[0]), { version: doc1.version, material: doc1.materials[0] });
const cli1 = cli(saved1.path);
const rows1 = await check(page);
const web1 = Object.fromEntries(rows1.map((r) => [r[0], num(r[1])]));
const bishop1 = cli1.results.find((r) => r.method === 'bishop');
const spencer1 = cli1.results.find((r) => r.method === 'spencer');
step('5b Comprobar (búsqueda, no drenado): FS de Bishop y Spencer igual que ogs analyze (4 cifras)', cli1.code === 0 && Math.abs(web1['Bishop simplificado'] - bishop1.fos) < 5e-4 && Math.abs(web1['Spencer'] - spencer1.fos) < 5e-4, { web: web1, cli: [bishop1?.fos, spencer1?.fos], filas: rows1.map((r) => r.slice(0, 3)) });

// 6. Superficie fija con el círculo crítico del CLI
const circ = bishop1.surface;
await tab(page, 'Superficie');
await page.getByRole('radio', { name: 'Fija', exact: true }).check();
await page.locator('[data-path="/analysis/surface/xc"]').fill(String(circ.xc).replace('.', ','));
await page.locator('[data-path="/analysis/surface/yc"]').fill(String(circ.yc).replace('.', ','));
await page.locator('[data-path="/analysis/surface/r"]').fill(String(circ.r).replace('.', ','));
await page.locator('[data-path="/analysis/surface/r"]').press('Enter');
step('6 la superficie fija pasa a «Círculo» con sus tres campos', (await page.getByRole('radio', { name: 'Círculo', exact: true }).isChecked()) && (await page.locator('[data-path="/analysis/surface/r"]').inputValue()) !== '');
const saved2 = await saveText(page, 'w1e-2.ogs.json');
const cli2 = cli(saved2.path);
const rows2 = await check(page);
const web2 = Object.fromEntries(rows2.map((r) => [r[0], num(r[1])]));
const b2 = cli2.results.find((r) => r.method === 'bishop').fos;
const s2 = cli2.results.find((r) => r.method === 'spencer').fos;
// Spencer no converge con este círculo redondeado, en la web y en el CLI por igual (ambos null): también es paridad.
const same = (w, c) => (w === null || Number.isNaN(w) ? c === null || c === undefined : Math.abs(w - c) < 5e-4);
step('6b círculo fijo, no drenado: FS de Bishop y Spencer igual que ogs analyze (también cuando no converge)', same(web2['Bishop simplificado'], b2) && same(web2['Spencer'], s2), { web: web2, cli: [b2, s2], filas: rows2.map((r) => r.slice(0, 3)) });

// 7. Su variable con la cota
await tab(page, 'Materiales');
const variable = page.getByLabel(new RegExp(`^Material ${id0}: Su variable con la cota$`));
await variable.check();
await page.waitForSelector(`[data-path="/materials/0/strength_gradient"]`);
const datum = await page.locator('[data-path="/materials/0/strength_datum"]').inputValue();
const grad = await page.locator('[data-path="/materials/0/strength_gradient"]').inputValue();
step('7 «Su variable con la cota» agrega cota de referencia, gradiente y límite con sus unidades', datum !== '' && grad === '1,5' && (await page.getByLabel(new RegExp(`^Material ${id0}: Gradiente de Su \\(kPa/m\\)$`)).count()) === 1 && (await page.getByLabel(new RegExp(`^Material ${id0}: Límite de Su \\(kPa\\)$`)).count()) === 1 && (await page.getByLabel(new RegExp(`^Material ${id0}: Cota de referencia de Su \\(m\\)$`)).count()) === 1, { datum, grad });
await page.locator('[data-path="/materials/0/strength_gradient"]').fill('2,5');
await page.locator('[data-path="/materials/0/strength_gradient"]').press('Enter');
await page.locator('[data-path="/materials/0/strength_limit"]').fill('90');
await page.locator('[data-path="/materials/0/strength_limit"]').press('Enter');
const sh2 = await shot(page, '02-su-variable');
const saved3 = await saveText(page, 'w1e-3.ogs.json');
const m0 = JSON.parse(saved3.text).materials[0];
step('7b el guardado trae strength_datum, strength_gradient 2,5 y strength_limit 90', m0.strength_gradient === 2.5 && m0.strength_limit === 90 && typeof m0.strength_datum === 'number', { m0 });
const cli3 = cli(saved3.path);
const rows3 = await check(page);
const web3 = Object.fromEntries(rows3.map((r) => [r[0], num(r[1])]));
step('7c Su variable: FS igual que ogs analyze y distinto del de Su constante', Math.abs(web3['Bishop simplificado'] - cli3.results.find((r) => r.method === 'bishop').fos) < 5e-4 && Math.abs(web3['Bishop simplificado'] - web2['Bishop simplificado']) > 1e-3, { web: web3, cli: cli3.results.map((r) => r.fos) });

// 8. Quitar la variación: un paso, vuelve Su constante
await variable.uncheck();
step('8 desmarcar «Su variable» quita cota, gradiente y límite', (await page.locator('[data-path="/materials/0/strength_gradient"]').count()) === 0);
await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
step('8b un Deshacer restaura el perfil con la cota', (await page.locator('[data-path="/materials/0/strength_gradient"]').inputValue()) === '2,5');

// 9. Nuevo material no drenado
await page.getByRole('button', { name: 'Nuevo material…' }).click();
await page.getByLabel('Nuevo material: Modelo').selectOption('undrained');
step('9 «Nuevo material» con «No drenado (Su)»: muestra Su y no cohesión', (await page.getByLabel(/^Nuevo material: Su \(kPa\)$/).count()) === 1 && (await page.getByLabel(/^Nuevo material: Cohesión c/).count()) === 0);
await page.getByRole('button', { name: 'Agregar material' }).click();
const kinds = await page.$$eval('fieldset.ep-card', (f) => f.length);
step('9b se agregó el material', kinds === nCards + 1, { kinds });

// 10. Unidades imperiales: convertir los valores deja el FS igual (motor nativo sobre los dos archivos guardados) y las etiquetas pasan a psf, ft y psf/ft
await tab(page, 'Proyecto');
await page.locator('[data-path="/units"]').selectOption('imperial');
await page.getByRole('button', { name: /Convertir los valores/ }).click();
await tab(page, 'Materiales');
const impNames = [`Material ${id0}: Su (psf)`, `Material ${id0}: Cota de referencia de Su (ft)`, `Material ${id0}: Gradiente de Su (psf/ft)`, `Material ${id0}: Límite de Su (psf)`];
const have = await Promise.all(impNames.map(async (n) => (await page.getByLabel(n, { exact: true }).count()) === 1));
const suImp = num(await page.getByLabel(`Material ${id0}: Su (psf)`, { exact: true }).inputValue());
step('10 en imperial las etiquetas dicen psf, ft y psf/ft y Su se convirtió (40 kPa = 835,4 psf)', have.every(Boolean) && Math.abs(suImp - 40 * 20.885434) < 0.05, { have, suImp });
const saved4 = await saveText(page, 'w1e-4.ogs.json');
const cli4 = cli(saved4.path);
const dB = Math.abs(cli4.results.find((r) => r.method === 'bishop').fos - cli3.results.find((r) => r.method === 'bishop').fos);
step('10b FS del modelo imperial convertido = FS del modelo SI (|Δ| < 1e-6, ogs analyze)', cli4.code === 0 && dB < 1e-6, { dB });
const rows4 = await check(page);
step('10c Comprobar en imperial muestra el mismo FS que en SI', rows4[0][1] === rows3[0][1], { si: rows3.map((r) => r.slice(0, 2)), imperial: rows4.map((r) => r.slice(0, 2)) });
await axe(page, 'editor claro (materiales)');
const failed = summary();
await browser.close();
process.exit(failed ? 1 : 0);
