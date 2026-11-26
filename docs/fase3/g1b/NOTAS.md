# F3G-G1b (M-grieta): notas del escritor

Rama `f3g1b-grieta`, base `f6b0102`. Contrato: `briefs/04_CONTRATOS_GRIETA_AGUA.md` (F5.4, F5.5, F5.6).

## Qué hay

- `crates/ogs-core/src/crack.rs`: `locate` (G1, G6: barrido de 200 pasos y bisección de 60; profundidad de Rankine por `x`)
  y `truncate` (G2, G3: quita lo que quede del lado de la cresta y aplica `Pw` con `h_force`, `h_moment_base` y
  `driving_extra`). El `q` del agua embalsada se calcula ahí, desde la piezométrica y el terreno; no llama a `water.rs`.
- `crates/ogs-core/src/slicer.rs`: `slice_surface_cracked(pm, surface, n, loads, crack_x)`. Con grieta, el tramo que se
  corta va del pie a `x_c` (la cara es el extremo del tramo), de modo que las `n` divisiones caen en la masa y
  `check_block_ends`, E10a y E11d se aplican a la masa truncada. Sin grieta es el código de siempre (`slice_surface_of`
  llama con `None`).
- `crates/ogs-core/src/lib.rs`: solo el cableado (superficie final y candidatos de la búsqueda llaman a
  `slice_surface_cracked`; G9 descarta con `NotReached`).
- `crates/ogs-core/tests/f3g1b_crack.rs`: 19 tests.

## Decisiones que el coordinador puede revertir (propuestas de enmienda)

1. **Punto de prueba de G6.** F5.4 dice «1e-3·escala por debajo del terreno». cSlope toma **1e-3 unidades absolutas**.
   Con `1e-3·escala` (0,05 m en V047a, escala 50) la profundidad bajo un gradiente de `Su` cambia 0,6 % (X21-A04: 1,2575
   frente a 1,25015 del prototipo y del oráculo) y `x21_crack_rows_report_where_the_crack_is` falla (exige 1e-4). Se usa
   `2e-5·escala`, que es 1e-3 en la escala de las filas y no depende de la unidad. En un modelo de escala 500 son 1e-2
   unidades: solo importa si hay un gradiente de `Su` o una capa de menos de eso en la coronación.
2. **`CrackPlan::breaks` es un solo nodo en `x_c`**, no `x_c ± 1e-6·ancho`. La cara es el extremo del tramo que se corta,
   así que no hace falta dovela fina; el peso que se pierde frente a ±δ es 0. `truncate` también funciona sobre las
   dovelas del arco completo cortadas en `x_c`.
3. **`CrackError::NoGround`** (variante nueva). La superficie que no corta el terreno no tiene tramo de deslizamiento:
   `lib.rs` sigue sin plan y el cortador da el motivo de siempre («el círculo no corta el terreno»), no
   `tension_crack_not_reached`.
4. **Profundidad automática 0** (c = 0, o una sobrecarga que la anula en la entrada): no se corta nada. `x_c` es la
   entrada, `depth = 0`, `water_force = 0`, y el FS es el de la superficie sin grieta (test). El informe lleva
   `tension_crack` con profundidad 0; W2 debería dibujarlo como «sin grieta».
5. **Un `x_c` en el último paso del barrido** (la profundidad solo se alcanza en la salida) es `NotReached`.

## Filas de grieta sin agua embalsada, contra el oráculo (`f3g_rows`, máx. |Δ| entre los métodos de la fila)

| fila | máx. \|Δ\| % | método |
|---|---:|---|
| X21-A01 | 0.0104 | janbu_ |
| X21-A02 | 0.0106 | janbu_ |
| X21-A03 | 0.0129 | janbu_ |
| X21-A04 | 0.0152 | janbu_ |
| X21-A05 | 0.0064 | janbu_ |
| X21-C10 | 0.0062 | janbu_ |
| X21-C20 | 0.0029 | janbu_ |
| X21-C30 | 0.0014 | bishop |
| X21-CP-V072a | 0.0863 | janbu_ |
| X21-CP-V079-d05 | 0.0069 | janbu_ |
| X21-CP-V079-d10 | 0.0023 | janbu_ |
| X21-CP-V079-w000-sincrack | 0.0034 | spence |
| X21-CP-V079-w000 | 0.0022 | janbu_ |
| X21-CP-V079-w025 | 0.0028 | spence |
| X21-CP-V079-w050 | 0.0045 | spence |
| X21-CP-V079-w100 | 0.0105 | spence |
| X21-CP-V080 | 0.0028 | spence |
| X21-CP-V082a | 0.0192 | janbu_ |
| X21-CP-V088 | 0.0214 | janbu_ |
| X21-CP-V096c | 0.0289 | janbu_ |
| X21-N01 | 0.0100 | janbu_ |
| X21-N02 | 0.0100 | janbu_ |
| X21-N03 | 0.0100 | janbu_ |
| X21-S-V048-fija | 0.0149 | janbu_ |
| X21-S-V086b-auto | 0.0289 | janbu_ |
| X21-S-V086b-fija | 0.0306 | janbu_ |
| X21-S-V096a-fija | 0.0322 | janbu_ |
| X21-W025 | 0.0030 | janbu_ |
| X21-W050 | 0.0031 | janbu_ |
| X21-W100 | 0.0037 | janbu_ |
| X21-W100m | 0.0037 | janbu_ |

A07: `NoValidSurface: tension_crack_not_reached`. Las filas con grieta **y** agua embalsada (A06, CP-V009a, CP-V009b) dan
«sin FS» o un valor lejano porque faltan los términos del agua (M-agua); la posición y la profundidad de su grieta sí
coinciden con el prototipo (`x21_crack_rows_report_where_the_crack_is` en verde, A06 incluida: `q` del agua resta 0,98 m
a `z`).

## Criterios de F5.5 (test `f3g1b_crack.rs`)

- **Equilibrio global independiente** (fuerzas de la grieta en su punto real, sin recurrencia de momentos ni
  `h_moment_base`), 8 filas, solver a 1e-12: Spencer y M-P `Fx, Fy, M ≤ 3,6e-14`, `E_n ≤ 3,6e-14`; Janbu simplificado
  `Fx ≤ 2,8e-13`; Bishop (su formulación, mismo `R·sin α`) `≤ 1,2e-13`. El signo invertido da `Fx > 1e-3`: el test
  discrimina.
- **Espejo** (10 filas con grieta seca, llena, automática y polilínea): `|ΔFS| ≤ 1,3e-15`; `x_c` y `Pw` simétricos.
- **Monotonía con `water_fill`** (0, 0,2, …, 1; V047a, V079, V096c, cinco métodos y una búsqueda): estrictamente
  decreciente.
- **Continuidad**: `|FS/FS₀ − 1|` baja con la profundidad (1e-1 … 1e-6) y vale `≤ 1,4e-8` a 1e-6, seca y llena.
- **Búsqueda (G9)**: con una grieta de 12 m quedan válidas menos de la cuarta parte de las superficies; la crítica llega
  a 12 m en `x_c`; con 40 m, `NoValidSurface`.
- **Extremos de la masa truncada (G2)**: V047a con la pared derecha en x = 50,5: sin grieta «sale del modelo»; con 2 m
  la masa es válida y da el mismo FS que sin pared (`|Δ| < 1e-9`).
- **Refuerzos**: un clavo que cruza del lado de la cresta de `x_c` da `reinforcement_outside_mass` y el FS sin clavo; sin
  grieta el mismo clavo actúa.

## E15f: círculos tangentes al fondo (V096a, V086b). Decisión: no es el redondeo del contacto; se documenta, sin cambio

Con el fondo original (V096a en y = −9, V086b en y = 0) el motor v0.3.0 y el nuevo dan `NoValidSurface: el arco de
deslizamiento sale del modelo`, con o sin grieta:

| fila | `yc − r` del círculo de cSlope | fondo | el círculo pasa por debajo | `tol = 1e-9·escala` |
|---|---:|---:|---:|---:|
| S-V096a-fija | −9,000000835 | −9 | 8,35e-7 | 7,0e-8 |
| S-V086b-fija | −9,756e-7 | 0 | 9,76e-7 | 3,0e-8 |

El círculo del oráculo se pasa **12 y 33 veces** la tolerancia del motor: es el límite de la búsqueda de cSlope (1e-6),
no 1 ulp de `xc + r` como en V065 (E14o-11, `1e-7` por la raíz de una diferencia de `1e-14`). Con el fondo 1e-8, 1e-7 y
3e-7 más abajo sigue rechazado; con **1e-6** pasa y queda a `0,022 %` (V096a, Bishop) y `0,016 %` (V086b, Bishop) del
oráculo. Los 2 m que bajó X21 no hacían falta. Relajar la tolerancia admitiría círculos que de verdad salen del modelo,
así que no se toca. **El check se retiene con esta causa**; si se promueve, el caso debe llevar el fondo 1e-6 más bajo
(o la búsqueda de ogs, que no genera ese círculo).

Lo que sí cambia por G2: V086b con grieta automática y el fondo original (el círculo queda 7,8e-5 sobre el fondo)
ahora es válido (0,9666 frente a 0,96646 del oráculo, +0,017 %); antes de la masa truncada no lo era por la comprobación
del arco completo [test `the_toe_ends_of_the_circles_that_touch_the_bottom_keep_their_rule`].

## Para otros escritores

- M-agua: `water::apply_ponded` se llama después de `crack::truncate` y solo ve las dovelas de la masa; la región del
  agua embalsada del lado de la cresta de la cara no carga nada (igual que el prototipo).
- W2: `tension_crack.depth = 0` es la grieta automática que no corta nada.
- V: `crack::TENSION_CRACK_NOT_REACHED` abre el mensaje de `NoValidSurface`.
