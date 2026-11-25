import { describe, expect, it } from 'vitest';
import type { EngineInfo } from '../engine/protocol';
import { engineIndicator } from './EngineIndicator';

const info = (name: string, version = '0.1.0'): EngineInfo => ({ name, version }) as unknown as EngineInfo;

describe('engineIndicator', () => {
  it('cargando, correcto, simulado y con error', () => {
    expect(engineIndicator(null, null)).toEqual({ kind: 'loading', text: 'Cargando el motor…' });
    expect(engineIndicator(info('ogs-core', '0.3.1'), null)).toEqual({ kind: 'ok', text: 'Motor: ogs-core 0.3.1 (WASM)' });
    expect(engineIndicator(info('mock'), null).kind).toBe('simulated');
    expect(engineIndicator(null, 'no se pudo cargar').kind).toBe('error');
  });
  it('el error de carga tiene prioridad sobre la información', () => {
    expect(engineIndicator(info('ogs-core'), 'fallo').kind).toBe('error');
  });
});
