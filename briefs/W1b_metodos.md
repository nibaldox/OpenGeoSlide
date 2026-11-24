# Brief W1b: métodos Bishop simplificado y Spencer

**Lee primero:** `briefs/00_CONTRATOS.md` (§3 y §4.2-4.3 son normativos). Responde en español.

## Objetivo
Implementar `solve()` en `crates/ogs-core/src/methods/` (Bishop simplificado y Spencer por el algoritmo de Zhu et al. 2005),
sin cambiar firmas públicas.

## Archivos que te pertenecen
- `crates/ogs-core/src/methods/mod.rs`, `bishop.rs`, `spencer.rs`
- `crates/ogs-core/tests/methods.rs` (nuevo)

**No toques** nada más. Las dovelas (`Slice`) llegan ya ordenadas del pie al coronamiento, con α positivo cuando la base
sube hacia el coronamiento; los métodos no conocen la orientación del talud.

## Requisitos
- **Bishop** (§4.2): punto fijo desde F = 1; `Invalid` si `m_α < min_m_alpha` o si `Σ W sin α ≤ 0`; `NotConverged` si se
  agota `max_iterations`.
- **Spencer** (§4.3, Zhu, Lee, Qian & Chen 2005, *Can. Geotech. J.* 42: 272-278) con f = 1:
  - lazo anidado (F con λ fijo; luego E y λ), arrancando desde el F de Bishop (o 1 si Bishop no es válido) y λ = 0;
  - criterio de convergencia `|ΔF|/F < tol` y `|Δλ| < tol`;
  - `Invalid` si algún Φᵢ es casi cero (`|Φᵢ| < 1e-12`) o aparece un no finito;
  - devuelve `lambda: Some(λ)`.
- **Convención de signos:** documenta en un comentario de cabecera de `spencer.rs`, con 5-10 líneas, la derivación de
  signos que usas y por qué es consistente con el orden pie → coronamiento.
- **Fuerzas interdovela:** expón una función auxiliar `pub fn spencer_interslice(slices, fos, lambda) -> Vec<f64>`
  (fuerzas E) dentro del módulo `spencer`, útil para diagnóstico.

## Tests obligatorios (`tests/methods.rs`)
Genera las dovelas dentro del test con una rutina **independiente y simple**: talud homogéneo y círculo analítico,
dovelas de ancho uniforme, peso por columna en el punto medio y base en cuerda.
1. **Identidad φ = 0**: Bishop = Spencer = Σ c·l / Σ W sin α (< 1e-9 relativo).
2. **Spencer ≈ Bishop** en un caso seco con c = 10, φ = 30°, γ = 20 y talud 2:1 de H = 10: diferencia < 1,5 % y 0 < λ < 1.
3. **Equilibrio de fuerzas**: con el F y el λ convergidos de Spencer, `E_n` reconstruido por la recurrencia es ≈ 0
   (< 1e-6 · Σ W).
4. **Invalid**: dovelas con α muy negativo y φ alto (m_α < 0,2) → Bishop `Invalid`.
5. **NotConverged**: `max_iterations = 1` → `NotConverged`, nunca un FS presentado como convergido.
6. **Presión de poros**: aumentar u en todas las dovelas reduce el FS en ambos métodos (monotonicidad).
7. **Reproducción publicada (sin geometría):** si en tu investigación encuentras una tabla de dovelas publicada con su FS
   (por ejemplo, el ejemplo con tabla de dovelas de USACE EM 1110-2-1902 o de Duncan & Wright), agrégala como test **solo
   si** citas la fuente exacta en un comentario. Si no, omítelo; no inventes datos.

## Gates
- `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings` y `cargo test -p ogs-core --test methods`
  en verde.

## Cierre
- Commit en tu rama con rutas explícitas y el mensaje `feat(core): métodos de Bishop simplificado y Spencer`. Sin push.
- **Resumen:** valores de los tests 1-3 (F, λ, residuo), gates, hash y dudas.
- **Presupuesto:** ~45 iteraciones.
