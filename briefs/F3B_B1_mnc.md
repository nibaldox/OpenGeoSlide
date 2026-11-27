# Brief F3B-B1 M-NC: búsqueda no circular en el motor

Escritor: **Terra**. Lee primero `briefs/F3B_B1_comun.md` (dueños, reglas y gates) y el contrato
`briefs/05_CONTRATOS_FASE3B.md`, en especial **F6.4, F6.6, F6.7, F6.10 y F6.11**.

## Objetivo

Reemplazar el stub `todo!("F3B-M-NC")` de `noncircular::refine` por el algoritmo de F6.10, puntos 1 a 9, y llenar
`SearchResult.seeds` en `search.rs`.

## Qué hacer

1. **Semillas** (`search.rs`, solo esto):
   - la semilla 1 es el círculo crítico refinado (`best`);
   - las otras `seeds − 1` son los mejores círculos de la malla, distintos en más del 5 % del span, en orden de
     (FS, índice).

   La búsqueda circular no cambia: el `best` y las estadísticas de un modelo sin `non_circular` quedan iguales byte a
   byte (identidad). Si llenar `seeds` cuesta tiempo, hazlo solo con `non_circular`.
   - El número de semillas está en `spec.non_circular`, que no llega a `search.rs`. Lee cómo se llama la búsqueda y,
     si hace falta, guarda en `seeds` los 10 mejores círculos distintos (el máximo de F6.4); `refine` toma los
     primeros `seeds`.
2. **Conversión y admisibilidad** (`surface.rs`, solo funciones nuevas):
   - el círculo pasa a una polilínea de 9 vértices igualmente espaciados en x, con los extremos sobre el terreno;
   - la concavidad de F6.10, punto 6, se aplica **solo** a los candidatos de la búsqueda.
3. **`noncircular.rs`:**
   - los niveles 9 → 17 → 33, hasta `max_vertices`;
   - la variación alterna con la parábola y el movimiento conjunto;
   - el presupuesto de 1500 evaluaciones admisibles por semilla, desempate por (FS, índice) y determinismo con y sin
     `parallel`;
   - el resultado es el mínimo entre el círculo de la semilla 1 y la mejor polilínea, con empate a favor del círculo;
   - `NonCircularStats { seeds, evaluated, seed_fos, polyline_fos }`;
   - la nota `non_circular_large_change`. Si con las firmas congeladas no hay forma de emitirla sin editar un archivo
     ajeno, no la emitas; escribe en el informe el diff que propones para `lib.rs`.

   Referencia: `docs/fase3/exploracion/X29_proto/nc.py` (clase `NC`) y X24 §1, que cita `optimize.rs` de cSlope. Se lee,
   no se copia.
4. **Tests nuevos** (`tests/f3b_noncircular.rs`, con sus modelos en `tests/data/f3b/nc/` a partir de `X29_filas/`):
   - las 10 filas de búsqueda: A2 de un solo lado (`FS_ogs ≤ 1,01·FS_cSlope`), A3 (el publicado dentro de la
     tolerancia del caso), A1 (FS ≤ el del círculo de la búsqueda circular del mismo modelo) y A4 (vértices ≤ 33);
   - las 10 filas `evaluador-*` a ≤ 0,1 %;
   - determinismo: dos corridas iguales, y el mismo JSON con y sin `--features parallel`;
   - Bishop con `non_circular` da el error de F6.4 (ya lo prueba B0: no lo dupliques);
   - **concavidad:** un candidato con `α_{i+1} > α_i + 1°` es inadmisible en la búsqueda, y la misma polilínea como
     superficie fija del usuario sigue aceptándose;
   - Janbu simplificado con `non_circular` en V093, en el check k = 2 si la fila existe en el corpus; si no, A1 y A4
     sin el oráculo;
   - `polyline_fos` omitido cuando ninguna polilínea es admisible.
5. **Costo:** mide en `release` el tiempo de V001, V034a y V036a con y sin `non_circular`, y repórtalo frente a la meta
   de ≤ 4 veces. Es una cifra para el informe, no un gate.

## Cierre

El informe de `F3B_B1_comun.md` §«Informe final», con la tabla de las 20 filas y las cifras de costo.
