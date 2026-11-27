# R12: notas de integración (coordinador)

**Base:** `f3g-integracion` en `62d8fce`, que reúne los merges de M-A, M-B, W1, W2 y P más los parches `M-B-lib.patch` y
`W1-editorcanvas-sin-grieta.patch`.

## Gates del motor integrado (medidos por el coordinador)

- `cargo test -p ogs-core --release --no-fail-fast`: 676 tests, todos pasan.
- Aceptación: 327 checks, 0 fallas.
- `identity_vs_baseline.py --normalize-version --include-reinforced`, contra la v0.3.0:
  - 0 diferencias en 150 modelos.
  - Las 2 excepciones declaradas (V019) se informan aparte.
  - Los 18 modelos con agua sobre el terreno se informan aparte.
  - Se saltan 28 modelos con grieta y 7 con Ito-Matsui.

## Qué cambia frente al binario anterior a R12 (`ae5ee73`)

**Método:**
- Se corrieron todos los modelos de `verification/cases` y `verification/differential/cases*` con los dos binarios, y se
  compararon las salidas JSON campo por campo, normalizando el campo `engine`.
- Para atribuir cada cambio a una enmienda, se compiló un binario por commit de M-A: `247ccce`, `0013888`, `e916e26`,
  `3e97276`, `05b68c3`, `6fdc118` y `d1ca776`.

| Modelos | Qué cambia | Enmienda |
|---|---|---|
| V048, V073, V086b-auto, V086d, D33, D36, D38, D39 (con grieta y búsqueda) | Solo `search.valid`, de +1 a +4 candidatos. El FS y la superficie crítica son iguales. | **E15l-3** (`6fdc118`): con los vértices en el barrido, algunos candidatos que antes no encontraban la grieta ahora la alcanzan. Todos los binarios anteriores a `6fdc118` dan el contador viejo. |
| D30 | Se agrega el aviso `water_above_ground`. El FS es igual. | **E15l-5** |
| V013c, V013d, V013e y D41 (Ito-Matsui) | `arm` y los términos pasivos de la dovela del cruce. ΔFS ≤ 1e-6 relativo. | **E15l-13** |
| D40 y D42 (Ito-Matsui, búsqueda) | La búsqueda elige un círculo crítico vecino: D40 pasa de `xc` 17,0751 a 17,0792. ΔFS ≤ 1,5e-6 relativo. | **E15l-13** |

Ningún otro modelo del corpus cambia.
