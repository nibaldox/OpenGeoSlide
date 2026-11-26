# Brief F3A-C: cierre de la Fase 3a, dos escritores Sonnet en paralelo

Responde en **español neutro, sin voseo**.

**Lee primero, completos:**
- `briefs/02_CONTRATOS_FASE3.md`, normativo, incluidas F3.10 (E13j) y la enmienda **E13j-6** de abajo;
- `briefs/F3A_integracion.md`, cuyas reglas siguen vigentes;
- las notas de `docs/fase3/{im,iw,w1a,w1b,w1e,w1f,w1v}/`.

**Base:** la rama `f3a-integracion`, en `addc9bb`. Contiene las olas 0 y 1, e I-M e I-W integrados.

**Estado medido por el coordinador:**
- **Motor:** 285 tests, 0 fallas. Aceptación con **90 casos y 208 checks, 0 fallas**.
- **Web:** `tsc` limpio, pero **fallan 32 tests** en 9 archivos: `reportInput`, `pdf`, `content`, `content.geotech`,
  `content.polyline`, `pdf.polyline`, `palette`, `docTemplates` y `exampleTitles`. Es un efecto de la promoción:
  - los casos promovidos, como V047a, ahora llevan métodos 0.3, y esos tests los pasan al **motor simulado**, que los
    rechaza por F3.9 (`InvalidModel: el motor simulado no admite analysis.methods "morgenstern_price"`);
  - `exampleTitles.ts` no tiene títulos para los 90 casos.

**Reglas:**
- Nunca relajes tolerancias, umbrales ni datos.
- Un test RED antes de cada cambio.
- Commits con rutas explícitas y **sin push**.
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python siempre con
  `env -u PYTHONPATH -u PYTHONHOME`.
- Al final, borra los worktrees y servidores temporales, estos últimos por su PID.

## Enmienda E13j-6, decidida por el coordinador
- **Escala de los residuos de fuerza** de Spencer, M-P y Janbu, es decir, del cierre `|E_n| ≤ 1e-6·escala`, del
  residuo de momento y de la raíz de F₀:
  ```
  escala = max(ΣW, ΣW*)
  ```
  W* es el peso con sismo y cargas de E12b.
  - Sin cargas y con kv ≤ 0, se conserva bit a bit el valor actual.
  - **Motivo:** con suelo casi sin peso (γ = 1e-6, problemas de Prandtl V018, V077 y V078), ΣW es 10⁷ veces menor
    que las fuerzas que mueven la masa, y el cierre no puede alcanzarse en doble precisión.
- E3 (`no_driving`, con `ΣT ≤ 1e-6·ΣW`) no cambia.
- La guarda `negative_effective_normal_major` y su umbral **no cambian**. V027, V028 y V068 siguen retenidos.
- **V032a sigue retenido.**
  - La búsqueda encuentra un mínimo real más conservador: un talud infinito en el relleno con c = 0, con FS 1,1706.
    cSlope da 1,17055 sobre ese mismo círculo.
  - Ese mínimo sale de los rangos efectivos declarados.
  - Se documenta en `docs/limitaciones.md` y en el índice de retenidos.

---

## C-M: motor, verificación y documentación (worktree `f3cm`, rama `f3cm-motor`)

**Archivos tuyos:**
- `crates/**`, `verification/**` y `schema/**`;
- `docs/{formato-ogs-json,limitaciones,verificacion}.md`;
- `CHANGELOG.md`;
- `briefs/02_CONTRATOS_FASE3.md`, solo para copiar literalmente la enmienda E13j-6 de este brief en F3.10.

**Tareas**, por prioridad:
1. **E13j-6:**
   - aplica `docs/fase3/im/escala_fuerzas.patch`, ajustado a `max(ΣW, ΣW*)`;
   - test RED con V077 y V078;
   - identidad byte a byte de todos los modelos actuales (90 casos, 14 de la batería y `acads1a`) contra un binario
     de `addc9bb`;
   - promueve V018, V077 y V078 si cumplen.
2. **E13j-4, raíz de F₀ en Janbu.**
   - La sonda de I-M midió **0 llamadas con más de una raíz admisible**, en 370 403 llamadas. Sus «errores de
     ejecución» fueron casos v0.1 forzados a Janbu sin subir la versión: no cuentan.
   - Por la regla de E13j-4, se adopta **la menor raíz admisible**, con la nota `multiple_admissible_roots`.
   - Deja un test sintético con dos raíces admisibles, y verifica la identidad byte a byte.
3. **Robustez de Spencer y M-P:**
   - **a.** W1e reportó que Spencer no converge en un círculo fijo no drenado en la web y en la CLI. Los fixtures
     están en `docs/fase3/w1e/` y en `apps/web/src/editor/state/units*.test.ts`, con los valores 60, −1,5 y 20.
   - **b.** I-W reportó una polilínea intermedia en la que Spencer da `not_converged`, mientras M-P da 5,597 y Janbu
     corregido 2,653; está en los logs de `$TMPDIR` de I-W.
     - Si no la encuentras, genera polilíneas aleatorias admisibles sobre el talud simple de dos estratos y busca
       casos donde Spencer no converja y M-P sí.
   - En cada caso:
     - compara con el oráculo, que con M-P `constant` equivale a Spencer;
     - diagnostica la causa (barrido de λ, raíz, admisibilidad o arranque);
     - corrígelo **dentro del contrato**. Si no se puede, repórtalo con números.
     - Una diferencia de FS tan grande entre M-P y Janbu en la misma polilínea es sospechosa: revísala.
4. **Batería diferencial** con los métodos nuevos, con el criterio de 0,5 %:
   - ejecuta y regenera `verification/differential/REPORT.md`;
   - regenera `verification/REPORT.md` y `report.json`;
   - corre el harness sobre `pending/F3`.
5. **Documentación:**
   - `docs/formato-ogs-json.md`: el formato v0.3 completo, con ejemplos que validen contra el esquema;
   - `docs/limitaciones.md`:
     - Bishop solo en círculos;
     - la búsqueda sigue siendo circular;
     - el ajuste al terreno por primer cruce;
     - ξ en la x del modelo y el espejo solo con f simétrica;
     - V032a;
     - lo que queda para F3b y los refuerzos, con tablestacas, pilotes y anclajes;
   - `docs/verificacion.md`: cifras leídas de los informes;
   - `CHANGELOG.md`.
6. **Gates:**
   - `cargo fmt --all --check`;
   - `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
   - `cargo test -p ogs-core --release --no-fail-fast`, también con `--features parallel`;
   - aceptación;
   - `uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification`.

**Presupuesto:** unas 100 iteraciones, con la prioridad indicada.

---

## C-W: web (worktree `f3cw`, rama `f3cw-web`, puertos 5186 y 5187)

**Archivos tuyos:**
- `apps/web/**`;
- `docs/fase3/{iw,w1e,w1f}/**`;
- `docs/fase2/ux/*-e2e/**`, solo para actualizar expectativas obsoletas, con un comentario del motivo.

**Tareas**, por prioridad:
1. **Los 32 tests rotos**, sin bajar ninguna aserción:
   - los tests de informe y PDF deben usar un modelo v0.1 o v0.2 explícito, derivado del caso con sus métodos
     Bishop y Spencer (como hizo I-M en `loads_seismic.rs`), o el WASM o `OGS_BIN` real;
   - **el motor simulado debe seguir rechazando 0.3**;
   - `exampleTitles.ts` necesita un título en español para cada uno de los 90 casos, tomado del `title` y la fuente
     del caso, y su test debe leer el índice.
2. **La polilínea inicial que propone la web no es admisible.** Al pasar de círculo a polilínea, la cuerda propuesta
   pasa sobre el vértice del pie, y el resultado es `polyline_outside_ground` en la web y en la CLI.
   - La propuesta debe ser **admisible por construcción**: puntos del arco bajo el terreno, densificados o bajados
     donde una cuerda quede sobre el terreno, y comprobados con la misma regla que el motor.
   - Test con al menos los ejemplos de «Talud simple…» con y sin estrato, V047a y un talud con berma.
   - **Chrome:** pasar a polilínea y calcular de inmediato con Spencer y M-P debe converger.
3. **`w1e_polilinea.mjs`** se cae tras el paso 8d: `openMenu(Archivo)` con el foco en la tabla de la función de
   interfaz. Determina si es un defecto de foco o de los atajos y corrígelo, o corrige el guion si es un error del
   guion. Debe quedar 0 FAIL y exit 0.
4. **Regresión completa** con `docs/fase3/iw/e2e/run_regression.sh`, contra `vite preview`.
   - Cuenta `^FAIL` y entrega la tabla completa.
   - Incluye axe en claro y oscuro de las vistas nuevas.
5. **PDF del modelo b de I-W** (`docs/fase3/iw/e2e/`): rasterízalo y **revísalo con visión**, y deja escrita la
   conclusión. Debe mostrar la polilínea en la figura, el método, la función, f₀ y la tabla de Su, sin solapes.
6. **Gates:**
   - `tsc`;
   - `pnpm test` con `OGS_BIN`, sin omitidos y 0 fallas;
   - `pnpm build`.

**Presupuesto:** unas 90 iteraciones, con la prioridad indicada.
