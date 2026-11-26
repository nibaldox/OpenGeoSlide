# Formato `.ogs.json` (v0.1 a v0.5)

Los modelos de OpenGeoSlide se guardan como `.ogs.json`. La web los abre y los guarda, la CLI y el paquete de Python
los leen. El motor acepta cinco versiones:

| Versión | Agrega | Esquema |
|---|---|---|
| `"0.1"` | Mohr-Coulomb, círculo (fijo o búsqueda), Bishop y Spencer | [`schema/ogs-0.1.schema.json`](../schema/ogs-0.1.schema.json) |
| `"0.2"` | `loads` y `analysis.seismic` | [`schema/ogs-0.2.schema.json`](../schema/ogs-0.2.schema.json) |
| `"0.3"` | material **no drenado**, superficie **polilínea**, métodos **Morgenstern-Price** y **Janbu**, `analysis.interslice` | [`schema/ogs-0.3.schema.json`](../schema/ogs-0.3.schema.json) |
| `"0.4"` | **refuerzos** (`reinforcements`): anclajes, clavos, geosintéticos, pilotes y tablestacas, activos y pasivos | [`schema/ogs-0.4.schema.json`](../schema/ogs-0.4.schema.json) |
| `"0.5"` | **grieta de tracción** (`analysis.tension_crack`) | [`schema/ogs-0.5.schema.json`](../schema/ogs-0.5.schema.json) |

[`schema/ogs-0.5.schema.json`](../schema/ogs-0.5.schema.json) acepta las cinco versiones. El ejemplo mínimo es
[`examples/acads1a.ogs.json`](../examples/acads1a.ogs.json).

> **La v0.5 está en desarrollo y todavía no se publica** (véase el [registro de cambios](../CHANGELOG.md#unreleased)).
> La versión publicada, la 0.3.0, llega hasta el formato v0.4 y no incluye la grieta de tracción ni el agua embalsada.

- **Un modelo sin campos nuevos da el mismo resultado en las cinco versiones**, bit a bit: `fos`, `status`,
  `iterations`, `lambda`, `warnings` y superficie. Un modelo con `reinforcements` ausente o vacío es idéntico byte a byte
  a la salida de la v0.2.0, con **una sola excepción documentada**: un círculo cuyo arco termina con la tangente vertical
  sobre el terreno, que la v0.2.0 rechazaba por redondeo (V065), ahora se analiza ([Limitaciones](limitaciones.md#excepción-a-la-identidad-con-la-v020-círculos-con-la-tangente-vertical-v065)).
- **Un modelo sin `tension_crack` y con la piezométrica bajo el terreno da la misma salida, byte a byte, que la v0.3.0**
  (salvo el número de versión del motor). **Excepción documentada:** un modelo cuya piezométrica pasa **sobre el
  terreno** cambia de resultado en las cinco versiones, porque ahora incluye el agua embalsada
  ([Agua embalsada](#agua-embalsada-todas-las-versiones) y
  [Limitaciones](limitaciones.md#excepción-a-la-identidad-con-la-v030-agua-sobre-el-terreno)).
- **Cada campo o variante de la versión 0.3 exige `"0.3"`, `reinforcements` exige `"0.4"` y `analysis.tension_crack`
  exige `"0.5"`** (véase [la compuerta de versión](#compuerta-de-versión)).
- **Los ángulos van en grados.** Las unidades no se convierten: deben ser coherentes entre sí.
- Todos los objetos rechazan campos desconocidos. Un `null` cuenta como campo ausente.

Los ejemplos de esta página se validan con el esquema y con `ogs analyze`
([cómo reproducirlo](#cómo-se-validan-los-ejemplos)).

## Estructura de un modelo v0.5

```
format, version, meta?, units?, materials[], regions[], water?, loads?, reinforcements?, slope?, analysis
```

`analysis` agrega, respecto de v0.2, el campo `interslice` y el tipo `polyline` en `surface`:

```
analysis: { methods[], slices?, tolerance?, max_iterations?, min_m_alpha?, seismic?, interslice?, tension_crack?, surface? | search? }
```

`tension_crack` es nuevo en la v0.5. El agua embalsada no tiene campo: sale de `water.piezometric_line` y del terreno.

## Material no drenado (`model: "undrained"`)

Un material tiene `model: "mohr_coulomb"` (el de siempre) o `"undrained"` (φ = 0, con resistencia no drenada Su).
Cada modelo exige unos campos y prohíbe otros:

| `model` | Obligatorios | Prohibidos |
|---|---|---|
| `mohr_coulomb` | `cohesion`, `friction_angle` | `undrained_strength`, `strength_datum`, `strength_gradient`, `strength_limit` |
| `undrained` | `undrained_strength` | `cohesion`, `friction_angle` |

Los cuatro campos del modelo no drenado:

| Campo | Significado | Rango |
|---|---|---|
| `undrained_strength` | Su en la cota `strength_datum` (o Su constante si no hay gradiente) | finito, ≥ 0 |
| `strength_datum` | **cota** `y` donde vale `undrained_strength` (es una cota, no una profundidad) | finito |
| `strength_gradient` | variación de Su por unidad de longitud al bajar (kPa/m, o psf/ft) | finito, de cualquier signo |
| `strength_limit` | tope de Su | finito, ≥ 0 |

Reglas de combinación:

- `strength_datum` y `strength_gradient` van **juntos o no van**.
- `strength_limit` solo se admite si hay `strength_gradient`.
- `unit_weight_sat` y `ru` se admiten igual que en Mohr-Coulomb. `ru` no cambia la resistencia, porque φ = 0.

**Resistencia en la base de cada dovela**, con `y` la ordenada del **punto medio de la base**:

```
Su(y) = max(0, undrained_strength + (strength_datum − y) · strength_gradient)
con strength_limit:  gradiente ≥ 0 → Su = min(Su, strength_limit);   gradiente < 0 → Su = max(Su, strength_limit)
c = Su(y),  tan φ = 0
```

Sin `strength_datum`, Su es constante (`c = undrained_strength`). Un material no drenado sin gradiente da el mismo
resultado, bit a bit, que Mohr-Coulomb con `cohesion = Su` y `friction_angle = 0`. Equivale al modelo `undrained` y a
`s-f-datum` de cSlope (`suRefDepth` = `strength_datum`, `suRateOfChange` = `strength_gradient`, `suMax` =
`strength_limit`).

El ejemplo siguiente es un terraplén friccional sobre una arcilla blanda con Su = 20 kPa en la superficie (cota 0),
que crece 1,5 kPa por metro de profundidad hasta un tope de 28 kPa (a 5,3 m de profundidad). Pide los cinco métodos,
con la búsqueda circular. `ogs analyze` da Bishop 1,3172, Spencer 1,3069, M-P 1,3121, Janbu simplificado 1,1809 y
Janbu corregido 1,2863:

<!-- ogs-ejemplo nombre=terraplen-su-lineal estado=converged fos=bishop:1.3172,spencer:1.3069,morgenstern_price:1.3121,janbu_simplified:1.1809,janbu_corrected:1.2863 -->
```json
{
  "format": "opengeoslide",
  "version": "0.3",
  "meta": { "id": "ejemplo-terraplen-arcilla", "title": "Terraplén sobre arcilla blanda con Su lineal" },
  "units": "SI",
  "materials": [
    { "id": "relleno", "name": "Relleno compactado", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 8.0, "friction_angle": 34.0 },
    {
      "id": "arcilla", "name": "Arcilla blanda", "model": "undrained", "unit_weight": 16.5,
      "undrained_strength": 20.0, "strength_datum": 0.0, "strength_gradient": 1.5, "strength_limit": 28.0
    }
  ],
  "regions": [
    { "material": "relleno", "polygon": [[10, 0], [22, 6], [32, 6], [44, 0]] },
    { "material": "arcilla", "polygon": [[0, -12], [0, 0], [60, 0], [60, -12]] }
  ],
  "slope": { "direction": "left_to_right" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "interslice": { "function": "half_sine" },
    "search": { "type": "circular_entry_exit", "entry": [22, 32], "exit": [44, 58] }
  }
}
```

Errores de material (el motor responde `InvalidModel`, código de salida 2):

| Caso | Mensaje del motor | ¿Lo rechaza el esquema? |
|---|---|---|
| `undrained` con `cohesion` | `el material 'arcilla' con model "undrained" no admite el campo 'cohesion'` | sí |
| `strength_datum` sin `strength_gradient` | `strength_datum y strength_gradient van juntos o no van` | sí |
| `mohr_coulomb` con `undrained_strength` | `el material 'relleno' con model "mohr_coulomb" no admite el campo 'undrained_strength'` | sí |

<!-- ogs-fragmento base=terraplen-su-lineal ruta=materials.1 esperado=error:no~admite~el~campo~'cohesion' esquema=rechaza -->
```json
{ "id": "arcilla", "name": "Arcilla blanda", "model": "undrained", "unit_weight": 16.5, "undrained_strength": 15.0, "cohesion": 5.0 }
```

<!-- ogs-fragmento base=terraplen-su-lineal ruta=materials.1 esperado=error:strength_datum~y~strength_gradient~van~juntos~o~no~van esquema=rechaza -->
```json
{ "id": "arcilla", "name": "Arcilla blanda", "model": "undrained", "unit_weight": 16.5, "undrained_strength": 15.0, "strength_gradient": 1.5 }
```

<!-- ogs-fragmento base=terraplen-su-lineal ruta=materials.0 esperado=error:no~admite~el~campo~'undrained_strength' esquema=rechaza -->
```json
{ "id": "relleno", "name": "Relleno compactado", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 8.0, "friction_angle": 34.0, "undrained_strength": 20.0 }
```

(Los tres bloques anteriores sustituyen al material indicado del ejemplo y se prueban con el mismo script.)

## Superficie: círculo, polilínea y búsqueda

`analysis.surface` es una superficie **fija**; `analysis.search` es la búsqueda circular de entrada y salida. Si hay
`search`, la superficie fija se ignora.

```json
{ "type": "circle",   "xc": 40.0, "yc": 55.0, "r": 28.0 }
{ "type": "polyline", "points": [[30, 25.0], [40, 26.9], [51.3, 35.0]] }
```

**La búsqueda sigue siendo circular.** La polilínea es solo una superficie fija que usted dibuja o importa; la búsqueda
no circular queda para la Fase 3b ([Limitaciones](limitaciones.md)).

### Polilínea fija

- Al menos 2 puntos, todos finitos, con la **x estrictamente creciente** y una separación de al menos
  `1e-9 · ancho del modelo`. Si no se cumple, el error es `InvalidModel`.
- **`analysis.methods` es obligatorio** con una polilínea fija (E13l-8). Sin él, el valor por defecto es `["bishop"]`,
  que una polilínea rechaza (`InvalidModel: el método 'bishop' solo admite superficies circulares; use spencer,
  morgenstern_price o janbu`), y el esquema `ogs-0.3.schema.json` lo exige por eso: acepta y rechaza lo mismo que el
  motor. La regla no aplica si hay `analysis.search`, que ignora la superficie fija. Un `methods: null` se rechaza (el
  campo es una lista).
- **Ajuste al terreno.** Cada extremo se **prolonga** en la dirección de su tramo hasta su **primer cruce** con el
  terreno. Si el punto extremo ya está sobre el terreno, el tramo se **recorta** en el cruce. El informe trae la
  polilínea ya ajustada.
- **Admisibilidad.** Los vértices interiores deben quedar estrictamente bajo el terreno y dentro del modelo, y ningún
  tramo puede pasar sobre el terreno (puede rozar un vértice del terreno). No se exige concavidad.
- **Estados `invalid`** de la superficie, con el código en `warnings`:

| Código | Cuándo |
|---|---|
| `polyline_no_ground_crossing` | la prolongación sale del rango x del modelo sin cortar el terreno |
| `polyline_outside_ground` | un vértice interior sobre el terreno o en él, un tramo sobre un valle, o una polilínea que sale por una cara y vuelve a entrar (también si el terreno tiene una **cara vertical**) |
| `m_alpha` | una base de la polilínea es tan empinada que `m_α < min_m_alpha` (véase [limitaciones](limitaciones.md#guarda-m_α-en-tramos-empinados-de-una-polilínea)) |

- Los vértices de la polilínea ajustada son **nodos obligatorios** del corte en dovelas, y tienen prioridad sobre las
  fronteras de las cargas y sobre la fusión por tolerancia (E13l-6), así que la base de cada dovela es recta.
- La prolongación y el recorte de los extremos usan la **distancia 2D** (E13l-6): un tramo extremo casi vertical no se
  corta por tener una distancia horizontal menor que la tolerancia.
- **Material de la base.** Cada dovela toma el material de su base. Si el punto medio de la base está sobre un contacto
  entre dos materiales (a menos de `1e-9 · escala` del modelo), se toma el **más débil**, por
  `c + máx(0, σ′)·tan φ` (o Su en no drenado) con `σ′ = W·cos²α/b − u` (E13l-5). Es el caso de una polilínea trazada
  sobre el techo de un estrato débil.
- Con `slope.direction = "auto"`, el sentido se lee de los extremos de la polilínea ajustada.

El ejemplo siguiente usa la geometría de ACADS 1(a) con una polilínea de cinco puntos inscrita en el círculo fijo
(`xc` 29,543, `yc` 53,638, `r` 28,641) y cuatro métodos (**sin Bishop**, que no admite polilíneas). La función entre
dovelas de Morgenstern-Price es de puntos. `ogs analyze` da Spencer 0,9991, M-P 1,0004, Janbu simplificado 0,9567 y
Janbu corregido 0,9994:

<!-- ogs-ejemplo nombre=polilinea-mp-data-points estado=converged fos=spencer:0.9991,morgenstern_price:1.0004,janbu_simplified:0.9567,janbu_corrected:0.9994 -->
```json
{
  "format": "opengeoslide",
  "version": "0.3",
  "meta": { "id": "ejemplo-polilinea", "title": "ACADS 1(a) con superficie polilínea fija" },
  "units": "SI",
  "materials": [
    { "id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6 }
  ],
  "regions": [
    { "material": "suelo", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }
  ],
  "slope": { "direction": "auto" },
  "analysis": {
    "methods": ["spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "interslice": { "function": "data_points", "points": [[0.0, 0.0], [0.5, 1.0], [1.0, 0.0]] },
    "surface": {
      "type": "polyline",
      "points": [[30, 25.000001], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35]]
    }
  }
}
```

Una polilínea fija sin `analysis.methods` (se sustituye todo `analysis`): el esquema la rechaza y el motor responde
con la regla de Bishop.

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis esperado=error:el~método~'bishop'~solo~admite~superficies~circulares esquema=rechaza -->
```json
{
  "slices": 50,
  "surface": { "type": "polyline", "points": [[30, 25.000001], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35]] }
}
```

Tres polilíneas que el motor declara `invalid` sobre esa misma geometría. Cada bloque sustituye a
`analysis.surface.points`:

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.surface.points esperado=ok esquema=acepta estado=invalid:polyline_outside_ground -->
```json
[[30, 25], [40, 30], [51, 35]]
```

El vértice (40, 30) está **sobre** el terreno: `polyline_outside_ground`.

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.surface.points esperado=ok esquema=acepta estado=invalid:polyline_no_ground_crossing -->
```json
[[10, 21], [30, 21]]
```

La recta a y = 21 no corta el terreno dentro del modelo: `polyline_no_ground_crossing`.

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.surface.points esperado=ok esquema=acepta estado=invalid:m_alpha -->
```json
[[36, 25], [36.5, 21], [44, 21.5], [50, 35]]
```

El primer tramo baja 4 m en 0,5 m (cerca de 83° con la horizontal) y deja `m_α` por debajo de `min_m_alpha` (0,2 por
omisión): `m_alpha`.

## Métodos

`analysis.methods` es una lista sin repetidos, con estos valores:

| `methods` | Método | Círculo | Polilínea |
|---|---|:---:|:---:|
| `bishop` | Bishop simplificado | sí | **no** |
| `spencer` | Spencer | sí | sí |
| `morgenstern_price` | Morgenstern-Price | sí | sí |
| `janbu_simplified` | Janbu simplificado | sí | sí |
| `janbu_corrected` | Janbu corregido | sí | sí |

- **Bishop con una polilínea** es `InvalidModel: el método 'bishop' solo admite superficies circulares; use spencer,
  morgenstern_price o janbu`. Como `bishop` es también el valor por defecto de `methods`, una polilínea fija sin
  `methods` recibe el mismo error. En una polilínea, el FS de Bishop dependería del eje de momentos, un parámetro sin
  significado físico, y OpenGeoSlide no reporta un FS así. Con `analysis.search`, la superficie fija se ignora y la
  regla no aplica.
- **Spencer y M-P en una polilínea** toman momentos en los puntos medios de las bases: no necesitan eje. Su lazo de F
  parte del F₀ de Janbu simplificado (o de 1 si no converge), en lugar de Bishop.
- **Janbu simplificado** busca F₀, raíz del cierre de fuerzas por dovela con λ = 0 (sin ecuación de momento);
  `lambda` del informe vale `null`.
- **Janbu corregido** entrega `fos = f₀·F₀`, con
  `f₀ = máx(1, 1 + b₁·(d/L − 1,4·(d/L)²))`. `L` es la cuerda entre los extremos del bloque de suelo, `d` la distancia máxima de
  la cuerda al punto medio de la base de cada dovela (positiva por debajo de la cuerda; si es ≤ 0, `f₀ = 1`) y `b₁` se elige una vez para el bloque:
  0,69 si hay cohesión y ninguna dovela con fricción (un material no drenado cuenta como solo cohesión), 0,31 si hay
  fricción y ninguna cohesión (o ninguna de las dos), y 0,50 si hay de las dos. La búsqueda minimiza el `fos`
  corregido.
  - **La corrección nunca reduce F₀** (E13l-1): la parábola baja de 1 desde `d/L = 0,714`, y el piso de 1 lo evita.
  - Con `d/L > 0,4`, el límite del gráfico de Janbu et al. (1973) (Abramson et al., 2002), `f₀` es una extrapolación y el
    informe trae la nota `janbu_correction_extrapolated`.

Los fragmentos siguientes sustituyen a `analysis.methods` en el ejemplo de la polilínea:

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.methods esperado=error:el~método~'bishop'~solo~admite~superficies~circulares esquema=rechaza -->
```json
["bishop"]
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.methods esperado=error:analysis.interslice~requiere~el~método~"morgenstern_price" esquema=rechaza -->
```json
["spencer", "janbu_simplified"]
```

El primero es la regla de Bishop; el segundo, que `interslice` exige `morgenstern_price` en `methods`.

## Función entre dovelas (`analysis.interslice`)

Solo la usa `morgenstern_price`, con la fuerza vertical entre dovelas `X = λ·f(ξ)·E`. Sin `interslice`, la función es
`half_sine`. `interslice` sin `morgenstern_price` en `methods` es `InvalidModel`.

`ξ = (x − x₀)/(x₁ − x₀)` crece con la **x del modelo**, sea cual sea el sentido de deslizamiento. `x₀` es la menor
`x_left` y `x₁` la mayor `x_right` de las dovelas **de suelo** del bloque analizado; las dovelas aéreas de los extremos
conservan ξ = 0 o ξ = 1. Fuera de [0, 1], f = 0. A lo largo de un tramo aéreo, f se congela en el valor de su frontera
izquierda.

| `function` | f(ξ) | Fragmento |
|---|---|---|
| `constant` | 1 | `{ "function": "constant" }` |
| `half_sine` | sin(π·ξ) | `{ "function": "half_sine" }` |
| `clipped_sine` | max(0,35; sin(π·ξ)) | `{ "function": "clipped_sine" }` |
| `trapezoidal` | ξ/0,2 en [0; 0,2]; 1 en [0,2; 0,8]; (1 − ξ)/0,2 en [0,8; 1] | `{ "function": "trapezoidal" }` |
| `data_points` | lineal a trozos sobre `points` | `{ "function": "data_points", "points": [[0, 0], [0.5, 1], [1, 0]] }` |

Cada fragmento reemplaza a `analysis.interslice` del ejemplo de la polilínea y se prueba:

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=ok esquema=acepta estado=converged -->
```json
{ "function": "constant" }
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=ok esquema=acepta estado=converged -->
```json
{ "function": "half_sine" }
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=ok esquema=acepta estado=converged -->
```json
{ "function": "clipped_sine" }
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=ok esquema=acepta estado=converged -->
```json
{ "function": "trapezoidal" }
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=ok esquema=acepta estado=converged -->
```json
{ "function": "data_points", "points": [[0, 0], [0.25, 0.6], [0.5, 1], [0.75, 0.6], [1, 0]] }
```

Reglas de `data_points`:

- `points` es obligatorio con `data_points` y **solo** se admite con ella.
- Al menos 2 puntos `[ξ, f]` con ξ estrictamente creciente, el primero en 0 y el último en 1.
- f ≥ 0 y algún f > 0; todo finito.

| Caso | Mensaje del motor | ¿Lo rechaza el esquema? |
|---|---|---|
| `data_points` sin `points` | `analysis.interslice: la función data_points requiere 'points'` | sí |
| `points` con otra función | `analysis.interslice: 'points' solo se admite con la función data_points` | sí |
| `points` que no empieza en ξ = 0 | `analysis.interslice.points debe empezar en ξ = 0` | no (solo el motor) |
| f nula en todos los puntos | `analysis.interslice.points debe tener algún f > 0` | no (solo el motor) |

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=error:la~función~data_points~requiere~'points' esquema=rechaza -->
```json
{ "function": "data_points" }
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=error:'points'~solo~se~admite~con~la~función~data_points esquema=rechaza -->
```json
{ "function": "half_sine", "points": [[0, 0], [1, 1]] }
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=error:analysis.interslice.points~debe~empezar~en~ξ~=~0 esquema=acepta -->
```json
{ "function": "data_points", "points": [[0.1, 0], [0.5, 1], [1, 0]] }
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=analysis.interslice esperado=error:analysis.interslice.points~debe~tener~algún~f~>~0 esquema=acepta -->
```json
{ "function": "data_points", "points": [[0, 0], [1, 0]] }
```

**El espejo solo vale con f simétrica.** Como ξ crece con la x del modelo, reflejar el modelo (x → −x) y el sentido de
deslizamiento da el mismo FS con `constant`, `half_sine`, `clipped_sine`, `trapezoidal` y un `data_points` simétrico.
Con una función asimétrica el FS **cambia**, y es lo esperado.

## El informe

`ogs analyze` entrega `{ "engine": …, "results": [ … ] }`, un resultado por método. Con la versión 0.3 el informe
puede traer, además de lo de siempre (`method`, `fos`, `status`, `iterations`, `lambda`, `surface`, `slices`,
`search`, `warnings`):

- **`surface`** según el tipo de superficie: el círculo emite `{ "xc", "yc", "r" }` (idéntico a antes); la polilínea
  emite `{ "points": [[x, y], …] }` con la polilínea **ya ajustada** al terreno.
- **`correction_factor`**, solo en `janbu_corrected`: el `f₀` aplicado. El `fos` del informe ya es `f₀·F₀`.
- **`interslice`**, solo en `morgenstern_price`: la función usada (`{ "function", "points"? }`), incluso si fue la
  `half_sine` por omisión.
- **`lambda`** vale `null` en Bishop y en los dos Janbu.
- **`tension_crack`**, solo con `analysis.tension_crack`: `{ "x", "depth", "water_force" }` con la posición, la
  profundidad y el empuje de la grieta de esa superficie ([Grieta de tracción](#grieta-de-tracción-v05)).

Los campos opcionales se omiten cuando no aplican. Un resultado de `janbu_corrected` sobre el ejemplo de la
polilínea (sin las dovelas):

```json
{
  "method": "janbu_corrected", "fos": 0.9994, "status": "converged", "iterations": 6, "lambda": null,
  "surface": { "points": [[30.0000025, 25.0000013], [35.0, 25.520953], [40.0, 26.973391], [45.0, 29.525055], [51.2911184, 35.0]] },
  "search": null, "warnings": [], "correction_factor": 1.0446
}
```

(Redondeado a 4 decimales; el script de validación comprueba el `fos` del ejemplo.) Las dovelas del informe pueden
ganar campos nuevos entre versiones del motor; no dependa de que su conjunto sea fijo.

- Si la masa se trunca (`truncated_driving_mass`), `surface` de una polilínea se recorta al **rango analizado**, igual que
  el trazo de un círculo (E13l-7).

Los estados `Invalid` nuevos de F3a son `polyline_no_ground_crossing`, `polyline_outside_ground` y
`bishop_non_circular` (una defensa del solver, porque la validación ya impide Bishop con polilínea). Las demás
razones de estado son las de siempre.

### Códigos nuevos de E13l

Se suman a la lista de códigos de `briefs/00_CONTRATOS.md` (E6), a `apps/web/src/engine/warnings.ts` y a la aceptación:

| Código | Método | Severidad y estado | Cuándo |
|---|---|---|---|
| `janbu_correction_extrapolated` | `janbu_corrected` | nota (informativa); el FS converge | `d/L` mayor que 0,4, el límite del gráfico de Janbu (1973): `f₀` es una extrapolación |
| `non_positive_fos` | cualquiera | aviso; el método pasa a `not_converged`, sin FS | el método llegó a un FS menor o igual que cero o no finito: no se informa ningún FS |

`no_driving` (E3) ya no cae en una polilínea con `kh` o con una carga horizontal: la comprobación evalúa
`Σ(W*·sen α + H·cos α)` en el sentido del deslizamiento (E13l-2).

### Aviso `interslice_shear_exceeds_strength`

En **Spencer** y **Morgenstern-Price**, el motor emite este aviso (severidad *aviso*) cuando el cortante entre dovelas
supera tres veces lo que las caras verticales pueden movilizar (`r_v > 3`). Significa que el FS es una solución de
equilibrio válida pero **estáticamente inadmisible**: la masa se sostiene por el cortante entre dovelas y no por la
base. No se rechaza el resultado. Véase [Limitaciones](limitaciones.md#aviso-interslice_shear_exceeds_strength).

## Compuerta de versión

La compuerta vive en la validación del documento (`validate_document`), porque serde no puede depender de la versión.
Con `"0.1"` o `"0.2"`, cada uso de un campo o variante de la 0.3 da
`InvalidModel: <campo> requiere version "0.3"`, nombrando el **primer** campo que la exige. Los campos que la exigen:

- `model: "undrained"` y los campos `undrained_strength`, `strength_datum`, `strength_gradient` y `strength_limit`;
- `analysis.surface.type: "polyline"`;
- los métodos `morgenstern_price`, `janbu_simplified` y `janbu_corrected`;
- `analysis.interslice` (un `null` cuenta como ausente).

`reinforcements` no vacío exige `"0.4"`: con una versión menor el error es
`InvalidModel: reinforcements requiere version "0.4"` ([Refuerzos](#refuerzos-v04)). `analysis.tension_crack` exige
`"0.5"`: con una versión menor el error es `InvalidModel: tension_crack requiere version "0.5"`
([Grieta de tracción](#grieta-de-tracción-v05)). El agua embalsada **no** tiene compuerta: se aplica en todas las
versiones.

Los fragmentos siguientes cambian `version` a `"0.2"` en los dos ejemplos de arriba:

<!-- ogs-fragmento base=terraplen-su-lineal ruta=version esperado=error:materials[1].model~=~"undrained"~requiere~version~"0.3" esquema=rechaza -->
```json
"0.2"
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=version esperado=error:analysis.surface.type~=~"polyline"~requiere~version~"0.3" esquema=rechaza -->
```json
"0.2"
```

El esquema `ogs-0.3.schema.json` aplica la misma regla con un `if/then` por versión. **La web** guarda la versión
mínima: `"0.2"` si el modelo no usa ningún campo de 0.3, `"0.3"` si usa alguno, `"0.4"` si hay refuerzos y `"0.5"` solo
si existe `analysis.tension_crack`; abre las cinco versiones.

## Sismo y cargas (v0.2)

Los campos `loads` y `analysis.seismic` solo se admiten con `"0.2"` o `"0.3"`; con `"0.1"` el motor responde
`InvalidModel: los campos 'loads' y 'analysis.seismic' requieren version "0.2"`.

<!-- ogs-ejemplo nombre=sismo-cargas estado=converged fos=bishop:1.2723,spencer:1.2704 -->
```json
{
  "format": "opengeoslide",
  "version": "0.2",
  "meta": { "id": "ejemplo-sismo-cargas", "title": "Talud con sobrecarga y sismo" },
  "units": "SI",
  "materials": [
    { "id": "soil", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 19.0, "cohesion": 15.0, "friction_angle": 26.0 }
  ],
  "regions": [
    { "material": "soil", "polygon": [[0, -8], [0, 10], [10, 10], [25, 0], [40, 0], [40, -8]] }
  ],
  "water": { "unit_weight": 9.81 },
  "loads": [
    { "type": "udl",  "id": "u1", "x1": 7.0, "x2": 10.0, "q": 20.0 },
    { "type": "line", "id": "l1", "x": 4.0, "p": 100.0, "angle": 15.0 }
  ],
  "slope": { "direction": "left_to_right" },
  "analysis": {
    "methods": ["bishop", "spencer"],
    "slices": 50,
    "seismic": { "kh": 0.1, "kv": 0.0 },
    "search": { "type": "circular_entry_exit" }
  }
}
```

Con la búsqueda por defecto, este modelo da Bishop 1,2723 y Spencer 1,2704 (`ogs analyze`).

- `loads` va después de `water` y antes de `slope`. Cada carga puede llevar un `id` (único).
  - `udl`: carga vertical `q` ≥ 0 (kPa; psf en imperial) sobre el terreno entre `x1` < `x2`, dentro del rango x del
    modelo.
  - `line`: carga lineal `p` ≥ 0 (kN/m; lbf/ft en imperial) en `(x, y_top(x))`. `angle` en [−90°, 90°] desde la
    vertical hacia abajo; el positivo inclina la carga hacia +x del modelo.
- `analysis.seismic`: `kh` en [0, 1) y `kv` en (−1, 1). `kh·W` actúa en el sentido del deslizamiento; con `kv > 0`,
  `kv·W` actúa hacia abajo. Se aplican al peso del suelo, nunca a las cargas.
- Una carga que no toca ninguna dovela de suelo de la superficie reportada da la nota `load_outside_mass`.

## Refuerzos (v0.4)

La versión 0.4 agrega `reinforcements` al nivel raíz, después de `loads`. Es una lista opcional que se omite si está
vacía. **Con `reinforcements` ausente o vacío, la salida es idéntica byte a byte a la de la v0.2.0** (F4.1), salvo la
excepción de V065 ([Limitaciones](limitaciones.md#excepción-a-la-identidad-con-la-v020-círculos-con-la-tangente-vertical-v065)).
Un modelo con refuerzos exige `"version": "0.4"` ([compuerta de versión](#compuerta-de-versión)).

> **Límite que debe leer antes de usar pilotes o tablestacas.** Con un `pile` o una `sheet_pile` en el modelo,
> OpenGeoSlide calcula la estabilidad **global** con el elemento incluido como una fuerza. **No** calcula el empuje
> sobre el elemento, el empotramiento, el momento flector, la deflexión ni las comprobaciones internas o externas de un
> muro. El motor lo avisa siempre con la nota `structural_checks_not_covered`, crucen o no el elemento la superficie.
> Detalle en [Limitaciones](limitaciones.md#pilotes-y-tablestacas-el-límite-estructural-f48).

### Tipos y campos

| `type` | Qué es | Fuerza |
|---|---|---|
| `anchor` | Anclaje o tirante, activo o pasivo | Capacidad de tracción `T(s)` por elemento |
| `nail` | Clavo de suelo | Ídem |
| `geosynthetic` | Geomalla o geotextil | Ídem |
| `pile` | Pilote o micropilote | Fuerza de corte **constante** por pilote |
| `sheet_pile` | Tablestaca: una fila continua de pilotes | Fuerza de corte constante **por metro de muro** |

Una tablestaca anclada es una `sheet_pile` más un `anchor` ([ejemplo completo](#ejemplo-completo-una-tablestaca-anclada)).

**Campos comunes** (todo número finito):

| Campo | Regla |
|---|---|
| `id` | Obligatorio, no vacío y único en `reinforcements` |
| `x1`, `y1` | Obligatorios. La **cabeza**: el extremo en el paramento o en la superficie del terreno (en pilotes y tablestacas, la cabeza superior). El motor no exige que esté sobre el paramento |
| `x2`, `y2` | Obligatorios. El extremo embebido, o la **punta**. La longitud `L = ‖(x2 − x1, y2 − y1)‖` debe ser > 0 |
| `application` | **Obligatorio**, sin valor por defecto: `"active"` o `"passive"` ([fuerza activa y pasiva](#fuerza-activa-y-pasiva)) |

Las unidades son las del modelo (SI o imperial) y las fuerzas son **por elemento**, salvo la de `sheet_pile`.

**`anchor`, `nail` y `geosynthetic`:**

| Campo | Regla |
|---|---|
| `tensile_capacity` | Número ≥ 0, obligatorio. Tope de la barra o de la tira, por elemento (`Tmax`) |
| `end1_capacity` | Número ≥ 0, opcional, 0 por defecto. Capacidad de la placa o del anclaje en la cabeza (`T1`) |
| `end2_capacity` | Número ≥ 0, opcional, 0 por defecto. Capacidad del anclaje en la punta (`T2`) |
| `spacing` | Número > 0, opcional. Espaciamiento fuera del plano, de centro a centro. **Si se omite, vale 1 en la unidad de longitud del modelo**: 1 m en SI y 1 ft en imperial ([abajo](#el-espaciamiento-por-defecto-depende-de-la-unidad)) |
| `direction` | **Obligatorio**: `"axial"`, `"tangent"` o `"bisector"` ([dirección](#cruces-dirección-y-compresión)) |
| `pullout` | Objeto, opcional. Ausente: los dos extremos están totalmente anclados y `T(s) = Tmax/spacing` en todo el elemento |

**`pile`:** `force` (≥ 0, obligatorio, por pilote), `spacing` (> 0, opcional; omitido vale 1 en la unidad de longitud
del modelo, como arriba) y `direction`
(`"angle"`, `"tangent"` o `"perpendicular"`, obligatorio). `angle`, en grados dentro de (−90, 90) y medido sobre la
horizontal, es obligatorio **solo** con `direction: "angle"` y está prohibido con las otras dos.

**`sheet_pile`:** `force` (≥ 0, obligatorio, **por metro de muro**; no lleva `spacing`), `direction` y `angle`, como en
`pile`. Además, la tablestaca es vertical: `x1 = x2`.

#### El espaciamiento por defecto depende de la unidad

Un `spacing` omitido vale **1 en la unidad de longitud del modelo** (E14o-12): 1 m con `"units": "SI"` y 1 ft con
`"units": "imperial"`. Las capacidades y la fuerza son por elemento (kN en SI y lbf en imperial) y el motor las divide
por `spacing`, así que 1 m y 1 ft **no** son lo mismo: el mismo elemento con `spacing` omitido da una fuerza por
unidad de ancho 3,28084 veces mayor en imperial que en SI. Por eso, al **convertir las unidades** de un modelo, la web
escribe siempre un `spacing` explícito ya convertido (1 m pasa a 3,28084 ft y 1 ft a 0,3048 m), y el FS no cambia.
Un archivo que usted edita a mano y cambia de sistema debe hacer lo mismo: escriba el `spacing` de forma explícita.
El motor no convierte unidades (interpreta los números en las unidades declaradas).

`pile` y `sheet_pile` **no** llevan `location`: con fuerza constante no cambia ningún número (el FS de X17 §3 es
idéntico a 16 cifras) y el esquema, el motor y TypeScript lo rechazan como campo desconocido (E14m-3). Volvería con
Ito-Matsui, en una versión posterior del formato.

### Capacidad: `pullout`

En un elemento de tracción, la capacidad disponible en la estación `s ∈ [0, L]`, medida desde la cabeza, es (E14c):

```
T(s) = max(0, min(Tmax, T1 + ∫₀ˢ r(σ) dσ, T2 + ∫ₛᴸ r(σ) dσ)) / spacing
```

con `T1` = `end1_capacity`, `T2` = `end2_capacity` y `r` la resistencia de arrancamiento por metro de elemento. El
objeto `pullout` lleva un `model`, y cada modelo rechaza los campos de los otros:

| `model` | Campos | `r` (E14m-2) |
|---|---|---|
| `bond` | `strength` ≥ 0, `bonded_length` > 0 opcional (y ≤ `L`) | `r = strength` solo en los tramos **dentro del suelo** de la parte adherida y 0 en el aire. Sin `bonded_length`, la parte adherida es todo el elemento; con ella, los últimos `bonded_length` metros hacia la punta |
| `interface` | `adhesion` ≥ 0, `friction_angle` en [0, 90), `coverage` en (0, 1] | `r = 2·(a + σ′v·tan δ)·Rc` por metro de talud, y 0 fuera del suelo. El `spacing` se cancela y `Rc` **no** escala las capacidades de la barra ni de los extremos |
| `development` | `length1` ≥ 0, `length2` ≥ 0 | Una rampa que no mira el suelo: `f1 = T1 + Tmax·s/ℓ1` y `f2 = T2 + Tmax·(L − s)/ℓ2`, con `T = max(0, min(Tmax, f1, f2))/spacing`. Con ℓ = 0 ese extremo queda totalmente anclado (vale +∞). `T1` y `T2` **se suman** a la rampa |

- En `interface`, `σ′v` sigue la precedencia del rebanado (E14o-4, que corrige E14m-2): `σ` es la columna de suelo sobre
  el punto, con `γsat` bajo la línea de agua del material.
  - Un material **con `ru`** usa `u = ru·σ_suelo` y **no** recibe el agua libre de la piezométrica.
  - Un material **sin `ru`** usa la línea piezométrica, y el agua libre sobre el terreno cuenta.
  - En ambos casos `σ′v = max(0, σ − u)`. **No** incluye sobrecargas ni cargas lineales.
  - Con el punto sobre un **contacto** entre estratos (a menos de `tol` en y, o en x si el contacto es vertical),
    `σ′v` es el **mínimo** de los dos materiales: es lo conservador, y el resultado no depende del orden de `regions`
    ni del espejo x → −x (E14o-5, como E13l-5).
  - ogs **integra exactamente**, con cortes en el terreno y en los contactos. El oráculo (cSlope) discretiza en
    200 pasos, lo que da hasta −0,47 % en `T` ([Limitaciones](limitaciones.md#la-discretización-del-oráculo-en-interface)).
- **Tramo libre de un tirante.** Con `bonded_length`, la integral `∫₀ˢ r` vale 0 en el tramo libre. Sin
  `end1_capacity`, un cruce en el tramo libre tiene `T(s) = 0` y no aplica fuerza: su estado es `no_capacity`
  ([ejemplo](#un-fragmento-por-tipo)). Para que el tramo libre transmita la carga, ponga `end1_capacity` igual a
  `tensile_capacity` (la placa de cabeza); la web lo propone al crear un `anchor`.

### Cruces, dirección y compresión

Cada cruce del segmento `cabeza → punta` con la **superficie ya ajustada** (el arco inferior del círculo o la polilínea
ajustada) es un punto `(x_c, y_c)` con su estación `s_c = t_c·L`, y recibe su propia fuerza (E14d):

- un elemento que cruza dos veces da **dos fuerzas**, cada una con su `T(s_c)` y su dirección;
- un cruce en un extremo del elemento (`t_c` igual a 0 o a 1, dentro de `tol`) no cuenta;
- **un elemento tangente no cruza** (E14o-1). En un círculo, el cruce solo cuenta si el elemento **penetra**: la
  semicuerda de su recta dentro del círculo debe ser mayor que `tol`, y si entra y sale a menos de `tol` a lo largo del
  arco, los dos cruces se descartan. En una polilínea, un elemento que toca un vértice sin atravesar la superficie
  tampoco cuenta. Así un anclaje que apenas roza el círculo no suma fuerzas fantasma, y el FS es continuo entre «no
  toca», «roza» y «penetra por poco» (antes, `eps_r = 0` y −1e-12 m daban −21 % y +111 % respecto del FS sin
  refuerzo en V047a);
- la normal `n` y el movimiento `m` de cada cruce se calculan **en el punto exacto del cruce** (la normal radial del
  círculo o la dirección del tramo de la polilínea), no con la inclinación de la dovela fina;
- la fuerza actúa en una dovela fina centrada en `x_c`, con nodos `x_c ± 1e-6·ancho`, como una carga lineal. **No se
  agregan nodos** para un cruce con capacidad disponible nula ni para uno sobre el terreno, que se deciden antes de
  rebanar (E14o-11): el FS de un elemento sin capacidad es **exactamente** el del talud sin refuerzo;
- un cruce sobre una dovela aérea o sobre un bloque descartado no aplica fuerza (estado `outside_mass`).

**Dirección de la fuerza sobre la masa** (E14m-1). Con `s = +1` si el deslizamiento va hacia +x y `s = −1` en caso
contrario, `α` la inclinación de la base y `n` la normal a la base hacia la masa:

```
m     = (s·cos α, −sin α)          movimiento en la base
a     = (x2 − x1, y2 − y1)/L       eje del elemento, de la cabeza a la punta
d     = −a si a·n > 0, y a si no   parte del elemento bajo la superficie, hacia el lado estable
along = d·m
```

`d` no depende de cuál extremo es la cabeza. La fuerza es `P = T(s_c)·u`, en **coordenadas del modelo** (y hacia
arriba), con `u` así:

| Caso | `u` |
|---|---|
| `along > 0`, en cualquier `direction` | `d` (axial): el elemento está del lado empujado |
| `axial` | `d` |
| `tangent` | `−m` |
| `bisector` | `(d − m)/‖d − m‖` |
| `pile` o `sheet_pile`, `angle` | `(−s·cos a, sin a)`: `angle` se mide sobre la horizontal y es positivo hacia arriba |
| `pile` o `sheet_pile`, `tangent` | `−m` |
| `pile` o `sheet_pile`, `perpendicular` | la normal al eje que se opone al movimiento |

En pilotes y tablestacas la componente horizontal **siempre se opone al deslizamiento** y el resultado es invariante
al espejo x → −x.

**Regla de compresión.**

- Un elemento **pasivo** de tracción con `along ≥ cos 88°` **no aporta**: queda comprimido por el deslizamiento (según
  Clouterre, 1991, y FHWA GEC 7, más de 2° pasada la normal a la base). Su estado es `compression_ignored` y el informe
  trae la nota `reinforcement_compression_ignored`.
- Un elemento **activo** se aplica **siempre**, también con `along > 0`, axial y con su fuerza completa: es una carga
  externa conocida, la de bloqueo. **No es siempre conservador** (E14o-8): con `along > 0` la fuerza tiene una
  componente tangencial a favor del deslizamiento, pero su componente normal confina la base y, con `φ > 0`, **puede
  subir el FS** ([ejemplo](#un-activo-comprimido-puede-subir-el-fs)). El motor emite la nota informativa
  `reinforcement_active_compression`. **Difiere del binario instalado del oráculo** ([Limitaciones](limitaciones.md#el-activo-comprimido-e14m-1-e14o-8-y-el-oráculo-instalado)).
- `pile` y `sheet_pile` **no** tienen regla de compresión.

### Fuerza activa y pasiva

- **Activa** (E14f). La fuerza `P = (Px, Py)` aplicada en `(x_c, y_c)` es una carga externa conocida y **no se divide
  por F** (Duncan y Wright, método A). Es la misma ruta que las cargas lineales, con el punto de aplicación en el
  cruce y no en el terreno.
- **Pasiva** (E14g). Se moviliza con el deslizamiento y **se divide por F** (Duncan y Wright, método B, el mismo
  criterio de cSlope): cada componente entra en las ecuaciones del método con el mismo término que una activa,
  multiplicado por 1/F, con el F que se evalúa. Bishop, Spencer, Morgenstern-Price y Janbu lo aplican en cada
  evaluación de F.
- **Una fuerza pasiva es resistente** (E14o-3): entra en el equilibrio dividida por F y **no** en la comprobación de
  `no_driving` (E3), que se evalúa **solo antes de resolver**, con el peso, el sismo, las cargas y las fuerzas
  **activas**. Un suelo muy blando sostenido sobre todo por pilotes o tablestacas pasivos converge, en vez de
  rechazarse con `invalid (no_driving)`. Janbu no evalúa E3 con el momento de Bishop.
- **Bishop con pasivas** (E14o-2): el punto de partida incluye las pasivas, y antes de bisecar se acota el cambio de
  signo de `h(F) = F·D(F) − N(F)` con una malla geométrica. Un pilote o clavo pasivo con componente vertical ascendente
  converge (cSlope 3,526 frente a 3,512 de Spencer en el talud 1:1 de R11A-02), en lugar de `invalid ("m_alpha")`.
- **Janbu corregido con pasivas** (E14o-10): la fuerza pasiva se divide por `F₀` y no por `f₀·F₀`, el mismo criterio
  con que Janbu trata `c` y `tan φ` y el de cSlope. Consecuencia: activo y pasivo dan el **mismo** FS cuando
  **`F₀ = 1`**, es decir cuando el FS corregido vale `f₀`, **no** cuando vale 1. Con `f₀ = 1,0456` (V047a), en
  `FS = 1,0000` el activo da 1,0000 y el pasivo 1,0097; con `c = 4` y `φ = 10°` (`F₀ < 1`), el activo da 0,8603 y el
  pasivo 0,9043 (cSlope, 0,8601 y 0,9041). Entre `FS = 1` y `FS = f₀` el pasivo supera al activo; no es un error, es
  el significado de `F₀`.
- El sismo (`kh` y `kv`) **no** actúa sobre las fuerzas de los refuerzos.
- Los refuerzos funcionan con **todos** los métodos y con las dos superficies. Bishop sigue limitado a los círculos.
  Con una búsqueda, los cruces y los nodos se calculan para cada candidato, y el círculo crítico puede **esquivar** el
  refuerzo: si el resultado trae `reinforcement_outside_mass`, el FS mínimo es el de una superficie que no lo cruza
  ([Limitaciones](limitaciones.md#la-búsqueda-con-refuerzos-tiene-discontinuidades)).

### Ejemplo: un talud con un anclaje activo

El modelo es ACADS 1(a) (V047a) con el círculo fijo de su búsqueda de Bishop. Un anclaje activo de 100 kN, horizontal
en y = 28, con la cabeza en (52; 28) y la punta en (25; 28), cruza la superficie en x = 42,31. Sin el anclaje, Bishop
da 0,9851, Spencer 0,9841, M-P 0,9841, Janbu simplificado 0,9453 y Janbu corregido 0,9884. Con él, `ogs analyze`
da:

<!-- ogs-ejemplo nombre=refuerzos-ancla-activa estado=converged fos=bishop:1.3338,spencer:1.3295,morgenstern_price:1.3296,janbu_simplified:1.2620,janbu_corrected:1.3195 fuerzas=applied -->
```json
{
  "format": "opengeoslide",
  "version": "0.4",
  "meta": { "id": "ejemplo-refuerzos", "title": "ACADS 1(a) con un anclaje activo" },
  "units": "SI",
  "materials": [
    { "id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6 }
  ],
  "regions": [
    { "material": "suelo", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }
  ],
  "reinforcements": [
    {
      "type": "anchor", "id": "A1", "application": "active",
      "x1": 52, "y1": 28, "x2": 25, "y2": 28,
      "tensile_capacity": 100, "direction": "axial"
    }
  ],
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "tolerance": 1e-5,
    "surface": { "type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704 }
  }
}
```

El círculo fijo de V047a trunca la masa, así que cada método trae la nota `truncated_mass`. Bishop con el anclaje da
1,3338 frente al 1,333661 de cSlope (fila 1 de F4.13).

### Un fragmento por tipo

Cada bloque sustituye a `reinforcements` en el ejemplo anterior. Todos convergen, y `fos` es el de Bishop, Spencer y
Janbu corregido.

**`anchor` con `bond` y `bonded_length`.** Un tirante de (36; 28) a (63; 28): tramo libre de 17 m y bulbo de los
últimos 10 m, con la placa de cabeza `end1_capacity` igual a `tensile_capacity`. El cruce, en x = 42,31, cae en el
tramo libre y toma la capacidad de la placa:

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.6017,spencer:1.5945,janbu_corrected:1.5670 fuerzas=applied -->
```json
[
  {
    "type": "anchor", "id": "T1", "application": "active",
    "x1": 36, "y1": 28, "x2": 63, "y2": 28,
    "tensile_capacity": 150, "end1_capacity": 150, "direction": "axial",
    "pullout": { "model": "bond", "strength": 20, "bonded_length": 10 }
  }
]
```

**El mismo tirante sin `end1_capacity`.** El tramo libre no transmite carga: `T(s_c) = 0`, el cruce queda con el estado
`no_capacity` en `reinforcement_forces`, **no hay nota** y el FS es el del talud sin refuerzo (Bishop 0,9851):

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:0.9851,spencer:0.9841,janbu_corrected:0.9884 fuerzas=no_capacity -->
```json
[
  {
    "type": "anchor", "id": "T1", "application": "active",
    "x1": 36, "y1": 28, "x2": 63, "y2": 28,
    "tensile_capacity": 150, "direction": "axial",
    "pullout": { "model": "bond", "strength": 20, "bonded_length": 10 }
  }
]
```

**`nail` pasivo con `bond`.** Adherencia de 30 kN/m en todo el elemento; el tope de 150 kN gobierna (fila 3 de
F4.13: Bishop 1,375819 en cSlope):

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.3760,spencer:1.3725,janbu_corrected:1.3799 fuerzas=applied -->
```json
[
  {
    "type": "nail", "id": "N1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 150, "direction": "axial",
    "pullout": { "model": "bond", "strength": 30 }
  }
]
```

**`geosynthetic` pasivo con `interface` y dirección `tangent`.** La fuerza va opuesta al movimiento en la base, no a lo
largo del elemento, así que `fy` es distinta de cero en el informe (fila 5 de F4.13, Bishop 1,139869 en cSlope). Con
este perfil, la nota `negative_effective_normal` aparece en algunos métodos:

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.1396,spencer:1.1374,janbu_corrected:1.1426 fuerzas=applied -->
```json
[
  {
    "type": "geosynthetic", "id": "G1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 60, "direction": "tangent",
    "pullout": { "model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 1 }
  }
]
```

**`geosynthetic` con `development`.** Rampa de 10 m en cada extremo: en la estación 9,69 m la capacidad es 96,88 kN/m,
por debajo de los 100 del tope:

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.2405,spencer:1.2377,janbu_corrected:1.2445 fuerzas=applied -->
```json
[
  {
    "type": "geosynthetic", "id": "G1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 100, "direction": "axial",
    "pullout": { "model": "development", "length1": 10, "length2": 10 }
  }
]
```

**`pile`.** Un pilote activo de 60 kN con espaciamiento de 1,5 m (40 kN por metro de muro), de (40; 33) a (40; 22),
con fuerza horizontal (`angle` 0). Trae la nota `structural_checks_not_covered` (fila 7 de F4.13, Bishop 1,108256 en
cSlope):

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.1083,spencer:1.1060,janbu_corrected:1.1016 fuerzas=applied avisos=structural_checks_not_covered -->
```json
[
  {
    "type": "pile", "id": "P1", "application": "active",
    "x1": 40, "y1": 33, "x2": 40, "y2": 22,
    "force": 60, "spacing": 1.5, "direction": "angle", "angle": 0
  }
]
```

**`sheet_pile`.** La misma geometría con 120 kN por metro de muro, sin `spacing` (fila 11 de F4.13, Bishop 1,455483 en
cSlope):

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.4557,spencer:1.4490,janbu_corrected:1.4096 fuerzas=applied avisos=structural_checks_not_covered -->
```json
[
  {
    "type": "sheet_pile", "id": "S1", "application": "active",
    "x1": 40, "y1": 33, "x2": 40, "y2": 22,
    "force": 120, "direction": "angle", "angle": 0
  }
]
```

**Dirección `bisector`.** Un anclaje activo que baja 30° hacia el macizo desde (36; 28). Con `axial` la fuerza es
(86,6; −50,0) y con `bisector` es (99,5; −10,0), la bisectriz entre el eje y la dirección opuesta al movimiento
(X17 §4.4):

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.3555,spencer:1.3500,janbu_corrected:1.3154 fuerzas=applied -->
```json
[
  {
    "type": "anchor", "id": "A1", "application": "active",
    "x1": 36, "y1": 28, "x2": 59.382686, "y2": 14.5,
    "tensile_capacity": 100, "direction": "bisector"
  }
]
```

**Pasivo comprimido.** Un clavo vertical pasivo cruza la superficie con `along` de +0,44 (X17 §1.4), más allá de la normal: no
aporta (`compression_ignored`), el FS es el del talud sin refuerzo y el informe trae la nota
`reinforcement_compression_ignored`:

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:0.9851,spencer:0.9841,janbu_corrected:0.9884 fuerzas=compression_ignored avisos=reinforcement_compression_ignored -->
```json
[
  {
    "type": "nail", "id": "N1", "application": "passive",
    "x1": 42, "y1": 31, "x2": 42, "y2": 22,
    "tensile_capacity": 100, "direction": "axial"
  }
]
```

**Activo comprimido.** El mismo clavo, activo, se aplica **con su fuerza completa y axial** (E14m-1): 100 kN hacia
abajo, que empeora el talud (Bishop 0,9601 frente a 0,9851):

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:0.9601,spencer:0.9594,janbu_corrected:0.9675 fuerzas=applied -->
```json
[
  {
    "type": "nail", "id": "N1", "application": "active",
    "x1": 42, "y1": 31, "x2": 42, "y2": 22,
    "tensile_capacity": 100, "direction": "axial"
  }
]
```

#### Un activo comprimido puede subir el FS

Sobre el círculo del ejemplo, un anclaje activo de 100 kN con el eje girado 2° pasada la normal a la base (`along`
= +0,035), centrado en el cruce (40; 26,973), da **más** FS que el talud sin refuerzo, en vez de menos: Bishop 1,0696
frente a 0,9851 y Spencer 1,0679 frente a 0,9841 (R11A-08). La fuerza se aplica completa y axial, y su componente
normal, que confina la base, pesa más que la tangencial mientras `0 < θ < atan(tan φ / F)`. En este círculo, con φ de
19,6°, el FS sigue por encima del que no tiene refuerzo hasta cerca de θ = 20° (Bishop 1,0546 en 5°, 1,0307 en 10° y
1,0072 en 15°; en 20° ya baja a 0,9846).

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.0696,spencer:1.0679 fuerzas=applied -->
```json
[
  {
    "type": "anchor", "id": "A1", "application": "active",
    "x1": 38.3381, "y1": 31.6891, "x2": 41.6619, "y2": 22.2577,
    "tensile_capacity": 100, "direction": "axial"
  }
]
```

Si un activo queda del lado empujado, compruebe su orientación y la carga de bloqueo: el pretensado se supone que no se
relaja.

**Fuera de la masa.** Un anclaje en terreno estable, sin cruces con la superficie, no cambia el FS y trae la nota
`reinforcement_outside_mass`:

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:0.9851,spencer:0.9841,janbu_corrected:0.9884 fuerzas=ninguna avisos=reinforcement_outside_mass -->
```json
[
  {
    "type": "anchor", "id": "A1", "application": "active",
    "x1": 60, "y1": 30, "x2": 66, "y2": 30,
    "tensile_capacity": 100, "direction": "axial"
  }
]
```

### Ejemplo completo: una tablestaca anclada

Una tablestaca anclada es una `sheet_pile` vertical (x = 40, de y = 33 a y = 22, pasiva, 120 kN por metro de muro) más
un `anchor` activo con la cabeza en el muro, (40; 29), y la punta 24 m dentro del macizo, en (64; 22,8). El tirante
tiene `tensile_capacity` y `end1_capacity` de 300 kN, un `spacing` de 2,5 m y un bulbo `bond` de 20 kN/m en los últimos
10 m: el bulbo da 200 kN, que gobierna, y `T(s_c)` es 80 kN por metro de muro.

<!-- ogs-ejemplo nombre=tablestaca-anclada estado=converged fos=bishop:1.5980,spencer:1.5921,morgenstern_price:1.5923,janbu_simplified:1.5089,janbu_corrected:1.5777 fuerzas=applied,applied avisos=structural_checks_not_covered -->
```json
{
  "format": "opengeoslide",
  "version": "0.4",
  "meta": { "id": "ejemplo-tablestaca-anclada", "title": "ACADS 1(a) con una tablestaca anclada" },
  "units": "SI",
  "materials": [
    { "id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6 }
  ],
  "regions": [
    { "material": "suelo", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }
  ],
  "reinforcements": [
    {
      "type": "sheet_pile", "id": "tablestaca", "application": "passive",
      "x1": 40, "y1": 33, "x2": 40, "y2": 22,
      "force": 120, "direction": "angle", "angle": 0
    },
    {
      "type": "anchor", "id": "tirante", "application": "active",
      "x1": 40, "y1": 29, "x2": 64, "y2": 22.8,
      "tensile_capacity": 300, "end1_capacity": 300, "spacing": 2.5, "direction": "axial",
      "pullout": { "model": "bond", "strength": 20, "bonded_length": 10 }
    }
  ],
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "tolerance": 1e-5,
    "surface": { "type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704 }
  }
}
```

Cada elemento aporta su fuerza en su cruce. Con Bishop, el talud sin refuerzos da 0,9851; con solo la tablestaca,
1,3120; con solo el tirante, 1,2191; y con los dos, 1,5980. Los dos bloques siguientes sustituyen a `reinforcements`
del ejemplo y dan esos FS parciales:

<!-- ogs-fragmento base=tablestaca-anclada ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.3120,spencer:1.3083,janbu_corrected:1.3037 fuerzas=applied avisos=structural_checks_not_covered -->
```json
[
  {
    "type": "sheet_pile", "id": "tablestaca", "application": "passive",
    "x1": 40, "y1": 33, "x2": 40, "y2": 22,
    "force": 120, "direction": "angle", "angle": 0
  }
]
```

<!-- ogs-fragmento base=tablestaca-anclada ruta=reinforcements esperado=ok esquema=acepta estado=converged fos=bishop:1.2191,spencer:1.2161,janbu_corrected:1.2156 fuerzas=applied -->
```json
[
  {
    "type": "anchor", "id": "tirante", "application": "active",
    "x1": 40, "y1": 29, "x2": 64, "y2": 22.8,
    "tensile_capacity": 300, "end1_capacity": 300, "spacing": 2.5, "direction": "axial",
    "pullout": { "model": "bond", "strength": 20, "bonded_length": 10 }
  }
]
```

**Esto es estabilidad global, no el diseño de un muro.** El FS incluye las dos fuerzas en el equilibrio de la masa que
desliza. La tablestaca de este ejemplo tiene fuerza dada: OpenGeoSlide no comprueba que el perfil resista esa fuerza,
ni que su empotramiento, el momento flector, la deflexión, el tirante ni el bulbo cumplan las comprobaciones de un
muro anclado. Esa verificación es del proyectista.

### El informe: `reinforcement_forces`

Cada `MethodResult` converged trae `reinforcement_forces`, que se omite si está vacío. Se emite solo para los métodos
convergidos y sobre la **superficie final**, no para cada candidato de una búsqueda. El de la tablestaca anclada:

```json
"reinforcement_forces": [
  { "id": "tablestaca", "crossing": 0, "x": 40.0, "y": 26.9734, "station": 6.0266,
    "available": 120.0, "fx": 120.0, "fy": 0.0, "application": "passive", "status": "applied" },
  { "id": "tirante", "crossing": 0, "x": 42.8355, "y": 28.2675, "station": 2.9286,
    "available": 80.0, "fx": 77.4571, "fy": -20.0098, "application": "active", "status": "applied" }
]
```

| Campo | Significado |
|---|---|
| `id`, `crossing` | El refuerzo y el índice del cruce (un elemento que cruza dos veces da dos entradas) |
| `x`, `y`, `station` | El cruce y su estación `s_c` desde la cabeza |
| `available` | `T(s_c)` por metro (el tirante: 200/2,5 = 80), o la fuerza del pilote por metro de muro |
| `fx`, `fy` | La fuerza **aplicada** por metro, en coordenadas del modelo (y hacia arriba). En un pasivo es la fuerza disponible, **antes de dividir por F**: se moviliza dividida por F |
| `application` | `active` o `passive` |
| `status` | Ver la tabla siguiente |

| `status` | Cuándo |
|---|---|
| `applied` | La fuerza actúa sobre la dovela del cruce |
| `outside_mass` | El cruce cae en el aire o en un bloque descartado por truncamiento |
| `compression_ignored` | Un pasivo de tracción con `along ≥ cos 88°` |
| `no_capacity` | `T(s_c) = 0` (el caso típico es el tramo libre de un tirante sin `end1_capacity`). No emite nota |

**Notas nuevas** del bloque (informativas; entran en la lista E6 de `briefs/00_CONTRATOS.md` y en
`apps/web/src/engine/warnings.ts`):

| Código | Cuándo |
|---|---|
| `reinforcement_outside_mass` | Algún refuerzo no tiene cruces con la superficie, o todos sus cruces quedan fuera de la masa |
| `reinforcement_compression_ignored` | Algún cruce queda en `compression_ignored` |
| `reinforcement_active_compression` | Un refuerzo **activo** se aplica con su fuerza aunque el deslizamiento lo comprimiría (`along > 0`). Nota informativa: «Un refuerzo activo se aplica con su fuerza aunque el deslizamiento lo comprimiría; en suelos con fricción esa fuerza puede aumentar el FS. Verifique la orientación y la carga de bloqueo.» |
| `structural_checks_not_covered` | Hay un `pile` o una `sheet_pile` en el modelo, lo crucen o no |

### Rechazos de los refuerzos

El motor responde `InvalidModel`, con la **ruta JSON** del campo (código de salida 2). Cada bloque sustituye a
`reinforcements` en el ejemplo del anclaje:

| Caso | Mensaje del motor | ¿Lo rechaza el esquema? |
|---|---|---|
| `coverage` fuera de (0, 1] | `reinforcements[0].pullout.coverage debe estar en (0, 1], no 1.5` | sí |
| `location` en un pilote | ``unknown field `location` `` (campo desconocido) | sí |
| `angle` con `direction: "tangent"` | `reinforcements[0].angle solo se admite con direction "angle", no con "tangent"` | sí |
| `direction: "angle"` sin `angle` | `reinforcements[0].angle es obligatorio con direction "angle"` | sí |
| sin `application` | ``missing field `application` `` | sí |
| `spacing` igual a 0 | `reinforcements[0].spacing debe ser finito y mayor que 0, no 0` | sí |
| `tensile_capacity` negativa | `reinforcements[0].tensile_capacity debe ser finito y mayor o igual que 0, no -5` | sí |
| `friction_angle` igual a 90 | `reinforcements[0].pullout.friction_angle debe estar en [0, 90) grados, no 90` | sí |
| `spacing` en una `sheet_pile` | ``unknown field `spacing` `` | sí |
| `id` repetido | `reinforcements[1].id: el id 'N1' está repetido` | no (solo el motor) |
| tablestaca inclinada | `reinforcements[0].x2 debe ser igual a x1 (la tablestaca es vertical), no 41 frente a 40` | no (solo el motor) |
| `bonded_length` mayor que `L` | `reinforcements[0].pullout.bonded_length debe ser menor o igual que la longitud del elemento 27, no 40` | no (solo el motor) |
| longitud 0 | `reinforcements[0] tiene longitud 0: (x1, y1) y (x2, y2) coinciden` | no (solo el motor) |

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:reinforcements[0].pullout.coverage~debe~estar~en~(0,~1],~no~1.5 esquema=rechaza -->
```json
[
  {
    "type": "geosynthetic", "id": "G1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 60, "direction": "tangent",
    "pullout": { "model": "interface", "adhesion": 10, "friction_angle": 20, "coverage": 1.5 }
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:unknown~field~`location` esquema=rechaza -->
```json
[
  {
    "type": "pile", "id": "P1", "application": "active",
    "x1": 40, "y1": 33, "x2": 40, "y2": 22,
    "force": 60, "direction": "angle", "angle": 0, "location": "centroid"
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:reinforcements[0].angle~solo~se~admite~con~direction~"angle" esquema=rechaza -->
```json
[
  {
    "type": "pile", "id": "P1", "application": "active",
    "x1": 40, "y1": 33, "x2": 40, "y2": 22,
    "force": 60, "direction": "tangent", "angle": 10
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:reinforcements[0].angle~es~obligatorio~con~direction~"angle" esquema=rechaza -->
```json
[
  {
    "type": "pile", "id": "P1", "application": "active",
    "x1": 40, "y1": 33, "x2": 40, "y2": 22,
    "force": 60, "direction": "angle"
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:missing~field~`application` esquema=rechaza -->
```json
[
  {
    "type": "nail", "id": "N1",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 100, "direction": "axial"
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:reinforcements[0].spacing~debe~ser~finito~y~mayor~que~0 esquema=rechaza -->
```json
[
  {
    "type": "nail", "id": "N1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 100, "spacing": 0, "direction": "axial"
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:reinforcements[0].pullout.friction_angle~debe~estar~en~[0,~90)~grados esquema=rechaza -->
```json
[
  {
    "type": "geosynthetic", "id": "G1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 60, "direction": "axial",
    "pullout": { "model": "interface", "adhesion": 1, "friction_angle": 90, "coverage": 1 }
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:unknown~field~`spacing` esquema=rechaza -->
```json
[
  {
    "type": "sheet_pile", "id": "S1", "application": "active",
    "x1": 40, "y1": 33, "x2": 40, "y2": 22,
    "force": 120, "spacing": 2, "direction": "tangent"
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:reinforcements[1].id:~el~id~'N1'~está~repetido esquema=acepta -->
```json
[
  {
    "type": "nail", "id": "N1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 100, "direction": "axial"
  },
  {
    "type": "nail", "id": "N1", "application": "passive",
    "x1": 52, "y1": 26, "x2": 25, "y2": 26,
    "tensile_capacity": 100, "direction": "axial"
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:debe~ser~igual~a~x1~(la~tablestaca~es~vertical) esquema=acepta -->
```json
[
  {
    "type": "sheet_pile", "id": "S1", "application": "active",
    "x1": 40, "y1": 33, "x2": 41, "y2": 22,
    "force": 120, "direction": "tangent"
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:pullout.bonded_length~debe~ser~menor~o~igual~que~la~longitud~del~elemento esquema=acepta -->
```json
[
  {
    "type": "nail", "id": "N1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 25, "y2": 28,
    "tensile_capacity": 100, "direction": "axial",
    "pullout": { "model": "bond", "strength": 20, "bonded_length": 40 }
  }
]
```

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=reinforcements esperado=error:tiene~longitud~0 esquema=acepta -->
```json
[
  {
    "type": "nail", "id": "N1", "application": "passive",
    "x1": 52, "y1": 28, "x2": 52, "y2": 28,
    "tensile_capacity": 100, "direction": "axial"
  }
]
```

Con `version` menor que 0.4, el motor rechaza el uso de `reinforcements` (el esquema también). Este bloque cambia
`version` a `"0.3"` en el ejemplo del anclaje:

<!-- ogs-fragmento base=refuerzos-ancla-activa ruta=version esperado=error:reinforcements~requiere~version~"0.4" esquema=rechaza -->
```json
"0.3"
```

## Agua embalsada (todas las versiones)

Cuando la línea piezométrica pasa **sobre el terreno** (un embalse al pie del talud, un río, una presa), el motor
incluye el agua libre **sin ningún campo nuevo y en todas las versiones del formato**, como hacen Slide2, SLOPE/W y
cSlope: el agua entre la piezométrica y el terreno carga las dovelas con su peso y con su empuje. Antes de la v0.5
(sin publicar), el motor contaba la presión de poros con la carga completa, pero ni el peso ni el empuje del agua, y el
FS salía muy bajo.

Las convenciones (E15c):

- **Región.** El agua libre es la región entre la piezométrica y el terreno donde `piezométrica > terreno`. Abarca
  **todo el modelo**, no solo la masa de la superficie evaluada.
- **Peso.** Por dovela y por tramo recto del terreno, partido en los vértices del terreno y de la piezométrica y en
  sus cruces: `V = γw·∫h dx`, con `h` la altura de agua sobre el terreno. Es vertical, hacia abajo, y actúa en la
  parte superior de la dovela.
- **Empuje.** `H = γw·∫h·y′ dx`, con `y′` la pendiente del terreno: horizontal, igual a la pendiente por el peso, y
  tomado en el sentido del deslizamiento. Los momentos de `V` y `H` se calculan exactos, con Gauss de 3 puntos.
- **Cara de presa.** Si el terreno tiene un paramento vertical bajo el agua, su empuje es
  `½·γw·[(yw − ya)² − (yw − yb)²]`: horizontal, en el centroide de la presión y hacia el lado del suelo. Solo cuenta la
  parte sobre la superficie de deslizamiento (`ya` es el mayor entre el pie y la base en la cara, `yb` el menor entre
  el nivel del agua y la cabeza) y lo recibe la dovela cuyo borde es el paramento, del lado alto.
- **Presión de poros en la base.** Vale `γw·max(0, piezométrica − y_base)` en el punto medio de la base, sin recortar
  al terreno, como antes.
- **Sin sismo.** `kh` y `kv` no actúan sobre el agua: ni `kh·V` ni `kv·V`.
- **Material con `ru`.** `ru` sigue reemplazando a la piezométrica, con `u = ru·(W + V)/b`: `W` es el peso del suelo
  de la dovela y `V` el del agua embalsada que tiene encima, **sin** cargas externas ni sismo. El agua embalsada sigue
  cargando la dovela con su peso y su empuje. Esta regla es la de Slide2 y no se puede comparar con el oráculo
  ([Limitaciones](limitaciones.md#agua-embalsada-con-ru-sin-oráculo)). El `σ′v` del arrancamiento `interface` de un
  material con `ru` **no** cuenta el agua libre (E14o-4), de modo que con refuerzos no hay doble conteo.
- **γw** es `water.unit_weight` (9,81 por defecto; en unidades imperiales debe ser explícito,
  [Limitaciones](limitaciones.md#avisos-geotécnicos-de-la-aplicación)).
- **Profundidad bajo la tolerancia.** Una profundidad de agua menor o igual que `1e-9·escala` (la tolerancia del
  modelo) se toma como 0: una piezométrica que **toca** el terreno, como la freática que termina en el talud, no añade
  términos.
- **El aviso `water_above_ground`** se conserva con el mismo nombre, como **nota informativa**: «La piezométrica queda
  sobre el terreno: el agua embalsada se incluye con su peso y su empuje horizontal (sin sismo).»

### Ejemplo: un embalse al pie

ACADS 1(a) (V047a) con el círculo fijo de su búsqueda y 2 m de agua sobre el banco del pie: la piezométrica es
horizontal en y = 27 y toca el talud en x = 34. El ejemplo declara la versión `"0.3"` a propósito: el agua embalsada no
depende de la versión.

<!-- ogs-ejemplo nombre=embalse-al-pie estado=converged fos=bishop:0.9392,spencer:0.9387,morgenstern_price:0.9386,janbu_simplified:0.9038,janbu_corrected:0.9451 avisos=water_above_ground,truncated_mass grieta=ninguna -->
```json
{
  "format": "opengeoslide",
  "version": "0.3",
  "meta": { "id": "ejemplo-embalse", "title": "ACADS 1(a) con 2 m de agua al pie" },
  "units": "SI",
  "materials": [
    { "id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6 }
  ],
  "regions": [
    { "material": "suelo", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }
  ],
  "water": { "unit_weight": 9.81, "piezometric_line": [[20, 27], [70, 27]] },
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "tolerance": 1e-5,
    "surface": { "type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704 }
  }
}
```

Medido con `ogs analyze` (las cifras son FS a 4 decimales):

| Método | Sin agua | Con 2 m de agua, v0.3.0 (sin peso ni empuje) | Con 2 m de agua, ahora |
|---|---:|---:|---:|
| Bishop | 0,9851 | 0,8481 | 0,9392 |
| Spencer | 0,9841 | 0,8475 | 0,9387 |
| Morgenstern-Price | 0,9841 | 0,8476 | 0,9386 |
| Janbu simplificado | 0,9453 | 0,8260 | 0,9038 |
| Janbu corregido | 0,9884 | 0,8637 | 0,9451 |

El agua sobre el pie **baja** el FS respecto del talud seco (0,9851 a 0,9392 en Bishop; el efecto neto de la presión de
poros en la base, del peso y del empuje del agua), pero menos que antes, cuando solo contaba la presión de poros. En la versión 0.3.0 este modelo traía
además la nota `negative_effective_normal`; ahora ya no la trae. La nota `water_above_ground` sigue en los cinco
métodos.

El mismo modelo con `"version": "0.5"` da las mismas cifras:

<!-- ogs-fragmento base=embalse-al-pie ruta=version esperado=ok esquema=acepta estado=converged fos=bishop:0.9392,spencer:0.9387,morgenstern_price:0.9386,janbu_simplified:0.9038,janbu_corrected:0.9451 avisos=water_above_ground grieta=ninguna -->
```json
"0.5"
```

Una piezométrica que no sube sobre el terreno no agrega ningún término: la salida es la de la v0.3.0, byte a byte.

## Grieta de tracción (v0.5)

`analysis.tension_crack` agrega una grieta vertical de tracción en la coronación, seca o con agua. Exige
`"version": "0.5"`. La grieta **trunca cada superficie**: el motor la ubica sobre esa superficie, quita la masa que
queda del lado de la cresta y deja una cara vertical sin resistencia.

```json
"analysis": { "tension_crack": { "depth": 2.0, "water_fill": 1.0 } }
```

| Campo | Significado | Rango |
|---|---|---|
| `depth` | profundidad de la grieta, en la unidad de longitud del modelo, o la cadena `"auto"` | número finito > 0, o `"auto"` |
| `water_fill` | fracción de la grieta llena de agua: 0 = seca, 1 = llena. **Obligatoria, sin valor por defecto** | en [0, 1] |

- **Solo un objeto**, no una lista, y **sin campo de posición**: la `x` de la grieta sale de la superficie y de la
  profundidad.
- **Posición (G1).** `x_c` es el primer punto, desde la entrada del lado de la cresta, donde
  `terreno(x) − base(x) ≥ profundidad`: un barrido de 200 pasos seguido de bisección. Si la superficie **nunca** llega
  a esa profundidad, no tiene masa: en una superficie fija es `NoValidSurface: tension_crack_not_reached` (con un
  mensaje que lo explica), y en una búsqueda el candidato se descarta (G9).
- **Masa (G2).** Se quitan todas las dovelas del lado de la cresta de `x_c`, y esa masa **no** se conserva como carga.
  La masa termina en una cara vertical. Las comprobaciones de los extremos del bloque (que el arco no salga del modelo,
  la tangente vertical sobre el terreno) se aplican a la **masa truncada**, cuyo extremo de la cresta es
  `(x_c, base(x_c))`.
- **Agua en la grieta (G3).** `Pw = ½·γw·hw²`, con `hw = profundidad·water_fill`. Es horizontal, va **en el sentido del
  deslizamiento** y actúa a `base(x_c) + hw/3`, sobre la dovela adyacente a la cara. Con `water_fill = 0`, `Pw` vale 0.
  No hace falta piezométrica: la grieta usa `water.unit_weight` si está y, si no, el γw del modelo (9,81 en SI). El agua
  de la grieta no cambia la presión de poros de la base ni pesa, y la cara no tiene resistencia (G4). El sismo no actúa
  sobre `Pw` (E7).
- **Profundidad automática (G6).** Con `"auto"`, la profundidad de Rankine, en cada `x`:
  `z(x) = max(0, 2c/(γ·tan(45° − φ/2)) − q/γ)`.
  - `c`, `φ` y `γ` son los del material **bajo el terreno en `x`**, y se recalculan en cada `x`. En un material
    **no drenado**, `c` es Su en ese punto y `φ` = 0, de modo que `z = 2·Su/γ` (G7).
  - `q` suma las sobrecargas `udl` que cubren `x` y la columna de agua embalsada en `x`, `γw·(piezo − terreno)`.
  - Si `z` vale 0 en la entrada (por ejemplo, `c = 0`), no se corta nada: el informe trae la grieta con
    `depth = 0` y `water_force = 0`, y el FS es el de la superficie sin grieta.
- **No hay tope de profundidad** por la altura del talud (G8): una grieta más profunda que el talud es un dato suyo.
- **Búsqueda (G9).** Un candidato que no alcanza la grieta **se descarta**, y si se descartan todos, `NoValidSurface`.
- **Polilíneas.** El truncado se aplica después del ajuste de la polilínea al terreno. Bishop sigue sin ofrecerse en
  ellas.
- **Refuerzos.** Un cruce que queda del lado de la cresta de `x_c` queda fuera de la masa: nota
  `reinforcement_outside_mass`.
- **El FS no es monótono con la profundidad** de una grieta **seca**: el signo depende del bloque que se quita (su peso
  motriz y la resistencia de su base). Sí baja con `water_fill`, y con `depth → 0` tiende al FS de la superficie sin
  grieta.

### Errores

Todos son `InvalidModel`, con la ruta del campo:

| Caso | Mensaje |
|---|---|
| `depth` o `water_fill` ausente, `null` o de otro tipo | `analysis.tension_crack.<campo> es obligatorio` (o `debe ser …`) |
| `depth` ≤ 0 o no finito | `analysis.tension_crack.depth debe ser finito y mayor que 0 (o "auto")` |
| `water_fill` fuera de [0, 1] o no finito | `analysis.tension_crack.water_fill debe ser finito y estar en [0, 1]` |
| un campo desconocido (por ejemplo `x`) o una lista | `unknown field …` o `invalid type: sequence, expected un objeto analysis.tension_crack con depth y water_fill` |
| `version` menor que `"0.5"` | `tension_crack requiere version "0.5"` |

### La salida

Cada resultado cuya superficie se truncó lleva `tension_crack: { x, depth, water_force }`: la `x` de la grieta
(`x_c`), su profundidad y `Pw`. Se omite cuando no hay grieta.

### Ejemplos: grieta seca, llena y automática

El mismo ACADS 1(a) y su círculo fijo, sin agua, con una grieta seca de 2 m. La grieta cae en x = 48,7109. Con la
grieta seca el FS **sube** (la masa que se quita empujaba), de 0,9851 a 1,0263 en Bishop:

<!-- ogs-ejemplo nombre=grieta-seca estado=converged fos=bishop:1.0263,spencer:1.0256,morgenstern_price:1.0257,janbu_simplified:0.9899,janbu_corrected:1.0291 avisos=truncated_mass grieta=x:48.7109,depth:2.0,water_force:0.0 -->
```json
{
  "format": "opengeoslide",
  "version": "0.5",
  "meta": { "id": "ejemplo-grieta", "title": "ACADS 1(a) con una grieta de tracción seca de 2 m" },
  "units": "SI",
  "materials": [
    { "id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 3.0, "friction_angle": 19.6 }
  ],
  "regions": [
    { "material": "suelo", "polygon": [[20, 20], [20, 25], [30, 25], [50, 35], [70, 35], [70, 20]] }
  ],
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "tolerance": 1e-5,
    "tension_crack": { "depth": 2.0, "water_fill": 0.0 },
    "surface": { "type": "circle", "xc": 29.54334963719809, "yc": 53.63784815923435, "r": 28.641487934160704 }
  }
}
```

**Grieta llena.** Con `water_fill = 1` la grieta tiene 2 m de agua: `Pw = ½·9,81·2² = 19,62` por metro de talud, y el FS
**baja** de 1,0263 a 0,9795 en Bishop (por debajo del de la superficie sin grieta, 0,9851):

<!-- ogs-fragmento base=grieta-seca ruta=analysis.tension_crack esperado=ok esquema=acepta estado=converged fos=bishop:0.9795,spencer:0.9785,morgenstern_price:0.9788,janbu_simplified:0.9352,janbu_corrected:0.9722 avisos=truncated_mass grieta=x:48.7109,depth:2.0,water_force:19.62 -->
```json
{ "depth": 2.0, "water_fill": 1.0 }
```

**Grieta automática.** Con `"auto"`, la profundidad es la de Rankine: con c = 3, φ = 19,6° y γ = 20,
`z = 2·3/(20·tan(45° − 9,8°)) = 0,4253 m`. La grieta cae en x = 50,9193 y, llena, `Pw` vale 0,8871:

<!-- ogs-fragmento base=grieta-seca ruta=analysis.tension_crack esperado=ok esquema=acepta estado=converged fos=bishop:0.9814,spencer:0.9804,morgenstern_price:0.9805,janbu_simplified:0.9405,janbu_corrected:0.9826 avisos=truncated_mass grieta=x:50.9193,depth:0.4253,water_force:0.8871 -->
```json
{ "depth": "auto", "water_fill": 1.0 }
```

**Rechazos.** Cada uno cambia un campo del ejemplo `grieta-seca`. Sin `water_fill`, que es obligatorio:

<!-- ogs-fragmento base=grieta-seca ruta=analysis.tension_crack esperado=error:analysis.tension_crack.water_fill~es~obligatorio esquema=rechaza -->
```json
{ "depth": 2.0 }
```

Con una profundidad de 0:

<!-- ogs-fragmento base=grieta-seca ruta=analysis.tension_crack esperado=error:analysis.tension_crack.depth~debe~ser~finito~y~mayor~que~0 esquema=rechaza -->
```json
{ "depth": 0, "water_fill": 0.0 }
```

Con una fracción fuera de [0, 1]:

<!-- ogs-fragmento base=grieta-seca ruta=analysis.tension_crack esperado=error:analysis.tension_crack.water_fill~debe~ser~finito~y~estar~en~[0,~1] esquema=rechaza -->
```json
{ "depth": 2.0, "water_fill": 1.5 }
```

Con `version` `"0.4"`:

<!-- ogs-fragmento base=grieta-seca ruta=version esperado=error:tension_crack~requiere~version~"0.5" esquema=rechaza -->
```json
"0.4"
```

Con una profundidad que el círculo fijo no alcanza (20 m), el modelo es válido pero la superficie no tiene masa:

<!-- ogs-fragmento base=grieta-seca ruta=analysis.tension_crack esperado=error:NoValidSurface:~tension_crack_not_reached esquema=acepta -->
```json
{ "depth": 20.0, "water_fill": 0.0 }
```

## Qué valida el esquema y qué solo el motor

El esquema y el binario `ogs` aceptan y rechazan los mismos documentos, salvo las reglas que JSON Schema no puede
expresar y que valida solo el motor:

- material de cada región existente, ids de material y de carga únicos;
- `x1 < x2` en cada `udl` y la `x` de cada carga dentro del rango del modelo;
- polígonos simples, sin solapes ni áreas degeneradas;
- piezométrica con x estrictamente creciente;
- rangos `entry` y `exit` con `lo ≤ hi` y dentro del modelo, y `n_entry·n_exit·n_radius ≤ 2 000 000`;
- **x estrictamente creciente** (con separación de al menos `1e-9` por el ancho del modelo) en una polilínea;
- **puntos de `interslice.data_points`**: ξ estrictamente creciente de 0 a 1, f ≥ 0 y algún f > 0;
- **refuerzos**: `id` único, longitud `L > 0`, `x1 = x2` en una `sheet_pile` y `bonded_length ≤ L`.

## Cómo se validan los ejemplos

Cada bloque `json` de esta página precedido por un comentario `ogs-ejemplo` u `ogs-fragmento` se prueba con
[`docs/tools/validar_ejemplos.py`](tools/validar_ejemplos.py): los ejemplos completos contra
`schema/ogs-0.5.schema.json` y con `ogs analyze` (estado de cada método y, donde se cita, el FS a 4 decimales, los
`status` de `reinforcement_forces`, los avisos y el objeto `tension_crack` del informe); los fragmentos, sustituidos en su ejemplo base, con el resultado
esperado del motor y del esquema.

```sh
cargo build --release -p ogs-cli
env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema \
  python docs/tools/validar_ejemplos.py
```
