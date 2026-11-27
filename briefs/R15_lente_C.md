**Lente C (Terra): revisión cruzada del código que escribió Antigravity.**

Es una revisión adversarial de una familia de modelos distinta (GPT) sobre lo que escribió Gemini en el bloque F3B. Su
objetivo es encontrar errores que el autor y un revisor de su misma familia podrían pasar por alto.

**Commits de Antigravity, y sus archivos (`git show --stat <sha>`):**
- **B0W, la base de la web:** `9f276ae` (los avisos de F6.7), `3a97e38` (los tipos v0.6, la versión mínima y la
  serialización) y `e9bbb96` (el motor simulado), integrados en el merge `254c551`.
- **M-SH:** `68fa312`, la física de SHANSEP en `crates/ogs-core/src/shansep.rs`. Terra la completó en `3e0ba28`.
- **V:** `3d813f7`, con `verification/harness/to_cslope.py` y `test_to_cslope.py` para `hoek_brown`, `shansep` y
  `non_circular`.
- **W2:** `096c7eb` (el lienzo y los informes simulados), `50a5e89` (el PDF y el CSV) y `d7c2510` (Diagnósticos y
  Ayuda).

**Qué buscar:**
1. **`shansep.rs`:**
   - σ′v, OCR, Su, la interpolación y σ′v ≤ 0, frente a F6.9, E16o y E16r;
   - los casos borde: una dovela con agua embalsada, una carga sobre la dovela, `kv` distinto de 0 y una sola fila en
     `ocr_by_elevation`;
   - ¿hay algún camino que dé NaN o un Su negativo?
2. **`to_cslope.py`:** ¿convierte bien `hoek_brown` (unidades de `ucs`, D), `shansep` (las tres fuentes de OCR y
   `exponent`) y `non_circular` a cSlope? Compara campo a campo con la documentación de cSlope en
   `$TMPDIR/cslope-src`. Un error de conversión invalida el oráculo de las filas.
3. **La web de B0W y W2:**
   - la lectura y escritura v0.6 sin pérdida;
   - la versión mínima;
   - la validación local frente a los mensajes del motor;
   - los avisos informativos frente a `INFORMATIVE_WARNINGS`;
   - que el motor simulado no invente un FS;
   - el dibujo de la polilínea;
   - el contenido del PDF y del CSV frente a F6.6;
   - que el texto de la Ayuda no contradiga el contrato.
4. **Tests:** ¿los tests que escribió Antigravity prueban lo que dicen? ¿Hay alguno trivial o tautológico, que compare
   la implementación consigo misma?

Corre lo que necesites: tests, el binario y el oráculo. Cita la salida. Usa el mismo formato de salida, con el prefijo
`R15C`.
