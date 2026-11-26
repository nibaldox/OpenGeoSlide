# R1-V: notas de trabajo (esquema, filas del oráculo, conversor, importación, batería)

Base 45fbe6f, rama `f3r1v-verif`. Se actualiza por tarea.

## Tarea 1: `location` fuera (E14m-3)
- `model.rs`: se quita `PileLocation` y el campo `location` de `Pile` y `SheetPile`.
- `schema/ogs-0.4.schema.json`: se quita de `required` y de `properties` en `pile` y `sheet_pile`.
- Tests de tipos (`f3r_types.rs`) y de esquema (`test_schema.py`): `location` pasa a ser un rechazo (campo desconocido), en pile y en sheet_pile.

## Tarea 2: `crates/ogs-core/tests/f3r_oracle.rs`
- Generado desde X17 §4.3 a §4.5 (la tabla de FS y los JSON v0.4 exactos, sin `location`), 4 métodos por fila: Bishop, M-P `constant`, Janbu simplificado y Janbu corregido. Nombre de cada test: `{fila}_{act|pas}_{método}`.
- 7 filas de F4.13 + 14 inclinadas + 9 de capacidad = 30 filas, 120 tests de oráculo. Tolerancia 0,1 %; 0,25 % en `cap_interface_pas` y `cap_interface_cov_5_sp2_pas`.
- **Desviación del brief: 14 y no 16 inclinadas.** Las filas **activas** `up30` y `up45` no son filas de oráculo: el binario descarta el cruce comprimido, pero E14m-1 aplica el activo comprimido (axial, completo) y E14m-1 dice que las filas de aceptación solo usan cruces con `along < 0`. Se sustituyen por `inc_up30_act_applies_the_force` e `inc_up45_act_applies_the_force`, que solo exigen que la fuerza se aplique (FS ≠ talud sin refuerzo en más de 1e-4). Las pasivas `up30` y `up45` sí quedan (el FS es el del talud sin refuerzo, `compression_ignored`).
- Estado en la base: **122 tests en RED**, todos con el pánico del stub `not yet implemented: R1: fuerzas de refuerzo` (no por serde ni validación).
- Riesgo anotado: X17 solo midió el prototipo en Bishop y Janbu corregido para `cap_interface*` (−0,177 % y −0,113 % en Bishop); M-P y Janbu simplificado no están medidos con la integral exacta. Si alguno pasa de 0,25 % se reporta, no se relaja.
