# Contratos de la Fase 3 (normativo)

**Base:** `briefs/00_CONTRATOS.md` (E1-E11) y `briefs/01_CONTRATOS_FASE1.md` (E12a-E12j), vigentes con todas sus
enmiendas. Este archivo agrega las enmiendas **E13**, también normativas.

- **Quién lo modifica:** solo el coordinador.
- **Desacuerdos:** si un escritor no está de acuerdo, o si un criterio no se puede cumplir, se detiene y lo reporta
  con números. No ajusta umbrales, tolerancias ni valores de referencia.
- **Evidencia:** `docs/fase3/exploracion/X10.md` (casos), `X11.md` (oráculo), `X12.md` (mapa del motor) y `X13.md`
  (matemática).
- **Valores del oráculo:** los de §F3.8 los reprodujo el coordinador con `cslope` 0.1.0, con 50 dovelas y
  `tolerance 1e-5` (`$TMPDIR/coord-f3/probe.py`).

---

## F3.0 Alcance

La Fase 3 se divide en dos subfases. **Este contrato congela F3a.** F3b tendrá su propio bloque de enmiendas.

| Subfase | Contenido |
|---|---|
| **F3a** | formato v0.3; material **no drenado** (Su constante o lineal con la cota); superficies **polilínea fijas**; **Morgenstern-Price** con cinco funciones; **Janbu** simplificado y corregido; importación de los lotes 0, 1 y 2 de X10; soporte completo en la web |
| F3b (después) | búsqueda no circular (refinamiento de Celestino y Duncan); **Hoek-Brown** generalizado (el oráculo lo tiene: `kind "hoek-brown"`, con σci en `ucs`); **SHANSEP**; el caso publicado Hammah et al. (2005b) |

Quedan **fuera de la Fase 3**, para decidirlos después, la grieta de tracción, el agua embalsada, los refuerzos y los
pilotes.

---

## F3.1 Esquema `.ogs.json` v0.3 (enmienda E13a)

```json
{
  "format": "opengeoslide",
  "version": "0.3",
  "materials": [
    {
      "id": "arcilla", "name": "Arcilla blanda", "model": "undrained", "unit_weight": 18.0,
      "undrained_strength": 20.0, "strength_datum": 30.0, "strength_gradient": 1.5, "strength_limit": 60.0
    }
  ],
  "analysis": {
    "methods": ["spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "interslice": { "function": "data_points", "points": [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]] },
    "surface": { "type": "polyline", "points": [[30.0, 25.0], [40.0, 26.9], [51.3, 35.0]] }
  }
}
```

- **Versiones:** el motor acepta `"0.1"`, `"0.2"` y `"0.3"`.
  - Cada campo o variante nueva exige `"0.3"`: `model: "undrained"`, los campos `undrained_strength`,
    `strength_datum`, `strength_gradient` y `strength_limit`, `surface.type: "polyline"`, los métodos
    `morgenstern_price`, `janbu_simplified` y `janbu_corrected`, y `analysis.interslice`.
  - Con una versión menor, el error es `InvalidModel: <campo> requiere version "0.3"`, nombrando el primer campo que
    lo exige.
  - Serde no puede depender de la versión, así que la compuerta va en `validate_document`, igual que la de 0.2.
- **Identidad:** un modelo 0.1 o 0.2 sin campos nuevos da los mismos `fos`, `status`, `iterations`, `lambda`,
  `warnings` y superficie, **bit a bit**, que antes de la Fase 3, en los 21 casos actuales y en toda la batería
  diferencial. La salida por dovela puede ganar campos.
- **Esquema:** `schema/ogs-0.3.schema.json` acepta 0.1, 0.2 y 0.3, con el mismo patrón `if/then` por versión de
  `ogs-0.2.schema.json`. Se conservan los esquemas 0.1 y 0.2.
- **`deny_unknown_fields`** se mantiene en todos los tipos nuevos.

## F3.2 Material no drenado (enmienda E13b)

- **Campos de `Material`:** `cohesion` y `friction_angle` pasan a ser opcionales en el tipo, pero la validación los
  exige según el modelo.

| `model` | Obligatorios | Prohibidos |
|---|---|---|
| `mohr_coulomb` | `cohesion`, `friction_angle` | `undrained_strength`, `strength_datum`, `strength_gradient`, `strength_limit` |
| `undrained` | `undrained_strength` | `cohesion`, `friction_angle` |

- **Opcionales de `undrained`:**
  - `strength_datum` (cota y) y `strength_gradient` van juntos o no van;
  - `strength_limit` solo se admite si hay `strength_gradient`;
  - `unit_weight_sat` y `ru` se admiten igual que en Mohr-Coulomb. `ru` no cambia la resistencia, porque φ = 0.
- **Rangos:**
  - `undrained_strength ≥ 0`;
  - `strength_gradient` finito y de cualquier signo;
  - `strength_limit ≥ 0`;
  - todo finito.
- **Resistencia en la base de la dovela i**, con `y_i` = ordenada del **punto medio de la base**:
  ```
  Su(y) = max(0, undrained_strength + (strength_datum − y)·strength_gradient)
  si hay strength_limit: gradient ≥ 0 → Su = min(Su, strength_limit); gradient < 0 → Su = max(Su, strength_limit)
  cᵢ = Su(yᵢ),  tan φᵢ = 0
  ```
  Sin `strength_datum`, Su es constante (`cᵢ = undrained_strength`).
  - `strength_gradient > 0` hace crecer Su hacia abajo. Las unidades son de esfuerzo por unidad de longitud: kPa/m o
    psf/ft.
  - Equivale a `undrained` y a `s-f-datum` de cSlope: `suRefDepth`/`yRef` = `strength_datum` (una **cota**, no una
    profundidad), `suRateOfChange`/`rate` = `strength_gradient` y `suMax` = `strength_limit`.
- **Implementación:** la resistencia por dovela se resuelve en `crates/ogs-core/src/strength.rs` (nuevo), con la
  firma congelada en la ola 0:
  ```rust
  pub fn resolve(material: &ResolvedMaterial, y_base_mid: f64) -> (f64 /* c */, f64 /* tan_phi */)
  ```
  El slicer la llama para cada dovela. En Mohr-Coulomb devuelve los mismos `(c, tan φ)` de hoy, sin cambiar ningún
  bit.
- **Identidad:** `undrained` sin gradiente da el mismo resultado, bit a bit, que `mohr_coulomb` con
  `cohesion = Su` y `friction_angle = 0`.

## F3.3 Superficie polilínea fija (enmienda E13c)

- **Formato:** `analysis.surface = {"type": "polyline", "points": [[x, y], …]}`.
  - Debe tener al menos 2 puntos, todos finitos.
  - La x debe ser **estrictamente creciente**, con una separación de al menos `1e-9·ancho del modelo`.
  - Si no se cumple, el error es `InvalidModel`.
- **Ajuste al terreno**, como `fit_polyline_to_ground` de cSlope:
  - Cada extremo se **prolonga** en la dirección de su tramo hasta su primer cruce con el terreno. Si el punto
    extremo ya está sobre el terreno, el tramo se **recorta** en el cruce.
  - Si la prolongación sale del rango x del modelo sin cortar el terreno, el estado es
    `Invalid("polyline_no_ground_crossing")`.
- **Admisibilidad.** Los vértices interiores deben quedar estrictamente bajo el terreno y dentro del modelo, y ningún
  tramo puede pasar sobre el terreno. Puede rozar un vértice del terreno.
  - Si no se cumple, el estado es `Invalid("polyline_outside_ground")`.
  - **No se exige concavidad** en superficies de usuario, igual que en cSlope.
  - Rigen todas las guardas de bloque y de método de las Fases 0 y 1: E2, E11, `truncated_mass`, m_α, polo y
    `no_driving`.
- **Corte en dovelas:** los vértices de la polilínea ajustada **son nodos obligatorios** del corte, igual que los
  vértices de las regiones y de la piezométrica. Así, la base de cada dovela es recta.
- **Dirección de deslizamiento:** el paso 3 de `resolve_sliding` usa los extremos de la polilínea ajustada en lugar
  de los cruces del círculo. Los pasos 1 y 2 no cambian.
- **Representación interna:** `crates/ogs-core/src/surface.rs` (nuevo) con `enum Surface { Circle(Circle),
  Polyline(Polyline) }`.
  - Las operaciones son la ordenada `y_at(x)`, los cruces con el terreno y los puntos de quiebre.
  - Las firmas se congelan en la ola 0.
  - En un círculo, cada operación delega en el código actual sin cambiar ningún bit.

## F3.4 Morgenstern-Price (enmienda E13d)

- **Método** `morgenstern_price`. La función de fuerzas entre dovelas va en el campo opcional
  `analysis.interslice = {"function": <f>, "points"?: […]}`.
  - Sin `interslice`, la función es `half_sine`, como en cSlope y Slide2.
  - `interslice` sin `morgenstern_price` en `methods` da `InvalidModel`.
  - `points` solo se admite con `data_points`, y es obligatorio con ella.
- **Funciones**, con `ξ = (x − x₀)/(x₁ − x₀)`. `x₀` es el `x_left` de la **primera** dovela y `x₁` el `x_right` de la
  **última** dovela del bloque que analiza el método (tras E11). Fuera de [0, 1], f = 0. Son las definiciones exactas
  de cSlope (`math/helpers.rs`):

| `function` | f(ξ) |
|---|---|
| `constant` | 1 |
| `half_sine` | sin(π·ξ) |
| `clipped_sine` | max(0,35; sin(π·ξ)) |
| `trapezoidal` | ξ/0,2 en [0; 0,2]; 1 en [0,2; 0,8]; (1 − ξ)/0,2 en [0,8; 1] |
| `data_points` | lineal a trozos sobre `points` |

- **Reglas de `data_points`:**
  - al menos 2 puntos, con ξ estrictamente creciente, el primero en 0 y el último en 1;
  - f ≥ 0 y máx f > 0;
  - todo finito.
- **Fuerza vertical entre dovelas** en la frontera k: `X_k = λ·f(ξ_k)·E_k`.
  - **Dovelas aéreas (E7a):** a lo largo de un tramo aéreo, f se **congela** en el valor de la frontera izquierda del
    tramo. Así, la dovela aérea transmite E y X sin cambio, como en Spencer.
- **Ecuaciones.** Generalizan las de Spencer (`methods/spencer.rs`) cambiando cada `λE_k` por `X_k`:
  - **Cierre de fuerzas por dovela:** la misma marcha de la punta a la cresta, con dos estados (E, X).
  - **Residuo de momento** sin divisor, evaluado en `F_f(λ)` (forma de `00_CONTRATOS.md` §4.3 con E12b):
    ```
    ρ(λ) = Σ_k b_k·[(E_k + E_{k+1})·tan α_k − (X_k + X_{k+1})] − 2·Σ_k h_moment_base_k
    ```
    Con f ≡ 1 se reduce exactamente al residuo actual de Spencer.
  - **Barrido de λ:** sobre `λ·f̄ ∈ [−0,5; 1,5]` con paso `0,05/f̄`.
    - `f̄` es el promedio de f en las fronteras interiores del bloque.
    - Si `f̄ ≤ 0`, el estado es `Invalid("no_lambda_root")`.
    - Con f ≡ 1 el barrido es el de Spencer.
  - **Selección de raíz (E12e):** se toma la raíz admisible de menor F, con la nota `multiple_admissible_roots`. Los
    estados `no_lambda_root` y `no_admissible_root` no cambian.
  - **Guardas:** E4b, E7c, E9c y E12e, con `λ·f` en lugar de λ en Φᵢ. En Φᵢ se usa la f de la cara que la marcha
    resuelve en esa dovela.
- **Identidad:** `morgenstern_price` con `constant` reproduce a `spencer` (F, λ y estado) en los 21 casos y en la
  batería, con `|ΔF| ≤ 1e-10`.
- **`spencer`** sigue siendo su propio método, con resultados idénticos bit a bit a los actuales en los 36 modelos de
  referencia: los 21 casos, los 14 de la batería y `examples/acads1a`.
  - Puede compartir código con M-P, por ejemplo con un solver genérico en f, solo si se mantiene esa identidad.
- **Congelado por el coordinador para la ola 1** (commit `b133003`):
  - `SolveOptions.circular: bool`. `lib.rs` la pone en `false` en una polilínea;
  - `MethodResult.correction_factor: Option<f64>`, que `lib.rs` copia al informe.

## F3.5 Janbu (enmienda E13e)

- **`janbu_simplified`:**
  - F₀ es la raíz de `E_n(F, λ = 0) = 0`, con el mismo cierre de fuerzas por dovela de Spencer evaluado en λ = 0,
    incluidos `H`, `W*` y las cargas de E12b;
  - no usa la ecuación de momento;
  - guardas: E3 (`no_driving`) y E4b en λ = 0 (`Φᵢ > 1e-9·F` y `m_α(F) ≥ min_m_alpha`);
  - `lambda` del informe = `null`.
- **`janbu_corrected`:** `F = f₀·F₀`, con
  ```
  f₀ = 1 + b₁·(d/L − 1,4·(d/L)²)
  ```
  - `L` es la distancia entre `(x_left, y_base_left)` de la primera dovela y `(x_right, y_base_right)` de la última
    dovela del bloque analizado.
  - `d` es la máxima distancia perpendicular de la cuerda al **punto medio de la base** de cada dovela, medida
    positiva **por debajo** de la cuerda. Si es ≤ 0, `d = 0` y `f₀ = 1`.
  - `b₁` se elige una sola vez para todo el bloque, con sus dovelas de suelo, como en cSlope (`solvers.rs:817-858`):
    - **0,69** si alguna tiene c > 0 y ninguna tiene tan φ > 0 (un material no drenado cuenta como solo cohesión);
    - **0,31** si alguna tiene tan φ > 0 y ninguna tiene c > 0, y también si ninguna tiene c ni φ;
    - **0,50** si hay de las dos.
  - El estado, las guardas, N′ y las fuerzas por dovela se evalúan en **F₀**.
  - El informe trae `fos = f₀·F₀` y el campo nuevo `correction_factor = f₀`, que solo existe en este método.
  - La búsqueda minimiza el `fos` corregido.

## F3.6 Métodos según la superficie (enmienda E13f)

| Superficie | `bishop` | `spencer` | `morgenstern_price` | `janbu_*` |
|---|---|---|---|---|
| círculo (fijo o búsqueda) | sí | sí | sí | sí |
| polilínea | **no** | sí | sí | sí |

- **`bishop` con polilínea** da `InvalidModel: el método 'bishop' solo admite superficies circulares; use spencer,
  morgenstern_price o janbu`.
  - **Motivo:** en una polilínea, su FS depende del eje de momentos. El oráculo lo acepta con el aviso
    `bishop-non-circular`, pero OpenGeoSlide no reporta un FS que dependa de un parámetro no físico.
- **Spencer y M-P en una polilínea** toman momentos en los puntos medios de las bases, así que no necesitan eje.
  - **Arranque:** el lazo de F parte de F₀ de Janbu simplificado, o de 1 si no converge, en lugar de Bishop.
  - En el círculo, el arranque no cambia (identidad).

## F3.7 Informe (enmienda E13g)

- **`MethodReport.surface`** es un enum *untagged*.
  - El círculo emite `{xc, yc, r}`, idéntico a hoy.
  - La polilínea emite `{"points": [[x, y], …]}` con la polilínea **ajustada**, ya prolongada o recortada al terreno.
- **Campos opcionales del informe:** `correction_factor` (F3.5) e `interslice` (`{"function", "points"?}`, solo en
  M-P). Ambos con `skip_serializing_if`.
- **Avisos:** F3a no crea códigos de aviso de solución convergida. Los estados `Invalid` nuevos son `polyline_no_ground_crossing`, `bishop_non_circular` (E13j-3) y
  `polyline_outside_ground`. Se agregan a la lista E6 de `00_CONTRATOS.md` §4.5 y a `apps/web/src/engine/warnings.ts`
  **en el mismo merge** de integración, porque el test web compara las dos listas.

## F3.8 Verificación (enmienda E13h)

- **Valores de referencia del oráculo** en V047a, con 50 dovelas, reproducidos por el coordinador. Criterio:
  `|Δ| ≤ 0,1 %` en superficie fija.
  - Círculo fijo `xc 29.54334963719809, yc 53.63784815923435, r 28.641487934160704`:

| Caso sobre el círculo | Método | FS |
|---|---|---|
| V047a | M-P `constant` | 0,9841002710 |
| V047a | M-P `half_sine` | 0,9840779260 |
| V047a | Janbu simplificado | 0,9452285578 |
| V047a | Janbu corregido | 0,9883537594 |
| V047a con `undrained`, Su = 25, γ = 20 | Bishop | 1,5697595025 |
| V047a con `undrained`, Su = 10, `strength_datum` 35, `strength_gradient` 1 | Bishop | 1,0373275799 |

  - Polilínea fija `[[30,25.000001],[35,25.520953],[40,26.973391],[45,29.525055],[51.29111842105263,35.0]]`:

| Caso | Método | FS |
|---|---|---|
| V047a | M-P `constant` | 0,9991304877 |
| V047a | M-P `half_sine` | 0,9999384297 |
| V047a | Janbu corregido | 0,9993458659 |

- **Criterios por capacidad nueva:**
  1. **Neutralidad:** se cumple la identidad de F3.1, F3.2 y F3.4.
  2. **Equilibrio global:** M-P y Spencer tienen un residuo de momento global independiente, respecto de **dos
     puntos distintos**, menor que `1e-6` del momento motor, en un círculo y en una polilínea. Janbu tiene un residuo
     global de fuerza horizontal menor que `1e-6·ΣW`.
  3. **Oráculo:** se cumplen los valores de arriba.
  4. **Espejo:** con x → −x y la dirección invertida, se obtiene el mismo FS en todos los métodos nuevos y en la
     polilínea.
  5. **Monotonía:** el FS crece con `undrained_strength` y con `strength_gradient > 0`.
  6. **Convergencia geométrica:** una polilínea de N cuerdas inscrita en el círculo de V047a tiende, con M-P
     `constant`, al FS de Spencer en el círculo cuando N crece (error de orden O(1/N²)).
- **Casos publicados** (X10). El importador `verification/tools/import_cslope.py` se amplía en tres lotes:
  - **lote 0:** los 63 casos convertibles hoy. Se elimina el tope `MAX_CASES = 20` y la selección por mínimos;
  - **lote 1:** `undrained` y `s-f-datum`;
  - **lote 2:** `customSurfaces` fijas, M-P medio seno y otras funciones, y Janbu simplificado y corregido.

  Reglas de la importación:
  - Los casos que necesitan una función todavía no integrada van a `verification/pending/F3/` hasta que el
    integrador los promueve.
  - Se aplica la tolerancia de siempre.
  - Un caso que falla se reporta con números, **sin relajar nada**.
  - Las pruebas de neutralidad leen el número de casos desde el índice, nunca un literal.
- **Batería diferencial:** cada modelo actual se corre también con M-P `half_sine` y con Janbu corregido sobre su
  círculo fijo, con el criterio de 0,5 % de E9b. Se agregan modelos nuevos:
  - un terraplén sobre arcilla blanda con Su lineal;
  - un depósito de relaves con Su constante;
  - un bloque deslizante sobre una capa débil con polilínea fija, con M-P y Janbu.
- **Conversor del oráculo** (`verification/harness/to_cslope.py`):
  - `undrained` se convierte en cSlope `undrained` (`undrainedShearStrength`, `suRefDepth`, `suRateOfChange`, `suMax`);
  - la polilínea, en `customSurfaces` con `customPlanesOnly`;
  - `morgenstern_price`, en `Morgenstern-Price` con `intersliceFunction` en kebab-case (`half-sine`, `clipped-sine`,
    `data-point-specified` con `intersliceDataPoints`);
  - `janbu_*`, en `Janbu` con `janbuCorrection`.

## F3.9 Web (enmienda E13i)

- **Versión al guardar:** la web guarda `"0.2"` si el modelo no usa ningún campo de 0.3, y `"0.3"` solo si usa alguno.
  Abre 0.1, 0.2 y 0.3.
- **Etiquetas, fijas para todos los escritores:**

| Clave | Nombre completo | Nombre corto |
|---|---|---|
| `bishop` | Bishop simplificado | Bishop |
| `spencer` | Spencer | Spencer |
| `morgenstern_price` | Morgenstern-Price | M-P |
| `janbu_simplified` | Janbu simplificado | Janbu |
| `janbu_corrected` | Janbu corregido | Janbu corr. |

  - **Funciones:** `constant` «Constante», `half_sine` «Medio seno», `clipped_sine` «Seno recortado (mín. 0,35)»,
    `trapezoidal` «Trapezoidal (20 %-80 %)», `data_points` «Definida por puntos».
  - **Modelos:** `mohr_coulomb` «Mohr-Coulomb», `undrained` «No drenado (Su)».
  - **Superficies:** «Círculo» y «Polilínea».
- **Bishop con polilínea:** la casilla de Bishop queda deshabilitada y explica por qué. `validateLocal` lo bloquea con
  el mismo mensaje que el motor.
- **Motor simulado** (`mockEngine.ts`): rechaza todo modelo con campos de 0.3 con un error explícito. Nunca inventa un
  FS.
- **Contrato de tokens de la Fase 2:**
  - solo `var(--ui-*)` y `var(--canvas-*)`;
  - pasan los tests `no-hardcoded-colors` y `tokens.contrast`;
  - axe con 0 violaciones serious o critical en claro y oscuro;
  - nombres accesibles estables.

## F3.10 Enmiendas tras la ola 1 (E13j, decisiones del coordinador)

- **E13j-1, ξ en la x del modelo.** ξ crece con la x del modelo, sea cual sea el sentido de deslizamiento, igual que en
  cSlope: `x₀` es la menor `x_left` y `x₁` la mayor `x_right` del bloque.
  - Por eso el espejo (F3.8, criterio 4) solo se exige con funciones simétricas en ξ: `constant`, `half_sine`,
    `clipped_sine`, `trapezoidal` y un `data_points` simétrico.
  - Con una función asimétrica, el espejo **no** debe dar el mismo FS, y así se documenta en la Ayuda.
- **E13j-2, cuerda de Janbu.** L va entre los extremos del bloque: la menor `x_left` y la mayor `x_right`, con sus
  ordenadas de base.
  - d se calcula con todas las dovelas y b₁ solo con las de suelo, como en cSlope.
- **E13j-3, estados nuevos.** F3a sí agrega tres razones de estado, que no son avisos de solución convergida:
  - `polyline_no_ground_crossing` y `polyline_outside_ground`, de E13c;
  - `bishop_non_circular`, una defensa del solver, porque la validación ya lo impide.

  Entran en la lista E6 y en `warnings.ts`, con texto en español.
- **E13j-4, raíz de F₀ en Janbu.** Pendiente de medir. Para ser coherente con E12e, la regla debería ser **la menor
  raíz admisible**, con la nota `multiple_admissible_roots` si hay más de una. Hoy W1b toma la más cercana a
  Fellenius.
  - El integrador mide si las dos reglas difieren en algún modelo: los 61 casos, la batería y `pending/F3`.
  - Si nunca difieren, se adopta la menor admisible y se deja un test.
  - Si difieren, se reporta con números antes de decidir.
- **E13j-5, ajuste al terreno.** Se usa el **primer cruce** de la prolongación, a diferencia de cSlope, que rechaza
  cuando la recta vuelve bajo el terreno en la pared.
  - Una polilínea que sale por una cara y vuelve a entrar es `polyline_outside_ground`.
  - Ambas reglas son de E13c y se mantienen.

## F3.10b Enmiendas tras el cierre (E13j-6 a E13k, decisiones del coordinador)

- **E13j-6, escala de los residuos de fuerza:** `escala = max(ΣW, ΣW*)`, con W* el peso con sismo y cargas de E12b.
  - Se aplica al cierre `|E_n| ≤ 1e-6·escala`, al residuo de momento y a la raíz de F₀ de Spencer, M-P y Janbu.
  - Se aplica también a la **clasificación E7d** de la N′ negativa: `f = Σ|N′<0| / escala`, con el umbral de 0,05 sin
    cambios.
  - Sin cargas y con kv ≤ 0, la salida es idéntica bit a bit.
  - **Medido:** en 1206 corridas solo cambian V018, V077 y V078, problemas de Prandtl con γ = 1e-6.
  - E3 (`no_driving`) no cambia.
- **E13j-7, cuerda de Janbu sobre el bloque de suelo.** L y d se miden sobre las dovelas de suelo, sin las aéreas de
  los extremos, igual que en cSlope, que no tiene dovelas aéreas.
  - Reemplaza la frase «d con todas las dovelas» de E13j-2.
  - **Medido:** D09 pasa de +0,98 % a +0,04 % frente a cSlope.
- **E13j-8, dominio de ξ sobre el bloque de suelo.** `x₀` y `x₁` de ξ se miden sobre el bloque de suelo. Las dovelas
  aéreas de los extremos conservan ξ = 0 o ξ = 1. Modifica E13j-1.
  - **Medido:** D09 con `half_sine` pasa de +3,39 % a +0,016 %.
  - Spencer, Bishop, Janbu y M-P `constant` siguen idénticos byte a byte.
- **E13k, aviso de cortante entre dovelas no admisible.**
  - **Hallazgo D-1** (`docs/fase3/d1/DIAGNOSTICO.md`): en polilíneas en V, Spencer y M-P convergen con FS de 49 a 130,
    mientras Janbu da entre 4 y 5 y cSlope no converge.
  - Son soluciones de equilibrio válidas, con cierre de 1e-11 y una sola raíz admisible, **pero estáticamente
    inadmisibles**: la masa se sostiene por el cortante entre dovelas y no por la base.
  - **Criterio:** el de Chen y Morgenstern (1983), en la forma (d) de Zhu, Lee y Jiang (2003):
    ```
    r_v = max_caras |X|·F / (c_v·h + max(E′, 0)·tan φ_v)
    ```
    - X = λ·f·E y E′ = −E − P_w, con la compresión positiva;
    - `h` es la altura de la cara, desde la base hasta el terreno;
    - c_v es el promedio en altura de c (Su en no drenado) y tan φ_v el promedio en altura de tan φ, de los
      materiales que cruza la cara;
    - solo cuentan las caras con |E| ≥ 2 % de max|E| y E′ > 0;
    - se **excluyen** las caras sin resistencia (`c_v·h + E′·tan φ_v = 0`, como el material de Su = 0 de V021).
  - **Clasificación:** con `r_v > 3`, aviso `interslice_shear_exceeds_strength`, de severidad aviso, no informativo.
    - Aplica a Spencer y M-P. En Janbu X = 0, así que no aplica.
    - Es un **umbral de clasificación de avisos** calibrado, igual que E8c, y no una tolerancia: queda entre el máximo de
      los casos de referencia, 1,63 (D13), y el mínimo de las soluciones absurdas, 3,88.
    - No se rechaza la solución, porque la bibliografía respalda la comprobación, no un umbral de rechazo.
    - No se emite nota con `r_v > 1`, porque la tendrían 18 de 119 resultados publicados que reproducen su valor.
  - **Efecto esperado:** ningún caso ni modelo de la batería recibe el aviso.
  - **Texto al usuario:** «Las fuerzas de corte entre dovelas superan la resistencia de las caras verticales (Chen y
    Morgenstern, 1983): este FS puede no ser físico. Compárelo con Janbu o revise la forma de la superficie.»
  - Entra en la lista E6 y en `warnings.ts`.
- **Limitación documentada:** algunas polilíneas con tramos muy empinados se rechazan por la guarda m_α (E4b), que
  cSlope no aplica. Se mantiene la guarda y se documenta en `docs/limitaciones.md`.

## F3.10c Enmiendas por R10 (E13l, decisiones del coordinador)

Las revisiones están en `docs/reviews/R10_agy_A.md` y `R10_agy_B.md`. Cada punto se implementa con su test RED y su
efecto medido sobre **todos** los modelos.

- **E13l-1, f₀ de Janbu (R10A-01, R10B-01).** `f₀ = max(1, 1 + b₁·(d/L − 1,4·(d/L)²))`: la corrección nunca reduce F₀.
  - Si d/L supera el límite del gráfico de Janbu (1973), se emite la nota `janbu_correction_extrapolated`. El límite
    se cita de la fuente, previsiblemente 0,4 según Abramson et al. (2002).
  - Ningún método devuelve `converged` con un FS ≤ 0 o no finito. Si ocurre, el resultado pasa a `not_converged` con
    el motivo `non_positive_fos`.
  - Los dos códigos nuevos van a E6.
- **E13l-2, fuerza motriz en superficies no circulares (R10A-02).** En polilíneas, E3 evalúa
  `Σ(W*·sen α + H·cos α)` en el sentido del deslizamiento, que es la misma `t` del equilibrio de fuerzas. Los círculos
  no cambian.
- **E13l-3, escala de los residuos (R10A-03 y R10A-07).** Se reemplaza ΣW* de E13j-6 por una **escala motriz** que no
  se infle con cargas verticales inertes. La candidata es `max(ΣW, Σ|t_i|, Σ|H_i|)`.
  - **Criterios de aceptación:**
    - V018, V077 y V078 siguen convergiendo con sus FS;
    - todos los demás modelos quedan idénticos byte a byte;
    - el contraejemplo de la sobrecarga inerte de R10A-03 no converge falsamente;
    - V068 con carga en el pie (R10A-07) conserva `negative_effective_normal_major`.
  - Si ninguna escala cumple los cuatro criterios, se mide y se reporta sin implementar.
- **E13l-4, paso de λ en M-P (R10A-08).** El paso es `0,05 / max(f̄, f_max/2)`, de modo que λ·f nunca salta más de
  0,1.
  - f se normaliza internamente por f_max, y λ se informa en la escala del usuario.
  - Las cinco funciones estándar quedan idénticas byte a byte.
- **E13l-5, base sobre un contacto de materiales (R10A-04).** Si el punto medio de la base está a menos de `tol` de un
  contacto entre dos materiales, se toma el **más débil**. La comparación se hace con `c + max(0, σ′)·tan φ` (o Su),
  con `σ′ = W·cos²α/b − u`.
  - Es la regla de cSlope, que se lee y no se copia.
  - Los círculos que solo rozan el contacto se miden.
- **E13l-6, robustez de la polilínea (R10A-05, R10A-09 y R10A-06-3).**
  - La prolongación y el recorte de los extremos usan la distancia 2D.
  - Los vértices de la polilínea tienen prioridad sobre las fronteras de las cargas y sobre la fusión por `tol`.
  - La resistencia de una cara vertical sobre un contacto vertical se toma del lado más débil.
- **E13l-7, superficie informada (R10B-05).** Cuando la masa se trunca (`truncated_driving_mass`), `report.surface` de
  una polilínea se recorta al rango analizado, como el trazo de los círculos. La web dibuja y exporta ese rango.
- **E13l-8, esquema (R10A-10 y R10B-04c).** En `ogs-0.3.schema.json`, una polilínea exige `analysis.methods`.
  `validateLocal` aplica el valor por defecto `["bishop"]`.
- **Aclaración de E13k.** Solo cuentan las caras con E′ > 0, así que la fórmula usa E′ y no `max(E′, 0)`.
  - La resistencia de una cara en tracción se trata con los avisos de tracción, no con este aviso.
  - **Limitación documentada:** `r_v ≤ 3` no garantiza que la solución sea física. R10A-06 encontró un caso bicapa
    con Spencer en 2,9 veces Janbu y sin aviso. El informe recomienda comparar con Janbu.

## F3.11 Gates de F3a

- **Los de F1.5**, más:
  - aceptación con los casos promovidos;
  - batería con los modelos nuevos;
  - `test_schema.py` con 0.3.

  La prueba que hoy exige que `"0.3"` falle se actualiza en el mismo cambio que el esquema.
- **Web:** se mantienen en verde todos los recorridos de `docs/fase2/ux/*-e2e/`, y se agregan los recorridos de
  modelado y cálculo con polilínea, con material no drenado y con M-P y Janbu.
- **Al cierre:** revisión adversarial **R10 con Antigravity**, con dos lentes:
  - (a) matemática, datos y contratos;
  - (b) antisuplantación y propagación de errores: ¿puede ganar una superficie o un método inválido?
