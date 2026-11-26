import { describe, expect, it } from 'vitest';
import { createDraftAutosaver, createMemoryStorage, loadDraft } from '../../io/draft';
import { createEditorStore } from '../state';
import { newDoc } from './docTemplates';
import { attachDraftAutosave, shouldWarnBeforeUnload } from './useDraftAutosave';

const ok = { dirty: true, autosaveEnabled: true, persistent: true, failure: null };

describe('shouldWarnBeforeUnload (R7-18)', () => {
  it('sin cambios pendientes no avisa', () => {
    expect(shouldWarnBeforeUnload({ ...ok, dirty: false, failure: 'x', persistent: false })).toBe(false);
  });
  it('con cambios y el borrador guardándose bien no avisa', () => {
    expect(shouldWarnBeforeUnload(ok)).toBe(false);
  });
  it('con cambios y el último guardado del borrador falló, avisa', () => {
    expect(shouldWarnBeforeUnload({ ...ok, failure: 'El borrador supera 1 MB.' })).toBe(true);
  });
  it('con cambios y el almacenamiento solo en memoria, avisa', () => {
    expect(shouldWarnBeforeUnload({ ...ok, persistent: false })).toBe(true);
  });
  it('con cambios y el autoguardado en pausa (se ofrece recuperar un borrador), avisa', () => {
    expect(shouldWarnBeforeUnload({ ...ok, autosaveEnabled: false })).toBe(true);
  });
});

describe('shouldWarnBeforeUnload con un trazo a medias (R9-11a)', () => {
  it('avisa aunque el borrador esté a salvo y el documento limpio: el trazo no está en el borrador', () => {
    expect(shouldWarnBeforeUnload({ ...ok, dirty: false, tracePoints: 2 })).toBe(true);
    expect(shouldWarnBeforeUnload({ ...ok, dirty: true, tracePoints: 1 })).toBe(true);
  });
  it('sin puntos no cambia nada', () => {
    expect(shouldWarnBeforeUnload({ ...ok, dirty: false, tracePoints: 0 })).toBe(false);
    expect(shouldWarnBeforeUnload({ ...ok, tracePoints: 0 })).toBe(false);
  });
});

describe('attachDraftAutosave (R9-02a)', () => {
  const setup = () => {
    const storage = createMemoryStorage();
    const saver = createDraftAutosaver({ storage, setTimer: () => 1, clearTimer: () => undefined });
    const store = createEditorStore(newDoc(), null);
    store.markSaved('a.ogs.json');
    return { storage, saver, store };
  };
  it('con cambios sin guardar al activarse (editó con el banner a la vista y pulsó «Descartar») guarda ya, sin esperar otra edición', () => {
    const { storage, saver, store } = setup();
    store.dispatch({ type: 'meta/patch', patch: { title: 'editado con el banner' } }); // autoguardado en pausa
    expect(loadDraft(storage).draft).toBeNull();
    attachDraftAutosave(store, saver); // «Descartar»: el autoguardado se habilita
    expect(loadDraft(storage).draft?.doc.meta.title).toBe('editado con el banner');
  });
  it('sin cambios al activarse no escribe nada (no pisa el borrador de otra pestaña)', () => {
    const { storage, saver, store } = setup();
    attachDraftAutosave(store, saver);
    expect(storage.getItem('ogs.editor.draft.v1')).toBeNull();
  });
  it('las ediciones posteriores siguen programando el guardado y detach las detiene', () => {
    const { storage, saver, store } = setup();
    const detach = attachDraftAutosave(store, saver);
    store.dispatch({ type: 'meta/patch', patch: { title: 'otra' } });
    expect(saver.flush()).not.toBeNull();
    expect(loadDraft(storage).draft?.doc.meta.title).toBe('otra');
    detach();
    store.dispatch({ type: 'meta/patch', patch: { title: 'tras detach' } });
    expect(saver.flush()).toBeNull();
  });
});
