// R15B-02: Casos de verificación con búsqueda no circular bloquean Bishop, describen «no circular»
// y calculan sin error con la selección por defecto en todos los casos no circulares (los -nc y los promovidos de F3B y de CM).
// Cuántos son lo dice `verification/cases/INDEX.md` (las tablas de esas dos secciones), no un literal de este archivo.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeAnalysis, effectiveCaseMethods } from './App';
import { runModel } from './analysis/runner';
import { methodDisabledReason } from './editor/panels/forms';
import { validateLocal } from './editor/state/validateLocal';
import type { VerificationCase } from './engine/types';
import { isAnalysisReport } from './engine/validate';
import { engineModel } from './io/ogsJson';

const casesDir = resolve(fileURLToPath(new URL('../../../verification/cases', import.meta.url)));
const OGS_BIN = process.env.OGS_BIN;
const haveEngine = OGS_BIN !== undefined && existsSync(OGS_BIN);

const nonCircularCases: Array<{ file: string; data: VerificationCase }> = readdirSync(casesDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((file) => ({ file, data: JSON.parse(readFileSync(join(casesDir, file), 'utf8')) as VerificationCase }))
  .filter(({ data }) => Boolean(data.model.analysis.search?.non_circular));

// Filas de las secciones «Hoek-Brown y búsqueda no circular» y «Búsqueda no circular y global»: `| caso | v | búsqueda | ...`.
const index = readFileSync(join(casesDir, 'INDEX.md'), 'utf8');
const indexedNonCircular = [...new Set([...index.matchAll(/^\| ([A-Z][\w-]+) \| 0\.\d \| no circular(?: \+ global)? \|/gm)].map((m) => m[1]!))].sort();

describe('R15B-02: casos no circulares en Casos de verificación', () => {
  it('incluye los casos no circulares que dice el índice (los -nc y los promovidos de F3B y de CM)', () => {
    expect(indexedNonCircular.length).toBeGreaterThan(0);
    expect(nonCircularCases).toHaveLength(indexedNonCircular.length);
    const ids = nonCircularCases.map((c) => c.data.id);
    expect([...ids].sort()).toEqual(indexedNonCircular);
    expect(ids).toContain('V001-nc');
    expect(ids).toContain('V050b');
    expect(ids).toContain('V103');
  });

  describe.each(nonCircularCases)('$data.id ($file)', ({ data }) => {
    it('deshabilita Bishop con motivo F6.4, describe búsqueda no circular y pasa validación local con la selección por defecto', () => {
      const reason = methodDisabledReason('bishop', data.model.analysis);
      expect(reason).not.toBeNull();
      expect(reason).toContain('non_circular');

      const selected = effectiveCaseMethods(data.model);
      expect(selected).not.toContain('bishop');
      expect(selected).toContain('spencer');

      expect(describeAnalysis(data.model)).toContain('no circular');

      const modelToRun = runModel(data.model, selected);
      const localErrors = validateLocal(modelToRun).filter((i) => i.severity === 'error');
      expect(localErrors).toEqual([]);
    });

    it.skipIf(!haveEngine)('calcula sin error en ogs-core con la selección por defecto', () => {
      const selected = effectiveCaseMethods(data.model);
      const modelToRun = engineModel(runModel(data.model, selected));
      const dir = mkdtempSync(join(tmpdir(), 'ogs-r15b02-'));
      try {
        const file = join(dir, `${data.id}.ogs.json`);
        writeFileSync(file, JSON.stringify(modelToRun));
        const res = spawnSync(OGS_BIN as string, ['analyze', file], { encoding: 'utf8' });
        expect(res.status, res.stderr || res.stdout).toBe(0);
        const report = JSON.parse(res.stdout) as unknown;
        expect(isAnalysisReport(report)).toBe(true);
        if (isAnalysisReport(report)) {
          expect(report.results.length).toBeGreaterThan(0);
          expect(report.results[0]?.status).toBe('converged');
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
