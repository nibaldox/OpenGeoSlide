# Revisión adversarial R3 (Antigravity): cierre de R2 y enmiendas E7-E8

Eres un revisor **externo e independiente**. En R2 (`docs/reviews/R2_agy.md`, commit `70ee56a`) rechazaste el motor con
los hallazgos R2-01 … R2-09. Después se aplicaron las enmiendas E7a-E7d, E8a-E8d, E9a-E9c y E10a/E10a′/E10a″/E10c,
descritas en `briefs/00_CONTRATOS.md` §3, §4.1.9, §4.2, §4.3 y §4.4. Contexto de las decisiones:
- **E7a:** las dovelas aéreas vuelven a λ como cuerpos sin masa; tu R2-01 tenía razón.
- **E8a quedó derogada por E10a/E10a″:** ya no se rechazan las superficies con masa desconectada. Se analiza solo el
  **bloque que contiene la entrada** (coronamiento), se descartan los bloques aguas abajo de un vacío de aire y se
  avisa con la nota `truncated_mass`. Con esa convención, el oráculo cSlope coincide en D09.
- **E8b:** la admisibilidad de Spencer usa `Φ > 0` y `m_α(F) ≥ min_m_alpha`.
- **E8c:** el umbral de N' negativa se calibra en 0,05.
- **E9a:** la búsqueda agrega los vértices del terreno como candidatos y usa 10 semillas.
- **E10c:** el solver de Spencer usa las curvas F_m(λ)/F_f(λ), con la ecuación de momentos de Zhu, la raíz de F por
  cierre de fuerzas, un barrido de λ hacia afuera desde 0 y Brent.
- **Verificación diferencial nueva** (`verification/differential/`): 10 casos sintéticos de minería y civil frente a
  cSlope.

**Modo solo lectura:** no edites archivos, no hagas commits, no instales nada ni accedas a la red.
Responde en **español neutro**.

## Tarea
1. **Cierre de R2:** para R2-01 … R2-09, el estado (`CERRADO | PARCIAL | ABIERTO`) con la salida real de tus
   contraejemplos contra `target/release/ogs` de este commit (`cargo build --release -p ogs-cli`).
2. **Ataca E10a/E10a″ (bloque de entrada):**
   - ¿Descartar los bloques aguas abajo de un vacío de aire puede dar un FS **no conservador**? Por ejemplo, si el
     bloque descartado es motriz, o si la superficie crítica real es la del bloque descartado y la búsqueda no la
     evalúa por otro círculo.
   - Piensa en taludes con bermas, cuñas en el pie, terreno irregular de rajo o botadero, y valles.
   - Busca contraejemplos con FS concretos y compáralos, si puedes, con cSlope (está en
     `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python`, `import cslope`; usa
     `verification/harness/to_cslope.py` para convertir).
3. **Ataca E10c y E8b:**
   - ¿El barrido de λ hacia afuera elige una raíz equivocada cuando hay varias?
   - ¿Vuelve a admitir el mecanismo de R1-01, u otro, con un FS de Spencer muy por debajo de Bishop o de cSlope en el
     mismo círculo?
4. **E8c:** ¿el umbral 0,05 puede ocultar subpresión relevante? Da un ejemplo con f ∈ (0,02; 0,05] y un sesgo de FS
   apreciable si existe.
5. **E8d:** ¿se pierden o se duplican avisos entre `MethodResult`, `MethodReport`, la CLI, el wasm y la web?
6. **Regresiones generales:** determinismo serial vs `parallel`; la aceptación (¿alguna forma de pasar por accidente?);
   y que los 38 checks sigan dentro de tolerancia (`cargo test -p ogs-core --release --test acceptance -- --nocapture`).

## Formato de salida (obligatorio)
1. Primera línea: `VEREDICTO: APROBADO | APROBADO_CON_RESERVAS | RECHAZADO`.
2. Tabla de cierre R2: `ID | estado | evidencia`.
3. Hallazgos nuevos: `ID (R3-xx) | severidad | archivo:línea | descripción | evidencia | corrección sugerida`.
   CRITICAL/HIGH exige una evidencia concreta y reproducible.
4. "Contrato": observaciones sobre E7-E8.
5. "Cobertura".
