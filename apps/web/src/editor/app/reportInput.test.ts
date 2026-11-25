import { describe, expect, it } from 'vitest';
import { analyzeMock } from '../../engine/mockEngine';
import { sha256Hex, saveOgsJson } from '../../io/ogsJson';
import { loadCaseDoc, loadDifferentialDoc, loadEngineReport } from '../../report/fixtures';
import type { MethodReport } from '../../engine/types';
import { baseFileName, buildReportInput, exportAvailability, hasExportableSurface, isRunCurrent, resultsCsv, surfaceCoordsCsv, type EngineRun } from './reportInput';

async function makeRun(revision = 4): Promise<EngineRun> {
  const doc = loadCaseDoc('V047a');
  const json = saveOgsJson(doc);
  return {
    revision,
    doc,
    json,
    sha256: await sha256Hex(json),
    report: analyzeMock(json),
    elapsedMs: 12,
    checkedAt: '2026-11-25T12:00:00.000Z',
  };
}

describe('buildReportInput', () => {
  it('toma el motor del reporte, el hash del texto guardado y la advertencia profesional', async () => {
    const run = await makeRun();
    const input = buildReportInput(run, new Date('2026-11-25T15:00:00Z'));
    expect(input.generatedAt).toBe('2026-11-25T15:00:00.000Z');
    expect(input.engineName).toBe(run.report.engine);
    expect(input.modelSha256).toBe(run.sha256);
    expect(input.modelSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(input.results).toBe(run.report.results);
    expect(input.disclaimer).toContain('No sustituye el juicio del profesional responsable');
    expect(input.model).toBe(run.doc);
    expect(input.checks).toEqual([]);
  });
});

describe('isRunCurrent', () => {
  it('solo si la revisión coincide', async () => {
    const run = await makeRun(4);
    expect(isRunCurrent(run, 4)).toBe(true);
    expect(isRunCurrent(run, 5)).toBe(false);
    expect(isRunCurrent(null, 0)).toBe(false);
  });
});

describe('exportaciones CSV', () => {
  it('resultsCsv: una fila por método, con FS, λ solo si convergió y la columna avisos', async () => {
    const run = await makeRun();
    const lines = resultsCsv(run.report).trim().split('\r\n');
    expect(lines[0]).toBe('metodo,estado,fs,iteraciones,lambda,xc,yc,r,evaluadas,validas,avisos');
    expect(lines).toHaveLength(1 + run.report.results.length);
  });

  it('resultsCsv con el motor real: λ de Spencer solo convergido; avisos separados por |', () => {
    const [bishop, spencer] = loadEngineReport('v047a-search-rtl').results as [MethodReport, MethodReport];
    const converged = resultsCsv({ engine: 'x', results: [bishop, spencer] }).trim().split('\r\n');
    expect(converged[2]?.split(',')[4]).toBe(String(spencer.lambda));
    const notConverged = { ...spencer, status: 'not_converged' as const, warnings: ['no_lambda_root', 'max_iterations'] };
    const row = resultsCsv({ engine: 'x', results: [notConverged] }).trim().split('\r\n')[1]?.split(',') ?? [];
    expect(row[2]).toBe(''); // fs
    expect(row[4]).toBe(''); // lambda
    expect(row[10]).toBe('no_lambda_root|max_iterations');
  });

  it('surfaceCoordsCsv: n+1 puntos por método, de izquierda a derecha, con la columna estado', async () => {
    const run = await makeRun();
    const lines = surfaceCoordsCsv(run.report.results).trim().split('\r\n');
    expect(lines[0]).toBe('metodo,estado,punto,x,y');
    const converged = run.report.results.filter((r) => r.status === 'converged');
    expect(converged.length).toBeGreaterThan(0);
    expect(lines).toHaveLength(1 + converged.reduce((a, r) => a + r.slices.length + 1, 0));
    const first = converged[0]!;
    const xs = first.slices.map((s) => s.x_left);
    expect(lines[1]).toBe(`${first.method},converged,1,${Math.min(...xs)},${first.slices.find((s) => s.x_left === Math.min(...xs))!.y_base_left}`);
  });

  it('R5-03: D01 fijo (left_to_right), primer punto = menor x, último = mayor x con el pie (x = 40), sin retrocesos', () => {
    expect(loadDifferentialDoc('D01').slope?.direction).toBe('left_to_right');
    const { results } = loadEngineReport('d01-fixed-ltr');
    const rows = surfaceCoordsCsv(results).trim().split('\r\n').slice(1).map((l) => l.split(','));
    const bishop = rows.filter((r) => r[0] === 'bishop');
    const spencer = rows.filter((r) => r[0] === 'spencer');
    for (const method of [bishop, spencer]) {
      expect(method).toHaveLength(52);
      expect(method.map((r) => r[2])).toEqual(Array.from({ length: 52 }, (_, i) => String(i + 1)));
      const xs = method.map((r) => Number(r[3]));
      expect(xs[0]).toBeCloseTo(16.644736842105253, 12); // menor x: la dovela del coronamiento
      expect(xs[xs.length - 1]).toBe(40); // el pie: antes se omitía
      expect(xs.every((x, i) => i === 0 || x > (xs[i - 1] as number))).toBe(true);
      expect(new Set(method.map((r) => r[1]))).toEqual(new Set(['converged']));
    }
  });

  it('surfaceCoordsCsv solo exporta los métodos convergidos', () => {
    const [bishop, spencer] = loadEngineReport('d01-fixed-ltr').results as [MethodReport, MethodReport];
    const csv = surfaceCoordsCsv([bishop, { ...spencer, status: 'not_converged' }]);
    expect(csv).toContain('bishop,converged,');
    expect(csv).not.toContain('spencer');
    const none = surfaceCoordsCsv([{ ...bishop, status: 'invalid' }, { ...spencer, status: 'not_converged' }]);
    expect(none.trim()).toBe('metodo,estado,punto,x,y');
  });

  it('hasExportableSurface: solo con un método convergido y dovelas', () => {
    const [bishop] = loadEngineReport('d01-fixed-ltr').results as [MethodReport];
    expect(hasExportableSurface([bishop])).toBe(true);
    expect(hasExportableSurface([{ ...bishop, status: 'not_converged' }])).toBe(false);
    expect(hasExportableSurface([{ ...bishop, slices: [] }])).toBe(false);
    expect(hasExportableSurface([])).toBe(false);
  });
});

describe('exportAvailability (E12i, R5-04)', () => {
  it('sin cálculo: todo bloqueado, con un title que explica cómo seguir', () => {
    const a = exportAvailability(null, false);
    expect(a).toMatchObject({ canExport: false, canExportSurface: false });
    expect(a.blockedTitle).toContain('Comprobar');
    expect(a.surfaceTitle).toBe(a.blockedTitle);
  });

  it('resultado de una revisión anterior (obsoleto): bloqueado aunque exista `run`', async () => {
    const run = await makeRun(4);
    const a = exportAvailability(run, isRunCurrent(run, 5));
    expect(a.canExport).toBe(false);
    expect(a.canExportSurface).toBe(false);
    expect(a.blockedTitle).toContain('cambió desde el último cálculo');
  });

  it('resultado actual: exportaciones habilitadas y sin title', async () => {
    const run = await makeRun(4);
    const a = exportAvailability(run, isRunCurrent(run, 4));
    expect(a).toEqual({ canExport: true, canExportSurface: true, blockedTitle: undefined, surfaceTitle: undefined });
  });

  it('actual pero sin ningún método convergido: los resultados se exportan, la superficie no', async () => {
    const run = await makeRun(4);
    const results = run.report.results.map((r) => ({ ...r, status: 'not_converged' as const }));
    const a = exportAvailability({ ...run, report: { ...run.report, results } }, true);
    expect(a.canExport).toBe(true);
    expect(a.canExportSurface).toBe(false);
    expect(a.surfaceTitle).toContain('Ningún método convergió');
  });
});

describe('baseFileName', () => {
  const doc = loadCaseDoc('V047a');
  it('quita .ogs.json y caracteres peligrosos', () => {
    expect(baseFileName('talud norte.ogs.json', doc)).toBe('talud_norte');
    expect(baseFileName('../../etc/x.json', doc)).toBe('x');
  });
  it('sin archivo usa el id del modelo, y si no, «modelo»', () => {
    expect(baseFileName(null, doc)).toBe(doc.meta.id);
    expect(baseFileName(null, { ...doc, meta: {} })).toBe('modelo');
  });
});
