// R16B-02: cambiar de pestaña lateral con borradores de tarjeta sin aplicar pide confirmación (tono `danger`);
// al cancelar queda la pestaña con el borrador y al aceptar se limpia el registro.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { ConfirmOptions } from '../../ui/confirmQueue';
import { normalizeConfirm } from '../../ui/confirmQueue';
import { createEditorStore } from '../state';
import { clearPendingDrafts, getPendingDrafts, hasPendingDrafts, setPendingDraft } from '../panels/forms';
import { newDoc } from './docTemplates';
import { DISCARD_DRAFTS_CONFIRM, createTabSwitch } from './discard';

type Tab = 'geometry' | 'materials' | 'water';

function setup(answer: boolean) {
  const store = createEditorStore(newDoc(), null);
  const confirm = vi.fn(async (_o: ConfirmOptions) => answer);
  const switchTab = createTabSwitch<Tab>({
    getPendingDrafts: () => getPendingDrafts(store),
    clearDrafts: () => clearPendingDrafts(store),
    confirm,
  });
  return { store, confirm, switchTab };
}

describe('DISCARD_DRAFTS_CONFIRM', () => {
  it('título, botones y tono pedidos; el mensaje nombra las tarjetas', () => {
    const o = DISCARD_DRAFTS_CONFIRM(['Material m1', 'Búsqueda']);
    expect(o.title).toBe('Descartar los cambios sin aplicar');
    expect(o.confirmLabel).toBe('Descartar cambios');
    expect(o.cancelLabel).toBe('Seguir editando');
    expect(o.tone).toBe('danger');
    expect(o.message).toContain('Material m1, Búsqueda');
    expect(normalizeConfirm(o).tone).toBe('danger');
  });
});

describe('createTabSwitch', () => {
  it('sin borradores cambia sin preguntar', async () => {
    const { confirm, switchTab } = setup(false);
    expect(await switchTab('materials', 'water')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('con un borrador y la misma pestaña de destino no pregunta y conserva el borrador', async () => {
    const { store, confirm, switchTab } = setup(false);
    setPendingDraft(store, 'material:m1', 'Material m1');
    expect(await switchTab('materials', 'materials')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(getPendingDrafts(store)).toEqual(['Material m1']);
  });

  it('con un borrador pregunta con el texto de descarte y el nombre de la tarjeta', async () => {
    const { store, confirm, switchTab } = setup(false);
    setPendingDraft(store, 'material:m1', 'Material m1');
    await switchTab('materials', 'water');
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(DISCARD_DRAFTS_CONFIRM(['Material m1']));
  });

  it('al cancelar no cambia de pestaña y el borrador queda intacto', async () => {
    const { store, switchTab } = setup(false);
    setPendingDraft(store, 'material:m1', 'Material m1');
    expect(await switchTab('materials', 'water')).toBe(false);
    expect(getPendingDrafts(store)).toEqual(['Material m1']);
    expect(hasPendingDrafts(store)).toBe(true);
  });

  it('al aceptar cambia de pestaña y limpia el registro (todas las tarjetas)', async () => {
    const { store, switchTab } = setup(true);
    setPendingDraft(store, 'material:m1', 'Material m1');
    setPendingDraft(store, 'material:m2', 'Material m2');
    expect(await switchTab('materials', 'water')).toBe(true);
    expect(hasPendingDrafts(store)).toBe(false);
  });

  it('con las opciones extra (foco de retorno) las mezcla sin perder el texto', async () => {
    const store = createEditorStore(newDoc(), null);
    const confirm = vi.fn(async (_o: ConfirmOptions) => false);
    const focus = () => null;
    const switchTab = createTabSwitch<Tab>({ getPendingDrafts: () => getPendingDrafts(store), clearDrafts: () => clearPendingDrafts(store), confirm, confirmExtras: () => ({ returnFocus: focus }) });
    setPendingDraft(store, 'search', 'Búsqueda');
    await switchTab('geometry', 'water');
    expect(confirm).toHaveBeenCalledWith({ ...DISCARD_DRAFTS_CONFIRM(['Búsqueda']), returnFocus: focus });
  });

  it('pregunta con el estado del momento: un borrador nuevo tras crear la función también cuenta', async () => {
    const { store, confirm, switchTab } = setup(true);
    expect(await switchTab('geometry', 'materials')).toBe(true);
    setPendingDraft(store, 'search', 'Búsqueda');
    expect(await switchTab('materials', 'water')).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(1);
  });
});

describe('EditorApp: todo cambio de pestaña pasa por la confirmación', () => {
  const src = readFileSync(new URL('../EditorApp.tsx', import.meta.url), 'utf8');
  it('el estado de la pestaña solo se escribe dentro de `setTab` (tras confirmar)', () => {
    expect(src.match(/setTabState\(/g)).toHaveLength(1);
    expect(src).toContain('if (!(await confirmTabSwitch(tabRef.current, next))) return false;');
  });
  it('los botones del tablist (y con ellos las flechas, que activan al enfocar), «Editar título» del informe y Diagnósticos usan `setTab`', () => {
    // UA1-A: el tablist vive en `shell/StepList.tsx`; `EditorApp` le pasa `selectStep`, que es el único envoltorio de `setTab`.
    const list = readFileSync(new URL('./shell/StepList.tsx', import.meta.url), 'utf8');
    expect(list).toContain('onClick={() => onSelect(id)}');
    expect(src).toContain('const selectStep = useCallback((id: TabId): void => void setTab(id), [setTab]);');
    expect(src).toContain('onSelect={selectStep}');
    // UA3 A-09/A-10: Diagnósticos (`issueNavPlan`) y «Editar título» esperan la confirmación de `setTab` antes de tocar la barra o el foco.
    expect(src).toContain('if (plan.step && !(await setTab(plan.step))) return;');
    expect(src).toContain("if (!(await setTab('project'))) return;");
  });
  it('no queda ningún `setTab(` fuera de esos usos', () => {
    const calls = src.match(/\bsetTab\(/g) ?? [];
    expect(calls).toHaveLength(3); // `selectStep`, Diagnósticos y «Editar título»
  });
});
