// Registro del service worker (PWA). Se carga desde index.html; no depende de React ni de main.tsx.
// El service worker se genera en el build (apps/web/build/pwa-plugin.ts) y vive en la raíz de `base`, de modo que
// su alcance es toda la aplicación, también bajo una subruta (p. ej. /OpenGeoSlide/).
// Actualización (R5-08): `updateViaCache: 'none'` para que `sw.js` nunca salga de la caché HTTP, aviso «Hay una
// versión nueva» con botón «Actualizar» cuando hay un worker en espera, y recarga en `controllerchange`.

import { getInstallController } from './installPrompt';
import { watchForUpdates } from './updateFlow';
import { showUpdatePrompt } from './updatePrompt';

/** Opciones de `navigator.serviceWorker.register` para una `base` dada. */
export function registerOptions(base: string): { scope: string; updateViaCache: 'none' } {
  return { scope: base, updateViaCache: 'none' };
}

/** Registra `sw.js` solo en producción y fuera de la página de benchmark (`?bench=1`), que no debe cachearse. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (new URLSearchParams(window.location.search).get('bench') === '1') return;
  const base = import.meta.env.BASE_URL;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${base}sw.js`, registerOptions(base))
      .then((reg) => {
        watchForUpdates(reg, navigator.serviceWorker, {
          onUpdateReady: (apply) => showUpdatePrompt(apply),
          reload: () => window.location.reload(),
        });
        // Buscar una versión nueva al volver a la pestaña, además de la comprobación del navegador al navegar.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
        });
      })
      .catch((err: unknown) => {
        console.warn('[pwa] no se pudo registrar el service worker:', err);
      });
  });
}

// `beforeinstallprompt` puede llegar antes de que React monte (UX-19): se captura aquí, al cargar el módulo, y el botón
// «Instalar app» de la cabecera lee el estado. También en desarrollo: no depende del service worker.
getInstallController();

registerServiceWorker();
