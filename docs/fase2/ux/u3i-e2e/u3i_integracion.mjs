// U3-I: integración de U3-M y U3-O en Chrome (puerto 5186). Pestaña «Proyecto» registrada, confirmaciones propias (useConfirm) en lugar de
// window.confirm (Nuevo, Talud simple, Ejemplos, Recuperar borrador, Eliminar región), atajo R en la ayuda, comando units/set y guía de
// primera visita (Comprobar, «Geometría» y «Dibujar región»). Uso: OGS_URL=http://127.0.0.1:5186/ node u3i_integracion.mjs
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const SHOTS = path.join(process.env.TMPDIR, 'u3x-shots');
mkdirSync(SHOTS, { recursive: true });
const URL_ = process.env.OGS_URL ?? 'http://127.0.0.1:5186/';
const out = { steps: [], consoleErrors: [] };
let failed = 0;
const step = (name, ok, data = {}) => {
  if (!ok) failed += 1;
  out.steps.push({ name, ok, ...data });
  console.log(ok ? 'OK  ' : 'FAIL', name, JSON.stringify(data));
};

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome-stable', headless: true, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
await ctx.addInitScript(() => { try { localStorage.setItem('ogs.onboarding.v1', 'seen'); } catch {} });
const page = await ctx.newPage();
const nativeDialogs = [];
page.on('dialog', (d) => { nativeDialogs.push(d.type() + ':' + d.message()); d.dismiss(); }); // ningún diálogo nativo debe aparecer
page.on('pageerror', (e) => out.consoleErrors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url ?? '').endsWith('/favicon.ico')) out.consoleErrors.push(m.text()); });

const CONFIRM = '[data-testid="confirm-dialog"]';
const status = async () => (await page.textContent('[data-testid="file-status"]')).trim();
const nRegions = () => page.locator('[data-layer="regions"] polygon').count();
const pressed = async (name) => (await page.locator('nav[aria-label="Herramientas del lienzo"]').getByRole('button', { name }).getAttribute('aria-pressed')) === 'true'; // UA: las herramientas están en la paleta del lienzo, no en un role=toolbar
async function openMenu(name) {
  const t = page.getByRole('button', { name, exact: true });
  if ((await t.getAttribute('aria-expanded')) !== 'true') await t.click();
  await page.waitForFunction((n) => [...document.querySelectorAll('button.dd-trigger')].some((b) => b.textContent.trim().startsWith(n) && b.getAttribute('aria-expanded') === 'true'), name);
}
async function dirtyEdit() {
  // Un cambio real: Proyecto → título.
  await page.getByRole('tab', { name: 'Proyecto' }).click();
  const t = page.getByLabel('Título', { exact: true });
  await t.fill('Editado ' + Date.now());
  await t.press('Enter');
  await page.getByRole('tab', { name: 'Geometría' }).click();
}
const confirmInfo = async () => page.evaluate((sel) => {
  const d = document.querySelector(sel);
  return d ? { open: d.open, role: d.getAttribute('role'), tone: d.getAttribute('data-tone'), title: d.querySelector('h2')?.textContent, buttons: [...d.querySelectorAll('button')].map((b) => b.textContent.trim()), active: document.activeElement?.textContent?.trim() } : null;
}, CONFIRM);

await page.goto(URL_);
await page.waitForFunction(() => /ogs-core/.test(document.querySelector('[data-testid="engine-banner"]')?.textContent ?? ''), null, { timeout: 20000 });
await page.waitForSelector('[data-layer="regions"] polygon');

// 1. Pestaña «Proyecto» registrada
const tabs = await page.locator('[role="tablist"][aria-label="Paneles del modelo"] [role="tab"]').allTextContents();
await page.getByRole('tab', { name: 'Proyecto' }).click();
const projPanel = await page.evaluate(() => ({ heading: document.querySelector('#ea-tabpanel h2, #ea-tabpanel h3')?.textContent, fields: [...document.querySelectorAll('#ea-tabpanel [data-path]')].map((e) => e.getAttribute('data-path')) }));
step('1 la pestaña «Proyecto» está registrada (última) y muestra título, id, descripción y unidades', tabs.at(-1) === 'Proyecto' && tabs[0] === 'Geometría' && tabs.length === 10 /* R2-I2: la pestaña «Refuerzos» (v0.4, F4.11) pasó las pestañas de 9 a 10 */ && ['/meta/title', '/meta/id', '/meta/notes', '/units'].every((p) => projPanel.fields.includes(p)), { tabs, projPanel });
await page.getByRole('tab', { name: 'Geometría' }).click();

// 2. Unidades: units/set — un paso, sin convertir, cambios sin guardar; Esc/cancelar no cambia
await page.getByRole('tab', { name: 'Proyecto' }).click();
const mat0 = await page.evaluate(() => 0);
void mat0;
const sel = page.getByLabel('Unidades');
const before = { units: await sel.inputValue(), status: await status() };
// U5-E (R8 A-02): el cambio de unidades abre un diálogo propio con tres opciones («Convertir los valores», «Solo cambiar la etiqueta» y
// «Cancelar»), en lugar de la confirmación genérica; «Solo cambiar la etiqueta» conserva el comportamiento de units/set de este paso.
const UNITS = 'dialog:has([data-testid="units-dialog"])';
await sel.selectOption('imperial');
await page.waitForSelector(UNITS + '[open]');
const ci = await page.evaluate((q) => { const d = document.querySelector(q); return { modal: d.matches(':modal'), opciones: [...d.querySelectorAll('button')].map((b) => b.textContent.trim()), active: document.activeElement?.textContent?.trim() }; }, UNITS);
await page.keyboard.press('Escape');
await page.waitForSelector(UNITS, { state: 'detached' });
const afterCancel = await sel.inputValue();
await sel.selectOption('imperial');
await page.waitForSelector(UNITS + '[open]');
await page.getByRole('button', { name: 'Solo cambiar la etiqueta' }).click();
await page.waitForSelector(UNITS, { state: 'detached' });
const afterOk = { units: await sel.inputValue(), status: await status() };
await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
const afterUndo = await sel.inputValue();
step('2 cambiar unidades: diálogo con 3 opciones (foco en «Convertir los valores»); Esc no cambia; «Solo cambiar la etiqueta» cambia a imperial (con cambios sin guardar) y un Deshacer lo revierte', ci.modal && /Convertir los valores/.test(ci.active ?? '') && ci.opciones.length === 3 && afterCancel === 'SI' && afterOk.units === 'imperial' && /con cambios/.test(afterOk.status) && afterUndo === 'SI', { ci, before, afterCancel, afterOk, afterUndo });
await page.getByRole('tab', { name: 'Geometría' }).click();

// 3. Nuevo con cambios sin guardar: diálogo propio; las teclas no tocan el modelo de detrás; Seguir editando no descarta
await dirtyEdit();
const regionsBefore = await nRegions();
const statusBefore = await status();
await openMenu('Archivo');
await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
await page.waitForSelector(CONFIRM);
const nuevoDlg = await confirmInfo();
await page.keyboard.press('r'); // con el diálogo abierto, R no cambia de herramienta
await page.keyboard.press('Control+z'); // ni Ctrl+Z deshace
const toolDrawDuring = await pressed('Dibujar región');
await page.getByRole('button', { name: 'Seguir editando' }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
const afterKeep = { regions: await nRegions(), status: await status() };
step('3 Nuevo con cambios: diálogo propio (Cancelar es el foco seguro); R y Ctrl+Z no actúan detrás; «Seguir editando» no descarta', nuevoDlg?.tone === 'danger' && /Seguir editando/.test(nuevoDlg.active ?? '') && nuevoDlg.buttons.includes('Descartar cambios') && !toolDrawDuring && afterKeep.regions === regionsBefore && afterKeep.status === statusBefore, { nuevoDlg, toolDrawDuring, regionsBefore, afterKeep, statusBefore });
await page.screenshot({ path: path.join(SHOTS, 'u3i-confirm-nuevo-pre.png') });

await openMenu('Archivo');
await page.getByRole('button', { name: 'Nuevo', exact: true }).click();
await page.waitForSelector(CONFIRM);
await page.getByRole('button', { name: 'Descartar cambios' }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
await page.waitForSelector('[data-testid="canvas-empty"]');
const emptyState = { regions: await nRegions(), status: await status() };
step('3b «Descartar cambios» crea el modelo vacío (estado vacío del lienzo)', emptyState.regions === 0 && /sin cambios/.test(emptyState.status), emptyState);

// 4. Atajo R: Dibujar región (también documentado en la ayuda)
await page.keyboard.press('r');
const rTool = await pressed('Dibujar región');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Ayuda' }).click();
await page.waitForSelector('dialog[open]');
const help = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('dialog[open] tr, dialog[open] li, dialog[open] dt, dialog[open] kbd')].map((e) => e.textContent.trim());
  return { hasR: [...document.querySelectorAll('dialog[open] kbd')].some((k) => k.textContent.trim() === 'R'), text: document.querySelector('dialog[open]').innerText.match(/Dibujar regi[^\n]*/g) ?? [], n: rows.length };
});
step('4 la tecla R elige «Dibujar región» y la ayuda la documenta', rTool && help.text.length > 0, { rTool, help });
await page.screenshot({ path: path.join(SHOTS, 'u3i-ayuda-atajo-r.png') });
await page.keyboard.press('Escape');
await page.waitForSelector('dialog[open]', { state: 'detached' });

// 5. Talud simple con cambios sin guardar: el diálogo de descarte se apila sobre el del talud; cancelar lo deja abierto
await page.keyboard.press('v');
await openMenu('Archivo');
// U5-S (B-03): la incidencia «El modelo no tiene regiones…» ahora es un botón y su nombre contiene «Talud simple…»: nombre exacto.
await page.getByRole('button', { name: 'Talud simple…', exact: true }).click();
await page.waitForSelector('dialog[open]');
await page.getByRole('button', { name: 'Crear talud' }).click();
await page.waitForSelector('[data-testid="canvas-empty"]', { state: 'detached' }); // Nuevo dejó el modelo sin cambios: no pregunta
step('5a Talud simple sobre un modelo sin cambios no pregunta', (await page.locator(CONFIRM).count()) === 0 && (await nRegions()) === 1, { regions: await nRegions() });
await dirtyEdit();
await openMenu('Archivo');
// U5-S (B-03): la incidencia «El modelo no tiene regiones…» ahora es un botón y su nombre contiene «Talud simple…»: nombre exacto.
await page.getByRole('button', { name: 'Talud simple…', exact: true }).click();
await page.waitForSelector('dialog[open]');
await page.getByRole('button', { name: 'Crear talud' }).click();
await page.waitForSelector(CONFIRM);
await page.getByRole('button', { name: 'Seguir editando' }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
const slopeStillOpen = (await page.locator('dialog[open]').count()) === 1;
const statusAfterCancel = await status();
await page.getByRole('button', { name: 'Crear talud' }).click();
await page.waitForSelector(CONFIRM);
await page.getByRole('button', { name: 'Descartar cambios' }).click();
await page.waitForSelector('dialog[open]', { state: 'detached' });
step('5b Talud simple con cambios: cancelar deja el diálogo del talud abierto y no descarta; confirmar crea el talud', slopeStillOpen && /con cambios/.test(statusAfterCancel) && /sin cambios/.test(await status()), { slopeStillOpen, statusAfterCancel, final: await status() });

// 6. Ejemplos con cambios
await dirtyEdit();
const examples = page.locator('select[aria-label="Abrir un caso publicado como modelo"]');
await openMenu('Archivo');
const firstCase = await examples.locator('option').nth(1).getAttribute('value');
await examples.selectOption(firstCase);
await page.waitForSelector(CONFIRM);
await page.getByRole('button', { name: 'Seguir editando' }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
const keptTitle = /con cambios/.test(await status());
await openMenu('Archivo').catch(() => {});
await examples.selectOption(firstCase);
await page.waitForSelector(CONFIRM);
await page.getByRole('button', { name: 'Descartar cambios' }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
await page.waitForTimeout(200);
step('6 Ejemplos con cambios: cancelar conserva el modelo; confirmar abre el caso', keptTitle && /Ejemplo/.test(await status()) && /sin cambios/.test(await status()), { status: await status() });

// 7. Eliminar región (Geometría): diálogo propio con el nombre de la región; el foco no se pierde
await page.getByRole('tab', { name: 'Geometría' }).click();
const delBtn = page.getByRole('button', { name: 'Eliminar región 1', exact: true });
const nBefore = await nRegions();
await delBtn.click();
await page.waitForSelector(CONFIRM);
const delDlg = await confirmInfo();
const delText = (await page.locator(CONFIRM).innerText()).replace(/\s+/g, ' ');
await page.screenshot({ path: path.join(SHOTS, 'u3i-confirm-eliminar-pre.png') });
await page.getByRole('button', { name: 'Conservar la región' }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
const focusAfterCancel = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
const kept = (await nRegions()) === nBefore;
await delBtn.click();
await page.waitForSelector(CONFIRM);
await page.getByRole('button', { name: 'Eliminar región', exact: true }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
const removed = (await nRegions()) === nBefore - 1;
await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
step('7 Eliminar región: diálogo «danger» con región, material y vértices; conservar no elimina (foco de vuelta al botón); eliminar elimina y Ctrl+Z la devuelve', delDlg?.tone === 'danger' && /Eliminar la región 1/.test(delText) && /vértices/.test(delText) && kept && focusAfterCancel === 'Eliminar región 1' && removed && (await nRegions()) === nBefore, { delDlg, delText, focusAfterCancel });

// 8. Recuperar borrador con el modelo ya editado: pregunta antes de reemplazar
await dirtyEdit();
await page.waitForTimeout(1800); // autoguardado del borrador
await page.reload();
await page.waitForSelector('[data-testid="draft-banner"]');
const draftInfo = (await page.textContent('[data-testid="draft-banner"]')).trim().slice(0, 120);
await page.getByRole('tab', { name: 'Proyecto' }).click();
const t2 = page.getByLabel('Título', { exact: true });
await t2.fill('Cambio tras el arranque');
await t2.press('Enter');
await page.getByRole('button', { name: 'Recuperar', exact: true }).click();
await page.waitForSelector(CONFIRM);
await page.getByRole('button', { name: 'Seguir editando' }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
const bannerStays = (await page.locator('[data-testid="draft-banner"]').count()) === 1;
await page.getByRole('button', { name: 'Recuperar', exact: true }).click();
await page.waitForSelector(CONFIRM);
await page.getByRole('button', { name: 'Descartar cambios' }).click();
await page.waitForSelector(CONFIRM, { state: 'detached' });
await page.waitForSelector('[data-testid="draft-banner"]', { state: 'detached' });
step('8 Recuperar borrador tras editar: pregunta; cancelar conserva el banner; aceptar recupera', bannerStays, { draftInfo });

// 9. Guía de primera visita (contexto nuevo, sin marca): menciona Dibujar región y Geometría/Proyecto
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p2 = await ctx2.newPage();
await p2.goto(URL_);
await p2.waitForSelector('[data-testid="guided-tour"]:popover-open');
const t1 = await p2.locator('[data-testid="guided-tour"]').innerText();
await p2.getByRole('button', { name: 'Siguiente' }).click();
await p2.waitForTimeout(300);
const t2txt = await p2.locator('[data-testid="guided-tour"]').innerText();
await p2.screenshot({ path: path.join(SHOTS, 'u3i-guia-paso2.png') });
// CM-WC: la guía nueva parte del ejemplo abierto y señala «Comprobar» (paso 1); «Dibujar región» pasó al paso 3 (abrir otro ejemplo o empezar un modelo).
await p2.getByRole('button', { name: 'Siguiente' }).click();
await p2.waitForTimeout(300);
const t3txt = await p2.locator('[data-testid="guided-tour"]').innerText();
step('9 la guía parte de «Comprobar» (paso 1), menciona Geometría y Proyecto en el paso 2 y «Dibujar región» (R) en el paso 3', /Comprobar/.test(t1) && /geometría/i.test(t2txt) && /proyecto/i.test(t2txt) && /Dibujar región/.test(t3txt) && /tecla R/.test(t3txt), { paso1: t1.slice(0, 160), paso2: t2txt.slice(0, 200), paso3: t3txt.slice(0, 300) });
await ctx2.close();

step('Ningún diálogo nativo (window.confirm/alert/prompt)', nativeDialogs.length === 0, { nativeDialogs });
step('Errores de consola', out.consoleErrors.length === 0, { errores: out.consoleErrors });
writeFileSync(path.join(SHOTS, 'u3i-integracion.json'), JSON.stringify(out, null, 1));
await browser.close();
console.log(failed === 0 ? `TODO OK (${out.steps.length} pasos)` : `${failed} FALLOS`);
process.exit(failed === 0 ? 0 : 1);
