import { describe, expect, it } from 'vitest';
import { analyzeMock } from '../../engine/mockEngine';
import { sha256Hex, saveOgsJson } from '../../io/ogsJson';
import { loadCaseDoc } from '../../report/fixtures';
import { baseFileName, buildReportInput, isRunCurrent, resultsCsv, surfaceCoordsCsv, type EngineRun } from './reportInput';

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
  it('resultsCsv: una fila por método con FS', async () => {
    const run = await makeRun();
    const lines = resultsCsv(run.report).trim().split('\r\n');
    expect(lines[0]).toBe('metodo,estado,fs,iteraciones,lambda,xc,yc,r,evaluadas,validas');
    expect(lines).toHaveLength(1 + run.report.results.length);
  });

  it('surfaceCoordsCsv: n+1 puntos por método, de izquierda a derecha', async () => {
    const run = await makeRun();
    const lines = surfaceCoordsCsv(run.report.results).trim().split('\r\n');
    expect(lines[0]).toBe('metodo,punto,x,y');
    const total = run.report.results.reduce((a, r) => a + r.slices.length + 1, 0);
    expect(lines).toHaveLength(1 + total);
    const first = run.report.results[0]!;
    expect(lines[1]).toBe(`${first.method},1,${Number(first.slices[0]!.x_left.toFixed(6))},${Number(first.slices[0]!.y_base_left.toFixed(6))}`);
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
