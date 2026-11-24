# Brief W1c: búsqueda de la superficie circular crítica

**Lee primero:** `briefs/00_CONTRATOS.md` (§3 y §4.4 son normativos). Responde en español.

## Objetivo
Implementar `search_circular` en `crates/ogs-core/src/search.rs` (grilla entrada × salida × radio + refinamiento por
patrones), genérico sobre `Ground` y el evaluador, sin cambiar firmas.

## Archivos que te pertenecen
- `crates/ogs-core/src/search.rs`
- `crates/ogs-core/tests/search.rs` (nuevo)

**No toques** nada más. No dependas de `PreparedModel`, `slice_circle` ni `solve`: en tus tests usa un `Ground` falso y
un evaluador falso.

## Requisitos
- §4.4 exacto:
  - entrada cuesta arriba según `sliding()`, `min_width` (por defecto 1 % del ancho) y radios en serie geométrica;
  - centro en la mediatriz del lado superior;
  - refinamiento desde las 5 mejores, con pasos que se reducen a la mitad, límite de 300 evaluaciones por semilla y
    respeto de los rangos.
- Si `entry` o `exit` faltan, usa todo `ground.x_range()`. Ignora los puntos donde `y_top` es `None`.
- Feature `parallel` (rayon): la grilla se evalúa con `par_iter`. El resultado debe ser **idéntico** al serial:
  reduce por (FS, índice) para desempatar de forma determinista.
- `SearchStats.evaluated` = llamadas a `eval`; `valid` = las que devolvieron `Some`.

## Tests obligatorios (`tests/search.rs`)
1. **Optimalidad:** con un `Ground` analítico (talud 2:1, H = 10) y un evaluador falso suave, por ejemplo
   `1 + ((xc−40)/10)² + ((yc−45)/10)² + ((r−25)/10)²`, el FS encontrado es ≤ al mejor de una fuerza bruta densa
   (≥ 60 × 60 × 60 sobre la misma familia de círculos) + 1e-3.
2. **Orientación:** con un terreno que desciende hacia la izquierda y otro que desciende hacia la derecha, todas las
   superficies evaluadas tienen la entrada cuesta arriba de la salida. Registra en el evaluador los círculos recibidos,
   recalcula los dos cruces con el terreno y verifícalo.
3. **Rangos y ancho:** todas las entradas y salidas evaluadas caen dentro de sus rangos y cumplen `|x_e − x_s| ≥ min_width`.
4. **Determinismo:** dos ejecuciones dan un resultado idéntico bit a bit. Con `--features parallel` el resultado es
   idéntico al serial (ejecuta `cargo test -p ogs-core --features parallel --test search`).
5. **Sin válidas:** si el evaluador devuelve siempre `None` → `best = None` con `evaluated > 0` y `valid = 0`.

## Gates
- `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`,
  `cargo test -p ogs-core --test search` y `cargo test -p ogs-core --features parallel --test search`.

## Cierre
- Commit en tu rama con rutas explícitas y el mensaje `feat(core): búsqueda circular por entrada-salida con refinamiento`.
  Sin push.
- **Resumen:** gates, número de evaluaciones del test 1 (grilla + refinamiento), hash y dudas.
- **Presupuesto:** ~40 iteraciones.
