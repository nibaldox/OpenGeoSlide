# R1-V: notas de trabajo (esquema, filas del oráculo, conversor, importación, batería)

Base 45fbe6f, rama `f3r1v-verif`. Se actualiza por tarea.

## Tarea 1: `location` fuera (E14m-3)
- `model.rs`: se quita `PileLocation` y el campo `location` de `Pile` y `SheetPile`.
- `schema/ogs-0.4.schema.json`: se quita de `required` y de `properties` en `pile` y `sheet_pile`.
- Tests de tipos (`f3r_types.rs`) y de esquema (`test_schema.py`): `location` pasa a ser un rechazo (campo desconocido), en pile y en sheet_pile.
