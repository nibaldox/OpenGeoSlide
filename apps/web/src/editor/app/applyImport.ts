// Aplica una importación al store como un solo gesto (una entrada de historial).

import type { Point } from '../../engine/types';
import type { EditorStore } from '../types';
import { applyPlanToDoc, type RegionImportPlan } from './importPlan';

/** `replace` sustituye las regiones; `add` agrega materiales nuevos y regiones. Ambos se deshacen con un Ctrl+Z. */
export function applyRegionImport(store: EditorStore, plan: RegionImportPlan, mode: 'replace' | 'add'): void {
  if (mode === 'replace') {
    const s = store.getState();
    store.dispatch({ type: 'doc/replace', doc: applyPlanToDoc(s.doc, plan, 'replace'), fileName: s.file.name });
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

export function applyPiezoImport(store: EditorStore, points: Point[]): void {
  store.dispatch({ type: 'piezo/set', points });
}
