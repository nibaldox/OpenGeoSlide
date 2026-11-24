# OpenGeoSlide: aplicación web (`apps/web`)

SPA en React + TypeScript para el análisis de estabilidad de taludes 2D. El cálculo se ejecuta en un
Web Worker a través de la interfaz `Engine`. Hoy el worker usa un **motor simulado** en TypeScript; cuando
exista el wasm de `ogs-core`, se carga automáticamente sin cambiar la interfaz.

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
