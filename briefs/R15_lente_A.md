**Lente A: la matemática de Hoek-Brown, SHANSEP y la búsqueda no circular, los datos y el contrato.**

- **Contrato:** `briefs/05_CONTRATOS_FASE3B.md`, F6.2 a F6.11 y F6.14.
- **Código:** `crates/ogs-core/src/{hoek_brown.rs,strength_loop.rs,shansep.rs,noncircular.rs,search.rs,surface.rs,strength.rs,lib.rs,slicer.rs,methods/*.rs}`.

1. **Hoek-Brown** (F6.8, E16q, E16t):
   - **Fórmulas:** mb, s y a de Hoek et al. (2002), y la tangente (c, φ) en σ′n por bisección en σ3. Contrasta con
     Hoek et al. (2002) y con Hammah et al. (2005). ¿Hay errores de unidades entre kPa y MPa, o en imperial?
   - **Bajo confinamiento:** ¿la «envolvente completa hasta σt» da cero más allá de σt? ¿Es continua? ¿Es de verdad del
     lado seguro frente a la regla de cSlope en todos los casos, o solo en los medidos? Busca un contraejemplo.
   - **Lazo:** con w = 0,5, |ΔF| ≤ 1e-6·|F| y 50 pasadas. ¿La convergencia en F garantiza que (c, φ) quedó
     estacionario? ¿Hay oscilaciones de período 2 que la tolerancia oculte? ¿La nota `hoek_brown_not_converged` sale
     siempre que debe?
   - **Límites:** c ≥ 0 y φ ≤ 89,9°. ¿Qué pasa con GSI 0 o 100, con D = 1, con mi muy chico y con `ucs` enorme?
   - **Sin FS con presión de poros alta:** en `X28-R-SB-RU03` (el rajo SB con `ru` = 0,3, círculo fijo), el producto
     no entrega FS. Bishop da `invalid` (`m_alpha`) y los demás métodos `not_converged` (`no_admissible_root`), mientras
     que cSlope, con su recta de σ3 = 0, da 0,96 (Bishop) y 1,01 (Spencer); lo midió B2b y está en
     `docs/limitaciones.md`. ¿Es el comportamiento correcto de una base que no resiste más allá de σt, o es un defecto
     del lazo o de la bisección? ¿Un ingeniero debería recibir un FS (por ejemplo, el de la envolvente con resistencia
     cero en esas dovelas) en lugar de «sin solución»?
   - **Costo:** la búsqueda Bishop con Hoek-Brown y la grilla por defecto tarda unos 8 s en la CLI (61 a 68 veces lo
     que tarda con Mohr-Coulomb), con 8 a 10 pasadas del lazo por candidato. En la web (WASM, un hilo) son unos 36 s con
     4 métodos. El arranque en caliente no ayudó (B2a). ¿Dónde está el costo: la bisección en σ3 hasta 1e-12·ucs, el
     número de pasadas o la evaluación de las dovelas? Propón una mejora que conserve el resultado a 1e-9.
   - **Equilibrio global:** ¿el (c, φ) final cumple el equilibrio de cada método, en momentos y fuerzas según el
     método?
   - **HAM1:** reconstruye el ejemplo 1 de Hammah et al. (2005), ARMA 05-810, y contrasta con la geometría elegida en
     `verification/cases/HAM1*`. Revisa si los supuestos están escritos y si la tolerancia de 0,5 % está justificada.
2. **SHANSEP** (F6.9, E16o, E16r):
   - **σ′v:** (W + Q + V)/b − u, sin sismo. ¿Es la convención correcta para SHANSEP, en Ladd y Foott (1974) y en la
     práctica? ¿El gancho antes de los refuerzos (E16r) evita contar dos veces alguna carga?
   - **POP:** OCR = (σ′v + pop)/σ′v. ¿El límite σ′v → 0 está bien tratado? ¿Qué pasa con σ′v ≤ 0?
   - **`ocr_by_elevation`:** la interpolación, el valor constante fuera de la tabla y la cota que se usa, ¿es el punto
     medio de la base?
   - **Caras:** σ′v de la columna de suelo, E16r. ¿Es coherente con la base?
   - **V105a:** queda en HOLD por `aboveWater`. ¿Está bien diagnosticado?
3. **Búsqueda no circular** (F6.10, E16p, E16s, E16u):
   - **Algoritmo:** la conversión círculo → polilínea, la variación alternada, Δ₀ = 0,1 × el segmento más corto, 6
     pasos, 6 rondas, y la selección por el menor F entre el movimiento conjunto y el individual. ¿Cumple el contrato?
     ¿Es determinista?
   - **Admisibilidad:** concavidad ≤ 1°, extremos dentro de las ventanas y superficie que corta el terreno. ¿La
     búsqueda encuentra superficies cinemáticamente inadmisibles con un FS bajo? Construye un contraejemplo: un banco
     muy empinado, una capa débil delgada o un talud con berma.
   - **V002 y E16u:** la búsqueda cae en la rama de tracción de E12e. ¿La decisión de mantener E12e y aplicar A3 de un
     solo lado está justificada, o enmascara un error? Mide la proporción de candidatos con
     `negative_effective_normal_major` en otros casos de capa débil.
   - **HB-06 y §4.2:** el círculo de cSlope es inadmisible en ogs por m_α. ¿El veredicto `explicado (§4.2: m_α)` de
     `verification/differential/run.py` es correcto, o puede esconder una falla real?
   - **Costo:** el límite es 4 veces el de la búsqueda circular. Mídelo en un caso más grande que los del corpus.
4. **Verificación:**
   - Reproduce con ogs y con cSlope al menos 8 de los casos promovidos de F3B, incluido HAM1, y 4 modelos de
     `verification/differential/cases_f3b/`.
   - ¿Prueban de verdad lo que dicen probar? ¿Hay alguna fila trivial, o algún caso mal convertido por `to_cslope.py`
     o `import_cslope.py`?
   - Revisa `tests/f3b_hoek_brown.rs`, `f3b_shansep.rs` y `f3b_noncircular.rs`.
5. **Identidad.** ¿Algún modelo sin campos v0.6 cambia su salida frente a la v0.4.0? Usa
   `identity_vs_baseline.py --normalize-version --include-reinforced --include-v05 --with-v06`.
6. **Contrato frente a código.** ¿Hay alguna enmienda E16 que el código no cumpla, o algún comportamiento del código que
   el contrato no declare?
