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
