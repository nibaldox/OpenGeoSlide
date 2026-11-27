// R16B-02 (descarte del documento): Nuevo, Abrir, Ejemplos, Talud simple y Recuperar también preguntan cuando hay
// borradores de tarjeta sin aplicar, aunque el documento esté guardado.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmOptions } from '../../ui/confirmQueue';
import { createEditorStore } from '../state';
import { newDoc } from './docTemplates';
import { DISCARD_CONFIRM, DISCARD_DRAFTS_CONFIRM, DISCARD_TRACE_CONFIRM, createConfirmDiscard, discardConfirmFor, hasUnsavedChanges, runIfDiscarded } from './discard';
import { emptyModel } from './newModel';
import { readOpenFile } from './openFile';

const saved = (extra: { trace?: number } = {}) => ({ revision: 0, file: { savedRevision: 0 }, ui: { tracePoints: extra.trace ?? 0 } });
const dirty = (extra: { trace?: number } = {}) => ({ revision: 3, file: { savedRevision: 0 }, ui: { tracePoints: extra.trace ?? 0 } });

function cleanStore() {
  const store = createEditorStore(newDoc(), null);
  store.markSaved('a.ogs.json');
  return store;
}

describe('createConfirmDiscard con borradores sin aplicar', () => {
  it('documento guardado y un borrador: pregunta, con el texto de los borradores', async () => {
    const store = cleanStore();
    expect(hasUnsavedChanges(store)).toBe(false);
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    expect(await createConfirmDiscard(store, confirm, () => ['Material m1'])()).toBe(false);
    expect(confirm).toHaveBeenCalledWith(DISCARD_DRAFTS_CONFIRM(['Material m1']));
    expect(confirm.mock.calls[0]?.[0].tone).toBe('danger');
  });

  it('documento guardado y sin borradores: no pregunta (como antes); sin el tercer parámetro tampoco', async () => {
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    expect(await createConfirmDiscard(cleanStore(), confirm, () => [])()).toBe(true);
    expect(await createConfirmDiscard(cleanStore(), confirm)()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('acepta o cancela según la respuesta', async () => {
    expect(await createConfirmDiscard(cleanStore(), async () => true, () => ['Búsqueda'])()).toBe(true);
    expect(await createConfirmDiscard(cleanStore(), async () => false, () => ['Búsqueda'])()).toBe(false);
  });

  it('consulta los borradores al preguntar, no al crear la función', async () => {
    let drafts: readonly string[] = [];
    const confirm = vi.fn(async (_o: ConfirmOptions) => true);
    const confirmDiscard = createConfirmDiscard(cleanStore(), confirm, () => drafts);
    expect(await confirmDiscard()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    drafts = ['Material m2'];
    await confirmDiscard();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('Abrir: con un borrador y el diálogo cancelado no devuelve documento', async () => {
    const r = await readOpenFile({ name: 'b.ogs.json', text: async () => '{}' }, createConfirmDiscard(cleanStore(), async () => false, () => ['Material m1']), () => ({ doc: newDoc(), issues: [] }));
    expect(r).toEqual({ doc: null, notices: [] });
  });

  it('Nuevo/Ejemplos/Talud simple/Recuperar: cancelar no ejecuta la carga ni toca el modelo', async () => {
    const store = cleanStore();
    const before = store.getState().doc;
    const ran = await runIfDiscarded(createConfirmDiscard(store, async () => false, () => ['Material m1']), () => store.dispatch({ type: 'doc/load', doc: emptyModel(), fileName: null }));
    expect(ran).toBe(false);
    expect(store.getState().doc).toBe(before);
  });
});

describe('discardConfirmFor: qué se pierde (modelo, trazo, borradores; combinables)', () => {
  it('sin borradores conserva los textos de siempre', () => {
    expect(discardConfirmFor(dirty())).toBe(DISCARD_CONFIRM);
    expect(discardConfirmFor(saved({ trace: 3 }))).toEqual(DISCARD_TRACE_CONFIRM(3));
    expect(discardConfirmFor(dirty({ trace: 1 })).message).toContain('También se descarta el trazo en curso (1 punto).');
  });

  it('solo borradores: título «Descartar los cambios sin aplicar» y las tarjetas', () => {
    const o = discardConfirmFor(saved(), ['Material m1', 'Búsqueda']);
    expect(o).toEqual(DISCARD_DRAFTS_CONFIRM(['Material m1', 'Búsqueda']));
    expect(o.message).toContain('Material m1, Búsqueda');
    expect(o.message).not.toContain('guardado en un archivo');
  });

  it('modelo sin guardar y borradores: el texto del modelo más los borradores', () => {
    const o = discardConfirmFor(dirty(), ['Material m1']);
    expect(o.title).toBe(DISCARD_CONFIRM.title);
    expect(o.message).toContain(DISCARD_CONFIRM.message);
    expect(o.message).toContain('cambios sin aplicar de: Material m1');
    expect(o.tone).toBe('danger');
  });

  it('borradores y trazo con el modelo guardado: ambos', () => {
    const o = discardConfirmFor(saved({ trace: 2 }), ['Búsqueda']);
    expect(o.title).toBe('Descartar los cambios sin aplicar');
    expect(o.message).toContain('Búsqueda');
    expect(o.message).toContain('trazo en curso (2 puntos)');
  });

  it('modelo, trazo y borradores: los tres', () => {
    const o = discardConfirmFor(dirty({ trace: 4 }), ['Material m1']);
    expect(o.message).toContain(DISCARD_CONFIRM.message);
    expect(o.message).toContain('trazo en curso (4 puntos)');
    expect(o.message).toContain('Material m1');
  });
});

describe('EditorApp: confirmDiscard recibe los borradores del almacén', () => {
  it('createConfirmDiscard se crea con getPendingDrafts(store)', () => {
    const src = readFileSync(new URL('../EditorApp.tsx', import.meta.url), 'utf8');
    expect(src).toContain('createConfirmDiscard(store, confirm, () => getPendingDrafts(store))');
  });
});
