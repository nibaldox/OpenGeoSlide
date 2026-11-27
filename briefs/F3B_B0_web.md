# Brief F3B-B0W: tipos, versión v0.6, avisos y motor simulado en la web

Responde en **español neutro, sin voseo**. Escritor: **Antigravity**.

## Objetivo

Congelar en la web lo que no depende de la física: los tipos de los campos v0.6, la regla de versión mínima, la
apertura y el guardado sin pérdida, los códigos de aviso nuevos y el rechazo del motor simulado. **Sin paneles ni
dibujo:** eso es de B1.

## Contexto

- Repo: tu clon `~/archivos/opengeoslide-agy/f3b0w`, rama `f3b0w-web`, creada desde `f3b-integracion`. El push está
  deshabilitado a propósito.
- **Contrato normativo:** `briefs/05_CONTRATOS_FASE3B.md`, secciones **F6.1 a F6.4, F6.6 (solo la forma de la salida:
  `MethodReport.strength` y `SearchStats.non_circular`), F6.7 y F6.13** (solo el motor simulado). Léelas completas.
- Mapa de la web con `archivo:línea`: `docs/fase3/exploracion/X27.md` §2.1 (los diez sitios de la regla de versión) y
  §3 (las líneas son de `0b9c984`; verifica).
- Otro escritor (Terra) hace en paralelo la parte del motor de B0. **No toques `crates/`, `schema/` ni
  `verification/`.** Tu motor de referencia es el de la v0.4.0, que no lee la v0.6: **no envíes modelos v0.6 al motor
  real** en ningún test.
- **Mensaje de versión desconocida**, igual en Rust, Python y la web:
  `version debe ser "0.1", "0.2", "0.3", "0.4", "0.5" o "0.6", no "<x>"`.
- **Mensaje de la puerta de versión**, igual que el motor: `<campo> requiere version "0.6"`, con los nombres y el orden
  de F6.1 (por ejemplo `materials[2].model = "hoek_brown"` o `analysis.search.non_circular`).

## Archivos

**Tuyos:**
- `apps/web/src/engine/types.ts`: `MaterialModel` con `hoek_brown` y `shansep`; en `Material`, `ucs`, `gsi`, `mi`,
  `disturbance` y `shansep`; `ShansepSpec`; `non_circular` en la búsqueda; `MethodReport.strength` y
  `SearchStats.non_circular`, todos opcionales;
- `apps/web/src/engine/warnings.ts`: los cuatro códigos de F6.7 con su tipo (estado o nota), su texto exacto y su ruta
  (`/materials` para los tres de material y `/analysis/search` para `non_circular_large_change`);
- `apps/web/src/io/ogsJson.ts`: `v06Fields` y `minimalVersion`, apertura de `"0.6"` con su puerta, las claves nuevas en
  el orden canónico (`MATERIAL_KEYS`: `ucs`, `gsi`, `mi`, `disturbance`, `shansep`; `SEARCH_KEYS`: `non_circular`; las
  claves internas de `shansep` y `non_circular` en el orden del contrato) y la ida y vuelta sin pérdida;
- `apps/web/src/editor/state/reducer.ts` (`syncVersion`) y `apps/web/src/editor/state/validateLocal.ts` (**solo** la
  puerta de versión, con el mismo mensaje y el mismo orden que el motor);
- `apps/web/src/engine/mockEngine.ts`: rechaza los materiales `hoek_brown` y `shansep` y `non_circular`, como rechaza
  hoy la grieta, con un mensaje que lo diga;
- tests nuevos: `apps/web/src/io/ogsJson.v06.test.ts`, `apps/web/src/engine/warnings.f3b.test.ts` y uno para el motor
  simulado; y los tests existentes que usan `"0.6"` como versión desconocida (por ejemplo `io/ogsJson.test.ts`), que
  pasan a `"0.7"`, más los que comparan el mensaje de la lista de versiones.

**Protegidos:** `crates/**`, `schema/**`, `verification/**`, `briefs/**`, `docs/**`, `CHANGELOG.md`,
`apps/web/package.json`, `pnpm-lock.yaml` (no agregues dependencias), los paneles (`editor/panels/**`), el lienzo
(`render/**`, `editor/canvas/**`), el informe (`report/**`) y `io/csv.ts`.

## Tests que tienen que existir

- **Versión mínima:** cada campo de F6.1 sube la versión a `"0.6"` al guardar, y un modelo sin ellos conserva su
  versión. La tabla «campo → versión» es una sola y la usan `minimalVersion`, `syncVersion` y `validateLocal`.
- **Apertura:** un archivo `"0.6"` con los campos nuevos se abre; uno `"0.5"` con un campo nuevo da el error de la
  puerta con el mensaje exacto.
- **Ida y vuelta sin pérdida** de cada campo nuevo, presente y ausente, incluidos `exponent` omitido, `{}` en
  `non_circular` y la tabla `ocr_by_elevation`.
- **Avisos:** los cuatro códigos están en `ENGINE_WARNING_CODES` con su texto exacto. El test existente que compara la
  lista con E6 de `briefs/00_CONTRATOS.md` (que ya tiene los cuatro códigos en esta rama) tiene que pasar sin cambios
  en su lógica.
- **Motor simulado:** rechaza cada campo nuevo.

## Gates

Desde tu clon, con `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`:

```bash
cargo build --release -p ogs-cli            # motor v0.4.0 del clon, para los tests con OGS_BIN
apps/web/scripts/build-wasm.sh
cd apps/web
pnpm install --frozen-lockfile --prefer-offline
pnpm test                                    # sin OGS_BIN
OGS_BIN=$PWD/../../target/release/ogs pnpm test
pnpm exec tsc --noEmit
pnpm build
```

- Todos en verde, sin tests omitidos de más respecto de `f3b-integracion` (anota las cifras de antes y después).
- Un gate que no imprime nada es una falla: revisa el código de salida.
- No uses los puertos 5180 ni 5181. Si necesitas `vite preview`, usa el 5186.

## Reglas

- Commits en tu rama, con rutas explícitas (`git add <rutas>`) y la identidad del repo (`git config user.name` y
  `user.email` ya están configurados en el clon). **Sin push, sin tags.**
- Si el contrato es ambiguo o un test existente contradice el contrato, **detente y repórtalo** con la cita y la
  evidencia. No inventes una regla ni cambies un test para que pase sin explicarlo.
- No edites `CHANGELOG.md`: propón tus líneas en el informe.
- Prioridad si te falta tiempo: (1) tipos y tabla de versión con sus tests, (2) apertura y guardado, (3) avisos,
  (4) motor simulado.

## Informe final

Al terminar, responde con:
- commits (hash y mensaje) y archivos tocados;
- la salida resumida de cada gate, con las cifras de tests antes y después;
- la tabla «campo → versión» tal como quedó en el código;
- decisiones que tomaste donde el contrato dejaba margen;
- líneas propuestas para el CHANGELOG.
