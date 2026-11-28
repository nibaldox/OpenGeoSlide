// Aplica una importación al store como un solo gesto (una entrada de historial).

import type { Point } from '../../engine/types';
import type { EditorStore } from '../types';
import { piezoCreateCommands } from '../panels/forms';
import { isImperialUnits } from '../state/units';
import { applyPlanToDoc, importDocTitle, type RegionImportPlan } from './importPlan';
import { importedModel } from './newModel';

/**
 * `replace` sustituye las regiones; `add` agrega materiales nuevos y regiones. Ambos se deshacen con un Ctrl+Z.
 *
 * Con `fresh` (CM-W2: `replace` sobre el modelo de arranque sin cambios) el documento resultante no conserva nada del anterior: parte
 * del de «Nuevo» (`importedModel`) con los materiales y las regiones del plan y el nombre del archivo como título. El plan debe
 * haberse calculado sin los materiales del modelo anterior (`freshMapping`), porque aquí no quedan.
 */
export function applyRegionImport(store: EditorStore, plan: RegionImportPlan, mode: 'replace' | 'add', fresh?: { fileName: string }): void {
  if (mode === 'replace') {
    const s = store.getState();
    const doc = fresh
      ? importedModel({ title: importDocTitle(fresh.fileName), units: isImperialUnits(s.doc.units) ? 'imperial' : 'SI', materials: plan.newMaterials, regions: plan.regions })
      : applyPlanToDoc(s.doc, plan, 'replace');
    store.dispatch({ type: 'doc/replace', doc, fileName: s.file.name });
    store.dispatch({ type: 'ui/viewport', viewport: null });
    return;
  }
  store.beginGesture('Importar regiones');
  try {
    for (const material of plan.newMaterials) store.dispatch({ type: 'material/upsert', material });
    for (const region of plan.regions) store.dispatch({ type: 'region/add', region });
  } finally {
    store.endGesture();
  }
  store.dispatch({ type: 'ui/viewport', viewport: null });
}

/** Importa la piezométrica. En un modelo imperial sin γw fija también 62,4 pcf, en el mismo gesto (R9-09). */
export function applyPiezoImport(store: EditorStore, points: Point[]): void {
  store.beginGesture('Importar piezométrica');
  try {
    for (const cmd of piezoCreateCommands(store.getState().doc, points)) store.dispatch(cmd);
  } finally {
    store.endGesture();
  }
}
