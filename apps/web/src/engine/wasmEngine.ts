// Motor wasm (ogs-core compilado con wasm-bindgen --target web). Si src/wasm/ogs_wasm.js no existe,
// import.meta.glob devuelve un mapa vacío, no hay error de build y se usa el motor simulado.
// Generar el archivo con apps/web/scripts/build-wasm.sh.
//
// Fallos (R2-06): los errores del modelo llegan como texto (Err(String) de Rust, código E6). Un trap
// (WebAssembly.RuntimeError, p. ej. un pánico de Rust) o un valor lanzado que no es texto es fatal:
// se lanza EngineFatalError y la siguiente llamada vuelve a cargar el módulo. El glue de wasm-bindgen
// reutiliza la instancia ya creada, así que recargar no sustituye a recargar la página; la UI lo indica.

import { EngineError, EngineFatalError, type Engine } from './engine';

export interface WasmModule {
  default: (input?: unknown) => Promise<unknown>;
  analyze_json: (input: string) => string;
  version?: () => string;
}

/** Obtiene el módulo de bindings. Se vuelve a llamar tras un fallo fatal. */
export type WasmLoader = () => Promise<WasmModule>;

// Ruta relativa a este archivo (src/engine/) hacia src/wasm/ogs_wasm.js.
const wasmGlob = import.meta.glob('../wasm/ogs_wasm.js') as Record<string, () => Promise<unknown>>;

/** Cargador real: el módulo generado por build-wasm.sh. Falla si no existe. */
export function defaultWasmLoader(): Promise<WasmModule> {
  const paths = Object.keys(wasmGlob);
  if (paths.length === 0) {
    return Promise.reject(new Error('ogs_wasm.js no está generado'));
  }
  return wasmGlob[paths[0]]() as Promise<WasmModule>;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/**
 * Clasifica un error lanzado por el módulo. Un texto es un error del motor (E6). Cualquier otra cosa,
 * incluido `WebAssembly.RuntimeError` (trap), es fatal: la instancia no es fiable.
 */
export function isFatalWasmError(error: unknown): boolean {
  if (typeof WebAssembly !== 'undefined' && error instanceof WebAssembly.RuntimeError) return true;
  return typeof error !== 'string';
}

/** Motor wasm sobre un cargador concreto (inyectable para las pruebas). */
export function createWasmEngine(loader: WasmLoader): Engine {
  let initialized: Promise<WasmModule> | null = null;

  async function module(): Promise<WasmModule> {
    initialized ??= (async () => {
      const mod = await loader();
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

  async function call<T>(invoke: (mod: WasmModule) => T): Promise<T> {
    const mod = await module();
    try {
      return invoke(mod);
    } catch (error) {
      if (isFatalWasmError(error)) {
        // Tras un trap la instancia no es fiable: la siguiente llamada vuelve a cargar el módulo.
        initialized = null;
        throw new EngineFatalError(errorText(error));
      }
      throw new EngineError(errorText(error));
    }
  }

  return {
    name: 'ogs-wasm',
    version: () => call((mod) => (mod.version ? mod.version() : 'desconocida')),
    analyze: (modelJson: string) => call((mod) => mod.analyze_json(modelJson)),
  };
}

/**
 * Intenta cargar el wasm. Devuelve el motor, o un texto con el motivo por el que no está disponible
 * (en ese caso el llamador usa el motor simulado).
 */
export async function loadWasmEngine(loader: WasmLoader = defaultWasmLoader): Promise<Engine | string> {
  const engine = createWasmEngine(loader);
  try {
    await engine.version(); // Fuerza la carga y comprueba que el módulo responde.
    return engine;
  } catch (error) {
    return errorText(error);
  }
}
