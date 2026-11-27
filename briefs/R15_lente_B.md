**Lente B: un ingeniero firma el informe de estabilidad de un rajo con Hoek-Brown, SHANSEP o búsqueda no circular, y el
resultado parece fiable pero no lo es.**

Revisa la propagación de punta a punta: motor, informe, web, PDF, CSV, Casos, Python y CLI. Ponte en el lugar de quien
firma el informe.

1. **Hoek-Brown en las salidas:**
   - mb, s y a, la regla de bajo confinamiento (F6.8), las pasadas del lazo y las notas `hoek_brown_low_confinement` y
     `hoek_brown_not_converged`, en el lienzo, la tabla, Diagnósticos, el PDF, el CSV de dovelas, Python y la CLI;
   - el aviso de Hoek (1994) sobre σci: ¿se entiende?;
   - las unidades de `ucs`: el formulario dice kPa y el aviso da el equivalente en MPa. ¿Hay algún camino por el que
     alguien entre 30 pensando en MPa y obtenga un resultado absurdo sin aviso?
   - D: ¿se fuerza a elegirlo? ¿Se explica qué significa?
   - **Tiempo de cálculo en la web:** una búsqueda con Hoek-Brown y 4 métodos tarda unos 36 s en WASM. ¿La interfaz
     informa el avance, se puede cancelar y sigue respondiendo? ¿Un usuario creerá que se colgó?
   - **Sin FS:** con presión de poros alta, un modelo Hoek-Brown puede quedar sin FS (`X28-R-SB-RU03`). ¿El mensaje
     orienta al usuario?
2. **SHANSEP en las salidas:**
   - Su, σ′v y OCR por dovela;
   - la nota `shansep_nonpositive_stress`;
   - ¿se entiende que el sismo no reduce σ′v?
   - ¿la tabla de OCR por cota se puede dejar inconsistente, desordenada o con OCR < 1, sin aviso?
3. **Búsqueda no circular en las salidas:**
   - la polilínea crítica con sus vértices, `seed_fos` y `polyline_fos`;
   - la nota `non_circular_large_change`;
   - Bishop deshabilitado con su motivo;
   - **V002 (E16u):** un resultado no circular con `negative_lambda` y `negative_effective_normal_major`. ¿El ingeniero
     se entera de que ese FS puede venir de una rama con tracción y estar por debajo de lo real? Revisa los avisos, la
     Ayuda, `docs/limitaciones.md` y el PDF.
4. **Formato y versión:**
   - ¿un modelo 0.6 se puede guardar como 0.5 y perder Hoek-Brown, SHANSEP o la búsqueda no circular?
   - las combinaciones prohibidas (F6.5), como Ito-Matsui con materiales nuevos: ¿la web las impide y las explica?
   - las claves desconocidas;
   - ¿el motor simulado (`mockEngine`) inventa un FS?
   - la versión mínima al quitar el último campo v0.6.
5. **Unidades.** SI ↔ imperial de `ucs`, `pop` y las cotas de `ocr_by_elevation`, y de las salidas σ′n, σ′v y Su. ¿El
   FS queda invariante? ¿El CSV escala bien?
6. **Edición:**
   - ¿se puede crear un material Hoek-Brown o SHANSEP inválido sin que la validación local lo diga?
   - ¿la calculadora de mb, s y a coincide con el motor?
   - deshacer y rehacer;
   - accesibilidad con teclado y lector de pantalla.

   Archivos: `apps/web/src/editor/{panels/*,canvas/*,state/*}`, `io/ogsJson.ts` y `io/csv.ts`,
   `engine/{validate,mockEngine,warnings,types}.ts`, `report/*`, `render/*`, `onboarding/helpContent.ts` y
   `ui/HelpDialog.tsx`.
7. **Identidad de la web:** el informe, el CSV y el PDF de un modelo v0.5 deben ser idénticos a los de la v0.4.0.
   Comprueba `apps/web/src/report/identity.f3b.mjs`: ¿compara lo que dice comparar?
8. **Python y CLI:** `crates/ogs-py` y `crates/ogs-cli`, sobre todo la ayuda, los errores y la salida v0.6.
9. **Documentación:**
   - ¿`docs/formato-ogs-json.md`, `docs/limitaciones.md`, `docs/verificacion.md` y el README dicen la verdad, con
     cifras reproducibles?
   - ¿los ejemplos corren?
   - ¿quedan cifras viejas, como 327 checks o 1395 tests, donde ya no corresponden?
10. **Juicio global:** ¿se puede publicar como v0.5.0? ¿Qué lo impide?

Si usas la web, levanta `vite preview` en el puerto **5188** desde tu copia congelada, con la `dist` ya compilada o
compilándola, y no uses otro puerto.
