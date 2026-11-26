**Lente B: antisuplantación y propagación de errores.** ¿Puede ganar una superficie o un método inválido? ¿Puede un
ingeniero recibir un FS que parece fiable y no lo es?

1. **Superficies:**
   - ¿Puede una polilínea inadmisible, por ejemplo sobre el terreno, fuera del modelo o con tramos en el aire, llegar a
     un FS convergido?
   - ¿Puede Bishop calcular sobre una polilínea por alguna vía: JSON, web, Casos, Python, CLI, importar o un borrador?
2. **Estados y avisos:**
   - ¿Hay algún `Invalid`, `NotConverged` o aviso bloqueante que se pierda en el camino del motor al informe, la web, el
     PDF, el CSV o Python?
   - ¿Los estados nuevos (`polyline_*`, `bishop_non_circular`) y el aviso E13k se muestran con su texto en todas las
     vistas?
3. **Versión del formato:**
   - ¿Un modelo con campos v0.3 puede guardarse como 0.2 y perder datos o cambiar el FS?
   - ¿Un 0.2 se abre y se guarda sin cambiar ni un bit?
   - ¿El motor simulado de la web puede calcular un 0.3 e inventar un FS?
4. **Unidades:**
   - ¿La conversión SI ↔ imperial de Su, la cota, el gradiente, el límite, los puntos de la polilínea y los
     `data_points` de la función deja el FS invariante?
   - ¿Hay algún campo que no se convierta?
5. **Web:**
   - ¿La edición de la polilínea en el lienzo (puntero, teclado y táctil) puede producir x no crecientes o puntos que
     el motor rechaza sin que la validación local lo diga?
   - ¿La polilínea inicial propuesta es siempre admisible?
   - ¿Deshacer y rehacer mantienen la consistencia?
   - Revisa `apps/web/src/editor/state/{validateLocal,units,polylineGround}.ts`, `io/ogsJson.ts`,
     `engine/{validate,mockEngine,warnings}.ts`, `editor/canvas/*` y `report/*`.
6. **Informe:**
   - ¿El PDF y el CSV identifican sin ambigüedad el método, la función, f₀, la superficie y los avisos?
   - ¿Algo induce a error en un informe geotécnico?
7. **Bindings:** ¿Python (`crates/ogs-py`) y la CLI propagan los estados y avisos nuevos?
8. **Juicio global:** ¿está listo para publicarse como v0.2.0? ¿Qué lo impide?
