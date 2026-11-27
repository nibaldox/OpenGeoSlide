# Contratos del bloque F3B: Hoek-Brown, SHANSEP y búsqueda no circular (formato v0.6)

**Este texto es normativo.** Solo lo edita el coordinador, con enmiendas numeradas E16a, E16b… que citan su evidencia.

**Fuentes:**
- `docs/fase3/PLAN_FASE3B.md`, con las decisiones D1 a D6;
- la exploración `docs/fase3/exploracion/X23.md` a `X27.md`;
- los prototipos X28 (Hoek-Brown), X29 (búsqueda no circular) y X30 (SHANSEP), en curso. Las secciones marcadas
  **[condicional X28]**, **[condicional X29]** o **[condicional X30]** quedaron cerradas por las enmiendas E16o, E16p y
  E16q (F6.14), antes de despachar a los escritores que las implementan. Los tipos, el formato, la validación y los ganchos
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
- **Superficie crítica y algoritmo:** F6.10. La polilínea refinada sale como `SurfaceOut::Polyline`, que ya existe.

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

  La forma de SHANSEP la fija F6.9; la de Hoek-Brown, F6.8. La interfaz de F6.6 no cambia.
- **Sismo.** Hoek-Brown no cambia: el sismo entra en N′ como hoy. En SHANSEP, el sismo no entra en σ′v (F6.9).

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
  1. `shansep::apply(&pm, kv, &mut slices) -> ShansepOutcome` (E16r): escribe Su y tanφ = 0 en las dovelas de base
     `shansep`. Va **justo después de `water::apply_ponded` y antes de los refuerzos**, porque ahí `weight_extra` vale
     exactamente `kv·W + Q + V`. Sin dovelas `shansep` no hace nada. B0: `todo!("F3B-M-SH")` si hay alguna;
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
    `{ "seeds": 3, "evaluated": 4210, "seed_fos": 1.402, "polyline_fos": 1.384 }`, donde `seed_fos` es el FS del
    mejor círculo antes de refinar y `polyline_fos` el de la mejor polilínea refinada, omitido si ninguna fue admisible
    (E16p).
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

## F6.8 Física de Hoek-Brown (E16h, cerrada por E16q)

- **Envolvente** (Hoek, Carranza-Torres y Corkum 2002, ecs. 2 y 8 a 10; X25 §1.1). La tangente instantánea en `σ′n`
  es `sen φᵢ = (k − 1)/(k + 1)`, donde `k = dσ1/dσ3` en el punto de la envolvente con `σn = σ′n`, y
  `cᵢ = τ − σ′n·tan φᵢ`, con `cᵢ ≥ 0` y `φᵢ ≤ 89,9°` (X25 §2.1). El σ3 de ese punto se busca por bisección hasta
  `|Δσ3| ≤ 1e-12·ucs`.
- **Regla de bajo confinamiento: la envolvente completa** (decisión del coordinador, E16q). Con
  `σt = −s·ucs/mb` y `sn(0)` el σn del punto con σ3 = 0:
  - si `σ′n > sn(0)`: la tangente en el punto con σ3 ≥ 0, igual que cSlope;
  - si `σt < σ′n ≤ sn(0)`: la tangente en el punto de la **misma envolvente** con σ3 ∈ (σt, 0];
  - si `σ′n ≤ σt`: `c = 0` y `tan φ = 0`; la base no resiste.

  cSlope usa en cambio la tangente de σ3 = 0 para todo `σ′n ≤ sn(0)`. Esa recta queda sobre la envolvente cóncava y
  da resistencia incluso en tracción (X25 §3.4: 9,5 kPa a tracción con `σ′n = −0,88 kPa`). La envolvente completa
  es el criterio tal como lo define la fuente, nunca sobreestima la resistencia y su diferencia con el oráculo queda
  declarada en la tabla de abajo.
- **Iteración**, por método y por superficie:
  1. **estado inicial:** `σ′n₀ = (W/b)·cos²α − u` en cada dovela de base `hoek_brown`. X28 §2 midió que el arranque
     no cambia el F convergido;
  2. **pasada:** se resuelve el método con los (c, tan φ) actuales. Con el N′ de esa solución, `σ′n = N′/l`, se
     calcula la tangente (cT, tT) y se promedia: `c ← (c + cT)/2` y `tan φ ← (tan φ + tT)/2` (w = 0,5, como cSlope);
  3. **convergencia:** `|F_k − F_{k−1}| ≤ 1e-6·|F_k|`, con un máximo de **50 pasadas**. Sin convergencia, el estado es
     `NotConverged` con `hoek_brown_not_converged`. En la búsqueda, ese candidato se descarta, como en cSlope;
  4. si el método no tiene solución en alguna pasada (por ejemplo, sin raíz de λ), el resultado es el estado de esa
     pasada y el lazo se detiene.

  **Medido** (`X28_filas/reglas_coordinador.json`): sin promedio (w = 1), el lazo cicla en SB con Bishop y Janbu (no
  converge en 200 pasadas). Con w = 0,5 y 1e-6 converge en 10 a 12 pasadas en los cuatro modelos. Por eso se fija el
  promedio.
- **N′ de cada método** (X28 §4):
  - Bishop: el de su ecuación, con su F;
  - Spencer y M-P: el de (F, λ);
  - Janbu simplificado y corregido: el de F₀. En Janbu corregido, el lazo converge sobre F₀ y la corrección se aplica
    al final, con los (c, tan φ) finales, como hoy.
- **Lo que se reporta:** el F de la última solución, y en `slices` los (c, tan φ) **con los que se calculó**, no los
  promediados después. Así el equilibrio global independiente (F6.11, criterio 2) se comprueba con las fuerzas reales de
  esa solución. En `strength.passes` va el número de pasadas, y en `strength.slices[].normal_stress` la σ′n de cada
  dovela de roca en esa solución.
- **`hoek_brown_low_confinement`** (F6.7): se emite si alguna dovela de base `hoek_brown` tiene `σ′n ≤ sn(0)` en la
  solución reportada. Es una nota por método.
- **Caras de las dovelas** (F6.5): `τ(σ′v(z))` de la misma envolvente y con la misma regla de bajo confinamiento.
- **Regla de compatibilidad, solo para los tests.** Una variante de la regla de bajo confinamiento igual a la de cSlope,
  fuera del formato, activable **solo en las compilaciones de test** (`#[cfg(test)]`, estado local al hilo; E16t). La
  usan solo los tests que comparan el lazo con el oráculo. El producto usa siempre la envolvente completa.
- **Filas de aceptación**, en círculo fijo, en los cinco métodos:
  - **producto contra el prototipo:** la envolvente completa de X28 (`X28_proto/hb.py`, regla `cut`, convergencia total)
    a **≤ 0,1 %** en los cuatro modelos (columna «Envolvente completa»). Es una implementación independiente en Python;
  - **lazo contra el oráculo:** la regla de compatibilidad a **≤ 0,1 %** de cSlope en los cuatro modelos y en las
    filas de agua (`X28-W-SB-LINEA16`, `X28-R-SB-RU03`, `X28-R-X25-RU03`). **Excepción de diagnóstico:** Spencer y M-P
    en SB (−0,369 % en el prototipo, X28 §11) y Spencer y M-P en `X28-R-X25-RU03` (sin solución en el prototipo). En
    esas filas se reporta la cifra del motor y la diferencia, sin gate. Si el motor queda dentro de 0,1 %, pasan a gate;
  - **identidades** de F6.11: Hoek-Brown original, espejo, monotonía y equilibrio.

  Las cifras de referencia, medidas por el coordinador con el prototipo de X28 a convergencia total (1e-8):

| Modelo | Método | Oráculo (cSlope) | Envolvente completa (producto) | dif. | Regla de cSlope | dif. |
|---|---|---:|---:|---:|---:|---:|
| X25 | bishop | 1,466040 | 1,465960 | -0,005 % | 1,465961 | -0,005 % |
| X25 | spencer | 1,468185 | 1,468158 | -0,002 % | 1,468158 | -0,002 % |
| X25 | morgenstern_price | 1,468185 | 1,468158 | -0,002 % | 1,468158 | -0,002 % |
| X25 | janbu_simplified | 1,392073 | 1,392149 | +0,005 % | 1,392154 | +0,006 % |
| X25 | janbu_corrected | 1,456504 | 1,456549 | +0,003 % | 1,456554 | +0,003 % |
| HAM1 | bishop | 1,151807 | 1,150215 | -0,138 % | 1,151889 | +0,007 % |
| HAM1 | spencer | 1,153019 | 1,152052 | -0,084 % | 1,153064 | +0,004 % |
| HAM1 | morgenstern_price | 1,153019 | 1,152052 | -0,084 % | 1,153064 | +0,004 % |
| HAM1 | janbu_simplified | 1,091534 | 1,088701 | -0,260 % | 1,091691 | +0,014 % |
| HAM1 | janbu_corrected | 1,151583 | 1,148563 | -0,262 % | 1,151718 | +0,012 % |
| SA | bishop | 1,181632 | 1,180419 | -0,103 % | 1,181577 | -0,005 % |
| SA | spencer | 1,188055 | 1,187409 | -0,054 % | 1,187994 | -0,005 % |
| SA | morgenstern_price | 1,188055 | 1,187409 | -0,054 % | 1,187994 | -0,005 % |
| SA | janbu_simplified | 1,136758 | 1,135088 | -0,147 % | 1,136839 | +0,007 % |
| SA | janbu_corrected | 1,179406 | 1,177655 | -0,148 % | 1,179472 | +0,006 % |
| SB | bishop | 2,090902 | 2,067647 | -1,112 % | 2,091343 | +0,021 % |
| SB | spencer | 2,107886 | 2,094657 | -0,628 % | 2,100106 | -0,369 % |
| SB | morgenstern_price | 2,107886 | 2,094657 | -0,628 % | 2,100106 | -0,369 % |
| SB | janbu_simplified | 2,105636 | 2,045031 | -2,878 % | 2,106343 | +0,034 % |
| SB | janbu_corrected | 2,202191 | 2,138775 | -2,880 % | 2,202897 | +0,032 % |

  La diferencia con cSlope crece con las dovelas en bajo confinamiento: 0 % en X25 (1 dovela), de −0,05 % a −0,26 % en
  HAM1 y SA (2 a 4 dovelas) y de −0,6 % a −2,9 % en SB (10 a 12 dovelas). Siempre es conservadora. `docs/limitaciones.md`
  y la Ayuda la explican.

## F6.9 Física de SHANSEP (E16i, cerrada por E16o)

- **Resistencia.** `Su = ratio·σ′v·OCR^exponent` en el punto medio de la base, con φ = 0, calculada **una vez por dovela
  y por superficie**. No depende de F, así que no hay iteración.
- **σ′v en la base** (E16o, X30 §1):
  - `σ′v = (W + Q + V)/b − u`, donde:
    - `W` es el peso estático de la dovela, sin `kv·W`;
    - `Q` son las cargas verticales estáticas (`udl` y `line`) sobre la dovela;
    - `V` es el peso del agua embalsada sobre la dovela (F5.3);
    - `b` es el ancho de la dovela;
    - `u` es la presión de poros de la base que ya calcula el motor: piezométrica sin recortar al terreno, agua
      embalsada y `ru`.
  - **El sismo no entra en σ′v.** Con `kh` y `kv`, el oráculo deja Su idéntico dovela por dovela (diferencia 0,0); el
    sismo actúa solo en las fuerzas de los métodos, como hoy.
- **OCR:**
  - `ocr`: el valor constante;
  - `pop`: `OCR = (σ′v + pop)/σ′v`;
  - `ocr_by_elevation`: interpolación lineal en la cota del punto medio de la base, `(y_izq + y_der)/2`, y **constante
    fuera de la tabla**: debajo de la primera fila vale el OCR de la primera; encima de la última, el de la última.
- **σ′v ≤ 0:** Su = 0 sin evaluar el OCR, y la nota `shansep_nonpositive_stress` (F6.7), una vez por método. Con
  entradas válidas solo ocurre bajo el agua con `unit_weight` < γw y sin `unit_weight_sat` (X30 §4).
- **Caras de las dovelas** (F6.5): `∫ Su(σ′v(z)) dz` sobre la cara, con `FACE_STRENGTH_SAMPLES` puntos medios. `σ′v(z)`
  es el esfuerzo vertical de la **columna de suelo** a la cota z menos `u(z)`, la misma convención que el motor ya usa
  en las caras de los otros materiales (`slicer.rs`, `ru`; E16r).
  El oráculo no emite este aviso en V047a (X30 §5), así que se prueba con una identidad: con OCR constante y una capa
  seca, el resultado es `ratio·OCR^exponent·σ̄′v·h`, donde `σ̄′v` es la media de `σ′v(z)` en la cara.
- **Superficies muy profundas.** Con OCR 1 en un perfil normalmente consolidado, el mínimo es un círculo muy ancho y
  poco profundo (r ≈ 257 m en un talud de 15 m en V047a, X30 §6), y el oráculo da el mismo. **No se agrega un aviso**
  sin un umbral medido. `docs/limitaciones.md` lo explica.
- **Filas de aceptación:** `docs/fase3/exploracion/X30_filas/`, a ≤ 0,1 % en círculo fijo en los cinco métodos (medido
  ≤ 0,023 %). Se exceptúa `X30-F-V105a`, que usa `aboveWater` de cSlope (otro material sobre el nivel del agua), fuera
  del formato v0.6 (F6.3). V105a se importa a `verification/pending/F3B/`. Se promueve solo si el motor reproduce el
  publicado (1,285 ± 0,01039) sin `aboveWater`. Si no, queda en `HOLD.json` con esa causa.

## F6.10 Algoritmo de la búsqueda no circular (E16j, cerrada por E16p)

El algoritmo es el de X29 §9, la variación alterna de Celestino y Duncan tal como la implementa cSlope (X24 §1). Se lee
y se cita; no se copia.

1. **Semillas.**
   - La semilla 1 es el círculo crítico de la búsqueda circular del mismo método, después de su refinamiento
     (`search.rs`, `refine`).
   - Las otras `seeds − 1` son los mejores círculos de la malla de la búsqueda circular (entrada × salida × radio, con
     la parametrización de `search.rs`), en orden de (FS, índice). Cada una tiene que diferir de **todas** las semillas
     ya elegidas en más del 5 % del span de `search.rs`, en la entrada o en la salida.
   - Si no hay suficientes círculos distintos, se usan los que haya. `stats.non_circular.seeds` dice cuántas se usaron.
2. **Conversión.** Cada semilla se convierte en una polilínea de **9 vértices** igualmente espaciados en x entre la
   entrada y la salida, sobre el arco inferior. Los extremos van exactamente sobre el terreno (`fit_to_ground`).
3. **Niveles.** `9 → 17 → 33` vértices, insertando los puntos medios, y se para en `max_vertices`. Al pasar de nivel,
   la polilínea se reevalúa.
4. **Variación alterna,** en cada nivel:
   - el paso inicial es `Δ₀ = 0,1 ×` el segmento más corto del nivel;
   - en cada paso hay hasta **6 rondas**. En una ronda:
     - cada vértice interior se mueve ±Δ sobre la bisectriz de las normales hacia arriba de sus dos segmentos;
     - los extremos se mueven ±Δ en x, con su y sobre el terreno;
     - por vértice se ajusta la parábola `t = Δ·(F₋ − F₊)/(2·(F₊ + F₋ − 2F₀))`, acotada a ±Δ. Sin curvatura positiva
       se toma el mejor de los dos lados;
     - se evalúan el movimiento conjunto de todos los vértices y el mejor movimiento individual, y se toma **el de
       menor F** de los dos. Se acepta si `F < F₀ − 1e-6`; si no, la ronda no mejora (E16s, como `X29_proto/nc.py:346-351`,
       que dio las cifras de aceptación);
     - los extremos se mueven dentro de las ventanas `entry` y `exit` de la búsqueda, o dentro de la extensión en x del
       modelo cuando falta la ventana (E16s);
   - después de una ronda sin mejora, Δ se divide entre 2. El nivel termina cuando `Δ < 0,02·Δ₀` (6 pasos: Δ₀ a
     Δ₀/32).
5. **Presupuesto:** 1500 evaluaciones admisibles por semilla, sumando todos los niveles. Los candidatos inadmisibles no
   cuentan. **No hay pulido** en la v0.6: X29 §5 midió que cSlope lo usa y cuesta 3,6 veces más.
6. **Admisibilidad** de cada candidato, además de la de las polilíneas fijas (F3.6, E13l):
   - `dx ≥ 1e-6·ancho` del modelo y x estrictamente creciente;
   - **concavidad**: `α_{i+1} ≤ α_i + 1°`, con `α_i = atan2(y_i − y_{i+1}, x_{i+1} − x_i)`. Es la regla del código de
     cSlope (`surface.rs:293-304`), no la de su comentario (X29 §3);
   - vértices interiores bajo el terreno, y segmentos bajo el terreno (comprobados con 8 puntos por segmento);
   - un candidato sin FS convergido nunca es una mejora.

   **La regla de concavidad vale solo para los candidatos de la búsqueda.** Las polilíneas que fija el usuario no
   cambian, por la identidad (F6.1).
7. **Determinismo.**
   - No hay aleatoriedad, y los desempates son por (FS, índice).
   - Las evaluaciones de una ronda pueden correr en paralelo, pero la decisión se toma en orden fijo. El resultado es el
     mismo con y sin la feature `parallel`, y en dos corridas.
8. **Resultado por método.** El mínimo entre el mejor círculo (la semilla 1) y la mejor polilínea refinada. Con empate
   gana el círculo.
   - Si gana la polilínea, la superficie crítica es `SurfaceOut::Polyline`; si gana el círculo, `SurfaceOut::Circle`.
     Así el FS reportado **nunca** es mayor que el del círculo de la búsqueda circular (A1). X29 midió que una polilínea
     de semilla puede quedar 2,5 % sobre el círculo del motor (V002).
   - `stats.non_circular` es `{ seeds, evaluated, seed_fos, polyline_fos }`: `seed_fos` es el FS del círculo de la
     semilla 1, y `polyline_fos` el de la mejor polilínea refinada, omitido si ninguna fue admisible.
   - `non_circular_large_change` (F6.7) se calcula con `seed_fos` y el FS reportado.
9. **Métodos:** Spencer, Morgenstern-Price, Janbu simplificado y Janbu corregido. Bishop no (F6.4).
10. **Criterios de aceptación** (X29 §7), con las filas de `docs/fase3/exploracion/X29_filas/`:
    - **A2, de un solo lado:** `FS_ogs ≤ 1,01·FS_cSlope` en las 10 filas de búsqueda. Un FS menor que el de cSlope se
      acepta, porque es una búsqueda de mínimo, y lo acota A3. Medido: de +0,011 % a +0,338 %;
    - **A3:** el publicado dentro de la tolerancia **relativa** de su caso, `|FS − pub|/pub ≤ tol`, como
      `acceptance.rs` y `harness/run.py` (E16u). **Excepción V002-k1 (E16u):** si el resultado trae
      `negative_effective_normal_major`, A3 es de un solo lado, `FS ≤ pub·(1 + tol)`, y el test exige esa nota;
    - **A1:** el FS reportado no supera el del círculo de la búsqueda circular (por construcción, punto 8);
    - **A4:** vértices ≤ `max_vertices`;
    - **A6:** determinismo, punto 7;
    - **evaluador:** las 10 filas `evaluador-*` (la polilínea final de cSlope como superficie fija) a ≤ 0,1 %. Corren ya
      con la v0.4.0 (medido ≤ 0,062 %);
    - **costo:** las evaluaciones de la etapa no circular son ≤ `seeds × 1500` por método, por construcción. El tiempo
      en `release` con V001, V034a y V036a se mide y se informa en la integración, con la meta de ≤ 4 veces la búsqueda
      circular (X24 §6.3, A7). La meta no es un gate.

## F6.11 Criterios de aceptación (E16k)

Estos criterios son gates de cada ola (`slope-stability-lem-engine` §3):
1. **Neutralidad e identidad** (F6.1).
2. **Equilibrio global independiente** con las c y φ finales: residuo ≤ 1e-6 de la escala motriz en Spencer, M-P y
   Janbu simplificado; el balance propio de Bishop ≤ 1e-9.
3. **Oráculo:** las filas de X28 (F6.8) y X30 (F6.9) a ≤ 0,1 % en superficie fija, con las excepciones que nombran
   esas secciones; las de X29, con los criterios de F6.10.
4. **Espejo:** el mismo FS a ≤ 1e-9.
5. **Monotonía:** Hoek-Brown sube con GSI y con σci y baja con D; SHANSEP sube con `ratio` y con OCR.
6. **Hoek-Brown original:** con GSI 100 y D 0 (s = 1 y a ≈ 0,5), la envolvente coincide con la de Hoek y Brown
   (1980) a la precisión de a.

## F6.12 Verificación (E16l)

- **Casos publicados.** Se importan a `verification/pending/F3B/` y se promueven a `verification/cases/` cuando el
  motor los reproduce:
  - los casos que entran solo con búsqueda no circular (X23: 16 casos, 19 checks);
  - V105a con SHANSEP, si X30 confirma que entra con el agua embalsada del motor;
  - Hammah et al. (2005), ejemplo 1 (ARMA 05-810), con sus supuestos escritos en el caso (cimentación, terreno seco y
    γ). La geometría está reconstruida (X23 §3.2), así que la tolerancia es de **0,5 %** sobre Bishop 1,153 y Spencer
    1,152. El prototipo da 1,150215 y 1,152052 con la envolvente completa en el círculo del oráculo (F6.8): −0,24 % y
    +0,005 %.
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

- **E16n, alcance del esquema 0.6 (B0M, 2026-11-27).** «El esquema rechaza lo mismo que el motor» (F6.1) se entiende
  como en las versiones anteriores: el esquema expresa las reglas que JSON Schema puede expresar (tipos, campos
  requeridos y prohibidos, rangos de un valor, enumeraciones, «exactamente uno de» con `oneOf`, la puerta de versión),
  y las comparaciones entre valores quedan solo en el motor. Es la misma convención que ya prueba
  `verification/tools/test_schema.py:297-308` (`x1 >= x2`, ids duplicados). En el bloque F3B son del motor solo:
  - `ocr_by_elevation` con `y` estrictamente creciente;
  - las reglas de F6.5 que relacionan dos partes del documento (grieta `auto` o Ito-Matsui con materiales nuevos, y
    Bishop con `non_circular`).

  `test_schema.py` agrega estos casos a su lista de diferencias conocidas entre esquema y motor, con la cita de esta
  enmienda. Evidencia: informe de B0M (`deleg_c3d4ada0`).

- **E16o, cierre de SHANSEP (X30, 2026-11-27).** F6.9 queda cerrada: qué entra en σ′v (sin sismo), OCR constante fuera
  de la tabla, Su = 0 con σ′v ≤ 0, la integral en las caras y la excepción de V105a por `aboveWater`. Evidencia:
  `docs/fase3/exploracion/X30.md` §1 a §8 y `X30_filas/resultados.json` (de −0,0033 % a +0,0224 % en los cinco
  métodos).
- **E16p, cierre de la búsqueda no circular (X29, 2026-11-27).** F6.10 queda cerrada con el algoritmo de X29 §9 y tres
  cambios del coordinador:
  - la semilla 1 es el círculo refinado del motor y el resultado es el mínimo entre ese círculo y las polilíneas.
    Corrige la falla de A1 en V002 (X29 §4);
  - A2 es de un solo lado;
  - el costo se mide en evaluaciones.

  F6.6 agrega `polyline_fos` a `stats.non_circular`, y F6.4 remite a F6.10. Evidencia: `docs/fase3/exploracion/X29.md`
  §4 a §9.
- **E16q, cierre de Hoek-Brown (X28 y medición del coordinador, 2026-11-27).** F6.8 queda cerrada:
  - la regla de bajo confinamiento es la envolvente completa, no la tangente de σ3 = 0 de cSlope;
  - la iteración usa w = 0,5, 1e-6 y 50 pasadas;
  - una regla de compatibilidad, solo para los tests, verifica el lazo contra el oráculo.

  Evidencia: `docs/fase3/exploracion/X28.md` §1 a §9 y `X28_filas/reglas_coordinador.json`
  (`X28_proto/coord_reglas.py`). Con w = 1, el lazo no converge en SB.
- **E16r, el gancho de SHANSEP (M-SH, 2026-11-27).**
  - **Dónde va.** `shansep::apply` va justo después de `water::apply_ponded` y antes de los refuerzos, con la firma
    `apply(pm, kv, slices) -> ShansepOutcome { slices, nonpositive_stress }`. Antes de los refuerzos, `weight_extra`
    vale exactamente `kv·W + Q + V`, y los refuerzos no leen `cohesion` ni `tan_phi`.
  - **Qué hace `lib.rs`** con el resultado: agrega las entradas `shansep` a `MethodReport.strength`, ordenadas por
    índice junto con las de Hoek-Brown, y la nota `shansep_nonpositive_stress`.
  - **Caras.** Usan σ′v de la columna de suelo, como los demás materiales.

  Evidencia: el informe de M-SH (`$TMPDIR/agy-f3b/b1-msh/out.md`, §1 y §2) y el diff que propuso, integrado por el
  coordinador.
- **E16s, selección de movimiento, ventanas y nota no circular (M-NC, 2026-11-27).**
  - **Selección.** F6.10, punto 4, toma el menor de los dos movimientos, el conjunto y el mejor individual, como el
    prototipo que dio las cifras. El texto anterior aceptaba el conjunto aunque el individual fuera mejor.
  - **Extremos.** Quedan dentro de las ventanas de la búsqueda. Por eso `noncircular::refine` recibe
    `search: &SearchSpec`.
  - **Nota.** `lib.rs` emite `non_circular_large_change` (constante `noncircular::NON_CIRCULAR_LARGE_CHANGE`).

  Evidencia: el informe de M-NC (`deleg_364c8c41`, tarea 2) y `X29_proto/nc.py:346-351`.
- **E16t, regla de compatibilidad de Hoek-Brown solo en test (M-HB, 2026-11-27).** Se acepta la implementación de M-HB:
  `#[cfg(test)]` con estado local al hilo, en lugar de una API `#[doc(hidden)]`, porque no deja nada fuera del producto.
  - Las filas de compatibilidad quedan en 0,0018 % a 0,0716 % en las 33 filas con gate.
  - Spencer y M-P en SB no tienen raíz de λ con la regla de cSlope; con la envolvente completa sí convergen.
  - X25-RU03 Spencer y M-P quedan dentro de 0,1 % (−0,0021 %), así que pasan a gate.
  - Costo medido de una búsqueda Bishop con Hoek-Brown: 51 veces el de Mohr-Coulomb en SA (0,86 s) y 48 veces en SB.
    Se revisa en la integración.
- **E16u, A3 con tolerancia relativa y V002-k1 como limitación conocida (M-NC, 2026-11-27).**
  - **Tolerancia.** La de cSlope es relativa: `acceptance.rs:176` y `harness/run.py:203`. El rótulo «tolerancia_abs»
    de `X29_filas` es un error. La banda de V002-k1 es [0,40522; 0,42278].
  - **V002-k1.** El motor da 0,386433 con `negative_lambda` y `negative_effective_normal_major`. Su círculo crítico
    (0,401964, λ = −0,499) ya cae bajo la banda. En las **mismas** superficies, cSlope da 0,432209 (círculo) y
    0,415225 (polilínea): la diferencia, de 7 %, viene de la selección de raíz E12e (la raíz admisible de menor F, en
    una rama con tracción). Es la limitación conocida de F1.6/R5-05, no el algoritmo no circular. La polilínea del
    motor, evaluada por cSlope, cae dentro de la banda y a +1,03 % de la óptima de cSlope.
  - **Decisión.** Se mantiene E12e, como en R5-05, por conservadora. En V002-k1, A3 es de un solo lado y el test exige
    `negative_effective_normal_major`. Si otra fila falla A3 con la tolerancia relativa, se detiene y se informa.
  - **Para B2.** `docs/limitaciones.md` suma que la búsqueda no circular puede llevar a ramas con tracción, donde
    aparecen juntas las notas `negative_effective_normal_major` y `negative_lambda`.

  Evidencia: `docs/fase3/exploracion/X29_proto/v002_raices_coordinador.{py,json}`.

- **E16v, el contacto entre materiales con Hoek-Brown o SHANSEP (R15A-01, 2026-11-27).**
  - **Defecto.** `weaker_at_contact` (`slicer.rs`, E13l-5) compara las resistencias con `strength::resolve`, que
    devuelve (0, 0) para `hoek_brown` y `shansep`. En un contacto con uno de esos materiales, siempre gana el
    material nuevo, aunque sea el más resistente.
  - **Medido por el coordinador** en `92fa882`, con Spencer y una polilínea por el contacto horizontal
    (`r15-A/ct_{ab,on,be}_*.json`):

    | Contacto | Encima | Sobre el contacto | Debajo |
    |---|---|---|---|
    | MC débil sobre HB fuerte | 1,2342 | **18,036** | 18,0761 |
    | MC débil sobre SHANSEP fuerte | 1,2342 | **8,3083** | 8,3101 |
    | SHANSEP fuerte sobre MC débil | 13,4299 | **13,4306** | 6,3357 |

    El FS de la superficie que corre por el contacto debería ser el de la capa débil.
  - **Regla.** La comparación usa la resistencia real de cada material, con los mismos σ y u que la rama lineal:
    - `σ′n = max(0, col·cos²α − u)`;
    - **Hoek-Brown:** `hoek_brown::tau_at_normal(p, σ′n)`, con la envolvente completa de F6.8;
    - **SHANSEP:** `shansep::su_at(p, col − u, y_base_mid)`, es decir, σ′v de la columna;
    - **lineal:** sin cambios, byte a byte (F6.1).
  - Con empate se conserva el material de arriba, como hoy.
  - **Prueba.** Las seis combinaciones MC/HB/SH, encima, sobre y debajo del contacto. Sobre el contacto, el FS es el
    del lado débil con una diferencia ≤ 0,5 %.

- **E16w, el arranque y la no convergencia del lazo de Hoek-Brown (R15A-03, R15A-06, 2026-11-27).**
  - **Defecto.** En `X28-R-SB-RU03` (rajo SB, `ru` = 0,3, círculo fijo), el arranque de F6.8, punto 1, da `σ′n₀ ≤ σt`
    en 11 dovelas empinadas, que pasan a (0, 0). Con eso, la dovela 39 (α = 78,6°) queda con `m_α = cos α = 0,197 < 0,2`,
    y los cinco métodos fallan en la primera pasada.
  - **Medición de A** con arranque en 0: Bishop converge en 0,886911 y Janbu en 0,727964, con `m_α` mínimo de 2,3.
  - **Regla nueva, F6.8, punto 1:** `σ′n₀ = max(0, (W/b)·cos²α − u)`. El resto del lazo no cambia.
    - Donde el arranque viejo convergía, el F convergido no puede moverse más que la tolerancia del lazo (1e-6
      relativo) frente a su valor anterior. Se comprueba con las 20 filas del producto, las 33 de compatibilidad y HAM1.
      La fila SB/Bishop del producto ya estaba en +0,001024 % frente al prototipo desde M-HB (`939277a`); su gate es
      «sin cambio», no «≤ 0,001 %», que era un redondeo.
    - Si una fila sale de su gate, se detiene y se informa.
  - **Sin convergencia** (`hoek_brown_not_converged`), `fos` es `null`, como en los demás `NotConverged`. Hoy queda el
    F de la última pasada.
  - **Costo.** Se permite cambiar la búsqueda de σ3 en `hoek_brown::point`, siempre que el resultado de las pruebas no
    cambie más de 1e-9 relativo en el FS:
    - Newton salvaguardado, o bisección con un intervalo mejor;
    - `ba/base` en lugar de un segundo `powf`;
    - `sn_zero` y σt precalculados en `HoekBrownParams`.

    Se mide antes y después en F3B-HB-01 y F3B-HB-02.
  - **No cambia:** el chequeo de `m_α` de §4.2 (`00_CONTRATOS.md`, línea 333) ni el `fos` que acompaña a Bishop
    `invalid` (precedente de la v0.4). La documentación debe decir que ese FS no es válido, no que «no hay FS».

- **E16x, los extremos de la conversión no circular, las tolerancias y la nota sin refinamiento (R15A-02, R15A-08,
  2026-11-27).**
  - **Defecto.** F6.10, punto 2, pide los 9 vértices «entre la entrada y la salida». `search_circle_polyline` usa en
    cambio los cruces extremos de `sliding_span`, que incluyen el lente que el slicer descarta bajo el pie (§4.1).
    - Cuando el círculo roza el terreno en el pie, la cuerda sale sobre el terreno y la semilla es inadmisible.
    - **Medido:** en 14 de 16 taludes homogéneos (10 m, 45°, `r15-A/diag_u_*.json`), `evaluated = 0` y el resultado es
      el círculo, sin aviso.
    - En `bench_nc_ogs.json`, el motor da 1,9177 con el círculo y cSlope 1,8560 con una polilínea (+3,3 %).
  - **Reglas:**
    1. **Extremos de la conversión:** los del tramo que analiza el slicer para ese círculo (la masa deslizante, sin
       lentes descartados). En un círculo de la malla, coinciden con su entrada y su salida.
    2. **Ventanas:** `Optimizer::evaluate` acepta los extremos con una holgura de `pm.tol()`.
    3. **Tolerancias con escala:** en `search_polyline_admissible`, `g − pm.tol()` en lugar de `g − 1e-6`; en la
       selección de semillas (`search.rs`), `span.max(pm.tol())` en lugar de `.max(1.0)`. Las dos son exclusivas de la
       búsqueda no circular (F6.1 intacta).
    4. **Nota nueva** `non_circular_not_refined` (informativa, F6.7): `lib.rs` la emite una vez por método si se pidió
       `non_circular` y `evaluated = 0`. Texto: «La búsqueda no circular no encontró ninguna polilínea admisible: el
       resultado es el círculo de la búsqueda circular». Entra en las listas de notas informativas de
       `acceptance.rs`, `verification/differential/run.py` y la web.
  - **No cambia:** la regla de concavidad por vértice. La curvatura convexa acumulada (R15A-08a) se documenta como
    limitación.
  - **Prueba.**
    - En los 16 taludes homogéneos, `evaluated > 0`, y el FS no circular ≤ el del círculo.
    - En `bench_nc_ogs.json`, FS ≤ 1,01·cSlope.
    - Las 10 filas de X29 y los checks promovidos siguen dentro de su banda.

- **E16y, las caras bajo agua embalsada y la forma numérica de SHANSEP (R15A-04, R15A-10, R15C-01, 2026-11-27).**
  - **Caras** (E16r). En las caras de `hoek_brown` y `shansep`, σv(y) suma el peso del agua embalsada
    `γw·max(0, piezo − top)`, porque u(y) ya cuenta esa columna de agua. Se aplica solo a esa rama; la rama lineal no
    cambia (F6.1).
    - **Prueba de Arquímedes:** una capa seca con γ′ y la misma capa sumergida con γ, γw y el embalse dan el mismo FS
      con tolerancia 1e-6. Las caras sumergidas no emiten `interslice_shear_exceeds_strength`.
  - **POP.** `Su = ratio·σ′v^(1−m)·(σ′v + pop)^m`, que es la misma expresión de F6.9 sin el cociente, para σ′v > 0.
    σ′v ≤ 0 sigue dando Su = 0 y la nota `shansep_nonpositive_stress`.
  - **Finitud.** Si Su (en la base o en una cara) o la cohesión equivalente no son finitas, el modelo es inválido:
    `InvalidModel` con el texto «la resistencia SHANSEP del material '<id>' no es finita (revise shansep.ocr, pop u
    ocr_by_elevation)».
  - **Prueba:** `ocr` = 1e308 da código 2, con ese mensaje.

- **E16z, la verificación y el esquema (R15A-05, R15A-09, R15A-11, R15C-02, R15C-03, 2026-11-27).**
  - **Archivos de la batería.** `cases_f3b/F3B-NC-V001` y `F3B-NC-V034a` quitan `analysis.interslice`, que la CLI
    rechaza sin M-P. `build_f3b.py` deja de escribirlo.
  - **Informe.** `verification/differential/REPORT.md` se regenera con el motor de la release (hecho en `df7845f`,
    se rehace tras R15).
  - **Veredicto `explicado (§4.2: m_α)`.** Solo vale si, además, `FS_ogs ≤ 1,05·FS_cSlope`. Por encima es `FALLA`.
  - **Notas informativas.** Una sola fuente: un test compara la lista de `run.py` con la de `acceptance.rs`.
  - **Esquema 0.6.** `non_circular.seeds` y `max_vertices` admiten `null`, como los demás campos opcionales del
    esquema (precedente: `strength_datum`, `tension_crack` y `capacity`). Hay que revisar los demás campos opcionales
    de la v0.6 con el mismo criterio.
  - **Nombres de tests.** `pdf.f3b.test.ts` y `content.f3b.test.ts` dicen «ausente y null dan el mismo PDF», no
    «identidad». La identidad contra la v0.4.0 es `identity.f3b.mjs`.

  Evidencia de E16v a E16z: `$TMPDIR/r15-A/R15_A.md`, `$TMPDIR/r15-C/R15_C.md` y el arbitraje del coordinador
  (`$TMPDIR/f3b-coord/r15/arbitraje.md`), con las reproducciones citadas en cada enmienda.
