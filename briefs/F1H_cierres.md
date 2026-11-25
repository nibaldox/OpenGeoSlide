# Brief F1-H: cierres menores tras la ola G (Sonnet, un escritor)

Responde en **español neutro, sin voseo**. Antes de empezar, lee:
- `briefs/01_CONTRATOS_FASE1.md` §F1.7, con la decisión sobre R5-05;
- `docs/fase1/exploracion/X7.md`;
- `docs/reviews/R5_agy.md`.

## Directorio
Worktree `/home/xodla/archivos/opengeoslide-wt/f1h`, rama `f1h-cierres`, desde `main`.

## Tareas
1. **`apps/web/src/editor/app/ImportDialogs.tsx:86`:** usa `Object.hasOwn(mapping, l.name)`, igual que
   `importPlan.ts`, para que una capa `constructor` o `toString` muestre «omitir» en el `<select>`. Agrega un test de
   la lógica pura que decide el valor mostrado. Si esa lógica vive dentro del componente, extráela a una función.
2. **CI** (`.github/workflows/ci.yml`):
   - el job web ejecuta la prueba de paridad del editor con el motor real (`OGS_BIN` apunta al CLI compilado, a partir
     del artifact del job rust o compilándolo en ese job), con `OGS_ENGINE_G1=1`. Elimina esa variable, y su omisión
     en `parity.test.ts`, si ya no hace falta porque G1 está en `main`;
   - el job del oráculo ejecuta `verification/tools/test_web_roundtrip.py`, que necesita Node 22 y el binario;
   - `actionlint` limpio (`$TMPDIR/f1d-actionlint/actionlint`).
3. **`README.md`**, sección «Limitaciones conocidas»:
   - **R5-05:** cuando aparecen juntas las notas `multiple_admissible_roots` y `negative_effective_normal_major`, el FS
     de Spencer puede corresponder a una rama con tracción y quedar por debajo de Bishop (hasta −14 % frente a
     cSlope). Se recomienda revisar Bishop y la distribución de N′. Usa como evidencia X7.
   - **E12f:** una carga lineal a más de `1e-9·ancho` fuera del bloque analizado no actúa (nota `load_outside_mass`),
     aunque esté muy cerca del pie.
   - Actualiza las cifras de verificación si cambiaron. Agrega la prueba de ida y vuelta de la web (113 modelos, bit a
     bit) y la paridad entre el editor y el motor.
4. **`apps/web/README.md`**, si existe: describe el flujo de actualización de la PWA («Hay una versión nueva» →
   «Actualizar»). Elimina la mención «sin skipWaiting».
5. **`CHANGELOG.md`**, en Unreleased: agrega lo de la Fase 1 que falte (sismo, cargas, editor, DXF/CSV, PDF, PWA, CI,
   E12e y las correcciones de R5).

## Archivos que te pertenecen
- `apps/web/src/editor/app/ImportDialogs.tsx`, una función pura nueva en `src/editor/app/` y su test;
- `apps/web/src/editor/state/parity.test.ts`, solo para quitar la omisión condicional;
- `.github/workflows/ci.yml`;
- `README.md`, `apps/web/README.md` y `CHANGELOG.md`.

## Gates
- `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`
- `actionlint` limpio
- Paridad con el binario:
  ```
  cargo build --release -p ogs-cli && OGS_BIN=$PWD/target/release/ogs pnpm --dir apps/web exec vitest run src/editor/state/parity.test.ts
  ```
  La prueba debe pasar sin casos omitidos.
- Ida y vuelta:
  ```
  env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with pytest python -m pytest -q verification/tools/test_web_roundtrip.py
  ```

## Cierre
- Commits pequeños con rutas explícitas. Sin push.
- **Resumen:** gates con salida real y hashes.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`.
- **Presupuesto:** ~35 iteraciones.
