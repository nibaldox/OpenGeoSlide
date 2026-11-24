// Motor wasm (ogs-core compilado con wasm-bindgen --target web). Si src/wasm/ogs_wasm.js no existe,
// import.meta.glob devuelve un mapa vacío, no hay error de build y se usa el motor simulado.
// Generar el archivo con apps/web/scripts/build-wasm.sh.

import { EngineError, type Engine } from './engine';

interface WasmModule {
  default: (input?: unknown) => Promise<unknown>;
  analyze_json: (input: string) => string;
  version?: () => string;
}

// Ruta relativa a este archivo (src/engine/) hacia src/wasm/ogs_wasm.js.
const wasmLoaders = import.meta.glob('../wasm/ogs_wasm.js') as Record<string, () => Promise<unknown>>;

let initialized: Promise<WasmModule> | null = null;

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

async function loadModule(): Promise<WasmModule> {
  const paths = Object.keys(wasmLoaders);
  if (paths.length === 0) {
    throw new Error('ogs_wasm.js no está generado');
  }
  initialized ??= (async () => {
    const mod = (await wasmLoaders[paths[0]]()) as WasmModule;
    await mod.default();
    return mod;
  })();
  try {
    return await initialized;
  } catch (error) {
    initialized = null;
    throw error;
  }
}

/** Intenta cargar el wasm. Devuelve el motor, o un texto con el motivo por el que no está disponible. */
export async function loadWasmEngine(): Promise<Engine | string> {
  try {
    const mod = await loadModule();
    return {
      name: 'ogs-wasm',
      version: async () => (mod.version ? mod.version() : 'desconocida'),
      analyze: async (modelJson: string) => {
        try {
          return mod.analyze_json(modelJson);
        } catch (error) {
          // analyze_json devuelve Err(String) → excepción JS con el texto del error.
          throw new EngineError(errorText(error));
        }
      },
    };
  } catch (error) {
    return errorText(error);
  }
}
