# Brief F3B-B2b: documentación de Hoek-Brown, SHANSEP y búsqueda no circular (formato v0.6)

Responde en **español neutro, sin voseo**. Eres el escritor B2b del bloque F3B de OpenGeoSlide: Hoek-Brown, SHANSEP y
búsqueda no circular, formato v0.6, que saldrá como release v0.5.0. Escribes la documentación con **cifras medidas**,
no estimadas. En paralelo, B2a promueve los casos de `pending/F3B`, corrige la web y hace la regresión en Chrome. Tú no
tocas código, ni `verification/`, ni `CHANGELOG.md`, que es del coordinador: propón tus líneas en el informe.

## Archivos tuyos

- `docs/formato-ogs-json.md`
- `docs/limitaciones.md`
- `docs/verificacion.md`, **salvo** los conteos de la promoción: escribe `<!-- B2a: N -->` donde vaya el número de checks
  promovidos y el coordinador lo completa al integrar.
- `README.md`, solo la lista de capacidades y el resumen de limitaciones, si mencionan lo que F3B cambia; por ejemplo,
  hoy dice que no hay búsqueda no circular ni Hoek-Brown.

## Fuentes que debes leer (no inventes cifras ni reglas)

- **Contrato:** `briefs/05_CONTRATOS_FASE3B.md`, F6.1 a F6.14, con las enmiendas E16a a E16u. Es la fuente normativa de
  cada regla.
- **Esquema:** `schema/ogs-0.6.schema.json`. **Mensajes de validación exactos:** `crates/ogs-core/src/strength.rs` y
  `loads.rs`.
- **Exploración y evidencia:**
  - `docs/fase3/exploracion/X23.md` a `X30.md`;
  - `X28_filas/reglas_coordinador.json`, con la regla de bajo confinamiento;
  - `X29_proto/v002_raices_coordinador.json`, con V002 y E16u.
- **Cifras medidas por el coordinador en `df2dfd7`:**
  - `$TMPDIR/f3b-coord/gates-b1d.log`: los gates;
  - `$TMPDIR/f3b-coord/diff-f3b2/REPORT.md` y `report.json`: la batería diferencial con el bloque F3B;
  - `$TMPDIR/f3b-coord/pending_f3b_probe.txt`: los 22 checks de `pending/F3B` contra el motor integrado;
  - `$TMPDIR/f3b-coord/escritores.jsonl`: las cifras de M-HB, M-NC y M-SH en sus filas de aceptación;
  - `$TMPDIR/f3b-coord/hallazgos_coordinador.md`.
- **Precedente de estilo y estructura:** la documentación del bloque v0.5 en los tres archivos. Revisa las secciones
  «Grieta de tracción (v0.5)» y «Pilotes con presión de suelo de Ito-Matsui (v0.5)» en `formato-ogs-json.md`, y
  «Grieta de tracción, agua embalsada y pilotes de Ito-Matsui» en `verificacion.md`.

## Tareas

### 1. `docs/formato-ogs-json.md`: secciones v0.6

1. **Versión mínima 0.6.** Qué campos la exigen y el mensaje exacto con una versión menor.
2. **Hoek-Brown** (`"model": "hoek_brown"`).
   - **Campos:** `ucs` en kPa (o psf en imperial), `gsi`, `mi` y `disturbance`, obligatorio, cada uno con sus rangos.
   - **Fórmulas** de mb, s y a según Hoek et al. (2002).
   - **Lazo por dovela** (F6.8): w = 0,5, |ΔF| ≤ 1e-6·|F|, 50 pasadas como máximo, y la nota
     `hoek_brown_not_converged`.
   - **Envolvente completa** en bajo confinamiento y la nota `hoek_brown_low_confinement`.
   - **Salida** `strength` por dovela.
   - **Errores** con su texto exacto.
   - **Un ejemplo ejecutable** que el motor resuelva; usa uno de `crates/ogs-core/tests/data/f3b/hb/`.
3. **SHANSEP** (`"model": "shansep"`).
   - **Campos:** `ratio` y `exponent`, y exactamente una de `ocr`, `pop` u `ocr_by_elevation`, con sus rangos.
   - **σ′v** = (W + Q + V)/b − u, sin sismo (E16o).
   - **σ′v ≤ 0:** Su = 0 y la nota `shansep_nonpositive_stress`.
   - **Las caras** (E16r).
   - **La interpolación** de `ocr_by_elevation`.
   - **Salida y errores.**
   - **Un ejemplo** con POP y otro con OCR por cota, tomados de `tests/data/f3b/sh/`.
4. **Búsqueda no circular** (`analysis.search.non_circular`).
   - **Campos:** `seeds` y `max_vertices`, con sus rangos.
   - **Métodos admitidos:** Bishop da error (F6.4).
   - **Algoritmo**, en el nivel de F6.10: semillas, 9, 17 y 33 vértices, la selección de E16s, las ventanas, la
     concavidad de 1°, y el mínimo entre la semilla y la polilínea.
   - **Salida:** `search.non_circular {seeds, evaluated, seed_fos, polyline_fos}` y la superficie `polyline`.
   - **La nota** `non_circular_large_change`.
   - **Un ejemplo** con V001 o V034a, citando su FS medido.
5. **Combinaciones prohibidas** (F6.5), con Ito-Matsui y lo demás.
6. **«Qué valida el esquema y qué solo el motor».** Agrega lo de E16n: el orden de `ocr_by_elevation` y las reglas
   cruzadas.

Cada ejemplo debe correr de verdad. Si `docs/` tiene un test que ejecuta los fragmentos (busca en
`verification/tools/test_*docs*` o en la sección «Cómo se validan los ejemplos»), tus ejemplos deben pasarlo. Ejecútalo
con `OGS_BIN=$CARGO_TARGET_DIR/release/ogs` y cita la salida.

### 2. `docs/limitaciones.md`

- **Alcance.** Actualiza el párrafo inicial y la lista: ya hay búsqueda no circular, Hoek-Brown y SHANSEP, cada uno con
  sus límites. Quita o reescribe «Lo que queda para la Fase 3b».
- **Hoek-Brown.**
  - En bajo confinamiento la regla del producto es la envolvente completa, distinta de cSlope. Da diferencias
    **conservadoras** de hasta −2,9 % en círculo fijo frente a cSlope; con Janbu en SB llega a −2,88 %. Las cifras
    salen de `reglas_coordinador.json` y del diferencial F3B.
  - El aviso de Hoek (1994) sobre el uso de σci.
  - El costo: la búsqueda Bishop con Hoek-Brown tarda unas 50 veces más que con Mohr-Coulomb, 0,86 s en SA.
  - La no convergencia y su nota.
- **SHANSEP.**
  - Sin `aboveWater`, por eso V105a está en HOLD.
  - φ = 0.
  - El sismo no entra en σ′v.
  - El caso σ′v ≤ 0.
  - Los círculos muy anchos y poco profundos.
- **Búsqueda no circular.**
  - **V002 y E16u.** En materiales con capa débil, la búsqueda puede llevar a la rama de tracción que elige E12e (las
    notas `negative_lambda` y `negative_effective_normal_major` juntas) y quedar bajo el publicado. V002 da 0,3864
    frente a 0,414; cSlope evalúa esa misma polilínea en 0,4152. Recomienda comparar con Bishop circular y revisar N′.
  - **HB-06 y §4.2.** El motor descarta superficies con m_α < `min_m_alpha` que cSlope acepta con
    `steep-entry-tension`, así que en bancos empinados el FS de la búsqueda puede quedar sobre el de cSlope.
  - **Sin Bishop.**
  - **El costo:** 2,4 a 2,9 veces el de la búsqueda circular.
  - **Determinismo.**
- **Combinaciones no admitidas** (F6.5).

### 3. `docs/verificacion.md`: sección «Hoek-Brown, SHANSEP y búsqueda no circular (v0.6)»

Sigue la estructura de la sección v0.5 e incluye:
- las filas de aceptación de cada módulo con sus diferencias medidas:
  - M-HB: 20 filas del producto, a 0,001 % como máximo, y 33 de compatibilidad, a ≤ 0,072 %;
  - M-SH: 13 escenarios por 5 métodos, a ≤ 0,022 %;
  - M-NC: 10 búsquedas y 10 evaluadores, con la tabla de cifras;
- HAM1, con Bishop 1,1502 frente a 1,153 y Spencer 1,1521 frente a 1,152, con tolerancia de 0,5 %, y la nota de su
  geometría reconstruida;
- la batería F3B: 12 modelos y 42 checks, 40 OK y 2 explicados (E16t y §4.2), con la tabla y el comando;
- identidad: 0 diferencias en 180 modelos contra la v0.4.0, más 18 modelos v0.6 saltados aparte; el CSV y el PDF de
  la web v0.5, idénticos byte a byte (`apps/web/src/report/identity.f3b.mjs`);
- los checks promovidos, con el marcador `<!-- B2a: N -->`, y V002 retenido, citando E16u;
- el bloque «Reproducir», con los comandos exactos.

Actualiza también las cifras totales de «Estado de verificación» que ya conozcas: 1539 tests de pytest y la batería.
Deja con el marcador las que dependan de la promoción. **No dejes cifras viejas** donde ya no correspondan.

## Comprobación

- Corre los tests de documentación que existan; busca con `rg -n "docs/" verification/tools apps/web/src | grep test`.
- Comprueba que cada cifra que escribas aparezca en una fuente de arriba. En el informe, da la fuente de cada cifra
  nueva.

## Entorno

- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`
- `export CARGO_TARGET_DIR=$TMPDIR/f3b2b-target`
- Para ejecutar ejemplos, compila con `cargo build --release -p ogs-cli`.
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- Commits por partes con rutas explícitas. Sin push ni tags.
