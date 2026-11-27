# Desarrollo

Guía para compilar, probar y orientarse en el repositorio. Para contribuir al código, lea también
[`CONTRIBUTING.md`](../CONTRIBUTING.md). Para usar OpenGeoSlide sin compilar nada, vaya al [README](../README.md).

## Estructura del repositorio

- `crates/ogs-core/`: motor (modelo, geometría, dovelas, métodos, búsqueda, informe). Los métodos están en
  `src/methods/` (`bishop`, `spencer`, `morgenstern_price`, `janbu`); `src/surface.rs` representa la superficie (círculo
  o polilínea) y `src/strength.rs` resuelve la resistencia por dovela (Mohr-Coulomb y no drenado).
  - `src/water.rs` es el **agua embalsada** (formato v0.5, E15c): `ponded_terms` calcula por dovela el peso, el empuje y
    sus momentos de la región entre la piezométrica y el terreno, más el término de `ru`; `apply_ponded` los suma a la
    dovela y, sin agua sobre el terreno, no toca nada (identidad byte a byte).
  - `src/crack.rs` es la **grieta de tracción** (E15d): `locate` halla `x_c` y la profundidad (fija o automática) y
    `truncate` quita la masa del lado de la cresta y suma el empuje `Pw` a la dovela de la cara. `lib.rs` los llama solo
    si existe `analysis.tension_crack`; en una búsqueda, un candidato que no alcanza la grieta se descarta.
  - Ninguno de los dos agrega campos a `Slice`: usan `weight_extra`, `h_force`, `h_moment_base` y `driving_extra`
    (E15h, [`fase3/g0/NOTAS.md`](fase3/g0/NOTAS.md)).
  - `src/reinforcement.rs` incluye el **pilote de Ito-Matsui** (formato v0.5, E15i): `PileProfiles` guarda, por cada
    `pile` con `lateral_pressure`, un `PileProfile` con `z`, `F(z) = ∫p dz` y `Q(z) = ∫p·z dz` en los nodos de una
    rejilla de 0,05 m (`pressure_step` da el equivalente en pies). Se construye **una sola vez por análisis**, porque la
    presión no depende de la superficie, y la búsqueda lo reutiliza en cada candidato (`crossing_nodes_with` y
    `apply_with_state_using`); sin ese pilote está vacío y no cuesta nada, de modo que el código de un modelo sin él es el
    de la v0.4. En un cruce, `force_at` interpola `F(zf)`, calcula el brazo `L_m = (zf·F − Q)/F` y aplica el tope de
    `capacity` (`min(F, shear, moment/L_m)`, con `governs` en `soil`, `shear` o `bending`). Los coeficientes de la
    fórmula, con el piso de φ = 0, están en `ito_matsui_coefficients`, y el aviso `ito_matsui_spacing_range` en
    `ito_matsui_out_of_range`.
- `crates/ogs-cli/`: binario `ogs`.
- `crates/ogs-wasm/`: wrapper WebAssembly (`wasm-bindgen`).
- `schema/ogs-0.1.schema.json`: JSON Schema del formato `.ogs.json` v0.1.
- `schema/ogs-0.2.schema.json`: JSON Schema del formato `.ogs.json` v0.2 (agrega `loads` y `analysis.seismic`; acepta también v0.1).
- `schema/ogs-0.3.schema.json`: JSON Schema del formato `.ogs.json` v0.3 (agrega material no drenado, superficie polilínea,
  Morgenstern-Price, Janbu y `analysis.interslice`; acepta también v0.1 y v0.2).
- `schema/ogs-0.4.schema.json`: JSON Schema del formato `.ogs.json` v0.4 (agrega `reinforcements`: anclajes, clavos,
  geosintéticos, pilotes y tablestacas; acepta también v0.1 a v0.3). Lo reemplaza el 0.5, que acepta todas las versiones.
- `schema/ogs-0.5.schema.json`: JSON Schema del formato `.ogs.json` v0.5 (agrega `analysis.tension_crack` y, en un `pile`,
  `lateral_pressure` y `capacity`; acepta también v0.1 a v0.4). Es el vigente: lo valida `docs/tools/validar_ejemplos.py`
  y lo compara con el motor `verification/tools/test_schema.py`.
- `apps/web/`: aplicación web (React y Vite): editor gráfico, importación DXF/CSV, informe PDF y PWA; ver [`apps/web/README.md`](../apps/web/README.md).
- `verification/`: casos publicados (`cases/`), checks retenidos (`pending/`), harness y batería diferencial frente a
  cSlope, importador (`tools/import_cslope.py`) y pruebas en Python.
- `docs/tools/validar_ejemplos.py`: valida los ejemplos de [`formato-ogs-json.md`](formato-ogs-json.md) contra el
  esquema 0.5 y contra `ogs analyze` (estado, FS, `status` de `reinforcement_forces`, avisos, el objeto `tension_crack` y
  los campos `soil_force`, `governs` y `arm` del pilote de Ito-Matsui).
- `bench/`: medición de rendimiento (`bench/RESULTS.md`).
- `briefs/`: contratos normativos de cada fase (`00_CONTRATOS.md`, `01_CONTRATOS_FASE1.md`, `02_CONTRATOS_FASE3.md`, `03_CONTRATOS_REFUERZOS.md`, `04_CONTRATOS_GRIETA_AGUA.md`).
- `examples/acads1a.ogs.json`: caso ACADS 1(a), talud homogéneo seco.

## Compilar y probar

```sh
cargo build --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p ogs-core --lib                                # tests unitarios (modelo)
cargo test -p ogs-core --test acceptance -- --nocapture     # aceptación: 327/327 checks publicados (151 casos)
cargo test -p ogs-core --release --no-fail-fast             # todas las pruebas del motor
cargo run -p ogs-cli -- --version
cargo build -p ogs-wasm --target wasm32-unknown-unknown --release
```

Para la paralelización de la búsqueda en nativo: `cargo build -p ogs-core --features parallel`
(desactivada por defecto; wasm no la usa). Las pruebas deben pasar también con `--features parallel`
(`cargo test -p ogs-core --release --no-fail-fast --features parallel`): el resultado es idéntico bit a bit.

## Probar un modelo y validar la documentación

```sh
cargo build --release -p ogs-cli
target/release/ogs analyze examples/acads1a.ogs.json        # informe JSON; sale con código 2 si el modelo es inválido
# Tiempos de la búsqueda de un caso con analysis.search (un registro JSON por método; --method all = los cinco).
# Usa la mayor versión entre la del caso y la que el método necesita: un caso 0.4 con refuerzos se mide tal cual.
target/release/ogs bench verification/cases/V037.json --reps 5 --method bishop

# Ejemplos de docs/formato-ogs-json.md contra schema/ogs-0.5.schema.json y contra ogs analyze
# (cada ejemplo y fragmento lleva una marca <!-- ogs-ejemplo ... --> u <!-- ogs-fragmento ... -->; véase el docstring del script)
env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema python docs/tools/validar_ejemplos.py

# Pruebas en Python (importador de cSlope, esquemas, ida y vuelta de la web con Node 22)
uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest \
  python -m pytest -q verification
```

Los comandos para regenerar los informes de verificación están en [`verificacion.md`](verificacion.md#reproducir).

## Identidad con una versión anterior

Cada bloque del formato promete que un modelo sin los campos nuevos da la **misma salida, byte a byte**, que la versión
anterior. Lo comprueba `verification/tools/identity_vs_baseline.py`, que corre `ogs analyze` con un binario de
referencia y con el nuevo sobre los casos, los modelos retenidos, la batería diferencial y los ejemplos, en cinco
variantes (`own`, `search`, `fixed`, `search@0.4` y `fixed@0.4`), y compara stdout, stderr y el código de salida.

```sh
# el binario de referencia: un worktree desprendido del commit de la versión (aquí, la v0.3.0)
git worktree add --detach "$TMPDIR/base" v0.3.0
CARGO_TARGET_DIR="$TMPDIR/base-target" cargo build --release -p ogs-cli --manifest-path "$TMPDIR/base/Cargo.toml"
cargo build --release -p ogs-cli        # `cargo test` NO recompila target/release/ogs
env -u PYTHONPATH -u PYTHONHOME python3 verification/tools/identity_vs_baseline.py \
  --normalize-version --include-reinforced --base "$TMPDIR/base-target/release/ogs" --new target/release/ogs
```

- **`--normalize-version`** reemplaza el número de versión del motor en stdout y stderr (`ogs-core 0.3.0` por
  `ogs-core <VERSION>`) antes de comparar. Hace falta cuando el binario nuevo tiene otra versión que el de referencia.
- **`--include-reinforced`** corre también los modelos con `reinforcements`. Un baseline de la v0.3.0 o posterior los
  lee; el de la v0.2.0 no, y por omisión se saltan.
- **La excepción del agua embalsada (F5.1).** Los modelos cuya piezométrica pasa sobre el terreno cambian de resultado a
  propósito, porque ahora incluyen el agua embalsada. La herramienta los **separa y los informa por su nombre**, con las
  variantes que difieren; no los oculta ni cuentan como diferencia. Para los modelos sin refuerzos, la lista se imprime
  aparte (18 en el corpus actual)
  ([Limitaciones](limitaciones.md#excepción-a-la-identidad-con-la-v030-agua-sobre-el-terreno)).
- **Excepciones declaradas (E15j-8).** `--exceptions` (por omisión, `verification/tools/identity_exceptions.json`) lista
  `{modelo, variante, campos, motivo, enmienda}`. Si la única diferencia de un modelo y una variante está en los `campos`
  permitidos (rutas JSON con `*` por segmento, como `results.*.search.evaluated`), se informa como «EXCEPCIÓN» y no
  cuenta; si hay otro campo, otro modelo, otro estado o stderr, cuenta. Hoy declara V019 en `search` y `search@0.4`
  ([Limitaciones](limitaciones.md#segunda-excepción-a-la-identidad-con-la-v030-contacto-de-aire-capilar-v019-e15j-8)).
- **La tercera excepción (γw por defecto en imperial, E15l-6 y E15m-6)** no necesita una entrada en
  `identity_exceptions.json`: ninguno de los 15 modelos imperiales del corpus usa agua, así que la compuerta no lo ve.
  Un archivo imperial con agua y sin `water.unit_weight` cambia de FS frente a la v0.3.0 a propósito
  ([Limitaciones](limitaciones.md#tercera-excepción-a-la-identidad-con-la-v030-γw-por-defecto-en-imperial-e15l-6-e15m-6)).

El resultado esperado es «0 diferencias» para todo lo demás, con salida `ok` en el baseline.

## Batería diferencial F3G

El bloque F3G de [`verification/differential/`](../verification/differential/README.md) (modelos D28 a D42, en
`cases_f3g/`) compara el motor con cSlope en grieta de tracción y agua embalsada (D28 a D39): embalse al pie y en una
cara de presa, grieta seca, llena y automática, y sus combinaciones (también con sismo y con arcilla no drenada), y en
pilotes de Ito-Matsui (D40 a D42, sobre el talud de Cai y Ugai: φ = 0, c-φ con la fuerza en el cruce y tope de corte, y
bajo el agua). Cada uno va en búsqueda y en superficie fija, con Bishop y Spencer. Es el cuarto bloque de `run.py`; antes
de correr, una sonda comprueba que el motor tenga las **tres** capacidades (agua embalsada, grieta y `lateral_pressure`,
esta última con X22-V013c) y, si no, deja los checks en pendiente en lugar de fallar. `--require-f3g` hace que un check
pendiente, con fallo o sin dato termine con código 5; úsese al integrar. Los comandos para regenerarlo están en
[`verificacion.md`](verificacion.md#reproducir).

Los tests del motor de este bloque están en `crates/ogs-core/tests/` (`f3g_types.rs`, `f3g1a_water.rs`,
`f3g1b_crack.rs` y `f3g_rows.rs`, con las filas de `tests/data/f3g/rows/` migradas desde el oráculo; y `f3g3_ito.rs`,
con las 28 filas de X22 de `tests/data/f3g3/rows/`, el espejo, el equilibrio global y la monotonía de la fuerza con
S/D). El importador promueve V013b a V013e desde `verification/pending/F3I/` a `verification/cases/` (`import_cslope.py
--promote-f3i`, idempotente), y el conversor `to_cslope.py` traduce `lateral_pressure` y `capacity` al oráculo.

Qué casos de `verification/cases/` reciben de verdad el peso y el empuje del agua embalsada en la superficie de su check
(y cuáles no, E15l-10) lo mide `docs/fase3/r12/p-medir_agua_embalsada.py target/release/ogs`; la tabla está en
[`verificacion.md`](verificacion.md#qué-casos-ejercitan-de-verdad-el-agua-embalsada-e15l-10-r12a-11).

Para generar el paquete JS a partir del `.wasm` hace falta `wasm-bindgen-cli` 0.2.130, la misma
versión que fija el crate.

## Probar el paquete de Python

Los tests de `crates/ogs-py/tests` (incluidos `test_v04.py`, con las filas de refuerzos de X17, y `test_v05.py`, con los
ejemplos de [`formato-ogs-json.md`](formato-ogs-json.md), las filas de X21 y X22 de `crates/ogs-core/tests/data/f3g*/` y
las reproducciones de `docs/fase3/r12/repro/` y `docs/fase3/r13/repro/`; por eso se corren desde la raíz del repositorio) corren contra el **wheel
instalado**, no contra el código fuente. Con `uv`, un wheel de producción y un venv en `$TMPDIR`:

```sh
export TMPDIR=/ruta/a/un/directorio/temporal
cd crates/ogs-py
env -u PYTHONPATH -u PYTHONHOME uv run --python 3.13 --no-project --with maturin maturin build --release --out "$TMPDIR/ogs-py-dist"
uv venv -p 3.13 "$TMPDIR/ogs-py-venv"
VIRTUAL_ENV="$TMPDIR/ogs-py-venv" uv pip install --reinstall "$TMPDIR"/ogs-py-dist/*.whl pytest
cd ../..
OGS_PY_TEST_HOOKS=0 "$TMPDIR/ogs-py-venv/bin/python" -m pytest crates/ogs-py/tests -q
```

Tras cambiar el motor o el docstring hay que recompilar el wheel y reinstalarlo (`--reinstall`). Los tests de
R12 y R13 de `test_v05.py` (E15l-1, E15l-5, E15l-6, E15l-7 y E15l-11; E15m-1, E15m-2, E15m-6, E15m-7 y E15m-15) corren
sin marcas `xfail`: si uno falla, el motor perdió esa enmienda. Los tests de pánico
necesitan un segundo wheel con `--features test-hooks` ([`crates/ogs-py/README.md`](../crates/ogs-py/README.md)).

## Compilar la web en local

Para compilarla en local (Node 22, pnpm 11 y, para el motor real, el target `wasm32-unknown-unknown` y
`wasm-bindgen-cli` 0.2.130):

```sh
apps/web/scripts/build-wasm.sh          # genera el motor WASM en apps/web/src/wasm/
cd apps/web
pnpm install --frozen-lockfile
pnpm test
VITE_BASE=/OpenGeoSlide/ pnpm build     # genera apps/web/dist/ (sin VITE_BASE, la base es «/»)
pnpm preview
```

Sin el paso del WASM, la web usa un motor simulado que no es válido para ingeniería (véase
[`apps/web/README.md`](../apps/web/README.md)).

## Compilar el wheel de Python desde el código fuente

Para compilarlo desde el código fuente (necesita Rust y [maturin](https://www.maturin.rs)):

```sh
git clone https://github.com/nibaldox/OpenGeoSlide.git
cd opengeoslide/crates/ogs-py
scripts/prepare-license-files.sh                 # copia LICENSE y NOTICE junto a pyproject.toml
pip install maturin
maturin build --release --out dist
pip install dist/opengeoslide-*.whl
```

Más detalle del paquete en [`crates/ogs-py/README.md`](../crates/ogs-py/README.md).
