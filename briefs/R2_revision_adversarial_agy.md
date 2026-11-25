# Revisión adversarial R2 (Antigravity): verificación de las correcciones R1

Eres un revisor **externo e independiente**. En la revisión R1 (`docs/reviews/R1_agy.md`, commit `ece7f99`) encontraste
13 hallazgos en el motor OpenGeoSlide, uno de ellos CRITICAL. Desde entonces se escribieron correcciones y nuevas
enmiendas de contrato:
- E4a-E4f, en `briefs/00_CONTRATOS.md` §4.2, §4.3 y §4.5;
- E5, avisos informativos;
- E6, códigos de error.

**Modo solo lectura:** no edites archivos, no hagas commits, no instales nada ni accedas a la red.
Responde en **español neutro**.

## Tarea
1. **Cierre de R1:** para cada hallazgo R1-01 … R1-13, ¿está **realmente** cerrado?
   - Vuelve a ejecutar tus contraejemplos originales contra el binario de este commit
     (`cargo build --release -p ogs-cli` y luego `target/release/ogs analyze /dev/stdin`).
   - Clasifica cada uno como `CERRADO | PARCIAL | ABIERTO` y cita la salida real.
2. **Regresiones e intentos de romper las correcciones** (`git diff ece7f99..HEAD -- crates/ogs-core`):
   - ¿La admisibilidad de Spencer (`Φ/F ≥ min_m_alpha`) o el arranque de Bishop desde Fellenius pueden rechazar
     superficies válidas o aceptar inválidas? Busca contraejemplos.
   - ¿La exclusión de dovelas aéreas de λ, junto con la transmisión de E a través del aire, es coherente con el
     equilibrio global? Si no lo es, ¿qué error introduce en un caso concreto?
   - ¿`deny_unknown_fields` y la validación nueva rechazan algún documento legítimo (casos de `verification/cases`,
     `examples/`, `apps/web/src/examples/`)?
   - ¿El aviso `negative_effective_normal` puede ocultar un problema real al ser "informativo"?
   - ¿`fos: Option<f64>` queda consistente en el núcleo, la CLI, el wasm, Python y los tipos TS de `apps/web/src/engine/types.ts`?
3. **Lo que no alcanzaste en R1:**
   - `crates/ogs-wasm` y `crates/ogs-py` (manejo de pánicos y errores);
   - `verification/tools/import_cslope.py` (fidelidad de la conversión);
   - `verification/harness/to_cslope.py`.

## Formato de salida (obligatorio)
1. Primera línea: `VEREDICTO: APROBADO | APROBADO_CON_RESERVAS | RECHAZADO`.
2. Tabla de cierre R1: `ID | estado | evidencia`.
3. Tabla de hallazgos nuevos: `ID (R2-xx) | severidad | archivo:línea | descripción | evidencia | corrección sugerida`.
   CRITICAL/HIGH exige una evidencia concreta y reproducible.
4. "Contrato": observaciones sobre E4-E6.
5. "Cobertura": qué revisaste y qué no.
