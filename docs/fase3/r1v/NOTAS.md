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

## Tarea 3: `verification/harness/to_cslope.py`
- `reinforcements_to_cslope`: `anchor`/`nail`/`geosynthetic` a `definition.reinforcements` (`tensileCapacity`, `end1Capacity`, `end2Capacity`, `spacing`, `pullout` con `kind` `bond`/`interface`/`development` en camelCase), `pile`/`sheet_pile` a `definition.piles` con `location: "slip-surface"`, `direction` y `application` explícitos; la tablestaca con `spacing` 1, `force` por metro y `wall: true`. Exige `version "0.4"` con la lista no vacía; la versión 0.4 sigue admitiendo cargas, sismo y los campos de 0.3.
- Tests en `test_to_cslope.py`: 120 filas del oráculo (se leen de `f3r_oracle.rs`, así que ambos lados usan las mismas filas) reproducidas a 2e-6 por el conversor, mapeos, rechazos, espejo y el caso del activo comprimido que el binario descarta. 234 tests, verdes.

## Tarea 4: importación de los lotes R1 a R4 (`verification/pending/F3R/`)
- `import_cslope.py`: `convert_f3r` (pasa por el mismo `_convert` de los lotes 1 y 2 con los refuerzos quitados y los escribe como `model.reinforcements`, versión 0.4), `gate_schema_f3r` (valida contra el `schema/ogs-0.4.schema.json` real), `gate_reinforcements` y `build_f3r_index`. No cambia ningún otro archivo generado: tras correrlo, `git status` solo muestra `pending/F3R/`.
- `direction` y `application` siempre explícitos; `type` por caso (el tipo no cambia ningún número); `coverage` ausente en `interface` va como 1 (lámina continua); `prestress`, `diameter` y `location` no se importan (anotado en `source.notes`); pilotes sin `force` (Ito-Matsui) y `shearCapacity`/`momentCapacity` se omiten.
- Resultado: **25 casos, 33 checks**, ninguno omitido. Los 33 pasan el esquema 0.4 y las reglas de F4.2, y el motor real (`target/release/ogs`) los acepta y llega al stub (`reinforcement.rs:223`), no a una validación.
- Harness `--oracle-only`: **cSlope reproduce 33 de 33** dentro de la tolerancia del publicado; retenidos: **0**. Peor error: V066c +1,16 % (tol 1,50 %); V037 Bishop −0,96 % (tol 2,03 %).
- Verificación independiente de la conversión: cSlope corrido directo sobre la definición original da el mismo FS que el conversor, a ≤ 1,4e-4 relativo (diferencias de dovelas y de tolerancia).
- **Hallazgo:** en **V016b** (3 checks) el oráculo no aplica ninguna fuerza (`reinforcementForces` vacío; FS = talud sin refuerzo, 1,8302 / 1,8354): el acuerdo con lo publicado no prueba nada sobre los refuerzos, y el binario descarta los activos con `along > 0` que ogs aplica (E14m-1). El índice lo lista (columna «fuerzas del oráculo» y sección propia) y R1 no debe usarlo como criterio de las fuerzas. Con ogs es esperable que V016b salga distinto de 1,83.
- Cambios en el harness: `run.py` ignora `report.json` y `HOLD.json` al leer un directorio de casos (antes un segundo `--out` en el mismo directorio fallaba), y agrega `cslope.reinforcement_forces` (elementos, fuerzas aplicadas) solo a los modelos con refuerzos; los informes de modelos sin refuerzos no cambian.
- Tests: `test_import_cslope.py` +10 (mapeos, rechazos, reglas, lotes, índice), `test_run.py` +2. `pytest verification/harness verification/tools/test_import_cslope.py`: 335 verdes.
