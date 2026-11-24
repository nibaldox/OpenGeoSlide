# Revisión adversarial R1 (Antigravity): núcleo numérico de OpenGeoSlide

Eres un revisor **externo e independiente**. Este repositorio es un motor libre (Apache-2.0) de estabilidad de taludes 2D
por equilibrio límite, en Rust, que compila a nativo, WASM y Python. Lo escribieron otros agentes; tu trabajo es
**intentar romperlo**, no confirmarlo.

**Modo solo lectura:** no edites archivos, no hagas commits, no instales nada ni accedas a la red.
Responde en **español neutro**.

## Alcance (por orden de prioridad)
1. `crates/ogs-core/src/slicer.rs`, `geometry.rs`: geometría y dovelas.
2. `crates/ogs-core/src/methods/bishop.rs`, `spencer.rs`, `mod.rs`: métodos.
3. `crates/ogs-core/src/search.rs`: búsqueda de superficie crítica.
4. `crates/ogs-core/src/lib.rs`, `model.rs`, `report.rs`: orquestación y contratos serde.
5. `crates/ogs-core/tests/acceptance.rs` y `verification/cases/*.json`: ¿el test de aceptación puede pasar por accidente?

El contrato normativo está en `briefs/00_CONTRATOS.md`: §1 modelo, §3 API, §4 matemática, con las enmiendas E1-E3.
**Arbitra contra el contrato**, no contra tus preferencias. Si crees que el contrato mismo está mal en lo físico o en lo
matemático, dilo aparte.

## Dos lentes (aplica ambas)
**Lente A: datos, contratos y matemática**
- ¿Las ecuaciones implementadas coinciden con §4.2-4.3: Bishop, y Spencer según Zhu et al. 2005 con f = 1?
  Revisa signos, el orden pie → coronamiento, el uso de `U = u·b·sec α`, `m_α`, y la recurrencia de E y λ.
- ¿El peso, la presión de poros (`ru` y piezométrica) y γ_sat se calculan según §1 y §4.1?
- Casos borde:
  - geometría: aristas verticales, vértices compartidos, regiones colindantes, dovelas de ancho ~0, círculos tangentes
    al terreno o a la base, piezométrica fuera de rango y dovelas aéreas (E2);
  - numéricos: φ = 0, c = 0, NaN e infinitos.
- Contratos serde: defaults y campos que el JSON acepta pero el motor ignora en silencio.

**Lente B: anti-falsificación y propagación de errores**
- ¿Puede alguna superficie inválida, no convergida o degenerada colarse como `Converged` con un FS "bonito" y ganar la
  búsqueda? Ejemplos: FS negativo o enorme, `NaN` ordenado como mínimo, o `m_α` evaluado solo al final.
- ¿Se ocultan errores? Revisa `.ok()`, `unwrap_or`, `filter_map` y warnings que no llegan al reporte.
- ¿El test de aceptación podría dar verde con 0 checks, con checks saltados o con tolerancias mal leídas?
- ¿Hay determinismo real en serial frente a `parallel`?

## Formato de salida (obligatorio)
1. Primera línea: `VEREDICTO: APROBADO | APROBADO_CON_RESERVAS | RECHAZADO`.
2. Tabla de hallazgos: `ID | severidad (CRITICAL/HIGH/MEDIUM/LOW) | archivo:línea | descripción | evidencia (cita de código o contraejemplo numérico concreto) | corrección sugerida`.
   - **CRITICAL/HIGH** exige una evidencia concreta: un contraejemplo reproducible o una cita exacta.
   - Sin evidencia, el hallazgo baja a MEDIUM como máximo.
3. "Contrato": observaciones sobre el contrato mismo, si las hay.
4. "Cobertura": qué revisaste y qué **no** alcanzaste a revisar.
