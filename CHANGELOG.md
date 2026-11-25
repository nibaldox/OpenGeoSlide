# Registro de cambios

Todos los cambios relevantes de OpenGeoSlide se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto se rige por el
[Versionado Semántico](https://semver.org/lang/es/). Mientras la versión mayor sea 0, el contrato `.ogs.json` y la
API pueden cambiar entre versiones menores.

## [Unreleased]

Fase 1: editor web, nuevas cargas y publicación.

### Added
- **Motor (`ogs-core`):**
  - Sismo pseudoestático (`analysis.seismic`, `kh` y `kv`) y cargas (`loads`: `udl` y `line`) en el formato `.ogs.json`
    v0.2 (E12a, E12b), con JSON Schema `schema/ogs-0.2.schema.json`. La versión 0.1 se sigue aceptando y da el mismo
    resultado bit a bit cuando el modelo no usa estos campos.
  - Validación de regiones (E12c): auto-intersecciones, solapes entre regiones y piezométrica con x estrictamente creciente.
  - Selección de la raíz de Spencer con menor F entre las admisibles (E12e), con la nota `multiple_admissible_roots`.
  - Cargas lineales en bordes, extremos del bloque y fronteras de dovela, con reparto 50/50 y simetría espejo
    (R5-01, E12f). Nota `load_outside_mass` para cargas fuera de la masa.
  - Rechazo de `material.id` vacío y de regiones degeneradas (E12j).
- **Editor web:**
  - Editor gráfico (estado, lienzo, paneles de materiales, regiones, agua, cargas, sismo y análisis).
  - Importación DXF (capas a materiales, unidades, polilíneas abiertas) y CSV (regiones y piezométrica).
  - Exportación `.ogs.json`, CSV de resultados y de superficie, e informe PDF.
  - Paridad con el motor (E12j): regiones degeneradas y modelos sin `surface` ni `search` se rechazan en el editor; un
    vértice consecutivo repetido es un aviso.
  - Aviso «Hay una versión nueva» con botón «Actualizar» para activar una versión nueva de la PWA (R5-08).
- PWA instalable: `manifest.webmanifest`, iconos 192 y 512 px y service worker propio con precache del shell, el JS, el
  CSS, el glue y el `.wasm`, de modo que la aplicación carga y calcula sin conexión. Las fuentes del informe se cachean
  bajo demanda, en un caché versionado con el build.
- `VITE_BASE` para desplegar la web bajo una subruta (por ejemplo, `/opengeoslide/` en GitHub Pages).
- Tipos congelados v0.2 del contrato entre el motor y la web.
- **Verificación:** harness en su versión 0.2 y 5 casos nuevos con sismo y cargas (51/51 checks en 21 casos); batería
  diferencial de 14 modelos (D11-D14 con sismo y cargas: 28/28 en búsqueda y 28/28 en superficie fija); prueba de ida y
  vuelta de la web frente al motor real (113 modelos, salida idéntica bit a bit; E12g) y prueba de paridad entre el
  editor y el motor (51 pruebas, 25 contra el binario `ogs`).
- Metadatos de publicación en los crates (`rust-version`, `repository`, `homepage`, `documentation`, `readme`,
  `keywords`, `categories`) y versión en las dependencias de ruta, para que `cargo publish --dry-run` funcione.
- Metadatos del wheel de Python: `license-files` (LICENSE y NOTICE en `*.dist-info/licenses/`), palabras clave y
  clasificadores.
- **CI y publicación:** workflows de GitHub Actions `ci`, `pages`, `wheels` y `release`. El job `web` de `ci` ejecuta la
  paridad editor/motor con el CLI compilado, sin casos omitidos, y el job `oracle` ejecuta la ida y vuelta de la web.
- `rust-toolchain.toml`, `CITATION.cff`, `CODE_OF_CONDUCT.md`, `SECURITY.md` y `CONTRIBUTING.md`.
- Documentación de las limitaciones R5-05 (Spencer con tracción) y E12f (carga lineal fuera del bloque) en el README.
  R5-05 se decidió tras X7 (`docs/fase1/exploracion/X7.md`): se mantiene E12e.

### Changed
- `apps/web/package.json` fija `packageManager` a `pnpm@11.8.0`.
- La web ya no redondea números al abrir, calcular ni guardar `.ogs.json`; el redondeo queda solo para mostrar (R5-02, E12g).

### Fixed
Correcciones de la revisión R5 (`docs/reviews/R5_agy.md`):
- Cargas lineales en el extremo del bloque o en una frontera de dovela ya no se descartan (R5-01, hasta +7,2 % no
  conservador frente a cSlope).
- `openOgsJson` rechaza campos desconocidos y la versión 0.1 con `loads` o `seismic`, igual que el motor; el JSON
  Schema v0.2 se alinea con las cotas del motor (R5-07).
- El informe PDF y el CSV de superficie ordenan la polilínea por x creciente (antes se perdía el pie en los modelos
  `left_to_right`). El CSV de superficie trae `estado` y solo exporta métodos convergidos; el CSV de resultados trae
  `avisos`; `lambda` solo se muestra si el método convergió; las exportaciones se bloquean si el resultado es de una
  revisión anterior; el dibujo del PDF no rotula «Superficie crítica» sin un método convergido (R5-03, R5-04).
- Importación DXF/CSV: una capa llamada `constructor` o `toString` ya no asigna una función como material, ni en el
  plan de importación ni en el `<select>` de capas (R5-06).
- PWA: `updateViaCache: 'none'`, aviso de versión nueva con botón «Actualizar», caché de fuentes versionado y rutas
  relativas en `index.html` (R5-08).
- CI: permisos acotados en `pages.yml`, pruebas de `ogs-py` en `wheels.yml` y `github-release` solo en `push` (R5-09).
- Paridad entre el editor y el motor en regiones degeneradas, modelos sin `surface` ni `search` y `material.id` vacío
  (R5-10, E12j).

### Known issues
- R5-05: con `multiple_admissible_roots` y `negative_effective_normal_major` juntas, el FS de Spencer puede quedar por
  debajo de Bishop (hasta −14 % frente a cSlope). Revisar Bishop y la distribución de N′.
- E12f: una carga lineal a más de `1e-9·ancho` fuera del bloque analizado no actúa (`load_outside_mass`).
- Detalle y demás limitaciones en la sección «Limitaciones conocidas» del README.

## [0.1.0-fase0] - 2026-11-25

Cierre de la Fase 0 (spike). Versión de prueba: ver `docs/fase0_cierre.md`.

### Added
- Motor `ogs-core` (Rust): geometría y dovelas, Bishop simplificado, Spencer (GLE) y búsqueda circular de
  entrada-salida con refinamiento. Ejecución serial y paralela con resultados idénticos bit a bit.
- CLI `ogs`, wrapper WebAssembly (`ogs-wasm`) y paquete Python `opengeoslide` (wheel `abi3`, `ogs-py`).
- Aplicación web (React y Vite) que ejecuta el motor WASM en un worker, con 16 casos de ejemplo, verificación frente
  al valor publicado y medición de rendimiento.
- Contrato `.ogs.json` v0.1 con JSON Schema.
- Verificación: 16 casos publicados (38 checks; el oráculo cSlope reproduce los 38) y una batería diferencial frente a
  cSlope (búsqueda 20/20 y superficie fija 20/20).

### Known issues
- Las limitaciones conocidas están en el README y en `docs/fase0_cierre.md` (backlog de la Fase 1).

[Unreleased]: https://github.com/opengeoslide/opengeoslide/compare/v0.1.0-fase0...HEAD
[0.1.0-fase0]: https://github.com/opengeoslide/opengeoslide/releases/tag/v0.1.0-fase0
