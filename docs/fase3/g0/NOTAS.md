# F3G-G0: notas del escritor (tipos, stubs, E15h, identidad)

Base `db38ac6`, rama `f3g0-tipos`. Contrato: `briefs/04_CONTRATOS_GRIETA_AGUA.md`.

## E15h: el momento del peso del agua cabe en los campos actuales

**Decisión: no se agrega ningún campo a `Slice`.** `weight_extra`, `h_force`, `h_moment_base` y `driving_extra` bastan.
`Slice` queda como en la v0.3.0 y el informe JSON no cambia ni un byte.

### Qué hace cada campo en el código (leído en `methods/*`, `slicer.rs` y `reinforcement.rs`)

| Campo | Quién lo lee | Qué es |
|---|---|---|
| `weight_extra` | `Slice::total_weight` (`W* = weight + weight_extra`), en todos los métodos | Fuerza vertical hacia abajo **aplicada en la vertical del punto medio de la base** |
| `h_force` | Spencer, M-P y Janbu (`h_force·cos α`, `h_force·sin α`, `thrust`) | Fuerza horizontal en el sentido del deslizamiento |
| `h_moment_base` | **Solo** `spencer.rs:1071` y `:1175` (`moment_h = 2·Σ h_moment_base`) y `morgenstern_price.rs` | Momento, respecto del punto medio de la base, de lo que no es `W*`, `N` ni `S`. El solver solo lo **suma**: `Σ b(E_k+E_{k+1})(tan α − λ) − 2·Σ h_moment_base = 0` |
| `driving_extra` | **Solo** Bishop (`bishop.rs:72`, `:95`, y `Slice::driving_term`) | Momento motor extra respecto del centro, dividido por `R`, sumado a `W*·sin α` |

Nadie interpreta `h_moment_base` como `h_force × brazo`: ningún método lo divide por `h_force` ni lo usa para ubicar una
línea de empuje. Janbu no lo lee, y para el agua solo necesita las fuerzas (E2).

### Por qué cabe

Con `(xg, yg)` el punto de aplicación y `(xm, ym)` el punto medio de la base, `W*` ya actúa en `xm`. El peso del agua
`V` actúa en `xg`, de modo que su efecto es `V` en `xm` (va a `weight_extra`) **más** el momento `s·V·(xg − xm)` respecto
de `xm`. Ese momento tiene exactamente la naturaleza de lo que `h_moment_base` ya agrupa (un momento respecto del punto
medio de la base que no sale de `W*`, `N` ni `S`), y el signo es el de E2:

- Spencer y M-P: `h_moment_base += H·(yg − ym) + s·V·(xg − xm)`;
- Bishop: `driving_extra += [H·(yc − yg) − s·V·(xg − xm)]/R`.

Con el marco del test de equilibrio global (`f3_methods.rs::global_moment`, deslizamiento hacia −x, `s = −1`), el
momento antihorario de `V` hacia abajo con brazo `dx = xg − xm` es `−V·dx = s·V·dx`, el que E2 pide; y el de `H` con brazo
`yg − ym` es `+H·(yg − ym)`. Ese test ya suma `h_force·ry + h_moment_base`: sirve tal cual para el agua.

### Evidencia

- X21 §1.2 E2 y `X21_proto/solvers.py:6-7`: el prototipo guarda «`Mb = H·(yg − ym) + s·V·(xg − xm)` → `h_moment_base`
  (ampliado con V excéntrica)» y `Dx` en `driving_extra`. Con eso, el equilibrio global independiente (fuerzas y momentos
  con las fuerzas nuevas en su punto real, sin usar la recurrencia ni `h_moment_base`) da **≤ 2,2e-16** en Spencer, M-P y
  Janbu en 52 filas, y las 54 filas quedan dentro de 0,1 % del oráculo.
- X21 §2.5 dice que «la formulación por dovela … su costo es un campo nuevo (`weight_moment_base` o equivalente)». Eso
  es cierto **si** el campo nuevo se quiere separado; pero el prototipo no lo necesitó: sumó el momento de `V` a `Mb`. La
  separación no aporta nada a ningún método, porque ninguno distingue el origen del momento.
- Los refuerzos y las cargas ya usan los mismos campos con ese contrato (R1/F4.6): las cargas puntuales caen en una
  dovela fina centrada en su punto, de modo que su brazo es 0. El agua es la primera fuerza vertical **con brazo ≠ 0**;
  la suma del brazo en `h_moment_base` no cambia ninguna lectura existente (los métodos suman el campo, no lo desglosan).

### Qué queda en `PondTerms` (el contrato congelado para M-agua)

`water::PondTerms { weight, h_force, h_moment_base, driving_extra, pore_pressure }` es **por dovela** y su elemento neutro
es `ZERO`. `PondTerms::add_to` no toca la dovela si todo es 0 (conserva incluso un `-0.0`), de modo que sin agua embalsada
la salida es la de la v0.3.0 (test `zero_pond_terms_leave_the_slices_bit_for_bit`). `pore_pressure` es el término de la
regla `ru` de E15c (`u = ru·(W + V)/b`: suma `ru·V/b`); vale 0 en un material sin `ru`.

**Riesgo anotado, no bloqueante:** una dovela con `h_force = 0` pero `h_moment_base ≠ 0` (agua sobre terreno plano)
es nueva. Ningún método condiciona sobre `h_force != 0`; `is_inert` mira `weight`, `cohesion` y `tan_phi`, no los extras.
M-agua debe confirmarlo con el equilibrio global independiente (E15e-2) en P01…P08 y D01…D04.

## Firmas congeladas

```rust
// crates/ogs-core/src/model.rs
pub const FORMAT_VERSION_V05: &str = "0.5";
pub enum CrackDepth { Fixed(f64), Auto }              // sin etiqueta: 2.0 o "auto" (serde a mano)
pub struct TensionCrack { pub depth: CrackDepth, pub water_fill: f64 }   // obligatorios; deny_unknown_fields; solo un objeto
AnalysisSettings.tension_crack: Option<TensionCrack>   // skip_serializing_if = "Option::is_none"

// crates/ogs-core/src/report.rs
pub struct CrackReport { pub x: f64, pub depth: f64, pub water_force: f64 }
MethodReport.tension_crack: Option<CrackReport>        // skip_serializing_if = "Option::is_none"

// crates/ogs-core/src/crack.rs  (stubs: todo!("G1: grieta de tracción"); solo se llaman si analysis.tension_crack existe)
pub const TENSION_CRACK_NOT_REACHED: &str = "tension_crack_not_reached";
pub enum CrackError { NotReached }
pub struct CrackPlan { pub x_c: f64, pub depth: f64, pub breaks: Vec<f64>, pub water_height: f64, pub gamma_w: f64 }
pub fn locate(spec: &TensionCrack, pm: &PreparedModel, surface: &Surface, loads: &LoadCase) -> Result<CrackPlan, CrackError>;
pub fn truncate(plan: &CrackPlan, pm: &PreparedModel, surface: &Surface, slices: &mut Vec<Slice>) -> CrackReport;

// crates/ogs-core/src/water.rs  (stub: términos nulos)
pub struct PondTerms { pub weight, pub h_force, pub h_moment_base, pub driving_extra, pub pore_pressure: f64 }
pub fn ponded_terms(pm: &PreparedModel, surface: &Surface, slices: &[Slice], s: f64) -> Vec<PondTerms>;
pub fn sliding_sign(pm: &PreparedModel) -> f64;        // +1 LeftToRight, −1 RightToLeft
pub(crate) fn apply_ponded(pm, surface, slices);       // lo que llama lib.rs
```

### Dónde las llama `lib.rs` (superficie final y cada candidato de la búsqueda)

1. `crack::locate` (solo con grieta) → `Err(NotReached)`: superficie fija = `NoValidSurface: tension_crack_not_reached: …`;
   candidato de búsqueda = **descartado** (G9), y si caen todos, el `NoValidSurface` de siempre.
2. `plan.breaks` se suman a los cruces de los refuerzos en `LoadCase::with_extra_breaks`.
3. Se corta la superficie. **M-grieta** debe cambiar en `slicer.rs` las comprobaciones de extremos
   (`check_block_ends`, E10a y E13) para que se apliquen a la masa truncada (G2); `slicer.rs` queda intacto en G0.
4. `crack::truncate`: quita las dovelas del lado de la cresta, suma `Pw` a la dovela de la cara y devuelve el `CrackReport`.
5. `water::apply_ponded`, y luego los refuerzos.

El `surface` del informe se recorta a las dovelas que quedan también con grieta (`to_report_within`), como ya hace
`truncated_mass`; solo se nota en una polilínea.

### Decisiones del escritor que el coordinador puede revertir

- **El motivo de A07.** El contrato dice «inválida, con el motivo `tension_crack_not_reached`». Se implementó como
  `OgsError::NoValidSurface("tension_crack_not_reached: …")` en superficie fija (el mismo canal que
  `surface_reason`), no como un `MethodReport` con `status: Invalid`. `f3g_rows::x21_a07_…` espera esa cadena.
- **X21-N03.** Tiene `depth: 0`, que F5.2 rechaza (`depth > 0`). La fila migrada usa `depth: 1e-6` (el límite
  `depth → 0⁺` de F5.5-5) con las cifras del oráculo para profundidad 0 (la ladera seca). La tabla de validación
  (`f3g_types`) cubre `depth: 0` como error.
- **Filas ejecutables.** Cada fila de `tests/data/f3g/rows/` declara los métodos que tienen cifra del oráculo (sin Bishop en
  polilínea, que el motor no ofrece) y `analysis.interslice = constant`, porque el oráculo corre Spencer como M-P `constant`
  (E8) y el M-P del motor es `half_sine` por defecto. `generate.py` regenera todo desde `X21_filas/`.
- **Errores de forma de serde.** `analysis.tension_crack: [2.0, 1.0]` (un arreglo) se rechaza como el esquema (serde lo
  aceptaría como los campos en orden): `TensionCrack::deserialize` solo admite un objeto. `depth` y `water_fill` ausentes,
  `null` o de otro tipo dan la ruta `analysis.tension_crack.<campo>`.
- **Versión del motor.** No se subió: sigue `ogs-core 0.3.0` en `Cargo.toml`. `--normalize-version` ya está probado
  con un binario que imprime otra versión (750 diferencias sin la opción, 0 con ella).
- **Tests de otras olas movidos a `"0.6"`** como versión desconocida: `f3r_types.rs`, `loads_seismic.rs`, `v03_format.rs`,
  `test_schema.py` y `apps/web/src/editor/types.test.ts`. `ogs-cli` (`main.rs`) todavía dice «v0.1 a v0.4» en su ayuda:
  no es de G0.

## Identidad

`identity_vs_baseline.py --normalize-version --include-reinforced --base …/f3g-base-target/release/ogs --new target/release/ogs`:
150 modelos (casos, `pending`, batería diferencial y ejemplos, con refuerzos incluidos) × 5 variantes = 750 comparaciones, **0
diferencias**; todas las salidas del baseline son `ok`. La lista de modelos con la piezométrica sobre el terreno
(por geometría, y contra `water_above_ground` en la salida del baseline) está **vacía**, también para los modelos
sin refuerzos. Los modelos con agua sobre el terreno que lleguen después se separan y se informan por su nombre
(excepción de F5.1); no cuentan como diferencia.
