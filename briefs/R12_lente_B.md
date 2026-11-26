**Lente B: un ingeniero recibe un resultado con grieta, agua embalsada o Ito-Matsui que parece fiable y no lo es.**
Revisa la propagación de punta a punta: motor, informe, web, PDF, CSV, Casos, Python y CLI.

1. **El cambio de resultado por el agua embalsada** (F5.1, decisión D1). Un usuario abre un modelo guardado con la
   v0.3.0 que tiene la piezométrica sobre el terreno, y su FS cambia.
   - ¿Se entera? Revisa el aviso, la nota `water_above_ground`, la Ayuda, el CHANGELOG y el informe.
   - ¿Queda claro qué se suma (el peso y el empuje) y qué no (el sismo)?
2. **Grieta en las salidas:**
   - **Dónde debe aparecer siempre:** `x_c`, la profundidad y `Pw`, en el lienzo, la tabla, el PDF, el CSV, Casos,
     Diagnósticos, Python y la CLI.
   - **Profundidad automática igual a 0:** ¿se muestra como «sin grieta»?
   - **Superficie que no alcanza la grieta:** ¿el error es comprensible?
   - **Búsqueda que descarta todo:** ¿el usuario sabe por qué?
   - **Notas que contradicen la grieta activa:** ¿hay alguna?
3. **Ito-Matsui en las salidas:**
   - la fuerza del suelo, qué gobierna y el brazo, en todas las vistas;
   - el aviso de S/D;
   - ¿se entiende que la fuerza es **pasiva**?
   - el límite estructural: con Ito-Matsui la web dice que **sí** calcula el empuje del suelo sobre el pilote. ¿Es
     correcto y no promete más de lo que hace, como momento, deflexión o empotramiento?
4. **Formato y versión:**
   - ¿Un modelo 0.5 se puede guardar como 0.4 y perder la grieta o Ito-Matsui?
   - ¿`force` y `lateral_pressure` se pueden combinar desde la web?
   - Las claves desconocidas.
   - ¿El motor simulado (`mockEngine`) inventa un FS?
   - La versión mínima al apagar la grieta.
5. **Unidades.** SI ↔ imperial de `depth`, `water_fill`, `diameter`, `shear` y `moment`, y de las salidas `Pw`,
   `soil_force` y `arm`. ¿El FS queda invariante? ¿Las fuerzas del informe escalan bien?
6. **Edición:**
   - ¿Se puede crear una grieta o un pilote Ito-Matsui inválido sin que la validación local lo diga?
   - ¿Deshacer y rehacer funcionan bien?
   - El relleno azul del agua: ¿se ve cuando la piezométrica cruza el terreno varias veces?
   - Accesibilidad con teclado y lector de pantalla.

   Archivos: `apps/web/src/editor/{panels/*,canvas/*,state/*}`, `io/ogsJson.ts`,
   `engine/{validate,mockEngine,warnings}.ts`, `report/*`, `ui/*` y `render/*` (`pond.ts` y `crack.ts`).
7. **Python y CLI:** `crates/ogs-py` y `crates/ogs-cli`, en particular la ayuda y los errores.
8. **Documentación:**
   - ¿`docs/formato-ogs-json.md` y `docs/limitaciones.md` dicen la verdad, con cifras reproducibles?
   - ¿Los fragmentos ejecutables cubren lo importante?
   - ¿Hay cifras viejas, como 116, 147, 243 o 323, donde ya no corresponden?
9. **Juicio global:** ¿se puede publicar como v0.4.0? ¿Qué lo impide?
