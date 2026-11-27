# Contratos del bloque F3B: Hoek-Brown, SHANSEP y búsqueda no circular (formato v0.6)

**Este texto es normativo.** Solo lo edita el coordinador, con enmiendas numeradas E16a, E16b… que citan su evidencia.

**Fuentes:**
- `docs/fase3/PLAN_FASE3B.md`, con las decisiones D1 a D6;
- la exploración `docs/fase3/exploracion/X23.md` a `X27.md`;
- los prototipos X28 (Hoek-Brown), X29 (búsqueda no circular) y X30 (SHANSEP), en curso. Las secciones marcadas
  **[condicional X28]**, **[condicional X29]** o **[condicional X30]** se cierran con una enmienda cuando llegue su
  prototipo, antes de despachar al escritor que las implementa. Los tipos, el formato, la validación y los ganchos
  (F6.1 a F6.7) **no** dependen de los prototipos y quedan congelados ya.

**Sigue vigente** todo lo de `00_CONTRATOS.md` a `04_CONTRATOS_GRIETA_AGUA.md`, salvo lo que este archivo cambie de
forma explícita.

## F6.1 Versión y compatibilidad (E16a)

- **Versiones.** El motor acepta `"version"` de `"0.1"` a `"0.6"`. El mensaje de una versión desconocida enumera las
  seis.
- **Las puertas anteriores se abren a 0.6.** Un campo que hoy exige `"0.3"`, `"0.4"` o `"0.5"` se acepta también con
  `"0.6"`.
- **Campos que exigen `"0.6"`**, en este orden (la función nueva `first_v06_field` de `loads.rs`, con el mismo estilo
  que `first_v03_field`):
  1. por material, en el orden de la lista:
     - `materials[i].model = "hoek_brown"` o `materials[i].model = "shansep"`;
     - después, los campos `ucs`, `gsi`, `mi`, `disturbance` y `shansep`, en ese orden, presentes en cualquier
       material (`materials[i].<campo>`);
  2. `analysis.search.non_circular`.

  Con una versión menor, el error es `InvalidModel: <campo> requiere version "0.6"`, igual que en F5.1.
- **Versión mínima al guardar** (F3.9): la web guarda `"0.6"` solo si existe alguno de esos campos. La regla vive en
  una sola tabla «campo → versión» por lenguaje (X27 §2.1, diez sitios), con la misma lista y el mismo orden en Rust y
  en TypeScript.
- **Identidad.** Un modelo sin campos v0.6 da la **misma salida, byte a byte**, que la v0.4.0, con la versión del
  motor normalizada (`identity_vs_baseline.py --normalize-version --include-reinforced` contra el binario de la
  v0.4.0). El gate cuenta 0 diferencias **sin agregar entradas** a `identity_exceptions.json`. Las entradas que ya
  tiene (V019, E15j-8) son de la comparación con la v0.3.0 y no se tocan.
- **Esquema:** `schema/ogs-0.6.schema.json`, una copia completa del 0.5 con los cambios. Acepta de 0.1 a 0.6 y rechaza
  lo mismo que el motor, con la puerta de versión en `allOf`/`if`/`then` como en las versiones anteriores.

## F6.2 Material `hoek_brown` (E16b)

```json
{ "id": "roca", "model": "hoek_brown", "unit_weight": 26.0, "ucs": 30000.0, "gsi": 50.0, "mi": 10.0,
  "disturbance": 0.7 }
```

- **Requeridos:**
  - `unit_weight`, con las reglas de siempre;
  - `ucs`, la resistencia a compresión simple de la roca intacta σci, en la unidad de esfuerzo del modelo (kPa en SI,
    psf en imperial), finita y `> 0`;
  - `gsi`, finito, en `[0, 100]`;
  - `mi`, finito, `> 0`;
  - `disturbance`, el factor D, finito, en `[0, 1]`. **No tiene valor por defecto.** cSlope usa 0 por defecto, pero
    Hoek et al. (2002, §7, p. 5) advierte que D = 0 da propiedades demasiado optimistas en minas a cielo abierto
    (X25 §1.4). El conversor a cSlope lo escribe siempre.
- **Opcionales,** con las mismas reglas que en Mohr-Coulomb: `unit_weight_sat` y `ru`.
- **Prohibidos,** con el mensaje de F3.2 (`el material '<id>' con model "hoek_brown" no admite el campo '<campo>'`):
  `cohesion`, `friction_angle`, `undrained_strength`, `strength_datum`, `strength_gradient`, `strength_limit` y
  `shansep`.
- **Los campos `ucs`, `gsi`, `mi` y `disturbance` quedan prohibidos** en `mohr_coulomb`, `undrained` y `shansep`, con
  el mismo mensaje.
- **Parámetros derivados** (Hoek, Carranza-Torres y Corkum 2002, ecs. 3 a 5; X25 §1.1):
  - `mb = mi·exp((GSI − 100)/(28 − 14·D))`;
  - `s = exp((GSI − 100)/(9 − 3·D))`;
  - `a = 1/2 + (exp(−GSI/15) − exp(−20/3))/6`.

  No son campos del formato: el motor los calcula y la web los muestra con la misma fórmula.
- **Errores de rango:** `InvalidModel` que nombra el material y el campo, por ejemplo
  `el GSI del material 'roca' debe estar en [0, 100]`.

## F6.3 Material `shansep` (E16c)

```json
{ "id": "arcilla", "model": "shansep", "unit_weight": 18.0,
  "shansep": { "ratio": 0.25, "exponent": 0.8, "pop": 30.0 } }
```

- **Requeridos:** `unit_weight` y el objeto `shansep`, con `deny_unknown_fields`:
  - `ratio`, el cociente S, finito, `> 0`;
  - `exponent`, el exponente m, **opcional**, finito, en `[0, 1]`, con **0,8** por defecto (cSlope; Ladd 1991, X26);
  - **exactamente uno** de:
    - `ocr`: número finito `≥ 1`;
    - `pop`: número finito `≥ 0`, en la unidad de esfuerzo del modelo;
    - `ocr_by_elevation`: tabla `[[y, OCR], …]` con al menos 2 filas, `y` estrictamente creciente y OCR finito `≥ 1`.

    Ninguno o más de uno da
    `InvalidModel: el material '<id>' requiere exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation`.
    cSlope usa OCR = 1 sin avisar cuando falta (X26 §2.2); aquí es un error.
- **Opcionales,** con las mismas reglas que en Mohr-Coulomb: `unit_weight_sat` y `ru`.
- **Prohibidos:** `cohesion`, `friction_angle`, `undrained_strength`, `strength_datum`, `strength_gradient`,
  `strength_limit`, `ucs`, `gsi`, `mi` y `disturbance`. El campo `shansep` queda prohibido en los demás modelos.
- **Fuera del formato v0.6** (X26 §5.1): `su_min`, `yield_stress`, `su_by_stress`, `anisotropy`,
  `yield_from_earlier_stage`, `above_water` y `b_bar`.

## F6.4 Búsqueda no circular: `analysis.search.non_circular` (E16d)

```json
"search": { "type": "circular_entry_exit", "non_circular": { "seeds": 3, "max_vertices": 33 } }
```

- **Objeto opcional** dentro de `analysis.search`, con `deny_unknown_fields`. Sus dos campos son opcionales:
  - `seeds`: entero en `[1, 10]`, con **3** por defecto;
  - `max_vertices`: uno de `9`, `17` o `33`, con **33** por defecto.

  El tipo Rust guarda `Option<usize>` con accesores que dan el valor por defecto, para que el documento haga el viaje
  de ida y vuelta sin pérdida. `{}` es válido.
- **Exige `analysis.search`.** Sin búsqueda no hay donde ponerlo, así que basta con el tipo.
- **Bishop no se admite** (F3.6, E13f): con `non_circular` y `bishop` en `analysis.methods`, el error es
  `InvalidModel: el método bishop no se admite con analysis.search.non_circular (la superficie crítica es una polilínea)`.
  La web deshabilita Bishop con esa razón.
- **Superficie crítica.** Cada método reporta su polilínea refinada como `SurfaceOut::Polyline`, que ya existe.
- **Algoritmo:** F6.10 **[condicional X29]**.

## F6.5 Interacciones y rechazos (E16e)

Se validan en `loads::validate_document` o en `strength::resolve_materials`, antes de cortar dovelas:

- **Grieta con profundidad automática.** Con `analysis.tension_crack.depth = "auto"` y algún material `hoek_brown` o
  `shansep` en el modelo:
  `InvalidModel: analysis.tension_crack.depth "auto" no se admite con materiales hoek_brown o shansep; use una profundidad fija`.
  La profundidad de Rankine necesita c y φ fijos. La profundidad fija sigue permitida.
- **Ito-Matsui.** Con un `pile` que tiene `lateral_pressure` y algún material `hoek_brown` o `shansep` en el modelo:
  `InvalidModel: lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep`.
  La fórmula de Ito-Matsui necesita c y φ fijos.
- **`interface` (arrancamiento)** usa su propio `friction_angle` y no cambia.
- **Caras de las dovelas** (aviso `interslice_shear_exceeds_strength`, E13k): la resistencia de una cara en un material
  `hoek_brown` o `shansep` se integra sobre la cara con la envolvente del material evaluada en el esfuerzo efectivo
  vertical de cada punto (K = 1, como hoy), con `FACE_STRENGTH_SAMPLES` puntos medios, igual que el `undrained` con
  perfil:
  - Hoek-Brown: `τ(σ′n)` de la envolvente (ecs. 8 y 9, X25 §1.1), con `σ′n` igual al esfuerzo efectivo vertical;
  - SHANSEP: `Su(σ′v)` de F6.9.

  La forma exacta y su efecto se confirman con X28 y X30 **[condicional X28, X30]**; la interfaz de F6.6 no cambia.
- **Sismo.** Hoek-Brown no cambia: el sismo entra en N′ como hoy. En SHANSEP, qué σ′v se usa con sismo lo fija F6.9
  **[condicional X30]**.

## F6.6 Arquitectura del motor, congelada en B0 (E16f)

Según la opción A de X27 §1.4: un lazo exterior que reescribe c y tanφ de las dovelas, sin tocar los métodos.

- **`model.rs`:**
  - `MaterialModel::{HoekBrown, Shansep}`, con `rename_all = "snake_case"`;
  - en `Material`: `ucs`, `gsi`, `mi` y `disturbance` como `Option<f64>`, y `shansep: Option<ShansepSpec>`, todos con
    `skip_serializing_if = "Option::is_none"`;
  - `ShansepSpec { ratio: f64, exponent: Option<f64>, ocr: Option<f64>, pop: Option<f64>,
    ocr_by_elevation: Option<Vec<[f64; 2]>> }`, con `deny_unknown_fields` y el accesor `exponent()` que da 0,8;
  - `NonCircularSpec { seeds: Option<usize>, max_vertices: Option<usize> }`, con `deny_unknown_fields` y los
    accesores `seeds()` y `max_vertices()`;
  - `non_circular: Option<NonCircularSpec>` en `SearchSpec` y en `SearchSpecWire`, omitido si es `None`;
  - `FORMAT_VERSION_V06 = "0.6"`.
- **`strength.rs`:**
  - `ResolvedMaterial` gana `law: StrengthLaw`, un enum con `Linear` (lo de hoy), `HoekBrown(HoekBrownParams)` y
    `Shansep(ShansepParams)`. `HoekBrownParams { ucs, mb, s, a }` lleva los parámetros ya derivados;
    `ShansepParams` lleva `ratio`, `exponent` y la fuente de OCR ya validada;
  - `resolve(material, y)` no cambia para `Linear`. Para `HoekBrown` y `Shansep` devuelve `(0, 0)`: el slicer deja
    esas dovelas con resistencia nula y los ganchos de abajo la escriben antes de resolver;
  - `face_tau(material, sigma_eff, y) -> f64`: la resistencia al corte de un punto de una cara (F6.5). Para `Linear`,
    `c + sigma_eff·tanφ`, la misma de hoy. Para `HoekBrown` llama a `hoek_brown::tau_at_normal` y para `Shansep` a
    `shansep::su_at`. B0 deja esas dos funciones con `todo!("F3B-M-HB")` y `todo!("F3B-M-SH")`.
- **`slicer.rs`:** la resistencia de las caras (`slicer.rs:1149-1196`) pasa por `strength::face_tau`. Para los
  materiales `Linear`, el resultado tiene que quedar **byte a byte** igual que hoy; si la forma cerrada actual no es
  `face_tau` integrado, B0 conserva la forma cerrada para `Linear` y usa el muestreo solo para los otros dos.
- **Ganchos en `lib.rs`**, en el camino de la búsqueda y en el de la superficie fija, después de
  `reinforcement::apply_*` y antes de resolver:
  1. `shansep::apply(&pm, &mut slices)`: escribe Su y tanφ = 0 en las dovelas de base `shansep`. Sin dovelas
     `shansep` no hace nada. B0: `todo!("F3B-M-SH")` si hay alguna;
  2. `strength_loop::solve(&pm, &mut slices, method, opts)` reemplaza a `methods::solve_with`. Sin dovelas
     `hoek_brown` llama a `solve_with` tal cual, así que la identidad se cumple por construcción. B0: `todo!("F3B-M-HB")`
     si hay alguna;
  3. después de la búsqueda circular, si existe `non_circular`: `noncircular::refine(...)`. B0:
     `todo!("F3B-M-NC")`.

  `lib.rs` lo edita solo B0. En B1 nadie lo toca; un cambio necesario se pide como enmienda.
- **`search.rs`:** `SearchResult` gana `seeds: Vec<(Circle, f64)>`, los mejores círculos distintos con su FS. B0 lo
  deja vacío; lo llena M-NC.
- **`report.rs`:**
  - `MethodReport.strength: Option<StrengthReport>`, omitido sin materiales `hoek_brown` ni `shansep`:
    ```json
    "strength": { "passes": 7,
                  "slices": [ { "index": 3, "law": "hoek_brown", "normal_stress": 52.1 },
                              { "index": 10, "law": "shansep", "vertical_stress": 80.2, "ocr": 1.6 } ] }
    ```
    `passes` es el número de pasadas del lazo de Hoek-Brown de ese método, y se omite sin Hoek-Brown. `slices` lista
    solo las dovelas de base `hoek_brown` o `shansep`, con el índice de `slices` del mismo informe. `cohesion` y
    `tan_phi` de cada dovela siguen en `slices`: en Hoek-Brown son los de la última pasada; en SHANSEP, Su y 0;
  - `SearchStats.non_circular: Option<NonCircularStats>`, omitido sin `non_circular`:
    `{ "seeds": 3, "evaluated": 4210, "seed_fos": 1.402 }`, donde `seed_fos` es el FS del mejor círculo antes de
    refinar.
- **Módulos nuevos** (los crea B0 con la firma y el stub, y los llena B1): `hoek_brown.rs`, `strength_loop.rs`,
  `shansep.rs` y `noncircular.rs`.

## F6.7 Códigos (E16g)

Se agregan a la lista E6 de `00_CONTRATOS.md` y a `apps/web/src/engine/warnings.ts` en el mismo merge (B0):

| Código | Tipo | Cuándo |
|---|---|---|
| `hoek_brown_not_converged` | estado `NotConverged` | el lazo de Hoek-Brown no converge en el máximo de pasadas (F6.8) |
| `hoek_brown_low_confinement` | nota informativa | alguna dovela de base `hoek_brown` tiene `σ′n` bajo la regla de F6.8; una vez por método |
| `shansep_nonpositive_stress` | nota informativa | alguna dovela de base `shansep` tiene `σ′v ≤ 0` y queda con Su = 0; una vez por método |
| `non_circular_large_change` | nota informativa | `(seed_fos − fos)/seed_fos > 0,15`, el criterio de SLOPE/W (X24 §6.3, A8) |

- Las tres notas entran en `INFORMATIVE_WARNINGS` de `crates/ogs-core/tests/acceptance.rs` en B0.
- Textos de la web (B0 los escribe; W2 puede pulirlos, nunca cambiar el código):
  - `hoek_brown_not_converged`: «El cálculo con Hoek-Brown no convergió: la resistencia de la roca no se estabilizó
    con el factor de seguridad.»
  - `hoek_brown_low_confinement`: «En parte de la base el esfuerzo normal es muy bajo o de tracción; la resistencia de
    Hoek-Brown se tomó con la regla de bajo confinamiento. Revise la presión de poros y las grietas.»
  - `shansep_nonpositive_stress`: «En parte de la base el esfuerzo vertical efectivo es nulo o negativo; ahí la
    resistencia SHANSEP se tomó como cero.»
  - `non_circular_large_change`: «La superficie no circular bajó el factor de seguridad más de un 15 % respecto del
    mejor círculo; revise la geometría de la superficie crítica.»

## F6.8 Física de Hoek-Brown (E16h) [condicional X28]

Queda congelado ya:
- la envolvente de las ecs. 2 y 8 a 10 de Hoek et al. (2002) y la tangente instantánea en `σ′n`:
  `sen φᵢ = (k − 1)/(k + 1)` y `cᵢ = τ − σ′n·tan φᵢ`, con `cᵢ ≥ 0` y `φᵢ ≤ 89,9°` (X25 §2.1);
- `σ′n = N′/l`, con el N′ del método en la pasada anterior (X27 §1.4);
- un punto fijo en F, por método.

Lo cierra X28, con cifras:
- el estado inicial, la tolerancia, el máximo de pasadas y el amortiguamiento (cSlope: σ′n₀ = γ·(y_terreno −
  y_base)·cos²α, 30 pasadas, 1e-4 y el promedio de c y tanφ);
- la regla de bajo confinamiento (σ′n ≤ σn(σ3 = 0)) y cuándo emite `hoek_brown_low_confinement`;
- las filas de aceptación (`docs/fase3/exploracion/X28_filas/`).

## F6.9 Física de SHANSEP (E16i) [condicional X30]

Queda congelado ya: `Su = ratio·σ′v·OCR^exponent` en el punto medio de la base, con φ = 0; con `pop`,
`OCR = (σ′v + pop)/σ′v`; con `ocr_by_elevation`, OCR interpolado linealmente en la cota del punto medio de la base.

Lo cierra X30, con cifras:
- qué entra en `σ′v` (peso, cargas, agua embalsada, sismo, `ru`);
- la extrapolación de `ocr_by_elevation` fuera de la tabla;
- la regla con `σ′v ≤ 0`;
- las filas de aceptación (`docs/fase3/exploracion/X30_filas/`).

## F6.10 Algoritmo de la búsqueda no circular (E16j) [condicional X29]

Queda congelado ya (D4, X24 §6):
- las semillas son los `seeds` mejores círculos distintos de la búsqueda circular del mismo método;
- cada semilla se convierte en una polilínea con nodos en x entre la entrada y la salida, y se refina por variación
  alterna de sus vértices, sin aleatoriedad, con desempate por (FS, índice), y el mismo resultado con y sin la
  feature `parallel`;
- cada candidato pasa la admisibilidad de las polilíneas fijas (F3.6, E13l) y la de X24 §6.2;
- un candidato sin FS convergido nunca es una mejora;
- el FS refinado nunca es mayor que el de su semilla.

Lo cierra X29, con cifras: la conversión del círculo, los pasos, las rondas, el presupuesto de evaluaciones, la
concavidad máxima y las filas de aceptación (`docs/fase3/exploracion/X29_filas/`).

## F6.11 Criterios de aceptación (E16k)

Estos criterios son gates de cada ola (`slope-stability-lem-engine` §3):
1. **Neutralidad e identidad** (F6.1).
2. **Equilibrio global independiente** con las c y φ finales: residuo ≤ 1e-6 de la escala motriz en Spencer, M-P y
   Janbu simplificado; el balance propio de Bishop ≤ 1e-9.
3. **Oráculo:** las filas de X28 y X30 a ≤ 0,1 % en superficie fija; las de X29 con la cota que fije F6.10.
4. **Espejo:** el mismo FS a ≤ 1e-9.
5. **Monotonía:** Hoek-Brown sube con GSI y con σci y baja con D; SHANSEP sube con `ratio` y con OCR.
6. **Hoek-Brown original:** con GSI 100 y D 0 (s = 1 y a ≈ 0,5), la envolvente coincide con la de Hoek y Brown
   (1980) a la precisión de a.

## F6.12 Verificación (E16l)

- **Casos publicados.** Se importan a `verification/pending/F3B/` y se promueven a `verification/cases/` cuando el
  motor los reproduce:
  - los casos que entran solo con búsqueda no circular (X23: 16 casos, 19 checks);
  - V105a con SHANSEP, si X30 confirma que entra con el agua embalsada del motor;
  - Hammah et al. (2005), ejemplo 1 (ARMA 05-810), con sus supuestos escritos en el caso (cimentación y terreno seco).
- **No se relaja ninguna tolerancia.** Un check que no se reproduce va a `HOLD.json` con su causa.
- **Batería diferencial:** un bloque `F3B` con modelos de rajo con Hoek-Brown (los sintéticos SA y SB de X23 §4 y otros
  de 2 a 4 bancos, con y sin piezométrica), en búsqueda y en superficie fija frente a cSlope.

## F6.13 Web (E16m)

- **Materiales:**
  - el selector suma «Hoek-Brown» y «SHANSEP»;
  - en Hoek-Brown, σci se ingresa en la unidad de esfuerzo del modelo, con el equivalente en MPa al lado;
  - Diagnósticos advierte cuando σci < 1000 kPa o > 300 000 kPa (o su equivalente imperial), porque suele ser un
    valor en MPa escrito como kPa (X25 §5.2);
  - D no tiene valor por defecto: el panel pide elegirlo y muestra la guía de la Tabla 1 de Hoek et al. (2002);
  - la calculadora de mb, s y a (`editor/state/hoekBrown.ts`) usa las ecs. 3 a 5, con un test de paridad contra el
    motor;
  - cambiar de modelo conserva γ, γsat y ru, como hoy.
- **Búsqueda:** una casilla «Superficie no circular» con sus dos campos; al marcarla, Bishop se deshabilita con la
  razón de F6.4.
- **Salidas:** la polilínea crítica en el lienzo, sus vértices en el informe y en el CSV, los parámetros de Hoek-Brown
  (con mb, s y a) y de SHANSEP en la sección de materiales, y los avisos de F6.7.
- **Ayuda:** Hoek-Brown (con la advertencia de Hoek 1994 sobre la cohesión tangente, X25 §1.5), SHANSEP y la
  búsqueda no circular.
- **El motor simulado** rechaza los materiales nuevos y `non_circular`, como rechaza hoy la grieta.
- **Conversión de unidades:** `ucs` y `pop` son esfuerzos; las cotas de `ocr_by_elevation` son longitudes. El FS no
  cambia (≤ 1e-9).

## F6.14 Enmiendas

(Ninguna todavía. Las de cierre de los prototipos irán aquí como E16n en adelante.)
