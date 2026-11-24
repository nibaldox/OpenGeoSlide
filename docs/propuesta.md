# OpenGeoSlide: propuesta de producto y estrategia

**Fecha:** 24-nov-2026 · **Estado:** propuesta para decisión · **Autor:** Hermes (perfil open-geoslide)

---

## 1. Objetivo

Crear una herramienta **libre y gratuita** de estabilidad de taludes 2D por equilibrio límite (tipo Slide2), que
funcione **en el navegador** (sin instalar y con los datos en el equipo del usuario) y **en escritorio**, pensada para la comunidad geotécnica.

---

## 2. Diagnóstico: el "Slide libre" genérico ya existe

Situación a noviembre de 2026 (fuentes al final):

| Proyecto | Licencia | Motor / UI | Navegador | Escritorio | Fortalezas | Huecos relevantes |
|---|---|---|---|---|---|---|
| **cSlope** (Ibirico) | MIT | Rust→WASM; TS/React/Electron; `pip install cslope` | Sí (plantillas) | Windows | 187 problemas de verificación; FEM por reducción de resistencia (SRM) y cotas de análisis límite | 3 métodos LEM; enfocado en obras civiles y suelos; su web no menciona Hoek-Brown |
| **xslope** (BYU) | Apache-2.0 | Python; XSLOPE Studio | No | macOS/Windows | 7 métodos; FE seepage + SRM; 1.095 comparaciones en 402 modelos; artículo en SoftwareX 2026 | Entrada por Excel; sin navegador; enfocado en presas y diques |
| **OGR Slip2D** (UPCT) | AGPL-3.0 | Python/PySide6, CLI, MCP | No | Sí | 10 métodos (incl. Sarma); 23 modelos de resistencia (Hoek-Brown, Barton-Bandis, anisotrópicos); seepage transitorio; probabilístico; ES/EN | Pre-release (0.1.x); sin navegador; licencia copyleft fuerte |
| **SSA** (C.-Y. Chen) | n/d | JS en navegador | Sí | No | Búsqueda no circular por programación dinámica; informes Word; 146 verificaciones | 3 métodos; obras civiles; zh/en/ja |
| **Slide2** (Rocscience) | Comercial | — | No | Windows | Referencia de la industria | USD 2.599/año (licencia personal), USD 6.199/año (Flexible+) |

**Conclusión.** En 2026 el núcleo LEM (Bishop, Spencer, Morgenstern-Price y búsqueda de superficie crítica) ya es un commodity.
Construir "otro Slide2 genérico" nos convertiría en el quinto proyecto con el mismo alcance y la misma audiencia.
El valor de alto impacto está en lo que **ninguno cubre bien**:

1. **Minería**: rajos, botaderos, pilas de lixiviación y depósitos de relaves, evaluados con los criterios de aceptación de la industria.
2. **De 3D a 2D**: cortar secciones desde superficies 3D (topografía, pit, contactos, napa) y analizarlas en lote. Hoy eso exige Slide3 o armar las secciones a mano.
3. **Español primero**, con la práctica y la normativa de LatAm (Ley 20.551, guías de Sernageomin, sismicidad chilena y peruana).
4. **Un solo motor** con materiales de roca para navegador, escritorio y Python. cSlope tiene la arquitectura pero no Hoek-Brown; OGR tiene Hoek-Brown pero no navegador.
5. **Interoperabilidad**: no existe un formato común. Cada proyecto usa el suyo (`.cslp`, Excel, `.ogr`, JSON).

---

## 3. Propuesta de valor

> **La herramienta abierta de estabilidad física para minería en Latinoamérica: del modelo 3D a la sección crítica y al
> informe que cumple el criterio, en el navegador y con resultados verificables.**

### Pilar A: minería primero
- **Materiales**: Mohr-Coulomb, Hoek-Brown generalizado (GSI, mi, D) con calculadora, anisotrópico y juntas ubicuas, Barton-Bandis,
  Su y Su/σ'v (relaves), pico/residual y funciones definidas por el usuario.
- **Agua**: piezométricas por material, ru, grilla de presiones interpolada desde piezómetros y superficie piezométrica importada
  desde el modelo hidrogeológico (conecta con los trabajos de drenaje/dewatering).
- **Sismo**: pseudoestático (kh, kv) y, en una fase posterior, desplazamiento de Newmark.
- **Escalas**: banco, interrampa y global (taludes de 500 a 1.000 m), con búsquedas eficientes para geometrías grandes.
- **Retroanálisis**: resistencia a partir de una superficie de falla observada (radar, prismas, inclinómetros).

### Pilar B: criterios de aceptación como código
- **Perfiles versionados y citados**:
  - Read & Stacey (2009): FoS y PoF según escala (banco/interrampa/global) y consecuencia.
  - Práctica habitual bajo GISTM: drenado, no drenado pico y no drenado residual. GISTM no fija valores; los típicos son 1,5 / 1,5 / 1,1.
  - Guía de estabilidad física de Sernageomin (Ley 20.551, cierre de faenas).
  - Eurocódigo 7 (factores parciales).
- Cada perfil es editable, de modo que cada empresa puede cargar su propio estándar.
- **Multiescenario** en una sola corrida (estático, pseudoestático, residual y post-sismo). El informe indica **cumple / no cumple** en cada escenario, con trazabilidad.
- Informe **DOCX/PDF en español** editable.

### Pilar C: de 3D a 2D, en lote
- Importación de STL, OBJ, DXF 3D, CSV de grilla y GeoTIFF: topografía, pit, contactos geológicos y napa.
- Secciones automáticas (radiales alrededor del rajo o perpendiculares a una polilínea de diseño).
- Análisis en lote (Web Workers en el navegador, multihilo en escritorio).
- **Mapa en planta de FoS y PoF por sector**, con un informe por sector.

### Base: confianza verificable
- **Repositorio abierto de benchmarks** (CC-BY-4.0). Cada caso registra su fuente bibliográfica, el valor publicado y la tolerancia.
  Fuentes previstas: ACADS, Fredlund & Krahn, USACE EM 1110-2-1902 y manuales de verificación publicados.
- **Verificación cruzada**: un harness ejecuta los mismos casos en nuestro motor, en cSlope (`pip install cslope`) y en xslope
  (`pip install xslope`), y publica una **matriz de concordancia** en cada release.
- **Esquema JSON abierto** (`.ogs` = zip con JSON y adjuntos), con conversores desde y hacia los otros proyectos y DXF.
  Se propondrá al ecosistema como estándar de intercambio.
- Resultados **deterministas**, informe de verificación por versión y **DOI de Zenodo** por release.
- La falta de convergencia (Spencer, M-P) **siempre se informa** en cada superficie; nunca se oculta.

---

## 4. Arquitectura propuesta

```
            ┌──────────────── ogs-core (Rust, sin I/O, f64 determinista) ────────────────┐
            │ geometría · materiales · dovelas · métodos LEM · búsqueda · probabilístico │
            └───────┬──────────────────┬───────────────────┬──────────────────┬──────────┘
                    │                  │                   │                  │
              wasm-bindgen          nativo (rayon)        PyO3               CLI
                    │                  │                   │                  │
        Web Worker pool          Tauri 2 desktop      pip install        lotes / CI
        React + TS (PWA)         (misma UI React)     opengeoslide       verificación
                    │
         esquema .ogs (JSON Schema versionado) · conversores DXF/CSV/STL · informes DOCX/PDF
```

| Decisión | Elección | Razón |
|---|---|---|
| Motor | Rust | Un solo código compila a WASM (navegador), nativo multihilo, Python y CLI. cSlope ya validó este patrón |
| UI | React + TypeScript + Vite | Stack que el equipo ya domina; editor CAD 2D sobre Canvas/SVG |
| Escritorio | Tauri 2 (alternativa: Electron) | Motor nativo multihilo, instalador liviano, la misma UI |
| Web | PWA offline, cero subida de datos | Requisito de confidencialidad de las mineras |
| GPU | WebGPU opcional (fase 4) | Útil para Monte Carlo × búsqueda. Soporte aún incompleto en Linux/Firefox → siempre con respaldo WASM |
| Python | Wheel `opengeoslide` | Jupyter, automatización y adopción académica |
| Formato | JSON Schema versionado | Interoperable, diffeable, validable |

Contrato mínimo del motor (borrador):

```rust
pub fn analyze_surface(model: &Model, surface: &SlipSurface, method: Method) -> SurfaceResult; // FoS, dovelas, diagnóstico
pub fn search(model: &Model, opts: &SearchOptions) -> SearchResult;                            // crítica + candidatas
pub fn probabilistic(model: &Model, opts: &ProbOptions) -> ProbResult;                         // PoF, β, histogramas
// SurfaceResult.status ∈ {Converged, NotConverged{iter, residual}, Inadmissible{reason}}
```

---

## 5. Estrategia de motor: opciones

| Opción | Ventajas | Desventajas | Tiempo a MVP |
|---|---|---|---|
| **1. Motor Rust propio, acotado a minería (recomendada)** | Control total sobre Hoek-Brown, anisotropía y escala de rajo; licencia propia; las 3 plataformas | Más trabajo inicial; curva de aprendizaje de Rust (se mitiga con agentes y verificación estricta) | 3-4 meses |
| 2. Construir sobre el motor de cSlope (MIT) | Lo más rápido; motor ya verificado | Dependencia de un mantenedor externo; Hoek-Brown y anisotropía habría que aportarlos upstream | 4-6 semanas |
| 3. Contribuir a OGR Slip2D (AGPL) | Autor hispanohablante con perfil minero; mucha funcionalidad | Python/PySide6 no corre en el navegador; AGPL; no cumple el requisito web | — |

**Recomendación:** opción 1, con una capa `SolverAdapter` que permita usar cSlope y xslope como **oráculos** en CI.
También conviene contactar al autor de OGR Slip2D para acordar un esquema y un repositorio de benchmarks comunes:
colaborar en verificación, sin depender de su código.

---

## 6. Hoja de ruta con compuertas

> Estimaciones orientativas para 1 persona orquestando agentes.

| Fase | Duración | Entregable | Compuerta de salida |
|---|---|---|---|
| **0. Spike** | 2-3 semanas | Esquema `.ogs` v0.1; Bishop + Spencer en Rust→WASM; 10 casos ACADS; harness contra cSlope/xslope; demo web mínima | Error ≤1 % frente al valor publicado; tiempos medidos en navegador vs. nativo; decisión Tauri/Electron |
| **1. MVP "Slide básico en el navegador"** | 2-3 meses | Editor 2D (polilíneas, importación DXF/CSV); MC, Hoek-Brown y Su; piezométricas y ru; cargas; sismo pseudoestático; búsqueda circular (grilla + refinamiento) y no circular (path + recocido simulado); Bishop, Janbu corregido, Spencer y GLE/M-P; vista de dovelas y fuerzas; informe PDF en español; PWA offline | ≥60 benchmarks públicos en verde; primer FoS de un usuario nuevo en <5 min |
| **2. Minería** | ~3 meses | Anisotropía y juntas ubicuas, Barton-Bandis, pico/residual; perfiles Read & Stacey, GISTM, Sernageomin y EC7; multiescenario; Monte Carlo/LHS con PoF; retroanálisis; soportes (pernos, cables, geosintéticos); informe DOCX | ≥120 benchmarks; validación con 3 casos reales anonimizados |
| **3. 3D→2D y lotes** | ~3 meses | Importación STL/OBJ/DXF-3D/GeoTIFF; secciones automáticas; lote multihilo; mapa FoS/PoF en planta; escritorio Tauri; wheel Python y CLI | Rajo de prueba con ≥36 secciones en lote; v1.0 con ≥150 casos verificados y DOI |
| **4. Ecosistema** | continuo | Servidor MCP; API de plugins; base de materiales; PT/EN; WebGPU; Newmark; puente a FE seepage/SRM vía formato (xslope, OGR) | Comunidad activa; uso en docencia |

### Fase 0: tareas concretas (lista para ejecutar)
1. Repositorio `opengeoslide` (monorepo): `crates/ogs-core`, `crates/ogs-wasm`, `crates/ogs-py`, `apps/web`, `verification/`, `schema/`.
2. `schema/ogs-0.1.json`: geometría por regiones, materiales (MC), piezométrica, superficie circular.
3. `ogs-core`: dovelas + Bishop simplificado + Spencer, con diagnóstico de convergencia.
4. `verification/`: 10 casos (ACADS 1a, 1b, 2a…, Fredlund & Krahn 1977), cada uno con su fuente y tolerancia.
5. Harness en Python: corre `ogs-py`, `cslope` y `xslope` sobre los casos → tabla de concordancia en Markdown.
6. `apps/web`: página mínima que carga un `.ogs`, ejecuta la búsqueda en un Worker y dibuja la superficie crítica.
7. Benchmark de rendimiento: búsqueda de 10.000 círculos con Spencer, navegador vs. nativo.

---

## 7. Fuera de alcance (por ahora)

FEM por reducción de resistencia, flujo FE transitorio, LEM 3D y análisis dinámico. xslope y OGR ya cubren varias de estas
capacidades; la vía para integrarlas es **interoperar mediante el formato**, no duplicarlas en la v1.

---

## 8. Licencia y gobernanza

- **Motor y app: Apache-2.0 (recomendada).** Es permisiva, incluye concesión de patentes y es compatible con cSlope (MIT) y xslope (Apache).
  Universidades y consultoras pueden integrarla, lo que maximiza la adopción.
  - *Alternativa AGPL-3.0*: impide forks SaaS cerrados, pero reduce la adopción corporativa y hace que compartir código con proyectos permisivos funcione en un solo sentido.
- **Benchmarks y esquema**: CC-BY-4.0 / CC0.
- **Descargo de responsabilidad profesional** visible; el criterio de ingeniería sigue siendo del usuario.
- **Regla de contribución**: todo resultado numérico se valida contra una referencia externa, nunca contra un snapshot del propio programa.
- **Comunidad**: documentación en español primero; acercamiento a universidades (UChile, PUC, USACH, UCN, PUCP, UNI) y a SOCHIGE;
  cursos y ejemplos de rajo, botadero y relave; GitHub Discussions.

---

## 9. Riesgos y mitigación

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Campo saturado (4+ proyectos libres) | Alto | Nicho minero + 3D→2D + interoperabilidad; posicionarse como hub, no como clon |
| Responsabilidad por uso en diseño | Alto | Verificación pública, informe de verificación por versión, descargo, versiones con DOI |
| Robustez numérica (Spencer/M-P sin convergencia) | Medio | Solvers con respaldo (Newton → Brent); estado por superficie; pruebas de casos difíciles |
| Dependencia de una sola persona | Medio | Gobernanza abierta, alianzas académicas, código legible y bien documentado |
| Curva de Rust | Medio | Agentes + compuertas de benchmarks; spike de fase 0 antes de comprometerse |
| Crecimiento descontrolado del alcance (querer FEM pronto) | Medio | Fuera de alcance explícito; interoperar en lugar de duplicar |

---

## 10. Métricas de éxito

- v1.0 con **≥150 casos verificados**: error ≤1 % frente al valor publicado, o dentro del rango de los programas comerciales.
- **Primer FoS en <5 min** para un usuario nuevo en el navegador.
- **Lote de ≥36 secciones** de un rajo con mapa de FoS en planta.
- En 12 meses: **≥3 cursos universitarios** y **≥5 consultoras** usándola; ≥10 contribuidores externos.

---

## 11. Decisiones pendientes (del usuario)

1. **Nicho principal**: minería LatAm (recomendado) o geotecnia civil general.
2. **Motor**: Rust propio + oráculos (recomendado), construir sobre cSlope o contribuir a OGR.
3. **Licencia**: Apache-2.0 (recomendada), AGPL-3.0 o MIT.
4. **Nombre**: OpenGeoSlide (provisional).

---

## Fuentes

- cSlope: https://www.cslope.com/ · https://github.com/ZilanCiftci/cslope · https://pypi.org/project/cslope/
- xslope: https://github.com/njones61/xslope · https://xslope.org · Jones & Williams (2026), *SoftwareX* 36, 103018
- OGR Slip2D: https://github.com/samuelsl27/OGR-Slip2D · https://opengeorock.org
- SSA: https://cychen59.github.io/ssa-slope-stability/
- Precios de Slide2: https://www.rocscience.com/plans-pricing/price-list
- GISTM, criterios usuales de FoS: https://www.knightpiesold.com/en/news/publications/risk-and-informed-approach-to-tsf-design-and-operation/
- Guía de estabilidad física de Sernageomin (Ley 20.551): https://investigadores.anid.cl//es/public_search/work?id=478482
- Estado de WebGPU, oct-2026: https://github.com/meow-sci/brutal-browser-poc/blob/main/docs/research/webgpu/webgpu-status-and-browser-support-2026.md
- Read, J. & Stacey, P. (2009). *Guidelines for Open Pit Slope Design*. CSIRO Publishing.
