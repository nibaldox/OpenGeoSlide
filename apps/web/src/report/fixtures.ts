// Entradas de informe para las pruebas (no se importa desde código de producción).
import { readFileSync } from 'node:fs';
import type { ModelDoc } from '../editor/types';
import { analyzeMock } from '../engine/mockEngine';
import type { AnalysisReport, MethodReport, VerificationCase } from '../engine/types';
import { openOgsJson, saveOgsJson } from '../io/ogsJson';
import type { ReportInput } from './types';

const casesDir = new URL('../../../../verification/cases/', import.meta.url);

/**
 * Modelo de un caso publicado **en versión 0.1 o 0.2 explícita**, para las pruebas que pasan por el motor simulado
 * (que, por F3.9, solo simula 0.2 y rechaza todo campo de 0.3). La promoción del lote 1 y 2 subió los casos a 0.3 con
 * Morgenstern-Price y Janbu en `analysis.methods`: aquí se conservan solo Bishop y Spencer y se declara la versión
 * 0.2 si el modelo trae sismo o cargas, o 0.1 si no. Si el caso usa algo propio de 0.3 (material no drenado,
 * polilínea, función entre dovelas), se rechaza: esos casos exigen el WASM o `OGS_BIN`, nunca el simulado.
 */
export function loadCaseModelV02(id: string): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(new URL(`${id}.json`, casesDir), 'utf8')) as VerificationCase;
  const model = structuredClone(parsed.model) as unknown as Record<string, unknown>;
  const analysis = model.analysis as Record<string, unknown>;
  const kept = ((analysis.methods as string[] | undefined) ?? ['bishop']).filter((m) => m === 'bishop' || m === 'spencer');
  if (kept.length === 0) throw new Error(`${id}: sin Bishop ni Spencer, no hay modelo v0.1/v0.2 derivable`);
  analysis.methods = kept;
  const surface = analysis.surface as { type?: string } | undefined;
  const materials = (model.materials as Array<Record<string, unknown>>) ?? [];
  const v03 =
    surface?.type === 'polyline' ||
    analysis.interslice != null ||
    materials.some(
      (m) =>
        m.model === 'undrained' ||
        ['undrained_strength', 'strength_datum', 'strength_gradient', 'strength_limit'].some((k) => m[k] != null),
    );
  if (v03) throw new Error(`${id}: usa campos de la versión 0.3; no se puede simular`);
  model.version = model.seismic != null || model.loads != null ? '0.2' : '0.1';
  return model;
}

/** Documento del caso derivado con `loadCaseModelV02` (v0.1 o v0.2 explícito). */
export function loadCaseDoc(id: string): ModelDoc {
  return openOgsJson(JSON.stringify(loadCaseModelV02(id))).doc as ModelDoc;
}

export function sampleResults(doc: ModelDoc): MethodReport[] {
  return analyzeMock(saveOgsJson(doc)).results;
}

export function sampleInput(overrides: Partial<ReportInput> = {}): ReportInput {
  const doc = loadCaseDoc('V047a');
  doc.materials[0]!.name = 'Arcilla φ ≤ 20°';
  doc.meta.notes = 'Talud 2:1 en arcilla; γ = 20 kN/m³, ángulo φ ≥ 19,6° (comprobación). Niño, diseño áéíóú.';
  const results = sampleResults(doc);
  return {
    generatedAt: '2026-11-25T12:00:00Z',
    engineName: 'mock',
    model: doc,
    modelSha256: 'a'.repeat(32) + 'b'.repeat(32),
    results,
    warnings: [],
    checks: [{ method: 'bishop', published: 0.987, fos: results[0]?.fos ?? null, ok: true }],
    disclaimer: '',
    ...overrides,
  };
}

const diffCasesDir = new URL('../../../../verification/differential/cases/', import.meta.url);

/** Modelo de la batería diferencial (`verification/differential/cases/<id>.ogs.json`), abierto como el editor. */
export function loadDifferentialDoc(id: string): ModelDoc {
  return openOgsJson(readFileSync(new URL(`${id}.ogs.json`, diffCasesDir), 'utf8')).doc as ModelDoc;
}

/**
 * Reporte **real** del motor (`ogs analyze`) guardado en `fixtures/`:
 * - `d01-fixed-ltr`: D01 con la superficie fija, `left_to_right` (slices del pie x = 40 al coronamiento: x decreciente);
 * - `v047a-search-rtl`: V047a con búsqueda, `right_to_left` (slices del pie x = 30 al coronamiento: x creciente).
 */
export function loadEngineReport(name: 'd01-fixed-ltr' | 'v047a-search-rtl'): AnalysisReport {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.report.json`, import.meta.url), 'utf8')) as AnalysisReport;
}
