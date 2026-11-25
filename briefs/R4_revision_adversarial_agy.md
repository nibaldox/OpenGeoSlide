# Revisión adversarial R4 (Antigravity): cierre de R3 y ola W10

Eres un revisor **externo e independiente**. En R3 (`docs/reviews/R3_agy.md`, commit `005044d`) rechazaste el motor con
R3-01 … R3-08. Después se aplicaron las enmiendas E11a/E11a′, E11b, E11c, E11d/E11d′, E11e, E11f y E11g, descritas en
`briefs/00_CONTRATOS.md` §4.1.9, §4.3 y §4.5. Las decisiones del coordinador, cada una con su evidencia frente al
oráculo cSlope, son:
- **E11a′:** se elige la raíz de λ **admisible con menor |λ|**, sin preferencia de signo. cSlope elige λ = −0,162 en
  D03 y +0,402 en R3-01a, donde la raíz −0,371 no es admisible.
- **E11b:** la admisibilidad vuelve a `Φᵢ/F ≥ min_m_alpha`.
- **E11d′:** `min_width` y los rangos se verifican sobre la **cuerda** del arco, y se avisa
  (`effective_width_below_min`, `effective_ends_outside_range`) cuando el bloque real queda más angosto o fuera de
  rango. Filtrar por extremos efectivos dejaba la búsqueda +22 % sobre cSlope, lo que es no conservador; con la cuerda
  queda −25 %, conservador y con aviso.

**Modo solo lectura:** no edites archivos, no hagas commits, no instales nada ni accedas a la red.
Responde en **español neutro**.
Oráculo disponible: `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python` (`import cslope`),
con el conversor `verification/harness/to_cslope.py`.

## Tarea
1. **Cierre de R3:** para R3-01 … R3-08, indica el estado (`CERRADO | PARCIAL | ABIERTO`) con la salida real de tus
   contraejemplos contra `target/release/ogs` de este commit (`cargo build --release -p ogs-cli`).
2. **Ataca la selección E11a′ y el barrido por niveles:**
   - ¿Hay casos donde la raíz admisible de menor |λ| no sea la del oráculo y el FS difiera más de 1 %?
   - ¿El corte al primer nivel con una raíz admisible puede saltarse una raíz admisible de menor |λ| dentro del mismo
     paso?
3. **Ataca E11d′ y E11e:** ¿un aviso puede quedar oculto o perderse en la búsqueda, por ejemplo si el resultado crítico
   final no lo trae?
4. **Regresiones:** aceptación 38/38, batería diferencial 20/20 + 20/20 y determinismo serial = parallel.
5. **Prioriza:** el objetivo es decidir si la Fase 0 (spike) puede cerrarse. Distingue con claridad los defectos que
   bloquean un uso de prueba, que deben ser HIGH o CRITICAL con evidencia, de las mejoras para la Fase 1.

## Formato de salida (obligatorio)
1. Primera línea: `VEREDICTO: APROBADO | APROBADO_CON_RESERVAS | RECHAZADO`.
2. Tabla de cierre R3: `ID | estado | evidencia`.
3. Hallazgos nuevos: `ID (R4-xx) | severidad | archivo:línea | descripción | evidencia | corrección sugerida`.
   CRITICAL/HIGH exige una evidencia concreta y reproducible.
4. "Bloqueantes para cerrar la Fase 0" frente a "Pendientes para la Fase 1".
5. "Cobertura".
