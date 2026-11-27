// R16 (tarea 4): invariante «no existe ningún estado sin bloqueo en que una tarjeta visible muestre un modelo distinto
// del documento», con deshacer/rehacer, dos tarjetas con borrador y eliminar el material con borrador.
//
// Las tarjetas se modelan como `MaterialCard`: formulario (`useDraft`, que se reinicia cuando cambia la identidad del material),
// evaluación (`evaluateMaterialCard`) y registro (`setPendingDraft`, que el efecto de la tarjeta mantiene al día).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Material } from '../../engine/types';
import { createEditorStore } from '../state';
import type { ModelDoc } from '../types';
import {
  clearPendingDrafts,
  evaluateMaterialCard,
  getPendingDrafts,
  hasPendingDrafts,
  materialRemoveCommand,
  materialToForm,
  materialUpsertCommand,
  setPendingDraft,
  type MaterialForm,
} from './forms';
import { planModelChange } from './MaterialsPanel';

const mc = (id: string, cohesion = 5): Material => ({ id, name: `Suelo ${id}`, model: 'mohr_coulomb', unit_weight: 20, unit_weight_sat: null, cohesion, friction_angle: 30, ru: null });

function makeDoc(materials: Material[]): ModelDoc {
  return {
    format: 'opengeoslide',
    version: '0.3',
    meta: {},
    units: 'SI',
    materials,
    regions: [{ material: materials[0]?.id ?? 'm1', polygon: [[0, 0], [0, 10], [20, 10], [40, 0]] }],
    water: null,
    slope: { direction: 'auto' },
    analysis: { methods: ['spencer'], slices: 20, surface: { type: 'circle', xc: 20, yc: 25, r: 20 } },
  } as unknown as ModelDoc;
}

/** Una tarjeta con su formulario local, como `MaterialCard` + `useDraft(() => materialToForm(material), [material])`. */
function card(store: ReturnType<typeof createEditorStore>, id: string) {
  const find = (): Material => store.getState().doc.materials.find((m) => m.id === id) as Material;
  let seen = find();
  let form: MaterialForm = materialToForm(seen);
  const key = `material:${id}`;
  /** Lo que hace React al renderizar: `useDraft` rehace el formulario si cambió la identidad del material; el efecto actualiza el registro. */
  const render = () => {
    const material = find();
    if (!Object.is(material, seen)) {
      seen = material;
      form = materialToForm(material);
    }
    const ev = evaluateMaterialCard(form, material, { otherIds: [], editing: material });
    setPendingDraft(store, key, ev.pending ? `Material ${id}` : null);
    return ev;
  };
  return {
    key,
    render,
    form: () => form,
    pickModel(model: Material['model'] & string) {
      const change = planModelChange(find(), form, model, 'SI');
      if (change.kind === 'command') store.dispatch(materialUpsertCommand(change.material));
      else if (change.kind === 'draft') form = change.form;
      else form = materialToForm(find());
      return render();
    },
    reset() {
      form = materialToForm(find());
      return render();
    },
    unmount() {
      setPendingDraft(store, key, null);
    },
  };
}

/** La tarjeta no enseña nada distinto del documento sin un bloqueo: o hay borrador registrado, o el formulario ya coincide con el documento. */
const showsDocumentOrBlocked = (store: ReturnType<typeof createEditorStore>, id: string, c: ReturnType<typeof card>): boolean => {
  const material = store.getState().doc.materials.find((m) => m.id === id) as Material;
  const ev = evaluateMaterialCard(c.form(), material, { otherIds: [], editing: material });
  return getPendingDrafts(store).includes(`Material ${id}`) || (ev.commit === null && !ev.pending);
};

describe('R16 deshacer y rehacer con un borrador', () => {
  it('deshacer un cambio ajeno a la tarjeta conserva el borrador y el bloqueo sigue (la identidad del material no cambia)', () => {
    const store = createEditorStore(makeDoc([mc('m1')]), null);
    store.dispatch({ type: 'meta/patch', patch: { title: 'otro cambio' } });
    const c = card(store, 'm1');
    c.render();
    c.pickModel('hoek_brown');
    expect(hasPendingDrafts(store)).toBe(true);

    const materialBefore = store.getState().doc.materials[0];
    store.undo();
    expect(store.getState().doc.materials[0]).toBe(materialBefore);
    expect(c.render().pending).toBe(true);
    expect(getPendingDrafts(store)).toEqual(['Material m1']);
    expect(showsDocumentOrBlocked(store, 'm1', c)).toBe(true);
    store.redo();
    expect(c.render().pending).toBe(true);
    expect(hasPendingDrafts(store)).toBe(true);
  });

  it('deshacer el cambio del propio material rehace la tarjeta desde el documento y el registro se limpia', () => {
    const store = createEditorStore(makeDoc([mc('m1', 5)]), null);
    store.dispatch(materialUpsertCommand(mc('m1', 8)));
    const c = card(store, 'm1');
    c.render();
    c.pickModel('hoek_brown');
    expect(hasPendingDrafts(store)).toBe(true);

    store.undo();
    expect(store.getState().doc.materials[0]?.cohesion).toBe(5);
    const ev = c.render();
    expect(ev.pending).toBe(false);
    expect(c.form().model).toBe('mohr_coulomb');
    expect(c.form().cohesion).toBe('5');
    expect(hasPendingDrafts(store)).toBe(false);
    expect(showsDocumentOrBlocked(store, 'm1', c)).toBe(true);

    // y rehacer tampoco deja una tarjeta con otro modelo sin bloqueo
    c.pickModel('hoek_brown');
    store.redo();
    c.render();
    expect(c.form().cohesion).toBe('8');
    expect(c.form().model).toBe('mohr_coulomb');
    expect(hasPendingDrafts(store)).toBe(false);
    expect(showsDocumentOrBlocked(store, 'm1', c)).toBe(true);
  });

  it('el invariante se mantiene en cada paso de una secuencia de cambios de modelo, deshacer y rehacer', () => {
    const store = createEditorStore(makeDoc([mc('m1')]), null);
    const c = card(store, 'm1');
    c.render();
    const steps: Array<() => void> = [
      () => c.pickModel('hoek_brown'),
      () => c.pickModel('shansep'),
      () => c.pickModel('undrained'),
      () => store.undo(),
      () => c.pickModel('hoek_brown'),
      () => store.undo(),
      () => store.redo(),
      () => c.reset(),
      () => c.pickModel('mohr_coulomb'),
    ];
    for (const step of steps) {
      step();
      c.render();
      expect(showsDocumentOrBlocked(store, 'm1', c)).toBe(true);
    }
  });
});

describe('R16 dos tarjetas con borrador', () => {
  it('el registro tiene las dos y cada una se limpia sola al restablecer o aplicar', () => {
    const store = createEditorStore(makeDoc([mc('m1'), mc('m2')]), null);
    const a = card(store, 'm1');
    const b = card(store, 'm2');
    a.render();
    b.render();
    a.pickModel('hoek_brown');
    b.pickModel('shansep');
    expect(getPendingDrafts(store)).toEqual(['Material m1', 'Material m2']);

    a.reset(); // «Descartar cambios» de la primera
    expect(getPendingDrafts(store)).toEqual(['Material m2']);
    expect(hasPendingDrafts(store)).toBe(true);

    // la segunda se completa y se aplica: el documento cambia y su borrador desaparece
    const filled: MaterialForm = { ...b.form(), ratio: '0,25', ocrSource: 'ocr', ocr: '1,5' };
    const ev = evaluateMaterialCard(filled, store.getState().doc.materials[1] as Material, { otherIds: ['m1'], editing: store.getState().doc.materials[1] as Material });
    expect(ev.pending).toBe(false);
    expect(ev.commit?.model).toBe('shansep');
    store.dispatch(materialUpsertCommand(ev.commit as Material));
    b.render();
    expect(getPendingDrafts(store)).toEqual([]);
    expect(store.getState().doc.materials[0]?.model).toBe('mohr_coulomb');
  });

  it('confirmar el descarte de pestaña (clearPendingDrafts) vacía las dos', () => {
    const store = createEditorStore(makeDoc([mc('m1'), mc('m2')]), null);
    const a = card(store, 'm1');
    const b = card(store, 'm2');
    a.render();
    b.render();
    a.pickModel('hoek_brown');
    b.pickModel('hoek_brown');
    clearPendingDrafts(store);
    expect(hasPendingDrafts(store)).toBe(false);
  });
});

describe('R16 eliminar el material que tiene el borrador', () => {
  it('el material sin uso se puede quitar y al desmontar la tarjeta su borrador sale del registro', () => {
    const store = createEditorStore(makeDoc([mc('m1'), mc('m2')]), null);
    const b = card(store, 'm2');
    b.render();
    b.pickModel('hoek_brown');
    expect(getPendingDrafts(store)).toEqual(['Material m2']);

    const remove = materialRemoveCommand(store.getState().doc, 'm2');
    expect(remove).not.toBeNull();
    store.dispatch(remove as NonNullable<typeof remove>);
    b.unmount(); // el panel quita la tarjeta del material eliminado
    expect(store.getState().doc.materials.map((m) => m.id)).toEqual(['m1']);
    expect(hasPendingDrafts(store)).toBe(false);
  });

  it('MaterialCard limpia su entrada del registro al desmontarse y al cambiar de material', () => {
    const src = readFileSync(new URL('./MaterialsPanel.tsx', import.meta.url), 'utf8');
    expect(src).toContain('return () => setPendingDraft(store, key, null);');
  });
});
