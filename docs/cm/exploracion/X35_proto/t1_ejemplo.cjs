// X35 · T1: abrir un ejemplo publicado (V001) desde Archivo y calcular su FS.
// Enunciado (lo que se le da al usuario): «Abra el ejemplo V001 (talud homogéneo de 20 m, 1,5H:1V) desde el menú Archivo
// y obtenga su factor de seguridad.» Inicio: primera visita, almacenamiento limpio. Fin: el FS visible en el resumen.
// Uso: OGS_URL=... node t1_ejemplo.cjs   (ver x35_lib.cjs)
'use strict';
const { click, calcAndWaitFS, runTask } = require('./x35_lib.cjs');

runTask('T1_ejemplo', async (run, page) => {
  const EXAMPLE = 'V001';
  run.think('leer el enunciado: abrir V001 desde Archivo');
  await click(run, page.locator('button.dd-trigger', { hasText: /^Archivo/ }), 'abrir menú Archivo');

  // Lista «Ejemplos»: un <select> con ~168 opciones; la búsqueda del valor es una decisión (M).
  run.think('localizar «V001» en la lista Ejemplos');
  const sel = page.locator('select[aria-label="Abrir un caso publicado como modelo"]');
  await click(run, sel, 'abrir la lista Ejemplos');
  const value = await page.evaluate((id) => {
    const o = [...document.querySelectorAll('select[aria-label="Abrir un caso publicado como modelo"] option')].find((x) => x.textContent.startsWith(id + ':'));
    return o ? o.value : null;
  }, EXAMPLE);
  if (!value) throw new Error(`no aparece ${EXAMPLE} en la lista`);
  await sel.selectOption(value);
  run.mouse(`elegir ${EXAMPLE}`);
  await page.getByText(new RegExp(`Caso ${EXAMPLE} abierto`)).first().waitFor({ timeout: 30000 });
  run.mark('example_open');
  run.meta.ejemplo_abierto = EXAMPLE;

  run.think('ubicar «Comprobar» en el pie de la barra lateral');
  await calcAndWaitFS(run, page, 'T1');
});
