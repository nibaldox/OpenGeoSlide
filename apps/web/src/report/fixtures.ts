// Entradas de informe para las pruebas (no se importa desde código de producción).
import { readFileSync } from 'node:fs';
import type { ModelDoc } from '../editor/types';
import { analyzeMock } from '../engine/mockEngine';
import type { AnalysisReport, MethodReport, VerificationCase } from '../engine/types';
import { openOgsJson, saveOgsJson } from '../io/ogsJson';
import type { ReportInput } from './types';

const casesDir = new URL('../../../../verification/cases/', import.meta.url);

export function loadCaseDoc(id: string): ModelDoc {
  const parsed = JSON.parse(readFileSync(new URL(`${id}.json`, casesDir), 'utf8')) as VerificationCase;
  return openOgsJson(JSON.stringify(parsed.model)).doc as ModelDoc;
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
