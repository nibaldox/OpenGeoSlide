# CM-C2 · Cierre: casos promovidos y documentación de la v0.7

Base: `cm-integracion` en `3ca0f31`, con todo el bloque integrado:
- W1 y W2 (la web);
- CM-V (xslope);
- CM-M (motor v0.7, con las compuertas A1 a A10 en verde: `verification/global/REPORT.md`);
- CM-C1W (la web de la búsqueda global).

El contrato es `briefs/06_CONTRATOS_CM.md`, de F7.0 a F7.7, con las enmiendas E17a a E17d. Las reglas comunes son las de
`briefs/CM_W1_tareas.md` §«Reglas comunes»: commits, cuándo parar e informe.

| Escritor | Worktree / rama | Archivos propios |
|---|---|---|
| **CM-C2V** casos | `opengeoslide-wt/cm-c2v` / `cm-c2v` | `verification/cases/**`, `verification/pending/**`, `verification/REPORT.md`, `verification/report.json`, `verification/tools/import_cslope.py` (solo si hace falta para escribir los casos), y los tests que fijan el conteo de casos o de checks (búscalos con `grep -rn "347\|167 casos\|168"` en `crates/`, `apps/web/src`, `verification/` y `docs/**/e2e`; cada cambio debe ser una cifra que se lee del índice, no otra cifra fija) |
| **CM-C2D** documentación | `opengeoslide-wt/cm-c2d` / `cm-c2d` | `docs/formato-ogs-json.md`, `docs/limitaciones.md`, `docs/verificacion.md`, `docs/cm/CIERRE_CM.md` (nuevo) y `README.md` |

`CHANGELOG.md`, `CITATION.cff`, las versiones de los crates y del wheel, y `briefs/**` son del coordinador.

## CM-C2V · Casos

1. **Promueve a `verification/cases` los 9 checks de F7.6:**
   - V036c, V036d, V039 (2 checks), V041a, V041b, V051 y V098, con `analysis.search.non_circular` de v0.6;
   - **V053 con `analysis.search.non_circular.global: {}`, en v0.7.**

   Sigue el patrón de F3B (`verification/pending/F3B/INDEX.md` y `verification/cases/INDEX.md`, sección «Hoek-Brown y
   búsqueda no circular»). Los problemas que ya tienen un caso con otros checks se llaman `<id>-nc`. Cada check va con su
   fuente y su tolerancia tal como vienen del corpus de cSlope (`$TMPDIR/cslope-src/packages/engine-rs/golden/verification.json`),
   con el criterio de banda del harness.
   - **Las cifras esperadas** son las de `verification/global/REPORT.md` §A3 y las de `models/checks.json`. Si un check
     no pasa la banda con el binario de la integración, no lo promuevas: queda retenido en
     `verification/pending/CM/HOLD.json`, con su causa, como en F6.14.
2. **Actualiza los índices:**
   - `verification/cases/INDEX.md`: los conteos por versión y por método, y la tabla;
   - `verification/pending/F3B/INDEX.md`: la sección «Otros casos con búsqueda no circular» pasa a decir cuáles se
     promovieron en CM;
   - `verification/pending/INDEX.md`: el total de retenidos.
3. **Regenera el informe:**
   - `verification/REPORT.md` y `report.json` con `verification/harness/run.py --cases verification/cases --ogs <bin>`,
     con el binario de la integración (abajo), y con cSlope como segundo oráculo;
   - la columna de xslope (`verification/xslope/run.py`) si los casos nuevos la cambian, porque la búsqueda no circular
     es `Unsupported`.

   Anota las cifras nuevas, que hoy son 347 checks en 167 casos.
4. **Tests que fijan conteos:** `cargo test -p ogs-core --release --test acceptance` y los tests de la web que cuentan
   casos u opciones del selector (`casesVerb.test.ts`, `cases.r15.test.ts`, `ExamplePicker.test.ts` y otros que
   encuentres), con los guiones e2e que leen `verification/cases/INDEX.md` (`u4p_polish` 5b). Cada uno debe pasar y
   **leer** la cifra en lugar de fijarla, si hoy la fija.
5. **Puertas:**
   - `cargo test -p ogs-core --release` (incluida la aceptación);
   - `pytest -q verification`, con `OGS_BIN`, cslope, shapely, jsonschema y xslope;
   - `pnpm typecheck && OGS_BIN=… pnpm test && pnpm build` en `apps/web`;
   - los guiones `docs/fase2/ux/u4p-e2e/u4p_polish.mjs` y `docs/fase2/ux/u3i-e2e/*.mjs` contra tu build, en tu puerto
     5183.

## CM-C2D · Documentación

Las cifras de verificación del README (la tabla «Verificación» y sus viñetas) y de `docs/verificacion.md` §resumen **las
completa el coordinador** con el informe de CM-C2V. Tú escribes el texto y dejas las cifras de casos y checks como
`⟨N⟩`, en un solo lugar por documento, para que se busquen y se reemplacen fácil.
1. **`docs/formato-ogs-json.md`:**
   - una sección «v0.7: búsqueda global no circular» con los campos de F7.1: tipos, valores por defecto, rangos y la
     regla de versión;
   - la salida de F7.2 (los 11 campos de `GlobalStats` y las dos notas), con un ejemplo de entrada y uno de salida
     reales, generados con el binario de la integración sobre V053 (`verification/global/models/V053.json`);
   - el índice de versiones del documento.

   El validador de ejemplos (`docs/tools/validar_ejemplos.py`) debe pasar con el esquema 0.7.
2. **`docs/limitaciones.md`:**
   - en el alcance, la búsqueda global: qué hace y qué no. No es exhaustiva y no se ofrece con Bishop. El bloque
     necesita contactos entre regiones, y si no los hay recurre al recocido. La guarda de tracción puede dejar sin tomar
     un FS menor (y lo avisa). Los taludes sin círculo semilla elegible quedan sin etapa global (E17d, punto 5). El costo
     llega a ~4 veces el circular;
   - en «Lo que sigue fuera», quita lo que ya existe y deja lo pendiente: el *path search* y el PSO, el pulido sin
     generador, los campos de cSlope y los retenidos;
   - en las limitaciones de la web, quita los defectos que W1 y W2 corrigieron (Known issues de la 0.5.0 y de la 0.5.1:
     borradores, pantallas bajas, HUD) y deja lo que siga abierto (`docs/cm/CIERRE_CM.md`, cuando exista).
3. **`docs/verificacion.md`:**
   - una sección «Búsqueda global no circular (v0.7)» con la tabla de compuertas de `verification/global/REPORT.md`
     (A1 a A10 y A2b), cómo se reproducen y la tabla de robustez de E17c;
   - una sección «xslope 1.1.0 como columna informativa», con el texto que propuso CM-V
     (`verification/xslope/README.md` y `REPORT.md`).
4. **`README.md`:**
   - en «Qué es» y «Por qué es distinto», la búsqueda global en una línea;
   - en «Verificación», una fila para la búsqueda global (`verification/global/REPORT.md`) y una para xslope, con las
     cifras como `⟨N⟩` donde dependan de CM-C2V;
   - en «Limitaciones conocidas», lo mismo que en `limitaciones.md`, resumido;
   - en la sección en inglés, el resumen equivalente.
5. **`docs/cm/CIERRE_CM.md`** (nuevo), con el patrón de `docs/suite-a/CIERRE_UA.md`:
   - las olas, las puertas con sus cifras y lo pendiente;
   - la compuerta de los 5 minutos: las tres mediciones de D4 (el KLM de `X35.md` y CM-WC/W2, la prueba a ciegas de
     los registros `deleg_c2d4ab30`, cuyo resumen está en `briefs/CM_W2_tareas.md`, y el protocolo humano de `X35.md`
     §5 y `X35_proto/planilla_humana.csv`, **pendiente del usuario**).

   Las cifras de puertas que no tengas las deja el coordinador como `⟨…⟩`.
6. **Puertas:**
   - `docs/tools/validar_ejemplos.py --ogs <bin>`, en verde;
   - un enlace roto es una falla: revisa con `grep` los anclajes que cambies;
   - estilo: español latinoamericano neutro, sin voseo, frases cortas, como los documentos que ya existen.

## Entorno (los dos)

- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. **El binario de la integración (v0.7) ya está en
  `target/release/ogs` de tu worktree.** Compruébalo: con `global` debe aceptar `"version": "0.7"`.
- CM-C2V tiene `node_modules` y `src/wasm` (v0.7) en `apps/web`. Su puerto es el 5183.
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
