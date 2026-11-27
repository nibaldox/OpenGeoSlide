// R16B-01: Guardar (botón, Ctrl+S y paleta) con borradores de tarjeta sin aplicar no descarga: avisa con el motivo y las tarjetas.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createEditorStore } from '../state';
import { PENDING_DRAFTS_TEXT, clearPendingDrafts, getPendingDrafts, pendingDraftsNotice, setPendingDraft } from '../panels/forms';
import { newDoc } from './docTemplates';
import { commitFocusedField, saveDocument, saveFileName, type SaveDeps } from './saveDocument';

function setup() {
  const store = createEditorStore(newDoc(), null);
  const download = vi.fn();
  const notify = vi.fn();
  const markSaved = vi.fn((name: string) => store.markSaved(name));
  const afterSave = vi.fn();
  const deps: SaveDeps = {
    getState: () => store.getState(),
    markSaved,
    getPendingDrafts: () => getPendingDrafts(store),
    download,
    notify,
    sha256: async () => 'abc123',
    afterSave,
  };
  return { store, deps, download, notify, markSaved, afterSave };
}

describe('R16B-01: guardar con borradores sin aplicar', () => {
  it('con un borrador no descarga, no marca guardado y avisa con el motivo y la tarjeta', async () => {
    const { store, deps, download, notify, markSaved, afterSave } = setup();
    store.dispatch({ type: 'meta/patch', patch: { title: 'editado' } });
    setPendingDraft(store, 'material:m1', 'Material m1');
    expect(await saveDocument(deps)).toBe('blocked');
    expect(download).not.toHaveBeenCalled();
    expect(markSaved).not.toHaveBeenCalled();
    expect(afterSave).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('aviso', pendingDraftsNotice(['Material m1']));
    expect(notify.mock.calls[0]?.[1]).toContain(PENDING_DRAFTS_TEXT);
    expect(notify.mock.calls[0]?.[1]).toContain('Material m1');
    // el documento sigue sin guardar: no se perdió ni se dio por archivado
    expect(store.getState().revision).not.toBe(store.getState().file.savedRevision);
  });

  it('lista todas las tarjetas con borrador', async () => {
    const { store, deps, notify } = setup();
    setPendingDraft(store, 'material:m1', 'Material m1');
    setPendingDraft(store, 'search', 'Búsqueda');
    await saveDocument(deps);
    expect(notify.mock.calls[0]?.[1]).toContain('Material m1, Búsqueda');
  });

  it('sin borrador descarga el documento, lo marca guardado y avisa del SHA-256', async () => {
    const { store, deps, download, notify, markSaved, afterSave } = setup();
    store.dispatch({ type: 'meta/patch', patch: { title: 'editado' } });
    expect(await saveDocument(deps)).toBe('saved');
    expect(download).toHaveBeenCalledTimes(1);
    const [text, name, mime] = download.mock.calls[0] as [string, string, string];
    expect(name).toMatch(/\.ogs\.json$/);
    expect(mime).toBe('application/json');
    expect(JSON.parse(text).meta.title).toBe('editado');
    expect(markSaved).toHaveBeenCalledWith(name);
    expect(afterSave).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith('info', `Guardado «${name}». SHA-256: abc123`);
    expect(store.getState().revision).toBe(store.getState().file.savedRevision);
  });

  it('al aplicar o descartar el borrador, guardar vuelve a funcionar', async () => {
    const { store, deps, download } = setup();
    setPendingDraft(store, 'material:m1', 'Material m1');
    expect(await saveDocument(deps)).toBe('blocked');
    setPendingDraft(store, 'material:m1', null);
    expect(await saveDocument(deps)).toBe('saved');
    setPendingDraft(store, 'material:m1', 'Material m1');
    clearPendingDrafts(store);
    expect(await saveDocument(deps)).toBe('saved');
    expect(download).toHaveBeenCalledTimes(2);
  });

  it('consulta los borradores en el momento de guardar, no al crear las dependencias', async () => {
    const { store, deps, download } = setup();
    expect(await saveDocument(deps)).toBe('saved');
    setPendingDraft(store, 'search', 'Búsqueda');
    expect(await saveDocument(deps)).toBe('blocked');
    expect(download).toHaveBeenCalledTimes(1);
  });

  it('un fallo al descargar se avisa como error y no marca guardado', async () => {
    const { deps, notify, markSaved } = setup();
    const boom: SaveDeps = { ...deps, download: () => { throw new Error('sin espacio'); } };
    expect(await saveDocument(boom)).toBe('error');
    expect(markSaved).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('error', 'No se pudo guardar: sin espacio');
  });

  it('el nombre conserva .ogs.json o lo agrega', () => {
    const doc = newDoc();
    expect(saveFileName('a.ogs.json', doc)).toBe('a.ogs.json');
    expect(saveFileName('a.json', doc)).toBe('a.ogs.json');
    expect(saveFileName(null, doc)).toMatch(/\.ogs\.json$/);
  });
});

describe('R16B-01: EditorApp enruta Guardar, Ctrl+S y la paleta por saveDocument y bloquea el botón', () => {
  const src = readFileSync(new URL('../EditorApp.tsx', import.meta.url), 'utf8');
  it('onSave usa saveDocument con los borradores del almacén', () => {
    expect(src).toContain('await saveDocument({');
    expect(src).toContain('getPendingDrafts: () => getPendingDrafts(store)');
    expect(src).not.toContain('saveOgsJson');
  });
  it('el atajo `save` (Ctrl+S y paleta) confirma el campo con foco y llama a onSave', () => {
    expect(src).toMatch(/save: \(\) => \{\s+commitFocusedField\(document\.activeElement\);\s+onSave\(\);\s+\},/);
  });
  it('el botón «Guardar» se deshabilita con borradores, con el mismo motivo que «Comprobar»', () => {
    const start = src.indexOf('onClick={onSave}');
    const block = src.slice(start - 80, start + 330);
    expect(block).toContain('disabled={hasDrafts}');
    expect(block).toContain("title={hasDrafts ? PENDING_DRAFTS_TEXT : 'Ctrl+S'}");
    expect(block).toContain("aria-describedby={hasDrafts ? 'ea-pending-drafts' : undefined}");
  });
});

describe('R16: Ctrl+S con un valor válido escrito y sin confirmar', () => {
  it('saca el foco de un campo de texto (su blur confirma el valor) antes de guardar', () => {
    let blurred = 0;
    expect(commitFocusedField({ tagName: 'INPUT', blur: () => { blurred += 1; } })).toBe(true);
    expect(commitFocusedField({ tagName: 'TEXTAREA', blur: () => { blurred += 1; } })).toBe(true);
    expect(blurred).toBe(2);
  });
  it('no toca otros elementos (botones, selector, cuerpo, nada)', () => {
    let blurred = 0;
    const blur = () => { blurred += 1; };
    for (const el of [{ tagName: 'BUTTON', blur }, { tagName: 'SELECT', blur }, { tagName: 'BODY', blur }, null, undefined]) expect(commitFocusedField(el)).toBe(false);
    expect(blurred).toBe(0);
  });
});
