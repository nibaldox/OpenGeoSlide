// Token de solicitud: solo la última petición lanzada puede escribir su resultado. Las respuestas de peticiones
// anteriores (otro documento, otro caso, cálculo cancelado) llegan con un número viejo y se descartan.

export interface RunGuard {
  /** Abre una petición nueva e invalida todas las anteriores. Devuelve su número. */
  next(): number;
  /** ¿Sigue vigente esa petición? */
  isCurrent(id: number): boolean;
  /** Invalida la petición en curso sin abrir otra (cambio de documento o de caso). */
  invalidate(): void;
}

export function createRunGuard(): RunGuard {
  let current = 0;
  return {
    next: () => (current += 1),
    isCurrent: (id) => id === current,
    invalidate: () => {
      current += 1;
    },
  };
}
