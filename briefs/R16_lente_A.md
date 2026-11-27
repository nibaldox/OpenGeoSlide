**Lente A (Antigravity): cierre del motor, la verificación y la documentación.**

1. **Cierre de los hallazgos de R15.** Comprueba cada uno con el mismo modelo, en el binario de R15 y en el nuevo:
   - **R15A-01** (contacto): las seis combinaciones `ct_*`.
   - **R15A-02** (`evaluated = 0`): los 16 taludes `diag_u_*`, `bench_nc_ogs.json` y `berm_window`.
   - **R15A-03** (RU03).
   - **R15A-04** (caras sumergidas): la capacidad por cara.
   - **R15A-05** (`cases_f3b` y los informes).
   - **R15A-06** (costo): mídelo.
   - **R15A-07** y **R15A-08**: solo documentación.
   - **R15A-09** (cota m_α).
   - **R15A-10** (POP).
   - **R15A-11** (`null` en el esquema).
   - **R15C-01** (finitud), **R15C-02** (lista de notas) y **R15B-04** (nota de causa sin FS).
2. **Regresiones de las correcciones,** con contraejemplos tuyos:
   - **E16v.** El contacto con la resistencia real usa σ′ de Fellenius de la columna. ¿Hay un contacto donde ahora gane
     el material equivocado? Prueba el agua embalsada, `ru` y un contacto inclinado. ¿Se mantuvo la identidad de la
     rama lineal?
   - **E16w.**
     - El arranque `max(0, ·)`: ¿cambia el FS convergido en algún modelo Hoek-Brown más que 1e-6 frente a antes?
     - El Newton salvaguardado de `hoek_brown::point`: ¿falla en GSI 0 o 100, D = 1, `mi` diminuto, `ucs` extremo o σn
       justo en σt? Compara con una bisección de referencia.
     - `fos` null y la nota de causa.
   - **E16x.** Los extremos salen del tramo analizado.
     - ¿Puede aparecer ahora una polilínea cinemáticamente inadmisible, o una con extremos fuera de las ventanas del
       usuario más allá de la holgura `max(tol, 1e-6·ancho)`?
     - ¿Sigue siendo determinista, con y sin `parallel`, en dos corridas?
     - ¿Sale la nota `non_circular_not_refined` cuando corresponde y solo entonces?
   - **E16y.** Agua embalsada en las caras, POP sin cociente y el error de finitud. ¿El error es determinista con
     `parallel`? ¿Hay algún camino que todavía deje Su no finita sin error?
   - **Identidad.** `identity_vs_baseline.py --normalize-version --include-reinforced --include-v05 --with-v06` contra
     la v0.4.0.
3. **Verificación.**
   - Reproduce cinco checks promovidos de F3B y tres modelos de `cases_f3b` con ogs y con cSlope.
   - ¿El informe diferencial versionado (`verification/differential/REPORT.md`) coincide con una corrida nueva?
   - ¿`verification/REPORT.md` y `verification/cases/INDEX.md` están al día con el binario nuevo?
4. **Documentación.**
   - ¿Cada cifra nueva de `docs/limitaciones.md`, `docs/verificacion.md`, el README y la entrada 0.5.0 del CHANGELOG
     coincide con lo que mides?
   - ¿Quedaron cifras viejas o contradicciones, por ejemplo HB-06 todavía como «explicado», RU03 «sin FS», «36 s» sin
     el «antes» o 40/42?
