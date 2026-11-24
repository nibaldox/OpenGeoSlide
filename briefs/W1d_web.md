# Brief W1d: aplicación web (React + TS + Worker) contra un motor simulado

**Lee primero:** `briefs/00_CONTRATOS.md` (§1 modelo, §2 caso, §3 `AnalysisReport`). Responde en español.

## Objetivo
Crear `apps/web`: una SPA en español que carga un modelo o caso, ejecuta el análisis en un **Web Worker** mediante una
interfaz `Engine`, dibuja la sección con la superficie crítica y las dovelas, y muestra los resultados. Hoy funciona con
un **motor simulado** en TS; el wasm real se enchufa después sin tocar la UI.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/w1d` (rama `w1d-web`). **Solo** `apps/web/**`.

## Stack
pnpm 11.8 y Node 22. Vite, React y TypeScript en sus **últimas versiones estables** (verifica con `pnpm view <pkg> version`),
TS estricto y Vitest. Nada de UI kits pesados: CSS propio y Canvas 2D.

## Estructura requerida
- `src/engine/types.ts`: tipos TS fieles a §1 (`Model`), §2 (`VerificationCase`) y §3 (`AnalysisReport`, `MethodReport`,
  `Slice`, `SearchStats`, `SolveStatus`), en snake_case como el JSON.
- `src/engine/engine.ts`: `interface Engine { name: string; version(): Promise<string>; analyze(modelJson: string): Promise<string> }`
  (JSON in → JSON out, igual que `analyze_json`).
- `src/engine/mockEngine.ts`: motor simulado determinista.
  - Si el modelo trae `analysis.surface`, usa ese círculo; si no, uno razonable derivado del terreno.
  - Genera ~30 dovelas simples y calcula un FS ordinario (Fellenius) en TS para cada método pedido. `engine = "mock"`.
  - Debe ser obvio en la UI que es un simulador (banner "Motor simulado").
- `src/engine/wasmEngine.ts`:
  - carga `../wasm/ogs_wasm.js` (generado por wasm-bindgen `--target web`; hoy **no existe**) mediante
    `import.meta.glob('../wasm/ogs_wasm.js')`, de modo que si el archivo falta el build no falla y se cae al mock;
  - llama a `init()` y luego a `analyze_json` / `version`.
- `src/engine/worker.ts` + `src/engine/client.ts`:
  - protocolo `postMessage` con `{id, type: 'analyze' | 'version', payload}` → `{id, ok, result | error}`;
  - el cliente expone promesas y mide el tiempo con `performance.now()` dentro del worker (`elapsed_ms` en la respuesta).
- `scripts/build-wasm.sh` (ejecutable):
  1. `cargo build -p ogs-wasm --target wasm32-unknown-unknown --release` desde la raíz del repo;
  2. `wasm-bindgen --target web --out-dir apps/web/src/wasm target/wasm32-unknown-unknown/release/ogs_wasm.wasm`.
  Hoy puede fallar porque el crate aún no está implementado; documéntalo en el README de la app.
- **Casos:**
  - `import.meta.glob('../../../verification/cases/*.json', { eager: true })` (hoy puede no haber ninguno);
  - fallback `src/examples/acads1a.json` (modelo ACADS 1(a) de §1: c = 3, φ = 19.6, γ = 20, seco, búsqueda,
    métodos bishop y spencer).
- **UI** (en español, sin voseo):
  - selector de caso, casillas de métodos y botón **Calcular**;
  - **lienzo**:
    - regiones rellenas por material (paleta consistente) con contorno;
    - piezométrica en azul discontinuo;
    - superficie crítica en rojo y dovelas en gris tenue;
    - ejes con escala en metros, **misma escala en x e y**, y leyenda de materiales;
    - se redimensiona con la ventana (ResizeObserver) y aplica devicePixelRatio;
  - **tabla de resultados**: método, FS, estado, iteraciones, λ, superficies evaluadas/válidas y tiempo (ms).
    Si es un caso de verificación: publicado, error % y tolerancia, con un indicador OK/FALLA;
  - **panel "Rendimiento"**: repetir el análisis N veces y mostrar el promedio, el mínimo y el máximo en ms;
  - mensajes de error legibles cuando el motor falla.
- `src/geometry/viewport.ts`: transformación mundo ↔ pantalla con aspecto 1:1, márgenes y ajuste al contenido.

## Tests (Vitest)
- `viewport`: ida y vuelta mundo → pantalla → mundo (< 1e-9) y aspecto 1:1.
- `mockEngine`: devuelve un `AnalysisReport` que valida contra los tipos (chequeo en runtime de campos clave) y es determinista.
- `client`/`worker`: el protocolo empareja respuestas por `id`. Prueba la lógica de despacho de forma aislada
  (sin Worker real si no es posible en jsdom).

## Gates
- `pnpm install`, `pnpm test` (verde), `pnpm build` (verde, **no basta** `tsc --noEmit`) y `pnpm lint` si configuras ESLint.
- Smoke: `pnpm preview --host 127.0.0.1 --port 5180` en segundo plano y luego `curl -s http://127.0.0.1:5180 | head`
  (debe devolver el HTML). Después **detén** el servidor y verifica que el puerto quedó libre.

## Cierre
- `.gitignore` local en `apps/web/` para `node_modules`, `dist` y `src/wasm`.
- Commit en tu rama con rutas explícitas (nunca `node_modules`) y el mensaje `feat(web): app React con worker y motor simulado`.
  Sin push.
- **Resumen:** versiones instaladas, gates con su salida real, hash y capturas de texto relevantes.
- **Presupuesto:** ~50 iteraciones.
