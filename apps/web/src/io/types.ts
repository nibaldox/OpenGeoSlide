import type { Point } from '../engine/types';

export interface ImportIssue { line?: number; entity?: string; severity: 'error' | 'aviso'; text: string }
export interface DxfImportResult {
  ok: boolean;
  regions: { layer: string; polygon: Point[] }[];          // polilíneas cerradas
  layers: { name: string; suggestedMaterialId: string | null }[];
  unsupported: { type: string; count: number }[];          // SPLINE, CIRCLE, ARC…
  unitsFromHeader: 'm' | 'cm' | 'mm' | 'ft' | 'in' | null;   // $INSUNITS; el usuario confirma
  issues: ImportIssue[];
}
export interface CsvImportResult { ok: boolean; delimiter: string; rows: Record<string, string>[]; issues: ImportIssue[] }
