// Una sola ejecución a la vez: un doble clic en «Guardar» no debe descargar dos veces (R7-28).

export interface SingleFlight {
  /** Ejecuta `fn` si no hay otra en curso y devuelve `true`; si la hay, la ignora y devuelve `false`. */
  run(fn: () => Promise<void>): Promise<boolean>;
  busy(): boolean;
}

export function createSingleFlight(): SingleFlight {
  let running = false;
  return {
    async run(fn) {
      if (running) return false;
      running = true;
      try {
        await fn();
        return true;
      } finally {
        running = false;
      }
    },
    busy: () => running,
  };
}
