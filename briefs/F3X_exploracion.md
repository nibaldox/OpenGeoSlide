# F3-X: exploración de la Fase 3 (motor geotécnico), 4 exploradores Haiku en paralelo, solo lectura

Responde en **español neutro, sin voseo**. Identificadores de código en inglés.

## Contexto
OpenGeoSlide (`~/archivos/opengeoslide`, `main`) tiene cerradas las Fases 1 y 2. Hoy el motor `ogs-core` (Rust) solo
calcula:
- Bishop simplificado y Spencer;
- superficies circulares, fijas o con búsqueda de entrada y salida;
- materiales Mohr-Coulomb, con `ru` y `unit_weight_sat`;
- piezométrica, sismo pseudoestático y cargas `udl` y `line`;
- esquema `.ogs.json` v0.2.

La **Fase 3** agregará al motor:
1. superficies **no circulares**: polilínea fija y su búsqueda;
2. **Morgenstern-Price/GLE**, con f(x) constante, medio seno y trapezoidal, y **Janbu** simplificado y corregido;
3. materiales **no drenados**: Su constante, Su lineal con la profundidad (`s-f-datum`) y SHANSEP;
4. **Hoek-Brown** generalizado, para roca.

**Más adelante** vendrán los refuerzos (pernos, anclajes y geosintéticos); inventáriense igual, para planificar.

## Reglas comunes
- **Solo lectura del repo.** Cualquier instrumentación va en `$TMPDIR/f3x-<tu id>/`, que borras al final.
- **Un único archivo de hallazgos:** `docs/fase3/exploracion/<ID>.md`, en el **checkout principal**, sin commit; lo
  integra el coordinador. Escríbelo **temprano**, con el esqueleto y los primeros hallazgos, y refínalo después: si te
  quedas sin iteraciones, debe quedar algo útil.
- **Etiqueta cada afirmación** como **[verificado]**, con comando y salida real o con `archivo:línea` o URL y cita, o
  como **[inferido]**. Nada de cifras inventadas.
- **Entorno:**
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`;
  - el oráculo está en `$TMPDIR/oracle-venv/bin/python`, con `import cslope` 0.1.0;
  - xslope, si hace falta: `uv run -q --python 3.13 --no-project --with xslope python`.
- **Clon de cSlope (MIT), de solo lectura y compartido:** `$TMPDIR/cslope-src` (commit `0f07e7a`).
  - Casos de verificación: `packages/engine-rs/golden/verification.json`;
  - metadatos: `packages/engine/src/verification/problems.ts`;
  - motor: `packages/engine-rs/crates/`.
  - Ya medido por el coordinador: 187 casos. Los materiales son mohr-coulomb 357, undrained 108, shansep 16,
    s-f-datum 7 y shear-normal 1. Hay `customSurfaces` en 27 casos, `reinforcements` en 30 y `piles` en 6. Los checks
    son Bishop 165, M-P constante 159, M-P por defecto 44, Janbu 44 y M-P «data-point-specified» 2.
- **Conocimiento previo del proyecto:**
  - `briefs/00_CONTRATOS.md` y `briefs/01_CONTRATOS_FASE1.md` (normativos);
  - `docs/limitaciones.md`;
  - `verification/pending/INDEX.md` (casos excluidos y por qué);
  - `verification/tools/import_cslope.py` (el importador);
  - `verification/harness/to_cslope.py` (el conversor al oráculo);
  - la skill `slope-stability-lem-engine` y sus referencias, sobre todo `numerical-guards.md` y
    `verification-sources.md`, en `/home/xodla/.hermes/profiles/open-geoslide/skills/software-development/slope-stability-lem-engine/`.
- **Presupuesto:** unas 45 iteraciones. Cierra con un resumen de 15 líneas como máximo: hallazgos clave, cifras y
  qué quedó sin verificar.

---

## X10: casos de verificación por función (`docs/fase3/exploracion/X10.md`)
1. **Inventario de cSlope por combinación de funciones.**
   - Un caso solo es importable si **todas** sus claves y materiales están soportados.
   - Para cada combinación, cuenta los casos y checks que se volverían importables, con id, método, `publishedBy` y
     tolerancia:
     - (a) solo `undrained`;
     - (b) más `s-f-datum`;
     - (c) más `shansep`;
     - (d) más `customSurfaces`;
     - (e) más M-P medio seno o Janbu;
     - (f) con `reinforcements` y `piles`, más adelante.
   - Usa el importador real como base. Copia `import_cslope.py` a tu scratch y extiéndelo allí, sin tocar el repo, o
     reproduce su lógica de exclusión.
2. **Semántica de los datos de cada caso con `customSurfaces`:** si son polilíneas fijas, superficies compuestas o
   búsquedas no circulares. Cita los campos exactos del JSON.
3. **Hoek-Brown:** cSlope no lo tiene. Busca **casos publicados** de equilibrio límite con Hoek-Brown generalizado
   que sean reproducibles: geometría, parámetros (σci, GSI, mi, D), método y FS publicado. Revisa:
   - el manual de verificación de Slide2 de Rocscience: número de problema, título y valor;
   - artículos;
   - los tests de OGR Slip2D (`github.com/samuelsl27/OGR-Slip2D`, AGPL: solo cita datos publicados y **no copies
     código**);
   - xslope.

   Separa los casos con datos completos de los que no los tienen.
4. **Recomendación de lotes de importación** por ola, con el número de checks que gana cada uno.

## X11: capacidades del oráculo (`docs/fase3/exploracion/X11.md`)
1. **Formato JSON exacto y semántica** de cada material en cSlope: `undrained`, `s-f-datum`, `shansep` y
   `shear-normal`.
   - Indica parámetros, unidades y qué es el «datum».
   - Indica cómo entra el agua y cómo se evalúa σv' en SHANSEP.
   - Cita `archivo:línea` del motor Rust en `$TMPDIR/cslope-src/packages/engine-rs/crates/`.
2. **Métodos:**
   - Janbu: si es simplificado o corregido y qué f0 usa.
   - M-P: qué funciones admite (`intersliceFunction`) y cuál es el valor por defecto.
   - Cita el código.
3. **Superficies:** si el oráculo analiza polilíneas fijas (`customSurfaces`), cuál es su formato y si **busca**
   superficies no circulares, con qué algoritmo y con qué opciones.
4. **Prototipos ejecutados** con `$TMPDIR/oracle-venv/bin/python`. Muestra el código mínimo y la salida real:
   - V047a (ACADS 1(a), en `verification/cases/`) como superficie fija circular con Bishop, M-P constante, M-P medio
     seno y Janbu;
   - la misma masa con una polilínea fija de 4 o 5 puntos;
   - un material `undrained` y uno `shansep` sobre la misma geometría.

   Anota `converged`, `warnings` y el FS.
5. **Refuerzos y pilotes (para después):** tipos, parámetros, cómo entran en el equilibrio (activos o pasivos, y
   fuerza en la base o en la dovela) y casos que los usan. Cita el código.

## X12: mapa del motor y del formato (`docs/fase3/exploracion/X12.md`)
1. **Dónde supone `ogs-core` que la superficie es un círculo:**
   - el tipo de superficie;
   - la intersección con el terreno;
   - α de la base;
   - los brazos de momento de Bishop y Spencer (centro del círculo);
   - las guardas de admisibilidad;
   - la búsqueda;
   - el informe y los avisos;
   - la CLI, WASM, Python y la web.

   Para cada punto da `archivo:línea`, qué habría que generalizar y el riesgo.
2. **Dónde se calcula la resistencia** (c + σ'·tan φ) y qué cambia con una resistencia no lineal: Hoek-Brown depende
   de σn', que a su vez depende de F. Indica si Bishop y Spencer ya iteran de forma que admita τ(σn').
3. **Cómo está estructurado el enum de materiales y la validación estricta** (`deny_unknown_fields`, rangos), y cómo
   se hizo la subida de versión de 0.1 a 0.2. Propón la vía a v0.3 con compatibilidad hacia atrás e identidad de
   resultados.
4. **Archivos de la web afectados:** `apps/web/src/editor/types.ts`, `io/ogsJson.ts`, los paneles, el lienzo, el
   informe y los catálogos de avisos.
5. **Propuesta de reparto en escritores paralelos**, con propiedad disjunta de archivos, y los tipos que conviene
   congelar en la ola 0.

## X13: matemática y algoritmos (`docs/fase3/exploracion/X13.md`)
Cada fórmula con su fuente: referencia bibliográfica y URL con cita, o código del oráculo.
1. **Morgenstern-Price/GLE** con f(x) constante, medio seno, trapezoidal o definida por puntos.
   - Cómo se integra con el solver actual de Spencer: dos curvas F_m(λ) y F_f(λ) con la ecuación de momento por dovela
     de Zhu, Lee, Qian y Chen (2005), en `crates/ogs-core/src/methods/spencer.rs`.
   - Qué cambia en la ecuación de momento y en las guardas.
2. **Janbu:**
   - simplificado, solo con equilibrio de fuerzas;
   - corregido, con el factor f0 de Janbu (1973) en función de d/L y del tipo de suelo (c, φ o c-φ), y la fórmula
     exacta.
   - Verifica qué usa cSlope; si X11 lo encuentra antes, cítalo.
3. **No drenado:** Su constante; Su(z) lineal desde un datum, con límite inferior; SHANSEP, Su = S·σv'·OCR^m.
   - Cómo se calcula σv' en la base de la dovela.
   - Qué pasa con el agua y con φ = 0.
4. **Hoek-Brown generalizado** (Hoek, Carranza-Torres y Corkum, 2002):
   - mb, s y a a partir de GSI, mi y D;
   - el criterio τ(σn') en la base de la dovela: la solución cerrada de Balmer (1952) y la vía de c y φ
     instantáneos;
   - cómo lo resuelven los programas de equilibrio límite (Slide2 y OGR) y si iteran σn' con F;
   - qué hacer con σn' ≤ 0 (tracción).
5. **Búsqueda no circular:**
   - path search, block search y optimización (recocido simulado, Cuckoo, Greco 1996) en Slide2;
   - programación dinámica en SSA;
   - superficies compuestas en cSlope.

   Recomienda una opción compatible con las guardas de admisibilidad actuales y con el criterio conservador del
   proyecto: una búsqueda que no encuentra el mínimo es no conservadora.
6. **Bishop en polilíneas:** confirma con fuente y, si puedes, con un prototipo del oráculo, que su FS depende del
   punto de momento y que por eso no debe ofrecerse en superficies no circulares.
