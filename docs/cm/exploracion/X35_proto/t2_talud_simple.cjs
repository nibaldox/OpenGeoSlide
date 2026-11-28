// X35 · T2: talud simple desde cero (Archivo ▸ Talud simple…), 10 m, 1,5H:1V, sin agua, c = 10 kPa, φ = 30°, γ = 19 kN/m³.
// Enunciado (lo que se le da al usuario): «Cree un talud simple de 10 m de alto, pendiente 1,5H:1V, sin agua, con un
// material de cohesión 10 kPa, ángulo de fricción 30° y peso unitario 19 kN/m³. Calcule su factor de seguridad.»
// Los campos no mencionados (corona 10 m, pie 20 m, profundidad 10 m, nombre «Suelo») quedan con sus valores por defecto.
// Inicio: primera visita, almacenamiento limpio. Fin: el FS visible en el resumen.
'use strict';
const { click, calcAndWaitFS, runTask } = require('./x35_lib.cjs');

/** Campo numérico: clic, seleccionar lo que hay (Control+A) y teclear el valor. K = 2 + n. */
async function setField(run, page, locator, text, label) {
  await click(run, locator, label);
  await page.keyboard.press('Control+a');
  run.keys(2, 'Control+A');
  await page.keyboard.type(text);
  run.keys(text.length, `escribir ${text}`);
}

runTask('T2_talud_simple', async (run, page) => {
  run.think('leer el enunciado y ubicar «Archivo»');
  await click(run, page.locator('button.dd-trigger', { hasText: /^Archivo/ }), 'abrir menú Archivo');
  run.think('localizar «Talud simple…» en el menú');
  await click(run, page.getByRole('button', { name: 'Talud simple…' }), 'Talud simple…');
  await page.getByRole('button', { name: 'Crear talud' }).waitFor({ timeout: 15000 });
  run.mark('dialogo_abierto');

  // Altura 10 m y c, φ y sin agua ya tienen los valores del enunciado: se verifican (M), sin tocar.
  run.think('verificar altura 10, c 10, φ 30 y agua «Ninguna» (valores por defecto)');
  run.think('verificar que el modo de inclinación pase a «Pendiente H:V»');
  await click(run, page.getByLabel('Pendiente H:V', { exact: true }), 'elegir «Pendiente H:V»');
  await setField(run, page, page.getByLabel(/^Pendiente H:V \(horizontal/), '1,5', 'campo pendiente H:V');
  await setField(run, page, page.getByLabel(/^Peso unitario γ/), '19', 'campo peso unitario γ');
  run.mark('campos_listos');
  // Verificación (no cuenta en el KLM): los valores que quedaron en el diálogo, para comprobar el enunciado.
  run.meta.campos_del_dialogo = await page.evaluate(() =>
    [...document.querySelectorAll('dialog[open] input')].filter((i) => i.type !== 'radio' && i.type !== 'checkbox')
      .map((i) => ({ etiqueta: (i.closest('.field') || i.parentElement)?.innerText.split('\n')[0].slice(0, 40), valor: i.value })));
  run.meta.inclinacion_elegida = await page.evaluate(() => document.querySelector('dialog[open] input[type=radio]:checked')?.parentElement?.innerText.trim() ?? null);

  await click(run, page.getByRole('button', { name: 'Crear talud' }), 'Crear talud');
  run.mark('talud_creado');
  run.think('ubicar «Comprobar» en el pie de la barra lateral');
  await calcAndWaitFS(run, page, 'T2');
});
