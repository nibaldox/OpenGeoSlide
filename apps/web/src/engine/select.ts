import type { Engine, EngineHolder } from './engine';
import { createMockEngine } from './mockEngine';
import { loadWasmEngine } from './wasmEngine';

/** Usa el wasm si está disponible; si no, cae al motor simulado y guarda el motivo. */
export async function selectEngine(): Promise<EngineHolder> {
  const loaded = await loadWasmEngine();
  if (typeof loaded !== 'string') {
    return { engine: loaded satisfies Engine, fallbackReason: null };
  }
  return { engine: createMockEngine(), fallbackReason: loaded };
}
