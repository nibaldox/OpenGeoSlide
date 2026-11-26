# F3G-G1 M-agua: notas del escritor

Rama `f3g1a-agua`, base `f6b0102`. Archivos: `crates/ogs-core/src/water.rs` y `tests/f3g1a_water.rs`; un test previo
(`tests/f3r11a_cruces.rs`) cambia de aserción por la excepción de F5.1.

## Formulación (reescrita en Rust desde X21 §1.2)

- El terreno se parte en tramos rectos entre las abscisas de vértices de `PreparedModel` (la envolvente superior es una
  sola arista ahí). Cada dovela se corta además en los vértices de la piezométrica; `h = max(0, piezo − terreno)` se recorta
  en el cruce. `V`, `H_x`, y los momentos respecto de `(xm, ym)` y del centro, con Gauss de 3 puntos (exacto: grado ≤ 2).
- Paramento vertical (E4): un salto de la envolvente en un vértice. El empuje va a la dovela que tiene el paramento como
  borde del lado alto; `ya = max(pie, base)`, `yb = min(nivel, cabeza)`, centroide por Gauss.
- Sin sismo (E7): solo se suman `V`, `H` y sus momentos; `kh·W` y `kv·W` vienen del suelo.
- `ru` (E15c-ru): `pore_pressure += ru·V/b` en las dovelas cuyo material tiene `ru`.
- Dovelas de aire (E2): sin términos.

## Decisión no prevista por el contrato: profundidad bajo la tolerancia

Una piezométrica que **toca** el terreno (la freática que termina en el talud: V021a-g, V033, V045, V046b) daba
profundidades de 1e-15 y términos de 1e-29 que cambiaban los bytes del informe (50 diferencias de identidad). Una
profundidad ≤ `1e-9·escala` (la tolerancia del modelo, la del aviso `water_above_ground`) se toma como 0. Test:
`a_phreatic_line_that_touches_the_ground_gives_exact_zero_terms`.

## Efecto en un test previo

`f3r11a_cruces::interface_with_ru_ignores_the_piezometric_line` tiene una piezométrica a y = 32 sobre el talud (hasta
7 m sobre el banco del pie) con `ru = 0,3`. La capacidad de la interfaz sigue igual (E14o-4); el FS ya no, porque el agua
embalsada carga la dovela (1,1249 sin la línea; 2,2866 con ella). La aserción del FS pasa de igualdad a `a > b`.
