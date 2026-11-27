# Registro de cambios

Todos los cambios relevantes de OpenGeoSlide se documentan en este archivo.

El formato sigue [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto se rige por el
[Versionado Semántico](https://semver.org/lang/es/). Mientras la versión mayor sea 0, el contrato `.ogs.json` y la
API pueden cambiar entre versiones menores.

## [Unreleased]

## [0.5.0] - 2026-11-27

Bloque de Hoek-Brown, SHANSEP y búsqueda no circular (F3B): formato v0.6. El contrato es
`briefs/05_CONTRATOS_FASE3B.md` (F6.1 a F6.14 y las enmiendas E16a a E16ac, con las correcciones de las revisiones R15 y R16); la
evidencia, `docs/fase3/exploracion/X23*.md` a `X30*` y los prototipos de `docs/fase3/exploracion/X28_proto/`. **Un modelo
sin campos v0.6 da la misma salida, byte a byte, que la 0.4.0** (con la versión del motor normalizada): 0 diferencias en 180
modelos, con 17 modelos v0.6 saltados aparte (el binario base no lee esa versión) y 23 con agua sobre el terreno idénticos.
La única excepción deliberada es E16aa (R16): en un contacto entre dos materiales bajo agua embalsada o con cargas, la
elección del material más débil cambia respecto de la 0.4.0, que podía elegir el más resistente; ningún modelo del corpus
cambia. Lo que corrigieron las revisiones R15
(enmiendas E16v a E16z, contra `92fa882`) y R16 (E16aa a E16ac, contra `9c5a881` y `7b40e98`) está en «Fixed».

### Added
- **Formato `.ogs.json` v0.6 (F6.1).** El motor acepta 0.1 a 0.6. Exigen `"version": "0.6"`, y el error nombra el
  primero que encuentra: `materials[i].model = "hoek_brown"` o `"shansep"`, los campos `ucs`, `gsi`, `mi`, `disturbance` y
  `shansep`, y `analysis.search.non_circular` (`InvalidModel: <campo> requiere version "0.6"`). La web guarda `"0.6"` solo
  si el modelo los usa.
- **Material Hoek-Brown (F6.8, E16q).** `model: "hoek_brown"` con `ucs` (σci, en la unidad de esfuerzo del modelo), `gsi`
  (0 a 100), `mi` y `disturbance` (D, de 0 a 1, **obligatorio y sin valor por defecto**); `unit_weight_sat` y `ru` como en
  Mohr-Coulomb. Es el criterio generalizado de Hoek, Carranza-Torres y Corkum (2002) con la **tangente instantánea** a la
  envolvente en el σ′n de cada dovela, resuelta por un lazo por dovela sin tocar los métodos (promedio w = 0,5,
  convergencia de 1e-6 relativo, hasta 50 pasadas).
  - **Envolvente completa en bajo confinamiento:** con `σ′n ≤ sn(0)` el motor toma la tangente de la misma envolvente con σ3
    en (σt, 0], y con `σ′n ≤ σt` no da resistencia. Es distinta de la de cSlope (tangente de σ3 = 0) y **nunca sobreestima**:
    en círculo fijo da de 0,005 % a 2,9 % menos que cSlope (SB, Janbu), siempre del lado seguro. La regla de cSlope existe
    solo en las compilaciones de test (`#[cfg(test)]`, E16t).
  - **Salida `strength`:** `passes` y, por dovela de roca, `law` y `normal_stress`. `slices[].cohesion` y `tan_phi` son los
    de la última pasada.
  - **Avisos:** `hoek_brown_low_confinement` (informativo, una vez por método) y `hoek_brown_not_converged` (estado
    `not_converged`, sin FS).
- **Material SHANSEP (F6.9, E16o).** `model: "shansep"` con `shansep.ratio` (S), `exponent` (m, 0,8 por defecto) y
  exactamente una de `ocr`, `pop` u `ocr_by_elevation`. `Su = S·σ′v·OCR^m`, con φ = 0, una vez por dovela y sin iteración;
  σ′v = (W + Q + V)/b − u en el punto medio de la base, **sin el sismo** (E16o); las caras usan σ′v de la columna de suelo
  (E16r). `strength.slices` trae `vertical_stress` y `ocr`; con σ′v ≤ 0, Su = 0 y la nota `shansep_nonpositive_stress`.
- **Búsqueda no circular (F6.10, E16p, E16s).** `analysis.search.non_circular: { seeds, max_vertices }` (3 y 33 por defecto;
  `{}` es válido) refina los mejores círculos a una polilínea con la variación alterna de Celestino y Duncan (1981), por
  método, con 9, 17 y 33 vértices, un presupuesto de 1500 evaluaciones por semilla, concavidad de cSlope y resultado
  determinista (con o sin `parallel`). **Sin Bishop** (`InvalidModel`). La salida `search.non_circular` trae `seeds`,
  `evaluated`, `seed_fos` y `polyline_fos`; la nota informativa `non_circular_large_change` avisa de una baja de más de 15 %
  respecto del círculo. El FS reportado nunca supera el del círculo de la búsqueda circular.
- **Combinaciones no admitidas (F6.5).** `InvalidModel`, antes de cortar dovelas: Bishop con `non_circular`, grieta con
  `depth: "auto"` y un material Hoek-Brown o SHANSEP, y Ito-Matsui con esos materiales. Las valida solo el motor.
- **Esquema (E16n).** `schema/ogs-0.6.schema.json`, que acepta 0.1 a 0.6 y rechaza lo mismo que el motor, salvo lo que JSON
  Schema no expresa (el orden de `ocr_by_elevation` y las reglas de F6.5); `verification/tools/test_schema.py` compara las
  dos implementaciones (594 pruebas con `test_cli_usage.py`).
- **Web.**
  - Tarjetas de material Hoek-Brown (con la calculadora de `mb`, `s` y `a` y la guía de D, y avisos de σci fuera de
    1000 a 300 000 kPa) y SHANSEP (con OCR constante, POP u OCR por cota, en una tabla accesible); el FS se conserva al
    pasar de SI a imperial (|ΔFS| ≤ 1e-9).
  - Casos con búsqueda no circular (Bishop deshabilitado con su razón), la polilínea crítica con sus vértices en el
    lienzo, la leyenda por modelo y el resumen no circular de la tabla.
  - Informe PDF y CSV con las columnas y el bloque de Hoek-Brown, SHANSEP y búsqueda no circular, y el CSV por dovela
    conectado; Diagnósticos y Ayuda con los modelos y los avisos nuevos. El informe de un modelo v0.5 es idéntico, byte a
    byte, al del tag `v0.4.0` (`apps/web/src/report/identity.f3b.mjs`).
- **Python y CLI.** El wheel de `ogs-py` prueba y documenta la v0.6 (`crates/ogs-py/tests/test_v06.py`, 108 pruebas; la
  docstring del paquete y `crates/ogs-py/README.md`). La CLI documenta en `--help` los campos v0.6 de la entrada y
  `strength` y `search.non_circular` de la salida.
- **Verificación.**
  - **Filas de aceptación por módulo:** Hoek-Brown contra el prototipo de la envolvente completa (20 filas, ≤ 0,0011 %) y
    contra la regla de cSlope (33 de 35, de 0,0018 % a 0,0716 %); SHANSEP contra cSlope (13 escenarios × 5 métodos, ≤ 0,0224 %);
    búsqueda no circular contra cSlope (10 búsquedas, de +0,010 % a +0,398 %, y 10 evaluadores, ≤ 0,0616 %); HAM1 (Hammah et
    al., 2005, ejemplo 1, geometría reconstruida, tolerancia de 0,5 %).
  - **Importador y conversor de cSlope:** convierten Hoek-Brown, SHANSEP y `nonCircularOptimization`. Se promueven **16
    casos con 20 checks** a `verification/cases/` (los diez que ya tenían caso se llaman `<id>-nc`).
    **Total: 167 casos y 347 checks; aceptación 347/347 y cSlope 346/347** (V027 no converge). Quedan retenidos, con su causa,
    V002-nc (E16u, rama de tracción de E12e), V009c (E13k) y V105a (`aboveWater`, fuera del formato): **18 checks en 12
    casos** en todo `verification/pending/`.
  - **Batería diferencial F3B** (`verification/differential/cases_f3b/`, 12 modelos, 42 checks, opcional con
    `--include-f3b`): **41 OK, 1 explicado (E16t) y 0 fallas**; fase 3a 71/71, v0.4 12/12, v0.5 58 OK y 2 explicados, búsqueda
    y superficie fija 28/28 cada una.
  - **Identidad con la 0.4.0** (`identity_vs_baseline.py`): 0 diferencias en 180 modelos, sin agregar excepciones a
    `identity_exceptions.json`; los modelos v0.6 se cuentan aparte.
  - **Pruebas medidas en el commit de la release:** `ogs-core` 784 pasan y 2 ignoradas, igual con `parallel`; `ogs-cli`
    8; `pytest verification` 1549 pasan y 1 omitida; wheel de `ogs-py` 370 pasan y 2 omitidas; web 4136 de 4136 con el
    motor real y 3816 pasan con 320 omitidas sin él.
- **Documentación.** `docs/formato-ogs-json.md` con las secciones de Hoek-Brown, SHANSEP, búsqueda no circular y
  combinaciones no admitidas (5 ejemplos nuevos; en total, 14 ejemplos y 103 fragmentos validados con
  `docs/tools/validar_ejemplos.py` contra el esquema 0.6, que gana `pasadas=`, `ley=`, `sv=`, `nc=` y `superficie=`); `docs/limitaciones.md` con los límites de las tres
  capacidades; `docs/verificacion.md` con las filas y los costos medidos; el README con las capacidades y las limitaciones.

### Changed
- **`hoek_brown_not_converged` deja `fos` en `null` (E16w).** Antes quedaba el F de la última pasada. La nota
  `hoek_brown_low_confinement` se conserva.
- **La búsqueda con Hoek-Brown es unas 4,5 veces más rápida (E16w).** Newton salvaguardado en `hoek_brown::point`,
  `ba/base` en lugar de un segundo `powf` y `sn(0)` y σt precalculados. La búsqueda Bishop de F3B-HB-01 baja de 8,16 a 1,79 s
  en serie y de 0,52 a 0,13 s con `parallel`; F3B-HB-02, de 5,33 a 1,18 s (de unas 50 a unas 12 a 14 veces la de
  Mohr-Coulomb). El FS cambia 6,2e-14 relativo como máximo. En el navegador, con WASM monohilo, la búsqueda de F3B-HB-01
  con 4 métodos baja de 36 s a unos 20 s.
- **El costo de la búsqueda no circular es de 2,3 a 3,1 veces la circular (E16x)**, con los extremos nuevos (V001 2,3,
  V034a 2,4 y V036a 3,1).
- **El FS de Hoek-Brown de la fila SB con Bishop del producto** sigue en +0,001024 % frente al prototipo: donde antes se
  decía «≤ 0,001 %», el gate es «sin cambio» y la cifra, «≤ 0,0011 %».
- **El esquema 0.6 admite `null`** en `non_circular.seeds` y `max_vertices` (E16z), como los demás campos opcionales.
- **Los avisos del PDF se deduplican por (código, ruta) y se escriben en las unidades activas.** **Cambio deliberado frente a
  la v0.4:** dos materiales con γsat < γ dan **dos** avisos en el PDF, no uno.
- **Una sola lista de notas informativas (E16z).** La de `acceptance.rs`; un test compara la de
  `verification/differential/run.py`. El veredicto «explicado (§4.2: m_α)» exige además `FS_ogs ≤ 1,05·FS_cSlope`.
- **`ogs bench --method all` omite Bishop** si el modelo trae `analysis.search.non_circular`, y lo avisa por stderr; un
  `--method bishop` explícito sigue dando el error del motor.

### Fixed
- **Revisión de cierre R16 (dos lentes contra `9c5a881` y una verificación focalizada contra `7b40e98`; enmiendas E16aa a
  E16ac).**
  - **E16aa, contacto entre materiales bajo agua embalsada o con cargas (R16A-01, alta).** La comparación del material
    más débil en un contacto usaba solo el peso del suelo, pero restaba la presión de agua completa: bajo embalse o con una
    sobrecarga veía una tensión efectiva casi nula y podía elegir el material más resistente, del lado inseguro. El
    defecto venía de E13l-5 y estaba también en la 0.4.0 entre dos materiales lineales. Ahora la elección se hace después
    del embalse y las cargas, con el mismo σv de la base (suelo, embalse y cargas verticales, sin el sismo) y el `u` de
    cada candidato. Con Spencer, FS sobre el contacto: MC sobre Hoek-Brown con embalse, de 1,7824 a 1,4675; MC sobre
    SHANSEP con carga distribuida, de 1,4222 a 1,0615; cohesivo sobre friccional con embalse (igual en la 0.4.0), de
    1,0591 a 0,7356; MC sobre SHANSEP con carga lineal, de 4,2448 a 2,9985. Los contactos secos de E16v no cambian y
    ningún modelo del corpus de identidad cambia.
  - **E16ab, OCR no finito (R16A-02).** Con un POP extremo y una dovela de σ′v pequeña, Su era finita pero el OCR
    desbordaba y salía `"ocr": null` con código 0; ahora es `InvalidModel`, como E16y.
  - **Web (R16B-01, alta; R16B-02).** Guardar, Ctrl+S y la paleta se bloquean con borradores de tarjeta sin aplicar
    (antes descargaban el material anterior). Cambiar de pestaña y descartar el documento (Nuevo, Abrir, Ejemplos, Talud
    simple, Recuperar) piden confirmación aunque el archivo esté guardado (antes el borrador se perdía sin aviso).
    Ctrl+S confirma el campo con foco antes de guardar. El botón principal deshabilitado tiene estilo propio en claro y
    oscuro.
  - **Documentación (R16A-03).** La identidad web se documenta contra el tag `v0.4.0` (seis modelos, `git archive`) y el
    índice de `pending/F3B` cuenta los 3 retenidos de `HOLD.json`.
  - **E16ac, cierre de la verificación R16b (contra `7b40e98`).** La comparación del contacto usa el peso de la columna del
    slicer sin rehacerlo como `weight / width`: en contactos secos con `ru` y en un empate exacto el informe vuelve a ser
    byte a byte el de la 0.4.0 (antes difería en 1 ULP: FS 1,9356487327666008 frente a …665999, o el material de una dovela
    en el empate). Una tensión vertical efectiva SHANSEP no finita (datos de ~1e308) da `InvalidModel: la tensión vertical
    efectiva en la base del material SHANSEP '<id>' no es finita (revise los pesos unitarios, el agua y las cargas)`, en
    lugar de `"vertical_stress": null`. El rustdoc de `slicer::slice_*` y `water::ponded_terms` dice que el material del
    contacto lo elige `water::apply_ponded`.
  - **Web (R16b2-03).** Los borradores sin aplicar de Geometría (vértice), Agua (γw y piezométrica), Sismo, Superficie fija
    (círculo y polilínea), Cargas y el formulario de material nuevo entran al mismo registro que Materiales, Refuerzos,
    Análisis y Búsqueda: bloquean Guardar y Comprobar, piden confirmación al cambiar de pestaña y activan el aviso al cerrar
    o recargar la página. Proyecto no registra borradores porque su texto siempre se aplica.
- **Revisión R15 (tres lentes, contra `92fa882`; enmiendas E16v a E16z).**
  - **E16v, contacto entre materiales con Hoek-Brown o SHANSEP (R15A-01, crítica).** `weaker_at_contact` comparaba con una
    resistencia que vale (0, 0) para esos materiales y ganaba siempre el material nuevo, aunque fuera el más resistente:
    una polilínea por el contacto de una capa débil bajo roca fuerte se analizaba en la roca, del lado inseguro. Ahora se
    compara la resistencia real (Hoek-Brown: `τ(σ′n)` de la envolvente completa; SHANSEP: Su con σ′v de la columna). Con
    Spencer: MC débil sobre HB fuerte, de 18,036 a 1,2342; MC débil sobre SHANSEP, de 8,3083 a 1,2342; SHANSEP fuerte sobre
    MC débil, de 13,4306 a 6,3363. Sin cambio con materiales lineales.
  - **E16w, lazo de Hoek-Brown (R15A-03, R15A-06).** El arranque pasa a `máx(0, ·)`: `X28-R-SB-RU03` deja de quedar sin FS
    y converge en los cinco métodos (Bishop 0,886886, Spencer y M-P 0,943003, Janbu simplificado 0,727964 y corregido
    0,761333, todos bajo cSlope). Con ello, F3B-HB-06 con Bishop en búsqueda pasa de «explicado (§4.2)» (0,5373) a OK (0,5244
    frente a 0,5279 de cSlope): la causa era el arranque del lazo.
  - **E16x, búsqueda no circular (R15A-02, crítica; R15A-08).** Los extremos de la conversión salen del tramo que analiza
    el slicer, no de los cruces extremos del círculo: **los 16 taludes homogéneos de 10 m y 45° refinan, contra 2 de 16
    antes**, que devolvían el círculo con `evaluated` = 0 y sin aviso. Holgura de ventanas de `máx(tol, 1e-6·ancho)`,
    tolerancias con la escala del modelo y la nota informativa `non_circular_not_refined` cuando no se refina. El banco con
    capa débil queda en +2,87 % sobre cSlope (explicado: cSlope no converge en ese círculo).
  - **E16y, caras y SHANSEP (R15A-04, R15A-10, R15C-01).** Las caras de `hoek_brown` y `shansep` suman el peso del agua
    embalsada; la capacidad de cara seca y sumergida coincide a 6e-16 (el FS de equilibrio límite no es invariante: +0,15 %,
    también con Mohr-Coulomb no drenado, y el aviso de cortante entre dovelas puede seguir en el caso sumergido). POP sin
    cociente. Si Su no es finita, `InvalidModel: la resistencia SHANSEP del material '<id>' no es finita (revise shansep.ocr,
    pop u ocr_by_elevation)`, también en una búsqueda; antes, un `ocr` de 1e308 salía con código 0 y 240 `cohesion` `null`.
  - **E16z, verificación y esquema (R15A-05, R15A-09, R15A-11, R15C-02, R15C-03).** Los casos `F3B-NC-V001` y `F3B-NC-V034a`
    dejan de escribir `analysis.interslice`, que la CLI rechaza sin M-P; veredicto m_α con cota 1,05; lista única de notas
    informativas; `null` en el esquema; los tests de «identidad» de la web se llaman «ausente y null dan el mismo PDF», y
    la identidad es la de `identity.f3b.mjs` contra el tag `v0.4.0`.
- **Web (R15B).**
  - Un borrador de material sin aplicar **bloquea calcular y exportar** (era una regresión de B2a que dejaba el borrador sin
    aviso), y se avisa en la tarjeta.
  - Bishop por defecto con `non_circular` se valida en paridad con la CLI; los Casos con `non_circular` no usan Bishop.
  - «Superficie crítica» y el resumen no circular en la tabla; el aviso combinado de la rama de tracción
    (`negative_lambda` y `negative_effective_normal_major`) sin sugerir Bishop donde no aplica; Hoek-Brown sin FS orientado.
  - Cambiar un material existente a Hoek-Brown o SHANSEP era imposible (el reducer rechazaba el material a medias): ahora es
    un borrador de la tarjeta.
  - La grieta automática con Hoek-Brown o SHANSEP se previene en el editor; las notas de F6.5 salen en línea.
  - Nota SHANSEP y sismo en el PDF; cronómetro y «Cancelar» en Casos; navegación de Diagnósticos de la v0.6.
- **Web (W-R15c).** La leyenda rotula «Superficie crítica (polilínea)» en una búsqueda no circular y deja «Superficie fija
  (polilínea)» para una polilínea fija; con un borrador sin aplicar, el resumen marca los FS del cálculo anterior como
  desactualizados («Desactualizado: calculado antes de los cambios sin aplicar», atenuados y accesibles); la cabecera
  distingue el estado del archivo del de los borradores, en lugar de «sin cambios pendientes»; la alerta de Ito-Matsui
  ocupa el ancho completo.
- **Python.** `ogs-py` probaba la v0.6 con el test del stub `F3B-M-HB`: pasa a 108 pruebas reales con el wheel; la prueba
  de la nota sin refinamiento usa el modelo `berm_exit_below_bench.json`, porque V103 refina desde E16x.

### Known issues
- **V002 (Spencer, búsqueda no circular)** da 0,3864 frente a 0,414 publicado (−6,66 %, con una tolerancia de 2,12 %): la
  polilínea entra a una rama con tracción y E12e elige la raíz de menor F (E16u); cSlope evalúa esa misma polilínea en
  0,4152. Queda retenido, junto con **V009c** (aviso `interslice_shear_exceeds_strength`, E13k) y **V105a** (`aboveWater`).
- **Hoek-Brown en bajo confinamiento** da hasta −2,9 % frente a cSlope en círculo fijo (siempre conservador, por la
  envolvente completa); F3B-HB-02 con Spencer en círculo fijo queda «explicado (E16t)» porque cSlope no tiene raíz de λ.
- **La búsqueda no circular es un mínimo local**, sin pulido final, y su regla de concavidad (la de cSlope, por vértice)
  no acota la curvatura convexa acumulada (R15A-08a).
- **Los (c, tan φ) reportados de Hoek-Brown** son los de la última pasada y difieren ~0,1 % de la tangente en σ′n (R15A-07).
- **El FS que acompaña a un Bishop `invalid` no es válido** (precedente de la v0.4): lea el estado y el aviso.
- **El FS de equilibrio límite con agua embalsada no es invariante** frente a la formulación con γ′ (+0,15 %); el aviso de
  cortante entre dovelas puede seguir en el caso sumergido.
- **SHANSEP** no tiene `aboveWater`, tiene φ = 0 y no incluye el sismo en σ′v. Ni Hoek-Brown ni SHANSEP se combinan con la
  grieta automática ni con Ito-Matsui. Detalle en [`docs/limitaciones.md`](docs/limitaciones.md).
- **El contacto entre materiales se compara en estático** (sin `kv` ni refuerzos, E16ac): con un sismo vertical de ±0,5 o
  un anclaje activo casi vertical de 3000 kN/m, una polilínea exacta sobre el contacto puede quedar entre 0,7 % y 21 % sobre
  el lado débil; desplácela 1 mm hacia el lado débil ([límite](docs/limitaciones.md)).
- **Borradores en el editor web (anteriores a la 0.5.0):** tras «Nuevo» o «Abrir», un campo cuyo valor del documento es
  nulo (por ejemplo Sismo sin sismo) puede conservar el texto inválido anterior, aunque el bloqueo se levanta; en una fila
  de vértice con `x` válida e `y` inválida, confirmar `x` borra el texto de `y`; «Agregar punto» en las tablas de puntos
  descarta una fila inválida sin preguntar; Ctrl+Intro no calcula con el foco dentro de un campo de texto.

## [0.4.0] - 2026-11-27

Bloque de grieta de tracción, agua embalsada y pilotes de Ito-Matsui (F3G): formato v0.5. El contrato es `briefs/04_CONTRATOS_GRIETA_AGUA.md` (enmiendas E15a a E15n, con las correcciones de las revisiones R12 a R14); la evidencia,
`docs/fase3/exploracion/X18.md` a `X22.md` y `docs/fase3/PLAN_GRIETA_AGUA.md`. **Un modelo sin `tension_crack`, sin
`lateral_pressure` y sin agua sobre el terreno da la misma salida, byte a byte, que la v0.3.0** (salvo el número de versión del motor), con tres excepciones documentadas: los modelos cuya
piezométrica pasa sobre el terreno cambian de resultado a propósito, V019 con búsqueda, donde solo cambian dos
contadores (E15j-8), y los archivos imperiales con agua y sin `water.unit_weight` (E15l-6, E15m-6); véase «Changed». Las
correcciones de las revisiones R12 (E15l-1 a E15l-27), R13 (E15m-1 a E15m-15) y R14 (E15n-1 a E15n-4) están en «Fixed», y lo que cambian frente
al binario anterior, en «Changed».

### Added
- **Formato `.ogs.json` v0.5 (E15a).** El motor acepta 0.1 a 0.5. `analysis.tension_crack` exige `"version": "0.5"`; con
  una versión menor el error es `InvalidModel: tension_crack requiere version "0.5"`. La web guarda `"0.5"` solo si
  existe `analysis.tension_crack` o algún pilote lleva `lateral_pressure`.
- **Grieta de tracción (E15b, E15d).** `analysis.tension_crack: { depth, water_fill }`, un solo objeto y sin campo de
  posición.
  - `depth` es un número finito > 0 o la cadena `"auto"`; `water_fill` es la fracción llena de agua, en [0, 1],
    **obligatoria y sin valor por defecto** (0 seca, 1 llena).
  - Los errores son `InvalidModel` con la ruta `analysis.tension_crack.<campo>`.
  - La grieta **trunca cada superficie**: `x_c` es el primer punto, desde la entrada del lado de la cresta, donde
    `terreno − base ≥ profundidad` (barrido de 200 pasos y bisección); la masa del lado de la cresta se quita y no se
    conserva como carga, y las comprobaciones de los extremos del bloque se aplican a la masa truncada.
  - El agua de la grieta es `Pw = ½·γw·hw²`, con `hw = profundidad·water_fill`, horizontal, en el sentido del
    deslizamiento y a `hw/3` sobre la base de la grieta.
  - Con `"auto"`, la profundidad de Rankine `max(0, 2c/(γ·tan(45° − φ/2)) − q/γ)` en cada `x` (`2·Su/γ` en un material
    no drenado), con `q` la suma de las sobrecargas `udl` y del agua embalsada.
  - Una superficie fija que no alcanza la profundidad da `NoValidSurface: tension_crack_not_reached`; en una búsqueda,
    el candidato se **descarta**. Funciona con los cinco métodos y con círculo o polilínea.
- **Agua embalsada (E15c).** Sin campo en el formato: ver «Changed».
  - **Peso y empuje por dovela**, exactos (Gauss de 3 puntos), en Bishop, Spencer, Morgenstern-Price y Janbu, sin
    campos nuevos en `Slice` (E15h).
  - **Cara de presa** vertical con su empuje (E4).
  - **Regla de `ru`:** `u = ru·(W + V)/b`, con `W` el peso del suelo y `V` el del agua embalsada.
  - **Sin sismo** sobre el agua ni sobre la fuerza de la grieta.
  - **Profundidad bajo la tolerancia:** una altura de agua menor o igual que `1e-9·escala` se toma como 0, de modo que
    una piezométrica que toca el terreno no agrega términos.
- **Pilote con la presión del suelo de Ito-Matsui (E15i, ola G3).** Un `pile` lleva `lateral_pressure` en lugar de
  `force`, según Ito y Matsui (1975), ecuaciones 13, 14 y 23. Exige `"version": "0.5"`; con una versión menor el error es
  `InvalidModel: lateral_pressure requiere version "0.5"`.
  - **Formato.** `lateral_pressure: { model: "ito_matsui", diameter, location: "centroid" | "slip_surface" }`
    **reemplaza** a `force` (exactamente uno de los dos; `force` pasa a ser opcional) y `capacity: { shear, moment }` es
    opcional (al menos uno, > 0, solo con `lateral_pressure`). El pilote es vertical y `spacing > diameter`. Los errores
    llevan su ruta JSON, salvo `model` y `location` inválidos, que da el deserializador sin ruta. Va en el esquema 0.5.
  - **Presión por capas.** `p(z) = c·A1 + σ′v·A2`, con el material, `c` y φ de cada punto; con φ = 0 (o `undrained`), la
    ecuación 23 con la tensión **total**; `σ′v = σv − u` (con `ru`, `σ′v = σv − ru·σ_suelo`, E15l-12), sin las cargas de
    superficie. **Piso de φ = 0**
    (`A = max(A_cφ, A_φ=0)`), que no viene del artículo sino de cSlope y XSLOPE y solo actúa con S/D ≥ 8. El perfil se
    integra una vez por análisis (`PileProfiles`, paso de 0,05 m).
  - **Fuerza y salida.** Por pilote, `min(∫p dz, shear, moment/L_m)`, y por metro, dividida por `spacing`. Cada cruce del
    informe agrega `soil_force`, `governs` (`soil`, `shear` o `bending`) y `arm` (`L_m`); con `centroid` la fuerza actúa a
    `L_m` sobre el cruce y con `slip_surface`, en el cruce. Un pilote con `force` no trae esos campos (identidad).
  - **Aviso `ito_matsui_spacing_range`** con S/D fuera de 2 a 8 (la fórmula sobrestima con S/D pequeño y subestima con
    S/D grande; Ukritchon y Keawsawasvong, 2017). Va a la lista E6 y a `warnings.ts`.
  - **Medido.** Las 28 filas de X22 coinciden con cSlope a ≤ 0,06 % en los cinco métodos; V013b a V013e pasan.
    Tests en `crates/ogs-core/tests/f3g3_ito.rs`.
- **Informe.** Cada resultado cuya superficie se truncó lleva `tension_crack: { x, depth, water_force }`; se omite sin
  grieta.
- **Esquema (E15a, E15i-1).** `schema/ogs-0.5.schema.json`, que acepta 0.1 a 0.5 y rechaza lo mismo que el motor
  (incluidos `lateral_pressure` y `capacity` de un `pile`), con la tabla de acuerdo de `verification/tools/test_schema.py`
  extendida.
- **Web (E15g).** Panel «Análisis» con la grieta (casilla, profundidad numérica o «Automática» y fracción de agua; 1 por
  defecto al crearla), el agua embalsada como relleno azul bajo la piezométrica (token `--canvas-pond`, claro y oscuro),
  la grieta en `x_c` de la superficie crítica con su `Pw`, y la grieta y el agua embalsada en el informe PDF, el CSV, los
  Diagnósticos y la Ayuda.
- **Web: pilote de Ito-Matsui (E15i).**
  - La tarjeta del pilote elige el origen de la fuerza (dada o Ito-Matsui, que se propone con `"centroid"`) y pide
    diámetro, ubicación y capacidad, con la validación local con ruta y el aviso de rango de S/D.
  - La conversión de unidades convierte `diameter`, `shear` y `moment`; el FS no cambia.
  - La tabla de fuerzas, el informe PDF y el CSV agregan las columnas «Fuerza del suelo», «Gobierna» y «Brazo», con el
    ancho de columnas de la tabla del PDF corregido; Diagnósticos lleva a los campos de Ito-Matsui.
  - El aviso `ito_matsui_spacing_range`, la nota estructural y la Ayuda explican el límite de S/D de 2 a 8 y los
    supuestos (pilotes rígidos, deformación plana y dos superficies plásticas).
- **Verificación.**
  - **Bloque diferencial F3G:** los modelos D28 a D39 de `verification/differential/cases_f3g/` (embalse al pie y en una
    cara de presa, grieta seca, llena y automática, y sus combinaciones, con sismo y con arcilla no drenada), cada uno en
    búsqueda y en superficie fija, con Bishop y Spencer; una sonda de capacidades y `--require-f3g` en `run.py`.
    **D40 a D42** agregan los pilotes de Ito-Matsui (φ = 0, c-φ con tope de corte y bajo el agua; la sonda de
    `lateral_pressure` usa X22-V013c). Con el motor de E15i, los 12 checks nuevos pasan.
  - **Importador y conversor de cSlope:** convierte la grieta y el agua embalsada y promueve 31 casos con 80 checks a
    `verification/cases/`. `to_cslope.py` convierte un `pile` con `lateral_pressure` (`diameter`, sin `force`,
    `location` y `capacity` a `shearCapacity` y `momentCapacity`); los 728 documentos de cSlope del corpus **no cambian**
    sin él (728 huellas iguales). El lote **F3I** (V013b a V013e, Ito-Matsui) se promueve con `--promote-f3i`.
    **Total: 151 casos y 327 checks; aceptación 327/327 y cSlope 326/327** (V027 no converge). Quedan 6 checks retenidos
    en `verification/pending/F3G/HOLD.json`, con su causa (E15j-6): V085 ×4 (la búsqueda de ogs halla un círculo más
    crítico que el del oráculo) y V009a y V009b (aviso `interslice_shear_exceeds_strength`).
  - **Identidad:** `verification/tools/identity_vs_baseline.py` gana `--normalize-version` y `--include-reinforced`, y
    separa y nombra los modelos con agua sobre el terreno. Además lee las **excepciones declaradas** de
    `verification/tools/identity_exceptions.json` (`{modelo, variante, campos, motivo, enmienda}`): V019 en `search` y
    `search@0.4` por E15j-8 se informa aparte («EXCEPCIÓN V019 [search]: E15j-8») y no cuenta, y cualquier otra
    diferencia sigue contando. Medido contra la v0.3.0: 0 diferencias, 2 excepciones y 18 modelos con agua listados.
  - **Tests del motor:** `f3g_types`, `f3g1a_water`, `f3g1b_crack` y `f3g_rows` (55 filas de X21 migradas al formato
    final), y `f3g3_ito` (28 filas de X22, S06 en Bishop, neutralidad, espejo, equilibrio global y monotonía de la fuerza
    con S/D).
- **Documentación.** `docs/formato-ogs-json.md` con las secciones «Agua embalsada», «Grieta de tracción (v0.5)» y
  «Pilotes con presión de suelo de Ito-Matsui (v0.5)», con ejemplos y fragmentos ejecutables (el de Ito-Matsui, medido con
  el binario: el pilote con `centroid` y con `slip_surface`, con `capacity` de corte y de momento, con S/D fuera de
  rango y seis rechazos); `docs/tools/validar_ejemplos.py` valida contra el esquema 0.5 y gana `grieta=` y `cruce=`;
  `docs/limitaciones.md` con los límites nuevos (entre ellos los de Ito-Matsui) y `docs/desarrollo.md` con `water.rs`,
  `crack.rs`, `PileProfiles`, D40 a D42 y la herramienta de identidad. La D30 fija pasa de −15,4 % a +0,13 % respecto de
  cSlope por E15j-8 (el bloque D28 a D39 pasa de 44 a 46 OK de 48 y, con D40 a D42, es 58 de 60).

### Changed
- **El agua embalsada se incluye automáticamente, en todas las versiones del formato (D1, E15c).** Con la piezométrica
  sobre el terreno, el motor contaba la presión de poros con la carga completa pero ni el peso ni el empuje del agua, y
  el FS salía muy bajo. Ahora el agua entre la piezométrica y el terreno carga las dovelas, como en Slide2, SLOPE/W y
  cSlope. **Es la excepción documentada a la identidad con la v0.3.0:** los modelos que llevaban el aviso
  `water_above_ground` cambian de resultado, y los demás no. Ejemplo medido, V047a con 2 m de agua al pie, Bishop:
  superficie fija 0,848 → 0,939 (cSlope 0,939) y búsqueda 0,132 → 0,924 (cSlope 0,924). Con la v0.3.0, ese modelo traía
  además la nota `negative_effective_normal`; ahora ya no. Quien tenga resultados guardados de un modelo con agua sobre el
  terreno debe calcularlos de nuevo.
- **`water_above_ground` es una nota informativa** y su texto pasa a «La piezométrica queda sobre el terreno: el agua
  embalsada se incluye con su peso y su empuje horizontal (sin sismo).». El código no cambia de nombre.
- **El FS de un material con `ru` y agua sobre el terreno cambia** por el mismo motivo (el agua embalsada carga la
  dovela); la capacidad de `interface` no cambia (E14o-4). En `f3r11a_cruces`, con la piezométrica 7 m sobre el banco, el
  FS pasa de 1,1249 sin la línea a 2,2866 con ella, y la aserción del test pasa de igualdad a `a > b`.
- **Contacto de aire capilar (E15j-8, segunda excepción a la identidad con la v0.3.0).** Un tramo de aire interior, con
  suelo a ambos lados, de ancho total ≤ 1e-6 del ancho del modelo y con el arco a 10·tol o menos sobre el terreno, se
  trata como contacto y no parte la masa (D30: el círculo de cSlope pasa 3,6e-7 m sobre el pie de un corte vertical).
  Frente a la v0.3.0 solo cambian en V019 (variantes `search` y `search@0.4`) los contadores `search.evaluated`
  (10040 → 10088) y `search.valid` (7451 → 7499) de Janbu simplificado; el FS, la superficie, los avisos y las dovelas
  son idénticos. Está declarada en `verification/tools/identity_exceptions.json` y en
  [`docs/limitaciones.md`](docs/limitaciones.md#segunda-excepción-a-la-identidad-con-la-v030-contacto-de-aire-capilar-v019-e15j-8).
- **γw por defecto en imperial (E15l-6, E15m-6, tercera excepción a la identidad con la v0.3.0).** Un archivo
  `imperial` que usa agua (piezométrica, aunque quede bajo el terreno, agua embalsada o agua en la grieta) y no indica
  `water.unit_weight` toma γw ≈ 62,45 pcf (9,81 kN/m³ convertido), no 9,81 «pcf» como la v0.3.0, y **cambia de FS**. El
  motor agrega entonces a `warnings` el aviso informativo `water_unit_weight_default`, una vez por método y análisis; en
  SI no cambia nada ni se emite. Ejemplo medido, ACADS 1(a) en pies con una piezométrica bajo el terreno y el círculo de
  V047a: Bishop 0,9300 con la v0.3.0 y 0,6339 ahora (Spencer 0,9294 y 0,6359), y 1,71248 → 1,69865 con una grieta de 2 m
  con agua y sin `water`. Escribir `water.unit_weight` fija el valor. No hay ningún modelo así en el corpus: los 15
  imperiales de `verification/cases/` no usan agua. Véase
  [`docs/limitaciones.md`](docs/limitaciones.md#tercera-excepción-a-la-identidad-con-la-v030-γw-por-defecto-en-imperial-e15l-6-e15m-6).
- **Web: rótulos de una grieta poco profunda.** Con una grieta automática de pocos píxeles (0,43 m en V047a con la
  piezométrica en y = 27), el rótulo «Grieta d = …» caía sobre la línea del terreno y el de Pw se le acercaba; ahora los
  dos se apilan sobre el terreno, del lado de la masa, sin tocarlo ni superponerse (lienzo, Casos y PDF).
- **Web: la nota de normal efectiva negativa con grieta.** Si el resultado trae `tension_crack`, el texto ya no sugiere
  «considere una grieta de tracción»: dice «a pesar de la grieta de tracción del análisis; revise su profundidad» (en
  `negative_effective_normal_major`, «revise la presión de poros y la profundidad de la grieta»).
- **γsat verificado (E15k).** V082a, V082b, V088 y V089 usan un `unit_weight_sat` distinto de `unit_weight` bajo la
  piezométrica, cumplen sus checks y cSlope los reproduce. La web **retira** el aviso `editor.gamma_sat_unverified` y la
  Ayuda, el README y `docs/limitaciones.md` ya no dicen que γsat no está verificado; la nota
  `editor.gamma_sat_lt_gamma` se mantiene.
- **Web: títulos de los casos.** Los 31 casos promovidos en F3G tienen título en español en el selector «Casos» (el
  índice acepta la versión 0.5 y los ids con guion).
- **Web: la polilínea inicial alcanza una grieta fija.** Con una grieta de profundidad fija, la polilínea que la web
  propone al pasar a superficie fija baja al menos a 1,05 veces esa profundidad bajo el terreno (sin pasar de 9/10 del
  espesor local), para que la grieta tenga masa y el motor no dé `tension_crack_not_reached`. Si el espesor del modelo no
  lo permite, queda la propuesta de siempre. El barrido de los casos con grieta fija declara el sentido de deslizamiento
  de V024 y V088, que traen `slope.direction: "auto"`.
- **Punto de lectura de la profundidad automática (E15j-1, G6).** El motor lee `c`, `φ` y `γ` a `2e-5·escala` bajo el
  terreno, y no a `1e-3·escala` como decía G6: cSlope usa 1e-3 unidades absolutas y con `1e-3·escala` la profundidad bajo
  un gradiente de `Su` se desvía 0,6 % en X21-A04. En los modelos del corpus las dos reglas dan el mismo material; solo
  difieren con un gradiente de `Su` o una capa de menos de eso en la coronación. No es un problema abierto.
- **La CLI** indica el formato v0.1 a v0.5 en su ayuda. Los tests de otras olas que usaban `"0.5"` como versión
  desconocida pasan a `"0.6"`.
- Los modelos sin grieta y sin agua sobre el terreno no cambian: la identidad byte a byte con la v0.3.0 es un gate de
  cada ola.
- **Cambios de resultados con las correcciones R12, frente al binario anterior a R12.** Son a propósito y están medidos:
  - **D30** emite ahora el aviso `water_above_ground` (E15l-5); el FS no cambia.
  - **V013c, V013d y V013e** y **D40 a D42** (Ito-Matsui, E15l-13): el brazo del primer tramo del perfil cambia y el FS
    varía 1,5e-6 en términos relativos o menos (V013c a V013e, entre −1,5e-7 y −6,4e-7; D40 a D42, hasta −1,5e-6). D40 y
    D42 eligen un círculo crítico vecino. El brazo del ejemplo de `docs/formato-ogs-json.md` pasa de 1,2237 a 1,2238 m.
  - **`search.valid`** de algunos casos con grieta (V048, V073, V086b-auto, V086d, D33, D36, D38 y D39): de +1 a +4
    candidatos válidos más, sin cambio del FS ni de la superficie crítica. Lo produce E15l-3: con los vértices en el
    barrido, algunos candidatos que antes no encontraban la grieta ahora la alcanzan (`docs/fase3/r12/NOTAS_integracion.md`).
  - Los modelos sin grieta de tracción, sin `lateral_pressure` y sin agua sobre el terreno siguen dando la misma salida,
    byte a byte, que el binario anterior a R12 (150 modelos, 0 diferencias).

### Fixed
Correcciones de la revisión R12 (enmiendas E15l-1 a E15l-27 del contrato, `briefs/04_CONTRATOS_GRIETA_AGUA.md` §F5.12).

**Motor**
- **La grieta automática en el borde del modelo ya no se anula (E15l-1).** Con el deslizamiento de derecha a izquierda y
  la grieta en el extremo del modelo (`a01_rtl.json`), la grieta quedaba en `depth` 0 y el FS no era el espejo del caso de
  izquierda a derecha (Bishop 1,726963 frente a 1,692572). Ahora los dos dan 1,692572, con `depth` 2,6483 y `Pw` 34,402.
- **Profundidad sobre una discontinuidad de `d(x)` (E15l-2, revisada por E15m-15).** Con la profundidad automática y una
  `udl` o un cambio lateral de material, E15l-2 informaba la cara cortada, `terreno(x) − base(x)`, como profundidad
  (`a04_udl.json`: `depth` 1,7827, Bishop 1,095348); E15m-15 la revisó tras compararla con cSlope (véase «Correcciones de
  la revisión R13»). Lo que se mantiene: sin cara, no hay grieta y no se trunca la masa.
- **El barrido de la grieta incluye los vértices (E15l-3)** de la superficie, del terreno, de las regiones y los bordes de
  una `udl`, para no saltar una cara estrecha. **Tolerancias de la grieta (E15l-8):** el agua usa terreno + tolerancia y
  `Pw` va a la última dovela con peso.
- **El empuje del paramento vertical va en una sola dovela (E15l-4).** Una carga lineal a 5e-6 del paramento
  duplicaba el empuje: en la presa de B-03, `Σ h_force` pasaba de −120,743 a −241,486 y Bishop daba 1,6642; ahora queda
  en −120,743 y 1,2637.
- **`water_above_ground` también con términos embalsados (E15l-5),** incluido el empuje de un paramento vertical: sin la
  nota, una presa con muro cambiaba su FS un 26 % frente a la v0.3.0 (Bishop 1,0010 → 1,2629).
- **γw por defecto según las unidades (E15l-6).** Sin `water.unit_weight`, vale 9,81 kN/m³ en SI y ≈ 62,45 pcf en
  imperial (62,449). Antes, una grieta de 2 m con agua y sin `water`, convertida a imperial, usaba 9,81 «pcf»: `Pw` 211,19
  en lugar de 1344,40 lbf/ft y Bishop 1,71248 en lugar de 1,69865 (el valor de SI).
- **Mensaje de una búsqueda sin superficies por la grieta (E15l-7):** termina en `(E evaluadas, 0 válidas; K no alcanzan
  la grieta de tracción, tension_crack_not_reached)`; por ejemplo, `(7400 evaluadas, 0 válidas; 7397 no alcanzan …)`.
  Con K = 0 el mensaje es el de siempre.
- **Filas con agua embalsada activa en la superficie (E15l-10):** tres filas nuevas en `crates/ogs-core/tests/data/f3g/r12/`
  (V042 aguas arriba, con y sin `kh`, y V061 por el lado derecho) contra cSlope 0.1.0, con 0,081 % de peor diferencia.
- **Un perfil de Ito-Matsui no finito da `InvalidModel` (E15l-11).** Con φ = 35°, S/D = 1,00125 y `capacity`, Bishop daba
  `invalid` y los otros tres métodos `not_converged`; ahora el análisis termina antes de resolver con
  `InvalidModel: reinforcements[0].lateral_pressure: la presión de Ito-Matsui no es finita …`.
- **`ru` en `σ′v` del pilote de Ito-Matsui (E15l-12):** `σ′v = σv − ru·σ_suelo`, sin restar la `u` de la piezométrica.
  La fila X22-S16 (`ru` = 0,2 y piezométrica) pasa de −1,97 % a 0,026 % o menos del oráculo en los cinco métodos (0,0185 %
  en Bishop) y la fuerza por metro, de −10,2 % a 0,041 %.
- **Brazo positivo en el primer tramo del perfil (E15l-13).** Con la cabeza del pilote a 0,0124 m sobre el cruce (A-07),
  `arm` era 0 y gobernaba `soil` (0,903); ahora `arm` es 0,006182 m y gobierna `bending` (0,674).

**Web**
- **γw al convertir unidades y en el informe (E15l-14):** la web escribe `water.unit_weight` de forma explícita al
  convertir.
- **Rótulo «Sin grieta (z = 0)» (E15l-15)** en el lienzo.
- **`tension_crack_not_reached` en español y con navegación (E15l-16).**
- **El motor simulado rechaza el agua embalsada (E15l-17).**
- **Textos de `ru` y del agua (E15l-18):** Ayuda, Diagnósticos, panel «Agua» y resumen cuentan lo mismo, incluida el
  agua de la grieta.
- **Nota `io.pond_changed` al abrir (E15l-19)** un modelo con la piezométrica sobre el terreno, de cualquier versión.
- **Nota de grieta fija con búsqueda (E15l-20):** `editor.crack_fixed_search`.
- **El pilote de Ito-Matsui sigue vertical (E15l-21)** al arrastrarlo y con el teclado.
- **Flecha del pilote de Ito-Matsui en (x, y + arm) (E15l-22)** con `centroid`, en el lienzo, en «Casos» y en el PDF, con
  información emergente que muestra la fuerza del suelo, qué gobierna y el brazo.
- **Validación de la forma de `tension_crack` y `role="status"` del aviso de S/D (E15l-23).**

**Python y CLI**
- **Docstring, README y `test_v05.py` de `ogs-py` (E15l-24):** reglas y cifras de R12; las reproducciones de
  `docs/fase3/r12/repro/` (E15l-1 y E15l-11; la de E15l-2 pasó a E15m-15) corren sin marcas `xfail`.
- **`USAGE` de la CLI (E15l-25)** con `tension_crack`, `lateral_pressure`, `capacity` y el agua embalsada.

**Documentación**
- **Cifras vigentes y reglas de R12 (E15l-26)** en `docs/limitaciones.md`, `docs/formato-ogs-json.md`,
  `docs/verificacion.md` y el README; el ejemplo `grieta-udl-automatica` y un fragmento de S/D = 1,000125 son ejecutables
  (`docs/tools/validar_ejemplos.py`: 9 ejemplos y 66 fragmentos).
- **Polilínea totalmente sumergida (E15l-27):** se rechaza con `no_driving` en Spencer, Morgenstern-Price y los dos Janbu,
  del lado seguro; el motor no cambia.
- **Hueco entre dovelas vecinas (E15l-9):** de menos de 1e-6 veces el ancho del modelo tras el contacto de aire capilar.
- **Qué casos ejercitan de verdad el agua embalsada:** 8 sí (V023, V041a, V041b, V070, V087, V089, V091 y V092), V024
  marginal y 5 no (V038, V038b, V042, V058 y V061).

Correcciones de la revisión R13 (enmiendas E15m-1 a E15m-15 del contrato, §F5.13 de `briefs/04_CONTRATOS_GRIETA_AGUA.md`).
Medidas con `target/release/ogs`; los modelos sin grieta, sin `lateral_pressure` y sin agua sobre el terreno siguen
iguales, byte a byte.

**Motor**
- **La grieta fija no se reescribe (E15m-1, enmienda de E15l-2).** Con `depth` numérica, la profundidad informada y el
  agua son siempre las del usuario, como antes de R12 y como cSlope. En el escalón de `a03_escalon_fija.json` (grieta de
  2 m): `depth` 2, `Pw` 19,62 y Bishop 1,882066 (cSlope 1,882138); con E15l-2 daba `depth` 4,9707, `Pw` 121,19 y 1,751144.
- **La grieta sobre una discontinuidad vuelve a la convención de cSlope (E15m-15, revisa E15l-2).** La profundidad y el
  agua salen de `d(x_c)` en el `x_c` de la bisección, no de la cara cortada. E15l-2 se había adoptado sin compararla con el
  oráculo, y la comparación con `to_cslope` la contradijo (−0,63 % en `a04_udl`, −6,0 % en el escalón con `"auto"`). El
  informe agrega `tension_crack.face_height`, la altura de la cara cortada `terreno(x_c) − base(x_c)`, solo cuando
  difiere de `depth`; en una grieta normal la salida no cambia. Medido: `a04_udl` con Bishop 1,102248 (`depth` 0,
  `water_force` 0, `face_height` 1,78272; cSlope 1,102311), `a03_escalon_auto` con 1,862343 (`depth` 2,61614,
  `water_force` 33,57, `face_height` 4,97068; cSlope 1,862416) y `a03_escalon_fija` con 1,882066 (`depth` 2,
  `water_force` 19,62, `face_height` 4,97068).
- **El paramento vertical no se pierde por redondeo (E15m-2).** Una polilínea que nace 1e-12 dentro del paramento llevaba
  Spencer de 2,66591 a 3,49275 (+31 %, del lado inseguro); ahora `dx` = 1e-12 y `dx` = 0 dan 2,66591 y el mismo empuje.
- **El empuje del paramento va solo a una dovela con el centro del lado alto (E15m-3)**, y la masa del lado bajo no lo
  absorbe.
- **El barrido de la grieta incluye los vértices de la piezométrica (E15m-4)**, para no saltar un pico estrecho de agua.
- **El atajo de la entrada se evalúa hacia dentro (E15m-5):** `x_entry + s·tol`; una `udl` que solo toca la entrada desde
  fuera ya no anula la grieta automática.
- **Aviso `water_unit_weight_default` (E15m-6).** Un archivo imperial con agua y sin `water.unit_weight` lleva el aviso
  informativo, que entra en el catálogo de avisos informativos. Es la tercera excepción a la identidad con la v0.3.0
  (véase «Changed»).
- **El brazo de Ito-Matsui sin producto intermedio (E15m-7).** Un brazo o una fuerza no finitos son el `InvalidModel` de
  E15l-11, nunca `arm: null` ni `no_capacity`. En `a01_arm_null.json`, con `capacity.shear`, el brazo es finito (1,1486 m)
  y gobierna `shear`.
- **`pressure_step` usa `is_imperial_units` (E15m-8).** `units: "imp"` da lo mismo que `"imperial"`.

**Web**
- **γw omitido en imperial es una nota, no un bloqueo (E15m-9).** `editor.water_unit_weight_default` reemplaza el error
  `editor.water_unit_weight`, que afirmaba un valor de 9,81 que el motor ya no usa; se mantiene el error con γw en
  unidades equivocadas. Corrigen sus textos la ayuda y `warnings.ts`.
- **Información emergente alcanzable (E15m-10):** las flechas de Ito-Matsui, la grieta y los refuerzos tienen un área de
  acierto, y `r12_ito_lienzo.mjs` lo prueba con `elementFromPoint`.
- **`pnpm test` sin `OGS_BIN` da 0 fallas (E15m-11):** `pdf.engine.test.ts` llama al motor solo en `beforeAll`.
- **«Sin grieta (z = 0)» en Casos (E15m-12),** como en el editor.
- **`face_height` (E15m-15):** el tipo y la validación del informe lo aceptan como opcional; la tabla, el PDF, el CSV, el
  resumen, el lienzo y Casos muestran la cara cortada, y con `depth` 0 y `face_height` > 0 el rótulo dice «Corte de la
  masa … sin grieta de tracción» en lugar de «Sin grieta».

**Python y documentación**
- **`test_v05.py` (E15m-13):** la neutralidad compara `"0.3"` con `"0.5"`, `grieta-udl-automatica` entra en `V05_BASES` y se
  suman las filas `f3g/r12` y `f3g3/expected_r12.json` y las pruebas de E15l-5, -6, -7 y E15m-6. Con E15m-15 se quitan
  todas las marcas `xfail` (E15m-1, -2, -6 y -7) y se agregan las pruebas de `a04_udl`, del escalón y de `face_height`:
  173 pruebas en `test_v05.py` y 264 en `crates/ogs-py/tests` (262 con el wheel de producción y 2 omitidas de pánico, que
  pasan con `--features test-hooks`), 0 `xfail`.
- **Documentación (E15m-14, E15m-15):** ramas efímeras fuera de `docs/verificacion.md`, `γsat` con `ru` en
  `docs/limitaciones.md`, resumen de `CITATION.cff` y ejemplo de `version()` de `ogs-py`; la tercera excepción a la
  identidad en el README, el formato, `docs/limitaciones.md` y `ogs-py`; y la regla de E15m-15 y `face_height` en
  `docs/formato-ogs-json.md` (el ejemplo `grieta-udl-automatica` da Bishop 1,1022 y Spencer 1,1009), `docs/limitaciones.md`,
  `docs/verificacion.md` y `ogs-py`.

Correcciones de la revisión R14 (enmiendas E15n-1 a E15n-4 del contrato, §F5.14 de `briefs/04_CONTRATOS_GRIETA_AGUA.md`).
Medidas con `target/release/ogs`; los modelos sin grieta, sin `lateral_pressure` y sin agua sobre el terreno siguen
iguales, byte a byte.

**Motor**
- **Grieta automática en un escalón del terreno (E15n-1).** El terreno, `d(x_c)`, la cara y el corte se
  evalúan del lado de la masa. El espejo de derecha a izquierda de `a03_escalon_auto` da lo mismo que el de izquierda a
  derecha: Bishop 1,862343 y `depth` 2,616; antes daba 1,911188 con `depth` 0 (cSlope 1,862416). En un escalón
  descendente, `face_height` es la cara real (0,30 m en lugar de 2,30 m), y el escalón descendente puro de izquierda a
  derecha pasa de 2,531715 a 2,460159 (cSlope 2,460248).
- **Ito-Matsui: un `soil_force` no finito da el error de E15l-11 (E15n-2).** Con `spacing` < 1 y `capacity`, el informe
  ya no sale con `"soil_force": null`: el análisis termina con `InvalidModel`.
- **`water_unit_weight_default` también con una polilínea inválida (E15n-3),** con criterio declarativo: archivo
  imperial, con agua y sin `water.unit_weight`.

**Web**
- **Área de acierto del rótulo de la grieta (E15n-4).** El rótulo «Sin grieta (z = 0)» o «Corte de la masa (cara de …)
  sin grieta de tracción» tiene un área de acierto con su título completo, y la figura del PDF dibuja el mismo rótulo.

### Known issues
- **La grieta es solo vertical, una por superficie, sin zona ni ángulo**, y no tiene tope de profundidad por la altura
  del talud (G8). Una superficie que no la alcanza **se descarta** (G9): con una grieta profunda quedan pocas
  superficies válidas. El FS no es monótono con la profundidad de una grieta seca.
- **`ru` con agua embalsada no se puede verificar contra el oráculo** (E15c): cSlope suma `ru·W/b` a la presión de la
  línea de agua, y OpenGeoSlide usa la regla de Slide2, `ru·(W + V)/b`, entre 1,0 % y 4,5 % más conservadora.
- **Sin desembalse rápido**, y el sismo pseudoestático **no actúa sobre el agua** ni sobre la fuerza de la grieta.
- **Círculos tangentes al fondo (V096a, V086b; E15f).** El círculo de cSlope pasa por debajo del fondo por 8,35e-7 y
  9,76e-7, 12 y 33 veces la tolerancia del motor: es el límite de la búsqueda de cSlope (1e-6), no un redondeo como en
  V065. No se relaja la tolerancia: con el fondo 1e-6 más bajo el círculo pasa y queda a 0,022 % y 0,016 % del oráculo.
  Los checks de V096a y V086b pasan, porque la búsqueda de ogs halla su propio círculo válido (E15j-7); la fila
  diferencial D39 fija se informa como «explicado (E15f, E15j-7)».
- **Seis checks retenidos** (E15j-6: V085 ×4, V009a y V009b) en `verification/pending/F3G/HOLD.json`, cada uno con su
  causa medida. V085: la búsqueda de ogs halla un círculo más crítico que el del oráculo (cSlope evalúa ese círculo igual,
  a 0,002 %). V009a y V009b (Spencer): el FS está en tolerancia, pero el motor emite `interslice_shear_exceeds_strength`
  con `r_v` de 3,12 y 5,57, sobre el umbral de 3. X18 había dado por fuera de tolerancia V009b, V087 y V092 por leerla
  como absoluta; la del corpus es relativa (E15j-5) y V087 y V092 se promovieron. No se relaja ninguna tolerancia.
- **Diferencial v0.5 (D28 a D42): 58 OK de 60.** D39 fija (×2) está explicada por E15f y E15j-7 (el círculo de cSlope
  pasa 9,2e-7 bajo el fondo; el informe la marca «explicado», sin relajar la tolerancia). No quedan fallas abiertas: D30
  fija se corrigió con E15j-8 (véase «Changed») y D40 a D42 pasan con el motor de Ito-Matsui.
- **Polilínea totalmente sumergida y hueco entre dovelas (R12).** Spencer, Morgenstern-Price y los dos Janbu rechazan con
  `no_driving` una polilínea fija bajo el agua embalsada (E15l-27; cSlope tampoco la resuelve, y el mismo talud con
  `γ′ = γ − γw` sí converge), y tras el contacto de aire capilar puede quedar un hueco de menos de 1e-6 veces el ancho
  del modelo entre dos dovelas vecinas (E15l-9). Ninguno cambia el cálculo.
- **Pilotes de Ito-Matsui (E15i): una estimación, no un diseño.** La fórmula es para pilotes rígidos y verticales, en
  deformación plana, y vale con S/D de 2 a 8: fuera de ese rango el motor avisa (`ito_matsui_spacing_range`) y la fuerza
  se sobrestima con S/D pequeño y se subestima con S/D grande (Ukritchon y Keawsawasvong, 2017). El piso de φ = 0 no
  viene del artículo, y las cargas de superficie no entran en `σv`. Con `ru`, `σ′v = σv − ru·σ_suelo` (E15l-12, la regla
  de cSlope, sin restar la `u` de la piezométrica) convive con la de las dovelas, `ru·(W + V)/b`. La `capacity` es un
  tope, no una comprobación del perfil.

## [0.3.0] - 2026-11-26

Bloque de refuerzos (F3R): formato v0.4 con anclajes, clavos, geosintéticos, pilotes y tablestacas, activos y pasivos.
El contrato es `briefs/03_CONTRATOS_REFUERZOS.md` (enmiendas E14a a E14o); la evidencia, `docs/fase3/exploracion/X14.md`
a `X17.md` y `docs/fase3/PLAN_REFUERZOS.md`. **Un modelo con `reinforcements` ausente o vacío da la misma salida, byte a
byte, que la v0.2.0**, con una sola excepción: un círculo con la tangente vertical sobre el terreno que la v0.2.0
rechazaba por redondeo (V065), y que ahora se analiza (E14o-11, véase «Fixed»).

> **Límite declarado (E14h).** Con un `pile` o una `sheet_pile`, OpenGeoSlide calcula la estabilidad **global** con el
> elemento incluido como una fuerza dada. **No** calcula el empuje sobre el elemento, el empotramiento, el momento
> flector, la deflexión ni las comprobaciones internas o externas de un muro. Véase
> [`docs/limitaciones.md`](docs/limitaciones.md#pilotes-y-tablestacas-el-límite-estructural-f48).

### Added
- **Formato `.ogs.json` v0.4 (E14a).** El motor acepta 0.1, 0.2, 0.3 y 0.4. `reinforcements` no vacío exige
  `"version": "0.4"`; con una versión menor el error es `InvalidModel: reinforcements requiere version "0.4"`. Tipos:
  `anchor`, `nail`, `geosynthetic`, `pile` y `sheet_pile`. Una tablestaca anclada es una `sheet_pile` más un `anchor`.
  Se posponen, con limitación documentada: Ito-Matsui, el campo de pretensado (es un `anchor` activo con la carga de
  bloqueo como capacidad), la cizalla y la compresión de los clavos, el arrancamiento que depende del material, los
  clavos lanzados, los anclajes helicoidales, la presión de fluido equivalente y el soporte definido por el usuario.
- **Esquema (E14b).** `reinforcements` va al nivel raíz, después de `loads`; cada variante rechaza campos desconocidos.
  JSON Schema `schema/ogs-0.4.schema.json`, que acepta 0.1 a 0.4 y rechaza lo mismo que el motor, con la tabla de
  acuerdo de `verification/tools/test_schema.py` extendida. Los errores de campo son `InvalidModel` con la ruta JSON
  (por ejemplo `reinforcements[2].pullout.coverage`). `application` y `direction` son obligatorios.
- **Capacidad `T(s)` (E14c, E14m-2).** `T(s) = max(0, min(Tmax, T1 + ∫₀ˢ r, T2 + ∫ₛᴸ r))/spacing`, con tres modelos de
  `pullout`: `bond` (con `bonded_length` opcional y solo dentro del suelo), `interface` (`r = 2·(a + σ′v·tan δ)·Rc`, con
  `σ′v` sin sobrecargas, integrada **exactamente** con cortes en el terreno y en los contactos) y `development` (rampa
  lineal desde cada extremo, con `T1` y `T2` sumados a la rampa). Sin `pullout`, `T(s) = Tmax/spacing`.
- **Cruces, nodos y dovela (E14d).** Cada cruce del refuerzo con la superficie ya ajustada (círculo o polilínea) recibe
  su propia fuerza, con nodos `x_c ± 1e-6·ancho` como una carga lineal, para todos los candidatos de una búsqueda. Un
  cruce fuera de la masa no aplica fuerza y da la nota `reinforcement_outside_mass`.
- **Dirección, sentido y compresión (E14e, E14m-1).** Direcciones `axial`, `tangent` y `bisector` para los elementos de
  tracción, y `angle`, `tangent` y `perpendicular` para pilotes y tablestacas, siempre opuestas al movimiento. Un
  elemento **pasivo** con `along ≥ cos 88°` no aporta (Clouterre, 1991; FHWA GEC 7): estado `compression_ignored` y nota
  `reinforcement_compression_ignored`. Un elemento **activo** se aplica siempre, con su fuerza completa.
- **Fuerza activa y pasiva (E14f, E14g).** La activa es una carga externa conocida y no se divide por F (Duncan y
  Wright, método A); la pasiva se moviliza y entra con 1/F en todos los términos (método B), en Bishop, Spencer,
  Morgenstern-Price y Janbu. El sismo no actúa sobre las fuerzas de los refuerzos.
- **Pilotes y tablestacas (E14h, E14m-3).** `force` constante en el cruce (`force/spacing` en `pile` y `force` por metro
  en `sheet_pile`), sin regla de compresión. El motor emite siempre la nota `structural_checks_not_covered` con un
  `pile` o una `sheet_pile`. El campo `location` **no existe** en v0.4: con fuerza constante no cambia ningún número.
- **Informe (E14i, E14m-4).** `reinforcement_forces` por método convergido y sobre la superficie final: `id`, `crossing`,
  `x`, `y`, `station`, `available`, `fx`, `fy` (en coordenadas del modelo), `application` y `status`, que toma uno de
  cuatro valores: `applied`, `outside_mass`, `compression_ignored` o `no_capacity` (capacidad nula en el cruce, por
  ejemplo el tramo libre de un tirante sin `end1_capacity`; no emite nota). Códigos nuevos, informativos, en la lista
  E6 y en `apps/web/src/engine/warnings.ts`: `reinforcement_outside_mass`, `reinforcement_compression_ignored`,
  `structural_checks_not_covered` y, desde E14o-8, `reinforcement_active_compression`.
- **Métodos y superficies (E14j, E14m-6).** Los refuerzos funcionan con los cinco métodos y con círculo o polilínea
  (Bishop sigue limitado a círculos). Las fuerzas de los refuerzos entran en `t_i` y `H_i` de la escala motriz de E13l-3.
- **Web (E14k).** Panel «Refuerzos» (Anclaje, Clavo, Geosintético, Pilote y Tablestaca) con la validación local de F4.2;
  lienzo con un segmento y dos tiradores por refuerzo (la tablestaca con la x fija), herramienta «Dibujar refuerzo» de
  dos clics (atajo E), arrastre del centro en un solo paso de historial, puntero, teclado y táctil; flechas de fuerza en
  el resultado; tabla de fuerzas y texto de límite en Casos, informe PDF y CSV; conversión de unidades de los refuerzos;
  lectura y guardado sin pérdida y versión mínima 0.4 solo con refuerzos; Ayuda con el glosario de refuerzos. El motor
  simulado rechaza los modelos 0.4.
- **Verificación (E14l, E14m-5).** Los casos de los lotes R1 a R4 del corpus de cSlope (anclajes, clavos,
  geosintéticos y pilotes de fuerza constante) importados a `verification/pending/F3R/`; la batería diferencial con cada
  tipo; las siete filas de F4.13, 16 filas de dirección inclinada y nueve de capacidad de X17 contra el oráculo, con
  tolerancia de 0,1 % (0,25 % en las dos filas de `interface` donde gobierna la integral, por la discretización del
  oráculo); el equilibrio global independiente con las fuerzas de los refuerzos; el espejo x → −x; y las identidades de la
  tablestaca (capacidad cero, elemento que la superficie no cruza y FS monótono con la fuerza).
- **Python (`ogs-py`).** Docstring y README con el formato v0.4, y `tests/test_v04.py` con las 32 filas de X17 contra el
  oráculo, los cinco tipos, los tres modelos de `pullout`, los estados de `reinforcement_forces`, las tres notas
  nuevas, las identidades de la tablestaca, la compuerta de versión y los rechazos con su ruta JSON.
- **CLI.** El texto de uso (`USAGE`) de `ogs` indica el formato v0.1 a v0.4, `"version": "0.4"` con refuerzos,
  `reinforcement_forces` y el límite de pilotes y tablestacas.
- **Documentación.** `docs/formato-ogs-json.md` con el formato v0.4 completo: los cinco tipos, los tres modelos de
  `pullout`, activo y pasivo, la dirección y la regla de compresión, una tablestaca anclada como ejemplo completo, los
  estados de `reinforcement_forces` y los rechazos; `docs/tools/validar_ejemplos.py` valida contra
  `schema/ogs-0.4.schema.json` y comprueba `fos=`, `fuerzas=` y `avisos=` en ejemplos y fragmentos.

### Changed
- `docs/limitaciones.md`: la sección «Lo que queda para el bloque de refuerzos» pasa a «Refuerzos (formato v0.4): qué
  hace y qué no», con el límite estructural de pilotes y tablestacas, lo que se pospone, el tramo libre sin placa
  (`no_capacity`), el activo comprimido y la diferencia con el oráculo instalado (E14m-1), la discretización del oráculo
  en `interface`, VP 58 pendiente, y las discontinuidades de la búsqueda con refuerzos (el círculo crítico puede esquivar
  el refuerzo).
- Los modelos sin refuerzos no cambian: la identidad byte a byte con la v0.2.0 es un gate de cada ola.
- **E14n-1 (§F4.17): clasificación de la N′ negativa con refuerzos.** Para decidir entre `negative_effective_normal` y
  `negative_effective_normal_major` (E7d, E8c y E11f), las dovelas finas de un cruce de refuerzo se suman con sus dos
  vecinas. Es solo una clasificación: el equilibrio, el FS y las dovelas del informe no cambian. Efecto medido: V014 con
  Janbu corregido pierde el aviso mayor (venía de 8 dovelas finas de 7,6e-5 m) y V014 con Spencer y V010 con M-P pierden
  la nota `negative_effective_normal`, con el FS idéntico. Una tracción real sobre dovelas normales conserva el aviso.
  V014 (2 checks de Janbu corregido) vuelve a `verification/cases`: 116 casos, 243 checks. V035b (2) y V083 (1)
  quedan retenidos en `verification/pending/F3R/HOLD.json`: sus N′ < 0 son de dovelas normales y el modelo sin refuerzos
  da el mismo aviso (FS 0,929 y 0,834). Test `crates/ogs-core/tests/f3r2_e14n1.rs`.

- **E14o (§F4.18): enmiendas de la revisión R11** (`docs/reviews/R11_agy_A.md` y `R11_agy_B.md`). Sin refuerzos, todo
  queda idéntico byte a byte salvo V065. Cada punto lleva su test con el contraejemplo del revisor.
  - **E14o-1, tangencia (R11A-01).** Un cruce con un círculo solo cuenta si el elemento penetra (semicuerda mayor que
    `tol`); un par de cruces a menos de `tol` a lo largo del arco se descarta; un elemento que toca un vértice de una
    polilínea sin atravesarla no cuenta. La normal y el movimiento se calculan en el punto exacto del cruce. Antes, un
    anclaje tangente daba +110,8 % (`eps_r = −1e-12`) o −21,1 % (`eps_r = 0`) de FS en V047a sin entrar en la masa.
  - **E14o-2, Bishop con pasivas (R11A-02).** El arranque incluye las pasivas y la bisección acota antes el cambio de
    signo con una malla geométrica: un pilote pasivo con componente vertical ascendente ya no da `invalid ("m_alpha")`.
  - **E14o-3, `no_driving` con pasivas (R11A-03).** Se evalúa solo antes de resolver, con el peso, el sismo, las cargas
    y las fuerzas **activas**; la pasiva es resistente. Janbu deja de usar el momento de Bishop. Un suelo blando
    sostenido por pilotes o tablestacas pasivos converge en lugar de `invalid (no_driving)`.
  - **E14o-4, `interface` con `ru` (R11A-04).** Un material con `ru` usa `u = ru·σ_suelo` y no recibe el agua libre de la
    piezométrica; uno sin `ru` usa la piezométrica. Corrige E14m-2: el contraejemplo pasa de 334,18 a 161,01 kN/m
    (cSlope, 161,00).
  - **E14o-5, `interface` sobre un contacto (R11A-05).** `σ′v` es el mínimo de los dos materiales: el resultado ya no
    depende del orden de `regions` (+22,4 % de FS entre los dos órdenes) ni del espejo.
  - **E14o-6, agrupación de E14n-1 (R11A-06).** Las dovelas finas de un cruce se agrupan con todas las piezas de la
    dovela original, y no con un índice fijo: el aviso mayor no reaparece con una carga lineal o un cruce próximo.
  - **E14o-7, búsqueda con refuerzos (R11A-07).** Con refuerzos, candidatos que pasan por las puntas y las cabezas de
    los elementos y semillas del refinamiento diversificadas por el número de cruces aplicados; sin refuerzos no cambia
    nada. Criterio: brecha de menos de 1 % frente a la malla fina (antes, hasta +7,15 %). Detalle en
    `docs/fase3/r11c/NOTAS.md`.
  - **E14o-8, activo comprimido (R11A-08).** Se sigue aplicando, pero **es falso que sea siempre conservador**: con
    `φ > 0`, su componente normal confina la base y puede subir el FS (V047a, +8,6 % en Bishop con `θ = +2°`). Se corrige
    la justificación de E14m-1 y `docs/limitaciones.md`, y se agrega la nota informativa
    `reinforcement_active_compression`, en E6, en `warnings.ts` y en las listas informativas.
  - **E14o-9, filas del oráculo (R11A-09).** Las filas `inc_up30_pas` e `inc_up45_pas` pasan a elementos embebidos con
    `along ≥ cos 88°` (estado `compression_ignored`, nota y FS del oráculo), y se agregan filas de `bond` e `interface`
    no acotadas por `tensile_capacity`.
  - **E14o-10, Janbu corregido con pasivas (R11A-10).** Se mantiene la división por `F₀`, coherente con el suelo y con
    cSlope; se documenta que activo y pasivo coinciden en `F₀ = 1` (FS = `f₀`) y no en FS = 1
    ([Limitaciones](docs/limitaciones.md#las-fuerzas-pasivas-en-los-métodos-e14o-2-e14o-3-e14o-10)).
  - **E14o-11 (R11A-11).** Sin nodos para los cruces con capacidad nula ni sobre el terreno: el FS es exactamente el del
    talud sin refuerzo (antes, ΔFS de −4,8e-7 con una tablestaca de `force = 0`). Excepción V065, abajo.
  - **E14o-12, unidades y espaciamiento (R11B-01, R11B-07).** Un `spacing` omitido vale 1 en la unidad de longitud del
    modelo: 1 m en SI y 1 ft en imperial. La web escribe siempre un `spacing` explícito al convertir unidades (antes, el
    FS de V047a subía de 1,4914 a 4,5258 al pasar a imperial) y convierte los valores por defecto del lienzo y del
    panel. `docs/formato-ogs-json.md` lo documenta.
  - **E14o-13 y E14o-14, CSV y tabla (R11B-02, R11B-03).** El CSV de fuerzas agrega `fs`, `movilizada_fx`,
    `movilizada_fy` y `nota` (pasiva: se moviliza dividida por F; pilotes y tablestacas: solo estabilidad global); la
    tabla y la leyenda de la web llevan la aclaración del PDF y una columna «Movilizada».
  - **E14o-16 (R11B-05, R11B-06, R11B-08, R11B-09, R11B-10).** Rótulos del lienzo y de Casos sin solapes; el PDF dice
    cuándo ningún refuerzo cruza la superficie convergida y los lista; valores por defecto válidos de pilote y
    tablestaca; unidades de `adhesion`, `end1_capacity` y `end2_capacity` en el PDF; una tablestaca inclinada abierta
    desde un archivo muestra su `x2` y su error.
  - **E14o-17, documentación (R11B-11).** Cifras actualizadas en `docs/limitaciones.md`, `docs/desarrollo.md` y el
    README (116 casos y 243 checks, de `verification/REPORT.md`), y `test_v04.py` y el esquema 0.4 en
    `docs/verificacion.md`. La versión sube a 0.3.0 al publicar.
- **Documentación de E14o:** `docs/limitaciones.md` (la excepción de V065, los cruces con tangencia, las pasivas en los
  métodos, el activo comprimido con la tabla del barrido angular, `interface` con `ru` y contactos, el espaciamiento por
  unidad y la búsqueda), `docs/formato-ogs-json.md` (con un ejemplo ejecutable de un activo comprimido que sube el FS) y
  `docs/verificacion.md` (una sección de verificación de los refuerzos).

### Fixed
- **`ogs bench` bajaba la versión de un modelo 0.4 (E14o-15, R11B-04).** Para Morgenstern-Price, Janbu simplificado,
  Janbu corregido y `--method all` (el valor por defecto) escribía `"version": "0.3"` sobre el modelo, y el motor
  rechazaba cualquier caso con refuerzos (`V037`) con `InvalidModel: reinforcements requiere version "0.4"`. Ahora usa
  la mayor versión entre la declarada y la que el método necesita (0.3). Tests en `crates/ogs-cli`.
- **`to_cslope.py` aceptaba documentos v0.4 que `ogs` rechaza (E14o-11, R11A-11).** Cinco casos inválidos (`force < 0`,
  longitud 0, tablestaca con `x1 ≠ x2`, `bonded_length` mayor que `L` y `angle = 90`) devolvían un documento aceptado
  mientras `ogs analyze` salía con código 2. El conversor valida ahora los rangos de F4.2: `force` y capacidades ≥ 0,
  `spacing` > 0, longitud > 0, `bonded_length` en (0, L], `friction_angle` en [0, 90), `coverage` en (0, 1],
  `length1` y `length2` ≥ 0 y `angle` en (−90, 90). Los 30 checks de los casos v0.4 se siguen convirtiendo.
- **Excepción documentada a la identidad con la v0.2.0 (E14o-11).** La corrección de V065 de abajo cambia la salida de
  un modelo **sin** refuerzos, no solo de los de V065: un círculo con la tangente vertical sobre el terreno que la
  v0.2.0 rechazaba por redondeo (`rc = 2`, `NoValidSurface`) ahora se analiza (V065 sin refuerzos: Spencer 0,9260).
  Ningún modelo sin refuerzos que la v0.2.0 analizaba cambia.
- **Círculo con la tangente vertical sobre el terreno (V065).** `ogs analyze` rechazaba con `NoValidSurface: el círculo
  no corta el terreno` un círculo con el centro a la cota de la coronación (V065: `xc` 4,658, `yc` 15,000, `r` 10,934).
  Su arco termina en `x = xc + r`, y `(xc + r) − xc` valía `r − 1,8e-15`, de modo que `sqrt(r² − t²)` daba 2,06e-7 en
  lugar de 0: pérdida de cifras que la tolerancia geométrica tomaba por un arco bajo el terreno. En el extremo propio
  del círculo la altura es `yc` por construcción (`slicer.rs`, `check_block_ends_circle`). La regla de qué extremos
  admite el círculo no cambia. Spencer da 0,96037 (cSlope 0,9585; publicado 0,964), y los 121 modelos sin refuerzos
  siguen idénticos byte a byte (test `f3r2_tangent_end.rs`).

### Known issues
- **Activo comprimido y el oráculo instalado (E14m-1, E14o-8).** El binario instalado de cSlope (`a80f9a0`) descarta los
  elementos activos comprimidos (`along > 0`); OpenGeoSlide los aplica con su fuerza completa, como el código vigente de
  cSlope. Las filas de aceptación con el oráculo solo usan cruces con `along < 0`. **No es siempre conservador:** con
  `φ > 0` su componente normal puede subir el FS (nota `reinforcement_active_compression`).
- **El espaciamiento por defecto depende de la unidad (E14o-12).** Un `spacing` omitido vale 1 m en SI y 1 ft en
  imperial; al cambiar de sistema a mano en un `.ogs.json`, escríbalo de forma explícita.
- **El umbral de compresión pasiva `cos 88°` es discontinuo** (V047a: Bishop 1,1331 con 88,00° y 0,9851 con 87,99°).
- **Janbu corregido con pasivas:** activo y pasivo coinciden en `F₀ = 1` (FS = `f₀`), no en FS = 1 (E14o-10).
- **`interface` y el oráculo.** cSlope integra el arrancamiento en 200 pasos (hasta −0,47 % en `T`); OpenGeoSlide integra
  exacto.
- **VP 58 de Slide2** (tieback activo) pendiente: su geometría solo está en una figura sin coordenadas. **VP 47**
  (clavos pasivos) con la geometría leída de una figura (+1,3 % en el oráculo frente al 0,890 publicado).
- **La búsqueda con refuerzos tiene discontinuidades** por los cruces y puede esquivar el refuerzo: con
  `reinforcement_outside_mass` en el resultado de una búsqueda, el FS mínimo es el de una superficie que no lo cruza.
- **Ito-Matsui** (V013b a V013e) queda en `pending/`.
- **Búsqueda con refuerzos (E14o-7).** Los candidatos por cabezas y puntas bajan la brecha frente a la malla fina a
  menos de 1 % en los contraejemplos de R11, pero en valles estrechos con dos activos queda hasta +1,6 %, y un modelo
  mal condicionado (FS ≈ 0,1, 14 activos de poca capacidad) conserva +14 %. Para certeza, use la malla `60×60×40`.
- **Rótulos con muchos refuerzos en el lienzo.** En V084a todos se leen y ninguno se encima, pero algunos quedan
  dentro del suelo o cruzan su propia flecha.

## [0.2.0] - 2026-11-26

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
    checks, y los 71 coinciden con cSlope una vez integrados E13l-2 y E13l-5 (antes, D21 daba hasta +160 % y D22 y D23
    eran `invalid`).
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
  - **E13l-3, escala motriz de los residuos.** `máx(D, mín(máx(ΣW, ΣW*), 3·D))`, con `D = máx(ΣW, Σ|t_i|, Σ|H_i|)`:
    una sobrecarga vertical enorme sobre un tramo horizontal ya no oculta un desequilibrio (R10A-03) ni degrada a nota
    una tracción real (R10A-07). Ninguno de los modelos del repositorio cambia.
  - **E13l-4, paso de λ en M-P con `data_points`.** Si el barrido de siempre no converge, se repite con f normalizada
    por `f_máx` y paso `0,05 / máx(f̄, f_máx/2)`. Las cinco funciones con nombre dan el mismo resultado de antes; un
    pico angosto converge como cSlope (R10A-08).
  - **E13l-5, base sobre un contacto de materiales.** Si el punto medio de la base está a menos de `tol` de un contacto
    se toma el material más débil, por `c + máx(0, σ′)·tan φ` (o Su). Antes se tomaba el de arriba: +20,3 % no
    conservador frente a cSlope en una polilínea sobre el techo de un estrato débil (R10A-04).
  - **E13l-6, robustez de la polilínea.** Distancia 2D en la prolongación y el recorte de los extremos (R10A-05), los
    vértices de la polilínea tienen prioridad sobre las fronteras de las cargas y sobre la fusión por `tol` (R10A-09), y
    la cara vertical sobre un contacto vertical toma la resistencia del lado más débil.
  - **E13l-7, superficie informada.** Con la masa truncada (`truncated_driving_mass` o `truncated_mass`), `report.surface` de una polilínea se recorta al
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
- **Picos muy angostos de `data_points`:** un pico de ancho 0,04 queda `not_converged` porque la guarda `m_α` rechaza
  la raíz; una f de 1e-310 da `invalid` (`non_finite`).
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

[Unreleased]: https://github.com/nibaldox/OpenGeoSlide/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/nibaldox/OpenGeoSlide/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nibaldox/OpenGeoSlide/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/nibaldox/OpenGeoSlide/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nibaldox/OpenGeoSlide/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nibaldox/OpenGeoSlide/releases/tag/v0.1.0
[hito-fase0]: https://github.com/nibaldox/OpenGeoSlide/tree/hito-fase0
