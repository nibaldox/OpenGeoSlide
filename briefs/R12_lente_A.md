**Lente A: la mecánica de la grieta, el agua embalsada e Ito-Matsui, los datos y el contrato.**

- **Contrato:** `briefs/04_CONTRATOS_GRIETA_AGUA.md`, de F5.1 a F5.11.
- **Evidencia:** `docs/fase3/exploracion/X21.md` y `X22.md`, con sus prototipos y filas.
- **Código:** `crates/ogs-core/src/{crack.rs,water.rs,reinforcement.rs,slicer.rs,lib.rs,methods/*.rs}`.

1. **Agua embalsada** (E1 a E4, E7, E9 y E15c-ru):
   - **Por dovela:** el peso, el empuje y los momentos.
   - **Métodos:** ¿cada término entra bien en los cinco? Construye un contraejemplo con equilibrio conocido: un bloque
     sumergido por completo, donde el agua debe cancelarse con la flotación, o una presa con su paramento vertical.
   - **Fronteras:** la piezométrica que cruza el terreno dentro de una dovela, la que termina sobre el talud y el agua
     **fuera de la masa**, que según X20 §1.6 debe abarcar todo el modelo.
   - **Espejo** `x → −x`.
   - **`ru`:** `u = ru·(W + V)/b`. ¿Es del lado seguro?
   - **Sismo:** ¿hay algún camino en el que el sismo multiplique el agua?
   - **E15j-4:** la regla de que una profundidad menor que la tolerancia vale cero.
2. **Grieta** (G1 a G9):
   - la posición por barrido y bisección;
   - el corte, la cara vertical y el peso que se quita;
   - la fuerza `Pw`, en el sentido del deslizamiento y a `hw/3`.
   - **Profundidad automática:** el material bajo el terreno a 2e-5·escala (E15j-1), la sobrecarga del agua embalsada,
     el material no drenado y las capas.
   - **Continuidad:** ¿el FS es continuo cuando `depth` tiende a 0 y cuando `water_fill` va de 0 a 1?
   - **Búsqueda:** ¿descartar los candidatos que no alcanzan la grieta pierde mínimos reales? Mídelo con una malla fina.
   - **Polilíneas** y el uso de `check_block_ends` sobre la masa truncada.
3. **Ito-Matsui** (E15i):
   - **Fórmula:** las ecuaciones 13, 14 y 23 de Ito y Matsui (1975), con el piso de φ = 0.
   - **Integración:** desde la cabeza o desde el terreno hasta el cruce, con `σ′v` tomando γsat, `u` y `ru`, varias
     capas y el contacto vertical.
   - **Tope** `min(suelo, corte, momento/L_m)`, el punto de aplicación (`centroid` o `slip_surface`) y el aviso de
     S/D.
   - **Equilibrio y signos:** pasiva dividida por F, y espejo.
   - **Contraejemplo:** ¿hay algún caso en que la fuerza calculada sea negativa, no finita o mayor que el tope?
4. **Contacto de aire capilar** (E15j-8, `slicer.rs`, `drop_hairline_air`):
   - ¿Puede unir dos masas que de verdad están separadas?
   - Construye un caso con un hueco real angosto, por ejemplo una cresta en V, y compruébalo.
5. **Verificación:**
   - Reproduce con ogs y con cSlope al menos 8 de los casos promovidos en F3G (grieta, agua e Ito-Matsui).
   - ¿Prueban de verdad la capacidad que dicen probar? ¿Hay alguno mal convertido?
   - Revisa las filas de `crates/ogs-core/tests/f3g_rows.rs` y `f3g3_ito.rs`: ¿alguna es trivial o no ejercita lo que
     dice?
   - Revisa los 6 retenidos de E15j-6.
6. **Identidad.** ¿Algún modelo sin grieta, sin agua sobre el terreno y sin Ito-Matsui cambia su salida frente a la
   v0.3.0, fuera de las excepciones declaradas? Usa `identity_vs_baseline.py --normalize-version --include-reinforced`.
7. **Contrato frente a código.** ¿Hay alguna enmienda E15 que el código no cumpla, o algún comportamiento del código que
   el contrato no declare?
