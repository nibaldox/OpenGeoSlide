**Lente A: motor, formato y contratos de datos.** Ataca la búsqueda global de `crates/ogs-core/src/global.rs` y su
enganche en `lib.rs` y `noncircular.rs` contra F7.1 a F7.4 y E17a a E17d:
1. **Corrección del FS.** ¿Puede la etapa global entregar un FS menor que el real, por una superficie con tracción que
   la guarda no ve, por una superficie fuera de las ventanas o por una base sobre un contacto que el corte asigna al
   material equivocado (E16ac)? Construye contraejemplos: capas débiles inclinadas, la dirección `left_to_right`,
   agua embalsada, sismo `kh`/`kv`, refuerzos, una grieta de tracción con profundidad fija, Hoek-Brown y SHANSEP en la
   capa, y `undrained` con gradiente. Evalúa cada polilínea ganadora en cSlope como superficie fija y compara.
2. **La guarda.** ¿Qué pasa con Janbu, que no tiene λ? ¿Y con M-P con funciones distintas de la constante? ¿Se puede
   ganar con `negative_effective_normal` menor y un FS falso? ¿`tension_rejected` y su nota salen cuando corresponde,
   y nunca cuando no?
3. **Monotonía e identidad.** ¿Hay un caso con `global` cuyo FS supere al del refinamiento sin `global`? ¿Un documento
   v0.1 a v0.6 cambia su salida en algún byte? Corre `verification/tools/identity_vs_baseline.py` contra `{BASE}`.
   ¿Y un 0.7 sin `global`?
4. **Determinismo y presupuesto.** ¿La salida es igual con y sin `--features parallel`? ¿Los contadores de
   `GlobalStats` cumplen F7.2 y E17d (`attempts` ≤ 40·`generated`, `evaluated` y `polish_evaluated`)? ¿Hay un modelo
   que dispare el costo (muchas regiones o aristas, `generated` = 2000, una capa diminuta) o que cuelgue la búsqueda?
   Mide el tiempo.
5. **Formato:** el esquema `schema/ogs-0.7.schema.json` frente al motor (rangos, `null`, campos desconocidos, la
   versión mínima y el texto exacto de los mensajes), y la regla de versión mínima en la web (`apps/web/src/io/ogsJson.ts`)
   frente a `loads.rs`.
6. **La medición:** ¿`verification/global/run.py` mide lo que dice medir? Revisa A2b (las 48 semillas generan conjuntos
   de puntos distintos de verdad), A4 (cSlope en la ganadora) y A7 (el tiempo). Busca compuertas que pasen por
   construcción.
