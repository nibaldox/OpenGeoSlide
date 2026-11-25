# OpenGeoSlide

[**Aplicación web**](https://nibaldox.github.io/OpenGeoSlide/) ·
[Repositorio](https://github.com/nibaldox/OpenGeoSlide) ·
[Releases](https://github.com/nibaldox/OpenGeoSlide/releases) ·
[Licencia Apache-2.0](LICENSE)

Software libre (Apache-2.0) para el análisis de estabilidad de taludes 2D por equilibrio límite
(Bishop simplificado y Spencer). El motor está escrito en Rust y compila a binario nativo y a WebAssembly.

> **Estado: versión 0.1.0.** El motor (con sismo pseudoestático y cargas), la CLI, el editor web (PWA), el paquete
> Python y los tests de aceptación están implementados. Resumen de la verificación en
> [Estado de verificación](#estado-de-verificación).

## Instalación

OpenGeoSlide aún **no está en PyPI ni en crates.io**: se instala desde la web, desde el código fuente o desde los
assets del [GitHub Release](https://github.com/nibaldox/OpenGeoSlide/releases).

### Web

No requiere instalación: abra <https://nibaldox.github.io/OpenGeoSlide/>. El cálculo corre en su navegador (motor en
WebAssembly). La aplicación es una PWA: desde el navegador se puede instalar («Instalar aplicación» en Chrome o Edge)
y funciona sin conexión una vez cargada.

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
[`apps/web/README.md`](apps/web/README.md)).

### CLI (`ogs`)

Requiere [Rust](https://rustup.rs) (el repositorio fija la versión en `rust-toolchain.toml`):

```sh
git clone https://github.com/nibaldox/OpenGeoSlide.git
cd opengeoslide
cargo install --path crates/ogs-cli --locked     # instala `ogs` en ~/.cargo/bin
# o, sin instalar: cargo build --release -p ogs-cli   (binario en target/release/ogs)
ogs --version
ogs analyze examples/acads1a.ogs.json
```

### Python (`opengeoslide`)

Wheel `abi3` para CPython 3.11 o superior. Como el paquete no está en PyPI, instale el wheel del GitHub Release de la
versión (el nombre depende de la plataforma; elija el de la suya en la página del release):

```sh
pip install https://github.com/nibaldox/OpenGeoSlide/releases/download/v0.1.0/opengeoslide-0.1.0-cp311-abi3-<plataforma>.whl
```

`<plataforma>` es la etiqueta del wheel del asset: `manylinux…x86_64` (Linux), `macosx_…_arm64` o `macosx_…_x86_64`
(macOS) o `win_amd64` (Windows). También sirve descargar el `.whl` y hacer `pip install ./opengeoslide-….whl`.

Para compilarlo desde el código fuente (necesita Rust y [maturin](https://www.maturin.rs)):

```sh
git clone https://github.com/nibaldox/OpenGeoSlide.git
cd opengeoslide/crates/ogs-py
scripts/prepare-license-files.sh                 # copia LICENSE y NOTICE junto a pyproject.toml
pip install maturin
maturin build --release --out dist
pip install dist/opengeoslide-*.whl
```

```python
import json, opengeoslide
print(opengeoslide.version())
report = opengeoslide.analyze(json.load(open("examples/acads1a.ogs.json")))
```

Más detalle en [`crates/ogs-py/README.md`](crates/ogs-py/README.md).

## Estructura

- `crates/ogs-core/`: motor (modelo, geometría, dovelas, métodos, búsqueda, informe).
- `crates/ogs-cli/`: binario `ogs`.
- `crates/ogs-wasm/`: wrapper WebAssembly (`wasm-bindgen`).
- `schema/ogs-0.1.schema.json`: JSON Schema del formato `.ogs.json` v0.1.
- `schema/ogs-0.2.schema.json`: JSON Schema del formato `.ogs.json` v0.2 (agrega `loads` y `analysis.seismic`; acepta también v0.1).
- `apps/web/`: aplicación web (React y Vite): editor gráfico, importación DXF/CSV, informe PDF y PWA; ver [`apps/web/README.md`](apps/web/README.md).
- `verification/`: casos publicados, harness y batería diferencial frente a cSlope, y pruebas en Python.
- `examples/acads1a.ogs.json`: caso ACADS 1(a), talud homogéneo seco.

## Compilar y probar

```sh
cargo build --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test -p ogs-core --lib                                # tests unitarios (modelo)
cargo test -p ogs-core --test acceptance -- --nocapture     # aceptación: 51/51 checks publicados
cargo run -p ogs-cli -- --version
cargo build -p ogs-wasm --target wasm32-unknown-unknown --release
```

Para la paralelización de la búsqueda en nativo: `cargo build -p ogs-core --features parallel`
(desactivada por defecto; wasm no la usa).

Para generar el paquete JS a partir del `.wasm` hace falta `wasm-bindgen-cli` 0.2.130, la misma
versión que fija el crate.

## Formato v0.2: sismo y cargas

El motor acepta `version: "0.1"` y `"0.2"`. Los campos `loads` y `analysis.seismic` solo se admiten con `"0.2"`; con
`"0.1"` el motor responde `InvalidModel: los campos 'loads' y 'analysis.seismic' requieren version "0.2"`. Un modelo sin
estos campos da el mismo resultado en las dos versiones. Esquema: [`schema/ogs-0.2.schema.json`](schema/ogs-0.2.schema.json).

```json
{
  "format": "opengeoslide",
  "version": "0.2",
  "meta": { "id": "ejemplo-sismo-cargas", "title": "Talud con sobrecarga y sismo" },
  "units": "SI",
  "materials": [
    { "id": "soil", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 15.0, "friction_angle": 26.0 }
  ],
  "regions": [
    { "material": "soil", "polygon": [[0, -8], [0, 10], [10, 10], [25, 0], [40, 0], [40, -8]] }
  ],
  "water": { "unit_weight": 9.81 },
  "loads": [
    { "type": "udl",  "id": "u1", "x1": 7.0, "x2": 10.0, "q": 20.0 },
    { "type": "line", "id": "l1", "x": 4.0, "p": 100.0, "angle": 15.0 }
  ],
  "slope": { "direction": "left_to_right" },
  "analysis": {
    "methods": ["bishop", "spencer"],
    "slices": 50,
    "seismic": { "kh": 0.1, "kv": 0.0 },
    "search": { "type": "circular_entry_exit" }
  }
}
```

Con la búsqueda por defecto, este modelo da Bishop 1,2723 y Spencer 1,2704 (`ogs analyze`).

- `loads` va después de `water` y antes de `slope`. Cada carga puede llevar un `id` (único).
  - `udl`: carga vertical `q` ≥ 0 (kPa; psf en imperial) sobre el terreno entre `x1` < `x2`, dentro del rango x del modelo.
  - `line`: carga lineal `p` ≥ 0 (kN/m; lbf/ft en imperial) en `(x, y_top(x))`. `angle` en [−90°, 90°] desde la vertical
    hacia abajo; el positivo inclina la carga hacia +x del modelo.
- `analysis.seismic`: `kh` en [0, 1) y `kv` en (−1, 1). `kh·W` actúa en el sentido del deslizamiento; con `kv > 0`, `kv·W`
  actúa hacia abajo. Se aplican al peso del suelo, nunca a las cargas.
- Una carga que no toca ninguna dovela de suelo de la superficie reportada da la nota `load_outside_mass`.

## Estado de verificación

- **Aceptación:** 51/51 checks publicados cumplen su tolerancia, en 21 casos (`verification/cases/`): 16 casos del
  esquema v0.1 y 5 con sismo o cargas del esquema v0.2 (V102a, V102b, V081a, V081b, V097a).
  Test: `cargo test -p ogs-core --test acceptance`.
- **Paridad entre el editor y el motor** (E12j): el editor web y `ogs-core` aceptan y rechazan los mismos documentos.
  La prueba `apps/web/src/editor/state/parity.test.ts` ejecuta 51 pruebas (25 contra el binario `ogs` real, con `OGS_BIN`;
  sin él se omiten) y corre en CI sin casos omitidos.
- **Ida y vuelta de la web** (E12g): para 113 modelos (51 checks de los 21 casos, 56 de la batería diferencial y 6 de
  frontera), `openOgsJson` + `saveOgsJson` y luego `ogs analyze` dan el mismo código de salida y la misma salida, bit a bit,
  que el modelo original. Test: `verification/tools/test_web_roundtrip.py` (necesita Node 22 y el binario compilado).
- **Harness frente a cSlope:** cSlope 0.1.0 reproduce 51/51 de esos mismos checks publicados.
- **Batería diferencial** (ogs frente a cSlope 0.1.0, 14 modelos sintéticos, bishop y spencer; D11-D14 con sismo y cargas):
  - búsqueda (`FS_ogs ≤ FS_cSlope · 1,01`, mismo método, dovelas y rangos): **28/28** OK. D13 (carga lineal) fija
    `min_width = 5 m`: sin él, cSlope encuentra un círculo de 0,67 m bajo la carga (FS 0,614) que ogs descarta por
    `min_m_alpha`;
  - superficie fija (`|Δ| ≤ 0,5 %`): **28/28** OK. D03 spencer es una concordancia (ambos motores declaran la superficie
    sin solución);
  - resultados y diagnóstico de D13 en [`verification/differential/REPORT.md`](verification/differential/REPORT.md) y
    [`verification/differential/README.md`](verification/differential/README.md).
- **Bench** (V047a, búsqueda 20 × 20 × 20 con refinamiento, 50 dovelas; mediana de 5 repeticiones):

  | método | nativo, 1 hilo (ms) | Chrome headless, WASM (ms) | Chrome / nativo |
  |---|---:|---:|---:|
  | Bishop simplificado | 51,08 | 52,70 | 1,03 |
  | Spencer | 177,75 | 185,40 | 1,04 |

  Es una medición de spike en una sola máquina: sirve para el orden de magnitud, no para comparar versiones.
  Detalle y gate de FS en [`bench/RESULTS.md`](bench/RESULTS.md).

- **Informes:**
  - [`verification/REPORT.md`](verification/REPORT.md): aceptación y harness frente a cSlope.
  - [`verification/differential/REPORT.md`](verification/differential/REPORT.md): batería diferencial.
  - [`docs/reviews/`](docs/reviews/): revisiones adversariales de la Fase 0.

> **Aviso.** OpenGeoSlide es software en desarrollo y no es una herramienta certificada. Los resultados deben
> validarse por un profesional competente antes de usarlos en un diseño. El criterio profesional y la
> responsabilidad sobre el diseño son del usuario.

## Limitaciones conocidas

Limitaciones que las revisiones adversariales ([`docs/reviews/`](docs/reviews/)) dejaron abiertas, más las que dejó la
verificación de la ola B. Cada una indica el síntoma y el aviso que lo acompaña. Ninguna cambia la aceptación (51/51)
ni la batería diferencial (28/28 + 28/28 en D01-D14).

- **R4-01, selección de la raíz de λ en Spencer (resuelto por E12e):** entre varias raíces admisibles, Spencer elige
  la de menor F (conservadora), y a igualdad la de menor |λ|. Con la selección anterior (menor |λ|) 47 de 1008 casos
  bicapa diferían más de 1 % de cSlope. Aviso: `multiple_admissible_roots` (nota) cuando hay más de una raíz admisible.
  Residual: cuando cSlope sigue otra raíz, ogs puede quedar por debajo de cSlope (caso R4-01 (2): −7,08 %), por
  elegir la raíz de menor F, y con la nota `multiple_admissible_roots`.
- **R5-05, Spencer con tracción (decidido tras X7: se mantiene E12e):** cuando aparecen juntas las notas
  `multiple_admissible_roots` y `negative_effective_normal_major`, el FS de Spencer puede corresponder a una rama con
  tracción y quedar por debajo de Bishop (hasta −14,30 % frente a cSlope en la familia bicapa de superficie fija de X7;
  −13,9 % en R5-2). Se recomienda revisar Bishop y la distribución de N′. La alternativa evaluada (descartar las raíces con N′
  mayor si hay otra admisible) corrige 49 de 67 casos por debajo de cSlope, pero crea 9 por encima (hasta +10,13 % en
  superficie fija y +7,50 % en búsqueda), lo que contradice el criterio conservador. Evidencia:
  [`docs/fase1/exploracion/X7.md`](docs/fase1/exploracion/X7.md). Aviso: `multiple_admissible_roots`,
  `negative_lambda` y `negative_effective_normal_major`.
- **E12f, cargas lineales fuera del bloque analizado:** una carga lineal que cae a más de `1e-9·ancho` del modelo fuera
  del bloque de suelo analizado no actúa, aunque esté muy cerca del pie de la superficie. Dentro de esa tolerancia, y en
  las fronteras de dovela o los extremos del bloque, sí actúa (reparto 50/50 entre dovelas compartidas). Aviso:
  `load_outside_mass`.
- **Cargas lineales y superficies locales (D13):** una carga puntual o lineal puede generar bajo ella círculos
  diminutos con m_α < `min_m_alpha` (en D13, un círculo de 0,67 m con FS 0,614 en cSlope, que avisa `low-m-alpha`).
  ogs los rechaza (E4b). Conviene fijar `search.min_width` (D13 usa 5 m, y entonces ogs y cSlope coinciden en
  +0,03 %) y revisar aparte la capacidad de soporte local bajo la carga: un análisis de estabilidad global no la cubre.
- **R4-02, paso fijo de 0,05 en el barrido de λ:** dos raíces admisibles dentro del mismo paso no se detectan y el
  resultado es `no_lambda_root`, aunque cSlope converge (p. ej., c_top = 74,05: cSlope 1,914138 y ogs sin FS).
  Aviso: `no_lambda_root`, con estado `not_converged` y sin FS.
- **R4-03a, avisos de búsqueda:** `truncated_driving_mass` solo se evalúa en la superficie final. Si el círculo crítico
  ganador no está truncado, el aviso de un bloque descartado motriz de un candidato truncado se pierde.
  Aviso: ninguno en ese caso.
- **Frontera de `min_width` (E11d′):** la búsqueda no alcanza la frontera ancho = `min_width`. En el botadero de
  dos bancos con `min_width = 10`, ogs da 0,855 frente a 1,142 de cSlope (conservador). Aviso:
  `effective_width_below_min` y `truncated_mass`.
- **Bloques descartados que salen por una pared lateral (E11e′):** no se pueden clasificar, así que solo reciben la
  nota `truncated_mass`, aunque sean motrices. Aviso: `truncated_mass`.
- **`unit_weight_sat` sin cobertura:** ninguno de los 21 casos de verificación (los 5 de la ola B tampoco) usa
  `unit_weight_sat`. La ruta de peso saturado bajo la piezométrica no está verificada frente a cSlope. Aviso: ninguno.

## Licencia

Apache-2.0. Véase [LICENSE](LICENSE).
