# Brief F1-X: exploración de la Fase 1 (solo lectura, Haiku/Flash)

Responde en **español neutro, sin voseo**.

**Contexto:** OpenGeoSlide, software libre (Apache-2.0) de estabilidad de taludes 2D por equilibrio límite. Tiene
motor Rust (`crates/ogs-core`), WASM y web React/Vite (`apps/web`), Python (`crates/ogs-py`) y CLI (`crates/ogs-cli`).
La Fase 0 cerró (`v0.1.0-fase0`); ver `docs/fase0_cierre.md`, `README.md` y `briefs/00_CONTRATOS.md` (contrato
normativo).

La **Fase 1** avanza en dos frentes:
- **Producto:** editor gráfico web, importación DXF/CSV, informe PDF y publicación (GitHub Pages, PyPI).
- **Motor:** desempate de raíces de Spencer (R4-01), cargas y sismo pseudoestático, superficies no circulares.

## Reglas comunes
- **No modifiques el repositorio**, salvo tu **único** archivo de hallazgos:
  `docs/fase1/exploracion/<ID>.md`, en `/home/xodla/archivos/opengeoslide`. Nada de commits, push ni instalaciones
  globales.
- Para scripts y experimentos usa `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f1x-<ID>`.
  Si necesitas código del motor modificado, créalo en un worktree desechable dentro de ese scratch:
  `git -C /home/xodla/archivos/opengeoslide worktree add --detach $TMPDIR/wt HEAD`. Elimínalo al terminar con
  `git worktree remove --force`.
- **Oráculo cSlope (MIT):**
  - venv `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python` (`import cslope`);
  - fuente clonada en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/ref/cslope`;
  - conversor `verification/harness/to_cslope.py`.
- **Binario:** `cargo build --release -p ogs-cli` → `target/release/ogs analyze <archivo|/dev/stdin>`. Si compilas
  dentro del repo principal, usa un `--target-dir` en tu scratch.
- **Afirmaciones:** separa lo **verificado** (con comando y salida real, o URL y cita) de lo **inferido**. No inventes
  valores publicados: si no encuentras un dato, dilo.
- **Formato del archivo:**
  1. Resumen de 5 a 10 líneas.
  2. Hallazgos.
  3. Propuesta concreta, con campos de schema, ecuaciones o módulos según corresponda.
  4. Riesgos.
  5. Fuentes.

  Máximo ~400 líneas.
- **Presupuesto:** ~45 iteraciones. Escribe el archivo **temprano** y refínalo después.

---

## X1: sismo pseudoestático y cargas externas
1. Lee §4.2 (Bishop) y §4.3 (Spencer) del contrato, y `crates/ogs-core/src/methods/{bishop,spencer,mod}.rs`.
2. **Formulación normativa** compatible con nuestras convenciones (orden pie → corona, signo de α, dovelas aéreas,
   E11a′):
   - coeficientes `kh` (horizontal, hacia afuera del talud) y `kv` (vertical, con su signo);
   - cargas lineales (puntuales en 2D) y distribuidas sobre la superficie del terreno;
   - en Bishop: momento respecto al centro, con el brazo de la fuerza sísmica en el centroide de la dovela;
   - en Spencer (GLE f = 1, momento por dovela de Zhu): dónde entran las fuerzas en las ecuaciones de fuerza y de
     momento.
   - Da las ecuaciones finales.
3. **Oráculo:** ¿cSlope soporta sismo y cargas? Busca en su fuente los nombres de campos, la convención de signos y en
   qué métodos aplica. Prueba un caso mínimo con el oráculo y cita la salida.
4. **Casos publicados** con sismo y/o cargas: ACADS, manuales de verificación de Slide/Slope/W y GeoStudio, y las
   fuentes de cSlope. Para cada uno: fuente, geometría y datos completos o no, FS publicado y método. Mira qué cubre
   ya `verification/cases/INDEX.md`.
5. **Propuesta de schema `.ogs.json`:** `analysis.seismic { kh, kv }` y `loads[]`, con tipos y validación, además de
   los códigos de aviso nuevos.

## X2: superficies no circulares
1. **Formulación** para rebanar una polilínea arbitraria con nuestro slicer (`crates/ogs-core/src/slicer.rs` y
   `geometry.rs`):
   - reglas de admisibilidad (convexidad, entrada/salida, tramos aéreos, bloque de entrada);
   - qué métodos aplican: Spencer sí; Bishop no aplica en rigor a superficies no circulares; ¿Janbu simplificado o
     corregido? Recomienda.
2. **Búsqueda no circular:** búsqueda de bloque por estrato débil (tipo *block search* de Slide), optimización de
   vértices (por ejemplo, Greco 1996 o Cheng 2007) y el "optimize" de círculo a polilínea. Recomienda una opción
   determinista y reproducible (semillas fijas) compatible con WASM.
3. **Oráculo:** ¿cSlope soporta superficies no circulares, fijas o en búsqueda? Campos y prueba mínima con la salida
   citada.
4. **Casos publicados no circulares:** por ejemplo, ACADS con estrato débil. Indica datos disponibles y FS. Revisa
   cuáles de nuestros 16 casos tienen variantes no circulares en la fuente de cSlope.
5. **Propuesta de schema:** `analysis.surface { type: "polyline", points: [...] }` y
   `analysis.search { type: "block" | "polyline_optimize", ... }`.

## X3: editor web, importación DXF/CSV e informe PDF
1. **Inventario de `apps/web`:**
   - estructura de `src/` y componentes;
   - cómo se cargan y validan modelos;
   - interfaz con el motor (worker y WASM) y manejo de errores y avisos;
   - tests (Vitest), dependencias (`package.json`) y tamaño del bundle (`pnpm build`, si hace falta en tu scratch).
2. **Diseño del editor:**
   - regiones como polígonos: arrastrar, agregar y quitar vértices, snapping a vértices y ejes;
   - tabla de materiales, línea piezométrica, rangos de búsqueda y círculo fijo; dejar espacio para cargas y sismo;
   - deshacer/rehacer y validación en vivo con los mensajes del motor;
   - abrir y guardar `.ogs.json`, y persistencia local.
   - Propón tipos de estado (`EditorState`, comandos) e interfaces **congelables**, con una descomposición en módulos y
     dueños de archivos para 3 o 4 escritores en paralelo.
3. **Librerías** (licencia compatible con Apache-2.0, mantenimiento y tamaño). Verifica en el registro npm la licencia,
   la última versión y la fecha:
   - SVG propio frente a Konva y otras;
   - DXF: `dxf-parser` u otras. Indica qué entidades soportar (LWPOLYLINE, POLYLINE, LINE) y cómo mapear capas a
     materiales;
   - CSV;
   - PDF: jsPDF, pdf-lib o impresión CSS.

   Recomienda una opción por cada una.
4. **Contenido mínimo del informe PDF:** datos del modelo, materiales, sección con la superficie crítica, tabla de FS
   por método, avisos, versión del motor y advertencia profesional.

## X4: publicación, CI y empaquetado
1. **Estado actual:**
   - `git remote -v`;
   - metadatos de los `Cargo.toml` (license, description, repository) y del `pyproject.toml` de `ogs-py`;
   - scripts de build (`apps/web/scripts/build-wasm.sh`, `bench/run_all.sh`).
2. **Plan de GitHub Actions** (lista de archivos y jobs):
   - CI: fmt, clippy, tests, aceptación, web y pytest; si conviene cachear el oráculo cSlope;
   - deploy a Pages: `base` de Vite, MIME de `.wasm`, workers y si se necesita COOP/COEP;
   - wheels con maturin-action para Linux, macOS y Windows (abi3) y PyPI con trusted publishing;
   - crates.io (opcional).
3. **Disponibilidad de nombres**, con consultas HTTP de solo lectura: PyPI `opengeoslide`; crates.io `opengeoslide`,
   `ogs-core` y `ogs-cli`; npm `opengeoslide`; GitHub `opengeoslide`. Cita la respuesta.
4. **Escritorio:** compara PWA offline con Tauri en tamaño, firma y esfuerzo, y recomienda.
5. **Panorama:** actualiza en 10 líneas el panorama de la competencia libre (cSlope, xslope, pyslope, OGR-Slip2D y
   otros), con novedades de 2026 si las hay.

## X5: estudio R4-01 (desempate de raíces de Spencer)
1. Lee `docs/reviews/R4_agy.md` (R4-01 y R4-02) y la §4.3 del contrato (E11a/E11a′/E11b).
2. **Instrumentación desechable:** en tu worktree de scratch, haz que el CLI pueda listar **todas** las raíces
   candidatas de λ, por ejemplo con una variable de entorno de depuración. Para cada raíz: λ, F, admisibilidad,
   min Φ/F, min m_α, f de N' negativa, fracción de longitud con N' < 0 y cierre.
3. **Barrido** de la familia bicapa de R4-01 (perfil `[[0,0],[0,10],[10,10],[30,25],[60,25],[60,0]]`, techo cohesivo
   φ = 0 sobre base friccional; varía el corte y, c y φ, ru y círculos). Agrega además D03, los 16 casos de
   `verification/cases` y los 10 diferenciales. Compara con cSlope en **superficie fija**.
4. **Evalúa reglas candidatas de selección:**
   - (a) E11a′ actual;
   - (b) excluir las raíces con N' negativa *major* si existe una no-major;
   - (c) preferir el signo de λ que coincide con el de Σ W sin α · tan α, u otra justificación física;
   - (d) la raíz con menor F entre las admisibles;
   - (e) otras que encuentres en la literatura (Zhu 2005, Fredlund-Krahn 1977, manuales de GeoStudio y Slide).

   Para cada regla: n casos con > 1 % frente a cSlope, el peor caso y si mantiene D03, R3-01a y la aceptación. Incluye
   una tabla de resultados y la regla recomendada con su justificación.
5. **R4-02:** propone cómo detectar dos raíces dentro de un mismo paso (extremo local de ρ) y mide el costo.
