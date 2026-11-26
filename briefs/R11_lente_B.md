**Lente B: un ingeniero recibe un resultado de refuerzos que parece fiable y no lo es.** Revisa la propagación de
punta a punta: motor, informe, web, PDF, CSV, Casos, Python y CLI.

1. **El límite estructural (F4.8):**
   - ¿Aparece **siempre** que hay un pilote o una tablestaca, en todas las vistas y salidas? Las vistas son la web, el
     PDF, el CSV, Casos, Python, la CLI y la Ayuda.
   - ¿Hay alguna frase que sugiera que se calculó la tablestaca, es decir, su empuje, su empotramiento o su momento?
2. **Estados y notas:**
   - `outside_mass`, `compression_ignored` y `no_capacity`, y las notas `reinforcement_*` y
     `structural_checks_not_covered`.
   - ¿Se pierden en algún camino?
   - ¿Un refuerzo que no aporta se ve como si aportara: flecha, fuerza en la tabla o «aplicada»?
3. **Activo y pasivo en el informe:** ¿se distingue sin ambigüedad?
   - ¿La tabla dice qué fuerza es la disponible y cuál la aplicada?
   - ¿Se entiende que la pasiva se divide por F?
4. **Formato y versión:**
   - ¿Un modelo 0.4 se puede guardar como 0.3 y perder refuerzos?
   - ¿Un 0.3 sin refuerzos sigue saliendo byte a byte?
   - ¿El motor simulado inventa un FS con refuerzos?
   - Las claves desconocidas, `location` y las combinaciones prohibidas de `angle`.
5. **Unidades:**
   - Revisa SI ↔ imperial de todos los campos: capacidades, adherencia por metro, `spacing`, `bonded_length`,
     `adhesion` y fuerzas por metro de muro.
   - ¿El FS queda invariante y las fuerzas del informe escalan bien?
6. **Edición en el lienzo y en el panel:**
   - ¿Se puede crear un refuerzo inválido sin que la validación local lo diga, como una tablestaca inclinada o una
     longitud 0?
   - ¿Deshacer y rehacer mantienen la consistencia?
   - Ids: el lienzo crea `tablestaca-1` y el panel `a1`. ¿Hay colisiones?
   - Rótulos encimados con 5 o 6 elementos.
   - Accesibilidad con teclado y lector de pantalla.

   Revisa `apps/web/src/editor/{panels/ReinforcementsPanel.tsx,canvas/*,state/*}`, `io/ogsJson.ts`,
   `engine/{validate,mockEngine,warnings}.ts`, `report/*`, `ui/*` y `render/*`.
7. **Python y CLI:** `crates/ogs-py` y `crates/ogs-cli`.
8. **Juicio global:** ¿está listo para publicarse como v0.3.0? ¿Qué lo impide?
