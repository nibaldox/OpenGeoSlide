// RCM-B-09: deshacer la primera importación sobre el modelo de arranque restaura «Ejemplo», el estado limpio y «Reemplazar» por defecto.
// Con el almacén real y el historial real; la decisión es por identidad del documento (sin comparar documentos enteros).
import { describe, expect, it } from 'vitest';
import { loadCaseDoc } from '../../report/fixtures';
import { createEditorStore } from '../state';
import type { EditorStoreWithSave } from '../state';
import type { ModelDoc } from '../types';
import { applyRegionImport } from './applyImport';
import { isFreshImport, type RegionImportPlan } from './importPlan';
import { isStartDocument, startRestoration } from './startDocument';

const plan = (): RegionImportPlan => ({
  regions: [{ material: 'suelo', vertices: [[0, 0], [10, 0], [10, 5], [0, 5]] } as never],
  newMaterials: [{ id: 'suelo', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 18, cohesion: 5, friction_angle: 30 } as never],
  warnings: [],
} as unknown as RegionImportPlan);

function boot(): { store: EditorStoreWithSave; start: ModelDoc } {
  const doc = loadCaseDoc('V047a');
  const store = createEditorStore(doc, null);
  return { store, start: store.getState().doc };
}

/** Lo que `EditorApp` hace tras cada cambio del almacén (el efecto de RCM-B-09). */
function settle(store: EditorStoreWithSave, start: ModelDoc, flags: { example: boolean }): void {
  const r = startRestoration(store.getState(), start);
  if (r === null) return;
  flags.example = r.example;
  if (r.markClean) store.markSaved(null);
}
const dirty = (store: EditorStoreWithSave): boolean => store.getState().revision !== store.getState().file.savedRevision;

describe('RCM-B-09: volver al documento de arranque con el historial', () => {
  it('al arrancar es el documento de arranque, limpio y sin nada que restaurar', () => {
    const { store, start } = boot();
    expect(isStartDocument(store.getState(), start)).toBe(true);
    expect(startRestoration(store.getState(), start)).toEqual({ example: true, markClean: false });
  });

  it('importar con «Reemplazar» y deshacer: vuelve «Ejemplo», el documento queda limpio y la siguiente importación propone «Reemplazar»', () => {
    const { store, start } = boot();
    const flags = { example: true };
    const base = (): { regionCount: number; title: string | null; pristineStart: boolean } => ({
      regionCount: store.getState().doc.regions.length,
      title: store.getState().doc.meta?.title ?? null,
      pristineStart: isStartDocument(store.getState(), start),
    });
    expect(isFreshImport('replace', base())).toBe(true);

    applyRegionImport(store, plan(), 'replace', { fileName: 'terraplen.dxf' });
    flags.example = false; // lo que hace `applyRegions` en EditorApp
    settle(store, start, flags);
    expect(isStartDocument(store.getState(), start)).toBe(false);
    expect(flags.example).toBe(false);
    expect(dirty(store)).toBe(true);
    expect(isFreshImport('replace', base())).toBe(false);

    store.undo();
    expect(store.getState().doc).toBe(start); // la misma referencia: el historial no la copia
    expect(dirty(store)).toBe(true); // antes de restaurar: la revisión sigue subiendo
    settle(store, start, flags);
    expect(flags.example).toBe(true);
    expect(dirty(store)).toBe(false);
    expect(isFreshImport('replace', base())).toBe(true); // «Reemplazar» otra vez

    store.redo(); // rehacer vuelve a la importación: ya no es el de arranque y sí hay cambios
    settle(store, start, flags);
    expect(isStartDocument(store.getState(), start)).toBe(false);
    expect(dirty(store)).toBe(true);
  });

  it('una edición del modelo de arranque y su deshacer también vuelven a limpio; guardar lo saca del arranque para siempre', () => {
    const { store, start } = boot();
    const flags = { example: true };
    store.dispatch({ type: 'meta/patch', patch: { title: 'Otro título' } });
    settle(store, start, flags);
    expect(isStartDocument(store.getState(), start)).toBe(false);
    expect(dirty(store)).toBe(true);
    store.undo();
    settle(store, start, flags);
    expect(dirty(store)).toBe(false);
    store.redo();
    store.markSaved('modelo.ogs.json');
    store.undo();
    expect(startRestoration(store.getState(), start)).toBeNull();
  });

  it('un documento que no es el de arranque (Nuevo, Abrir, ejemplos) nunca lo es, aunque se parezca', () => {
    const { store, start } = boot();
    store.dispatch({ type: 'doc/load', doc: structuredClone(start), fileName: null });
    expect(isStartDocument(store.getState(), start)).toBe(false);
    expect(startRestoration(store.getState(), start)).toBeNull();
  });
});
