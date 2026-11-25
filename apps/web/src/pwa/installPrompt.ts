// Botón «Instalar app» (UX-19): captura `beforeinstallprompt` y ofrece la instalación solo cuando el navegador la ofrece.
// Modelo puro (sin React): el evento puede llegar antes de que React monte, así que el controlador se crea al importar el
// módulo (`register.ts` lo importa desde index.html) y la interfaz solo lee su estado con `useSyncExternalStore`.

/** `beforeinstallprompt` (aún no está en lib.dom): solo Chromium. */
export interface InstallPromptEvent {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export interface InstallState {
  /** El navegador ofreció instalar y la oferta sigue sin usar. */
  offered: boolean;
  /** Ya se instaló (el usuario aceptó, o llegó `appinstalled`). */
  installed: boolean;
  /** La app ya corre como aplicación instalada (`display-mode: standalone`). */
  standalone: boolean;
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface StandaloneEnv {
  matches(query: string): boolean;
  /** `navigator.standalone` (Safari en iOS). */
  navigatorStandalone?: boolean;
}

export function isStandaloneDisplay(env: StandaloneEnv): boolean {
  return env.matches('(display-mode: standalone)') || env.navigatorStandalone === true;
}

/** El botón se muestra solo con una oferta pendiente, sin estar instalada ni corriendo ya como aplicación. */
export function installButtonVisible(s: InstallState): boolean {
  return s.offered && !s.installed && !s.standalone;
}

export interface InstallController {
  getState(): InstallState;
  subscribe(listener: () => void): () => void;
  /** Abre el cuadro de instalación del navegador. El evento solo sirve una vez: después el botón se oculta. */
  install(): Promise<InstallOutcome>;
  dispose(): void;
}

export interface InstallEnv {
  target: EventTarget;
  isStandalone: () => boolean;
}

export function createInstallController(env: InstallEnv): InstallController {
  let deferred: InstallPromptEvent | null = null;
  let state: InstallState = { offered: false, installed: false, standalone: env.isStandalone() };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<InstallState>): void => {
    const next = { ...state, ...patch };
    if (next.offered === state.offered && next.installed === state.installed && next.standalone === state.standalone) return;
    state = next; // referencia nueva solo si algo cambió
    listeners.forEach((l) => l());
  };

  const onPrompt = (e: Event): void => {
    e.preventDefault(); // sin el mini aviso del navegador: la oferta vive en el botón de la cabecera
    deferred = e as unknown as InstallPromptEvent;
    set({ offered: true });
  };
  const onInstalled = (): void => {
    deferred = null;
    set({ offered: false, installed: true });
  };
  env.target.addEventListener('beforeinstallprompt', onPrompt);
  env.target.addEventListener('appinstalled', onInstalled);

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async install() {
      const event = deferred;
      if (!event) return 'unavailable';
      deferred = null; // un `beforeinstallprompt` solo permite un `prompt()`
      set({ offered: false });
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice.outcome === 'accepted') set({ installed: true });
        return choice.outcome;
      } catch {
        return 'unavailable';
      }
    },
    dispose() {
      env.target.removeEventListener('beforeinstallprompt', onPrompt);
      env.target.removeEventListener('appinstalled', onInstalled);
    },
  };
}

function browserStandalone(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return isStandaloneDisplay({ matches: (q) => window.matchMedia(q).matches, navigatorStandalone: nav.standalone });
}

let shared: InstallController | null = null;

/** Controlador de la ventana (uno por página). Fuera del navegador (pruebas en Node) devuelve uno inerte. */
export function getInstallController(): InstallController {
  if (!shared) shared = createInstallController({ target: typeof window === 'undefined' ? new EventTarget() : window, isStandalone: browserStandalone });
  return shared;
}
