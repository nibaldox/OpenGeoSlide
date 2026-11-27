**Lente A: el motor tras R12.** Cubre la grieta, el agua embalsada e Ito-Matsui, con las enmiendas E15l-1 a E15l-13 y
E15l-27.

1. **Hallazgos de R12-A:**
   - Repite tus reproducciones de A-01 a A-13 con el binario compilado y con el anterior a R12, y clasifica cada uno.
   - A-05 y A-12 no se adoptaron como cambio del motor: ¿la justificación de §F5.12 se sostiene?
2. **Regresiones introducidas por R12.** Revisa los diffs de `crack.rs`, `water.rs`, `lib.rs`, `geometry.rs`,
   `model.rs` y `reinforcement.rs` entre `ae5ee73` y `HEAD`.
   - **E15l-1:** la columna acotada a `[x_min + tol, x_max − tol]`. ¿Afecta otro camino o una geometría con un acantilado
     en el borde?
   - **E15l-2:** la profundidad por la cara real. ¿Es continua cuando la UDL se acerca a la entrada? ¿Y con un cambio
     lateral de material?
   - **E15l-3:** el barrido con vértices. ¿Puede elegir una cara que no es la primera alcanzada desde la cresta?
   - **E15l-4:** el empuje del paramento en una sola dovela. ¿Hay algún caso en que se pierda por completo, por ejemplo
     un paramento sobre el borde de una dovela de aire?
   - **E15l-6:** γw según las unidades. ¿Llega a todos los caminos, incluidos la grieta, el agua embalsada, `ru` e
     Ito-Matsui (u)?
   - **E15l-11 a E15l-13:** ¿la detección de no finitos tiene falsos positivos? ¿El brazo es continuo cuando `zf` cruza un
     nodo?
3. **Neutralidad y espejo.** Toma 10 modelos del corpus, con y sin las capacidades nuevas, y compruébalos con `x → −x`.
   En los que no usan las capacidades nuevas, compara byte a byte con la v0.3.0.
4. **Oráculo.** Reproduce con cSlope al menos 6 checks de casos de F3G y las 3 filas nuevas de
   `crates/ogs-core/tests/data/f3g/r12/`.
5. **Juicio:** ¿queda algún defecto del motor que impida publicar la v0.4.0?
