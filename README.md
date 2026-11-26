<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="OpenGeoSlide: estabilidad de taludes 2D por equilibrio límite. Sección del caso ACADS 1(a) con la superficie de falla circular crítica y sus dovelas, calculadas por el motor: FS 0,985 con Bishop y 0,984 con Spencer; el valor publicado es 0,987.">
</p>

<p align="center">
  <a href="https://nibaldox.github.io/OpenGeoSlide/"><img alt="Abrir la app" src="https://img.shields.io/badge/Abrir_la_app-sin_instalar-12324a"></a>
  <a href="https://github.com/nibaldox/OpenGeoSlide/releases"><img alt="Release" src="https://img.shields.io/github/v/release/nibaldox/OpenGeoSlide?color=12324a&label=release"></a>
  <a href="LICENSE"><img alt="Licencia Apache-2.0" src="https://img.shields.io/badge/licencia-Apache--2.0-12324a"></a>
  <a href="CITATION.cff"><img alt="Citar" src="https://img.shields.io/badge/citar-CITATION.cff-12324a"></a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/readme/app-editor-dark.png">
    <img src="./assets/readme/app-editor-light.png" width="100%" alt="Editor web de OpenGeoSlide con un talud de 15 m (1,5H:1V) de arcilla sobre roca, con la línea piezométrica punteada en el pie, la superficie crítica en rojo con sus dovelas, y Bishop y Spencer con FS 1,377.">
  </picture>
</p>

<p align="center"><sub>La aplicación web calculando un talud de dos estratos con piezométrica: Bishop y Spencer dan FS 1,377. Capturas de la versión publicada, en tema claro y oscuro.</sub></p>

## Qué es

OpenGeoSlide calcula el **factor de seguridad (FS) de un talud en 2D** por equilibrio límite, con **Bishop simplificado** y
**Spencer**. Usted dibuja o importa la sección (estratos, línea piezométrica, sismo pseudoestático y cargas), el programa
busca la superficie de falla circular con el menor FS y entrega el FS, las dovelas, los avisos del cálculo y un informe PDF.

Está pensado para ingeniería geotécnica (minería a rajo abierto, botaderos, obras civiles), para docencia y para
investigación. Es software libre (Apache-2.0).

La versión actual es la **0.1.0**: el motor (con sismo pseudoestático y cargas), la CLI, el editor web (PWA), el paquete
de Python y las pruebas de aceptación están implementados.

## Por qué es distinto

- **Está verificado y se puede reproducir.** El motor cumple 51 de 51 checks contra valores publicados (21 casos) y
  coincide con el programa independiente cSlope en 28 de 28 búsquedas y 28 de 28 superficies fijas. Es la batería real
  de [`verification/`](verification/), no una muestra. Véase [Verificación](#verificación).
- **Un solo motor.** `ogs-core`, escrito en Rust, se compila a WebAssembly para la web, a un wheel de Python y a la CLI
  `ogs`. Las tres leen el mismo formato `.ogs.json`.
- **Funciona sin conexión.** El cálculo corre en el navegador (WASM), no en un servidor; la web se instala como PWA y,
  una vez cargada, no necesita red.
- **Dice lo que no sabe.** Cada resultado trae avisos (γsat sin verificar, `ru` frente a piezométrica, piezométrica
  extrapolada, Spencer sin raíz) y el informe PDF repite las convenciones de signo.

<p align="center">
  <img src="./assets/readme/engine.svg" width="100%" alt="Diagrama: el motor ogs-core, en Rust, alimenta la aplicación web (WASM y PWA), el paquete Python opengeoslide y la CLI ogs; las tres usan el mismo formato de modelo .ogs.json.">
</p>

## Cómo usarlo

### En el navegador (sin instalar)

1. Abra <https://nibaldox.github.io/OpenGeoSlide/>. Se carga el ejemplo ACADS 1(a), un talud homogéneo seco.
2. Pulse **Comprobar**: obtiene Bishop 0,985 y Spencer 0,984, los mismos valores de la cabecera de este README.
3. Cambie la geometría o los materiales en el lienzo y los paneles, o cree un modelo desde cero con
   «Archivo ▸ Talud simple…» y las herramientas «Dibujar región» y «Dividir región».

Desde el navegador puede instalarla como PWA («Instalar aplicación» en Chrome o Edge). El modelo se guarda como
`.ogs.json`; los resultados, como CSV o informe PDF. La web funciona con teclado y en el móvil, y tiene tema claro y
oscuro y unidades SI o imperiales. Para compilarla en local, véase [`docs/desarrollo.md`](docs/desarrollo.md).

### Python

OpenGeoSlide aún **no está en PyPI ni en crates.io**: se instala desde los assets del
[Release v0.1.0](https://github.com/nibaldox/OpenGeoSlide/releases/tag/v0.1.0). El wheel es `abi3` y sirve para
CPython 3.11 o superior; este es el de Linux x86-64:

```sh
WHL=opengeoslide-0.1.0-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl
pip install "https://github.com/nibaldox/OpenGeoSlide/releases/download/v0.1.0/$WHL"
```

Para macOS (`macosx_11_0_arm64` o `macosx_10_12_x86_64`) y Windows (`win_amd64`), cambie `WHL` por el nombre del `.whl` de
su plataforma, que figura en la página del release. También sirve descargarlo y ejecutar `pip install ./opengeoslide-….whl`.

```python
# desde la raíz del repositorio, donde está examples/
import json, opengeoslide
print(opengeoslide.version())                    # 0.1.0, la versión de ogs-core
report = opengeoslide.analyze(json.load(open("examples/acads1a.ogs.json")))
for r in report["results"]:
    print(r["method"], round(r["fos"], 4), r["status"])
# bishop 0.9851 converged
# spencer 0.9841 converged
```

Más detalle en [`crates/ogs-py/README.md`](crates/ogs-py/README.md).

### CLI (`ogs`)

Requiere [Rust](https://rustup.rs) (el repositorio fija la versión en `rust-toolchain.toml`):

```sh
git clone https://github.com/nibaldox/OpenGeoSlide.git
cd OpenGeoSlide
cargo install --path crates/ogs-cli --locked     # instala `ogs` en ~/.cargo/bin
ogs --version
ogs analyze examples/acads1a.ogs.json            # informe JSON: FS, círculo crítico y dovelas
```

Sin instalar: `cargo build --release -p ogs-cli` deja el binario en `target/release/ogs`. El formato del modelo, con
sismo y cargas, está en [`docs/formato-ogs-json.md`](docs/formato-ogs-json.md).

## Verificación

| Se compara con | Resultado | Informe |
|---|---|---|
| Valores publicados (93 casos) | **213/213** | [REPORT](verification/REPORT.md) |
| cSlope 0.1.0, búsqueda (14 modelos) | **28/28** | [diferencial](verification/differential/REPORT.md) |
| cSlope 0.1.0, superficie fija | **28/28** | [diferencial](verification/differential/REPORT.md) |
| cSlope 0.1.0, M-P, Janbu, no drenado y polilínea (D01-D17) | **43/43** | [diferencial](verification/differential/REPORT.md) |
| Web y `ogs` (275 modelos) | **275/275** | [detalle](docs/verificacion.md) |

- **Valores publicados:** 213 checks de 93 casos de la bibliografía (41 en el esquema v0.1, 5 con sismo o cargas en
  v0.2 y 47 en v0.3), cada uno dentro de su tolerancia: 95 de Bishop, 76 de Spencer, 27 de Morgenstern-Price, 7 de
  Janbu simplificado y 8 de Janbu corregido. Otros 6 checks, en 4 casos, quedan retenidos con su diagnóstico
  ([`verification/pending/`](verification/pending/INDEX.md)).
- **cSlope, búsqueda:** Bishop y Spencer en 14 modelos sintéticos, con el mismo método, dovelas y rangos; el FS de ogs no
  supera en más de 1 % al de cSlope.
- **cSlope, superficie fija:** el mismo círculo en los dos programas; el FS difiere en 0,5 % o menos.
- **cSlope, Fase 3a:** Morgenstern-Price y Janbu corregido sobre el círculo fijo de esos 14 modelos, más tres modelos
  nuevos (terraplén sobre arcilla blanda con Su lineal, relaves con Su constante y un bloque sobre una capa débil con
  polilínea fija), con el mismo criterio de 0,5 %.
- **Web y `ogs`:** abrir y guardar un modelo en la web y luego `ogs analyze` da la misma salida, bit a bit.

Reproducción y detalle (paridad del editor, rendimiento nativo y WASM) en [`docs/verificacion.md`](docs/verificacion.md).
Esta batería no cubre todo: véanse las limitaciones.

## Limitaciones conocidas

- **La búsqueda es solo circular.** Las superficies no circulares se fijan a mano como polilínea; la búsqueda no
  circular es de la Fase 3b. **Bishop simplificado solo admite círculos**; con una polilínea quedan Spencer,
  Morgenstern-Price y Janbu.
- **Solo Mohr-Coulomb y no drenado** (Su constante o lineal con la cota); no hay Hoek-Brown ni SHANSEP. Sin análisis de
  deformaciones, en 3D ni de flujo; el agua entra como piezométrica o como `ru`.
- **Sin refuerzos** (tablestacas, pilotes, anclajes, clavos ni geosintéticos). **No sirve para diseñar muros de tierra
  mecánicamente estabilizada (TEM) ni otras estructuras de contención**: solo para revisar la estabilidad global, con el
  muro modelado como una región de suelo.
- **El peso unitario saturado (γsat) no está verificado** frente a otro programa; ninguno de los 93 casos lo usa.
- **La línea piezométrica se prolonga en horizontal hasta los bordes del modelo** si no los cubre, y `ru` tiene
  precedencia sobre ella; con unidades imperiales, γw debe ser explícito.
- **Sismo solo pseudoestático y cargas solo uniformes o lineales.** Spencer y Morgenstern-Price pueden no hallar
  solución o, con tracción en la base, quedar por debajo de Bishop. En polilíneas con forma de V pueden converger con un
  FS no físico (aviso `interslice_shear_exceeds_strength`): compárelo con Janbu. Revise siempre los avisos.
- **Casos publicados retenidos:** V027, V028 y V068 (aviso de normal efectiva negativa) y V032a (la búsqueda halla un
  mínimo real, más conservador).

El detalle completo, con los avisos y los casos numéricos conocidos del motor, está en
[`docs/limitaciones.md`](docs/limitaciones.md).

## Contribuir, citar y licencia

- **Contribuir:** [`CONTRIBUTING.md`](CONTRIBUTING.md) describe el entorno y el flujo de verificación de un PR. La guía
  para compilar y probar está en [`docs/desarrollo.md`](docs/desarrollo.md). Los problemas de seguridad, según
  [`SECURITY.md`](SECURITY.md).
- **Citar:** [`CITATION.cff`](CITATION.cff) (GitHub ofrece «Cite this repository»). Registro de cambios en
  [`CHANGELOG.md`](CHANGELOG.md).
- **Licencia:** Apache-2.0, véase [LICENSE](LICENSE). Los datos de verificación adaptados de cSlope conservan su
  licencia MIT ([NOTICE](NOTICE)).

> **Aviso.** OpenGeoSlide es software en desarrollo y no es una herramienta certificada. Los resultados deben
> validarse por un profesional competente antes de usarlos en un diseño. El criterio profesional y la
> responsabilidad sobre el diseño son del usuario.

## In English

OpenGeoSlide is free software (Apache-2.0) for 2D limit-equilibrium slope stability (simplified Bishop and Spencer,
circular surfaces, Mohr-Coulomb, pseudo-static seismic loads and surface loads). One Rust engine powers a web app that
runs in your browser and works offline, a Python package and a CLI. It matches 51/51 published values and cSlope in
28/28 searches and 28/28 fixed surfaces. It has no reinforcement (geosynthetics, anchors, nails), so it is not a tool
for designing MSE walls or retaining structures. Try it at <https://nibaldox.github.io/OpenGeoSlide/>, get the wheel
from the [Releases](https://github.com/nibaldox/OpenGeoSlide/releases), and cite it with [`CITATION.cff`](CITATION.cff).
It is not a certified tool: a qualified professional must validate every result.
