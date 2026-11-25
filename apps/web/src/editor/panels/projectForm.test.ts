import { describe, expect, it } from 'vitest';
import { createEditorStore } from '../state';
import { newDoc } from '../app/docTemplates';
import type { ModelDoc } from '../types';
import {
  currentUnits,
  metaPatchCommand,
  projectToForm,
  unitsChangeCommand,
  unitsChangeConfirm,
  unitsOptions,
} from './projectForm';

const doc = (patch: Partial<ModelDoc> = {}): ModelDoc => ({ ...newDoc(), ...patch });

describe('projectToForm', () => {
  it('lee los campos reales de Meta: id, título y notas (descripción)', () => {
    const d = doc({ meta: { id: 'v1', title: 'Talud norte', notes: 'Corte de 10 m' } });
    expect(projectToForm(d)).toEqual({ id: 'v1', title: 'Talud norte', notes: 'Corte de 10 m' });
  });
  it('los campos ausentes o null salen como texto vacío', () => {
    expect(projectToForm(doc({ meta: { id: null, title: undefined } }))).toEqual({ id: '', title: '', notes: '' });
  });
});

describe('metaPatchCommand', () => {
  it('un título nuevo da un meta/patch', () => {
    expect(metaPatchCommand(doc({ meta: {} }), 'title', ' Talud sur ')).toEqual({ type: 'meta/patch', patch: { title: 'Talud sur' } });
  });
  it('sin cambios no hay comando (no ensucia el historial)', () => {
    expect(metaPatchCommand(doc({ meta: { title: 'A' } }), 'title', 'A')).toBeNull();
    expect(metaPatchCommand(doc({ meta: { title: 'A' } }), 'title', '  A  ')).toBeNull();
    expect(metaPatchCommand(doc({ meta: {} }), 'notes', '   ')).toBeNull();
    expect(metaPatchCommand(doc({ meta: { notes: null } }), 'notes', '')).toBeNull();
  });
  it('vaciar un campo lo quita del documento', () => {
    expect(metaPatchCommand(doc({ meta: { title: 'A' } }), 'title', '')).toEqual({ type: 'meta/patch', patch: { title: undefined } });
  });
  it('la descripción conserva los saltos de línea internos y recorta los extremos', () => {
    expect(metaPatchCommand(doc({ meta: {} }), 'notes', '\n Línea 1\nLínea 2 \n')).toEqual({ type: 'meta/patch', patch: { notes: 'Línea 1\nLínea 2' } });
  });
  it('el identificador no admite saltos de línea', () => {
    expect(metaPatchCommand(doc({ meta: {} }), 'id', 'a\nb')).toEqual({ type: 'meta/patch', patch: { id: 'a b' } });
  });
});

describe('metaPatchCommand con el almacén real', () => {
  it('cambia el título, se deshace y se rehace en un paso; el documento sigue siendo válido', () => {
    const store = createEditorStore(doc({ meta: { id: 'x', title: 'Antes' } }), null);
    const cmd = metaPatchCommand(store.getState().doc, 'title', 'Después');
    expect(cmd).not.toBeNull();
    store.dispatch(cmd!);
    expect(store.getState().doc.meta.title).toBe('Después');
    expect(store.getState().doc.meta.id).toBe('x');
    store.undo();
    expect(store.getState().doc.meta.title).toBe('Antes');
    store.redo();
    expect(store.getState().doc.meta.title).toBe('Después');
  });
  it('vaciar la descripción borra la clave (no deja null ni cadena vacía)', () => {
    const store = createEditorStore(doc({ meta: { notes: 'algo' } }), null);
    store.dispatch(metaPatchCommand(store.getState().doc, 'notes', '')!);
    expect('notes' in store.getState().doc.meta).toBe(false);
  });
});

describe('unidades', () => {
  it('se reconocen SI e imperial; sin valor cuenta como SI', () => {
    expect(currentUnits(doc({ units: 'imperial' }))).toEqual({ kind: 'imperial' });
    expect(currentUnits(doc({ units: 'SI' }))).toEqual({ kind: 'SI' });
    expect(currentUnits(doc({ units: undefined }))).toEqual({ kind: 'SI' });
  });
  it('otro texto se conserva tal cual y se avisa', () => {
    expect(currentUnits(doc({ units: 'metric-x' }))).toEqual({ kind: 'other', raw: 'metric-x' });
  });
  it('el selector ofrece SI e imperial, y el valor ajeno si existe', () => {
    expect(unitsOptions({ kind: 'SI' }).map((o) => o.value)).toEqual(['SI', 'imperial']);
    expect(unitsOptions({ kind: 'other', raw: 'm-kg' }).map((o) => o.value)).toEqual(['m-kg', 'SI', 'imperial']);
  });

  it('cambiar de unidades devuelve un doc/replace con solo las unidades cambiadas', () => {
    const d = doc({ units: 'SI' });
    const cmd = unitsChangeCommand(d, 'imperial');
    expect(cmd).toEqual({ type: 'doc/replace', doc: { ...d, units: 'imperial' }, fileName: null });
    // Ningún valor se convierte: materiales y geometría quedan idénticos.
    if (cmd?.type === 'doc/replace') {
      expect(cmd.doc.materials).toBe(d.materials);
      expect(cmd.doc.regions).toBe(d.regions);
    }
  });
  it('elegir las mismas unidades no hace nada', () => {
    expect(unitsChangeCommand(doc({ units: 'SI' }), 'SI')).toBeNull();
    expect(unitsChangeCommand(doc({ units: undefined }), 'SI')).toBeNull();
  });

  it('con el almacén real: no convierte valores, se deshace y no pierde la marca de cambios sin guardar', () => {
    const d = doc({ units: 'SI' });
    const store = createEditorStore(d, null);
    store.markSaved('talud.ogs.json');
    const before = store.getState();
    expect(before.revision).toBe(before.file.savedRevision);
    store.dispatch(unitsChangeCommand(before.doc, 'imperial')!);
    const after = store.getState();
    expect(after.doc.units).toBe('imperial');
    expect(after.doc.materials).toEqual(d.materials);
    expect(after.doc.regions).toEqual(d.regions);
    // Debe quedar con cambios sin guardar (de lo contrario, cerrar la pestaña no avisaría).
    expect(after.revision).not.toBe(after.file.savedRevision);
    store.undo();
    expect(store.getState().doc.units).toBe('SI');
  });
});

describe('unitsChangeConfirm', () => {
  it('el aviso explica que no se convierten los valores y pide confirmar', () => {
    const o = unitsChangeConfirm({ kind: 'SI' }, 'imperial');
    expect(o.title).toMatch(/unidades/i);
    expect(o.message).toMatch(/no convierte/i);
    expect(o.message).toMatch(/kN\/m³/);
    expect(o.message).toMatch(/pcf|lbf/);
    expect(o.message).toMatch(/Ctrl\+Z/);
    expect(o.confirmLabel).toMatch(/imperial/i);
    expect(o.tone).toBe('danger');
  });
  it('de imperial a SI, las unidades del aviso se invierten', () => {
    const o = unitsChangeConfirm({ kind: 'imperial' }, 'SI');
    expect(o.confirmLabel).toMatch(/SI/);
    expect(o.message).toMatch(/pcf/);
  });
});
