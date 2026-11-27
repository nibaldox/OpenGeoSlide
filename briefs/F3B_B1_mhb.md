# Brief F3B-B1 M-HB: Hoek-Brown en el motor

Escritor: **Terra**. Lee primero `briefs/F3B_B1_comun.md` (dueños, reglas y gates) y el contrato
`briefs/05_CONTRATOS_FASE3B.md`, en especial **F6.2, F6.5, F6.6, F6.8 y F6.11**.

## Objetivo

Reemplazar los stubs `todo!("F3B-M-HB")` por la física de F6.8:
- `hoek_brown::tau_at_normal`;
- la tangente instantánea con la regla de la envolvente completa;
- la regla de compatibilidad `#[doc(hidden)]`, solo para los tests;
- el lazo `strength_loop::solve` (w = 0,5, `|ΔF| ≤ 1e-6·|F|`, 50 pasadas, `NotConverged` con
  `hoek_brown_not_converged`);
- el `StrengthReport` con `passes` y `normal_stress`;
- la nota `hoek_brown_low_confinement`.

## Qué hacer

1. **`hoek_brown.rs`.** La envolvente de Balmer (ecs. 2 y 8 a 10), la bisección en σ3 hasta `|Δσ3| ≤ 1e-12·ucs`, la
   tangente `(c, tan φ)` con `c ≥ 0` y `φ ≤ 89,9°`, las tres ramas de bajo confinamiento de F6.8 y `tau_at_normal`
   para las caras (F6.5). Compáralo con `X28_proto/hb.py` (regla `cut`), que es la referencia independiente.
2. **N′ por método.** En `methods/`, funciones **nuevas** que, dada la solución de un método (F, λ y la función de
   entre dovelas), devuelvan el N′ efectivo de cada dovela:
   - Bishop, con su ecuación y su F;
   - Spencer y M-P, con (F, λ);
   - Janbu simplificado y corregido, con F₀.

   No cambies ninguna función existente: la identidad con la v0.4.0 tiene que seguir en 0 diferencias. Si para
   obtener (F₀, λ) necesitas algo que `MethodResult` no expone, sácalo con una función nueva del método, por ejemplo
   recalculando la recurrencia con el F y el λ convergidos. **No toques** `report.rs` ni `lib.rs`.
3. **`strength_loop.rs`.** El lazo de F6.8:
   - estado inicial `σ′n₀ = (W/b)·cos²α − u`;
   - promedio de (c, tan φ) con w = 0,5;
   - parada en `|F_k − F_{k−1}| ≤ 1e-6·|F_k|`, con un máximo de 50 pasadas;
   - si el método no converge en una pasada, se devuelve ese estado.

   Se reportan el F de la última solución, los (c, tan φ) con los que se calculó, `passes`, `normal_stress` por dovela
   de roca y la nota de bajo confinamiento.
4. **Tests nuevos** (`tests/f3b_hoek_brown.rs`, con sus modelos en `tests/data/f3b/hb/` a partir de `X28_filas/`,
   migrados al formato final del contrato):
   - **producto contra el prototipo:** los cuatro modelos (X25, HAM1, SA, SB) en los cinco métodos a ≤ 0,1 % de la
     columna «Envolvente completa» de F6.8;
   - **compatibilidad contra el oráculo:** los mismos cuatro modelos y las tres filas de agua a ≤ 0,1 % de cSlope.
     Las excepciones de diagnóstico de F6.8 (Spencer y M-P en SB y en `X28-R-X25-RU03`) imprimen la cifra y la
     diferencia, sin aserción;
   - **identidades:** con GSI 100 y D 0, la envolvente de Hoek y Brown (1980); espejo a ≤ 1e-9; monotonía con GSI,
     σci y D; equilibrio global independiente con los (c, tan φ) reportados (≤ 1e-6, y Bishop en su propia
     formulación ≤ 1e-9), con las funciones de equilibrio de los tests existentes;
   - `NotConverged` con `hoek_brown_not_converged` en un modelo construido para no converger, o un test unitario del
     lazo con un tope de pasadas bajo;
   - la nota `hoek_brown_low_confinement` en SB y su ausencia en un modelo sin bajo confinamiento;
   - **mixto:** un modelo con una capa Mohr-Coulomb y otra Hoek-Brown, donde las dovelas Mohr-Coulomb conservan sus
     (c, tan φ).
5. **Costo.** Mide el tiempo de `ogs analyze` con búsqueda en SA y SB, frente al mismo modelo con un Mohr-Coulomb de
   reemplazo, y repórtalo con el promedio de pasadas por candidato. Es una cifra para el informe, no un gate.

## Cierre

El informe de `F3B_B1_comun.md` §«Informe final», con la tabla de las 20 filas del producto y las 35 de
compatibilidad.
