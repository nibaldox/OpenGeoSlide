// Interfaz común de los motores (simulado y wasm). Entrada y salida en JSON, igual que analyze_json.

export interface Engine {
  readonly name: string;
  version(): Promise<string>;
  /** Recibe un modelo .ogs.json v0.1 y devuelve un AnalysisReport en JSON. Lanza EngineError si falla. */
  analyze(modelJson: string): Promise<string>;
}

/**
 * Error del motor. El mensaje empieza con el código de error de §3 (`NoSurface`,
 * `NoValidSurface`, `InvalidModel`, `Json`), seguido de `: detalle`.
 */
export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

/**
 * Fallo fatal del motor wasm: un trap (`WebAssembly.RuntimeError`, p. ej. un pánico de Rust) o un
 * valor lanzado que no es texto. No es un error de modelo: la instancia se considera no fiable y la
 * siguiente llamada vuelve a cargar el módulo. El mensaje es el detalle técnico, sin traducir.
 */
export class EngineFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineFatalError';
  }
}

export interface EngineHolder {
  engine: Engine;
  /** Motivo por el que no se usa el wasm; null si se usa el wasm. */
  fallbackReason: string | null;
}
