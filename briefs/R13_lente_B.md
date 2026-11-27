**Lente B: propagación tras R12 y si está listo para publicar.** Revisa el motor, el informe, la web, el PDF, el CSV,
Casos, Python, la CLI y la documentación, con las enmiendas E15l-14 a E15l-26.

1. **Hallazgos de R12-B.** Repite tus reproducciones de B-01 a B-12 (Vite SSR, motor real y Chrome si hace falta) y
   clasifica cada uno.
2. **Regresiones de R12 en la web:**
   - **Unidades:** la conversión SI ↔ imperial, en ida y vuelta, de un modelo con grieta con agua, piezométrica, agua
     embalsada e Ito-Matsui con `capacity`. ¿El FS queda invariante con el motor real? ¿Las fuerzas del informe escalan
     bien?
   - **Archivos imperiales sin γw:** ¿qué pasa con un archivo imperial sin `water.unit_weight` hecho con la v0.3.0?
     ¿Cambia su FS y el usuario lo sabe?
   - **Nota `io.pond_changed` y textos de `ru`:** ¿son verdad?
   - **Pilote Ito-Matsui:** se mantiene vertical; la flecha nace en `y + arm` en el lienzo, Casos y el PDF; y la
     información emergente.
   - **`validate.ts`:** ¿rechaza alguna salida legítima del motor?
3. **Python y CLI:** el README y el docstring de `opengeoslide` dicen la verdad; `test_v05.py` prueba lo que declara; y
   la ayuda de `ogs`.
4. **Documentación:**
   - ¿Las cifras de `README.md`, `docs/{verificacion,limitaciones,formato-ogs-json}.md` y del CHANGELOG [Unreleased]
     coinciden con lo que da el binario?
   - Comprueba al menos 10 cifras ejecutando.
   - ¿Quedan cifras viejas, marcadores o contradicciones?
5. **Listo para publicar:** ¿falta algo para la v0.4.0? Por ejemplo:
   - las versiones de `Cargo.toml` y `package.json`, que el coordinador cambia en el commit de la publicación;
   - las notas de migración del agua embalsada;
   - Known issues honestos;
   - los avisos que un ingeniero necesita para no confiar de más.
