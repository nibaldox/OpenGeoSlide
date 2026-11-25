// Service worker de OpenGeoSlide (sin dependencias). Plantilla: apps/web/build/pwa-plugin.ts sustituye los dos
// marcadores de doble guion bajo (la versión y la lista de precache) al generar dist/sw.js.
//
// - Precache (instalación): shell, JS, CSS, glue, worker y .wasm. Todo el conjunto o nada (cache.addAll).
// - Navegaciones: se responde con el index.html precacheado (la app es de una sola página), así que funciona sin red.
// - Fuentes del informe (fonts/*.ttf): caché bajo demanda, la primera vez que el informe PDF las pide. El caché lleva
//   la versión del build (hash de todos los archivos, fuentes incluidas): una fuente nueva no se sirve vieja.
// - Actualización: la versión nueva se instala en segundo plano y queda en espera (sin skipWaiting automático) para
//   no mezclar un index.html viejo con un .wasm nuevo. La página (src/pwa/) avisa al usuario; su botón «Actualizar»
//   envía { type: 'SKIP_WAITING' } y recarga cuando cambia el controlador.
const VERSION = '__VERSION__';
const PRECACHE = `ogs-precache-${VERSION}`;
const RUNTIME = `ogs-runtime-${VERSION}`;
const ASSETS = __PRECACHE__;

// Todas las rutas se resuelven respecto al alcance del service worker (la `base` de Vite).
const scope = self.registration.scope;
const url = (path) => new URL(path, scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(ASSETS.map((p) => new Request(url(p), { cache: 'reload' })))),
  );
});

// Orden de la página (botón «Actualizar»): pasa de «en espera» a activo. Solo se acepta el mensaje exacto.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PRECACHE, RUNTIME]);
      for (const key of await caches.keys()) {
        if (key.startsWith('ogs-') && !keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin || !u.href.startsWith(scope)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(url('index.html'), { cacheName: PRECACHE }).then((hit) => hit || fetch(req)),
    );
    return;
  }

  // Fuentes del informe: cache-first, se guardan al primer uso.
  if (u.pathname.startsWith(new URL('fonts/', scope).pathname)) {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Resto (assets con hash, manifest, iconos): lo precacheado primero, la red como respaldo.
  event.respondWith(
    caches.match(req, { cacheName: PRECACHE, ignoreSearch: true }).then((hit) => hit || fetch(req)),
  );
});
