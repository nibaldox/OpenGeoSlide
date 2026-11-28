// X35 · T3: importar un DXF de ejemplo y calcular su FS.
// Archivo de ejemplo: apps/web/src/io/dxf/fixtures/terraplen.dxf (capas SUELO_1, arcilla y TERRENO; TERRENO es una polilínea abierta).
// Enunciado (lo que se le da al usuario): «Importe el archivo terraplen.dxf como modelo y calcule su factor de seguridad.»
// Inicio: primera visita, almacenamiento limpio. Fin: el FS visible en el resumen.
//
// Variantes (variable OGS_T3):
//   ruta_minima (por defecto): en el diálogo de importación elige «Reemplazar las regiones actuales»,
//                              luego «Importar» y «Comprobar».
//   defecto:  se acepta todo lo que trae el diálogo al abrirse (destino «Agregar», polilínea «Cerrarla con base y = 24»).
//             Medido: «Agregar» + V047a cargado da «Modelo con 1 problema» y bloquea «Comprobar».
//             Se espera el bloqueo («El modelo tiene errores») y se registra; no es una medición de FS.
// El archivo se entrega junto con el enunciado; el guion lo toma de OGS_REPO (por defecto, la raíz de este repo).
'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { REPO, click, calcAndWaitFS, runTask } = require('./x35_lib.cjs');

const FILE = path.join(REPO, 'apps/web/src/io/dxf/fixtures/terraplen.dxf');
const VARIANT = process.env.OGS_T3 || 'ruta_minima';

runTask(VARIANT === 'defecto' ? 'T3_dxf_defecto' : 'T3_dxf', async (run, page) => {
  if (!fs.existsSync(FILE)) throw new Error(`falta el DXF de ejemplo: ${FILE} (fije OGS_REPO)`);
  run.meta.variante = VARIANT;
  run.think('leer el enunciado y ubicar «Archivo»');
  await click(run, page.locator('button.dd-trigger', { hasText: /^Archivo/ }), 'abrir menú Archivo');

  // «Importar DXF» abre el selector de archivos del sistema. En el usuario real son clic + escribir la ruta + Intro:
  // se cuentan como K por cada carácter del nombre más una K para Intro.
  run.think('localizar «Importar DXF» en el menú');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 15000 }),
    click(run, page.getByRole('button', { name: 'Importar DXF' }), 'Importar DXF'),
  ]);
  await chooser.setFiles(FILE);
  run.keys(path.basename(FILE).length + 1, `ruta del DXF (${path.basename(FILE)}) + Intro`);
  run.meta.archivo = path.basename(FILE);

  // Diálogo «Importar DXF: <archivo>» con sus avisos, capas, unidades y destino.
  await page.getByText(/^Importar DXF:/).first().waitFor({ timeout: 30000 });
  run.think('leer el diálogo: avisos, capas, destino y polilínea abierta');
  if (VARIANT !== 'defecto') {
    // Destino: por defecto el diálogo «Agrega» a las regiones del modelo que está abierto (en la primera visita, V047a).
    run.think('elegir destino «Reemplazar» (el por defecto agrega a V047a)');
    await click(run, page.locator('dialog[open] label', { hasText: /Reemplazar las regiones/ }), 'Reemplazar las regiones actuales');
    // La polilínea abierta (TERRENO) se deja con su valor por defecto («Cerrarlas con una base horizontal», y = 24):
    // medido, con «Reemplazar» ya calcula (X35 §3, F2). Si se descarta, el FS es el mismo.
  }
  run.think('pulsar «Importar» en el diálogo');
  await click(run, page.getByRole('button', { name: 'Importar', exact: true }), 'Importar (diálogo DXF)');
  run.mark('dxf_importado');
  run.meta.resumen_tras_importar = (await page.locator('[data-testid="result-summary"]').innerText()).slice(0, 200);

  run.think('ubicar «Comprobar» en el pie de la barra lateral');
  if (VARIANT === 'defecto') {
    // Se intenta el cálculo y se espera el aviso de bloqueo; sin FS, el resultado es «bloqueado», no una medición.
    await click(run, page.getByRole('button', { name: 'Comprobar', exact: true }).first(), 'Comprobar');
    run.mark('calc_click');
    await page.getByText(/El modelo tiene errores/).first().waitFor({ timeout: 20000 });
    run.mark('bloqueo_visible');
    run.meta.bloqueo = (await page.getByText(/El modelo tiene errores/).first().innerText()).trim();
    run.meta.modelo_estado = (await page.evaluate(() => document.body.innerText.match(/Modelo con \d+ problemas?|Listo para calcular|Con error/g) || [])).join(' | ');
    throw new Error('bloqueado por el diálogo de importación (variante defecto): no hay FS');
  }
  await calcAndWaitFS(run, page, 'T3');
});
