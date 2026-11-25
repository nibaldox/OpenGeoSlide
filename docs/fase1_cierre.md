# Cierre de la Fase 1 de OpenGeoSlide

**Fecha:** 2026-11-25 · **Base:** `main` tras el merge de F1-I · **Etiqueta:** `hito-fase1`

## Veredicto
**La Fase 1 está cerrada.** La última revisión adversarial independiente, **R6** (Antigravity, commit `730802e`), dio
**APROBADO_CON_RESERVAS**, sin hallazgos CRITICAL ni HIGH. Sus cinco reservas (R6-01 a R6-05) se corrigieron en F1-I,
cada una con un test que fallaba antes del arreglo.

## Qué agregó la Fase 1
- **Motor:**
  - Esquema `.ogs.json` **v0.2**, compatible con v0.1 bit a bit.
  - **Sismo pseudoestático** (`kh`, `kv`).
  - **Cargas** `udl` (distribuida) y `line` (lineal con ángulo).
  - Validación de regiones: auto-intersección y solape.
  - **Selección conservadora de la raíz de Spencer**: la admisible de menor F (E12e).
- **Editor web:**
  - Lienzo SVG con edición de vértices, piezométrica, círculo, cargas y sismo.
  - Paneles de materiales, agua, superficie, búsqueda, análisis, cargas, sismo y diagnóstico.
  - Deshacer y rehacer.
  - Validación local con la **misma regla que el motor**, comprobada con una prueba de paridad.
  - Abrir y guardar `.ogs.json` **sin pérdida de precisión**.
  - Borrador local.
- **Importación y exportación:**
  - DXF: LINE, LWPOLYLINE y POLYLINE 2D, con mapeo de capas a materiales y unidades.
  - CSV de regiones y piezométrica.
  - CSV de resultados y de superficie, con estado y avisos.
  - **Informe PDF** con fuente embebida (DejaVu Sans), sección vectorial, tablas, avisos y advertencia profesional.
- **Entrega:**
  - **PWA** instalable y funcional sin conexión, con flujo de actualización.
  - Workflows de CI, Pages, wheels y release, validados con `actionlint`.
  - Metadatos de crates y del wheel (manylinux2014, licencias incluidas).
  - CHANGELOG, CITATION, CONTRIBUTING, código de conducta y SECURITY.

## Números verificados por el coordinador (estado final)

| Verificación | Resultado |
|---|---|
| Tests `ogs-core`, serial y paralelo | 181 pasan, 0 fallan |
| Aceptación frente a valores publicados | **51/51** checks en **21 casos**, incluidos Loukidis con sismo y casos con `udl` |
| cSlope reproduce los mismos checks | 51/51 |
| Batería diferencial frente a cSlope (D01-D14, con sismo y cargas) | **búsqueda 28/28 · fija 28/28** |
| Tests de verificación Python | 424 pasan |
| Ida y vuelta web → motor | 113/113 modelos con reporte bit a bit idéntico |
| Tests web (Vitest), con paridad contra el motor real | 714/714 |
| Recorrido en Chrome con WASM real | 17/17 pasos, 0 errores de consola |
| Wheel Python | 13 pasan, 2 omitidos |
| Bench V047a, mediana nativo / Chrome | Bishop 50 / 56 ms · Spencer 217 / 232 ms. FS idéntico en todos los targets |
| fmt, clippy `-D warnings` y actionlint | limpios |

## Revisiones adversariales de la Fase 1 (Antigravity, solo lectura y fuera del espacio de trabajo)

| Ronda | Commit | Veredicto | Lo principal |
|---|---|---|---|
| R5 | `2e09642` | RECHAZADO | Carga en el extremo del bloque descartada (+7,1 %, no conservador); redondeo de la web que rompía 6/14 modelos; superficie mal dibujada en `left_to_right` |
| R6 | `730802e` | **APROBADO_CON_RESERVAS** | R5 cerrado (10 de 11 CERRADO, 1 PARCIAL); 5 reservas menores, corregidas en F1-I |

Cada hallazgo HIGH se reprodujo con el binario antes de aceptarlo. Las decisiones con números siguieron dos
exploraciones:
- **X5:** dio origen a E12e, la raíz de menor F.
- **X7:** se rechazó la regla alternativa porque creaba 9 sobreestimaciones.

## Limitaciones conocidas
Están en el README, cada una con su aviso. Las principales:
- R5-05: posible rama con tracción en Spencer, con notas `multiple_admissible_roots` y
  `negative_effective_normal_major`.
- R4-02: dos raíces de λ dentro de un mismo paso del barrido.
- Frontera de `min_width`.
- Cargas lineales con círculos locales.
- `unit_weight_sat` sin cobertura.

## Pendiente que depende del usuario: publicación
El proyecto está listo para publicarse, pero **no se ha publicado nada**: no hay remoto, ni push, ni PyPI, ni
crates.io. Faltan tres decisiones del usuario:
1. **Dónde vive el repositorio:** una organización `opengeoslide` o la cuenta `nibaldox`. El propietario provisional se
   cambia con un solo `sed` (ver F1-D).
2. **Cuándo hacerlo público.**
3. **Cuentas:** PyPI, con Trusted Publishing, y crates.io, con un token como secret.

Antes del primer release hay que subir la versión de los crates y del wheel a la que corresponda (hoy es `0.1.0`),
porque `release.yml` y `wheels.yml` publican al empujar un tag `v*`.

## Próxima fase (propuesta)
1. **Superficies no circulares:** polilínea fija, Janbu corregido, búsqueda de bloque y optimización de vértices. El
   diseño ya está en `docs/fase1/exploracion/X2.md`.
2. **R4-02:** subdivisión adaptativa del paso de λ.
3. Casos con `unit_weight_sat` y refuerzos (anclajes y geosintéticos).
4. **Análisis probabilístico** (Monte Carlo sobre c, φ y γ) y sensibilidad.
5. Publicación y comunidad: GitHub Pages, PyPI, documentación de teoría y validación, y casos aportados por usuarios.

## Advertencia
Este es software en desarrollo. Los resultados no sustituyen el criterio profesional del ingeniero geotécnico, que
sigue siendo responsable de la interpretación y del diseño.
