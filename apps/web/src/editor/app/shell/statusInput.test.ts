// UA3 A-02, B-01, A-03: el chip de la cabecera no contradice a la pantalla.
import { describe, expect, it } from 'vitest';
import type { EngineRun } from '../reportInput';
import { runStatus } from '../shellModel';
import { buildRunStatusInput, type StatusInputSource } from './statusInput';

const run = { revision: 3, report: { engine: 't', results: [{ method: 'bishop', status: 'converged', fos: 1.356, surface: { type: 'circle', cx: 0, cy: 0, r: 1 }, slices: [], warnings: [] }] } } as unknown as EngineRun;

const base: StatusInputSource = {
  engineStatus: 'ready',
  busy: false,
  run,
  current: true,
  pendingDrafts: 0,
  regions: 1,
  localErrors: 0,
  methodsRequested: 1,
  message: null,
  messageKind: 'error',
  engineErrorText: null,
  advisories: 0,
};

describe('buildRunStatusInput', () => {
  it('A-02/B-01: con borradores sin aplicar el resultado no es actual y el chip dice «Cambios sin aplicar»', () => {
    const input = buildRunStatusInput({ ...base, pendingDrafts: 1 });
    expect(input.current).toBe(false);
    expect(input.pendingDrafts).toBe(1);
    expect(runStatus(input)).toMatchObject({ tone: 'warn', text: 'Cambios sin aplicar' });
  });
  it('sin borradores conserva `current`', () => {
    expect(buildRunStatusInput(base).current).toBe(true);
    expect(buildRunStatusInput({ ...base, current: false }).current).toBe(false);
  });
  it('A-03: un error del motor sin mensaje llega como mensaje de error y el chip dice «Error: …»', () => {
    const input = buildRunStatusInput({ ...base, run: null, current: false, engineErrorText: 'No hay ninguna superficie de deslizamiento válida.' });
    expect(input.message).toBe('No hay ninguna superficie de deslizamiento válida.');
    expect(input.messageKind).toBe('error');
    expect(runStatus(input)).toMatchObject({ tone: 'nok' });
    expect(runStatus(input).text).toMatch(/^Error: No hay ninguna superficie/);
  });
  it('A-03: un mensaje de la pulsación tiene prioridad sobre el error del motor y conserva su clase', () => {
    const input = buildRunStatusInput({ ...base, run: null, current: false, message: 'Cálculo cancelado.', messageKind: 'info', engineErrorText: 'x' });
    expect(input.message).toBe('Cálculo cancelado.');
    expect(input.messageKind).toBe('info');
  });
  it('UA-E3 §4: pasa el recuento de avisos', () => {
    expect(buildRunStatusInput({ ...base, advisories: 4 }).advisories).toBe(4);
  });
});
