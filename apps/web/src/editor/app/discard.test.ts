// Descartar el trabajo actual con el diálogo de la aplicación: cancelar nunca descarta (Nuevo, Abrir, Ejemplos, Talud simple, Recuperar).
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmOptions } from '../../ui/confirmQueue';
import { normalizeConfirm } from '../../ui/confirmQueue';
import { createEditorStore } from '../state';
import { newDoc } from './docTemplates';
import { DISCARD_CONFIRM, createConfirmDiscard, hasUnsavedChanges, runIfDiscarded } from './discard';
import { emptyModel, simpleSlope, slopeFormDefaults, slopeFromForm } from './newModel';
import { readOpenFile } from './openFile';

function dirtyStore() {
  const store = createEditorStore(newDoc(), null);
  store.markSaved('a.ogs.json');
  store.dispatch({ type: 'meta/patch', patch: { title: 'editado' } });
  return store;
}
const cleanStore = () => {
  const store = createEditorStore(newDoc(), null);
  store.markSaved('a.ogs.json');
  return store;
};

describe('DISCARD_CONFIRM', () => {
  it('texto claro en español, tono «danger» y botón seguro con nombre propio', () => {
    expect(DISCARD_CONFIRM.tone).toBe('danger');
    expect(DISCARD_CONFIRM.title).toMatch(/Descartar/);
    expect(DISCARD_CONFIRM.confirmLabel).toBe('Descartar cambios');
    expect(DISCARD_CONFIRM.cancelLabel).toBe('Seguir editando');
    expect(DISCARD_CONFIRM.message).toMatch(/sin guardar|no se han guardado/);
    expect(DISCARD_CONFIRM.message).toContain('Ctrl+S');
    expect(normalizeConfirm(DISCARD_CONFIRM).tone).toBe('danger');
  });
});

describe('createConfirmDiscard', () => {
  it('sin cambios sin guardar no pregunta', async () => {
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    expect(hasUnsavedChanges(cleanStore())).toBe(false);
    expect(await createConfirmDiscard(cleanStore(), confirm)()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
  it('con cambios pregunta con el texto de descarte y devuelve la respuesta', async () => {
    const store = dirtyStore();
    expect(hasUnsavedChanges(store)).toBe(true);
    const no = vi.fn(async (_o: ConfirmOptions) => false);
    expect(await createConfirmDiscard(store, no)()).toBe(false);
    expect(no).toHaveBeenCalledWith(DISCARD_CONFIRM);
    expect(await createConfirmDiscard(store, async () => true)()).toBe(true);
  });
  it('mira el estado en el momento de preguntar, no al crear la función', async () => {
    const store = cleanStore();
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    const confirmDiscard = createConfirmDiscard(store, confirm);
    store.dispatch({ type: 'meta/patch', patch: { title: 'x' } });
    expect(await confirmDiscard()).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

describe('llamadores: cancelar no descarta', () => {
  // Misma secuencia que EditorApp.onNew / onCreateSlope / onCase / recoverDraft: confirmar y, solo entonces, cargar el documento.
  const load = (store: ReturnType<typeof dirtyStore>, doc: ReturnType<typeof newDoc>) => () => store.dispatch({ type: 'doc/load', doc, fileName: null });

  it.each([
    ['Nuevo (modelo vacío)', () => emptyModel()],
    ['Talud simple', () => simpleSlope((slopeFromForm(slopeFormDefaults('SI')) as { ok: true; value: Parameters<typeof simpleSlope>[0] }).value)],
    ['Ejemplos / Recuperar', () => newDoc()],
  ])('%s: con «Seguir editando» el modelo y su historial quedan intactos', async (_name, make) => {
    const store = dirtyStore();
    const before = store.getState();
    const ran = await runIfDiscarded(createConfirmDiscard(store, async () => false), load(store, make()));
    expect(ran).toBe(false);
    expect(store.getState().doc).toBe(before.doc);
    expect(store.getState().history.past).toEqual(before.history.past);
    expect(store.getState().file.name).toBe('a.ogs.json');
  });

  it('con «Descartar cambios» carga el documento y reinicia el historial', async () => {
    const store = dirtyStore();
    const next = emptyModel();
    const ran = await runIfDiscarded(createConfirmDiscard(store, async () => true), load(store, next));
    expect(ran).toBe(true);
    expect(store.getState().doc).toBe(next);
    expect(store.getState().history.past).toEqual([]);
  });

  it('sin cambios no hay diálogo y la acción se ejecuta', async () => {
    const store = cleanStore();
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    expect(await runIfDiscarded(createConfirmDiscard(store, confirm), load(store, emptyModel()))).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('Abrir: readOpenFile con el diálogo cancelado no devuelve documento', async () => {
    const store = dirtyStore();
    const r = await readOpenFile({ name: 'b.ogs.json', text: async () => '{}' }, createConfirmDiscard(store, async () => false), () => ({ doc: newDoc(), issues: [] }));
    expect(r).toEqual({ doc: null, notices: [] });
  });
});
