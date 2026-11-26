**Lente A: mecánica de los refuerzos, datos y contrato.** El contrato es `briefs/03_CONTRATOS_REFUERZOS.md`, de F4.1 a
F4.17. La evidencia está en `docs/fase3/exploracion/X14-X17.md` y `docs/fase3/r1v`, `r2i1` y `r2i3`. El código, en
`crates/ogs-core/src/{reinforcement.rs,methods/*.rs,slicer.rs,lib.rs}`.

1. **Activo y pasivo (F4.6, F4.7):**
   - ¿Las pasivas entran divididas por F en **todos** los términos de los cinco métodos, y las activas sin dividir?
   - ¿Es correcto que Janbu corregido divida por F₀ y no por f₀·F₀?
   - Construye un contraejemplo en el que activo y pasivo deberían dar lo mismo, o un orden conocido, y compruébalo.
2. **Dirección y compresión (E14m-1):**
   - d, `along`, los modos axial, tangent y bisector, y los pilotes con `angle`, `tangent` y `perpendicular`;
   - el espejo x → −x;
   - un activo comprimido aplicado: ¿del lado seguro o del inseguro?
   - un pasivo cerca del umbral de 88°, para ver si hay discontinuidades del FS.
3. **Capacidad (E14m-2):**
   - `bond` con `bonded_length`;
   - `interface` con agua, `ru` y estratos;
   - `development` con T1 y T2;
   - `no_capacity`;
   - unidades imperiales.
   - ¿Hay algún caso en que la fuerza disponible supere el tope de la barra o sea negativa?
4. **Cruces y nodos (F4.4):**
   - cruces dobles;
   - un cruce en un vértice de la polilínea o en un contacto;
   - un cruce en una dovela aérea o truncada;
   - un refuerzo tangente al círculo;
   - un refuerzo que sale del modelo.
   - La dovela fina de 2e-6·ancho: ¿qué efectos numéricos tiene? Revisa E14n-1, que suma las dovelas finas para
     clasificar E7d.
5. **Búsqueda con refuerzos:**
   - ¿La búsqueda encuentra la superficie crítica real o salta por las discontinuidades de los cruces?
   - Mide con una malla fina el mínimo cerca de un anclaje y compáralo con el de la búsqueda. «La búsqueda esquiva el
     refuerzo» es la física esperada, pero ¿se pierde algún mínimo?
6. **Verificación:**
   - Reproduce al menos 6 casos promovidos (verification/cases V010 a V095c con refuerzos) con ogs y con cSlope.
   - ¿Prueban los refuerzos? Por ejemplo, V016b no tiene cruces.
   - ¿Algún caso está mal convertido?
   - Las 120 filas del oráculo (`crates/ogs-core/tests/f3r_oracle.rs`): ¿la tolerancia o la geometría las vuelven
     triviales?
7. **Identidad:** ¿algún modelo sin refuerzos cambia su salida frente a la v0.2.0? El script de comparación está en
   `verification/tools/identity_vs_baseline.py`.
8. **Contrato frente a código:** ¿hay alguna enmienda E14 que el código no cumpla, o algún comportamiento del código
   que el contrato no declare?
