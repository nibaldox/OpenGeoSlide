// R2-I2, recorrido 4 (F4.1, F4.11, F4.14): ida y vuelta del formato 0.4 en Chrome con el WASM real, en claro y en oscuro, con axe.
//   1. abrir un modelo 0.4 con los cinco tipos y los tres modelos de arrancamiento (escrito por un programa, con otro orden de claves);
//   2. guardarlo (canónico), abrir lo guardado, guardarlo otra vez: los dos archivos son idénticos byte a byte y los refuerzos no pierden nada;
//   3. el FS de la web es el de `ogs analyze` sobre el archivo guardado (1e-9) y la vista Casos lo calcula igual;
//   4. rechazos: `location` (E14m-3) y `reinforcements` con `version` 0.3 se rechazan con su mensaje y el modelo abierto no cambia;
//   5. quitar todos los refuerzos baja la versión guardada (F3.9: mínima, 0.3 por los métodos nuevos).
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node r2i2_ida_vuelta.mjs
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { launchTap, start, tab, step, summary, shot, axe, checkReport, openFile, saveText, cli, compare, baseModel, writeModel } from './lib.mjs';

const T = process.env.TMPDIR;
const REINFORCEMENTS = [
  { type: 'sheet_pile', id: 'tabl', x1: 40, y1: 10, x2: 40, y2: 0.5, application: 'active', force: 80, direction: 'perpendicular' },
  { type: 'anchor', id: 'anc', x1: 32, y1: 6, x2: 52, y2: 10, application: 'active', tensile_capacity: 150, end1_capacity: 150, end2_capacity: 20, spacing: 2.5, direction: 'axial', pullout: { model: 'bond', strength: 40, bonded_length: 10 } },
  { type: 'nail', id: 'clavo', x1: 30, y1: 5, x2: 48, y2: 6.5, application: 'passive', tensile_capacity: 120, spacing: 1.5, direction: 'bisector', pullout: { model: 'bond', strength: 35 } },
  { type: 'geosynthetic', id: 'geo', x1: 28, y1: 5, x2: 50, y2: 6, application: 'passive', tensile_capacity: 60, end2_capacity: 10, spacing: 1, direction: 'tangent', pullout: { model: 'interface', adhesion: 4, friction_angle: 22, coverage: 0.8 } },
  { type: 'geosynthetic', id: 'geo2', x1: 29, y1: 5.5, x2: 50, y2: 7, application: 'passive', tensile_capacity: 60, spacing: 1, direction: 'axial', pullout: { model: 'development', length1: 3, length2: 4 } },
  { type: 'pile', id: 'pil', x1: 45, y1: 12.5, x2: 45, y2: 1, application: 'passive', force: 50, spacing: 1.5, direction: 'angle', angle: 10 },
];
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);

for (const scheme of ['light', 'dark']) {
  const tag = scheme === 'light' ? 'claro' : 'oscuro';
  const { browser, page } = await launchTap({ colorScheme: scheme, theme: scheme });
  await start(page);
  const original = baseModel((m) => { m.version = '0.4'; m.reinforcements = REINFORCEMENTS; });
  const origPath = writeModel(`r2i2-ida-${scheme}-0.ogs.json`, original);
  await openFile(page, origPath);
  await tab(page, 'Refuerzos');
  const cards = await page.locator('fieldset[data-reinforcement-index]').count();
  step(`(${tag}) 1 el modelo 0.4 se abre con seis refuerzos (cinco tipos) y sin avisos de error`, cards === 6 && (await page.locator('[data-testid="live-alert"]').textContent().catch(() => '')).trim() === '', { cards });
  await shot(page, `ida-${scheme}-1-abierto`);
  await axe(page, `modelo 0.4 abierto con los cinco tipos (${tag})`);

  // 2. Ida y vuelta.
  const s1 = await saveText(page, `r2i2-ida-${scheme}-1.ogs.json`);
  const m1 = JSON.parse(s1.text);
  step(`(${tag}) 2a guardado 0.4 canónico: los refuerzos no pierden ni ganan nada (comparados por clave)`, m1.version === '0.4' && sameJson(sortKeys(m1.reinforcements), sortKeys(REINFORCEMENTS)) && s1.text.endsWith('}\n'), { n: m1.reinforcements?.length });
  await openFile(page, s1.path);
  const s2 = await saveText(page, `r2i2-ida-${scheme}-2.ogs.json`);
  const sha = (t) => createHash('sha256').update(t).digest('hex');
  step(`(${tag}) 2b abrir lo guardado y volver a guardar da el mismo archivo, byte a byte`, s1.text === s2.text && sha(s1.text) === sha(s2.text) && Buffer.byteLength(s1.text) === Buffer.byteLength(s2.text), { bytes: Buffer.byteLength(s1.text), sha: sha(s1.text).slice(0, 16) });
  const orig = readFileSync(s1.path, 'utf8');
  step(`(${tag}) 2c el archivo guardado en disco es el texto que descargó la web`, orig === s1.text);

  // 3. El motor real.
  const report = await checkReport(page, 180000);
  const ref = cli(s2.path);
  const cmp = compare(report, ref.results);
  step(`(${tag}) 3a el FS de la web es el de «ogs analyze» sobre el archivo guardado (1e-9)`, ref.code === 0 && cmp.length === 5 && cmp.every((c) => c.same), { cmp: cmp.map((c) => [c.method, c.web, c.cli, c.rel]) });
  const fs = report.results.every((r) => r.status === 'converged') && report.results.every((r) => (r.reinforcement_forces ?? []).length === 6);
  step(`(${tag}) 3b seis fuerzas por cruce en cada método`, fs, { n: report.results.map((r) => r.reinforcement_forces?.length) });
  await page.getByRole('tab', { name: 'Casos de verificación' }).click();
  await page.locator('#mode-cases-panel input[type="file"]').setInputFiles(s2.path);
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Comprobar caso' }).click();
  await page.locator('[data-results-table]').last().waitFor({ state: 'visible', timeout: 120000 });
  await page.waitForTimeout(500);
  const casesText = (await page.locator('#mode-cases-panel').innerText()).replace(/\s+/g, ' ');
  step(`(${tag}) 3c la vista Casos calcula el modelo 0.4 y muestra la tabla de fuerzas y el límite de F4.8`, (await page.locator('#mode-cases-panel [data-testid="reinforcement-forces"] table').count()) >= 1 && /No calcula el empuje sobre el elemento/.test(casesText), { tables: await page.locator('#mode-cases-panel [data-testid="reinforcement-forces"] table').count() });
  await shot(page, `ida-${scheme}-2-casos`);
  await axe(page, `Casos con refuerzos (${tag})`);
  await page.getByRole('tab', { name: 'Editar' }).click();
  await page.waitForSelector('[data-layer="regions"] polygon');

  // 4. Rechazos: el modelo abierto no cambia.
  const textBefore = (await saveText(page, `r2i2-ida-${scheme}-3.ogs.json`)).text;
  const bad1 = structuredClone(original); bad1.reinforcements = structuredClone(REINFORCEMENTS); bad1.reinforcements[5].location = 'slip_surface';
  await openFile(page, writeModel(`r2i2-ida-${scheme}-bad-location.ogs.json`, bad1));
  const alert1 = ((await page.locator('[data-testid="live-alert"]').textContent().catch(() => '')) ?? '').trim();
  const body1 = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  step(`(${tag}) 4a un pilote con «location» (E14m-3) se rechaza como campo desconocido y el modelo abierto no cambia`, /location/.test(alert1 + body1) && (await saveText(page, `r2i2-ida-${scheme}-4.ogs.json`)).text === textBefore, { alert: alert1.slice(0, 200) });
  await shot(page, `ida-${scheme}-3-rechazo-location`);
  const bad2 = structuredClone(original); bad2.version = '0.3';
  await openFile(page, writeModel(`r2i2-ida-${scheme}-bad-version.ogs.json`, bad2));
  const body2 = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  step(`(${tag}) 4b reinforcements con version 0.3 se rechaza («declara el formato 0.3, que no admite los refuerzos») y el modelo abierto no cambia`, /declara el formato 0\.3, que no admite los refuerzos\. Cambie la versión del archivo a "0\.4"/.test(body2) && (await saveText(page, `r2i2-ida-${scheme}-5.ogs.json`)).text === textBefore, { frag: (body2.match(/El archivo declara[^.]*\./) ?? [''])[0].slice(0, 200) });
  await shot(page, `ida-${scheme}-4-rechazo-version`);

  // 5. Versión mínima al quitar todos los refuerzos.
  await tab(page, 'Refuerzos');
  for (let k = 0; k < 6; k += 1) await page.getByRole('button', { name: 'Quitar el refuerzo 1', exact: true }).click();
  await page.waitForTimeout(250);
  const m3 = JSON.parse((await saveText(page, `r2i2-ida-${scheme}-6.ogs.json`)).text);
  step(`(${tag}) 5 sin refuerzos el archivo vuelve a su versión mínima (0.3, por los métodos) y sin la clave «reinforcements»`, m3.version === '0.3' && !('reinforcements' in m3), { version: m3.version });
  step(`(${tag}) sin errores de consola`, (await page.evaluate(() => window.__errors.length)) === 0);
  await browser.close();
}
const failed = summary();
process.exit(failed ? 1 : 0);
