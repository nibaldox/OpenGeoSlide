# Relevo de CM-M: de Terra a Sonnet (2026-11-28)

Terra (`openai-codex` / `gpt-6.1-terra`) se quedó sin cuota (HTTP 429) en medio de E17b. Por D6 de `docs/cm/PLAN_CM.md`,
el motor pasa a Sonnet. El brief y el contrato no cambian: `briefs/CM_C1_motor.md` y `briefs/06_CONTRATOS_CM.md`, con las
enmiendas E17a, E17b y **E17c**. Léelos enteros.

## Estado en `cm-m` (972fa14)

- **C0 (commit c13ce8a):**
  - `GlobalSpec`, `GlobalStats` y `FORMAT_VERSION_V07`;
  - la puerta de versión y `validate_v07`;
  - el esquema 0.7, `test_schema.py`, la CLI y el docstring del wheel.
  - A1 (identidad) dio 0 diferencias con el stub de C0. **Hay que repetirlo** con la tubería real.
- **C1 (0dca2a8, 6c7bbfd y 6f2e163):** `crates/ogs-core/src/global.rs`, cambios en `lib.rs` y en `noncircular.rs`
  (`windows` y `refine_generated` con presupuesto), y la guarda en el evaluador. Contiene:
  - `layers` (F7.3.1 con E17a);
  - el bloque con Halton, rotación de Cranley-Patterson y proyecciones a 15°-75° (E17c);
  - el recocido;
  - el descarte sucesivo 4 → 3 → 1 (60 y 150 evaluaciones);
  - el refinamiento de 1500 y el pulido.
- **Medido por el coordinador** con esta versión (`verification/global/e17c-summary.json`):
  - V053: 48 de 48 semillas en la banda; semilla 0 en 1,0103; mediana 1,0077 (cSlope 1,0061).
  - S2: mediana 0,7588 (cSlope 0,7156).
  - Razón de costo: mediana 3,01, máximo 3,77.
- **Tests:** `crates/ogs-core/tests/cm_format.rs` y `cm_global.rs` (de Terra; revisa qué cubren) y
  `crates/ogs-py/tests/test_v07.py`.
- **Medición:**
  - `verification/global/run.py` (A2 en V053; antes salía con 1 porque A2 fallaba);
  - `run_full.py` (borrador de Terra para los 40 modelos);
  - `robustez.py` (A2b);
  - `models/`, con V053, S1, S2, V036c, V036d, V039, V041a, V041b, V051, V051-negative-lambda, V098 y `checks.json`.
  - Los 24 taludes y los `-nc` se construyen como en `docs/cm/exploracion/X37_proto/models.py`.
- **Archivos sin seguimiento que sobran:** `verification/global/variante*.jsonl`, `variante*-summary.json` y
  `measurements.jsonl` son de los experimentos de Terra. No los commitees: resume en `verification/global/robustez.md`
  la tabla de E17c y lo que te sirva de esas variantes, y bórralos al final.

## Lo que falta, en orden

1. **Revisión del código de C1.** Léelo entero contra F7.3, F7.4 y E17a a E17c:
   - la guarda (`negative_lambda` y `negative_effective_normal_major`);
   - `tension_rejected` y la nota `non_circular_global_tension_rejected`, que solo sale si el FS rechazado es menor que el
     reportado;
   - `non_circular_global_no_candidates`;
   - la regla de `auto`;
   - los contadores de `GlobalStats`;
   - el `winner`;
   - el pulido solo si gana el generador;
   - la monotonía (FS final ≤ F₀);
   - el determinismo con y sin `parallel`.

   Corrige lo que no cumpla.
2. **Unit tests de C1** (el brief, parte 2): el PRNG, las capas en V053 y en un talud homogéneo, la admisibilidad, la
   guarda con `models/V051-negative-lambda.json`, la monotonía, el determinismo con y sin `parallel`, los rangos y la
   regla de `auto` de E17a.
3. **`verification/global/run.py` completo:** las compuertas A2, A2b, A3 a A8 y A9 en los 40 modelos, con
   `REPORT.md` y `REPORT.json`.
   - **A9:** la paridad con el prototipo solo aplica al recocido. El bloque cambió en E17c y no tiene prototipo; dilo en
     el REPORT.
   - **A4:** la polilínea ganadora del generador se evalúa en cSlope con `verification/harness/to_cslope.py`
     (`$TMPDIR/oracle-venv/bin/python` o `uv run --with cslope==0.1.0 --with shapely`).
   - **A7:** 3 repeticiones por modelo; se informan la mediana y el máximo.
4. **Todas las puertas de A10** (el brief, §Reglas) y **A1 de nuevo**, con la tubería real.
5. **El informe completo del brief.**

## Reglas de este relevo

- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y
  `export CARGO_TARGET_DIR=$TMPDIR/cm-m/target`.
- Las corridas largas (tests completos, los 40 modelos) van en segundo plano con log; hay otros procesos usando la CPU.
- Commits `CM-M: …` con `git add` de rutas explícitas, sin push y sin merge.
- **Cuándo parar:** si una compuerta no pasa y arreglarla exige cambiar el contrato, para y trae las cifras. Lo que se
  resuelve dentro del contrato lo haces y lo anotas.
