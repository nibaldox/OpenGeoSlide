# Brief F3B-B1 W2: salidas en la web (lienzo, informe, CSV, Diagnósticos y Ayuda)

Escritor: **Antigravity**. Lee primero `briefs/F3B_B1_comun.md` (dueños, reglas y gates) y el contrato
`briefs/05_CONTRATOS_FASE3B.md`, en especial **F6.6 (salida), F6.7, F6.8, F6.10 (punto 8) y F6.13**.

## Objetivo

Mostrar en la web los resultados de Hoek-Brown, SHANSEP y la búsqueda no circular, con informes simulados que tengan
la forma exacta de F6.6. El motor de tu rama todavía no los produce.

## Qué hacer

1. **Informes simulados de prueba** (fixtures en tus tests, no en `engine/`), cada uno con la forma de F6.6:
   - Hoek-Brown: `strength: { passes, slices: [{ index, law: "hoek_brown", normal_stress }] }`;
   - SHANSEP: `strength.slices` con `law: "shansep"`, `vertical_stress` y `ocr`;
   - búsqueda no circular: `search.non_circular: { seeds, evaluated, seed_fos, polyline_fos }` y una
     `SurfaceOut::Polyline` como superficie crítica;
   - el caso en que gana el círculo: superficie `circle`, con `polyline_fos` mayor que `seed_fos`;
   - los cuatro avisos nuevos.
2. **Lienzo** (`render/**`, `editor/canvas/**`):
   - la polilínea crítica de la búsqueda no circular se dibuja como la de una polilínea fija. Comprueba que el camino
     actual ya la dibuja y agrega lo que falte, como los vértices marcados;
   - el color de una dovela no cambia por la ley, pero la leyenda de materiales distingue los tres modelos.
3. **Informe PDF** (`report/**`):
   - en la sección de materiales: los parámetros de Hoek-Brown con mb, s y a calculados (usa
     `editor/state/hoekBrown.ts` de W1; si aún no existe en tu rama, escribe la función en `report/` y anótalo para
     que B2 la unifique), y los de SHANSEP con su fuente de OCR;
   - en los resultados: las pasadas del lazo de Hoek-Brown por método;
   - en la búsqueda: las estadísticas no circulares (`seed_fos`, `polyline_fos` y si ganó la polilínea o el círculo)
     y los vértices de la polilínea crítica;
   - los avisos nuevos con su texto;
   - una nota fija en todo informe con Hoek-Brown sobre la regla de la envolvente completa (F6.8) y la advertencia de
     Hoek (1994) sobre la cohesión tangente (X25 §1.5).
4. **CSV** (`io/csv.ts`):
   - una columna de ley por dovela y `normal_stress` o `vertical_stress` y `ocr` cuando existan;
   - los vértices de la polilínea crítica, en el formato que el CSV ya usa para las polilíneas;
   - las columnas nuevas solo aparecen cuando el informe trae `strength` o `non_circular`, para que el CSV de un modelo
     v0.5 quede byte a byte igual.
5. **Diagnósticos** (`DiagnosticsPanel.tsx`): `hoek_brown_not_converged` con su acción sugerida, y las tres notas con
   su ruta al panel (`/materials` y `/analysis/search`).
6. **Ayuda** (`onboarding/helpContent.ts` y `ui/HelpDialog.tsx`), tres entradas nuevas:
   - «Hoek-Brown»: GSI, mi, D con la Tabla 1, σci en kPa, la regla de bajo confinamiento de F6.8 con su diferencia
     declarada frente a cSlope (de 0 % a −2,9 % en los modelos de prueba) y la advertencia de Hoek (1994);
   - «SHANSEP»: S, m, las tres fuentes de OCR, por qué no hay OCR por defecto y el círculo profundo de F6.9;
   - «Búsqueda no circular»: semillas, niveles de vértices, por qué no se ofrece Bishop, la regla del mínimo entre
     círculo y polilínea y el aviso del 15 %.

   Revisa los tests de Ayuda existentes (glosario, enlaces y textos prohibidos) y cumple sus reglas.
7. **Textos de `engine/warnings.ts`:** puedes pulir los cuatro textos de F6.7, sin cambiar los códigos, la severidad ni
   la ruta. Si cambias uno, actualiza `warnings.f3b.test.ts`.
8. **Tests** `*.f3b.test.ts` para cada punto, incluida la identidad del CSV y del PDF de un modelo v0.5.
9. **Recorrido en Chrome** con `vite preview` en el puerto 5186:
   - carga un informe simulado, si existe una vía de prueba para inyectarlo; si no, verifica con los tests de
     renderizado y dilo en el informe;
   - abre la Ayuda;
   - toma capturas en claro y en oscuro, guardadas en `$TMPDIR/f3b1-w2/`.

## Cierre

El informe de `F3B_B1_comun.md` §«Informe final», con las rutas de las capturas.
