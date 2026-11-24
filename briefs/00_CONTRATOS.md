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
  1. Si `analysis.search` trae **ambos** rangos, `entry` y `exit`, la masa va de la entrada a la salida:
     `left_to_right` si `mid(entry) < mid(exit)` y `right_to_left` en caso contrario.
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
                          pub iterations: usize, pub lambda: Option<f64>, pub message: Option<String> }
pub fn solve(slices: &[Slice], method: MethodKind, opts: &SolveOptions) -> MethodResult;

// search.rs
pub struct SearchStats { pub evaluated: usize, pub valid: usize }
pub struct SearchResult { pub best: Option<(Circle, f64)>, pub stats: SearchStats }
pub fn search_circular<G, E>(ground: &G, spec: &SearchSpec, eval: E) -> SearchResult
    where G: Ground + Sync, E: Fn(&Circle) -> Option<f64> + Sync;
// eval devuelve Some(FS) solo para superficies válidas y convergidas.

// report.rs (Serialize, snake_case)
pub struct MethodReport { pub method: MethodKind, pub fos: f64, pub status: SolveStatus, pub iterations: usize,
                          pub lambda: Option<f64>, pub surface: Circle, pub slices: Vec<Slice>,
                          pub search: Option<SearchStats>, pub warnings: Vec<String> }
pub struct AnalysisReport { pub engine: String /* "ogs-core <version>" */, pub results: Vec<MethodReport> }

// lib.rs
pub enum OgsError { InvalidModel(String), NoSurface, NoValidSurface, Json(String) }  // thiserror
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
2. Se buscan los cruces del arco con el terreno `y_top`. Los puntos de salida y entrada son el primer y el último
   cruce del tramo donde el arco queda bajo el terreno. Si el arco vuelve a quedar sobre el terreno entre ambos puntos
   → `AboveGround`. Si un cruce necesario cae en el semicírculo superior → `UpperArc`. Sin cruces → `NoIntersection`.
3. Si el arco baja de `y_bottom(x)` en algún punto → `OutsideModel`.
4. Bordes de dovela: `n` divisiones uniformes entre salida y entrada, más **puntos de quiebre** en todos los vértices x de
   las regiones, de la piezométrica y en los cruces del arco con aristas de región, para que cada dovela tenga material de
   base único y perfiles lineales. Se descartan las dovelas de ancho < 1e-9 · (ancho total).
5. La base de cada dovela es la **cuerda** entre los puntos del arco en `x_left` y `x_right`. α es la inclinación de esa
   cuerda, con signo positivo cuando sube hacia el coronamiento.
6. Peso: en `x_mid`, la vertical entre `y_base_mid` (punto medio de la cuerda) y `y_top(x_mid)` se intersecta con
   cada región: `W = b · Σ γ_k · h_k`, aplicando `unit_weight_sat` bajo la piezométrica cuando corresponda.
7. Material de la base: región que contiene el punto `(x_mid, y_base_mid + ε)`. Si no hay ninguna → `NoMaterial`.

### 4.2 Bishop simplificado
`F = Σ [ (c·b + (W − u·b)·tanφ) / m_α ] / Σ W·sin α`, con `m_α = cos α + sin α · tanφ / F`.
- Iteración de punto fijo desde F₀ = 1 hasta `|ΔF|/F < tolerance`.
- Si algún `m_α < min_m_alpha` → `Invalid` (mensaje `"m_alpha"`).
- Si `Σ W sin α ≤ 0` → `Invalid`.

### 4.3 Spencer (Morgenstern-Price con f = 1)
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

---

## 5. Pruebas obligatorias (el coordinador las verifica)
- **Identidad φ = 0**: en un círculo con φ = 0, Bishop = Spencer = Σ c·l / Σ W sin α (|Δ| < 1e-9 relativo).
- **Simetría**: espejar el modelo (x → −x, con la dirección invertida) produce el mismo FS (|Δ| < 1e-9 relativo) en Bishop y Spencer.
- **Spencer ≈ Bishop**: en un círculo seco homogéneo con c > 0 y φ > 0 difieren < 1,5 %, y λ queda en (0, 1).
- **Aceptación** (`crates/ogs-core/tests/acceptance.rs`): cada check de `verification/cases/*.json` cumple su tolerancia.
  Falla si no encuentra casos (nunca reportar un éxito vacío).
