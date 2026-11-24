// Protocolo entre el hilo principal y el Web Worker.
// Petición: {id, type, payload?}. Respuesta: {id, ok, result | error, elapsed_ms}.
// `elapsed_ms` lo mide el propio worker con performance.now().

import type { EngineHolder } from './engine';

export type RequestType = 'analyze' | 'version' | 'engine';

export interface AnalyzePayload {
  modelJson: string;
}

export type Request =
  | { id: number; type: 'analyze'; payload: AnalyzePayload }
  | { id: number; type: 'version' }
  | { id: number; type: 'engine' };

export interface EngineInfo {
  name: string;
  version: string;
  /** Motivo por el que se usa el motor simulado; null si el motor es el wasm. */
  fallback_reason: string | null;
}

export type Response =
  | { id: number; ok: true; result: unknown; elapsed_ms: number }
  | { id: number; ok: false; error: string; elapsed_ms: number };

export type EngineProvider = () => Promise<EngineHolder>;

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Despacha una petición contra el motor. Es pura respecto al transporte, así que se puede probar
 * sin Worker real. Cualquier fallo se devuelve como `ok: false`; nunca lanza.
 */
export function createDispatcher(getEngine: EngineProvider): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const start = performance.now();
    const elapsed = () => performance.now() - start;
    try {
      const holder = await getEngine();
      switch (request.type) {
        case 'analyze': {
          const json = await holder.engine.analyze(request.payload.modelJson);
          return { id: request.id, ok: true, result: json, elapsed_ms: elapsed() };
        }
        case 'version': {
          const version = await holder.engine.version();
          return { id: request.id, ok: true, result: version, elapsed_ms: elapsed() };
        }
        case 'engine': {
          const info: EngineInfo = {
            name: holder.engine.name,
            version: await holder.engine.version(),
            fallback_reason: holder.fallbackReason,
          };
          return { id: request.id, ok: true, result: info, elapsed_ms: elapsed() };
        }
        default:
          return {
            id: (request as { id: number }).id,
            ok: false,
            error: 'Petición desconocida',
            elapsed_ms: elapsed(),
          };
      }
    } catch (error) {
      return { id: request.id, ok: false, error: errorText(error), elapsed_ms: elapsed() };
    }
  };
}
