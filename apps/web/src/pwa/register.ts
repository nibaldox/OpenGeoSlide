// Registro del service worker (PWA). Se carga desde index.html; no depende de React ni de main.tsx.
// El service worker se genera en el build (apps/web/build/pwa-plugin.ts) y vive en la raíz de `base`, de modo que
// su alcance es toda la aplicación, también bajo una subruta (p. ej. /opengeoslide/).

/** Registra `sw.js` solo en producción y fuera de la página de benchmark (`?bench=1`), que no debe cachearse. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  if (new URLSearchParams(window.location.search).get('bench') === '1') return;
  const base = import.meta.env.BASE_URL;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch((err: unknown) => {
      console.warn('[pwa] no se pudo registrar el service worker:', err);
    });
  });
}

registerServiceWorker();
