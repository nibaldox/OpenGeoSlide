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

/** Evento que entrega un Worker (o un doble de pruebas): `message` trae `data`; `error`, `message` con el texto. */
export interface PortEvent {
  data?: unknown;
  message?: string;
}

/** Lo mínimo que necesita el cliente de un Worker (o de un doble de pruebas). */
export interface PortLike {
  postMessage(message: Request): void;
  addEventListener(type: 'message' | 'error' | 'messageerror', listener: (event: PortEvent) => void): void;
  terminate?(): void;
}

export interface AnalyzeResult {
  report: AnalysisReport;
  /** Tiempo medido dentro del worker (ms). */
  elapsed_ms: number;
}

/** Estado del motor: cargando (o reiniciándose), listo o caído (el Worker falló). */
export type EngineStatus = 'loading' | 'ready' | 'failed';

/** El usuario canceló el cálculo: el Worker se terminó y se recreó. No es un fallo del modelo ni del motor. */
export class EngineCancelledError extends Error {
  constructor(message = 'Cálculo cancelado.') {
    super(message);
    this.name = 'EngineCancelledError';
  }
}

type Pending = {
  resolve: (response: Response) => void;
  reject: (error: Error) => void;
};

export class EngineClient {
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Set<() => void>();
  private readonly factory: (() => PortLike) | null;
  private port: PortLike;
  private status: EngineStatus = 'loading';
  private nextId = 1;

  /** Con una función, `cancel()` puede recrear el Worker; con un puerto fijo solo rechaza lo pendiente. */
  constructor(source: PortLike | (() => PortLike)) {
    this.factory = typeof source === 'function' ? source : null;
    this.port = typeof source === 'function' ? source() : source;
    this.attach(this.port);
  }

  private attach(port: PortLike): void {
    // Un puerto sustituido (cancelación) puede seguir emitiendo: solo cuenta el actual.
    port.addEventListener('message', (event) => {
      if (this.port === port) this.handleMessage(event.data);
    });
    port.addEventListener('error', (event) => {
      if (this.port === port) this.fail(`El motor dejó de responder: ${event.message || 'error del Worker'}.`);
    });
    port.addEventListener('messageerror', () => {
      if (this.port === port) this.fail('El motor devolvió un mensaje que no se pudo leer.');
    });
  }

  private setStatus(next: EngineStatus): void {
    if (this.status === next) return;
    this.status = next;
    for (const l of [...this.listeners]) l();
  }

  /** Estado actual del motor (para `useSyncExternalStore`). */
  getStatus(): EngineStatus {
    return this.status;
  }

  /** Avisa de cada cambio de estado. Devuelve la función para darse de baja. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private rejectAll(error: Error): void {
    const waiters = [...this.pending.values()];
    this.pending.clear();
    for (const w of waiters) w.reject(error);
  }

  private fail(text: string): void {
    this.setStatus('failed');
    this.rejectAll(new EngineFatalError(text));
  }

  /** Envía una petición y resuelve con la respuesta cruda (ok true o false). */
  send(type: RequestType, modelJson?: string): Promise<Response> {
    if (this.status === 'failed') {
      return Promise.reject(new EngineFatalError('El motor no está disponible: reinícielo o recargue la página.'));
    }
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
    if (response.ok) this.setStatus('ready');
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
    if (!response.ok) {
      this.setStatus('failed');
      throw failure(response);
    }
    return response.result as EngineInfo;
  }

  /**
   * Cancela lo que esté en curso: rechaza las peticiones pendientes con `EngineCancelledError`, termina el Worker y,
   * si hay fábrica, crea otro y lo calienta. También sirve para reiniciar un motor caído.
   */
  cancel(): void {
    this.rejectAll(new EngineCancelledError());
    this.port.terminate?.();
    if (!this.factory) return;
    this.port = this.factory();
    this.attach(this.port);
    this.status = 'loading';
    for (const l of [...this.listeners]) l();
    this.info().catch(() => undefined);
  }

  /** Cierra el canal y termina el worker si existe. Las peticiones pendientes se rechazan. */
  dispose(): void {
    this.rejectAll(new Error('Cliente cerrado'));
    this.port.terminate?.();
  }
}

let shared: EngineClient | null = null;

/** Cliente único con un Worker dedicado (ES module). */
export function getEngineClient(): EngineClient {
  shared ??= new EngineClient(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }));
  return shared;
}
