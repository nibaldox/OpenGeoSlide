# F3R-X: exploración del bloque de refuerzos, tres exploradores Haiku en paralelo, solo lectura

Responde en **español neutro, sin voseo**. Identificadores de código en inglés.

## Contexto
OpenGeoSlide (`~/archivos/opengeoslide`, rama `f3a-integracion`) cierra la Fase 3a. El motor `ogs-core` (Rust) ya
calcula:
- Bishop, Spencer, Morgenstern-Price y Janbu;
- superficies circulares y polilíneas fijas;
- materiales Mohr-Coulomb y no drenado;
- piezométrica, sismo y cargas `udl` y `line`;
- formato `.ogs.json` v0.3.

El **bloque siguiente** es **refuerzos y elementos estructurales**:
- **tablestacas** (en voladizo y ancladas);
- **pilotes** y micropilotes;
- **anclajes** (tirantes postensados o pasivos);
- **pernos** y clavos de suelo (soil nails);
- **geosintéticos** (geomallas y geotextiles; muros TEM y terraplenes reforzados).

El usuario preguntó por las tablestacas y quiere este bloque antes de la búsqueda no circular y de Hoek-Brown.

## Reglas comunes
- **Solo lectura del repo.** La instrumentación va en `$TMPDIR/f3r-<tu id>/` y la borras al final.
- **Un único archivo de hallazgos,** `docs/fase3/exploracion/<ID>.md`, en el checkout principal, sin commit. Escríbelo
  **temprano** y refínalo.
- **Etiqueta cada afirmación** como **[verificado]**, con comando y salida real, `archivo:línea` o URL y cita, o como
  **[inferido]**. Nada de cifras inventadas.
- **Entorno:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`;
  - oráculo: `$TMPDIR/oracle-venv/bin/python`, con `cslope` 0.1.0;
  - clon de cSlope (MIT, solo lectura): `$TMPDIR/cslope-src`, commit `0f07e7a`. Los casos están en
    `packages/engine-rs/golden/verification.json` y el motor en `packages/engine-rs/crates/`; los tipos de Python, en
    `$TMPDIR/oracle-venv/lib/python3.13/site-packages/cslope/__init__.pyi` (por ejemplo `Pile`, cerca de la línea 419,
    y `Reinforcement`, cerca de la 467).
- **Conocimiento previo:**
  - `docs/fase3/exploracion/X10.md` (ola f: 30 casos con `reinforcements` y 6 con `piles`), `X11.md` §5 y `X12.md`;
  - `briefs/02_CONTRATOS_FASE3.md`;
  - `verification/tools/import_cslope.py`.
- **Presupuesto:** unas 45 iteraciones. Cierra con un resumen de 15 líneas como máximo.

---

## X14: refuerzos en el oráculo y casos de verificación (`docs/fase3/exploracion/X14.md`)
1. **Semántica exacta de `Reinforcement` y `Pile` en cSlope**, citando `archivo:línea` de su motor Rust:
   - **parámetros y unidades:** `tensileCapacity`, `pullout`, `end1Capacity`/`end2Capacity`, `prestress`, `spacing`,
     `direction` y `application`; y en `Pile`, `wall`, `shearCapacity`, `momentCapacity`, `force`, `location`,
     `direction`, `angle`, `diameter` y las rigideces;
   - **cómo se calcula la fuerza disponible** donde la superficie cruza el refuerzo: longitud embebida a cada lado,
     arrancamiento y mínimo de capacidades;
   - **cómo entra en el equilibrio** de cada método (Bishop, Janbu, M-P y Spencer):
     - activa, sumada a las fuerzas motoras, o pasiva, sumada a la resistencia y por tanto dividida por F;
     - en qué dovela, en qué punto y con qué dirección: tangente a la base o según el ángulo del refuerzo;
   - **tablestaca (`wall: true`):** qué cambia respecto de un pilote y cómo se trata la parte embebida.
2. **Prototipos con el oráculo**, mostrando el código mínimo y la salida real, sobre V047a con el círculo fijo de
   `briefs/02_CONTRATOS_FASE3.md` §F3.8:
   - un anclaje, activo y pasivo;
   - un clavo de suelo con arrancamiento;
   - una geomalla horizontal;
   - un pilote y una tablestaca (`wall: true`);
   - en cada caso, Bishop, M-P constante y Janbu corregido.

   Anota el FS, `converged` y `warnings`.
3. **Inventario de los 36 casos** con `reinforcements` o `piles`:
   - tipos de refuerzo, métodos, superficie, `publishedBy`, valores y tolerancia;
   - qué otros bloqueos tiene cada uno (`customSurfaces`, agua, grietas).
   - Agrúpalos en lotes importables: solo anclajes, clavos, geosintéticos o pilotes, y sus combinaciones.

## X15: práctica de ingeniería y referencias publicadas (`docs/fase3/exploracion/X15.md`)
Cita cada dato con URL y frase textual.
1. **Slide2 de Rocscience:**
   - tipos de soporte: End Anchored, Grouted Tieback, Grouted Tieback with Friction, Soil Nail, Micro Pile,
     Geotextile y User Defined;
   - sus parámetros;
   - el método de aplicación: activo o pasivo, y en qué dirección;
   - cómo combina tracción, arrancamiento y placa.
   - Indica qué **problemas del manual de verificación** de Slide2 tienen soportes, con número, título, FS publicado y
     si los datos están completos.
2. **Tablestacas en equilibrio límite:**
   - cómo se modela una tablestaca en voladizo y una anclada en Slide2, GEO5 y Plaxis LE;
   - la tablestaca como pilote con resistencia al corte, como material impenetrable o como fuerza;
   - la verificación de estabilidad global con la tablestaca;
   - qué **no** cubre el equilibrio límite: empuje sobre la tablestaca, empotramiento, momento flector y deflexión.

   Busca casos publicados reproducibles: geometría, parámetros y FS.
3. **Geosintéticos y muros TEM:**
   - resistencia de diseño a largo plazo: T_ult y los factores de reducción por fluencia, daño de instalación y
     durabilidad;
   - arrancamiento con el coeficiente de interacción;
   - estabilidad interna frente a global;
   - referencias **FHWA-NHI-10-024/025** y **BS 8006**, con casos de ejemplo publicados y números.
4. **Clavos y anclajes:**
   - adherencia del bulbo y longitud libre;
   - **FHWA-NHI-14-007** (soil nails) y **FHWA-IF-99-015** (anclajes), con ejemplos numéricos.
5. **Recomendación:**
   - qué conjunto mínimo de tipos y parámetros cubre el 90 % de los usos en minería y obras civiles en Chile y LatAm;
   - qué conviene posponer.

## X16: mapa del motor, del formato y de la web (`docs/fase3/exploracion/X16.md`)
1. **Dónde y cómo inyectar fuerzas de refuerzo** en `ogs-core`.
   - Revisa la maquinaria de cargas lineales de E12b (`loads.rs` y `slicer.rs`: `h_force`, `h_moment_base` y
     `weight_extra`) y cómo una fuerza puntual inclinada entra en Bishop, Spencer, M-P y Janbu.
   - Revisa qué falta para una fuerza **pasiva**, que depende de F (dividida por F o sumada a la resistencia) y para
     una fuerza aplicada en la base de la dovela, distinta de una fuerza en la superficie.
   - Da `archivo:línea` y el riesgo de cada punto.
2. **Intersección refuerzo-superficie:** segmento contra círculo o polilínea, la dovela que recibe la fuerza y las
   longitudes embebidas a cada lado. Indica qué funciones de `surface.rs` y `geometry.rs` se reutilizan.
3. **Propuesta de esquema v0.4**, que congele el coordinador:
   - `reinforcements: [...]` con `type` (`anchor`, `nail`, `geosynthetic`, `pile`, `sheet_pile`);
   - geometría, capacidades, espaciamiento y modo de aplicación;
   - compatibilidad hacia atrás, con identidad bit a bit sin refuerzos;
   - validaciones.
4. **Web:**
   - cómo dibujar y editar refuerzos en el lienzo: segmentos con dos tiradores y elementos verticales;
   - el panel «Refuerzos», el informe y la leyenda;
   - qué archivos de `apps/web/src` cambian.
5. **Reparto en escritores paralelos**, con propiedad disjunta de archivos y los tipos que conviene congelar en la
   ola 0.
