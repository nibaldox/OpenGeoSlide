# OpenGeoSlide: contratos congelados, Fase 0 (v0.1)

> Documento normativo para todos los subagentes. **No se modifica sin pasar por el coordinador.**
> Si un contrato parece incorrecto, repórtalo en tu resumen final; no lo cambies por tu cuenta.

- Repositorio: `/home/xodla/archivos/opengeoslide` (rama `main`). Licencia Apache-2.0.
- Toolchain verificado: Rust 1.97.1 (edition 2024), target `wasm32-unknown-unknown` instalado,
  `wasm-bindgen` CLI 0.2.130, Node 22.23, pnpm 11.8, uv 0.13.5, Python 3.14.9 (3.13 disponible vía uv),
  Google Chrome 158 (`google-chrome-stable`).
- Idioma: identificadores y comentarios de código en inglés; documentación de usuario, README y resúmenes en español neutro.

---

## 1. Formato de modelo `.ogs.json` v0.1

Unidades: el motor no convierte unidades. Todas las magnitudes deben ser coherentes entre sí: SI (m, kN, kPa, kN/m³)
o imperial (ft, lbf, psf, pcf). `units` es informativo. γw se declara explícitamente en `water.unit_weight`.
Los ángulos de entrada se expresan en **grados**.

```json
{
  "format": "opengeoslide",
  "version": "0.1",
  "meta": { "id": "V047a", "title": "ACADS 1(a)", "notes": "texto libre opcional" },
  "units": "SI",
  "materials": [
    {
      "id": "soil",
      "name": "Soil",
      "model": "mohr_coulomb",
      "unit_weight": 20.0,
      "unit_weight_sat": null,
      "cohesion": 3.0,
      "friction_angle": 19.6,
      "ru": null
    }
  ],
  "regions": [
    { "material": "soil", "polygon": [[20,20],[20,25],[30,25],[50,35],[70,35],[70,20]] }
  ],
  "water": {
    "unit_weight": 9.807,
    "piezometric_line": [[0,12.0],[40,6.0],[55,6.0]]
  },
  "slope": { "direction": "auto" },
  "analysis": {
    "methods": ["bishop", "spencer"],
    "slices": 50,
    "tolerance": 1e-5,
    "max_iterations": 500,
    "min_m_alpha": 0.2,
    "surface": { "type": "circle", "xc": 120.0, "yc": 90.0, "r": 80.0 },
    "search": {
      "type": "circular_entry_exit",
      "entry": [49.9, 55.2],
      "exit": [26.9, 30.2],
      "n_entry": 20,
      "n_exit": 20,
      "n_radius": 20,
      "max_radius_factor": 5.0,
      "min_width": null,
      "refine": true
    }
  }
}
```

Reglas:

- **`regions`**: polígonos simples, sin auto-intersecciones, que no se solapan (pueden compartir aristas).
  Se aceptan en sentido horario y antihorario. El polígono va cerrado implícitamente (no se repite el primer vértice).
  La **superficie del terreno** es la envolvente superior de todas las regiones: `y_top(x)` es la mayor intersección
  de la vertical `x` con las aristas. La **base del modelo** es la envolvente inferior, `y_bottom(x)`.
- **`materials[].model`**: en v0.1 solo existe `"mohr_coulomb"`. Para φ = 0 (no drenado) se usa `friction_angle: 0` y `cohesion = Su`.
- **`unit_weight_sat`**: si no es null, la parte de una dovela que queda bajo la línea piezométrica usa γ_sat; la parte sobre ella usa γ.
- **Presión de poros en la base de una dovela** (material = el de la base):
  1. si el material tiene `ru` no nulo: `u = ru · σv`, con `σv = Σ γ_k · h_k` (columna vertical en el punto medio de la base);
  2. si no, y existe `water.piezometric_line`: `u = γw · max(0, y_piezo(x_mid) − y_base_mid)`;
  3. en otro caso, `u = 0`.
  - `y_piezo` se interpola linealmente.
  - Fuera de su rango en x se usa la extrapolación constante del extremo más cercano.
- **Agua sobre el terreno** (embalse o laguna) **no se soporta en v0.1**. Si `y_piezo > y_top` dentro de la masa deslizante,
  el motor la ignora (no añade peso de agua) y el informe lo señala con un `warning`.
- **`water.unit_weight`** es opcional; por defecto vale 9.81. `water` y `piezometric_line` también son opcionales.
- **`slope.direction`**: `"auto" | "left_to_right" | "right_to_left"` indica **hacia dónde se mueve la masa**.
  **Resolución de `auto`** (enmienda E1, reemplaza a la regla original). Se aplica en `PreparedModel::new`, en este orden:
  1. Si `analysis.search` trae **ambos** rangos, `entry` y `exit`, y sus puntos medios difieren en más de 1e-9 · ancho,
     la masa va de la entrada a la salida: `left_to_right` si `mid(entry) < mid(exit)` y `right_to_left` en caso contrario.
     Si los puntos medios coinciden, se pasa al punto 2 (enmienda E1b).
  2. Si no, y `|y_top(x_min) − y_top(x_max)| > 1e-6 · (y_max − y_min del modelo)`: el extremo más alto es el
     coronamiento (`y_top(x_min) > y_top(x_max)` → `left_to_right`).
  3. Si no, y hay un círculo fijo en `analysis.surface`: el cruce arco-terreno **más alto** es la entrada, y la masa se
     mueve hacia el más bajo. Si hay empate (< 1e-6 relativo), se aplica el punto 4.
  4. En cualquier otro caso: `OgsError::InvalidModel("no se puede determinar el sentido del deslizamiento: indique slope.direction")`.
  - Un modelo simétrico (por ejemplo, una presa con dos taludes) **siempre** necesita el sentido explícito o rangos de búsqueda.
- **`analysis`**:
  - Si hay `surface` y no hay `search`, se analiza esa superficie fija.
  - Si hay `search`, se busca la superficie crítica e `surface` se ignora.
  - Si no hay ninguna, se produce el error `NoSurface`.
- **`search.entry`** es el rango en x del punto de **entrada** (cuesta arriba, coronamiento) y **`exit`** el del punto de
  **salida** (cuesta abajo, pie).
  - Si se omiten, ambos rangos abarcan toda la extensión x del terreno.
  - `min_width` por defecto vale 1 % del ancho del modelo.
- **Defaults**: `methods ["bishop"]`, `slices 50`, `tolerance 1e-5` (relativa en FS), `max_iterations 500`,
  `min_m_alpha 0.2`, `n_entry 20`, `n_exit 20`, `n_radius 20`, `max_radius_factor 5.0`, `refine true`.
- **Métodos en v0.1**: `"bishop"` (Bishop simplificado) y `"spencer"` (Spencer = Morgenstern-Price con f(x) = 1).

---

## 2. Caso de verificación `verification/cases/<id>.json`

```json
{
  "id": "V047a",
  "title": "ACADS 1(a), homogeneous slope, dry",
  "model": { "...": "modelo .ogs.json v0.1 completo (sección 1)" },
  "checks": [
    {
      "method": "bishop",
      "kind": "search",
      "published": 0.987,
      "published_by": "Commercial program A",
      "tolerance": 0.0251,
      "options": { "slices": 50 }
    }
  ],
  "source": {
    "reference": "Giam, P.S.K. & Donald, I.B. (1989). ACADS ...",
    "derived_from": "cSlope verification problem V047a (MIT License), https://github.com/ZilanCiftci/cslope",
    "notes": ["..."]
  }
}
```

- `kind` vale `"fixed"` (se usa `model.analysis.surface`) o `"search"` (se usa `model.analysis.search`).
- `tolerance` es **relativa**: el check pasa si `|FS − published| / published ≤ tolerance`.
- `options.slices` es opcional y sobrescribe `model.analysis.slices` en ese check.

---

## 3. API de `ogs-core` (Rust)

Módulos y firmas **congeladas**. Los nombres de campos públicos no cambian.

```rust
// model.rs: serde (Deserialize + Serialize), snake_case, campos opcionales con #[serde(default)]
pub type Point = [f64; 2];
pub struct Model { pub format: String, pub version: String, pub meta: Meta, pub units: Option<String>,
                   pub materials: Vec<Material>, pub regions: Vec<Region>, pub water: Option<Water>,
                   pub slope: SlopeSettings, pub analysis: AnalysisSettings }
pub struct Meta { pub id: Option<String>, pub title: Option<String>, pub notes: Option<String> }
pub enum MaterialModel { MohrCoulomb }               // serde: "mohr_coulomb"
pub struct Material { pub id: String, pub name: String, pub model: MaterialModel, pub unit_weight: f64,
                      pub unit_weight_sat: Option<f64>, pub cohesion: f64, pub friction_angle: f64, pub ru: Option<f64> }
pub struct Region { pub material: String, pub polygon: Vec<Point> }
pub struct Water { pub unit_weight: f64 /* default 9.81 */, pub piezometric_line: Option<Vec<Point>> }
pub enum Direction { Auto, LeftToRight, RightToLeft }  // serde snake_case
pub struct SlopeSettings { pub direction: Direction }  // default Auto
pub enum MethodKind { Bishop, Spencer }              // serde: "bishop" | "spencer"
pub struct Circle { pub xc: f64, pub yc: f64, pub r: f64 }
pub enum SurfaceSpec { Circle(Circle) }              // serde: tag = "type", "circle"
pub struct SearchSpec { /* type = "circular_entry_exit" */ pub entry: Option<[f64;2]>, pub exit: Option<[f64;2]>,
                        pub n_entry: usize, pub n_exit: usize, pub n_radius: usize, pub max_radius_factor: f64,
                        pub min_width: Option<f64>, pub refine: bool }
pub struct AnalysisSettings { pub methods: Vec<MethodKind>, pub slices: usize, pub tolerance: f64,
                              pub max_iterations: usize, pub min_m_alpha: f64,
                              pub surface: Option<SurfaceSpec>, pub search: Option<SearchSpec> }

// geometry.rs
pub enum Sliding { LeftToRight, RightToLeft }        // dirección resuelta (sin Auto)
pub trait Ground {                                   // lo usa search.rs; lo implementa PreparedModel
    fn y_top(&self, x: f64) -> Option<f64>;          // None fuera del modelo
    fn x_range(&self) -> (f64, f64);
    fn sliding(&self) -> Sliding;
}
pub struct PreparedModel { /* privado: materiales resueltos (tan φ precalculado), regiones, piezométrica, γw, sliding */ }
impl PreparedModel {
    pub fn new(model: &Model) -> Result<Self, OgsError>;
    pub fn piezometric_y(&self, x: f64) -> Option<f64>;   // None si no hay piezométrica
}
impl Ground for PreparedModel { /* ... */ }

// slicer.rs
pub struct Slice {
    pub x_left: f64, pub x_right: f64,     // marco ORIGINAL del modelo, x_left < x_right
    pub y_base_left: f64, pub y_base_right: f64,
    pub y_top_mid: f64,                     // terreno en x_mid
    pub width: f64,                         // b > 0
    pub alpha: f64,                         // rad; POSITIVO cuando la base sube hacia el coronamiento (componente motriz W·sin α > 0)
    pub base_length: f64,                   // b / cos α
    pub weight: f64,                        // W por metro de ancho
    pub cohesion: f64,                      // c del material de la base
    pub tan_phi: f64,                       // tan φ del material de la base
    pub pore_pressure: f64,                 // u en el punto medio de la base
    pub material: usize,                    // índice en Model.materials
}
pub enum SurfaceError { NoIntersection, UpperArc, AboveGround, OutsideModel, TooFewSlices, NoMaterial }
pub fn slice_circle(pm: &PreparedModel, circle: &Circle, n: usize) -> Result<Vec<Slice>, SurfaceError>;
// ORDEN: slices[0] = dovela del PIE (salida); slices[last] = dovela del CORONAMIENTO (entrada), sin importar el sentido.

// methods/mod.rs (methods/bishop.rs, methods/spencer.rs)
pub struct SolveOptions { pub tolerance: f64, pub max_iterations: usize, pub min_m_alpha: f64 }
pub enum SolveStatus { Converged, NotConverged, Invalid }   // serde snake_case
pub struct MethodResult { pub method: MethodKind, pub fos: f64, pub status: SolveStatus,
                          pub iterations: usize, pub lambda: Option<f64>, pub message: Option<String>,
                          pub warnings: Vec<String> /* E8d: avisos y notas, incluso con Converged */ }
pub fn solve(slices: &[Slice], method: MethodKind, opts: &SolveOptions) -> MethodResult;

// search.rs
pub struct SearchStats { pub evaluated: usize, pub valid: usize }
pub struct SearchResult { pub best: Option<(Circle, f64)>, pub stats: SearchStats }
pub fn search_circular<G, E>(ground: &G, spec: &SearchSpec, eval: E) -> SearchResult
    where G: Ground + Sync, E: Fn(&Circle) -> Option<f64> + Sync;
// eval devuelve Some(FS) solo para superficies válidas y convergidas.

// report.rs (Serialize, snake_case)
pub struct MethodReport { pub method: MethodKind, pub fos: Option<f64> /* E4f */, pub status: SolveStatus, pub iterations: usize,
                          pub lambda: Option<f64>, pub surface: Circle, pub slices: Vec<Slice>,
                          pub search: Option<SearchStats>, pub warnings: Vec<String> }
pub struct AnalysisReport { pub engine: String /* "ogs-core <version>" */, pub results: Vec<MethodReport> }

// lib.rs
pub enum OgsError { InvalidModel(String), NoSurface, NoValidSurface(String) /* E4f: motivo */, Json(String) }  // thiserror
pub fn analyze(model: &Model) -> Result<AnalysisReport, OgsError>;
pub fn analyze_json(input: &str) -> Result<String, String>;   // JSON in → JSON (AnalysisReport) out
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
```

- `analyze` resuelve **cada método por separado**. Con `search`, la superficie crítica se busca por método.
- Feature `parallel` (rayon, desactivada por defecto) para la grilla de búsqueda en nativo. En wasm se compila sin ella.
- Determinismo: el mismo modelo produce el mismo resultado bit a bit en un mismo target (sin RNG; empates por índice).

---

## 4. Especificación numérica (normativa)

### 4.1 Dovelas (`slice_circle`)
1. Solo se usa el **arco inferior** `y(x) = yc − sqrt(r² − (x − xc)²)`.
2. Se buscan los cruces del arco con el terreno `y_top`. **(Enmienda E2.)** Los puntos de salida y entrada son los
   cruces **más externos** del arco inferior con el terreno, es decir, el primero y el último en x dentro del dominio.
   Entre ambos, el arco **puede** asomar sobre el terreno (por ejemplo, un círculo que sale por la cara y reentra
   cerca del pie). Ese tramo se trata en el punto 8 y no invalida la superficie. Esta es la convención del oráculo
   cSlope (`slices.rs`: "a base above the ground … is left to the slices"). Si un cruce necesario cae en el
   semicírculo superior → `UpperArc`. Sin cruces → `NoIntersection`. `AboveGround` queda solo para el caso
   degenerado en que **todas** las dovelas tienen la base sobre el terreno.
3. Si el arco baja de `y_bottom(x)` en algún punto → `OutsideModel`.
4. Bordes de dovela: `n` divisiones uniformes entre salida y entrada, más **puntos de quiebre** en todos los vértices x de
   las regiones, de la piezométrica y en los cruces del arco con aristas de región, para que cada dovela tenga material de
   base único y perfiles lineales. Se descartan las dovelas de ancho < 1e-9 · (ancho total).
5. La base de cada dovela es la **cuerda** entre los puntos del arco en `x_left` y `x_right`. α es la inclinación de esa
   cuerda, con signo positivo cuando sube hacia el coronamiento.
6. Peso: en `x_mid`, la vertical entre `y_base_mid` (punto medio de la cuerda) y `y_top(x_mid)` se intersecta con
   cada región: `W = b · Σ γ_k · h_k`, aplicando `unit_weight_sat` bajo la piezométrica cuando corresponda.
7. Material de la base: región que contiene el punto `(x_mid, y_base_mid + ε)`. Si no hay ninguna → `NoMaterial`.
8. **Dovelas aéreas (E2):** si `y_base_mid ≥ y_top(x_mid)`, la dovela tiene `weight = 0`, `cohesion = 0`,
   `tan_phi = 0` y `pore_pressure = 0`, y `material` es el de la región más cercana bajo la base o, si no hay
   ninguna, el índice 0. No aporta fuerza motriz ni resistente. Los bordes de dovela incluyen los cruces intermedios
   arco-terreno, para que cada dovela quede entera bajo el terreno o entera sobre él.
9. **Bloque principal (enmienda E10a; reemplaza a E8a).** Un tramo aéreo **interior** (con dovelas de suelo a ambos
   lados) divide la masa en bloques: secuencias maximales de dovelas de suelo contiguas.
   - **Se analiza solo el bloque principal.** **(E10a″, reemplaza al criterio de mayor peso.)** El bloque principal
     es el que contiene el **punto de entrada**, en el lado del coronamiento. La masa que se moviliza desde el
     escarpe no puede empujar a través del aire a los bloques que quedan aguas abajo, y esos bloques son otros
     mecanismos que la búsqueda evalúa por separado. **Motivo:** en el círculo crítico de Spencer de cSlope en D09, el
     lente del pie pesa más (W = 475,8) que la cara (388,9), y el criterio de mayor peso elegía el lente, que además
     sale por el muro. Con el bloque de entrada, ogs da 0,3878 frente a 0,3876 del oráculo. La regla tampoco necesita
     umbrales ni desempates.
   - Los demás bloques y **todas** las dovelas aéreas interiores se **eliminan** de la lista de dovelas.
   - La salida y la entrada efectivas son los extremos del bloque principal.
   - Si se eliminó algo, se agrega el aviso informativo `"truncated_mass"`, con la nota "se analizó solo el bloque
     principal de la superficie".
   - Tras la truncación no quedan dovelas aéreas interiores, de modo que E7a solo aplica si quedan en los extremos.
     `air_gap_thrust` queda como defensa en profundidad.
   - **Motivo:** el lente más allá de un vacío de aire no es empujado por la masa (el aire no transmite fuerza).
     Excluirlo es conservador, porque el lente del pie solo aporta resistencia, y coincide con el oráculo: en D09/R2-03
     el círculo crítico de cSlope sale en el vértice del pie e ignora el lente del pie. E8a, que rechazaba la
     superficie con `DisconnectedMass`, dejaba la búsqueda 3-7 % sobre el oráculo, lo que es no conservador.
   - `SurfaceError::DisconnectedMass` deja de emitirse; la variante puede eliminarse.
   - `truncated_mass` se agrega a `INFORMATIVE_WARNINGS` y a la lista de códigos E6.
   - **(E10a′.)** La verificación `OutsideModel` (§4.1.3) se aplica **solo al tramo del arco del bloque principal**.
     Un lente descartado puede salir por una pared lateral del modelo sin invalidar la superficie. **Motivo:** el
     círculo crítico de Spencer de cSlope en D09 (centro (1,30; 55,17), r = 42,44; FS 0,3876) sale por x = 0 bajo el
     terreno **dentro del lente del pie**, que se descarta.
   - **(E11d, revisión R3-03a/b.)** Después de truncar, el bloque conservado se **re-rebana**: `n` divisiones uniformes
     entre sus extremos, más los puntos de quiebre de §4.1.4. Se exigen al menos 3 dovelas de suelo; si no, el
     resultado es `TooFewSlices`.
     - **(E11d′, reemplaza el filtro por extremos efectivos.)** `min_width` y los rangos se siguen verificando sobre
       la **cuerda del arco** (x_e, x_s). Si el ancho de suelo efectivo del bloque analizado (dovelas de suelo más
       externas) es menor que `min_width`, o si sus extremos de suelo caen fuera de los rangos, el resultado conserva
       su estado y agrega el **aviso** `"effective_width_below_min"` o `"effective_ends_outside_range"`.
       - **Motivo:** filtrar por extremos efectivos dejó la búsqueda del botadero en 1,3905 frente a 1,1423 de cSlope
         (+22 %, no conservador), porque el óptimo está en la frontera ancho = 10 y la búsqueda no la alcanza. El
         criterio por cuerda da 0,856, que es conservador, y el aviso explica que el bloque real es más angosto.
       - **Pendiente para la Fase 1:** búsqueda con restricción de frontera.
     - *Texto derogado:* En la búsqueda, `min_width` y los rangos `entry` / `exit` se verifican sobre los **extremos efectivos** del bloque
       analizado: salida = `slices[0].x_left`, entrada = `slices[last].x_right`. Si no cumplen, el evaluador devuelve
       `None`.
     - **Motivo:** en un botadero de 2 bancos con `min_width = 10`, ogs daba 0,856 sobre un bloque de 5,2 m de ancho,
       25 % bajo cSlope (1,142), que sí respeta el ancho pedido.
   - **(E11e, revisión R3-03c.)** Si algún bloque descartado es **motriz** (`Σ W sin α > 0,05·Σ W sin α` del bloque
     principal), el aviso es `"truncated_driving_mass"`. **No** es informativo: indica que el bloque descartado puede
     ser un mecanismo más crítico y que conviene revisar otros círculos. En otro caso se mantiene la nota
     `truncated_mass`.
   - **(E11e′, revisión R4-03b/R4-04; reemplaza el umbral de E11e.)** Un bloque descartado es **motriz** si
     `Σ_bloque W sin α > 1e-3 · Σ_bloque W`, con su propio peso como escala en lugar del bloque principal, **y** no toca
     una pared lateral del modelo (`x_min`/`x_max`).
     - Si el bloque descartado sale por una pared lateral, su geometría está recortada por el borde del modelo y no se
       puede clasificar: se emite la nota `truncated_mass`.
     - **Motivos:**
       - R4-04: el lente de pie de D09, bajo terreno plano y cortado en x = 0, daba ΣW sin α > 0 artificial y emitía un
         falso `truncated_driving_mass`;
       - R4-03b: un banco inferior inestable con < 5 % de la masa motriz del bloque principal quedaba oculto.
     - Sigue pendiente para la Fase 1 (R4-03a): el aviso de los candidatos truncados de la búsqueda no se propaga si el
       círculo crítico ganador no está truncado.

   *Texto histórico de E8a (derogada):*
   **Masa desconectada (enmienda E8a, tras W5a/R2-01).** Un tramo aéreo **interior** (con dovelas de suelo a ambos
   lados) divide la masa deslizante en bloques. Cada bloque es una secuencia maximal de dovelas de suelo contiguas;
   el bloque principal es el de mayor peso. Si **cualquier** bloque distinto del principal pesa `> 1e-3 · ΣW`, el
   slicer devuelve `SurfaceError::DisconnectedMass`. La superficie define más de una masa deslizante y el equilibrio
   límite de un solo cuerpo no es aplicable. La regla vale para ambos métodos.
   - Los lentes despreciables (≤ 1e-3·ΣW, como la franja del pie de V019) se aceptan, y sus dovelas aéreas siguen E7a.
   - **Motivo:** con E7a, la búsqueda de Spencer encontraba círculos que salían y reentraban, con FS absurdos (V003:
     0,11 en lugar de 1,11), porque el aire transmitía empuje como un puntal. El aviso `air_gap_thrust` queda como
     defensa en profundidad.

### 4.2 Bishop simplificado
`F = Σ [ (c·b + (W − u·b)·tanφ) / m_α ] / Σ W·sin α`, con `m_α = cos α + sin α · tanφ / F`.
- Iteración de punto fijo desde F₀ = 1 hasta `|ΔF|/F < tolerance`.
- Si algún `m_α < min_m_alpha` → `Invalid` (mensaje `"m_alpha"`).
- **(Enmienda E3.)** Si `Σ W sin α ≤ 1e-6 · Σ W` → `Invalid` (mensaje `"no_driving"`). Es una superficie sin momento
  motor. Sin esta regla aparecían FS absurdos, del orden de 1e16, reportados como `Converged`.
- Las dovelas con `m_α` bajo solo invalidan la superficie si tienen peso o resistencia; las dovelas aéreas (§4.1.8) no
  se consideran.
- **(Enmienda E7b, revisión R2-02; complementa a E4a.)** Para cada dovela de suelo con α < 0:
  - `m_α(F) ≥ min_m_alpha` ⟺ `F ≥ F_adm,i = (−sin α · tanφ) / (cos α − min_m_alpha)`;
  - si `cos α ≤ min_m_alpha` y tanφ > 0, la superficie es `Invalid("m_alpha")`.

  Con `F_adm = max_i F_adm,i` (0 si no hay dovelas con α < 0):
  - la raíz se busca **solo** en `[F_adm·(1+1e-6), 1e3]`;
  - iteración de punto fijo desde `F₀ = max(F_ordinario, 1.05·F_adm, 0.1)`;
  - si un iterado sale del intervalo o no converge en `max_iterations/2`, se usa Brent o bisección sobre
    `h(F) = F − g(F)` en ese intervalo;
  - sin raíz en el intervalo → `Invalid("m_alpha")`.

  Esta regla reemplaza el aborto por `"m_alpha_pole"` en la iteración 0.
- **(Enmienda E4a, revisión R1-03.)** Valor inicial `F₀ = max(F_ordinario, 0.1)`, donde
  `F_ordinario = Σ (c·l + (W cos α − u·l)·tanφ) / Σ W sin α` (Fellenius, solo con dovelas de suelo). Si F_ordinario no es
  finito o es ≤ 0, se usa `F₀ = 1`. Durante las iteraciones, solo un **polo** (`m_α ≤ 1e-9` en alguna dovela de suelo)
  aborta con `Invalid` (`"m_alpha_pole"`). La condición `m_α ≥ min_m_alpha` se evalúa sobre el **F convergido**: si no
  se cumple, el resultado es `Invalid` (`"m_alpha"`). Nunca se devuelve `Converged` con `m_α(F) < min_m_alpha`.

### 4.3 Spencer (Morgenstern-Price con f = 1)
> **Vigente en §4.3 (tras R3):** E10c con E11a, E11b y E11c, más E4d, E4e/E7d/E11f, E7a y E3.
> **Fase 1:** la selección de raíz de E11a′ queda reemplazada por **E12e** (`01_CONTRATOS_FASE1.md` §F1.6, menor F admisible).
> **Derogados**, que se conservan solo como historia: E4c, E7c, E9c y E10b. Tampoco rige el lazo de punto fijo en λ de
> Zhu. E8b queda reemplazada por E11b.

**(Enmienda E11a, revisión R3-01.)** Ecuación de λ sin divisor y selección de raíz:
- El residuo de momentos se escribe en forma **sin divisor**: `r(λ) = Σ bᵢ (Eᵢ + Eᵢ₋₁)(tan αᵢ − λ)`, con f = 1 y las
  dovelas aéreas incluidas (E7a). Es continuo y no tiene asíntotas.
- **Barrido completo** de λ ∈ [−0,5; 1,5] con paso 0,05. **Todos** los cambios de signo de r se refinan con Brent.
- **Candidatas:** raíces con cierre de fuerzas (`|Eₙ| ≤ 1e-6·ΣW`) que cumplen la admisibilidad E11b.
- **Selección (E11a′, reemplaza a la regla "λ ≥ 0 más pequeño"):** la candidata admisible con **menor |λ|**, sin
  preferencia de signo. Si es negativa, se agrega el aviso informativo `"negative_lambda"`. **Evidencia del oráculo:**
  - en D03, cSlope elige λ = −0,162 (FS 0,5467, con su aviso `steep-entry-tension` por una entrada a 89°);
  - en R3-01a elige +0,402, porque la raíz −0,371 tiene Φ/F = 0,073 y no es admisible.

  La regla "λ ≥ 0" llevaba la búsqueda de D03 a +1,38 % sobre el oráculo.
  - **Barrido:** hacia afuera y simétrico desde 0 con paso 0,05 (niveles |λ| = 0,05·k, ambos lados en cada nivel).
    Se detiene al terminar el **primer nivel** que contenga una raíz admisible; si hay dos en ese nivel, gana la de
    menor |λ|. Mantiene E11a sin asíntotas y es barato. Objetivo: ≤ 1,5× el tiempo de E10c.
  - Con λ ≥ 0, regla ya derogada:
  - la candidata con **λ ≥ 0 más pequeño**;
  - si no hay ninguna, la de λ < 0 más cercana a 0, con el **aviso** `"negative_lambda"`;
  - si no hay candidatas: `NotConverged("no_admissible_root")` cuando hubo raíces que no eran admisibles, o
    `NotConverged("no_lambda_root")` cuando no hubo raíces.
- **Motivo:** el barrido hacia afuera con parada en el primer cambio de signo elegía λ = −0,371 (FS 1,5178, −5 % frente
  a cSlope 1,5974) en vez de la raíz física λ = +0,402. Además, las asíntotas de la forma con divisor abortaban la
  búsqueda.

**(Enmienda E11b, revisión R3-02; reemplaza a E8b.)** Admisibilidad: en toda dovela de suelo, `Φᵢ / F ≥ min_m_alpha`.
Es la E4b original, que con λ = 0 coincide con el `m_α` de Bishop. Además, `m_α(F) ≥ min_m_alpha`.
- **Motivo:** E8b (`Φ > 1e-9·F`) admitía raíces con `Φ/F ≈ 4·10⁻⁴` y FS +233 % sobre cSlope o −31 % bajo Bishop.
  El motivo que llevó a relajarla (Spencer 21 % sobre Bishop en R2-03) resultó ser en su mayoría una diferencia real
  entre métodos (cSlope: +17 %) más el defecto de E8a, ya corregido por E10a.
- Si la batería diferencial deja de pasar con esta regla, se **reporta** con números; no se relaja sin decisión del
  coordinador.

**(Enmienda E11c, revisión R3-04.)** La parada de Brent en λ usa `tol_r = min(1e-3·tolerance, MOMENT_ACCEPT)`, con la
misma escala que el corte final, de modo que toda raíz que Brent acepte pase el corte. Con `tolerance` en todo el rango
(0; 0,01], los casos D01 y D06 deben converger.

**(Enmienda E11f, revisión R3-06; complementa a E7d/E8c.)** `negative_effective_normal_major` se emite si `f > 0,05`
**o** si la fracción de la longitud de base de suelo con `N' < 0` supera 0,25. V002, V003 y V101, con tracción
localizada en el coronamiento, deben quedar como nota; repórtalo.

**(Enmienda E10c; corrige a E10b tras W8b.)** El solver mantiene la estructura de E10b: curvas F_m(λ) y F_f(λ) con
búsqueda acotada de λ\*. Cambia lo siguiente:
- **Ecuación de momentos:** la de Zhu et al. (2005), momentos por dovela con la línea de empuje en la base, la misma
  que el solver verificado hasta ahora. Así se reproducen los valores verificados (V044, V045, V016a) con ≤ 1e-6
  relativo. Con la F_m de momentos respecto del centro de E10b, las diferencias eran de ~3e-5 frente a toda la
  verificación previa, sin que el oráculo prefiera ninguna de las dos (cSlope coincide con la de Zhu en ≤ 0,04 %).
- **F de fuerzas:** la raíz de F con la recurrencia exacta de E (cierre `|Eₙ| ≤ 1e-6·ΣW`), con continuación a lo
  largo del barrido. La iteración de Picard con X retardada no es obligatoria, porque diverge para λ ≥ 0,5.
- **Barrido de λ hacia afuera:** desde λ = 0, alternando +0,1 y −0,1 hasta [−0,5; 1,5], con **parada en el primer**
  cambio de signo de g, que es el más cercano a 0. Así se evita evaluar las 21 posiciones. Objetivo de rendimiento:
  ≤ 1,3× el tiempo del solver Zhu en `ogs bench V047a --method spencer`.
- **Sin cambio de signo** → `NotConverged("no_lambda_root")`.
  - Nota: cSlope en ese caso reporta la aproximación más cercana con el aviso `steep-entry-no-equilibrium` (R1-01: 0,311
    sin cierre). Nosotros **no** reportamos un FS sin equilibrio.

**(Enmienda E10b: solver GLE de dos ecuaciones; reemplaza al lazo de punto fijo en λ de Zhu et al.)**
Formulación del equilibrio límite general (Fredlund & Krahn 1977) con `X = λ·f(x)·E` y f = 1. Para un λ dado:
- **Normal en la base** (equilibrio vertical, igual que en E4e):
  `N = [W − (Xᵢ − Xᵢ₋₁) − (c·l·sin α − u·l·tanφ·sin α)/F] / m_α(F)`, con `m_α(F) = cos α + sin α·tanφ/F`.
- **F de momentos** (superficie circular, momentos respecto del centro):
  `F_m = Σ (c·l + (N − u·l)·tanφ) / Σ W sin α`.
- **F de fuerzas** (equilibrio horizontal global):
  `F_f = Σ (c·l + (N − u·l)·tanφ)·cos α / Σ N sin α`.
- **Fuerzas E** por equilibrio horizontal de cada dovela, del pie al coronamiento, con E₀ = 0:
  `Eᵢ = Eᵢ₋₁ + N sin α − S cos α`, donde `S = (c·l + (N − u·l)·tanφ)/F`. Documenta el signo.

Para cada λ, F_m(λ) y F_f(λ) se obtienen por punto fijo (máx. 100 iteraciones). Las X se actualizan con las E de la
iteración anterior.

**Búsqueda de λ\*:**
- se evalúa `g(λ) = F_m(λ) − F_f(λ)` en λ = 0; 0,1; …; 1,5 y en −0,1; …; −0,5;
- se toma el cambio de signo **más cercano a λ = 0** y se refina con Brent hasta `|g| < tolerance·F`;
- si no hay cambio de signo → `NotConverged("no_lambda_root")`;
- en el λ\* hallado se aplica la admisibilidad E8b (`Φ > 0`, `m_α(F) ≥ min_m_alpha`) **y** se exige el cierre de
  fuerzas `|Eₙ| < 1e-6·ΣW` (o la tolerancia equivalente que se documente).

Bishop es el caso λ = 0 de F_m. La identidad φ = 0 es exacta para F_m.
*El algoritmo de Zhu, Lee, Qian & Chen (2005), en el texto siguiente, queda como referencia histórica y como oráculo
interno opcional en los tests.*

Algoritmo de **Zhu, Lee, Qian & Chen (2005)**, *Can. Geotech. J.* 42: 272–278.
Las dovelas van del pie al coronamiento, con E₀ = Eₙ = 0 y fᵢ = 1:
```
Rᵢ = (Wᵢ cos αᵢ − Uᵢ) tan φᵢ + cᵢ bᵢ sec αᵢ         (Uᵢ = uᵢ bᵢ sec αᵢ)
Tᵢ = Wᵢ sin αᵢ
Φᵢ = (sin αᵢ − λ fᵢ cos αᵢ) tan φᵢ + (cos αᵢ + λ fᵢ sin αᵢ) F
Ψᵢ₋₁ = [(sin αᵢ − λ fᵢ₋₁ cos αᵢ) tan φᵢ + (cos αᵢ + λ fᵢ₋₁ sin αᵢ) F] / Φᵢ₋₁
F = [ Σᵢ₌₁ⁿ⁻¹ (Rᵢ Πⱼ₌ᵢⁿ⁻¹ Ψⱼ) + Rₙ ] / [ Σᵢ₌₁ⁿ⁻¹ (Tᵢ Πⱼ₌ᵢⁿ⁻¹ Ψⱼ) + Tₙ ]
Eᵢ Φᵢ = Ψᵢ₋₁ Eᵢ₋₁ Φᵢ₋₁ + F Tᵢ − Rᵢ
λ = Σ bᵢ (Eᵢ + Eᵢ₋₁) tan αᵢ / Σ bᵢ (fᵢ Eᵢ + fᵢ₋₁ Eᵢ₋₁)
```
- **Lazo**: iniciar con F de Bishop (o 1) y λ = 0. Iterar F con λ fijo hasta converger; recalcular E y λ.
  Repetir hasta que F y λ converjan.
- **Fallas**: si no converge en `max_iterations` → `NotConverged`; si Φ ≈ 0 o aparece un NaN → `Invalid`.
  Se aplica la misma regla E3 (`Σ T ≤ 1e-6 · Σ W` → `Invalid`, `"no_driving"`).
- **(Enmienda E4b, revisión R1-01; reformulada por E8b.)** Admisibilidad: con el (F, λ) convergido, toda dovela de
  suelo debe cumplir:
  - (i) `Φᵢ > 1e-9·F`, sin polo ni divisor negativo; esto descarta el contraejemplo R1-01;
  - (ii) `m_α(F) = cos α + sin α·tanφ/F ≥ min_m_alpha`, el **mismo** criterio de Bishop evaluado en el F de Spencer.

  Si alguna no lo cumple → `Invalid` (`"pole"` o `"m_alpha"`). Durante las iteraciones aplica E7c.
  - **Motivo de E8b:** exigir `Φᵢ/F ≥ min_m_alpha` (con λ ≠ 0) era más estricto que Bishop sin respaldo en la
    práctica. En la búsqueda de R2-03 descartaba la superficie crítica y dejaba a Spencer 21 % sobre Bishop, lo que es
    no conservador.
- **(E4c, revisión R1-02.)** Las dovelas aéreas transmiten E sin cambio (`Eᵢ = Eᵢ₋₁`), **no** aportan a F y se
  **excluyen** de los dos sumatorios de λ.
  - **E4c queda DEROGADA por E7a (revisión R2-01).** Excluirlas deja un residuo de momento global
    `E_gap·(λ·Δx_aire − Δy_aire)` que no desaparece al refinar: con φ = 0 y un vacío interior, Spencer quedaba 6,3 %
    bajo la identidad exacta.
- **(Enmienda E7a.)** Una dovela aérea es un cuerpo **sin masa** que transmite `E` y `X = λE` sin cambio. **Participa**
  en los sumatorios de λ con su propio α (el de la cuerda del arco en el aire), lo que conserva el equilibrio global de
  momentos y la identidad φ = 0. Como el aire no puede transmitir empuje, si un tramo aéreo **interior** (con suelo a
  ambos lados) lleva `|E_gap| > 1e-3·ΣW`, el resultado conserva su estado y añade el **aviso** `"air_gap_thrust"`.
- **(Enmienda E9c.)** Presupuesto de Spencer: el lazo de punto fijo usa a lo sumo `max_iterations/2`; el resto queda
  para el amortiguamiento de λ y la bisección. Así se recupera R1-07a (FS 0,746180, λ 0,191570, admisible), que con E8b
  se perdía por falta de presupuesto.
- **(Enmienda E7c, revisión R2-03.)** Robustez de Spencer:
  - si un paso de λ produce un polo (`Φᵢ ≤ 1e-9·F`) o `F ≤ 0`, se **amortigua** (`Δλ ← Δλ/2`, hasta 12 veces) antes de
    abortar;
  - el lazo interno de F con λ fijo usa la forma cerrada `F = Σ(R/D)/Σ(T/D)` con salvaguarda: si un iterado sale de la
    región admisible, se usa bisección en F dentro de `[F_adm(λ)·(1+1e-6), 1e3]`;
  - solo se declara `Invalid("pole")` si el amortiguamiento se agota;
  - la admisibilidad final E4b no cambia.
- **(E4d, revisión R1-07.)** Antes de devolver `Converged`, se recalcula F con el λ final y se exige
  `|F(λ_final) − F|/F < tolerance`. Si no se cumple, se sigue iterando o, agotado el presupuesto, el resultado es
  `NotConverged`.
- **(E4e, ambos métodos.)** Con el F convergido se calcula la normal efectiva de cada dovela de suelo, a partir del
  equilibrio vertical `N cos α + S sin α = W − ΔX`, con `S = (c·l + N'·tanφ)/F`, `N = N' + u·l`, `l = b·sec α`
  y `ΔX = Xᵢ − Xᵢ₋₁`:
  - Bishop (`ΔX = 0`): `N' = (W − u·b − c·l·sin α / F) / m_α`.
  - Spencer: `X = λ·E` con las E convergidas; `N' = (W − ΔX − u·b − c·l·sin α / F) / m_α`. Documenta el signo de ΔX
    de acuerdo con la convención de E, y prueba que con `ΔX = 0` reproduce exactamente la fórmula de Bishop.
  - Si algún `N' < −1e-6·ΣW`, el resultado conserva su estado y añade el aviso `"negative_effective_normal"` en
    `message`. En v0.1 no se trunca la resistencia.
  - **(Enmienda E5.)** `negative_effective_normal` es un aviso **informativo**: es típico de las dovelas del
    coronamiento con cohesión (zona de tracción) y sugiere considerar una grieta de tracción. El test de aceptación
    tolera los códigos de la lista `INFORMATIVE_WARNINGS = ["negative_effective_normal"]` y falla ante cualquier otro.
    La web y el informe deben mostrarlo como nota, no como error.
  - **(Enmienda E7d, revisión R2-04.)** El aviso se clasifica por magnitud, con `f = Σ_{N'<0} |N'| / ΣW`:
    - `f ≤ 0.05` → `"negative_effective_normal"` (nota);
    - `f > 0.05` → `"negative_effective_normal_major"` (aviso: tracción o subpresión generalizada en la base).

    **Calibración (E8c):** el umbral original de 0,02 marcaba como aviso los problemas publicados estándar V002
    (f = 0,038), V003 (0,022) y V101 (0,027), que corresponden a zonas de tracción normales del coronamiento; la
    subpresión generalizada de R2-04 tiene f = 0,105. Por eso se fija en 0,05. Es un umbral de clasificación de avisos,
    no una tolerancia numérica.

    En Spencer, N' se calcula con la forma directa, sin el divisor `m_α`:
    `N' = W cos α − U + (sin α − λ cos α)·ΔE`, con el signo de ΔE de la convención documentada. Debe coincidir con la
    forma de E4e en las dovelas sin polo.
- **Convención de signos**: el implementador debe **documentar** la que use. La **deciden las pruebas** de §5;
  si una de ellas falla, la convención está mal.

### 4.4 Búsqueda `circular_entry_exit`
1. Grilla de `n_entry` puntos de entrada (rango `entry`) × `n_exit` puntos de salida (rango `exit`) sobre el terreno
   (`y_top`). Se exige que la entrada esté cuesta arriba de la salida según `sliding()` y que `|x_e − x_s| ≥ min_width`.
2. Para cada par (cuerda de longitud L) se generan `n_radius` radios en serie geométrica entre `L/2 · 1.0001` y
   `max_radius_factor · L`. El centro va en la mediatriz de la cuerda, del lado superior (`n_y > 0`), de modo que el arco
   menor quede bajo la cuerda.
3. `refine`: desde las 5 mejores, búsqueda por patrones sobre (x_e, x_s, ρ = ln(R/(L/2))), con pasos iniciales iguales
   al espaciado de la grilla. Los pasos se reducen a la mitad cuando no hay mejora; se termina con pasos < 1e-3 ·
   (ancho del modelo) o tras 300 evaluaciones por semilla. Siempre se respetan los rangos.
4. El resultado es la mejor superficie con su FS, `evaluated` (llamadas a `eval`) y `valid` (`Some`).
5. **(Enmienda E9a, tras la verificación diferencial con cSlope.)** Candidatos de entrada y salida:
   - además de los `n_entry` / `n_exit` puntos uniformes, se agregan los **vértices del terreno** (`y_top`) dentro de
     cada rango, y para cada vértice los puntos `x ± 1e-6·ancho`. Los duplicados (|Δx| < 1e-9·ancho) se eliminan;
   - el refinamiento parte de las **10** mejores superficies (antes 5), con al menos 2 semillas de pares
     entrada-salida distintos;
   - el determinismo serial = parallel se mantiene.
   - **Motivo:** en el talud de R2-03 (c = 2, φ = 45°, ru = 0,65) la superficie crítica de cSlope sale exactamente en
     el vértice del pie (15, 15), y la grilla uniforme no lo alcanza. ogs daba Bishop 0,3408 frente a 0,3307 de
     cSlope (+3,1 %) y Spencer 0,4132 frente a 0,3876 (+6,6 %). Un FS de búsqueda por encima del oráculo es **no
     conservador**.
6. **(E9b) Criterio de calidad de búsqueda frente al oráculo:** en los casos diferenciales
   (`verification/differential/`), el FS de búsqueda de ogs debe cumplir `FS_ogs ≤ FS_cSlope·(1 + 0,01)` con el
   mismo método, número de dovelas y rangos. Si es menor, ogs es más exhaustivo, lo cual es aceptable. En superficie
   fija, `|FS_ogs − FS_cSlope| / FS_cSlope ≤ 0,005`.

### 4.5 Validación de entrada y reporte (enmienda E4f, revisión R1-05/08/09/10/11)
- Todos los structs de `model.rs` llevan `#[serde(deny_unknown_fields)]`: **un campo desconocido es un error**, no se
  ignora. Así, un error de tipeo como `r_u` no pasa como análisis seco.
- `analyze` rechaza con `InvalidModel` (mensaje en español):
  - `format != "opengeoslide"` y `version != "0.1"`;
  - `methods` vacío o con métodos repetidos;
  - `slices < 3` o `> 2000`;
  - `tolerance` no finita o fuera de (0, 0.01];
  - `max_iterations` fuera de [1, 100000];
  - `min_m_alpha` no finito o fuera de (0, 1];
  - en `search`: `n_entry`, `n_exit` o `n_radius` fuera de [1, 200]; producto `n_entry·n_exit·n_radius > 2e6`;
    `max_radius_factor ≤ 0.51` o no finito; rangos con `lo > hi` o fuera de la extensión del modelo;
    `min_width < 0`.
  - `PreparedModel::new` exige además ancho y alto finitos y > 0 en el modelo.
- `MethodReport.fos` pasa a **`Option<f64>`**: `None` (JSON `null`) cuando el FS no es finito. El estado explica el
  motivo. Esta enmienda reemplaza la firma `fos: f64` de `MethodReport` en §3.
- **Superficie fija:**
  - si el slicer falla, `NoValidSurface` lleva el motivo en el mensaje (`OgsError::NoValidSurface` pasa a contener un
    `String` con el `SurfaceError`);
  - si el método falla (`Invalid` o `NotConverged`), **no** es un error: se reporta con su estado.
- **Aviso de agua sobre el terreno:** solo en dovelas de suelo, con tolerancia `1e-9 · escala del modelo`, evaluando
  los extremos y el punto medio de la dovela. Desde F5.3 (E15c) el código `water_above_ground` es una **nota
  informativa** y no un aviso de que el agua se ignora; su texto es: «La piezométrica queda sobre el terreno: el agua
  embalsada se incluye con su peso y su empuje horizontal (sin sismo).» El nombre del código no cambia.
- `PreparedModel::piezometric_y`: NaN → `None`; ±∞ → valor del extremo correspondiente.
- **(Enmienda E6.)** El `Display` de `OgsError` tiene la forma `"<Código>: <mensaje en español>"`, con
  `Código ∈ {InvalidModel, NoSurface, NoValidSurface, Json}`. Por ejemplo:
  `NoSurface: no hay superficie definida; indique analysis.surface o analysis.search`.
  El prefijo es estable y lo usan la web y Python para clasificar el error.
  Los códigos de aviso (`m_alpha`, `pole`, `no_driving`, `negative_effective_normal`,
  `negative_effective_normal_major`, `air_gap_thrust`, `truncated_mass`, `truncated_driving_mass`, `water_above_ground`,
  `effective_width_below_min`, `effective_ends_outside_range`,
  `load_outside_mass`, `multiple_admissible_roots`,
  `max_iterations`, `non_finite`, `no_slices`, `no_lambda_root`, `no_admissible_root`, `negative_lambda`,
  `polyline_no_ground_crossing`, `polyline_outside_ground`, `bishop_non_circular`,
  `interslice_shear_exceeds_strength`, `janbu_correction_extrapolated`, `non_positive_fos`,
  `reinforcement_outside_mass`, `reinforcement_compression_ignored`, `reinforcement_active_compression`,
  `structural_checks_not_covered`, `ito_matsui_spacing_range`) son
  identificadores estables en inglés (E11g: `m_alpha_pole`, `lambda_undefined` y `fos_nonpositive` quedan retirados
  porque ya no se emiten); agregar uno nuevo exige
  actualizar esta lista y `apps/web/src/engine/warnings.ts`. Los textos al usuario los traduce
  cada interfaz.
- `slice_circle` acepta círculos cuyo cruce externo coincide con `x_min` o `x_max` (|arco − terreno| ≤ tol en el borde).
  Solo es `OutsideModel` si el arco sale **bajo** el terreno por un borde lateral.

---

## 5. Pruebas obligatorias (el coordinador las verifica)
- **Identidad φ = 0**: en un círculo con φ = 0, Bishop = Σ c·l / Σ W sin α (|Δ| < 1e-9 relativo). Spencer converge a
  ese mismo valor como O(1/n²), porque con base en cuerda la igualdad no es exacta para n finito: |Δ| < 1e-4 con
  n = 50 y < 1e-9 con n ≥ 16000.
- **Identidad φ = 0 con vacío aéreo interior (E7a)**: en el círculo de R2-01 (talud con muesca), Spencer converge a
  Σ c·l / Σ W sin α como O(1/n²) (< 0,1 % con n = 500), y el residuo de momento global calculado de forma independiente
  es menor que 1e-6·(momento motor).
- **Simetría**: espejar el modelo (x → −x, con la dirección invertida) produce el mismo FS (|Δ| < 1e-9 relativo) en Bishop y Spencer.
- **Spencer ≈ Bishop**: en un círculo seco homogéneo con c > 0 y φ > 0 difieren < 1,5 %, y λ queda en (0, 1).
- **Aceptación** (`crates/ogs-core/tests/acceptance.rs`): cada check de `verification/cases/*.json` cumple su tolerancia.
  Falla si no encuentra casos (nunca reportar un éxito vacío).
