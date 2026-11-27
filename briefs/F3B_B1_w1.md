# Brief F3B-B1 W1: entrada de datos en la web (materiales, búsqueda y validación)

Escritor: **Terra**. Lee primero `briefs/F3B_B1_comun.md` (dueños, reglas y gates) y el contrato
`briefs/05_CONTRATOS_FASE3B.md`, en especial **F6.2, F6.3, F6.4, F6.5 y F6.13**.

## Objetivo

Que el usuario pueda crear y editar en la web:
- un material Hoek-Brown, con la calculadora de mb, s y a;
- un material SHANSEP;
- la búsqueda no circular.

Todo con la validación local del contrato y las conversiones de unidades.

## Qué hacer

1. **`hoekBrown.ts`** (nuevo): mb, s y a con las ecs. 3 a 5 de F6.2. **Test de paridad** contra el motor: los valores
   de `crates/ogs-core/tests/f3b_format.rs` (GSI 20, mi 10, D 1, y el ejemplo 1 de Hammah), copiados a la prueba con su
   cita.
2. **`MaterialsPanel.tsx` y `forms.ts`:**
   - el selector suma «Hoek-Brown» y «SHANSEP»;
   - cambiar de modelo conserva γ, γsat y ru, y quita los campos que el modelo nuevo prohíbe;
   - **Hoek-Brown:**
     - σci se ingresa en la unidad de esfuerzo del modelo, con su equivalente en MPa al lado (o ksi en imperial);
     - GSI, mi y D;
     - D **sin valor por defecto**: el formulario pide elegirlo, con la guía de la Tabla 1 de Hoek et al. (2002) en
       el texto de ayuda del campo;
     - mb, s y a calculados, de solo lectura;
   - **SHANSEP:**
     - `ratio`;
     - `exponent`, que vacío significa 0,8;
     - un selector de la fuente de OCR (OCR constante, POP o tabla por cota) y sus campos;
     - la tabla `ocr_by_elevation` con filas editables, cota creciente.
3. **`SearchPanel.tsx` y `AnalysisPanel.tsx`:**
   - la casilla «Superficie no circular», con `seeds` (1 a 10, por defecto 3) y `max_vertices` (9, 17 o 33, por
     defecto 33);
   - al marcarla, **Bishop se deshabilita** en la lista de métodos con la razón de F6.4 visible;
   - si la grieta tiene profundidad «Automática» o hay un pilote con Ito-Matsui y algún material es Hoek-Brown o
     SHANSEP, la web lo dice con el texto de F6.5 **antes** de llamar al motor.
4. **`validateLocal.ts`:** todas las reglas de F6.2 a F6.5 con los mensajes del contrato:
   - requeridos, prohibidos y rangos;
   - exactamente una fuente de OCR;
   - la tabla con y creciente;
   - Bishop con `non_circular`;
   - la grieta automática y Ito-Matsui con materiales nuevos.

   Lo mismo que rechaza el motor, con el mismo texto después del prefijo `InvalidModel:`. Los mensajes están en el
   código de B0 (`crates/ogs-core/src/strength.rs` y `loads.rs`): cópialos de ahí.
5. **`units.ts`:** `ucs` y `pop` son esfuerzos; las cotas de `ocr_by_elevation` son longitudes; OCR, GSI, mi, D,
   `ratio` y `exponent` no tienen unidad.
   - **Test:** convertir un modelo SI a imperial y de vuelta deja los números iguales.
   - **Test:** el FS con el motor no cambia (≤ 1e-9). Ese test solo puede correr cuando exista la física, así que
     déjalo con `it.skipIf(!physicsAvailable)` y anótalo para B2.
6. **`geotech.ts` y `localIssues.ts`:** el aviso local de Diagnósticos de F6.13 cuando σci < 1000 kPa o > 300 000 kPa
   (o su equivalente en psf), con un texto que sugiera revisar si el valor se escribió en MPa.
7. **`reducer.ts`:** las acciones nuevas que haga falta (cambiar el modelo del material y editar la tabla de OCR), con
   `syncVersion` subiendo a `"0.6"`.
8. **Tests** `*.f3b.test.ts` para cada punto, con informes simulados (no se mandan modelos v0.6 al motor real).
9. **Recorrido en Chrome** con `vite preview` en el puerto 5182:
   - crea un material Hoek-Brown y uno SHANSEP, marca la búsqueda no circular, guarda y vuelve a abrir;
   - toma capturas en claro y en oscuro, guardadas en `$TMPDIR/f3b1-w1/`.

   Sigue el procedimiento de las skills `ogs-web-chrome-walkthrough` y `ogs-e2e-preview-integration` si están
   disponibles. **No presiones «Comprobar»** con un modelo v0.6: los stubs paran el WASM.

## Cierre

El informe de `F3B_B1_comun.md` §«Informe final», con las rutas de las capturas.
