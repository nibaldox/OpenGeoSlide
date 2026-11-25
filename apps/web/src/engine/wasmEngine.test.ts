import { describe, expect, it } from 'vitest';
import { EngineClient, type PortLike } from './client';
import { EngineError, EngineFatalError, type Engine } from './engine';
import { FATAL_ENGINE_TEXT, userMessage } from './errors';
import { createDispatcher, type Request } from './protocol';
import { createWasmEngine, isFatalWasmError, loadWasmEngine, type WasmModule } from './wasmEngine';

type Behavior = (input: string) => string;

/**
 * Módulo wasm falso. Cada llamada a analyze_json ejecuta el siguiente comportamiento de la cola
 * (por defecto devuelve `ok:<entrada>`). `loads` cuenta las cargas del módulo: una recarga tras un
 * fallo fatal lo incrementa.
 */
function fakeLoader(behaviors: Behavior[] = []) {
  const state = { loads: 0, calls: 0 };
  const loader = async (): Promise<WasmModule> => {
    state.loads += 1;
    return {
      default: async () => undefined,
      version: () => '0.1.0',
      analyze_json: (input: string) => {
        const behavior = behaviors[state.calls] ?? ((text: string) => `ok:${text}`);
        state.calls += 1;
        return behavior(input);
      },
    };
  };
  return { loader, state };
}

function trap(message = 'unreachable'): Behavior {
  return () => {
    throw new WebAssembly.RuntimeError(message);
  };
}

describe('createWasmEngine: clasificación de fallos (R2-06)', () => {
  it('un error de modelo (texto de Rust, código E6) es EngineError y no recarga el módulo', async () => {
    const { loader, state } = fakeLoader([
      () => {
        throw 'InvalidModel: sin materiales';
      },
    ]);
    const engine = createWasmEngine(loader);
    const failure = await engine.analyze('{}').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(EngineError);
    expect(failure).not.toBeInstanceOf(EngineFatalError);
    expect((failure as Error).message).toBe('InvalidModel: sin materiales');
    await expect(engine.analyze('x')).resolves.toBe('ok:x');
    expect(state.loads).toBe(1);
  });

  it('un WebAssembly.RuntimeError (trap) es fatal y la siguiente llamada vuelve a cargar el módulo', async () => {
    const { loader, state } = fakeLoader([trap('unreachable')]);
    const engine = createWasmEngine(loader);
    await expect(engine.analyze('x')).rejects.toBeInstanceOf(EngineFatalError);
    await expect(engine.analyze('x')).resolves.toBe('ok:x');
    expect(state.loads).toBe(2);
  });

  it('un valor lanzado que no es texto es fatal', async () => {
    const { loader } = fakeLoader([
      () => {
        throw { code: 7 };
      },
    ]);
    const engine = createWasmEngine(loader);
    const failure = await engine.analyze('x').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(EngineFatalError);
    expect((failure as Error).message).toBe('[object Object]');
  });

  it('isFatalWasmError distingue textos (E6) de traps y valores no textuales', () => {
    expect(isFatalWasmError(new WebAssembly.RuntimeError('unreachable'))).toBe(true);
    expect(isFatalWasmError({ code: 1 })).toBe(true);
    expect(isFatalWasmError('NoSurface: x')).toBe(false);
  });
});

describe('loadWasmEngine', () => {
  it('devuelve el motor si el módulo carga y responde', async () => {
    const { loader } = fakeLoader();
    const engine = await loadWasmEngine(loader);
    expect(typeof engine).toBe('object');
    expect((engine as Engine).name).toBe('ogs-wasm');
    await expect((engine as Engine).version()).resolves.toBe('0.1.0');
  });

  it('devuelve el motivo como texto si el módulo no se puede cargar (se usa el simulado)', async () => {
    const loader = async (): Promise<WasmModule> => {
      throw new Error('ogs_wasm.js no está generado');
    };
    await expect(loadWasmEngine(loader)).resolves.toBe('ogs_wasm.js no está generado');
  });

  it('un trap durante la comprobación inicial también cae al motor simulado', async () => {
    const loader = async (): Promise<WasmModule> => ({
      default: async () => undefined,
      version: () => {
        throw new WebAssembly.RuntimeError('unreachable');
      },
      analyze_json: () => '{}',
    });
    await expect(loadWasmEngine(loader)).resolves.toBe('unreachable');
  });
});

/** Puerto de prueba: el despachador real responde a cada petición, como haría el Worker. */
function portFor(engine: Engine): PortLike {
  const dispatch = createDispatcher(async () => ({ engine, fallbackReason: null }));
  const listeners: ((event: { data: unknown }) => void)[] = [];
  return {
    postMessage(request: Request) {
      void dispatch(request).then((response) => listeners.forEach((listener) => listener({ data: response })));
    },
    addEventListener(_type, listener) {
      listeners.push(listener);
    },
  };
}

describe('fallo fatal de extremo a extremo (worker → cliente → UI)', () => {
  it('un trap llega al cliente como EngineFatalError y la UI muestra el aviso de recarga', async () => {
    const { loader } = fakeLoader([trap('unreachable')]);
    const client = new EngineClient(portFor(createWasmEngine(loader)));
    const failure = await client.analyze('{}').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(EngineFatalError);
    const text = userMessage(failure);
    expect(text.startsWith(FATAL_ENGINE_TEXT)).toBe(true);
    expect(text).toContain('Detalle: unreachable');
  });

  it('un error de modelo llega como EngineError y se traduce con su código E6', async () => {
    const { loader } = fakeLoader([
      () => {
        throw 'InvalidModel: sin materiales';
      },
    ]);
    const client = new EngineClient(portFor(createWasmEngine(loader)));
    const failure = await client.analyze('{}').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(EngineError);
    expect(failure).not.toBeInstanceOf(EngineFatalError);
    expect(userMessage(failure)).toBe('Modelo no válido: sin materiales');
  });
});
