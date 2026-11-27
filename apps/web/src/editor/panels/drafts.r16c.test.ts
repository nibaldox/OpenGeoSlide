// R16c (R16b2-03): los borradores de Geometría, Agua, Sismo, Superficie, Cargas y el formulario de material nuevo se registran con
// `setPendingDraft`, como ya hacían Materiales, Refuerzos, Análisis y Búsqueda. Cada panel expone su clave, su etiqueta y el criterio
// de «pendiente» (valor inválido o incompleto que difiere del documento); estas pruebas los ejercitan junto con el registro y las
// salidas que lo consultan (Guardar, Comprobar y exportar). El efecto de cada panel se verifica en Chrome (ver el informe R16c-W).
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { Load, Point } from '../../engine/types';
import { createEditorStore } from '../state';
import { newDoc } from '../app/docTemplates';
import { saveDocument, type SaveDeps } from '../app/saveDocument';
import {
  PENDING_DRAFTS_TEXT,
  clearPendingDrafts,
  getPendingDrafts,
  hasPendingDrafts,
  loadToForm,
  modelXRange,
  newMaterialForm,
  pendingDraftsNotice,
  piezoToForm,
  polylineToForm,
  circleToForm,
  seismicToForm,
  setPendingDraft,
  seismicSetCommand,
  type LoadForm,
} from './forms';
import { coordText } from './geometry';
import { metaPatchCommand, projectToForm } from './projectForm';
import { vertexDraftKey, vertexDraftLabel, vertexDraftPending } from './GeometryPanel';
import { SEISMIC_DRAFT, seismicDraftPending } from './SeismicPanel';
import { WATER_GAMMA_DRAFT, WATER_PIEZO_DRAFT, gammaDraftPending, piezoDraftPending } from './WaterPanel';
import { SURFACE_CIRCLE_DRAFT, SURFACE_POLYLINE_DRAFT, circleDraftPending, polylineDraftPending } from './SurfacePanel';
import { loadDraftKey, loadDraftLabel, loadDraftPending } from './LoadsPanel';
import { NEW_MATERIAL_DRAFT, newMaterialDraftPending } from './MaterialsPanel';

type Store = ReturnType<typeof createEditorStore>;

/** Lo que hace el efecto de cada panel tras renderizar: registra con la etiqueta, o limpia. */
const sync = (store: Store, key: string, label: string, pending: boolean): void => setPendingDraft(store, key, pending ? label : null);
const unmount = (store: Store, key: string): void => setPendingDraft(store, key, null);

function setupSave(store: Store) {
  const download = vi.fn();
  const notify = vi.fn();
  const deps: SaveDeps = {
    getState: () => store.getState(),
    markSaved: (name) => store.markSaved(name),
    getPendingDrafts: () => getPendingDrafts(store),
    download,
    notify,
    sha256: async () => 'abc123',
    afterSave: () => undefined,
  };
  return { deps, download, notify };
}

/** Lo que bloquea «Comprobar» y las exportaciones: `hasPendingDrafts` (`useEngineCheck.check` y `EditorApp`). */
const blocksCheck = (store: Store): boolean => hasPendingDrafts(store);

/** Comprueba, para un panel, el ciclo completo: inválido → registra y bloquea Guardar y Comprobar; restablecer/aplicar → limpia. */
async function cycle(store: Store, key: string, label: string, invalid: boolean, valid: boolean): Promise<void> {
  expect(getPendingDrafts(store)).toEqual([]);
  sync(store, key, label, invalid);
  expect(getPendingDrafts(store)).toEqual([label]);
  expect(blocksCheck(store)).toBe(true);
  const { deps, download, notify } = setupSave(store);
  expect(await saveDocument(deps)).toBe('blocked');
  expect(download).not.toHaveBeenCalled();
  expect(notify).toHaveBeenCalledWith('aviso', pendingDraftsNotice([label]));
  expect(notify.mock.calls[0]?.[1]).toContain(PENDING_DRAFTS_TEXT);
  expect(notify.mock.calls[0]?.[1]).toContain(label);
  sync(store, key, label, valid); // restablecer (Esc) o aplicar: el criterio de pendiente vuelve a falso
  expect(getPendingDrafts(store)).toEqual([]);
  expect(blocksCheck(store)).toBe(false);
  expect(await saveDocument(deps)).toBe('saved');
  expect(download).toHaveBeenCalledTimes(1);
}

describe('R16c: Geometría (vértice)', () => {
  const point: Point = [12.5, 3];
  const ok = { x: null, y: null };
  it('clave y etiqueta nombran el lugar', () => {
    expect(vertexDraftKey(1, 2)).toBe('geometry:1:2');
    expect(vertexDraftLabel(1, 2, point)).toBe('Vértice 3 (12,5, 3) de la región 2');
  });
  it('coordenada inválida que difiere del documento: pendiente; válida (se confirma al salir) o igual al documento: no', () => {
    const form = { x: coordText(point[0]), y: coordText(point[1]) };
    expect(vertexDraftPending({ ...form, x: 'abc' }, point, { x: 'no es un número', y: null })).toBe(true);
    expect(vertexDraftPending({ ...form, y: '' }, point, { x: null, y: 'no es un número' })).toBe(true);
    expect(vertexDraftPending({ ...form, x: '13' }, point, ok)).toBe(false);
    expect(vertexDraftPending(form, point, ok)).toBe(false);
    expect(vertexDraftPending(form, point, { x: 'error del documento', y: null })).toBe(false);
  });
  it('registra, bloquea Guardar y Comprobar, y se limpia al restablecer, aplicar o desmontar', async () => {
    const store = createEditorStore(newDoc(), null);
    const key = vertexDraftKey(0, 1);
    const label = vertexDraftLabel(0, 1, point);
    await cycle(store, key, label, true, false);
    sync(store, key, label, true);
    unmount(store, key);
    expect(getPendingDrafts(store)).toEqual([]);
  });
});

describe('R16c: Sismo', () => {
  it('clave y etiqueta', () => {
    expect(SEISMIC_DRAFT).toEqual({ key: 'seismic', label: 'Sismo' });
  });
  it('kh o kv inválidos son pendientes; vacío, válido o igual al documento no', () => {
    const doc = newDoc();
    expect(seismicDraftPending({ kh: 'abc', kv: '' }, doc)).toBe(true);
    expect(seismicDraftPending({ kh: '1,5', kv: '0' }, doc)).toBe(true);
    expect(seismicDraftPending({ kh: '0.1', kv: '-1' }, doc)).toBe(true);
    expect(seismicDraftPending({ kh: '0.1', kv: '0' }, doc)).toBe(false); // válido: se confirma al salir
    expect(seismicDraftPending({ kh: '', kv: '' }, doc)).toBe(false);
    expect(seismicDraftPending(seismicToForm(doc), doc)).toBe(false);
  });
  it('ciclo completo: bloquea y limpia', async () => {
    const store = createEditorStore(newDoc(), null);
    await cycle(store, SEISMIC_DRAFT.key, SEISMIC_DRAFT.label, seismicDraftPending({ kh: 'x', kv: '' }, store.getState().doc), false);
  });
  it('aplicar un valor válido deja el documento y el formulario iguales', () => {
    const store = createEditorStore(newDoc(), null);
    store.dispatch(seismicSetCommand({ kh: 0.15, kv: 0 }));
    const doc = store.getState().doc;
    expect(seismicDraftPending(seismicToForm(doc), doc)).toBe(false);
    expect(seismicDraftPending({ kh: '2', kv: '0' }, doc)).toBe(true);
  });
});

describe('R16c: Agua', () => {
  const pts: Point[] = [[0, 2], [40, 2]];
  it('claves y etiquetas', () => {
    expect(WATER_GAMMA_DRAFT).toEqual({ key: 'water:unit_weight', label: 'Agua: peso unitario γw' });
    expect(WATER_PIEZO_DRAFT).toEqual({ key: 'water:piezometric_line', label: 'Agua: línea piezométrica' });
    expect(WATER_GAMMA_DRAFT.label.startsWith('Agua')).toBe(true);
  });
  it('γw inválido que difiere del documento es pendiente; válido o igual no', () => {
    expect(gammaDraftPending('abc', 9.81)).toBe(true);
    expect(gammaDraftPending('0', 9.81)).toBe(true);
    expect(gammaDraftPending('-3', undefined)).toBe(true);
    expect(gammaDraftPending('10', 9.81)).toBe(false);
    expect(gammaDraftPending('9,81', 9.81)).toBe(false);
    expect(gammaDraftPending('', undefined)).toBe(false);
  });
  it('tabla piezométrica: x no creciente, punto vacío o un solo punto son pendientes; válida o igual no', () => {
    const base = piezoToForm(pts);
    expect(piezoDraftPending(base, pts)).toBe(false);
    expect(piezoDraftPending([{ x: '40', y: '2' }, { x: '0', y: '2' }], pts)).toBe(true);
    expect(piezoDraftPending([{ x: '0', y: '' }, { x: '40', y: '2' }], pts)).toBe(true);
    expect(piezoDraftPending([{ x: '0', y: '2' }], pts)).toBe(true);
    expect(piezoDraftPending([{ x: '0', y: '3' }, { x: '40', y: '2' }], pts)).toBe(false);
    expect(piezoDraftPending([], null)).toBe(false);
  });
  it('γw y la tabla se registran por separado y cada una se limpia sola', () => {
    const store = createEditorStore(newDoc(), null);
    sync(store, WATER_GAMMA_DRAFT.key, WATER_GAMMA_DRAFT.label, true);
    sync(store, WATER_PIEZO_DRAFT.key, WATER_PIEZO_DRAFT.label, true);
    expect(getPendingDrafts(store)).toEqual([WATER_GAMMA_DRAFT.label, WATER_PIEZO_DRAFT.label]);
    sync(store, WATER_GAMMA_DRAFT.key, WATER_GAMMA_DRAFT.label, false);
    expect(getPendingDrafts(store)).toEqual([WATER_PIEZO_DRAFT.label]);
    expect(blocksCheck(store)).toBe(true);
    sync(store, WATER_PIEZO_DRAFT.key, WATER_PIEZO_DRAFT.label, false);
    expect(blocksCheck(store)).toBe(false);
  });
  it('ciclo completo con γw', async () => {
    const store = createEditorStore(newDoc(), null);
    await cycle(store, WATER_GAMMA_DRAFT.key, WATER_GAMMA_DRAFT.label, gammaDraftPending('abc', undefined), false);
  });
});

describe('R16c: Superficie fija', () => {
  const xRange = [0, 40] as const;
  it('claves y etiquetas', () => {
    expect(SURFACE_CIRCLE_DRAFT).toEqual({ key: 'surface:circle', label: 'Superficie fija: círculo' });
    expect(SURFACE_POLYLINE_DRAFT).toEqual({ key: 'surface:polyline', label: 'Superficie fija: polilínea' });
  });
  it('círculo: inválido que difiere del documento es pendiente; válido, igual, polilínea o sin superficie no', () => {
    const surface = { type: 'circle', xc: 20, yc: 25, r: 20 } as const;
    expect(circleDraftPending({ xc: 'a', yc: '25', r: '20' }, surface)).toBe(true);
    expect(circleDraftPending({ xc: '20', yc: '25', r: '0' }, surface)).toBe(true);
    expect(circleDraftPending({ xc: '20', yc: '25', r: '' }, surface)).toBe(true);
    expect(circleDraftPending({ xc: '21', yc: '25', r: '20' }, surface)).toBe(false);
    expect(circleDraftPending(circleToForm(surface), surface)).toBe(false);
    expect(circleDraftPending({ xc: 'a', yc: '', r: '' }, null)).toBe(false);
    expect(circleDraftPending({ xc: 'a', yc: '', r: '' }, { type: 'polyline', points: [[0, 0], [10, 5]] })).toBe(false);
  });
  it('polilínea: x no creciente, menos de 2 puntos o celda vacía son pendientes; válida o igual no', () => {
    const pts: Point[] = [[0, 0], [10, 5], [30, 2]];
    expect(polylineDraftPending(polylineToForm(pts), pts, xRange)).toBe(false);
    expect(polylineDraftPending([{ x: '10', y: '5' }, { x: '5', y: '5' }], pts, xRange)).toBe(true);
    expect(polylineDraftPending([{ x: '0', y: '0' }], pts, xRange)).toBe(true);
    expect(polylineDraftPending([{ x: '0', y: '' }, { x: '10', y: '5' }], pts, xRange)).toBe(true);
    expect(polylineDraftPending([{ x: '0', y: '1' }, { x: '10', y: '5' }], pts, xRange)).toBe(false);
  });
  it('ciclo completo con el círculo y con la polilínea', async () => {
    const store = createEditorStore(newDoc(), null);
    await cycle(store, SURFACE_CIRCLE_DRAFT.key, SURFACE_CIRCLE_DRAFT.label, true, false);
    await cycle(store, SURFACE_POLYLINE_DRAFT.key, SURFACE_POLYLINE_DRAFT.label, true, false);
  });
});

describe('R16c: Cargas', () => {
  const udl: Load = { type: 'udl', id: 'u1', x1: 0, x2: 10, q: 50 };
  const line: Load = { type: 'line', id: 'l1', x: 5, p: 100, angle: 0 };
  const doc = newDoc();
  const ctx = (index: number, otherIds: string[] = []) => ({ xRange: modelXRange(doc), otherIds, index });
  it('clave y etiqueta nombran la carga (de 1 en 1)', () => {
    expect(loadDraftKey(2)).toBe('load:2');
    expect(loadDraftLabel(2)).toBe('Carga 3');
  });
  it('valor inválido que difiere del documento es pendiente; válido o igual no', () => {
    const form = loadToForm(udl);
    expect(loadDraftPending({ ...form, q: 'abc' } as LoadForm, udl, ctx(0))).toBe(true);
    expect(loadDraftPending({ ...form, q: '-5' } as LoadForm, udl, ctx(0))).toBe(true);
    expect(loadDraftPending({ ...form, x2: '' } as LoadForm, udl, ctx(0))).toBe(true);
    expect(loadDraftPending({ ...form, q: '60' } as LoadForm, udl, ctx(0))).toBe(false);
    expect(loadDraftPending(form, udl, ctx(0))).toBe(false);
    const lf = loadToForm(line);
    expect(loadDraftPending({ ...lf, angle: '200' } as LoadForm, line, ctx(1))).toBe(true);
    expect(loadDraftPending({ ...lf, p: '' } as LoadForm, line, ctx(1))).toBe(true);
  });
  it('id repetido es pendiente', () => {
    expect(loadDraftPending({ ...loadToForm(line), id: 'u1' } as LoadForm, line, ctx(1, ['u1']))).toBe(true);
  });
  it('dos cargas con borrador: el registro tiene las dos y cada una se limpia sola', async () => {
    const store = createEditorStore(newDoc(), null);
    sync(store, loadDraftKey(0), loadDraftLabel(0), true);
    sync(store, loadDraftKey(2), loadDraftLabel(2), true);
    expect(getPendingDrafts(store)).toEqual(['Carga 1', 'Carga 3']);
    sync(store, loadDraftKey(0), loadDraftLabel(0), false);
    expect(getPendingDrafts(store)).toEqual(['Carga 3']);
    unmount(store, loadDraftKey(2)); // quitar la carga desmonta su tarjeta
    expect(hasPendingDrafts(store)).toBe(false);
  });
  it('ciclo completo', async () => {
    const store = createEditorStore(newDoc(), null);
    await cycle(store, loadDraftKey(1), loadDraftLabel(1), true, false);
  });
});

describe('R16c: formulario de material nuevo', () => {
  it('clave y etiqueta', () => {
    expect(NEW_MATERIAL_DRAFT).toEqual({ key: 'material:new', label: 'Material nuevo' });
  });
  it('cerrado o sin tocar no es pendiente; con cualquier cambio (válido o inválido) sí, porque solo entra al modelo con «Agregar material»', () => {
    const initial = newMaterialForm(['m1'], 'SI');
    const baseline = JSON.stringify(initial);
    expect(newMaterialDraftPending(null, baseline)).toBe(false);
    expect(newMaterialDraftPending(initial, baseline)).toBe(false);
    expect(newMaterialDraftPending(initial, null)).toBe(false);
    expect(newMaterialDraftPending({ ...initial, cohesion: 'abc' }, baseline)).toBe(true);
    expect(newMaterialDraftPending({ ...initial, cohesion: '12' }, baseline)).toBe(true);
    expect(newMaterialDraftPending({ ...initial, id: 'm1' }, baseline)).toBe(true);
  });
  it('ciclo completo: Agregar o Cancelar lo limpian', async () => {
    const store = createEditorStore(newDoc(), null);
    await cycle(store, NEW_MATERIAL_DRAFT.key, NEW_MATERIAL_DRAFT.label, true, false);
  });
});

describe('R16c: Proyecto no registra borradores (no tiene valores que no se puedan aplicar)', () => {
  // `title`, `id` y `notes` son texto libre: `metaPatchCommand` da siempre un comando o `null` (texto equivalente, y la tarjeta se
  // restablece). No existe un valor inválido ni incompleto; el texto válido se confirma al salir del campo (y Ctrl+S, antes de guardar).
  // Registrarlo mientras el campo tiene el foco bloquearía Ctrl+S sin que el usuario pueda resolverlo (comprobado en Chrome).
  it('cualquier texto da un comando o ninguno, nunca un error', () => {
    const doc = newDoc();
    for (const field of ['id', 'title', 'notes'] as const) {
      for (const text of ['', '  ', 'Mi proyecto', 'dos\nlíneas', 'x'.repeat(5000), '\u00e9\u00f1']) {
        const cmd = metaPatchCommand(doc, field, text);
        expect(cmd === null || cmd.type === 'meta/patch').toBe(true);
      }
    }
    expect(metaPatchCommand(doc, 'title', projectToForm(doc).title)).toBeNull();
  });
});

describe('R16c: todos los paneles aparecen juntos en la lista de tarjetas', () => {
  it('el aviso de Guardar nombra las tarjetas de los paneles nuevos y las de los anteriores', async () => {
    const store = createEditorStore(newDoc(), null);
    setPendingDraft(store, 'material:m1', 'Material m1');
    sync(store, SEISMIC_DRAFT.key, SEISMIC_DRAFT.label, true);
    sync(store, loadDraftKey(0), loadDraftLabel(0), true);
    sync(store, NEW_MATERIAL_DRAFT.key, NEW_MATERIAL_DRAFT.label, true);
    const { deps, notify } = setupSave(store);
    await saveDocument(deps);
    expect(notify.mock.calls[0]?.[1]).toContain('Material m1, Sismo, Carga 1, Material nuevo');
    clearPendingDrafts(store);
    expect(hasPendingDrafts(store)).toBe(false);
  });
});

describe('R16c: contrato del registro en cada panel (el efecto registra y limpia al desmontar)', () => {
  const read = (f: string): string => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
  const cases: Array<[string, RegExp[]]> = [
    ['GeometryPanel.tsx', [/setPendingDraft\(store, key, pending \? scope : null\)/, /return \(\) => setPendingDraft\(store, key, null\)/]],
    ['SeismicPanel.tsx', [/setPendingDraft\(store, SEISMIC_DRAFT\.key, pending \? SEISMIC_DRAFT\.label : null\)/, /return \(\) => setPendingDraft\(store, SEISMIC_DRAFT\.key, null\)/]],
    ['WaterPanel.tsx', [/setPendingDraft\(store, WATER_GAMMA_DRAFT\.key, gammaPending \? WATER_GAMMA_DRAFT\.label : null\)/, /setPendingDraft\(store, WATER_PIEZO_DRAFT\.key, rowsPending \? WATER_PIEZO_DRAFT\.label : null\)/, /return \(\) => setPendingDraft\(store, WATER_PIEZO_DRAFT\.key, null\)/]],
    ['SurfacePanel.tsx', [/setPendingDraft\(store, SURFACE_CIRCLE_DRAFT\.key, circlePending \? SURFACE_CIRCLE_DRAFT\.label : null\)/, /setPendingDraft\(store, SURFACE_POLYLINE_DRAFT\.key, rowsPending \? SURFACE_POLYLINE_DRAFT\.label : null\)/, /return \(\) => setPendingDraft\(store, SURFACE_POLYLINE_DRAFT\.key, null\)/]],
    ['LoadsPanel.tsx', [/setPendingDraft\(store, key, pending \? scope : null\)/, /return \(\) => setPendingDraft\(store, key, null\)/]],
    ['MaterialsPanel.tsx', [/setPendingDraft\(store, NEW_MATERIAL_DRAFT\.key, pending \? NEW_MATERIAL_DRAFT\.label : null\)/, /return \(\) => setPendingDraft\(store, NEW_MATERIAL_DRAFT\.key, null\)/]],
  ];
  for (const [file, patterns] of cases) {
    it(file, () => {
      const src = read(file);
      for (const p of patterns) expect(src).toMatch(p);
      expect(src).toContain('useEffect');
    });
  }
});
