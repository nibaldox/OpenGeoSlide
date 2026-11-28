# Contrato del bloque CM: búsqueda global no circular (formato v0.7)

Contrato normativo del frente NC de `docs/cm/PLAN_CM.md`. Lo escribió el coordinador el 2026-11-28, después de la
exploración X31 a X37 (`docs/cm/exploracion/`). Las enmiendas van como **E17x**, al final de este archivo. Todo lo que
no cambia aquí sigue vigente desde `00_CONTRATOS.md` hasta `05_CONTRATOS_FASE3B.md`, en particular F3.6 (Bishop no se
ofrece en polilíneas), F3.9 (versión mínima), F6.10 (el refinamiento), F6.12 a F6.14 y E12e (la raíz de menor F).

## F7.0 Qué se decidió y por qué

- **El generador es un bloque automático sobre capas débiles, con recocido como respaldo.** En X37, el bloque (G2)
  cierra V053: el FS pasa de 1,0847 (+7,4 %) a 1,0395 (+2,9 %, dentro de la banda), y cSlope evalúa esa misma
  superficie en 1,0396. También baja S2 de 0,8499 a 0,7441, con cSlope en 0,7456. *Path* (G1) no mejora ningún caso
  válido y es el más caro, así que queda fuera.
- **Hace falta una guarda de tracción.** Una búsqueda global encuentra superficies en la rama con tracción de E12e, con
  un FS bajo que no existe. Ejemplo: V051 con G2 da 0,630, y cSlope evalúa esa superficie en 1,048 (X37 §4.2 y el CSV).
  Un generador no puede ganar con una superficie de esa rama (F7.4).
- **El resultado nunca empeora.** El refinamiento actual de F6.10 se calcula siempre, sin cambios, y el generador solo
  reemplaza su resultado si da un FS estrictamente menor y su superficie es elegible.
- **Identidad:** sin `global`, el código y la salida son los de la v0.5.1.

## F7.1 Formato v0.7

`analysis.search.non_circular.global` es un objeto opcional. Sus campos son todos opcionales, sin otros campos, y
`deny_unknown_fields` rige igual que en `NonCircularSpec`.

| Campo | Tipo | Por defecto | Rango | Significado |
|---|---|---|---|---|
| `algorithm` | cadena | `"auto"` | `"auto"`, `"block"` o `"annealing"` | Con `auto`, corre `block` si el modelo tiene capas de contacto (F7.3.1) y `annealing` si no |
| `generated` | entero | `500` | [50, 2000] | Candidatos admisibles que se generan y evalúan |
| `seed` | entero | `0` | [0, 2^53 − 1] | Semilla del PRNG |
| `polish` | booleano | `true` | — | Pulido final (F7.3.4); solo corre si gana el generador |

- `global: null` cuenta como ausente. `global: {}` es válido y toma todos los valores por defecto.
- **Versión:** `analysis.search.non_circular.global` exige `"version": "0.7"`; el mensaje es
  `analysis.search.non_circular.global requiere version "0.7"`. El motor acepta de 0.1 a 0.7. Con 0.7, todas las puertas
  anteriores quedan abiertas: un 0.7 admite Hoek-Brown, SHANSEP, refuerzos, grieta y lo demás.
  - **Trampa conocida** (X33 §2.4): `loads.rs:395` compara con `!=` contra 0.6. Hay que pasar a una lista con 0.6 y 0.7.
  - Las cuatro listas `contains` de `loads.rs:367-394` ganan 0.7.
- **Validaciones cruzadas:** las de F6.5 siguen vigentes; Bishop con `non_circular` ya es un error y cubre `global`. No
  hay reglas nuevas que crucen partes del documento.
- **Esquema:** `schema/ogs-0.7.schema.json` es una copia de 0.6 con:
  - `version` en el enum;
  - el bloque de 0.1 a 0.6 que prohíbe `global`;
  - `$defs/non_circular_global`.

  Los rangos son los de esta tabla.
- **Sin campos v0.7, la salida es la de la v0.5.1 byte a byte**, con la versión normalizada. Se comprueba con
  `verification/tools/identity_vs_baseline.py` sobre todos los casos, contra `$TMPDIR/cm-base/ogs`. No se espera ninguna
  excepción.

## F7.2 Salida

`NonCircularStats` (`search.rs:93`) gana `global: Option<GlobalStats>`, con `skip_serializing_if = "Option::is_none"`.
Solo aparece con `global` en la entrada.

| Campo de `GlobalStats` | Tipo | Significado |
|---|---|---|
| `algorithm` | cadena | El algoritmo que corrió: `"block"` o `"annealing"`; nunca `"auto"` |
| `generated` | entero | Candidatos admisibles generados y evaluados (≤ `generated` de la entrada) |
| `attempts` | entero | Intentos geométricos, incluidos los no admisibles (≤ 20·`generated`) |
| `converged` | entero | Candidatos con solución convergida |
| `eligible` | entero | Convergidos que pasan la guarda de F7.4 |
| `tension_rejected` | entero | Convergidos que rechazó la guarda |
| `refined` | entero | Polilíneas del generador que se refinaron (≤ 3) |
| `evaluated` | entero | Evaluaciones del motor en toda la etapa global: generación, refinamiento y pulido |
| `polish_evaluated` | entero | Evaluaciones del pulido (0 si no corrió) |
| `global_fos` | número o `null` | El mejor FS elegible de la etapa global, después de refinar y pulir |
| `winner` | cadena | `"global"` o `"refinement"` |

- `seeds`, `evaluated`, `seed_fos` y `polyline_fos`, del nivel de `NonCircularStats`, siguen significando lo mismo que
  en v0.6: describen el refinamiento de F6.10.
- La superficie crítica es la del ganador, `SurfaceOut::Polyline`. Si gana `"refinement"`, es la misma que en v0.6.
- **Notas nuevas**, en el lugar de las notas del método, como `non_circular_large_change`:
  - **`non_circular_global_no_candidates`:** `eligible = 0`. El generador no dio ninguna superficie elegible, y el
    resultado es el del refinamiento.
  - **`non_circular_global_tension_rejected`:** la guarda rechazó al menos una superficie con un FS menor que el
    reportado. Informa que existe un FS menor en la rama con tracción y que no se tomó; el texto de la web lo explica.
    La regla del proyecto es que la falta de convergencia o de validez nunca se oculta.

## F7.3 Algoritmo

La tubería corre por método de cálculo, dentro del brazo `non_circular` de `lib.rs` (X33 §1.4):

1. **El refinamiento de F6.10, sin cambios.** Da R₀: su FS F₀, su superficie y sus notas.
2. **La generación**, que según `algorithm` es F7.3.2 o F7.3.3. Cada candidato admisible se evalúa con el evaluador
   guardado de F7.4.
3. **La selección:** las 3 mejores elegibles por (FS, índice de generación), con pares de entrada y salida distintos,
   con la regla del 5 % del span de `search.rs:347-359`.
4. **El refinamiento de cada una**, con el `Optimizer` de `noncircular.rs`, los niveles 9 → 17 → 33 y 1500 evaluaciones
   por polilínea, usando el evaluador guardado. Las polilíneas de partida tienen 9 vértices.
5. **La comparación:** sea G* la mejor refinada. Si `FS(G*) < F₀ − 1e-6`, gana `global` y, si `polish` es `true`,
   G* se pule (F7.3.4). Si no, gana `refinement` y no se pule.
6. **El reporte** de F7.2.

**El presupuesto total de la etapa global** es ≤ `generated` + 3·1500 + 3000 evaluaciones, con 8000 por defecto.

### F7.3.1 Capas de contacto

La regla de X37 §2 (`docs/cm/exploracion/X37_proto/global.py`, `contact_layers`):
- ρ_r = c_r / (γ_r · z_r) + tan φ_r, donde z_r es la profundidad bajo el terreno del centroide de los vértices de la
  región r.
- **Contacto:** toda arista no vertical de una región cuyo punto medio, desplazado ±10⁻⁴ · altura en su normal, cae en
  otra región.
- **Capa:** las aristas de contacto de la región de menor ρ que tenga contacto. Si ninguna tiene contacto, las «bases»:
  aristas no verticales cuyo lado exterior queda fuera de todas las regiones.
- **Materiales que no son Mohr-Coulomb:**
  - en `undrained`, ρ = Su(z_r) / (γ · z_r), con tan φ = 0;
  - en Hoek-Brown y SHANSEP, se usa la resistencia equivalente que el motor ya calcula en σ′v = γ · z_r, o se excluyen
    de la elección de la capa.

  Lo que se elija va documentado en una enmienda, con un test.
- `auto` elige `block` si hay al menos una arista de capa, y `annealing` si no.

### F7.3.2 `block`

Se porta `gen_block` de `X37_proto/global.py`: k ∈ {2, 3} segmentos sobre la capa, con la proyección izquierda
U(90°, 135°) y la derecha U(45°, 90°) hasta el terreno, igual que en X37. El port debe dar las mismas superficies que el
prototipo en V053 con la misma semilla, o explicar la diferencia (F7.7, compuerta A9).

### F7.3.3 `annealing`

Se porta `gen_sa` de `X37_proto/global.py`:
- arranca de la polilínea de 9 vértices del círculo semilla 1 (`surface.rs:233-259`);
- el estado son las profundidades de los 7 vértices interiores;
- σ_k = max(0,2·H·T_k/T₀, 0,005·H), con T₀ = 0,02 y T_fin = 5·10⁻⁴;
- enfriamiento geométrico por evaluación y Metropolis sobre el FS elegible. Un candidato no elegible se trata como
  rechazado.

### F7.3.4 Pulido

Es la regla de cSlope (`optimize.rs:373-436`, leída en X31 §4; se lee y se cita, no se copia), en el port de
`X37_proto/global.py`, `polish`:
- hasta 4 ciclos;
- se sigue mientras la ganancia del ciclo sea > 0,001;
- presupuesto total de 3000 evaluaciones;
- el mismo evaluador guardado.

### F7.3.5 Determinismo

- El PRNG es SplitMix64, escrito en el crate con `wrapping_mul`. No se agrega ninguna dependencia ni se toca
  `Cargo.lock`.
- La generación es serial: todos los números aleatorios se extraen en orden antes de evaluar un lote.
- La evaluación puede usar `map_range` (`search.rs:799`), con lotes de tamaño fijo decidido antes de paralelizar.
- La reducción es serial por (FS, índice) con `<` estricto.
- **La misma salida con y sin `--features parallel`**, byte a byte, más un test de dos corridas iguales.
- La igualdad entre nativo y WASM no se promete. Se mide en V053 (F7.7, A7).

## F7.4 Guarda de tracción

El evaluador de la etapa global, que cubre generación, refinamiento y pulido, devuelve el FS solo si:
1. la solución convergió, con un FS finito y > 0, igual que `evaluate_surface` (`lib.rs:861`);
2. **y** las notas de la solución (`MethodResult.warnings`) **no** incluyen `negative_lambda` (`spencer.rs:131`) ni
   `negative_effective_normal_major` (`methods/mod.rs:44`).

Si no, esa superficie no es elegible: no compite, el optimizador la trata como inválida y cuenta en
`tension_rejected`. Las notas `negative_effective_normal` (la menor) y `multiple_admissible_roots` no excluyen.

**Por qué así:** X37 midió las superficies ganadoras con `negative_lambda` o con `negative_effective_normal_major`, y
cSlope las evalúa entre 11 % y 66 % más arriba (V051, S1 y los taludes con c = 30). La guarda deja fuera S2 con G2
(λ < 0, aunque cSlope la confirma a 0,2 %). Es la opción conservadora frente a un FS falso y bajo.
- El refinamiento de F6.10 (R₀) no se toca. Su comportamiento con λ < 0, como en V002, sigue siendo el de E16u y se
  sigue informando.

## F7.5 Web

- Un sub-bloque **«Búsqueda global»** dentro de «Superficie no circular» (`SearchPanel.tsx`):
  - una casilla que, al marcarla, escribe `global: {}`;
  - el algoritmo (Automático, Bloque sobre capas débiles, Recocido);
  - los candidatos (`generated`), la semilla y el pulido.

  Los valores por defecto son los de F7.1 y salen de una constante compartida.
- **La versión del documento sube a 0.7 por la tabla** (`ogsJson.ts`, `VERSION_FIELD_TABLE`). La rama 0.7 de
  `validateLocal.ts` existe, y `mockEngine.ts` rechaza los campos 0.7 (las trampas de X33 §2.4, puntos 13, 14 y 16).
- **Resultados:** la tabla de resultados, el CSV, el informe PDF y el HUD muestran `winner`, `algorithm`, `generated`,
  `eligible`, `tension_rejected` y `global_fos`, solo si hay `global`.
- Las notas de F7.2 entran en `ENGINE_WARNING_CODES`, en el catálogo y en el puntero de avisos.
- **La Ayuda** explica cuándo usar la búsqueda global (capas débiles, contactos, mecanismos de bloque), su costo (hasta
  unas 8000 evaluaciones más) y la guarda.
- **Sin `global`, la web produce los mismos documentos que la v0.5.1.**

## F7.6 Casos

En la ola C2 pasan a `verification/cases` estos checks no circulares de `verification/pending/F3B/INDEX.md`
§«Otros casos con búsqueda no circular»:
- V036c, V036d, V039 (2 checks), V041a, V041b, V051 y V098, con `non_circular` de v0.6;
- **V053 con `global`**, en v0.7.

Son 9 checks. Cada uno va con su fuente y su tolerancia tal como vienen del corpus, con el criterio de banda del
harness. Si alguno no pasa la banda con el motor final, queda retenido con su causa, como en F6.14.

## F7.7 Compuertas

| # | Compuerta | Criterio |
|---|---|---|
| A1 | Identidad | Sin `global`: 0 diferencias frente a la v0.5.1 en todos los casos (`identity_vs_baseline.py --normalize-version` con todas las banderas de F3B) |
| A2 | V053 | Con `global: {}`, el FS de Spencer o de M-P está en la banda del publicado (1,01 ± 3,50 %), y cSlope evalúa la polilínea ganadora dentro de ±1 % |
| A3 | Los 15 checks no circulares | Los 10 de X32 y los 5 `-nc` promovidos, con `global: {}`: pasan con el criterio de un lado los 15, y ninguno queda por encima de su FS sin `global` |
| A4 | Guarda | Ninguna superficie ganadora del generador tiene `negative_lambda` ni `negative_effective_normal_major`. Con `global`, V051 queda ≥ 0,69. En los 40 modelos de X37, cSlope evalúa cada polilínea ganadora del generador dentro de ±2 % (cuando cSlope devuelve un FS) |
| A5 | Monotonía | FS con `global` ≤ FS sin `global` en los 40 modelos de X37 y en todos los casos `-nc` |
| A6 | Determinismo | Dos corridas iguales, byte a byte, y la misma salida con y sin `parallel` en los 40 modelos |
| A7 | Costo | Nativo: el tiempo con `global` (N = 500) ≤ 4 × el circular, medido 3 veces en los 40 modelos (se informa la mediana y el máximo). WASM en Chrome: el tiempo de V053 y S2 con y sin `global`, informado, y el FS igual que el nativo a 1e-9 o la diferencia explicada |
| A8 | Barrido | En los 24 taludes de X37, `global` no empeora ninguno, `evaluated` > 0 y no da avisos nuevos fuera de F7.2 |
| A9 | Port | En V053 y S2, el generador de Rust da el mismo mejor candidato antes de refinar que `X37_proto/global.py` con la misma semilla, a 1e-6 en el FS, o la diferencia queda explicada con una cifra |
| A10 | Gates del repo | `fmt`, `clippy -D warnings`, `cargo test` con y sin `parallel`, aceptación, tests de la CLI y del wheel, vitest, el build, `verification` con pytest, el harness y la batería diferencial: todo en verde y sin fallas nuevas |

## Enmiendas

### E17a: `auto` elige `block` solo con contactos y recurre al recocido (CM-M, 2026-11-28)

**Problema** (medido por CM-M con el prototipo sin cambios, `$TMPDIR/cm-m/probe_layers.{py,json,log}`): en los 24
taludes homogéneos del barrido, F7.3.1 encuentra «bases» y, con la regla literal, `auto` elige `block`. Los 24 agotan
10 000 intentos sin una sola polilínea admisible. Coincide con X37 §4.5: G2 no tuvo candidatos en 27 de 40 modelos
(los 24 taludes, V001-nc, V041a y V041b).

**Reemplaza la última viñeta de F7.3.1:**

- `auto` elige `block` **solo si hay aristas de contacto entre regiones** (el paso de «contacto» de F7.3.1). Las «bases»
  no cuentan para esta elección.
- Si `auto` eligió `block` y la generación terminó con 0 candidatos admisibles (por haber agotado los 20·`generated`
  intentos), `auto` corre `annealing` con el mismo `generated`. `GlobalStats.algorithm` informa `"annealing"`, y
  `attempts` suma los intentos de las dos etapas.
- `algorithm: "block"` explícito conserva el respaldo por «bases» y **no** recurre al recocido. Si no hay candidatos,
  sale la nota `non_circular_global_no_candidates`.

**A8 queda así:** en los 24 taludes, `global` no empeora ninguno ni da avisos fuera de F7.2. La etapa global tiene
`evaluated > 0` en al menos 23 de 24. Donde sea 0, porque no hay un círculo semilla elegible para el recocido, sale la
nota `non_circular_global_no_candidates` y se nombra el talud. X37 §4.7 encontró un solo caso así,
TAL-H30-b60-f20-c5.

### E17b: la búsqueda global no puede depender de la suerte de la semilla (coordinador, 2026-11-28)

**Problema.** CM-M midió que, con `global: {}` (semilla 0), V053 da 1,0847: no pasa A2. El 1,0395 de X37 salía con la
semilla 37 del prototipo. El coordinador barrió semillas con el port de Rust (`cm-m` en `4e9baab`, V053, Spencer;
`$TMPDIR/cm-coord/seeds/`):

| `generated` | Semillas que pasan la banda (≤ 1,04535) | Mínimo | Mediana | Semillas sin mejora (1,0847) |
|---|---:|---:|---:|---:|
| 500 | 10 de 48 | 1,0137 | 1,0674 | 18 de 48 |
| 2000 | 7 de 16 | 1,0200 | 1,0466 | 2 de 16 |

El generador encuentra la cuenca del bloque (el mínimo de 1,0137 está a +0,8 % de cSlope, 1,0061), pero rara vez la
conserva. El orden de los candidatos crudos predice mal el FS refinado, y tres semillas de refinamiento no alcanzan.
**Elegir la semilla 37 como valor por defecto queda descartado**: sería ajustar el resultado a un solo caso.

**Cambio en F7.3, pasos 3 y 4.** La selección y el refinamiento pasan a ser **por descarte sucesivo**, con un presupuesto
total que respete A7:
1. Se toman los K₀ mejores elegibles, con la regla del 5 % de entrada y salida distintas.
2. Cada uno recibe un refinamiento corto.
3. Se conserva la mejor fracción, que recibe más presupuesto.
4. Se repite hasta que quedan 1 a 3 candidatos con el refinamiento completo de F6.10 (niveles hasta 33 y 1500
   evaluaciones).

CM-M fija K₀, las fracciones y los presupuestos por etapa midiendo. Puede además:
- muestrear la geometría del bloque con una secuencia de baja discrepancia (Halton, con la semilla como desplazamiento
  del índice), en vez de SplitMix64;
- subir el `generated` por defecto dentro del rango [50, 2000].

Lo que elija va en este archivo, con sus cifras, como E17c.

**Nueva compuerta A2b (robustez):**
- con los valores por defecto, V053 pasa la banda con la semilla 0 **y** con al menos 44 de las semillas 0 a 47;
- se informa la distribución de V053 y de S2 en las 48 semillas: mínimo, mediana, máximo y cuántas pasan;
- A7 (costo ≤ 4 veces el circular) sigue mandando. Si no hay ninguna variante que cumpla A2b y A7 a la vez, CM-M
  informa la frontera medida (robustez contra costo) y el coordinador decide.

Todas las demás compuertas (A3 a A9) se miden con la variante final y la semilla 0. A9, la paridad con el prototipo, se
aplica al generador antes del descarte; la parte nueva no tiene prototipo y no se le exige.
