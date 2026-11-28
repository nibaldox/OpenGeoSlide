// R11B-10 / E14o-16: tablestaca inclinada (x1 ≠ x2) abierta desde un archivo, con el WASM real, en claro y en oscuro, con axe.
//   1. la tarjeta muestra «Punta x2», su error y «Alinear verticalmente»;
//   2. con ese error, un cambio de lista desplegable («Dirección de la fuerza», «Aplicación») se conserva como borrador: el control lo muestra, la tarjeta
//      avisa que está pendiente, el modelo guardado no cambia y pulsar «Comprobar» (validar) no lo pierde;
//   3. «Alinear verticalmente» deja x2 = x1 y escribe también los cambios pendientes (un solo paso), y el aviso desaparece.
// Uso: OGS_URL=http://127.0.0.1:5186/ OGS_REPO=<repo> TMPDIR=<scratch> node r2i2_tablestaca_inclinada.mjs
import { launchTap, start, tab, step, summary, shot, axe, openFile, saveText, baseModel, writeModel, fieldOf } from './lib.mjs';

const model = () => baseModel((m) => {
  m.version = '0.4';
  m.reinforcements = [{ id: 's1', type: 'sheet_pile', x1: 40, y1: 10, x2: 42, y2: 1, application: 'passive', force: 90, direction: 'tangent' }];
});
const select = (page, label) => page.getByLabel(new RegExp(`^Refuerzo 1: ${label}`));
const pendingNote = (page) => page.locator('[data-testid="reinforcement-pending"]');
const card = async (page) => JSON.parse((await saveText(page, 'r2i2-tablestaca-inclinada.ogs.json')).text).reinforcements[0];

for (const scheme of ['light', 'dark']) {
  const tag = scheme === 'light' ? 'claro' : 'oscuro';
  const { browser, page } = await launchTap({ colorScheme: scheme, theme: scheme });
  await start(page);
  await openFile(page, writeModel(`r2i2-tablestaca-inclinada-${scheme}.ogs.json`, model()));
  await tab(page, 'Refuerzos');

  // 1. El error y la salida están en la tarjeta.
  const x2 = fieldOf(page, 1, 'Punta x2');
  step(`(${tag}) 1a la tarjeta muestra «Punta x2» con el valor del archivo (42)`, (await x2.count()) === 1 && (await x2.inputValue()).replace(',', '.') === '42');
  step(`(${tag}) 1b el error de x2 está en la tarjeta y el campo es inválido`, /la tablestaca es vertical/.test(await page.locator('#ea-tabpanel').innerText()) && (await x2.getAttribute('aria-invalid')) === 'true');
  const align = page.getByRole('button', { name: 'Alinear verticalmente la tablestaca del refuerzo 1 (x2 = x1)' });
  step(`(${tag}) 1c ofrece «Alinear verticalmente»`, (await align.count()) === 1);
  step(`(${tag}) 1d sin cambios en el borrador no hay aviso de pendiente`, (await pendingNote(page).count()) === 0);
  await shot(page, `tablestaca-inclinada-${scheme}-1-panel`);
  await axe(page, `panel con la tablestaca inclinada (${tag})`);

  // 2. Cambios de lista desplegable con errores en la tarjeta.
  // CM-WA: desde R16B-01 «Guardar» se bloquea con un borrador sin aplicar, así que el modelo guardado se lee ANTES de crear el borrador;
  // con el borrador abierto se comprueba que no hubo cambio en el documento (Deshacer deshabilitado y archivo sin cambios).
  const saved0 = await card(page);
  await select(page, 'Dirección de la fuerza').selectOption('angle');
  await page.waitForTimeout(250);
  step(`(${tag}) 2a «Dirección de la fuerza» muestra la elección (Ángulo) y aparece su campo`, (await select(page, 'Dirección de la fuerza').inputValue()) === 'angle' && (await fieldOf(page, 1, 'Ángulo').count()) === 1);
  step(`(${tag}) 2b la tarjeta avisa que el cambio está pendiente`, (await pendingNote(page).count()) === 1 && /sin aplicar al modelo/.test(await pendingNote(page).innerText()));
  await select(page, 'Aplicación').selectOption('active');
  await page.waitForTimeout(250);
  step(`(${tag}) 2c una segunda lista (Aplicación = Activa) también se conserva`, (await select(page, 'Aplicación').inputValue()) === 'active' && (await select(page, 'Dirección de la fuerza').inputValue()) === 'angle');
  const undoOff = await page.getByRole('button', { name: 'Deshacer', exact: true }).isDisabled();
  const fileState = (await page.locator('[data-testid="file-status"]').innerText()).trim();
  step(`(${tag}) 2d el modelo guardado no cambió: x2 = 42, pasiva, tangente, sin pasos de historial`, saved0.x2 === 42 && saved0.application === 'passive' && saved0.direction === 'tangent' && !('angle' in saved0) && undoOff && /archivo sin cambios/.test(fileState), { saved0, undoOff, fileState });
  // «Validar»: pulsar «Comprobar» (con el error el cálculo se rechaza o no corre) no debe tocar el borrador.
  const check = page.getByRole('button', { name: 'Comprobar', exact: true }).first();
  if (await check.isEnabled()) await check.click();
  await page.waitForTimeout(900);
  step(`(${tag}) 2e tras «Comprobar» las dos elecciones siguen en los controles y el aviso sigue`, (await select(page, 'Dirección de la fuerza').inputValue()) === 'angle' && (await select(page, 'Aplicación').inputValue()) === 'active' && (await pendingNote(page).count()) === 1);
  await shot(page, `tablestaca-inclinada-${scheme}-2-pendiente`);
  await axe(page, `panel con un cambio pendiente (${tag})`);

  // 3. Alinear: x2 = x1 y los cambios pendientes se escriben juntos.
  await align.click();
  await page.waitForTimeout(300);
  const after = await card(page);
  step(`(${tag}) 3a «Alinear» deja x2 = x1 y escribe lo pendiente (activa, ángulo 0)`, after.x1 === 40 && after.x2 === 40 && after.application === 'active' && after.direction === 'angle' && after.angle === 0, { after });
  step(`(${tag}) 3b desaparecen el aviso, el botón y el campo x2`, (await pendingNote(page).count()) === 0 && (await align.count()) === 0 && (await fieldOf(page, 1, 'Punta x2').count()) === 0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(250);
  const undone = await card(page);
  step(`(${tag}) 3c Ctrl+Z deshace todo en un solo paso (x2 = 42, pasiva, tangente)`, undone.x2 === 42 && undone.application === 'passive' && undone.direction === 'tangent', { undone });
  await browser.close();
}
process.exit(summary() ? 1 : 0);
