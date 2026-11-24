// Catálogo de casos: verification/cases/*.json del repositorio o, si no hay ninguno, el ejemplo ACADS 1(a).
// La ruta es relativa a este archivo (src/): ../../../ es la raíz del repositorio.

import acads1a from './examples/acads1a.json';
import type { VerificationCase } from './engine/types';

const repoCases = import.meta.glob('../../../verification/cases/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, VerificationCase>;

const example = acads1a as unknown as VerificationCase;

export interface CaseEntry {
  key: string;
  label: string;
  caseData: VerificationCase;
}

export function loadBuiltinCases(): CaseEntry[] {
  const entries = Object.entries(repoCases)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, data]) => ({ key: path, label: `${data.id}: ${data.title}`, caseData: data }));
  if (entries.length > 0) return entries;
  return [{ key: 'example:acads1a', label: `${example.id}: ${example.title} (ejemplo)`, caseData: example }];
}
