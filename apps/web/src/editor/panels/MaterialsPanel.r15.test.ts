// R15B-01: borradores de materiales sin aplicar (cambio a Hoek-Brown/SHANSEP o tabla ocr_by_elevation inválida)
// muestran aviso en la tarjeta y bloquean «Comprobar» y las exportaciones para nunca calcular sobre el material anterior.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EngineClient } from '../../engine/client';
import type { AnalysisReport, Material } from '../../engine/types';
import { createEditorStore } from '../state';
import type { ModelDoc } from '../types';
import { useEngineCheck } from '../app/useEngineCheck';
import {
  PENDING_DRAFTS_TEXT,
  clearPendingDrafts,
  evaluateMaterialCard,
  getPendingDrafts,
  hasPendingDrafts,
  materialToForm,
  setPendingDraft,
  subscribePendingDrafts,
} from './forms';
import { planModelChange } from './MaterialsPanel';

const soil: Material = {
  id: 'soil',
  name: 'Suelo',
  model: 'mohr_coulomb',
  unit_weight: 20,
  unit_weight_sat: null,
  cohesion: 5,
  friction_angle: 30,
  ru: null,
};

const shansepTable: Material = {
  id: 'clay',
  name: 'Arcilla',
  model: 'shansep',
  unit_weight: 18,
  unit_weight_sat: null,
  ru: null,
  shansep: {
    ratio: 0.25,
    exponent: 0.8,
    ocr_by_elevation: [[0, 1], [10, 2]],
  },
};

function makeDoc(material: Material = soil): ModelDoc {
  return {
    format: 'opengeoslide',
    version: material.model === 'hoek_brown' || material.model === 'shansep' ? '0.6' : '0.3',
    meta: {},
    units: 'SI',
    materials: [material],
    regions: [{ material: material.id, polygon: [[0, 0], [0, 10], [20, 10], [40, 0]] }],
    water: null,
    slope: { direction: 'auto' },
    analysis: { methods: ['spencer'], slices: 20, surface: { type: 'circle', xc: 20, yc: 25, r: 20 } },
  } as unknown as ModelDoc;
}

const okReport: AnalysisReport = {
  engine: 'ogs-core 0.4.0',
  results: [
    {
      method: 'spencer',
      fos: 1.234,
      status: 'converged',
      iterations: 4,
      lambda: 0.1,
      surface: { xc: 20, yc: 25, r: 20 },
      slices: [],
      search: null,
      warnings: [],
    },
  ],
};

describe('R15B-01: evaluación de borradores en MaterialCard', () => {
  it('cambiar de Mohr-Coulomb a Hoek-Brown deja la tarjeta en borrador pendiente', () => {
    const change = planModelChange(soil, materialToForm(soil), 'hoek_brown', 'SI');
    expect(change.kind).toBe('draft');
    if (change.kind !== 'draft') return;
    const ev = evaluateMaterialCard(change.form, soil, { otherIds: [], editing: soil });
    expect(ev.pending).toBe(true);
    expect(ev.commit).toBeNull();
    expect(Object.keys(ev.errors).length).toBeGreaterThan(0);
  });

  it('cambiar de Mohr-Coulomb a SHANSEP deja la tarjeta en borrador pendiente hasta completar', () => {
    const change = planModelChange(soil, materialToForm(soil), 'shansep', 'SI');
    expect(change.kind).toBe('draft');
    if (change.kind !== 'draft') return;
    const ev = evaluateMaterialCard(change.form, soil, { otherIds: [], editing: soil });
    expect(ev.pending).toBe(true);
    expect(ev.commit).toBeNull();
    const completed = evaluateMaterialCard(
      { ...change.form, ratio: '0,25', ocrSource: 'ocr', ocr: '1,5' },
      soil,
      { otherIds: [], editing: soil },
    );
    expect(completed.pending).toBe(false);
    expect(completed.commit?.model).toBe('shansep');
  });

  it('una tabla ocr_by_elevation desordenada o con OCR < 1 marca la tarjeta como pendiente y bloquea aplicar', () => {
    const baseForm = materialToForm(shansepTable);
    expect(evaluateMaterialCard(baseForm, shansepTable, { otherIds: [], editing: shansepTable }).pending).toBe(false);

    const unordered = evaluateMaterialCard(
      { ...baseForm, ocrRows: [{ y: '10', ocr: '1' }, { y: '5', ocr: '2' }] },
      shansepTable,
      { otherIds: [], editing: shansepTable },
    );
    expect(unordered.pending).toBe(true);
    expect(unordered.commit).toBeNull();
    expect(unordered.errors.ocrRows).toBeTruthy();

    const lowOcr = evaluateMaterialCard(
      { ...baseForm, ocrRows: [{ y: '0', ocr: '0,5' }, { y: '10', ocr: '2' }] },
      shansepTable,
      { otherIds: [], editing: shansepTable },
    );
    expect(lowOcr.pending).toBe(true);
    expect(lowOcr.commit).toBeNull();
    expect(lowOcr.errors.row0ocr).toBeTruthy();
  });
});

describe('R15B-01: bloqueo del motor mientras una tarjeta tiene borrador sin aplicar', () => {
  it('no se puede calcular con el material anterior mientras la tarjeta muestra Hoek-Brown sin aplicar', async () => {
    const store = createEditorStore(makeDoc(soil), null);
    const analyze = vi.fn(async () => ({ report: okReport, elapsed_ms: 2 }));
    const client = {
      analyze,
      cancel: vi.fn(),
      getStatus: () => 'ready',
      subscribe: () => () => undefined,
    } as unknown as EngineClient;

    // Simula el estado de MaterialCard tras cambiar el selector de Mohr-Coulomb a Hoek-Brown (borrador sin aplicar).
    const change = planModelChange(soil, materialToForm(soil), 'hoek_brown', 'SI');
    expect(change.kind).toBe('draft');
    const ev = evaluateMaterialCard(change.kind === 'draft' ? change.form : materialToForm(soil), soil, { otherIds: [], editing: soil });
    expect(ev.pending).toBe(true);
    // El documento sigue con Mohr-Coulomb; el borrador registra la tarjeta pendiente.
    expect(store.getState().doc.materials[0]?.model).toBe('mohr_coulomb');

    let captured: ReturnType<typeof useEngineCheck> | null = null;
    function Harness() {
      captured = useEngineCheck(store, client);
      return null;
    }

    const listener = vi.fn();
    const unsub = subscribePendingDrafts(store, listener);
    setPendingDraft(store, 'material:soil', 'Material soil');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(hasPendingDrafts(store)).toBe(true);
    expect(getPendingDrafts(store)).toEqual(['Material soil']);
    expect(PENDING_DRAFTS_TEXT).toContain('sin aplicar');

    renderToStaticMarkup(createElement(Harness));
    expect(captured).not.toBeNull();
    expect(captured!.pendingDrafts).toEqual(['Material soil']);

    // Intentar calcular debe quedar bloqueado: nunca invoca el motor con el Mohr-Coulomb anterior.
    const blocked = await captured!.check();
    expect(blocked).toBeNull();
    expect(analyze).not.toHaveBeenCalled();

    // Al descartar o corregir el borrador, vuelve a permitir el cálculo.
    clearPendingDrafts(store);
    expect(hasPendingDrafts(store)).toBe(false);
    const allowed = await captured!.check();
    expect(allowed).not.toBeNull();
    expect(analyze).toHaveBeenCalledTimes(1);
    unsub();
  });
});
