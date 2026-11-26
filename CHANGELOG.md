# Registro de cambios

Todos los cambios relevantes de OpenGeoSlide se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto se rige por el
[Versionado Semántico](https://semver.org/lang/es/). Mientras la versión mayor sea 0, el contrato `.ogs.json` y la
API pueden cambiar entre versiones menores.

## [Unreleased]

Fase 3a: formato v0.3, material no drenado, superficies polilínea fijas, Morgenstern-Price y Janbu. El contrato es
`briefs/02_CONTRATOS_FASE3.md` (enmiendas E13a a E13l). Un modelo sin campos nuevos da el mismo resultado, bit a bit,
que antes de la Fase 3a (`fos`, `status`, `iterations`, `lambda`, `warnings` y superficie).

### Added
- **Formato `.ogs.json` v0.3 (E13a).** JSON Schema `schema/ogs-0.3.schema.json`, que acepta 0.1, 0.2 y 0.3. Cada campo
  o variante nueva exige `"0.3"`: con una versión menor el error es `InvalidModel: <campo> requiere version "0.3"`,
  que nombra el primer campo que la exige. Los esquemas 0.1 y 0.2 se conservan. Los tipos nuevos rechazan campos
  desconocidos.
- **Material no drenado (E13b).** `model: "undrained"` con `undrained_strength`, y opcionalmente `strength_datum` (una
  cota) y `strength_gradient` (Su lineal con la cota) y `strength_limit`. La resistencia por dovela se resuelve en
  `strength::resolve`, en el punto medio de la base, con `tan φ = 0`. Mohr-Coulomb no cambia ningún bit, y un no drenado
  sin gradiente es idéntico a Mohr-Coulomb con φ = 0.
- **Superficie polilínea fija (E13c).** `analysis.surface = {"type": "polyline", "points": [[x, y], …]}`, con x
  estrictamente creciente. Se ajusta al terreno como `fit_polyline_to_ground` de cSlope: cada extremo se prolonga hasta
  su primer cruce con el terreno o se recorta en él (E13j-5). Los vértices son nodos obligatorios del corte, así que la
  base de cada dovela es recta. Estados `Invalid` nuevos: `polyline_no_ground_crossing` y `polyline_outside_ground`
  (también cuando la polilínea sale por una cara vertical del terreno). Con `slope.direction = "auto"`, el sentido se
  lee de los extremos ajustados. El slicer es genérico sobre `surface::Surface` (círculo o polilínea) y el círculo no
  cambia ni un bit.
- **Morgenstern-Price (E13d).** Método `morgenstern_price` con `analysis.interslice` y cinco funciones: `constant`,
  `half_sine` (por omisión), `clipped_sine`, `trapezoidal` y `data_points`. `X = λ·f(ξ)·E`; ξ crece con la x del modelo
  y se mide sobre el bloque de suelo (E13j-1 y E13j-8). Con `constant` reproduce a Spencer (`|ΔF| ≤ 1e-10`).
- **Janbu (E13e).** Métodos `janbu_simplified` (F₀, sin ecuación de momento) y `janbu_corrected` (`fos = f₀·F₀`, con
  `b₁` de 0,69, 0,31 o 0,50 según haya cohesión, fricción o ambas). La cuerda de `f₀` se mide sobre el bloque de suelo
  (E13j-2 y E13j-7). F₀ es la menor raíz admisible, con la nota `multiple_admissible_roots` (E13j-4).
- **Métodos según la superficie (E13f).** `bishop` con una polilínea es `InvalidModel: el método 'bishop' solo admite
  superficies circulares; use spencer, morgenstern_price o janbu`. Spencer y M-P en una polilínea arrancan desde F₀ de
  Janbu simplificado y toman momentos en los puntos medios de las bases.
- **Informe (E13g).** `surface` es `{xc, yc, r}` o `{points}` (la polilínea ya ajustada). Campos opcionales
  `correction_factor` (solo Janbu corregido) e `interslice` (solo M-P).
- **Estados nuevos (E13j-3).** `polyline_no_ground_crossing`, `polyline_outside_ground` y `bishop_non_circular` (una
  defensa del solver), en la lista E6 de `briefs/00_CONTRATOS.md` y en `apps/web/src/engine/warnings.ts`.
- **Aviso `interslice_shear_exceeds_strength` (E13k).** En Spencer y M-P, con `r_v > 3` (criterio de Chen y
  Morgenstern, 1983, en la forma de Zhu, Lee y Jiang, 2003): el cortante entre dovelas supera la resistencia de las
  caras verticales y el FS puede no ser físico. Severidad aviso; no se rechaza la solución. Calibrado entre el máximo de
  los casos de referencia (1,63) y el mínimo de las soluciones absurdas (3,88). Diagnóstico en
  `docs/fase3/d1/DIAGNOSTICO.md`.
- **Códigos nuevos de la revisión R10 (E13l-1).** `janbu_correction_extrapolated` (nota de `janbu_corrected` cuando
  `d/L` supera 0,4, el límite del gráfico de Janbu et al., 1973) y `non_positive_fos` (aviso: el método llegó a un FS
  menor o igual que cero o no finito y pasa a `not_converged`). Entran en la lista E6 y en `warnings.ts`.
- **Web (E13i).** Paneles de materiales (modelo no drenado), de análisis (cinco métodos y función entre dovelas) y de
  superficie (círculo o polilínea); el lienzo dibuja la polilínea con tiradores y el resultado con la polilínea ajustada;
  Casos con los cinco métodos; la casilla de Bishop se deshabilita con una polilínea y explica por qué; `validateLocal`
  con las mismas reglas del motor; conversión de unidades de Su, cota y gradiente; polilínea inicial admisible por
  construcción al pasar de círculo a polilínea; informe PDF y CSV con la polilínea, el método con su función, `f₀` y la
  tabla de Su; ayuda de la v0.3. La web guarda `"0.2"` si el modelo no usa campos de 0.3 y `"0.3"` si usa alguno; abre
  0.1, 0.2 y 0.3. El motor simulado rechaza todo modelo 0.3 y nunca inventa un FS.
- **Verificación (E13h).**
  - Importador de cSlope en tres lotes, sin el tope de 20 casos: **93 casos y 213 checks** en `verification/cases/`
    (antes 21 y 51): 41 casos v0.1, 5 v0.2 y 47 v0.3. Los checks que el motor no reproduce quedan en
    `verification/pending/` con su diagnóstico.
  - Pruebas por capacidad nueva en `crates/ogs-core/tests/` (oráculo en V047a, neutralidad, equilibrio global respecto
    de dos puntos, espejo, monotonía de Su, convergencia O(1/N²) de la polilínea inscrita, raíz de Janbu, dominio de
    ξ y los tres casos de D-1).
  - Batería diferencial: M-P `half_sine` y Janbu corregido sobre el círculo fijo de D01-D14 y los modelos nuevos D15
    (terraplén sobre arcilla blanda con Su lineal), D16 (relaves con Su constante) y D17 (bloque sobre capa débil con
    polilínea fija): 43/43 frente a cSlope 0.1.0. Los 56 checks de Bishop y Spencer siguen en 28/28 y 28/28. El
    conversor del oráculo (`verification/harness/to_cslope.py`) traduce no drenado, polilínea, M-P y Janbu.
  - **Revisión R10 (E13l), modelos D18 a D23** en la batería diferencial: Su con gradiente negativo y piso (D18), M-P con
    `clipped_sine` y `trapezoidal` (D19 y D20), una polilínea sobre un contacto de materiales (D21) y una polilínea en
    terreno horizontal con `kh` o con una carga horizontal (D22 y D23). La batería de la Fase 3a pasa de 43 a 71
    checks. Sobre la base `420baf0`, 61 coinciden con cSlope y los 10 de D21 a D23 fallan hasta que entran E13l-2 y
    E13l-5.
  - Tests de Python v0.3 de `ogs-py` (`crates/ogs-py/tests/test_v03.py`, 22 pruebas): polilínea, no drenado, M-P, Janbu y
    el aviso de E13k, con los valores de cSlope. Test del esquema con la polilínea sin `methods` y del uso de la CLI.
  - Recorridos de extremo a extremo de la web con el WASM real (`docs/fase3/iw/e2e/`).
  - `ogs bench --method` admite los métodos nuevos (`all` corre los cinco).
- **Documentación.** `docs/formato-ogs-json.md` con el formato v0.3 completo y ejemplos validados por
  `docs/tools/validar_ejemplos.py` contra el esquema y contra `ogs analyze`; `docs/limitaciones.md` y
  `docs/verificacion.md` actualizados; `docs/fase3/PLAN_REFUERZOS.md` con el plan del bloque de refuerzos.

### Changed
- `Material.cohesion` y `Material.friction_angle` son opcionales en el tipo; la validación los exige según `model`.
  Un material Mohr-Coulomb sin ellos sigue siendo `InvalidModel`, ahora con un mensaje propio.
- `SurfaceSpec` deja de ser `Copy` (la polilínea lleva una lista de puntos).
- **Escala de los residuos de fuerza (E13j-6).** El cierre `|E_n| ≤ 1e-6·escala`, el residuo de momento, la raíz de F₀ y
  la clasificación E7d de la N′ negativa usan `escala = max(ΣW, ΣW*)` (W* es el peso con sismo y cargas). Sin cargas y
  con kv ≤ 0 la salida es idéntica bit a bit; en 1206 corridas solo cambian V018, V077 y V078 (problemas de Prandtl con
  γ = 1e-6), que pasan a reproducirse y se promueven.
- **Cuerda de Janbu y dominio de ξ sobre el bloque de suelo (E13j-7 y E13j-8).** L, d y ξ se miden sin las dovelas aéreas
  de los extremos, igual que en cSlope. D09 pasa de +0,98 % a +0,04 % con Janbu corregido y de +3,39 % a +0,016 % con M-P
  `half_sine`. Spencer, Bishop, Janbu simplificado y M-P `constant` siguen idénticos byte a byte.
- **Un círculo cuyo arco termina tangente al terreno** (centro a la cota de la cresta) deja de ser `NoValidSurface` y se
  analiza (V068).
- **Revisión R10 (E13l).** Cada punto, con su test RED y su efecto medido sobre todos los modelos:
  - **E13l-1, `f₀` de Janbu.** `f₀ = máx(1, 1 + b₁·(d/L − 1,4·(d/L)²))`: la corrección nunca reduce F₀. Antes, una polilínea
    profunda daba un FS de −23,43 (R10A-01) o de −0,752 (R10B-01) marcado `converged`. Ningún método devuelve
    `converged` con un FS ≤ 0 o no finito.
  - **E13l-2, fuerza motriz en polilíneas.** E3 (`no_driving`) evalúa `Σ(W*·sen α + H·cos α)` en el sentido del
    deslizamiento. Antes, una polilínea sobre terreno horizontal con `kh = 0,3` o con una carga horizontal era
    `invalid` aunque cSlope converge (R10A-02). Los círculos no cambian.
  - **E13l-4, paso de λ en M-P.** El paso es `0,05 / máx(f̄, f_máx/2)`, con f normalizada internamente por `f_máx`; las
    cinco funciones estándar dan el mismo resultado de antes. Un `data_points` de pico angosto o de escala muy pequeña
    deja de caer en `no_lambda_root` (R10A-08).
  - **E13l-5, base sobre un contacto de materiales.** Si el punto medio de la base está a menos de `tol` de un contacto
    se toma el material más débil, por `c + máx(0, σ′)·tan φ` (o Su). Antes se tomaba el de arriba: +20,3 % no
    conservador frente a cSlope en una polilínea sobre el techo de un estrato débil (R10A-04).
  - **E13l-6, robustez de la polilínea.** Distancia 2D en la prolongación y el recorte de los extremos (R10A-05), los
    vértices de la polilínea tienen prioridad sobre las fronteras de las cargas y sobre la fusión por `tol` (R10A-09), y
    la cara vertical sobre un contacto vertical toma la resistencia del lado más débil.
  - **E13l-7, superficie informada.** Con `truncated_driving_mass`, `report.surface` de una polilínea se recorta al
    rango analizado, como el trazo de los círculos (R10B-05). La web dibuja y exporta ese rango.
  - **E13l-8, esquema.** `ogs-0.3.schema.json` exige `analysis.methods` en una polilínea fija, porque el valor por
    defecto `["bishop"]` la rechaza (R10A-10, R10B-04). `validateLocal` aplica ese valor por defecto.
  - **Aclaración de E13k.** Solo cuentan las caras con `E′ > 0`, así que la fórmula usa `E′` y no `máx(E′, 0)`.
- **Verificación (R10A-11).** `to_cslope.py` resuelve `slope.direction = "auto"` con los extremos de la polilínea ya
  ajustados al terreno, como el motor (E13c), y `run.py` aplica `options.interslice` de cada check como `to_cslope.py`.
  Ninguno de los 93 casos cambia (213/213; cSlope 212/213).
- **`ogs-py` y CLI (R10B-10).** El docstring del paquete describe los códigos y estados de la Fase 3a y E13l (decía que
  no había códigos de aviso nuevos), y `ogs` sin argumentos lista los cinco métodos de `--method`.

### Known issues
- **Bishop solo en círculos y búsqueda solo circular.** La búsqueda no circular, Hoek-Brown y SHANSEP son de la Fase
  3b; los refuerzos (tablestacas, pilotes, anclajes, clavos y geosintéticos) son un bloque aparte
  (`docs/fase3/PLAN_REFUERZOS.md`).
- **Polilíneas con tramos muy empinados:** la guarda `m_α` (E4b) puede rechazar una superficie que cSlope sí analiza
  (`m_alpha`).
- **Soluciones inadmisibles en polilíneas en V:** Spencer y M-P pueden converger con un FS de 49 a 130 donde Janbu da 4 a
  5; el aviso `interslice_shear_exceeds_strength` lo señala (E13k).
- **Retenidos:** V027, V028 y V068 (`negative_effective_normal_major` en la aceptación) y V032a (la búsqueda halla un
  mínimo real, más conservador, que sale de los rangos efectivos). Detalle en `docs/limitaciones.md`.
- El espejo solo da el mismo FS con funciones simétricas entre dovelas, porque ξ crece con la x del modelo.
- **`r_v ≤ 3` no garantiza una solución física (R10A-06).** Un caso bicapa con Spencer en 2,9 veces Janbu (12,665 frente a
  4,356) no recibe el aviso de E13k, y cSlope no converge en él. Compare Spencer y M-P con Janbu sobre la misma polilínea.
- **Escala de los residuos con cargas verticales grandes (R10A-03, R10A-07).** `máx(ΣW, ΣW*)` puede ocultar un
  desequilibrio de momento cuando una sobrecarga enorme actúa sobre un tramo horizontal no drenado. La escala motriz de
  E13l-3 se adopta solo si cumple sus cuatro criterios (`docs/limitaciones.md`).
- **`force_root_at_zero` de Janbu (R10A-11, 3):** la búsqueda de la raíz cercana a cero no cuenta en `max_iterations`.
- **`unit_weight_sat` sin cobertura frente a otro programa.**

## [0.1.0] - 2026-11-25

Primera versión pública (cierre de la Fase 1): editor web, sismo y cargas, y publicación en
<https://github.com/nibaldox/OpenGeoSlide>.

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
- `VITE_BASE` para desplegar la web bajo una subruta (por ejemplo, `/OpenGeoSlide/` en GitHub Pages).
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
- **Distribución:** la web se publica en <https://nibaldox.github.io/OpenGeoSlide/>. Los wheels de Python (`abi3`,
  CPython ≥ 3.11) y el sdist se suben como assets del GitHub Release del tag `v*`. La publicación en PyPI queda
  desactivada hasta definir la variable de repositorio `PYPI_PUBLISH` (requiere cuenta y Trusted Publishing);
  la publicación en crates.io sigue detrás de `workflow_dispatch` y del secret `CARGO_REGISTRY_TOKEN`.
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

## [hito-fase0] - 2026-11-25

Hito de cierre de la Fase 0 (spike), incluido en 0.1.0 (primer release). Marcado con la etiqueta `hito-fase0`
(no sigue `v*`, así que no dispara releases). Ver `docs/fase0_cierre.md`.

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

[Unreleased]: https://github.com/nibaldox/OpenGeoSlide/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nibaldox/OpenGeoSlide/releases/tag/v0.1.0
[hito-fase0]: https://github.com/nibaldox/OpenGeoSlide/tree/hito-fase0
