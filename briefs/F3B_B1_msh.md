# Brief F3B-B1 M-SH: SHANSEP en el motor

Escritor: **Antigravity**. Lee primero `briefs/F3B_B1_comun.md` (dueños, reglas y gates) y el contrato
`briefs/05_CONTRATOS_FASE3B.md`, en especial **F6.3, F6.5, F6.6, F6.7, F6.9 y F6.11**.

## Objetivo

Reemplazar los stubs `todo!("F3B-M-SH")` de `crates/ogs-core/src/shansep.rs` por la física de F6.9:
- `shansep::apply` escribe `cohesion = Su` y `tan_phi = 0` en las dovelas de base `shansep`;
- `shansep::su_at` da Su en un punto (lo usan las caras, F6.5);
- la nota `shansep_nonpositive_stress`.

## Qué hacer

1. **σ′v en la base**, según F6.9: `σ′v = (W + Q + V)/b − u`.
   - El `Slice` del motor guarda el peso estático en `weight`. Lee en `slicer.rs` y en `water.rs` qué suma
     `weight_extra` (X30 §1 lo midió: `kv·W + Q + V`) y reconstruye `Q + V` sin el término sísmico, con el `kv` de
     `pm`.
   - Si `weight_extra` no permite separar `Q + V` sin ambigüedad, detente y repórtalo con la evidencia.
   - `u` es la `pore_pressure` de la dovela.
2. **OCR:**
   - `ocr` constante;
   - `pop`: `OCR = (σ′v + pop)/σ′v`;
   - `ocr_by_elevation`: interpolación lineal en la cota del punto medio de la base, constante fuera de la tabla.

   Con `σ′v ≤ 0`, Su = 0 sin evaluar el OCR.
3. **La nota `shansep_nonpositive_stress`**, una vez por método, cuando alguna dovela de base `shansep` queda con
   `σ′v ≤ 0`.
   - `apply` no devuelve avisos. Lee en `lib.rs` y en `strength_loop.rs` cómo llegan las notas al resultado.
   - Si con las firmas congeladas no hay forma de emitirla sin editar un archivo ajeno, **no la emitas**. En ese caso,
     escribe en el informe el diff que propones para `lib.rs`; el coordinador lo integra.
4. **`su_at(params, sigma_v, y)`** para las caras: la misma fórmula, con el OCR en la cota `y`.
5. **Tests nuevos** (`tests/f3b_shansep.rs`, con sus modelos en `tests/data/f3b/sh/` a partir de `X30_filas/`,
   migrados al formato final del contrato: `model: "shansep"` y el objeto `shansep`):
   - **contra el oráculo:** las filas de V047a (seco y húmedo; OCR 1, OCR 1,5, POP 10 y `ocr_by_elevation`), las de
     carga (`udl` y `line`), las de sismo (`kh` y `kv`) y la de búsqueda profunda en su círculo fijo, en los cinco
     métodos, a ≤ 0,1 % (X30 midió ≤ 0,023 %);
   - **V105a:** imprime la cifra del motor y la diferencia con el publicado (1,285 ± 0,01039), sin aserción. Usa
     `aboveWater`, que está fuera de la v0.6 (F6.9);
   - **identidades:** con OCR 1, Su = ratio·σ′v dovela por dovela; POP 0 igual a OCR 1; espejo a ≤ 1e-9; monotonía
     con `ratio` y con OCR; el sismo no cambia el Su de ninguna dovela; σ′v ≤ 0 da Su = 0 y la nota (con
     `unit_weight` < γw bajo el agua, X30 §4);
   - **caras:** la identidad de F6.9 con OCR constante en una capa seca;
   - **mixto:** una capa Mohr-Coulomb y otra SHANSEP.

## Cierre

El informe de `F3B_B1_comun.md` §«Informe final», con la tabla de las filas y la cifra de V105a.
