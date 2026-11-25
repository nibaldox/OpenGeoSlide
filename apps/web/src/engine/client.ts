// Cliente del motor: promesas sobre el protocolo postMessage. Empareja respuestas por `id`,
// así que varias peticiones pueden estar en vuelo a la vez.

import { EngineError, EngineFatalError } from './engine';
import { isAnalysisReport } from './validate';
import type { AnalysisReport } from './types';
import type { EngineInfo, Request, RequestType, Response } from './protocol';

/** Convierte una respuesta de error en la excepción que corresponde (fatal o de modelo). */
function failure(response: Extract<Response, { ok: false }>): Error {
  return response.fatal ? new EngineFatalError(response.error) : new EngineError(response.error);
}

/** Lo mínimo que necesita el cliente de un Worker (o de un doble de pruebas). */
export interface PortLike {
  postMessage(message: Request): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  terminate?(): void;
}

export interface AnalyzeResult {
  report: AnalysisReport;
  /** Tiempo medido dentro del worker (ms). */
  elapsed_ms: number;
}

type Pending = {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};

export class EngineClient {
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(private readonly port: PortLike) {
    port.addEventListener('message', (event) => this.handleMessage(event.data));
  }

  /** Envía una petición y resuelve con la respuesta cruda (ok true o false). */
  send(type: RequestType, modelJson?: string): Promise<Response> {
    const id = this.nextId++;
    const request: Request =
      type === 'analyze'
        ? { id, type, payload: { modelJson: modelJson ?? '' } }
        : { id, type };
    return new Promise<Response>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.port.postMessage(request);
    });
  }

  private handleMessage(data: unknown): void {
    if (typeof data !== 'object' || data === null || !('id' in data)) return;
    const response = data as Response;
    const waiter = this.pending.get(response.id);
    if (!waiter) return;
    this.pending.delete(response.id);
    waiter.resolve(response);
  }

  /** Ejecuta el análisis. Lanza EngineError con el mensaje del motor si falla. */
  async analyze(modelJson: string): Promise<AnalyzeResult> {
    const response = await this.send('analyze', modelJson);
    if (!response.ok) throw failure(response);
    const text = response.result;
    if (typeof text !== 'string') throw new EngineError('Respuesta del motor no válida');
    const report: unknown = JSON.parse(text);
    if (!isAnalysisReport(report)) {
      throw new EngineError('El motor devolvió un resultado que no cumple AnalysisReport');
    }
    return { report, elapsed_ms: response.elapsed_ms };
  }

  async version(): Promise<string> {
    const response = await this.send('version');
    if (!response.ok) throw failure(response);
    return String(response.result);
  }

  async info(): Promise<EngineInfo> {
    const response = await this.send('engine');
    if (!response.ok) throw failure(response);
    return response.result as EngineInfo;
  }

  /** Cierra el canal y termina el worker si existe. Las peticiones pendientes se rechazan. */
  dispose(): void {
    for (const waiter of this.pending.values()) {
      waiter.reject(new Error('Cliente cerrado'));
    }
    this.pending.clear();
    this.port.terminate?.();
  }
}

let shared: EngineClient | null = null;

/** Cliente único con un Worker dedicado (ES module). */
export function getEngineClient(): EngineClient {
  shared ??= new EngineClient(
    new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
  );
  return shared;
}
