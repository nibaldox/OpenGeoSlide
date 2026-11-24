# Brief W1a: geometría y dovelas

**Lee primero:** `briefs/00_CONTRATOS.md` (§1, §3 y §4.1 son normativos). Responde en español.

## Objetivo
Implementar `PreparedModel` (incluido `impl Ground` y `piezometric_y`) y `slice_circle` en `ogs-core`, reemplazando los
`todo!("W1a")` sin cambiar ninguna firma pública.

## Archivos que te pertenecen
- `crates/ogs-core/src/geometry.rs`, `crates/ogs-core/src/slicer.rs`
- `crates/ogs-core/tests/slicer_geometry.rs` (nuevo)

**No toques** ningún otro archivo. Si necesitas cambiar un contrato, **detente y repórtalo**.

## Requisitos
- `PreparedModel::new`:
  - valida el modelo: al menos una región; polígonos de ≥ 3 vértices; materiales referenciados existentes;
    `unit_weight > 0`; `0 ≤ friction_angle < 90`; `cohesion ≥ 0`; `ru` en [0, 1); piezométrica con x estrictamente creciente.
    Los errores van como `OgsError::InvalidModel` con mensaje en español;
  - precalcula `tan φ`, la extensión x y `Sliding` (regla `auto` de §1).
- `y_top(x)` / `y_bottom(x)`: envolventes por intersección de la vertical con todas las aristas. Debe ser robusto en
  vértices compartidos y aristas verticales (en una arista vertical usa el máximo o el mínimo de sus extremos). Fuera del
  rango → `None`.
- `slice_circle`: exactamente §4.1, incluidos el orden pie → coronamiento, el signo de α, los puntos de quiebre, la base
  en cuerda, el peso por intersección vertical con `unit_weight_sat` bajo la piezométrica, el material de la base y la
  presión de poros (ru o piezométrica).
- Rendimiento: evita asignaciones repetidas. Objetivo < 20 µs para 50 dovelas en un modelo de 1 región (nativo, release).
  Mídelo con un test `#[ignore]` y reporta la cifra.

## Tests obligatorios (en `tests/slicer_geometry.rs`)
1. `y_top` / `y_bottom` en ACADS 1(a) (`(20,20)-(20,25)-(30,25)-(50,35)-(70,35)-(70,20)`): x = 25 → 25; x = 40 → 30;
   x = 60 → 35; x = 10 → None.
2. `Sliding`: ACADS 1(a) → `RightToLeft`; el modelo espejado (x → −x) → `LeftToRight`; los overrides explícitos se respetan.
3. Convergencia de área: para un círculo válido de ACADS 1(a), `Σ W/γ` con n = 2000 coincide en < 1e-4 relativo con el
   área exacta entre arco y terreno, calculada por integración numérica independiente (≥ 1e5 franjas) dentro del test.
4. Dos capas (horizontal en y = 27): existe un borde de dovela en el cruce arco-frontera (|Δx| < 1e-9) y el material de
   base cambia ahí.
5. Orden y signo: `slices[0]` en el pie y `slices[last]` en el coronamiento para ambas orientaciones; α > 0 en la última dovela.
6. Espejo: el modelo espejado con el círculo espejado da los mismos `Σ W`, `Σ W·sin α` y `Σ c·l` (< 1e-9 relativo).
7. Errores: un círculo lejos del talud → `NoIntersection`; un círculo que corta la base del modelo → `OutsideModel`;
   un centro bajo el terreno del coronamiento → `UpperArc` o `AboveGround`, según corresponda.
8. Agua:
   - piezométrica horizontal → `u = γw · h` exacto;
   - `ru = 0.25` → `u = 0.25 · σv`;
   - con `unit_weight_sat` el peso aumenta solo en la parte sumergida (verifícalo contra un cálculo manual en una dovela).

## Gates
- `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test -p ogs-core --test slicer_geometry` y `cargo test -p ogs-core --lib` en verde.

## Cierre
- Commit en tu rama con rutas explícitas y el mensaje `feat(core): geometría del modelo y generación de dovelas circulares`.
  Sin push.
- **Resumen:** salida de los gates, cifra de rendimiento, hash del commit y dudas sobre los contratos.
- **Presupuesto:** ~45 iteraciones.
