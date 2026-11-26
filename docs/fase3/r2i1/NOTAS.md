# F3R-R2 · I1: verificación y promoción (notas de trabajo)

Rama `f3r2i1-verif`, base `5c63019`. Se completa por tarea.

## 1. V065 con Spencer «sin dato»: error real del motor (corregido)

**Síntoma.** `ogs analyze` sobre el modelo de V065 devuelve `NoValidSurface: el círculo no corta el terreno` (exit 2).
El harness lo anota como «sin dato». No es de Spencer: falla igual con Bishop, Janbu corregido y M-P, y falla también
sin refuerzos (talud homogéneo con el mismo círculo).

**Causa.** El círculo publicado (xc 4,658; yc 15,000; r 10,934) tiene el centro a la cota de la coronación (y = 15), así
que su arco inferior termina en la tangente vertical, `x = xc + r`, sobre la coronación. `4,658 + 10,934` redondea a
`15,591999999999999`; `(xc + r) − xc` vale `r − 1,8e-15` y `sqrt(r² − t²)` da `2,06e-7` en lugar de 0. La holgura en el
extremo del arco salía `−2,06e-7`, sobre la tolerancia geométrica (`1e-9·escala`), y el arco se tomaba como bajo el
terreno en su propio extremo: pérdida de cifras de la raíz, no un hecho geométrico. La regla de V068 (I-M) admitía ese
extremo solo si la holgura era ≤ tol, y V068 pasaba por suerte del redondeo.

**Corrección** (`crates/ogs-core/src/slicer.rs`, `check_block_ends_circle`): en el extremo propio del círculo
(`x == xc ± r`) la altura del arco es `yc` por construcción. No cambia la regla (solo un toque cuenta; un arco sobre el
terreno sigue rechazado, un arco bajo el terreno sigue siendo `UpperArc`).
Test RED antes: `crates/ogs-core/tests/f3r2_tangent_end.rs` (3 tests: V065 sin refuerzos con ambos métodos, espejo con
el extremo a la izquierda, 40 pares decimales con el extremo redondeado).

**Resultado.** Spencer 0,96037 (estado `converged`, aviso `reinforcement_outside_mass`: R3 a R15 no cruzan la masa;
cruzan R1 y R2, igual que las «2 de 15» del oráculo). cSlope 0,9585 (+0,20 %), publicado 0,964 (−0,38 %, tolerancia 1,05 %).

## 4. Identidad (`identity_vs_baseline.py`)

`model_paths()` se divide con `split_models()`: los modelos con `reinforcements` no vacío se saltan y se cuentan aparte
(el binario base v0.2.0 no los lee). Test RED antes: `verification/tools/test_identity_vs_baseline.py` (3 tests).
Corrida con la corrección de V065 incluida, base `$TMPDIR/f3r-base-target/release/ogs` (v0.2.0):
**121 modelos sin refuerzos, 0 diferencias** (las cinco variantes, 121 comparaciones cada una, todas con salida ok del
baseline), **29 modelos con refuerzos saltados**. La corrección de V065 no cambia ninguna salida de los 121.

## 2. Comparación por cruce (ogs `reinforcement_forces` frente al oráculo `reinforcementForces`)

Módulo `verification/harness/forces.py` (con `test_forces.py`, 7 tests) y la sección «Comparación por cruce» de
`REPORT.md` (más `forces_comparison` por check en `report.json`). Los cruces se emparejan por elemento y por orden de
`x`. En la búsqueda (V037) ogs se vuelve a correr sobre el círculo crítico del oráculo.

Resultado sobre los 33 checks (binario de esta rama): **165 cruces emparejados, 0 sin explicar**, mismo número de
cruces aplicados en los dos motores en los 33 checks (ogs aplica 0 donde el oráculo aplica 0). Diferencias:

- **Posición** (`|Δx,y|` hasta 3,3e-3 en V065; 1e-15 en los casos con superficie poligonal de V014, V015, V083, V084):
  el oráculo cruza con la poligonal de las cuerdas de sus dovelas, ogs con el arco exacto. En V095c el cruce del pilote
  es el mismo punto (x = 9) porque la cabeza es vertical.
- **Fuerza constante** (`force`, `tensile_capacity` sin rampa): `ΔF` = 0 en V010, V010b, V011, V012, V035, V037, V065,
  V066a, V066c, V066e, y ≤ 7e-11 en V014 y ≤ 1e-14 en V015, V083 y V084 (precisión de máquina).
- **`development`, rampa** (V064 R1 y R3, V066b R11): `ΔF = (Tmax/ℓ)·Δs`. V064 R3: Tmax/ℓ1 = 5,8277 por Δs = −3,7565e-4
  da −2,189e-3, y ΔF medido −2,1892e-3; V064 R1: 29,139 × (−4,0e-6) = −1,165e-4 frente a −1,1649e-4; V066b R11 (a
  0,0048 m del extremo 2): 52,45 × 2,3e-5 = 1,2e-3 frente a 1,2250e-3.
- **Dirección** (V095c, pilote pasivo, `direction: tangent`): misma magnitud (10,7 kN/m); ogs (6,6852; 8,3545) a 51,33°,
  oráculo (6,8170; 8,2473) a 50,42°; ΔF = 0,17. ogs usa la tangente exacta del círculo en el cruce (una dovela de ancho
  cero en x = 9, `alpha` 51,3334° = atan(6,326/5,062)); el oráculo usa el `alpha` de su dovela (0,88006 rad = 50,42°,
  la cuerda de [8,8156; 9,0196]). El efecto en el FS es de 1e-4 (ogs 1,1956, oráculo 1,1957, publicado 1,193).
- **V016b**: **no es E14m-1.** Ni ogs ni el oráculo aplican fuerza (0 cruces de 3 elementos). Los tres elementos quedan
  enteramente dentro del círculo fijo (xc 16,087; yc 10,358; r 6,052): las intersecciones de la recta de cada elemento
  con el círculo caen en t ∈ [−1,517; 1,463] (R1), [−3,146; 2,064] (R2) y [−7,765; 3,601] (R3), todas fuera de [0, 1].
  Sin cruce no hay compresión que descartar; ogs avisa `reinforcement_outside_mass`. El FS de los tres checks es el del
  talud sin refuerzo, y lo publicado (1,83 a 1,839) no prueba nada sobre los refuerzos. La explicación del brief, de
  X17 y de `INDEX.md` («el binario descarta los activos con along > 0 que ogs aplica») no se cumple en estas 25 filas: en
  ninguna ogs aplica un activo que el oráculo descarta. E14m-1 se apoya en X17 §1.4 (barrido de ángulos con el binario), no
  en V016b; ninguno de los 25 casos lo ejercita contra el oráculo.
