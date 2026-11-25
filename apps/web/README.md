# OpenGeoSlide: aplicación web (`apps/web`)

SPA en React + TypeScript para el análisis de estabilidad de taludes 2D. El cálculo se ejecuta en un
Web Worker a través de la interfaz `Engine`. Con el wasm de `ogs-core` presente (lo genera `scripts/build-wasm.sh`)
se usa el motor real; si falta, el worker recurre a un **motor simulado** en TypeScript sin cambiar la interfaz.
Incluye el editor gráfico, la importación DXF y CSV, el informe PDF y una PWA que funciona sin conexión.

## Requisitos

- Node 22 y pnpm 11.
- Opcional, solo para el wasm: toolchain Rust con `wasm32-unknown-unknown` y `wasm-bindgen` CLI 0.2.130.

## Comandos

```bash
pnpm install
pnpm dev        # servidor de desarrollo (127.0.0.1:5173)
pnpm test       # Vitest
pnpm build      # tsc --noEmit + vite build (genera dist/)
pnpm preview    # sirve dist/ en 127.0.0.1:5180
```

## Motores

| Motor | Estado | Cómo se elige |
|-------|--------|---------------|
| `ogs-wasm` (ogs-core real) | Disponible si existe `src/wasm/ogs_wasm.js` | Se usa automáticamente. Muestra «Motor: ogs-core <versión> (WASM)». |
| `mock` (simulado) | Respaldo | Se usa si no hay wasm. Muestra el banner «Motor simulado» con el motivo. |

El simulado calcula un FS con **Fellenius** (no Bishop ni Spencer) en ~30 dovelas, usa búsqueda en rejilla
sin refinamiento y marca cada resultado con un aviso. No es válido para ingeniería; sirve para probar la
interfaz y el protocolo.

### Generar el wasm

```bash
apps/web/scripts/build-wasm.sh
```

El script compila `ogs-wasm` (`cargo build -p ogs-wasm --target wasm32-unknown-unknown --release`) y ejecuta
`wasm-bindgen --target web` hacia `src/wasm/`. Requiere el target `wasm32-unknown-unknown` y `wasm-bindgen`
CLI 0.2.130 (igual que la dependencia del crate). `pnpm build` copia `ogs_wasm_bg.wasm` a `dist/`.

`src/wasm/` está en `.gitignore`.

## PWA y actualizaciones

El build genera `sw.js` y `manifest.webmanifest` (`build/pwa-plugin.ts`). El service worker precachea el shell, el
JS, el CSS, el glue y el `.wasm` (versionados por SHA-256), de modo que la app carga y calcula sin conexión. Solo se
registra en producción (`pnpm build` y `pnpm preview`), no en `pnpm dev` ni en `/?bench=1`.

Una versión nueva no reemplaza a la anterior sin que el usuario lo sepa:

1. El navegador detecta un `sw.js` distinto (se registra con `updateViaCache: 'none'` y se vuelve a comprobar al volver
   a la pestaña) y lo instala en segundo plano. Mientras tanto la pestaña sigue con la versión anterior.
2. Cuando el worker nuevo queda en espera, la app muestra el aviso **«Hay una versión nueva de OpenGeoSlide»** con el
   botón **«Actualizar»**.
3. Al pulsar «Actualizar» la página envía `SKIP_WAITING` al worker en espera. El worker nuevo toma el control y
   la página se recarga una sola vez en `controllerchange`, con el JS y el wasm nuevos.

Si el usuario ignora el aviso, la versión anterior se mantiene hasta que cierre las pestañas. El código está en
`src/pwa/` (`updateFlow.ts`, `updatePrompt.ts`, `register.ts`) y en `build/sw-template.js`.

## Pruebas

`pnpm test` ejecuta Vitest. La paridad entre el editor y el motor (`src/editor/state/parity.test.ts`) omite los
casos contra el motor real si no hay binario; para ejecutarlos:

```bash
cargo build --release -p ogs-cli
OGS_BIN=$PWD/target/release/ogs pnpm --dir apps/web exec vitest run src/editor/state/parity.test.ts
```

En CI, el job `web` descarga el binario del job `acceptance` y exige 0 casos omitidos.

### Página de benchmark

`/?bench=1` ejecuta en el worker el caso V047a (búsqueda 20 × 20 × 20 con refinamiento) para Bishop y Spencer,
con 1 calentamiento y 5 repeticiones. Escribe el JSON en `<pre id="bench-result">` y en `window.__OGS_BENCH__`.
La suite completa (nativo, Node y Chrome) está en `bench/`: `bench/run_all.sh`.

## Casos

- `verification/cases/*.json` (en la raíz del repositorio) se cargan automáticamente si existen.
- Si no hay ninguno, se usa `src/examples/acads1a.json` (ACADS 1(a), seco, búsqueda, Bishop y Spencer).
- También se puede subir un archivo `.json` con un modelo `.ogs.json` v0.1 o un caso de verificación.

Con un caso de verificación, la app compara el FS de cada `check` con el valor publicado según §2 del
contrato (|FS − publicado| / publicado ≤ tolerancia). Con el motor simulado, las comparaciones fallarán
en general: el simulado no reproduce el resultado de referencia.

## Estructura

```
src/
  engine/      tipos (§1–§3), interfaz Engine, motor simulado, wasm opcional, worker y cliente
  geometry/    transformación mundo ↔ pantalla (aspecto 1:1)
  render/      escena y dibujo en Canvas 2D (ResizeObserver, devicePixelRatio)
  analysis/    lógica sin React: modelos de ejecución, criterios de verificación, tiempos
  ui/          tablas de resultados y verificación, panel de rendimiento, leyenda
```

## Licencia

Apache-2.0, igual que el repositorio.
