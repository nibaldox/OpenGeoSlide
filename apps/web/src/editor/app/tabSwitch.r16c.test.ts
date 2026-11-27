// R16c: el cambio de pestaña con un borrador de Geometría, Agua, Sismo, Superficie, Cargas o Material nuevo pide confirmación
// (R16B-02); al cancelar queda el borrador y al aceptar se limpia el registro. `beforeunload` también lo considera.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmOptions } from '../../ui/confirmQueue';
import { createEditorStore } from '../state';
import { clearPendingDrafts, getPendingDrafts, hasPendingDrafts, setPendingDraft } from '../panels/forms';
import { newDoc } from './docTemplates';
import { DISCARD_DRAFTS_CONFIRM, createTabSwitch } from './discard';
import { shouldWarnBeforeUnload, type UnloadGuardInput } from './useDraftAutosave';

type Tab = 'geometry' | 'materials' | 'water' | 'seismic' | 'surface' | 'loads';

const PANELS: Array<[Tab, string, string]> = [
  ['geometry', 'geometry:0:1', 'Vértice 2 (0, 10) de la región 1'],
  ['water', 'water:unit_weight', 'Agua: peso unitario γw'],
  ['seismic', 'seismic', 'Sismo'],
  ['surface', 'surface:polyline', 'Superficie fija: polilínea'],
  ['loads', 'load:2', 'Carga 3'],
  ['materials', 'material:new', 'Material nuevo'],
];

function setup(answer: boolean) {
  const store = createEditorStore(newDoc(), null);
  const confirm = vi.fn(async (_o: ConfirmOptions) => answer);
  const switchTab = createTabSwitch<Tab>({ getPendingDrafts: () => getPendingDrafts(store), clearDrafts: () => clearPendingDrafts(store), confirm });
  return { store, confirm, switchTab };
}

describe('R16c: cambio de pestaña con un borrador de cada panel nuevo', () => {
  for (const [tab, key, label] of PANELS) {
    it(`${label}: pregunta, y al cancelar conserva el borrador`, async () => {
      const { store, confirm, switchTab } = setup(false);
      setPendingDraft(store, key, label);
      expect(await switchTab(tab, tab === 'water' ? 'geometry' : 'water')).toBe(false);
      expect(confirm).toHaveBeenCalledWith(DISCARD_DRAFTS_CONFIRM([label]));
      expect(confirm.mock.calls[0]?.[0].message).toContain(label);
      expect(getPendingDrafts(store)).toEqual([label]);
    });
    it(`${label}: al aceptar cambia y limpia el registro`, async () => {
      const { store, switchTab } = setup(true);
      setPendingDraft(store, key, label);
      expect(await switchTab(tab, 'loads' === tab ? 'geometry' : 'loads')).toBe(true);
      expect(hasPendingDrafts(store)).toBe(false);
    });
  }
  it('la misma pestaña no pregunta', async () => {
    const { store, confirm, switchTab } = setup(false);
    setPendingDraft(store, 'seismic', 'Sismo');
    expect(await switchTab('seismic', 'seismic')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(getPendingDrafts(store)).toEqual(['Sismo']);
  });
  it('varias tarjetas: el mensaje las nombra todas', async () => {
    const { store, confirm, switchTab } = setup(false);
    for (const [, key, label] of PANELS) setPendingDraft(store, key, label);
    await switchTab('geometry', 'water');
    for (const [, , label] of PANELS) expect(confirm.mock.calls[0]?.[0].message).toContain(label);
  });
});

describe('R16c: shouldWarnBeforeUnload con borradores pendientes', () => {
  const saved: UnloadGuardInput = { dirty: false, autosaveEnabled: true, persistent: true, failure: null };
  it('documento guardado y un borrador pendiente: avisa', () => {
    expect(shouldWarnBeforeUnload({ ...saved, pendingDrafts: 1 })).toBe(true);
    expect(shouldWarnBeforeUnload({ ...saved, pendingDrafts: 3 })).toBe(true);
  });
  it('con el autoguardado a salvo y sin borradores no avisa (R7-18)', () => {
    expect(shouldWarnBeforeUnload(saved)).toBe(false);
    expect(shouldWarnBeforeUnload({ ...saved, dirty: true })).toBe(false);
    expect(shouldWarnBeforeUnload({ ...saved, pendingDrafts: 0 })).toBe(false);
  });
  it('los demás motivos siguen valiendo', () => {
    expect(shouldWarnBeforeUnload({ ...saved, tracePoints: 2 })).toBe(true);
    expect(shouldWarnBeforeUnload({ ...saved, dirty: true, failure: 'x' })).toBe(true);
    expect(shouldWarnBeforeUnload({ ...saved, dirty: true, persistent: false, pendingDrafts: 0 })).toBe(true);
  });
  it('un borrador que se limpia deja de avisar', () => {
    const store = createEditorStore(newDoc(), null);
    const input = (): UnloadGuardInput => ({ ...saved, pendingDrafts: getPendingDrafts(store).length });
    setPendingDraft(store, 'seismic', 'Sismo');
    expect(shouldWarnBeforeUnload(input())).toBe(true);
    setPendingDraft(store, 'seismic', null);
    expect(shouldWarnBeforeUnload(input())).toBe(false);
  });
  it('EditorApp pasa el número de borradores del registro a la guarda', () => {
    const src = readFileSync(new URL('../EditorApp.tsx', import.meta.url), 'utf8');
    expect(src).toContain('pendingDrafts: engine.pendingDrafts.length');
  });
});
