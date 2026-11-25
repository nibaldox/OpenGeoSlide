# Registro de cambios

Todos los cambios relevantes de OpenGeoSlide se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto se rige por el
[Versionado Semántico](https://semver.org/lang/es/). Mientras la versión mayor sea 0, el contrato `.ogs.json` y la
API pueden cambiar entre versiones menores.

## [Unreleased]

Fase 1: editor web, nuevas cargas y publicación.

### Added
- Editor gráfico en la web (estado, lienzo, paneles, importación/exportación e informe PDF).
- Cargas y sismo pseudoestático en `ogs-core` (E12a y E12b) y validación de regiones (E12c), con el harness de
  verificación en su versión 0.2.
- Tipos congelados v0.2 del contrato entre el motor y la web.
- PWA instalable: `manifest.webmanifest`, iconos 192 y 512 px y service worker propio con precache del shell, el JS, el
  CSS, el glue y el `.wasm`, de modo que la aplicación carga y calcula sin conexión. Las fuentes del informe se cachean
  bajo demanda.
- `VITE_BASE` para desplegar la web bajo una subruta (por ejemplo, `/opengeoslide/` en GitHub Pages).
- Metadatos de publicación en los crates (`rust-version`, `repository`, `homepage`, `documentation`, `readme`,
  `keywords`, `categories`) y versión en las dependencias de ruta, para que `cargo publish --dry-run` funcione.
- Metadatos del wheel de Python: `license-files` (LICENSE y NOTICE en `*.dist-info/licenses/`), palabras clave y
  clasificadores.
- Workflows de GitHub Actions: `ci`, `pages`, `wheels` y `release`.
- `rust-toolchain.toml`, `CITATION.cff`, `CODE_OF_CONDUCT.md`, `SECURITY.md` y `CONTRIBUTING.md`.

### Changed
- `apps/web/package.json` fija `packageManager` a `pnpm@11.8.0`.

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
