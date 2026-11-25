import { describe, expect, it } from 'vitest';
import { EngineError, EngineFatalError } from '../../engine/engine';
import type { AnalysisReport, MethodReport } from '../../engine/types';
import type { Issue } from '../types';
import { composeDiagnostics, hasErrors, issueFromEngineError, issuesFromReport } from './diagnostics';

const local: Issue = { source: 'local', severity: 'error', code: 'editor.out_of_range', text: 'x', path: '/a' };

function method(over: Partial<MethodReport>): MethodReport {
  return {
    method: 'bishop',
    fos: 1.2,
    status: 'converged',
    iterations: 5,
    lambda: null,
    surface: { xc: 0, yc: 0, r: 1 },
    slices: [],
    search: null,
    warnings: [],
    ...over,
  };
}

describe('issueFromEngineError', () => {
  it('InvalidModel conserva el código y el texto del motor', () => {
    const i = issueFromEngineError(new EngineError('InvalidModel: la región 1 se auto-intersecta (aristas 1 y 3)'));
    expect(i).toMatchObject({ source: 'engine', severity: 'error', code: 'InvalidModel' });
    expect(i.text).toContain('Modelo no válido');
    expect(i.text).toContain('se auto-intersecta');
  });

  it('un fallo fatal del worker es un error con código genérico', () => {
    const i = issueFromEngineError(new EngineFatalError('unreachable'));
    expect(i.severity).toBe('error');
    expect(i.code).toBe('EngineError');
    expect(i.text).toContain('Recargue la página');
  });
});

describe('issuesFromReport', () => {
  it('convierte avisos y notas con el texto de warnings.ts y el método', () => {
    const report: AnalysisReport = {
      engine: 'ogs-core 0.1.0',
      results: [method({ warnings: ['negative_lambda'] }), method({ method: 'spencer', warnings: [] })],
    };
    const issues = issuesFromReport(report);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ source: 'engine', code: 'negative_lambda', path: null });
    expect(issues[0]?.text.startsWith('Bishop simplificado: ')).toBe(true);
    expect(['nota', 'aviso']).toContain(issues[0]?.severity);
  });

  it('un método que no convergió genera un aviso aunque no traiga códigos', () => {
    const report: AnalysisReport = { engine: 'mock', results: [method({ status: 'not_converged' }), method({ method: 'spencer', status: 'invalid' })] };
    const issues = issuesFromReport(report);
    expect(issues.map((i) => i.code)).toEqual(['engine.not_converged', 'engine.invalid']);
    expect(issues.every((i) => i.severity === 'aviso')).toBe(true);
  });

  it('sin avisos no hay incidencias', () => {
    expect(issuesFromReport({ engine: 'mock', results: [method({})] })).toEqual([]);
  });
});

describe('composeDiagnostics', () => {
  const eng = (revision: number, status: 'ok' | 'error' | 'checking' = 'ok') => ({
    status,
    revision,
    issues: [{ source: 'engine', severity: 'aviso', code: 'w', text: 'w', path: null } satisfies Issue],
  });

  it('sin comprobación previa: idle y solo locales', () => {
    expect(composeDiagnostics([local], null, 3)).toEqual({ status: 'idle', issues: [local], revision: 3 });
  });

  it('con la misma revisión: estado del motor y locales + motor', () => {
    const d = composeDiagnostics([local], eng(3), 3);
    expect(d.status).toBe('ok');
    expect(d.issues).toHaveLength(2);
    expect(composeDiagnostics([], eng(3, 'checking'), 3).status).toBe('checking');
  });

  it('con otra revisión queda stale y descarta lo del motor', () => {
    expect(composeDiagnostics([local], eng(2), 3)).toEqual({ status: 'stale', issues: [local], revision: 3 });
  });

  it('hasErrors', () => {
    expect(hasErrors([local])).toBe(true);
    expect(hasErrors([])).toBe(false);
  });
});
