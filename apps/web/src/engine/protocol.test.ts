import { describe, expect, it } from 'vitest';
import { EngineClient, type PortLike } from './client';
import { createMockEngine } from './mockEngine';
import { createDispatcher, type Request, type Response } from './protocol';
import { EngineError } from './engine';
import acads1a from '../examples/acads1a.json';

const modelJson = JSON.stringify(acads1a.model);

/**
 * Doble del Worker: procesa cada petición con el despachador real y entrega las respuestas
 * en orden inverso a su llegada (con retardos distintos), para comprobar el emparejamiento por id.
 */
function fakeWorker(delays: number[]): PortLike {
  const dispatch = createDispatcher(async () => ({ engine: createMockEngine(), fallbackReason: 'prueba' }));
  const listeners: ((event: { data?: unknown }) => void)[] = [];
  let counter = 0;
  return {
    postMessage(request: Request) {
      const delay = delays[counter++ % delays.length];
      void dispatch(request).then((response: Response) => {
        setTimeout(() => listeners.forEach((l) => l({ data: response })), delay);
      });
    },
    addEventListener(type, listener) {
      if (type === 'message') listeners.push(listener);
    },
  };
}

describe('protocolo y cliente', () => {
  it('empareja respuestas por id aunque lleguen desordenadas', async () => {
    const client = new EngineClient(fakeWorker([30, 0, 15]));
    const [info, version, analysis] = await Promise.all([
      client.info(),
      client.version(),
      client.analyze(modelJson),
    ]);
    expect(info).toEqual({ name: 'mock', version: '0.1.0', fallback_reason: 'prueba' });
    expect(version).toBe('0.1.0');
    expect(analysis.report.engine).toBe('mock');
    expect(analysis.report.results.map((r) => r.method)).toEqual(['bishop', 'spencer']);
    expect(analysis.elapsed_ms).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(analysis.elapsed_ms)).toBe(true);
  });

  it('un error del motor se devuelve como ok:false y el cliente lo lanza como EngineError', async () => {
    const client = new EngineClient(fakeWorker([0]));
    await expect(client.analyze('{mal')).rejects.toBeInstanceOf(EngineError);
    await expect(client.analyze('{mal')).rejects.toThrow(/^Json/);
  });

  it('el despachador responde ok:false si el motor falla al cargar, sin lanzar', async () => {
    const dispatch = createDispatcher(() => Promise.reject(new Error('fallo de carga')));
    const response = await dispatch({ id: 7, type: 'version' });
    expect(response).toMatchObject({ id: 7, ok: false, error: 'fallo de carga' });
    expect(typeof response.elapsed_ms).toBe('number');
  });

  it('dispose rechaza las peticiones pendientes', async () => {
    const silent: PortLike = {
      postMessage() {},
      addEventListener() {},
    };
    const client = new EngineClient(silent);
    const pending = client.version();
    client.dispose();
    await expect(pending).rejects.toThrow('Cliente cerrado');
  });
});

