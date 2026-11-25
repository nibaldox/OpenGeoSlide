// Descartar el trabajo actual con el diálogo de la aplicación: cancelar nunca descarta (Nuevo, Abrir, Ejemplos, Talud simple, Recuperar).
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmOptions } from '../../ui/confirmQueue';
import { normalizeConfirm } from '../../ui/confirmQueue';
import { createEditorStore } from '../state';
import { newDoc } from './docTemplates';
import { DISCARD_CONFIRM, DISCARD_TRACE_CONFIRM, createConfirmDiscard, createToolSwitch, discardConfirmFor, hasUnsavedChanges, runIfDiscarded } from './discard';
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

describe('A-08: un trazo a medias cuenta como cambios sin guardar', () => {
  it('con un modelo sin cambios, un trazo con puntos hace que hasUnsavedChanges sea verdadero', () => {
    const store = cleanStore();
    expect(hasUnsavedChanges(store)).toBe(false);
    store.dispatch({ type: 'ui/trace', points: 2 });
    expect(hasUnsavedChanges(store)).toBe(true);
    store.dispatch({ type: 'ui/trace', points: 0 });
    expect(hasUnsavedChanges(store)).toBe(false);
  });
  it('«Abrir» con un trazo en curso pregunta antes de descartar (y lo dice)', async () => {
    const store = cleanStore();
    store.dispatch({ type: 'ui/trace', points: 3 });
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    expect(await createConfirmDiscard(store, confirm)()).toBe(false);
    const asked = confirm.mock.calls[0]![0];
    expect(asked.tone).toBe('danger');
    expect(asked.message).toMatch(/trazo/);
    expect(asked.message).toContain('3 puntos');
    expect(asked).toEqual(discardConfirmFor({ revision: 0, file: { savedRevision: 0 }, ui: { tracePoints: 3 } }));
  });
  it('con cambios en el modelo y un trazo, el texto habitual añade el trazo', () => {
    const o = discardConfirmFor({ revision: 3, file: { savedRevision: 0 }, ui: { tracePoints: 1 } });
    expect(o.message).toContain(DISCARD_CONFIRM.message);
    expect(o.message).toContain('1 punto');
    expect(discardConfirmFor({ revision: 3, file: { savedRevision: 0 }, ui: { tracePoints: 0 } })).toBe(DISCARD_CONFIRM);
    expect(DISCARD_TRACE_CONFIRM(2).confirmLabel).toBe('Descartar el trazo');
  });
});

describe('A-04: cambiar de herramienta con un trazo en curso', () => {
  const traced = (points: number, tool: 'draw_region' | 'split_region' = 'draw_region') => {
    const store = createEditorStore(newDoc(), null);
    store.dispatch({ type: 'ui/tool', tool });
    store.dispatch({ type: 'ui/trace', points });
    return store;
  };
  it('con 3 o más puntos pide confirmación de tono «danger»; si se cancela, la herramienta no cambia', async () => {
    const store = traced(4);
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    expect(await createToolSwitch(store, confirm)('select')).toBe(false);
    expect(store.getState().ui.tool).toBe('draw_region');
    expect(confirm).toHaveBeenCalledTimes(1);
    const asked = confirm.mock.calls[0]![0];
    expect(asked.tone).toBe('danger');
    expect(asked.message).toContain('4 puntos');
  });
  it('si se confirma, cambia de herramienta', async () => {
    const store = traced(3, 'split_region');
    expect(await createToolSwitch(store, async () => true)('draw_region')).toBe(true);
    expect(store.getState().ui.tool).toBe('draw_region');
  });
  it('con 1 o 2 puntos cambia sin preguntar (el lienzo anuncia el descarte); sin trazo, tampoco pregunta', async () => {
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    const two = traced(2);
    expect(await createToolSwitch(two, confirm)('pan')).toBe(true);
    expect(two.getState().ui.tool).toBe('pan');
    const none = traced(0);
    expect(await createToolSwitch(none, confirm)('select')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
  it('elegir la herramienta que ya está activa no pregunta ni cambia nada', async () => {
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    const store = traced(5);
    expect(await createToolSwitch(store, confirm)('draw_region')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
