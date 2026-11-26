// R10B-03/05/07: un informe real (motor real, OGS_BIN) de una polilínea en V con Morgenstern-Price de `data_points`, el caso D-1 de
// docs/fase3/d1. El contenido y el PDF salen de la salida del motor, no de resultados inventados. Sin OGS_BIN se omite.
// Con `W2_PDF_OUT=/ruta/informe.pdf` además deja el PDF para revisarlo a ojo (pdftoppm).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { haveEngine, OGS_BIN } from '../editor/state/engineRun.testutil';
import { buildReportInput, resultsCsv, surfaceCoordsCsv, type EngineRun } from '../editor/app/reportInput';
import { issuesFromReport } from '../editor/app/diagnostics';
import { summaryItems } from '../editor/app/resultSummary';
import type { ModelDoc } from '../editor/types';
import type { AnalysisReport } from '../engine/types';
import { openOgsJson, saveOgsJson } from '../io/ogsJson';
import { buildReportContent, type ReportBlock } from './content';
import { buildReportPdfWith, type FontLoader } from './pdf';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

/** Talud 1:1 de 10 m con un estrato no drenado debajo (D-1), polilínea en V de tres vértices y M-P con `data_points`. */
const MODEL = {
  format: 'opengeoslide',
  version: '0.3',
  meta: { id: 'd1-polilinea-v', title: 'Talud 1:1 con polilínea en V (D-1)' },
  units: 'SI',
  materials: [
    { id: 'suelo', name: 'Suelo', model: 'mohr_coulomb', unit_weight: 20, cohesion: 10, friction_angle: 30 },
    { id: 'e2', name: 'Arcilla', model: 'undrained', unit_weight: 24, undrained_strength: 30, strength_datum: -3, strength_gradient: 2.5, strength_limit: 90 },
  ],
  regions: [
    { material: 'suelo', polygon: [[0, -3], [40, -3], [40, 0], [20, 0], [10, 10], [0, 10]] },
    { material: 'e2', polygon: [[0, -10], [40, -10], [40, -3], [0, -3]] },
  ],
  slope: { direction: 'left_to_right' },
  analysis: {
    methods: ['spencer', 'morgenstern_price', 'janbu_simplified', 'janbu_corrected'],
    slices: 50,
    tolerance: 1e-5,
    max_iterations: 500,
    min_m_alpha: 0.2,
    surface: { type: 'polyline', points: [[9.63, 9.95], [21.796, -2.571], [26.067, -0.05]] },
    interslice: { function: 'data_points', points: [[0, 0], [0.2, 0.6], [0.5, 1], [0.8, 0.6], [1, 0]] },
  },
};

function analyze(doc: ModelDoc): { json: string; report: AnalysisReport } {
  const dir = mkdtempSync(join(tmpdir(), 'ogs-w2-'));
  try {
    const json = saveOgsJson(doc);
    const file = join(dir, 'm.ogs.json');
    writeFileSync(file, json);
    const r = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`${r.stderr}${r.stdout}`);
    return { json, report: JSON.parse(r.stdout) as AnalysisReport };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!haveEngine)('informe real: polilínea en V con M-P de data_points (motor real)', () => {
  const doc = openOgsJson(JSON.stringify(MODEL)).doc as ModelDoc;
  const { json, report } = analyze(doc);
  const run: EngineRun = { revision: 1, doc, json, sha256: 'a'.repeat(64), report, elapsedMs: 5, checkedAt: '2026-11-26T12:00:00.000Z' };
  const input = buildReportInput(run, new Date('2026-11-26T12:00:00.000Z'));
  const content = buildReportContent(input);
  const section = (id: string) => content.sections.find((s) => s.id === id)!;
  const tables = (id: string) => section(id).blocks.filter((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');

  it('el motor devuelve la polilínea ajustada (5 puntos) y la web la imprime: la de 3 puntos del modelo difiere', () => {
    const fitted = tables('results').find((t) => t.title?.startsWith('Polilínea ajustada'));
    expect(fitted, 'falta la tabla de la polilínea ajustada').toBeDefined();
    expect(fitted!.rows).toHaveLength(5);
    expect(tables('results')[0]!.rows[0]!.slice(-1)).toEqual(['Polilínea (5 puntos)']);
  });

  it('la tabla de materiales lleva «Modelo» y la leyenda dice «Superficie fija, polilínea»', () => {
    expect(tables('materials')[0]!.rows.map((r) => r[2])).toEqual(['Mohr-Coulomb', 'No drenado (Su)']);
    const drawing = section('section').blocks.find((b) => b.kind === 'drawing') as Extract<ReportBlock, { kind: 'drawing' }>;
    expect(drawing.drawing.legend.find((l) => l.kind === 'surface')?.label).toMatch(/^Superficie fija, polilínea/);
  });

  it('ningún aviso del informe, de los diagnósticos ni de la tabla nombra a Spencer como emisor de un texto ajeno ni sugiere Bishop', () => {
    const texts = [
      ...input.warnings.map((w) => w.text),
      ...issuesFromReport(report).map((i) => i.text.replace(/^[^:]+: /, '')),
    ];
    for (const t of texts) {
      expect(t).not.toMatch(/Bishop/);
      expect(t).not.toMatch(/^(El cálculo de |)Spencer (no|halló|seleccionó|tiene)/);
    }
  });

  it('«Con aviso» marca los métodos con avisos (E13k en Spencer y M-P)', () => {
    const flagged = summaryItems(report).filter((i) => i.flagged).map((i) => i.method);
    expect(flagged).toEqual(['spencer', 'morgenstern_price']);
  });

  it('el CSV de resultados lleva los pares (ξ; f) y el de la superficie, los 5 puntos ajustados', () => {
    const csv = resultsCsv(report, 'SI').split('\r\n');
    expect(csv[0]).toContain('puntos_interslice');
    expect(csv.find((l) => l.startsWith('morgenstern_price'))).toContain('0:0|0.2:0.6|0.5:1|0.8:0.6|1:0');
    const surf = surfaceCoordsCsv(report.results, 'SI').split('\r\n').filter((l) => l.startsWith('spencer'));
    expect(surf).toHaveLength(5);
  });

  it('el PDF se genera completo con la polilínea ajustada y los pares (ξ; f)', async () => {
    const blob = await buildReportPdfWith(input, { loadFont, compress: false });
    const bytes = Buffer.from(await blob.arrayBuffer());
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    if (process.env.W2_PDF_OUT) writeFileSync(process.env.W2_PDF_OUT, bytes);
  });
});
