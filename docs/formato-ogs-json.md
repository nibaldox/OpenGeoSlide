# Formato `.ogs.json` (v0.1, v0.2 y v0.3)

Los modelos de OpenGeoSlide se guardan como `.ogs.json`. La web los abre y los guarda, la CLI y el paquete de Python
los leen. El motor acepta tres versiones:

| Versión | Agrega | Esquema |
|---|---|---|
| `"0.1"` | Mohr-Coulomb, círculo (fijo o búsqueda), Bishop y Spencer | [`schema/ogs-0.1.schema.json`](../schema/ogs-0.1.schema.json) |
| `"0.2"` | `loads` y `analysis.seismic` | [`schema/ogs-0.2.schema.json`](../schema/ogs-0.2.schema.json) |
| `"0.3"` | material **no drenado**, superficie **polilínea**, métodos **Morgenstern-Price** y **Janbu**, `analysis.interslice` | [`schema/ogs-0.3.schema.json`](../schema/ogs-0.3.schema.json) |

[`schema/ogs-0.3.schema.json`](../schema/ogs-0.3.schema.json) acepta las tres versiones. El ejemplo mínimo es
[`examples/acads1a.ogs.json`](../examples/acads1a.ogs.json).

- **Un modelo sin campos nuevos da el mismo resultado en las tres versiones**, bit a bit: `fos`, `status`,
  `iterations`, `lambda`, `warnings` y superficie.
- **Cada campo o variante de la versión 0.3 exige `"0.3"`** (véase [la compuerta de versión](#compuerta-de-versión)).
- **Los ángulos van en grados.** Las unidades no se convierten: deben ser coherentes entre sí.
- Todos los objetos rechazan campos desconocidos. Un `null` cuenta como campo ausente.

Los ejemplos de esta página se validan con el esquema y con `ogs analyze`
([cómo reproducirlo](#cómo-se-validan-los-ejemplos)).

## Estructura de un modelo v0.3

```
format, version, meta?, units?, materials[], regions[], water?, loads?, slope?, analysis
```

`analysis` agrega, respecto de v0.2, el campo `interslice` y el tipo `polyline` en `surface`:

```
analysis: { methods[], slices?, tolerance?, max_iterations?, min_m_alpha?, seismic?, interslice?, surface? | search? }
```

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

- Los vértices de la polilínea ajustada son **nodos obligatorios** del corte en dovelas, así que la base de cada
  dovela es recta.
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
  morgenstern_price o janbu`. En una polilínea, el FS de Bishop dependería del eje de momentos, un parámetro sin
  significado físico, y OpenGeoSlide no reporta un FS así. Con `analysis.search`, la superficie fija se ignora y la
  regla no aplica.
- **Spencer y M-P en una polilínea** toman momentos en los puntos medios de las bases: no necesitan eje. Su lazo de F
  parte del F₀ de Janbu simplificado (o de 1 si no converge), en lugar de Bishop.
- **Janbu simplificado** busca F₀, raíz del cierre de fuerzas por dovela con λ = 0 (sin ecuación de momento);
  `lambda` del informe vale `null`.
- **Janbu corregido** entrega `fos = f₀·F₀`, con
  `f₀ = 1 + b₁·(d/L − 1,4·(d/L)²)`. `L` es la cuerda entre los extremos del bloque de suelo, `d` la distancia máxima de
  la cuerda al punto medio de la base de cada dovela (positiva por debajo de la cuerda; si es ≤ 0, `f₀ = 1`) y `b₁` se elige una vez para el bloque:
  0,69 si hay cohesión y ninguna dovela con fricción (un material no drenado cuenta como solo cohesión), 0,31 si hay
  fricción y ninguna cohesión (o ninguna de las dos), y 0,50 si hay de las dos. La búsqueda minimiza el `fos`
  corregido.

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

Ambos campos opcionales se omiten cuando no aplican. Un resultado de `janbu_corrected` sobre el ejemplo de la
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

Los estados `Invalid` nuevos de F3a son `polyline_no_ground_crossing`, `polyline_outside_ground` y
`bishop_non_circular` (una defensa del solver, porque la validación ya impide Bishop con polilínea). Las demás
razones de estado son las de siempre.

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

Los fragmentos siguientes cambian `version` a `"0.2"` en los dos ejemplos de arriba:

<!-- ogs-fragmento base=terraplen-su-lineal ruta=version esperado=error:materials[1].model~=~"undrained"~requiere~version~"0.3" esquema=rechaza -->
```json
"0.2"
```

<!-- ogs-fragmento base=polilinea-mp-data-points ruta=version esperado=error:analysis.surface.type~=~"polyline"~requiere~version~"0.3" esquema=rechaza -->
```json
"0.2"
```

El esquema `ogs-0.3.schema.json` aplica la misma regla con un `if/then` por versión. **La web** guarda `"0.2"` si el
modelo no usa ningún campo de 0.3, y `"0.3"` solo si usa alguno; abre las tres versiones.

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

## Qué valida el esquema y qué solo el motor

El esquema y el binario `ogs` aceptan y rechazan los mismos documentos, salvo las reglas que JSON Schema no puede
expresar y que valida solo el motor:

- material de cada región existente, ids de material y de carga únicos;
- `x1 < x2` en cada `udl` y la `x` de cada carga dentro del rango del modelo;
- polígonos simples, sin solapes ni áreas degeneradas;
- piezométrica con x estrictamente creciente;
- rangos `entry` y `exit` con `lo ≤ hi` y dentro del modelo, y `n_entry·n_exit·n_radius ≤ 2 000 000`;
- **x estrictamente creciente** (con separación de al menos `1e-9` por el ancho del modelo) en una polilínea;
- **puntos de `interslice.data_points`**: ξ estrictamente creciente de 0 a 1, f ≥ 0 y algún f > 0.

## Cómo se validan los ejemplos

Cada bloque `json` de esta página precedido por un comentario `ogs-ejemplo` u `ogs-fragmento` se prueba con
[`docs/tools/validar_ejemplos.py`](tools/validar_ejemplos.py): los ejemplos completos contra
`schema/ogs-0.3.schema.json` y con `ogs analyze` (estado de cada método y, donde se cita, el FS a 4 decimales); los
fragmentos, sustituidos en su ejemplo base, con el resultado esperado del motor y del esquema.

```sh
cargo build --release -p ogs-cli
env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema \
  python docs/tools/validar_ejemplos.py
```
