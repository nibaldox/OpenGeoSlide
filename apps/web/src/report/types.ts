import type { MethodKind, MethodReport } from '../engine/types';
import type { ModelDoc } from '../editor/types';

export interface ReportInput {
  generatedAt: string;                       // ISO 8601
  engineName: string;                        // valor de `engine` del reporte: "ogs-core 0.1.0" o "mock"
  model: ModelDoc;
  modelSha256: string;                       // del texto .ogs.json guardado
  results: MethodReport[];                   // engine/types.ts
  warnings: { method: MethodKind; severity: 'nota' | 'aviso'; code: string; text: string }[];
  checks: { method: MethodKind; published: number; fos: number | null; ok: boolean }[];
  disclaimer: string;                        // texto aprobado por el coordinador
}

/** Firma de `buildReportPdf` (la implementa W4 en `src/report/pdf.ts`). */
export type BuildReportPdf = (input: ReportInput) => Promise<Blob>;
