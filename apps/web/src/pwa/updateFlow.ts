// Flujo de actualización del service worker (R5-08), sin DOM ni React para poder probarlo con objetos simulados.
//
// El service worker nuevo se instala en segundo plano y queda en espera (`waiting`): mientras tanto la página sigue
// con el JS y el WASM viejos, coherentes entre sí. Cuando hay uno en espera se avisa con `onUpdateReady(apply)`;
// `apply()` le envía `SKIP_WAITING`, y cuando el controlador cambia la página se recarga una sola vez, para que
// index.html, JS y WASM sean todos de la versión nueva.

/** Lo mínimo que se usa de `ServiceWorker`. */
export interface WorkerLike {
  state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
}

/** Lo mínimo que se usa de `ServiceWorkerRegistration`. */
export interface RegistrationLike {
  waiting: WorkerLike | null;
  installing: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
}

/** Lo mínimo que se usa de `navigator.serviceWorker`. */
export interface ContainerLike {
  controller: unknown;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

export interface UpdateFlowOptions {
  /** Hay una versión nueva esperando. `apply` la activa; puede llamarse más de una vez y es idempotente. */
  onUpdateReady(apply: () => void): void;
  /** Recarga la página (por omisión `location.reload()`). */
  reload(): void;
}

/** Orden que entiende `build/sw-template.js`. */
export const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' } as const;

/**
 * Conecta un registro con el aviso de actualización. Devuelve `check()`, que avisa si ya hay un worker en espera.
 * Solo avisa cuando la página ya tenía controlador: en la primera instalación no hay nada que actualizar.
 */
export function watchForUpdates(reg: RegistrationLike, container: ContainerLike, options: UpdateFlowOptions): void {
  const hadController = container.controller != null;
  let reloading = false;

  const offer = (worker: WorkerLike): void => {
    options.onUpdateReady(() => worker.postMessage(SKIP_WAITING_MESSAGE));
  };

  if (reg.waiting && hadController) offer(reg.waiting);

  reg.addEventListener('updatefound', () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && container.controller != null) offer(installing);
    });
  });

  // Con controlador previo, un cambio de controlador es una versión nueva (de esta u otra pestaña): se recarga para no
  // dejar una página vieja bajo un service worker nuevo. En la primera instalación (`clients.claim`) no se recarga.
  container.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    options.reload();
  });
}
