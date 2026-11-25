# Guía de contribución

Gracias por querer mejorar OpenGeoSlide. Esta guía resume cómo preparar el entorno y qué debe pasar antes de que un
cambio se acepte. Al participar, acepta el [Código de conducta](CODE_OF_CONDUCT.md). Los problemas de seguridad se
informan según [SECURITY.md](SECURITY.md), nunca en un issue público.

El proyecto se publica bajo Apache-2.0 y las contribuciones se licencian igual (sección 5 de la licencia). Los datos
de verificación adaptados de cSlope conservan su licencia MIT (ver `NOTICE`).

## Entorno

- Rust estable (el archivo `rust-toolchain.toml` lo selecciona, con `rustfmt`, `clippy` y el target
  `wasm32-unknown-unknown`). Versión mínima admitida: 1.85.
- Node 22 y pnpm 11.8.0 (el campo `packageManager` de `apps/web/package.json` fija la versión).
- `wasm-bindgen-cli` **0.2.130**, exactamente la versión del crate `wasm-bindgen = "=0.2.130"`. Una versión distinta
  provoca un error de «schema version mismatch» en tiempo de ejecución.
- `uv` para Python (el oráculo cSlope 0.1.0 viene en un wheel de PyPI; no hay que compilarlo).

## Flujo de verificación obligatorio de un PR

Un PR no se fusiona si falla alguno de estos pasos. CI (`.github/workflows/ci.yml`) los ejecuta todos; ejecútelos en
local antes de abrir el PR.

### 1. Formato, lints y tests del motor

```sh
cargo fmt --all --check
cargo clippy --workspace --exclude ogs-py --all-targets --locked -- -D warnings
cargo test --workspace --exclude ogs-py --release --locked
```

### 2. Aceptación (38/38 checks publicados)

```sh
cargo build --release --locked -p ogs-cli
cargo test --release --locked -p ogs-core --test acceptance -- --nocapture
```

Compara el motor con los valores publicados de los casos de `verification/cases/`. Un cambio en el cálculo no puede
degradar ningún check ni ampliar su tolerancia sin justificarlo en el PR.

### 3. Harness frente al oráculo cSlope

```sh
export OUT="$(mktemp -d)"
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out "$OUT/harness"
```

Resultado esperado: `ogs={'OK': 38, ...}` y `cslope_reproduces=38/38`. Use siempre `--out` fuera del repositorio:
por defecto estos scripts escribirían `REPORT.md` y `report.json` en el árbol de trabajo.

### 4. Batería diferencial y pytest de verificación

```sh
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/differential/run.py --ogs target/release/ogs --out "$OUT/diff"
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest \
  python -m pytest -q verification
```

Resultado esperado: búsqueda 20/20 y superficie fija 20/20. Si su cambio altera el cálculo, adjunte al PR el
resultado de los pasos 2 a 4 antes y después. Los `REPORT.md` versionados de `verification/` solo se regeneran en un
commit propio y explicado.

### 5. Web

```sh
apps/web/scripts/build-wasm.sh
cd apps/web
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test && pnpm build
```

`pnpm build` debe dejar un `.wasm` en `dist/`; sin él, la aplicación caería en el motor simulado sin avisar. Para
probar el despliegue bajo una subruta: `VITE_BASE=/OpenGeoSlide/ pnpm build`.

### 6. Wheel de Python (si toca `crates/ogs-py` o `ogs-core`)

```sh
crates/ogs-py/scripts/prepare-license-files.sh   # copia LICENSE y NOTICE junto al pyproject.toml
cd crates/ogs-py
uv run --python 3.13 --no-project --with maturin --with ziglang \
  maturin build --release --locked --zig --compatibility manylinux2014 --out "$OUT/wheels"
```

Compruebe con `unzip -l` que el wheel contiene `*.dist-info/licenses/LICENSE` y `NOTICE`.

## Reglas de código

- Un cambio por PR, con commits pequeños y mensajes en español que digan el porqué.
- El motor es determinista: la ejecución paralela debe dar resultados idénticos bit a bit a la serial.
- No se versionan binarios generados (`dist/`, `apps/web/src/wasm/`, `target/`).
- No porte ni lea código de proyectos con licencia incompatible (por ejemplo AGPL). Las referencias se citan por su
  bibliografía.

## Publicación (mantenedores)

- Versiones: `Cargo.toml` raíz (`[workspace.package]`); `CHANGELOG.md` se actualiza en cada PR relevante.
- Un tag `v*` ejecuta `wheels.yml` (PyPI con Trusted Publishing, environment `pypi`) y `release.yml` (GitHub Release y
  `cargo publish --dry-run`). Publicar en crates.io es manual: ejecutar `release.yml` con `publish_crates` sobre el tag,
  con el secret `CARGO_REGISTRY_TOKEN` y el environment `crates-io`.
