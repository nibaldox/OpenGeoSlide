# U6-G: seguridad geotécnica y salida (R9) — nota de integración U6-I

U6-G dejó el código y los tests unitarios; se quedó sin iteraciones antes de verificar en Chrome. U6-I ejecutó sus guiones
(`docs/fase2/ux/u6g-e2e/make_fixtures.py`, `u6g_geotecnia.mjs`) contra `vite preview` (puerto 5186), midió con números, revisó
el PDF como imagen y corrigió lo que apareció. El motor (`crates/`) no cambia: `git diff 2b7abb0 -- crates` está vacío.

Evidencia (copias en `docs/fase2/ux/u6g-e2e/evidencia/`): `informe-imp-full.pdf`, `informe-imp-dry.pdf`, `imp_full-resultados.csv`,
`imp_full-superficie.csv`, `informe-imp-full-p2.png` (página de la sección), `casos-piezo-extrapolada.png`.

## Antes / después por hallazgo

«Antes» es lo que documentó el revisor en `docs/reviews/R9_agy.md` (no se volvió a medir la base). «Después» son medidas de este
recorrido en Chrome (`u6g_geotecnia.mjs`, 28/28 pasos).

| Hallazgo | Antes (R9) | Después (medido) |
|---|---|---|
| R9-03a Casos y γw imperial | «Comprobar caso» no ejecutaba `validateLocal`: un JSON imperial con piezométrica y γw 9,81 daba un FS con presiones de poros 6,4× menores | Casos bloquea con el mensaje «γw: el modelo está en unidades imperiales y γw no se indica o es menor que 20 pcf…» y no muestra FS (sin γw, 9,8, 9,80665, 9,81 y `units: "Imperial"`: 5/5) |
| R9-03b `9,8`, `9,80665`, `"Imperial"` | pasaban | bloquean (arriba). Calculan: γw 62,4 → Bishop **0,861**; γw 64,0 → **0,856**; mismo modelo seco → **0,985** (la piezométrica baja el FS) |
| R9-03c PDF seco | «9,81 pcf (por defecto)» | «Peso unitario del agua: Sin agua (no aplica)», «Línea piezométrica: Sin piezométrica»; «9,81 pcf» no aparece en ninguna página |
| R9-05a figura del PDF | sin cargas ni sismo, cotas sin unidad | cargas (q con flechas, p inclinada), indicador sísmico, cotas `y = 114,83 ft`, `x = 65,62 ft`; las cotas van fuera del marco, sin tocar el arco. **Bug hallado en U6-I** (ver abajo): los rótulos de cargas y sismo salían como puntos |
| R9-05b convenciones | no impresas | «Convenciones de signo» en el PDF (ejes, kh/kv solo al peso del suelo, q hacia abajo, ángulo de p) y en la Ayuda (glosario pasa de 11 a 12 términos) |
| R9-05c γsat | «Sin avisos ni notas» | aviso «el cálculo con γsat todavía no está verificado frente a otro programa» en Diagnósticos (claro y oscuro) y en el PDF |
| R9-05d ru + piezométrica; piezométrica corta | sin aviso; el lienzo terminaba la línea en el último punto | avisos «ru tiene precedencia…» y «extiende en horizontal hasta los bordes…» en Diagnósticos y PDF. Editor, PDF y **Casos** dibujan el tramo punteado y la leyenda dice «Piezométrica (extrapolada)» |
| R9-07 CSV | primera línea `# unidades: SI (m, kN/m³, kPa)` con comas: `DictReader` desplazaba la tabla | sin línea `#`; cabecera `metodo,estado,fs,iteraciones,lambda,xc_ft,yc_ft,r_ft,evaluadas,validas,avisos,unidades`; `pd.read_csv` sin opciones lee 2 filas × 12 columnas (resultados) y 110 × 6 (superficie), con `unidades = imperial` |
| R9-09a γw al crear piezométrica | quedaba vacío → 9,81 «pcf» | «Crear piezométrica» en imperial escribe γw = 62,4 y «Comprobar» calcula; **un** Deshacer quita piezométrica y γw |
| R9-09b cargas por defecto | valores SI | imperial: 200 psf y 700 lbf/ft |
| R9-12a γsat < γ | sin aviso | aviso «γsat (120,952) es menor que γ (127,318)… No bloquea el cálculo» (Diagnósticos y PDF) |
| R9-12b superficie sin convergencia en Casos | dibujada como válida | discontinua `10 6` con el tono «sin convergencia», rótulo «…no es un resultado válido», clase `ea-caption-unconverged` y muestra en la leyenda (claro y oscuro) |
| R9-12c centro y radio, flecha kv | sin unidad; sin flecha | cabeceras «Centro (xc; yc) (ft)» y «Radio (ft)» (m en SI, en Casos también); flecha vertical de kv con `kv = 0,05` y ninguna con kv = 0 (`u6g_kv_arrow.mjs`) |
| R9-12d etiqueta | «Distribuida (udl)» | «Distribuida» |

## Convenciones confirmadas en el motor

Leídas en el código de `crates/ogs-core/src/` (rutas relativas a esa carpeta):

| Convención | Dónde | Qué dice |
|---|---|---|
| kv > 0 va hacia abajo | `slicer.rs:59` (doc de `total_weight`: `W* = W·(1 + kv) + Q + V`) y `slicer.rs:794-802` (`weight_extra: loads.kv * s.weight + vertical`) | la fuerza vertical extra es `kv·W` sumada al peso: positiva = hacia abajo; con kv < 0 la fuerza va hacia arriba |
| kh en el sentido del deslizamiento | `model.rs:133-134` («la fuerza horizontal `kh·W` actúa en el sentido del deslizamiento… se aplican al peso del suelo `W` de cada dovela, nunca a las cargas»); `slicer.rs:794` (`h_seismic = loads.kh * s.weight`) | kh ≥ 0 empuja hacia donde desliza la masa; no depende del signo de x |
| Ángulo de la carga lineal | `model.rs:118-119` (desde la vertical hacia abajo; positivo inclina hacia +x) y `slicer.rs:697-703` (`h = share·direction·p·sin θ` y `weight_extra += share·p·cos θ`, con `direction` = +1 si desliza a la derecha y −1 si a la izquierda) | 0° = vertical hacia abajo; un ángulo positivo hacia +x resta del empuje cuando el talud desliza hacia −x |
| `ru` prevalece sobre la piezométrica | `slicer.rs:604-606` (`if let Some(ru) = m.ru { ru·σv } else if let Some(z) = piezo { γw·(z − y_base)… }`) | en un material con `ru`, el motor no usa la piezométrica |
| Piezométrica extrapolada | `geometry.rs:621-627` (`piezometric_y`: `x ≤ primero → y del primero`, `x ≥ último → y del último`); `x_min`/`x_max` de los vértices de las regiones en `geometry.rs:533-556` | fuera del rango de la línea el nivel se prolonga en horizontal hasta los bordes del modelo |

## Problemas que halló U6-I y cómo se cerraron

1. **PDF: rótulos de cargas y sismo ilegibles.** `haloText` usaba `renderingMode: 'fillThenStroke'` con trazo blanco de 0,9 mm: el
   trazo cubría el relleno y de «Sismo: kh = 0,1 …» y «q = 417,709 psf» solo quedaban puntos (el texto estaba en el PDF pero no se veía;
   por eso pasaban los tests de contenido). Ahora el halo se dibuja solo con trazo y el relleno encima, y los rótulos de las cargas se
   dibujan después de todas las flechas (el halo tapa la flecha de otra carga que los cruce). Test nuevo en `pdf.test.ts` (sin `2 Tr`,
   cada `1 Tr` seguido de `0 Tr`); falla con el código anterior. Límite: la flecha de `p` sigue pasando por la fila de rótulos de `q`;
   el halo la corta bajo el texto y se lee bien, pero el rótulo de `p` queda en la fila de arriba, algo separado de su flecha.
2. **Casos no dibujaba el tramo extrapolado** (U6-K solo lo hizo en el editor). `buildScene` calcula `scene.piezoExtension` con
   `piezoExtension` (`editor/canvas/piezoExtension.ts`) sobre la línea ya ordenada; `drawSection` lo dibuja punteado `1 5`, extremos
   redondeados y **sin halo continuo** (con halo, los puntos parecían una línea blanca con motas); la leyenda de Casos lo rotula. Tests en
   `drawSection.test.ts` (4 casos). Chrome: la leyenda trae «Piezométrica (extrapolada)» y hay 189 píxeles azules a la izquierda del primer punto.
3. **Parches de U6-G/K que no aplicaban** (los archivos cambiaron por U6-K): `isImperialUnits` en `ImportDialogs.tsx` y `projectForm.ts`;
   `piezoExtrapolated: piezoExtension(doc) !== null` en la leyenda de `EditorApp.tsx`.
4. **Expectativas obsoletas** de recorridos: `u5s_salida.mjs` 4a-4c esperaban `# unidades:` (R9-07 lo elimina); `u3o_onboarding.mjs` paso 6
   esperaba 11 términos de glosario y ahora hay 12 (R9-05b).

Detecciones de imperial que quedan tras `grep -rn "=== 'imperial'\|/imp/i" apps/web/src --include=*.ts --include=*.tsx | grep -v test`
(todas comparan un valor **ya normalizado** a `'SI' | 'imperial'`, no una cadena del archivo):
`units.ts` (`isImperialUnits` es la única que usa la expresión regular; `isUnitSystem`, `scalesFor` y la conversión reciben `UnitSystem`),
`newModel.ts:255` (`slopeFormDefaults(units: 'SI' | 'imperial')`), `NewSlopeDialog.tsx:114` (valor de un `<select>` propio),
`projectForm.ts` (`from.kind`/`to` son `UnitsKind`, producto de `currentUnits`, que ya usa `isImperialUnits`) y `ProjectPanel.tsx:105` (`to`).

## Recorrido y pasos

`u6g_geotecnia.mjs` (28 pasos): 1 Casos imperial (5 bloqueos, 3 cálculos), 2 los 21 casos de verificación «Cumple», 3 editor (γw 62,4,
un Deshacer, cargas 200/700), 4 Diagnósticos, tabla, axe, CSV y PDF (claro y oscuro), 5 Casos sin convergencia y axe, 6 piezométrica extrapolada en Casos.
`u6g_kv_arrow.mjs` (nuevo): flecha de kv. Fixtures: `make_fixtures.py <carpeta>` (se ejecutó sin cambios).
