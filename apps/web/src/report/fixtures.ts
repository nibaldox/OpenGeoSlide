// Entradas de informe para las pruebas (no se importa desde código de producción).
import { readFileSync } from 'node:fs';
import type { ModelDoc } from '../editor/types';
import { analyzeMock } from '../engine/mockEngine';
import type { MethodReport, VerificationCase } from '../engine/types';
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
