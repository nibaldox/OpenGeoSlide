# Brief F3B-X: exploración del bloque «Hoek-Brown, SHANSEP y búsqueda no circular»

Responde en **español neutro, sin voseo**.

## Contexto

- **Proyecto.** OpenGeoSlide v0.4.0, publicado el 2026-11-27. Formato v0.5 (grieta de tracción, agua embalsada,
  Ito-Matsui); motor Rust `crates/ogs-core`; web en `apps/web`.
- **Qué falta.** `docs/limitaciones.md` §«Lo que queda para la Fase 3b»: búsqueda no circular (refinamiento de
  Celestino y Duncan), Hoek-Brown generalizado, SHANSEP y el caso publicado de Hammah et al. (2005b).
- **Plan del bloque:** `docs/fase3/PLAN_FASE3B.md`. Léelo primero, en especial las decisiones D2 a D4 y las preguntas
  abiertas de §7.
- **Exploración previa que sirve de punto de partida** (no la repitas; verifica lo que uses y actualízalo):
  - `docs/fase3/exploracion/X10.md`: inventario del corpus de cSlope, Hoek-Brown y Hammah;
  - `X11.md`: capacidades del oráculo (SHANSEP en §1.3, Hoek-Brown y no circular);
  - `X12.md`: mapa del motor de la Fase 3 (algunas líneas ya cambiaron);
  - `X13.md`: matemática (Hoek-Brown en §4, SHANSEP en §3.3, búsqueda no circular).
- **Modelo de formato y profundidad:** `X18.md` (oráculo y casos), `X19.md` (práctica), `X20.md` (motor, formato y
  web).

## Reglas comunes

- **Solo lectura del repo.** Escribes **un único archivo de hallazgos**, `docs/fase3/exploracion/X<n>.md`, en
  `/home/xodla/archivos/opengeoslide`, que está en la rama `main`. Escríbelo **temprano**, con el esqueleto de tus
  secciones, y refínalo después: si te quedas sin iteraciones, lo escrito sirve.
- **No commitees**, no cambies de rama y no toques otro archivo del repo.
- **Instrumentación:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - todo va en `$TMPDIR/f3b-x<n>/`; un worktree detached, si te hace falta, va ahí, con
    `CARGO_TARGET_DIR=$TMPDIR/f3b-x<n>/target`, y se borra al final con `git worktree remove`;
  - **no** compiles en el checkout principal: el binario `target/release/ogs` (0.4.0) ya está construido;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Cada afirmación lleva su marca:**
  - `[verificado]`, con el comando y su salida, `archivo:línea`, o la URL y la cita exacta;
  - `[inferido]`, cuando no lo comprobaste.

  **Nada de cifras inventadas.** Una fórmula vista solo en una fuente secundaria o en OCR queda `[inferido]`.
- **Herramientas:**
  - Oráculo: `$TMPDIR/oracle-venv/bin/python` con `import cslope` (cslope 0.1.0). En Hoek-Brown, σci va en `ucs`.
  - Clon del código de cSlope: `$TMPDIR/cslope-src` (commit `0f07e7a`, MIT). Rutas Rust bajo
    `packages/engine-rs/crates/cslope-engine/src/`. Se lee y se cita; **no se copia** código.
  - Motor: `target/release/ogs analyze <modelo.json>` o `/dev/stdin`.
  - Importador: `verification/tools/import_cslope.py`; conversor: `verification/harness/to_cslope.py`.
  - Corpus de cSlope: `$TMPDIR/cslope-src/packages/engine-rs/golden/verification.json`.
- **Presupuesto:** unas 60 iteraciones. Prioriza las tablas de hallazgos sobre la prosa.
- **Cierre:** tu respuesta final resume los hallazgos clave en 15 líneas o menos e incluye la ruta del archivo.

## X23: oráculo y casos

1. **Inventario.** En el corpus de cSlope y en `verification/pending/**`, lista cada caso que necesita una capacidad
   del bloque:
   - `nonCircularOptimization` o cualquier otra búsqueda no circular;
   - el material `shansep`;
   - Hoek-Brown.

   Para cada caso da:
   - la fuente y los métodos, con el valor publicado y quién lo publica;
   - las opciones que usa;
   - qué **más** necesita que el motor no tenga (por ejemplo `waternet`, `earlierStage` o `bBar`).
2. **El oráculo contra los publicados.** Corre el oráculo sobre cada caso del inventario. Da una tabla por check:
   publicado, cSlope, diferencia en % y si entraría con la tolerancia de su fuente. Resume **cuántos checks y casos**
   entrarían con cada capacidad.
3. **Hoek-Brown publicado.** Busca casos de equilibrio límite con Hoek-Brown y datos completos:
   - Hammah et al. (2005b), con la fuente primaria si es posible;
   - los problemas de verificación de Slide2 (`docs/fase3/r1v/VP_SLIDE2.md` y la web de Rocscience);
   - los de SLOPE/W y OGR Slip2D, y otros.

   Para cada uno indica si tiene geometría, GSI, mi, D, σci y FS publicados, y si el oráculo lo reproduce.
4. **Propuesta de modelos sintéticos** con Hoek-Brown para la batería diferencial (rajo de 2 a 4 bancos, roca débil y
   roca competente, con y sin piezométrica). Da la entrada JSON del oráculo de dos de ellos y su FS en búsqueda y en
   un círculo fijo.

## X24: búsqueda no circular

1. **cSlope.** Cómo implementa `nonCircularOptimization`. Cita archivo y línea de `model/optimize.rs`, `slope.rs` y
   `solvers.rs`:
   - de qué superficies parte (cuántos círculos y cuáles);
   - cómo convierte el círculo en polilínea (número de vértices);
   - qué mueve, con qué pasos y cuándo para (variación alterna, reinicio de Greco);
   - qué admisibilidad exige (concavidad, ángulos, cruces con el terreno);
   - qué método minimiza;
   - si es determinista.
2. **Fuentes primarias.** Celestino y Duncan (1981), Greco (1996) y, si aporta, Cheng (2003) y Li et al. (2010): el
   algoritmo, sus parámetros y sus garantías, con la cita exacta. Indica qué no pudiste leer en la fuente primaria.
3. **Otros programas.** Qué ofrecen y con qué valores por defecto: Slide2 (path search, block search, auto refine,
   «optimization» posterior), SLOPE/W y OGR Slip2D. Cita la documentación con la URL.
4. **Riesgos de admisibilidad.** Qué superficies degeneradas puede generar un refinamiento libre: base que se vuelve
   sobre sí misma, ángulos muy empinados en la salida o la entrada, vértices fuera del modelo, polos de m_α.
   Compáralo con lo que ya rechaza el motor para las polilíneas fijas (E13l en `briefs/02_CONTRATOS_FASE3.md`).
5. **Medición.** Corre el oráculo con y sin `nonCircularOptimization` en tres casos del inventario (por ejemplo V001,
   V034a y V036a). Tabla: FS circular, FS no circular, número de vértices de la superficie final y tiempo.
6. **Recomendación** de algoritmo y parámetros para OpenGeoSlide, con criterios de aceptación medibles.

## X25: Hoek-Brown generalizado

1. **Fuente primaria.** Hoek, Carranza-Torres y Corkum (2002), con los números de ecuación:
   - mb, s y a en función de GSI, mi y D;
   - la envolvente σ1–σ3 y la de τ–σn (Balmer);
   - c y φ instantáneos en un σn dado.

   El texto completo está en
   https://static.rocscience.cloud/assets/resources/learning/hoek/Hoek-Brown-Failure-Criterion-2002.pdf. Si alguna
   página no tiene capa de texto, ríndela como imagen y léela. Agrega el aviso de Hoek (1990) sobre la cohesión
   tangente.
2. **cSlope.** `types/hoek_brown.rs` y la integración en `model/solvers.rs` (X11 menciona la línea ~1817):
   - las ecuaciones exactas que usa, comparadas término a término con la fuente;
   - cómo obtiene σ′n inicial y cómo la actualiza;
   - el número de pasadas, la tolerancia y el promedio;
   - qué hace con σ′n ≤ 0 o en tracción, y si hay piso o corte;
   - los nombres de los campos del oráculo y sus unidades.
3. **Otros programas.** Slide2 (generalized Hoek-Brown, «instantaneous» frente a ajuste Mohr-Coulomb), OGR Slip2D y
   SLOPE/W: qué hacen en equilibrio límite y qué ofrecen al usuario, como la calculadora de GSI y mi o el factor D.
4. **Medición con el oráculo.** En un círculo fijo de un talud de roca simple, mide:
   - FS de Bishop y Spencer con Hoek-Brown;
   - el mismo con Mohr-Coulomb a los c y φ equivalentes de una σ′n media;
   - la sensibilidad a la tolerancia y al número de pasadas, si el oráculo la expone.
5. **Validación de entradas** que recomiendan las fuentes: rangos de GSI, mi y D, y las unidades de σci (MPa en la
   práctica, kPa en el modelo).
6. **Hammah et al. (2005b):** los datos completos del ejemplo 1, desde la fuente más primaria que encuentres.
   Coordínate solo leyendo: X23 también lo busca, pero tú das la física.

## X26: SHANSEP

1. **Fuente primaria.** Ladd y Foott (1974) y Ladd (1991): `Su = S·σ′v·OCR^m`, los valores típicos de S y m, y cómo se
   definen OCR y POP. Cita la fuente o marca `[inferido]`.
2. **cSlope.** `types/strength.rs:657-700` (`shansep_su`) y `model/slices.rs` (σ′v en la base):
   - las fuentes de OCR y su prioridad;
   - qué σ′v usa: la total menos u, con qué cargas, con qué ancho;
   - cómo entran el agua embalsada, `ru` y `bBar`;
   - `su_min`, `anisotropy`, `yieldFromEarlierStage` y `suByStress`, y cuáles son raros en la práctica.
3. **Otros programas.** Slide2 y SLOPE/W: qué opciones ofrecen.
4. **Medición con el oráculo.** En V047a (seco y con piezométrica) y en V105a con agua embalsada: el FS con OCR
   constante, por cota y con POP.
5. **Recomendación** del subconjunto que entra en el formato v0.6, con sus campos, y qué queda fuera.

## X27: motor, formato y web

1. **Motor.** Con `archivo:línea` de `crates/ogs-core/src` en `main` `0b9c984`:
   - dónde se resuelve hoy la resistencia de cada dovela (`strength.rs`, `slicer.rs`), y cómo la leen los métodos
     (`methods/{bishop,spencer,morgenstern_price,janbu,mod}.rs`);
   - dónde entraría una resistencia que depende de σ′n = N′/l y por lo tanto de F (Hoek-Brown): una ley de resistencia
     en `Slice`, un lazo exterior o una actualización dentro de cada método. Pros y contras de cada opción, y qué
     guardas del contrato (m_α, N′ negativa, tracción) se ven afectadas;
   - dónde entraría σ′v para SHANSEP;
   - la arquitectura de `search.rs` y `surface.rs`: dónde se generan los candidatos, cómo se evalúa una polilínea fija y
     dónde se engancharía el refinamiento no circular. Qué se puede reutilizar del ajuste de la polilínea al terreno.
2. **Formato v0.6.** Propón los campos, con dos o tres alternativas y sus pros y contras:
   - `material.model: "hoek_brown"` con `ucs`, `gsi`, `mi` y `d` (o `mb`, `s` y `a` directos);
   - `material.model: "shansep"` con sus campos;
   - la búsqueda no circular: `search.type` nuevo, o una opción de refinamiento sobre la búsqueda circular.

   Incluye la regla de versión mínima (F3.9), la identidad byte a byte sin los campos nuevos, el esquema
   `schema/ogs-0.6.schema.json` y la salida (los c y φ instantáneos por dovela, los vértices de la polilínea crítica).
3. **Web**, con `archivo:línea` de `apps/web/src`:
   - el panel de materiales y dónde iría la calculadora de mb, s y a;
   - las opciones de búsqueda;
   - el lienzo para la polilínea crítica;
   - el informe PDF, el CSV, Diagnósticos, la Ayuda y el catálogo de avisos (`engine/warnings.ts`);
   - la validación y la regla de versión mínima;
   - el motor simulado de respaldo, que debe rechazar lo que no modela.
4. **Python y CLI:** qué cambia en `crates/ogs-py` y `crates/ogs-cli`.
5. **Propuesta de olas y escritores** con dueños de archivo disjuntos, en el estilo de `docs/fase3/PLAN_REFUERZOS.md`
   y de §4 de `docs/fase3/PLAN_FASE3B.md`. Señala los archivos que dos escritores tocarían y qué congelar en B0 para
   evitarlo.
