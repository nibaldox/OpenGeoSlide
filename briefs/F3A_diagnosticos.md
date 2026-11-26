# Brief F3A-D: dos diagnósticos acotados antes de R10 (Sonnet, en paralelo)

Responde en **español neutro, sin voseo**.

**Lee primero:**
- `briefs/02_CONTRATOS_FASE3.md`, normativo, en particular F3.4, F3.5 y F3.10;
- `briefs/F3A_cierre.md`;
- los commits de C-M en `f3a-integracion`: `d753177` (E13j-6), `1cd0317` (E13j-4), `3d492d2` (diagnóstico de Spencer)
  y `6994413` (cuerda de Janbu sin dovelas aéreas).

**Base:** `f3a-integracion`, en `b2e0a62`. Contiene todo F3a integrado.

**Reglas:**
- Reproduce siempre antes de corregir.
- No relajes umbrales ni tolerancias.
- Commits con rutas explícitas y **sin push**.
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python siempre con
  `env -u PYTHONPATH -u PYTHONHOME`.
- Oráculo: `$TMPDIR/oracle-venv/bin/python` (`cslope` 0.1.0), con su clon de referencia en `$TMPDIR/cslope-src`.
- **Identidad byte a byte:** usa un binario de `b2e0a62` compilado en un worktree detached en `$TMPDIR`. Bórralo al
  final.
- **Las tareas son acotadas.** No hagas nada más. Si una tarea no se puede cerrar, entrega el diagnóstico con números.

---

## D-1: FS absurdos de Spencer en polilíneas (worktree `f3d1`, rama `f3d1-spencer`)

**Hallazgo de C-M:** en un barrido de polilíneas aleatorias admisibles sobre el talud simple de dos estratos, hay
casos en que **Spencer converge con FS de 73 a 450**, mientras Janbu da entre 2 y 5 y cSlope no converge. El cierre es
pequeño y no hay N′ negativos.

**Por qué importa:** un FS no físico que se informa como convergido es **no conservador** y es el riesgo más grave
para un informe.

**Tareas:**
1. **Reproduce** con una semilla fija: un generador de polilíneas admisibles en `crates/ogs-core/tests/` o en
   `$TMPDIR`. Aísla al menos 3 casos con `FS_Spencer > 3·F₀_Janbu`.
2. **Para cada caso**, con números:
   - λ y F;
   - cierre de fuerzas y residuo de momento respecto de dos puntos, calculados de forma independiente con
     `spencer_interslice`;
   - signos de E y de X a lo largo de la masa, para ver si hay tracción entre dovelas;
   - posición de la línea de empuje, si se puede calcular;
   - α por dovela y valor de `m_α(F)`;
   - si M-P `constant` da exactamente lo mismo;
   - todas las raíces admisibles del barrido de λ y cuál elige E12e;
   - qué hace cSlope y por qué falla.
3. **Diagnóstico:** ¿es una raíz espuria del sistema, una solución matemáticamente válida pero físicamente
   inadmisible (por ejemplo, con E < 0 generalizado, es decir, dovelas que tiran unas de otras) o un error del código?
   - **Si es un error**, corrígelo con test RED e identidad byte a byte.
   - **Si es una solución inadmisible**, **no inventes una guarda**: propón el criterio con su fuente bibliográfica y
     con el efecto medido sobre los 93 casos y la batería, y **detente**. La decisión es del coordinador.
4. **Entrega** `docs/fase3/d1/DIAGNOSTICO.md`, con las tablas y los comandos para reproducir.

**Presupuesto:** unas 70 iteraciones. Escribe el documento temprano y refínalo.

## D-2: M-P medio seno en D09, ξ con dovelas aéreas y escala de E7d (worktree `f3d2`, rama `f3d2-mp`)

**Tareas:**
1. **D09 con M-P `half_sine`.**
   - Datos: ogs 0,4398 frente a cSlope 0,4253, un +3,39 %. En cambio, M-P `constant` coincide (0,4322 frente a
     0,43215).
   - **Hipótesis:** `x₀` y `x₁` de ξ (E13j-1) incluyen las dovelas aéreas de los extremos, como pasaba con la cuerda
     de Janbu, que se corrigió en `6994413`. cSlope no tiene dovelas aéreas.
   - Verifícala midiendo el dominio de ξ en ogs y en cSlope para D09.
   - Si se confirma, `x₀` y `x₁` pasan a medirse **sobre el bloque de suelo**, sin las dovelas aéreas de los extremos.
     - Agrega un test RED con D09.
     - Comprueba que los valores de F3.8 siguen dentro de 0,1 %.
     - La identidad de Spencer y de M-P `constant` debe ser byte a byte; cambian solo las salidas de M-P con f no
       constante.
     - Reporta qué casos o checks cambian.
2. **E13j-7, cuerda de Janbu:** C-M ya la mide sobre el bloque de suelo. Confirma con números que:
   - los valores de F3.8 de Janbu corregido siguen dentro de 0,1 %;
   - la aceptación sigue con 0 fallas.
3. **V018 con M-P** está retenido por `negative_effective_normal_major`. La causa es que `f = Σ|N′<0|/ΣW` usa
   ΣW = 6,3e-5, el peso de un suelo casi sin peso, cuando las fuerzas vienen de las cargas.
   - La propuesta del coordinador, coherente con E13j-6, es normalizar la clasificación E7d con
     `max(ΣW, ΣW*)`. El umbral de 0,05 no cambia.
   - Mide el efecto en **todos** los modelos (casos, batería, `pending` y `acads1a`): cuáles cambian de clase y
     cuáles cambian su salida.
   - **Si solo cambian V018 y otros sin peso, impleméntalo** con su test y promueve V018 con M-P si cumple.
   - **Si cambia algún otro caso, detente** y repórtalo.
4. **Regenera** los informes:
   - `verification/REPORT.md` y `report.json`;
   - `verification/differential/REPORT.md` y `report.json`, con
     `verification/differential/run.py --ogs target/release/ogs`;
   - el harness sobre `pending/F3`, copiando solo los `V*.json` a un directorio temporal.

   Comitéalos.

**Gates:**
- `cargo fmt --all --check`;
- `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
- `cargo test -p ogs-core --release --no-fail-fast`;
- aceptación;
- pytest de `verification` con `cslope==0.1.0`, `shapely`, `jsonschema` y `pytest`.

**Presupuesto:** unas 80 iteraciones. Commitea a medida que avances.
