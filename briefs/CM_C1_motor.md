# CM-C1 · Motor de la búsqueda global no circular (formato v0.7)

Base: `cm-integracion`, con el contrato ya commiteado. Contrato normativo: `briefs/06_CONTRATOS_CM.md`, de F7.0 a F7.7.
Léelo entero antes de empezar, junto con estos documentos:
- `docs/cm/exploracion/X33.md`: el mapa del motor, el gancho y las trampas de versión de §2.4;
- `docs/cm/exploracion/X37.md`: el prototipo y sus cifras;
- `docs/cm/exploracion/X37_proto/global.py`: el código que se porta: `contact_layers`, `gen_block`, `gen_sa`,
  `polish` y `SplitMix64`;
- `docs/cm/exploracion/X37_proto/models.py`: los 40 modelos.

Las cifras de referencia del motor v0.5.1 están en `X37_proto/resultados_x37.csv`.

| Escritor | Worktree / rama | Archivos propios |
|---|---|---|
| **CM-M** motor | `opengeoslide-wt/cm-m` / `cm-m` | `crates/**` (incluidos los tests de Rust y de `ogs-py`), `schema/ogs-0.7.schema.json` (nuevo), `verification/tools/test_schema.py`, `verification/tools/identity_vs_baseline.py` (solo si hace falta una bandera para v0.7) y `verification/global/**` (nuevo) |

No toques `apps/web/**` (lo escribe otro escritor contra el contrato), ni `docs/**`, `README.md`, `CHANGELOG.md`,
`briefs/**` o `verification/cases/**`, que son del coordinador o de la ola C2. Si necesitas cambiar uno de esos archivos,
deja el diff en tu informe.

## Partes

1. **C0, tipos y puerta de versión:**
   - `GlobalSpec` en `model.rs`, con F7.1, `deny_unknown_fields` y los valores por defecto en una sola constante;
   - `FORMAT_VERSION_V07` y `first_v07_field`;
   - las listas de `loads.rs`, **incluida la trampa del `!=`** (X33 §2.4, punto 5);
   - `validate_v07` con los rangos;
   - `GlobalStats` en `search.rs`, con `skip_serializing_if`;
   - el esquema `schema/ogs-0.7.schema.json` y `test_schema.py` con `SCHEMA_07`;
   - el texto de `USAGE` de la CLI y el docstring del wheel.

   Agrega primero los tests RED de forma, versión y rangos (Rust y `ogs-py`), y deja la tubería como un stub que no
   hace nada.
   - **Compuerta de C0:** identidad A1 en verde con el stub.
   - Haz un commit al terminar C0: el coordinador puede empezar a integrar la web con los tipos.
2. **C1, la tubería:** `crates/ogs-core/src/global.rs` con F7.3 (capas, `block`, `annealing`, selección, refinamiento,
   pulido y determinismo) y F7.4 (la guarda).
   - Saca las ventanas de `refine` a una función compartida (X33 §1.4), y que `refine` acepte polilíneas de partida.
   - El evaluador guardado necesita las notas de la solución: hoy `evaluate_surface` (`lib.rs:801-863`) devuelve solo
     `Option<f64>`. Agrega una variante que devuelva también las notas, **sin cambiar** el camino de v0.6.
   - Las notas de F7.2.
   - Unit tests de:
     - el PRNG, con valores fijos de SplitMix64 y la semilla 0;
     - las capas en V053 y en un talud homogéneo sin capas;
     - la admisibilidad de los candidatos;
     - la guarda, con una superficie de V051 que tenga `negative_lambda`;
     - la monotonía;
     - el determinismo con y sin `parallel`;
     - los rangos.
3. **C1, medición:** `verification/global/run.py` mide las compuertas A2 a A9 con el binario `ogs`:
   - **Modelos:** los 40 de X37, construidos como lo hace `X37_proto/models.py`. Los 24 taludes se generan en código;
     V053 y los demás vienen de `$TMPDIR/cm-x32/pending/` y `synthetic/`, y de `verification/cases/*-nc.json`.
   - **Modelos que viven en `$TMPDIR`:** copia sus `model` a `verification/global/models/`, para que la medición no
     dependa del scratch.
   - **Para cada modelo**, con y sin `global: {}`: el FS, el `winner`, los contadores, las notas y el tiempo (3
     repeticiones).
   - **La polilínea ganadora del generador, evaluada en cSlope** como superficie fija, con
     `verification/harness/to_cslope.py` y el oráculo `$TMPDIR/oracle-venv/bin/python`, o con `uv run` y
     `cslope==0.1.0`.
   - **Salida:** `verification/global/REPORT.md` y `REPORT.json`, con una tabla por compuerta y su veredicto.
   - **La comparación con el prototipo (A9):** corre `X37_proto/global.py` hasta el mejor candidato antes de refinar,
     sobre el wheel 0.5.1. El venv ya existe en `$TMPDIR/cm-x37/venv`.
4. **Iteración.** Si una compuerta no pasa, ajusta dentro del contrato. Las constantes del prototipo se pueden calibrar
   con una cifra. Si para pasar hay que cambiar el contrato, por ejemplo la guarda, el presupuesto o la regla de las
   capas, **para** y reporta las cifras con tu propuesta: el coordinador decide y escribe la enmienda E17.

## Reglas

- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y
  `export CARGO_TARGET_DIR=$TMPDIR/cm-m/target`. No compiles en otro directorio de destino. Python siempre con
  `env -u PYTHONPATH -u PYTHONHOME`.
- **Puertas**, desde tu worktree:

  ```bash
  cargo fmt --all --check
  cargo clippy --workspace --exclude ogs-py --all-targets -q -- -D warnings
  cargo test -p ogs-core --release --no-fail-fast -q
  cargo test -p ogs-core --release --no-fail-fast -q --features parallel
  cargo test -p ogs-core --release --test acceptance -- --nocapture   # "checks" al final
  cargo build --release -p ogs-cli && cargo test -p ogs-cli --release -q
  env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with jsonschema --with pytest python -m pytest -q verification/tools
  env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project python verification/tools/identity_vs_baseline.py --normalize-version --include-reinforced --include-v05 --with-v06 --base $TMPDIR/cm-base/ogs --new $CARGO_TARGET_DIR/release/ogs --out $TMPDIR/cm-m/identity
  ```

  - **El wheel:** `cd crates/ogs-py && bash scripts/prepare-license-files.sh`, luego `maturin build --release` con
    `$TMPDIR/r15p-venv/bin/maturin`, instala el wheel en `$TMPDIR/r15p-venv` y corre `pytest -q tests`.
  - **Antes de empezar**, anota las cifras de la base (los tests pasados de cada suite y los checks de aceptación). Al
    final, ningún test existente puede fallar ni haberse borrado.
- **Commits:**
  - uno por parte, como mínimo, con mensaje `CM-M: …`;
  - `git add` con rutas explícitas;
  - sin push y sin merge.
- **No copies código de cSlope ni de OGR.** El prototipo `X37_proto/global.py` es del proyecto y se porta.
- **Informe final:**
  - commits (hash y mensaje);
  - archivos;
  - las cifras de cada puerta, antes y después;
  - la tabla de compuertas A1 a A10 con sus cifras, junto con la ruta de `REPORT.md`;
  - decisiones;
  - propuestas de enmienda, si hay;
  - diffs para archivos ajenos;
  - las líneas propuestas para el CHANGELOG y para `docs/formato-ogs-json.md` y `docs/limitaciones.md`;
  - pendientes, en orden de prioridad.
