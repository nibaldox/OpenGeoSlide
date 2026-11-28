// X35 · T3: importar un DXF de ejemplo y calcular su FS.
// Archivo de ejemplo: apps/web/src/io/dxf/fixtures/terraplen.dxf (capas SUELO_1, arcilla y TERRENO; TERRENO es una polilínea abierta).
// Enunciado (lo que se le da al usuario): «Importe el archivo terraplen.dxf como modelo y calcule su factor de seguridad.»
// Inicio: primera visita, almacenamiento limpio. Fin: el FS visible en el resumen.
//
// Variantes (variable OGS_T3):
//   ruta_minima (por defecto): en el diálogo de importación elige «Reemplazar» si no viene marcado (con el arranque sin cambios ya viene),
//                              luego «Importar» y «Comprobar».
//   defecto:  se acepta todo lo que trae el diálogo al abrirse (destino por defecto, polilínea «Cerrarla con base y = 24»), sin tocar nada.
//             Antes de CM-WC el destino era «Agregar» y, con V047a cargado, daba «Modelo con 1 problema» y bloqueaba «Comprobar»; hoy calcula.
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
  // CM-W2: con el modelo de arranque sin cambios, «Reemplazar: crea un modelo nuevo con este archivo» ya viene marcado (CM-WC). Los textos
  // posibles del destino son ese y «Reemplazar las regiones actuales (se conservan materiales, agua y análisis)» (documento con cambios).
  const replace = page.locator('dialog[open] label', { hasText: /Reemplazar/ });
  run.meta.destino_marcado_al_abrir = (await replace.locator('input').first().isChecked()) ? 'Reemplazar' : 'Agregar';
  run.meta.texto_del_destino = (await replace.first().innerText()).trim();
  if (VARIANT !== 'defecto' && run.meta.destino_marcado_al_abrir !== 'Reemplazar') {
    run.think('elegir destino «Reemplazar»');
    await click(run, replace, 'Reemplazar');
  }
  // La polilínea abierta (TERRENO) se deja con su valor por defecto («Cerrarlas con una base horizontal», y = 24): el diálogo explica la cota
  // y el área (CM-W2). Se registra el texto.
  const help = page.locator('dialog[open] [data-testid="open-base-help"]');
  run.meta.explicacion_de_la_base = (await help.count()) > 0 ? (await help.first().innerText()).trim() : null;
  run.think('pulsar «Importar» en el diálogo');
  await click(run, page.getByRole('button', { name: 'Importar', exact: true }), 'Importar (diálogo DXF)');
  run.mark('dxf_importado');
  run.meta.resumen_tras_importar = (await page.locator('[data-testid="result-summary"]').innerText()).slice(0, 200);

  run.think('ubicar «Comprobar» en el pie de la barra lateral');
  // CM-W2: la variante `defecto` (se acepta todo lo que trae el diálogo) ya no se bloquea: calcula igual que la ruta mínima.
  run.meta.rotulo_del_documento = (await page.locator('.ua-main-head').first().innerText()).replace(/\s+/g, ' ').trim().slice(0, 160);
  await calcAndWaitFS(run, page, 'T3');
});
