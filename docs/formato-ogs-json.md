# Formato `.ogs.json` (v0.1 a v0.7)

Los modelos de OpenGeoSlide se guardan como `.ogs.json`. La web los abre y los guarda, la CLI y el paquete de Python
los leen. El motor acepta siete versiones:

| Versión | Agrega | Esquema |
|---|---|---|
| `"0.1"` | Mohr-Coulomb, círculo (fijo o búsqueda), Bishop y Spencer | [`schema/ogs-0.1.schema.json`](../schema/ogs-0.1.schema.json) |
| `"0.2"` | `loads` y `analysis.seismic` | [`schema/ogs-0.2.schema.json`](../schema/ogs-0.2.schema.json) |
| `"0.3"` | material **no drenado**, superficie **polilínea**, métodos **Morgenstern-Price** y **Janbu**, `analysis.interslice` | [`schema/ogs-0.3.schema.json`](../schema/ogs-0.3.schema.json) |
| `"0.4"` | **refuerzos** (`reinforcements`): anclajes, clavos, geosintéticos, pilotes y tablestacas, activos y pasivos | [`schema/ogs-0.4.schema.json`](../schema/ogs-0.4.schema.json) |
| `"0.5"` | **grieta de tracción** (`analysis.tension_crack`) y **presión de suelo de Ito-Matsui** en pilotes (`lateral_pressure`, `capacity`) | [`schema/ogs-0.5.schema.json`](../schema/ogs-0.5.schema.json) |
| `"0.6"` | materiales **Hoek-Brown** y **SHANSEP**, y **búsqueda no circular** (`analysis.search.non_circular`) | [`schema/ogs-0.6.schema.json`](../schema/ogs-0.6.schema.json) |
| `"0.7"` | **búsqueda global no circular** (`analysis.search.non_circular.global`) | [`schema/ogs-0.7.schema.json`](../schema/ogs-0.7.schema.json) |

[`schema/ogs-0.7.schema.json`](../schema/ogs-0.7.schema.json) acepta las siete versiones. El ejemplo mínimo es
[`examples/acads1a.ogs.json`](../examples/acads1a.ogs.json).

> **La v0.5 se publicó con la 0.4.0** (véase el [registro de cambios](../CHANGELOG.md#040---2026-11-27)). La 0.3.0,
> la versión anterior, llega hasta el formato v0.4 y no incluye la grieta de tracción ni el agua embalsada.
>
> **La v0.6 se publicó con la 0.5.0** (véase el [registro de cambios](../CHANGELOG.md#050---2026-11-27)). La 0.4.0 no lee
> los materiales `hoek_brown` y `shansep` ni `analysis.search.non_circular`.
>
> **La v0.7 aún no se publica.** La 0.5.1, la última versión publicada, llega hasta el formato v0.6 y no lee
> `analysis.search.non_circular.global` ([v0.7: búsqueda global no circular](#v07-búsqueda-global-no-circular)).

- **Un modelo sin campos nuevos da el mismo resultado en las siete versiones**, bit a bit: `fos`, `status`,
  `iterations`, `lambda`, `warnings` y superficie. Un modelo con `reinforcements` ausente o vacío es idéntico byte a byte
  a la salida de la v0.2.0, con **una sola excepción documentada**: un círculo cuyo arco termina con la tangente vertical
  sobre el terreno, que la v0.2.0 rechazaba por redondeo (V065), ahora se analiza ([Limitaciones](limitaciones.md#excepción-a-la-identidad-con-la-v020-círculos-con-la-tangente-vertical-v065)).
- **Un modelo sin `tension_crack` y con la piezométrica bajo el terreno da la misma salida, byte a byte, que la v0.3.0**
  (salvo el número de versión del motor, y con la excepción de γw en imperial que sigue). **Excepción documentada:** un modelo cuya piezométrica pasa **sobre el
  terreno** cambia de resultado en las seis versiones, porque ahora incluye el agua embalsada
  ([Agua embalsada](#agua-embalsada-todas-las-versiones) y
  [Limitaciones](limitaciones.md#excepción-a-la-identidad-con-la-v030-agua-sobre-el-terreno)). **Segunda excepción
  (E15j-8):** en V019 con búsqueda solo cambian los contadores `search.evaluated` y `search.valid`
  ([Limitaciones](limitaciones.md#segunda-excepción-a-la-identidad-con-la-v030-contacto-de-aire-capilar-v019-e15j-8)).
  **Tercera excepción (E15l-6, E15m-6):** un archivo `imperial` con agua (piezométrica, aunque quede bajo el terreno,
  agua embalsada o agua en la grieta) y sin `water.unit_weight` toma γw ≈ 62,45 pcf en lugar de 9,81 y cambia de FS; el
  motor emite entonces el aviso informativo `water_unit_weight_default`; medido con ACADS 1(a) en pies y una piezométrica
  bajo el terreno, Bishop da 0,6339 en lugar de 0,9300 de la v0.3.0 (γw = 9,81 «pcf»). En SI no cambia nada
  ([Limitaciones](limitaciones.md#tercera-excepción-a-la-identidad-con-la-v030-γw-por-defecto-en-imperial-e15l-6-e15m-6)).
- **Un modelo sin campos v0.6 da la misma salida, byte a byte, que la 0.4.0**, con la versión del motor normalizada: 0
  diferencias en 180 modelos de `verification/` (`identity_vs_baseline.py --normalize-version --include-reinforced` contra el
  binario de la 0.4.0); los 17 modelos con campos v0.6 se saltan, porque el binario base no lee esa versión
  ([Verificación](verificacion.md#hoek-brown-shansep-y-búsqueda-no-circular-v06)).
- **Un modelo sin `global` da la misma salida, byte a byte, que la 0.5.1**, con la versión del motor normalizada: 0
  diferencias en 196 modelos de `verification/` (`identity_vs_baseline.py --normalize-version --include-reinforced --include-v05 --include-v06 --with-v06`, con los 17
  modelos que traen campos v0.6) ([Verificación](verificacion.md#búsqueda-global-no-circular-v07)).
- **Cada campo o variante de la versión 0.3 exige `"0.3"`, `reinforcements` exige `"0.4"`, `analysis.tension_crack` y
  el `lateral_pressure` y el `capacity` de un pilote exigen `"0.5"`, y los materiales `hoek_brown` y `shansep` y
  `analysis.search.non_circular` exigen `"0.6"`, y `analysis.search.non_circular.global` exige `"0.7"`** (véase [la compuerta de versión](#compuerta-de-versión)).
- **Los ángulos van en grados.** Las unidades no se convierten: deben ser coherentes entre sí.
- Todos los objetos rechazan campos desconocidos. Un `null` cuenta como campo ausente.

Los ejemplos de esta página se validan con el esquema y con `ogs analyze`
([cómo reproducirlo](#cómo-se-validan-los-ejemplos)).

## Estructura de un modelo v0.7

```
format, version, meta?, units?, materials[], regions[], water?, loads?, reinforcements?, slope?, analysis
```

`analysis` agrega, respecto de v0.2, el campo `interslice` y el tipo `polyline` en `surface`:

```
analysis: { methods[], slices?, tolerance?, max_iterations?, min_m_alpha?, seismic?, interslice?, tension_crack?, surface? | search? }
```

`tension_crack` es nuevo en la v0.5, y también los campos `lateral_pressure` y `capacity` de un `pile` de
`reinforcements` ([Pilotes con presión de suelo de Ito-Matsui](#pilotes-con-presión-de-suelo-de-ito-matsui-v05)). El agua
embalsada no tiene campo: sale de `water.piezometric_line` y del terreno.

La v0.6 agrega, en `materials[]`, los modelos `hoek_brown` (con `ucs`, `gsi`, `mi` y `disturbance`) y `shansep` (con el
objeto `shansep`), y `search.non_circular` dentro de `analysis.search`
([Hoek-Brown, SHANSEP y búsqueda no circular](#hoek-brown-shansep-y-búsqueda-no-circular-v06)).

La v0.7 agrega `search.non_circular.global` ([v0.7: búsqueda global no circular](#v07-búsqueda-global-no-circular)). La
estructura del documento no cambia.

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

**La búsqueda es circular.** La polilínea es una superficie fija que usted dibuja o importa. Desde la v0.6, una búsqueda
circular puede **refinarse a una polilínea** con `analysis.search.non_circular`
([Búsqueda no circular](#búsqueda-no-circular-analysissearchnon_circular)).

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
  `c + máx(0, σ′)·tan φ` (o Su en no drenado) con `σ′ = máx(0, σv·cos²α − u)` (E13l-5), donde `σv` incluye suelo,
  embalse y cargas verticales, sin sismo (E16aa). La comparación es estática y anterior a los refuerzos;
  si hay `kv` o anclajes activos, véase la limitación y desplace la polilínea 1 mm hacia el lado débil (E16ac). Corrige deliberadamente la v0.4.0: en un contacto lineal bajo embalse,
  Spencer pasa de 1,0591 a 0,7356; en la versión integrada previa, con UDL y SHANSEP, de 1,4222 a 1,0615. Con un material `hoek_brown` o
  `shansep` en el contacto se compara su **resistencia real** con los mismos σ y u (E16v): en Hoek-Brown, `τ(σ′n)` de la
  envolvente completa; en SHANSEP, Su con el σ′v de la columna. Antes ganaba siempre el material nuevo, aunque fuera el más
  resistente (18,04 frente a 1,234 en un modelo de prueba). Con empate se conserva el material de arriba. Es el caso de una
  polilínea trazada sobre el techo de un estrato débil
  ([medidas](limitaciones.md#contacto-entre-materiales-con-hoek-brown-o-shansep-e16v)).
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
- **`tension_crack`**, solo con `analysis.tension_crack`: `{ "x", "depth", "water_force", "face_height"? }` con la
  posición, la profundidad y el empuje de la grieta de esa superficie, y la altura de la cara cortada cuando difiere de
  `depth` ([Grieta de tracción](#grieta-de-tracción-v05)).
- **`strength`**, solo con dovelas `hoek_brown` o `shansep`: `{ "passes"?, "slices": [{ "law", "index", "normal_stress"? |
  "vertical_stress"?, "ocr"? }] }`, con el número de pasadas del lazo de Hoek-Brown y, por dovela de base de esos
  materiales, el esfuerzo de la solución ([Hoek-Brown](#la-salida-strength), [SHANSEP](#la-salida-de-shansep)).
- **`search.non_circular`**, solo con `analysis.search.non_circular`: `{ "seeds", "evaluated", "seed_fos", "polyline_fos"? }`
  ([La salida de la búsqueda no circular](#la-salida-de-la-búsqueda-no-circular)). La superficie crítica es una polilínea (`{ "points": [...] }`) si
  gana la polilínea, y un círculo si gana el círculo de la semilla.

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
([Grieta de tracción](#grieta-de-tracción-v05)). `lateral_pressure` o `capacity` en un pilote exigen `"0.5"`: el error es
`InvalidModel: lateral_pressure requiere version "0.5"`
([Ito-Matsui](#pilotes-con-presión-de-suelo-de-ito-matsui-v05)). Los materiales `hoek_brown` y `shansep`, sus campos (`ucs`, `gsi`,
`mi`, `disturbance` y `shansep`) y `analysis.search.non_circular` exigen `"0.6"`: con una versión menor, el error es
`InvalidModel: <campo> requiere version "0.6"`, con el **primer** campo en ese orden
([Versión mínima 0.6](#versión-mínima-06)). `analysis.search.non_circular.global` exige `"0.7"`: con una versión menor, el error
es `InvalidModel: analysis.search.non_circular.global requiere version "0.7"`
([Versión mínima 0.7](#versión-mínima-07)). El agua embalsada **no** tiene compuerta: se aplica en todas las
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
si existe `analysis.tension_crack` o algún pilote lleva `lateral_pressure`, y `"0.6"` solo si hay un material `hoek_brown` o
`shansep`, alguno de sus campos o `analysis.search.non_circular`, y `"0.7"` solo si hay `analysis.search.non_circular.global`;
abre las siete versiones.

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

**`pile`:** `force` (≥ 0, por pilote; obligatorio salvo que el pilote lleve `lateral_pressure`, de la v0.5, que lo
reemplaza: [Ito-Matsui](#pilotes-con-presión-de-suelo-de-ito-matsui-v05)), `spacing` (> 0, opcional; omitido vale 1 en la
unidad de longitud del modelo, como arriba) y `direction`
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

`pile` y `sheet_pile` **no** llevan `location` en el elemento: con fuerza constante no cambia ningún número (el FS de X17
§3 es idéntico a 16 cifras) y el esquema, el motor y TypeScript lo rechazan como campo desconocido (E14m-3). Con
Ito-Matsui (v0.5), `location` vuelve, pero **dentro de `lateral_pressure`** (`"centroid"` o `"slip_surface"`).

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
| `soil_force`, `governs`, `arm` | Solo en un pilote con `lateral_pressure` ([Ito-Matsui](#la-salida-de-ito-matsui)); se omiten en los demás |

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

## Pilotes con presión de suelo de Ito-Matsui (v0.5)

Un `pile` puede llevar, en lugar de una `force` dada, la fuerza que el suelo **entre pilotes** ejerce sobre la fila, según
Ito y Matsui (1975), *Soils and Foundations* 15(4):43-59 (ecuaciones 13, 14 y 23). El campo es
`lateral_pressure`, solo existe en la versión `"0.5"` y reemplaza a `force`. Es la misma ruta que usan los casos
V013b a V013e (Cai y Ugai, 2000). **Es una estimación de la presión del suelo sobre un pilote rígido y vertical, no el
diseño del pilote** ([límites](limitaciones.md#pilotes-de-ito-matsui-e15i-qué-hace-y-qué-no)).

```json
{ "type": "pile", "id": "P1", "x1": 17.5, "y1": 5.0, "x2": 17.5, "y2": -10.0, "spacing": 2.4,
  "application": "passive", "direction": "angle", "angle": 0,
  "lateral_pressure": { "model": "ito_matsui", "diameter": 0.8, "location": "centroid" },
  "capacity": { "shear": 150.0, "moment": 250.0 } }
```

### Campos y validación

| Campo | Regla |
|---|---|
| `force` / `lateral_pressure` | **Exactamente uno** de los dos: `force` pasa a ser opcional en el pilote, y con los dos o con ninguno el motor rechaza el documento |
| `lateral_pressure.model` | Solo `"ito_matsui"` |
| `lateral_pressure.diameter` | Número finito > 0, en la unidad de longitud del modelo |
| `lateral_pressure.location` | **Obligatorio**, `"centroid"` o `"slip_surface"` ([punto de aplicación](#el-punto-de-aplicación-location)); no tiene valor por defecto, y la web propone `"centroid"` |
| `capacity` | Opcional, solo junto con `lateral_pressure`. Lleva `shear` (fuerza de corte por pilote), `moment` (momento por pilote) o ambos, no puede ir vacío y cada valor es finito y > 0 |
| `spacing` | Ahora **debe ser mayor que `diameter`** (distancia de eje a eje). Un `spacing` omitido vale 1 en la unidad de longitud del modelo, así que con `diameter ≥ 1` hay que escribirlo |
| geometría | El pilote es **vertical**: `\|x2 − x1\| ≤ 1e-9·L` |
| `application`, `direction` | Siguen siendo obligatorios. Una presión de suelo sobre un pilote vertical es horizontal: `"direction": "angle"` con `"angle": 0` (la dirección es plana, como en los demás pilotes) |

- **Los campos del objeto** rechazan campos desconocidos (`deny_unknown_fields`).
- **Con ruta JSON.** Los errores de valor llevan la ruta del campo, por ejemplo
  `reinforcements[0].lateral_pressure.diameter debe ser finito y mayor que 0, no 0`.
- **Sin ruta.** Un `model` o un `location` con un valor que no es de la enumeración, y un `location` ausente, los da el
  **deserializador**, no la validación, y el mensaje no trae ruta: ``unknown variant `base`, expected `centroid` or
  `slip_surface` ``. El esquema los rechaza también. La web los valida antes y da la ruta.
- **Versión.** `lateral_pressure` o `capacity` exigen `"0.5"`: con una versión menor, el error es
  `InvalidModel: lateral_pressure requiere version "0.5"`. Con `reinforcements` en una versión anterior a la 0.4 el error
  sigue siendo el de los refuerzos.
- `sheet_pile` no tiene `lateral_pressure` ni `capacity`.

### La presión y la fuerza

Por pilote y por unidad de profundidad, `p(z) = c·A1 + σ′v·A2`, con `S = spacing`, `d = diameter` y `D2 = S − d`:

- **Con φ > 0** (ecuaciones 13 y 14 del artículo): `Nφ = tan²(45° + φ/2)` y `X = √Nφ·tan φ + Nφ − 1`.
- **Con φ = 0** (ecuación 23), es decir con un material `undrained` o con φ < 0,01°: la sobrecarga es la tensión
  **total** `σv`, porque los parámetros no drenados son de tensión total. Con `strength_gradient`, `c` es `Su(y)` en
  cada punto.
- **Piso de φ = 0.** Los coeficientes se toman como `A = max(A_cφ, A_φ=0)`. **No viene del artículo**: es la regla de
  cSlope y de XSLOPE. Hace que la fuerza no baje al subir φ, y solo actúa con S/D ≥ 8.
- **Integración.** Sobre la vertical del pilote, desde `z_top = max(0, terreno − y_cabeza)` hasta el cruce
  `zf = terreno − y_cruce`, con la regla del punto medio y un paso de 0,05 m (o su equivalente en pies). En cada punto
  se toman el material, `c` y `φ` de ese punto. El perfil se calcula una vez por análisis. Si `zf ≤ z_top`, la fuerza vale 0.
- **`σ′v` y la precedencia de `ru` (E15l-12).** `σv` se integra desde el terreno con `γ`, o con `γsat` bajo la piezométrica
  (como lo hace el cortador para ese material), y suma el agua embalsada sobre el terreno. Sin `ru`, `σ′v = σv − u`, con
  `u = γw·max(0, piezométrica − y)`; en un material con `ru`, `σ′v = σv − ru·σ_suelo`, **sin** restar la `u` de la
  piezométrica, como el rebanado y el arrancamiento `interface`. Las **cargas de superficie no entran** en `σv`, como en
  cSlope. En la fila X22-S16 (`ru` = 0,2 y piezométrica), la diferencia con el oráculo es de 0,0185 % en Bishop y de 0,026 %
  o menos en los cinco métodos, y la fuerza por metro difiere 0,041 %; antes de E15l-12, de −1,88 % a −1,97 % y −10,2 %.
- **Fuerza por pilote.** `F = min(∫p dz, shear, moment/L_m)`, con `L_m = ∫(zf − z)·p dz / ∫p dz`, el brazo de la
  resultante sobre el cruce. Es un **mínimo**, no una elección. La fuerza que entra en el equilibrio es `F/spacing`
  por metro.
- **Activo o pasivo.** Valen las reglas de [Fuerza activa y pasiva](#fuerza-activa-y-pasiva): lo publicado es
  **pasivo** y la fuerza se divide por F.

#### El punto de aplicación: `location`

- `"centroid"`: la fuerza actúa sobre la vertical del pilote a `L_m` **por encima** del cruce (Cai y Ugai, 2000,
  ecuación 9; es el valor por defecto de cSlope).
- `"slip_surface"`: actúa en el cruce.

La posición solo importa en los métodos con ecuación de momentos: con Janbu (simplificado y corregido) las dos dan el
mismo FS.

### La salida de Ito-Matsui

Cada cruce de un pilote con `lateral_pressure` agrega tres campos a su entrada de
[`reinforcement_forces`](#el-informe-reinforcement_forces). Se omiten en un pilote con `force`, de modo que su salida es
idéntica byte a byte:

| Campo | Significado |
|---|---|
| `soil_force` | Fuerza del suelo **por metro**, `∫p dz/spacing`, antes del tope de `capacity` |
| `governs` | Qué fija `available`: `"soil"`, `"shear"` o `"bending"` |
| `arm` | `L_m`, el brazo de la resultante sobre el cruce, en la unidad de longitud |

`available` y `fx` son la fuerza ya acotada, por metro.

**Perfil no finito (E15l-11).** Las ecuaciones 13 y 14 desbordan cuando S/D se acerca a 1. Si un nodo del perfil (`p`, `F` o
`Q`) no es finito, el análisis termina antes de resolver con `InvalidModel: reinforcements[i].lateral_pressure: la presión
de Ito-Matsui no es finita con S/D = … y φ = …° (las ecuaciones 13 y 14 desbordan cuando S/D se acerca a 1); aumente
spacing`. La salida nunca lleva `NaN` ni `∞`. Con φ = 35°, S/D = 1,00125 y `capacity` (`docs/fase3/r12/repro/a02_fixed.json`) el
mensaje sale con `S/D = 1.00125 y φ = 35°`; antes, Bishop daba `invalid` y los otros tres métodos `not_converged`.

**Aviso `ito_matsui_spacing_range`.** Se emite si algún pilote con `lateral_pressure` tiene `S/D < 2` o `S/D > 8`, cruce o no la
superficie: «Pilote Ito-Matsui con S/D = … fuera de 2 a 8: la fórmula pierde validez (sobrestima la fuerza con S/D
pequeño y la subestima con S/D grande; Ukritchon y Keawsawasvong 2017). Revise el espaciamiento.» Cada pilote con
`lateral_pressure` lleva además la nota `structural_checks_not_covered`.

### Ejemplo: el talud de Cai y Ugai con un pilote

El talud de V013c (10 m de altura, 1,5H:1V; suelo con c = 10 kPa, φ = 20°, γ = 20 kN/m³) con el círculo crítico de la
búsqueda de Bishop fijado. El pilote de 0,8 m de diámetro está a 2,4 m de eje a eje (S/D = 3), con la cabeza en el
terreno, en x = 17,5. Sin el pilote, el mismo círculo da Bishop 1,1691. La fuerza del suelo por metro en el cruce es
117,92 kN/m, con un brazo de 1,2238 m.

<!-- ogs-ejemplo nombre=ito-matsui-centroide estado=converged fos=bishop:1.4373,spencer:1.4339,morgenstern_price:1.4339,janbu_simplified:1.3844,janbu_corrected:1.4452 fuerzas=applied avisos=structural_checks_not_covered cruce=soil_force:117.9241,governs:soil,arm:1.2238 -->
```json
{
  "format": "opengeoslide",
  "version": "0.5",
  "meta": { "id": "ejemplo-ito-matsui", "title": "Talud de Cai y Ugai con un pilote de Ito-Matsui" },
  "units": "SI",
  "materials": [
    { "id": "suelo", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 20.0, "cohesion": 10.0, "friction_angle": 20.0 }
  ],
  "regions": [
    { "material": "suelo", "polygon": [[0, -10], [0, 0], [10, 0], [25, 10], [35, 10], [35, -10]] }
  ],
  "reinforcements": [
    {
      "type": "pile", "id": "P1", "application": "passive",
      "x1": 17.5, "y1": 5.0, "x2": 17.5, "y2": -10.0, "spacing": 2.4,
      "direction": "angle", "angle": 0,
      "lateral_pressure": { "model": "ito_matsui", "diameter": 0.8, "location": "centroid" }
    }
  ],
  "slope": { "direction": "auto" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "tolerance": 1e-5,
    "surface": { "type": "circle", "xc": 7.464496793583992, "yc": 26.311206196419032, "r": 26.43308855461703 }
  }
}
```

La entrada del informe, con Bishop, trae los tres campos nuevos:

```json
{ "id": "P1", "crossing": 0, "x": 17.5, "y": 1.8572, "station": 3.1428, "available": 117.9241,
  "fx": 117.9241, "fy": 0.0, "application": "passive", "status": "applied",
  "soil_force": 117.9241, "governs": "soil", "arm": 1.2238 }
```

**Con `location: "slip_surface"`** la fuerza es la misma, pero actúa en el cruce y no a 1,2238 m sobre él, con el
brazo más largo respecto del centro del círculo: el FS **sube** en Bishop, Spencer y Morgenstern-Price (1,4511, 1,4468 y
1,4468) y **no cambia** en Janbu (1,3844 y 1,4452):

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.lateral_pressure.location esperado=ok esquema=acepta estado=converged fos=bishop:1.4511,spencer:1.4468,morgenstern_price:1.4468,janbu_simplified:1.3844,janbu_corrected:1.4452 cruce=soil_force:117.9241,governs:soil,arm:1.2238 -->
```json
"slip_surface"
```

**Con una `capacity` que gobierna por corte.** La fuerza del suelo por pilote es 117,92·2,4 = 283,0 kN. Con un corte de
150 kN por pilote, `available` vale 150/2,4 = 62,5 kN/m, `governs` es `"shear"` y el FS baja de 1,4373 a 1,3129 en
Bishop. `soil_force` sigue siendo 117,92: es la fuerza antes del tope.

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.capacity esperado=ok esquema=acepta estado=converged fos=bishop:1.3129,spencer:1.3102,morgenstern_price:1.3101,janbu_simplified:1.2666,janbu_corrected:1.3222 fuerzas=applied cruce=soil_force:117.9241,governs:shear,arm:1.2238 -->
```json
{ "shear": 150.0 }
```

**Con una `capacity` de momento.** Con 200 kN·m por pilote, la fuerza admisible por flexión es `moment/L_m` =
200/1,2238 = 163,4 kN por pilote, o 68,10 kN/m, y `governs` es `"bending"` (Bishop 1,3256):

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.capacity esperado=ok esquema=acepta estado=converged fos=bishop:1.3256,spencer:1.3228,morgenstern_price:1.3227,janbu_simplified:1.2786,janbu_corrected:1.3347 fuerzas=applied cruce=soil_force:117.9241,governs:bending,arm:1.2238 -->
```json
{ "moment": 200.0 }
```

**Con un espaciamiento fuera de 2 a 8 veces el diámetro.** Con `spacing = 1,2` (S/D = 1,5), el modelo es válido pero la
fórmula pierde validez: sobrestima la fuerza (Bishop 3,2864) y el motor emite el aviso `ito_matsui_spacing_range`:

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.spacing esperado=ok esquema=acepta estado=converged fos=bishop:3.2864 avisos=ito_matsui_spacing_range -->
```json
1.2
```

### Rechazos

Cada bloque cambia un campo del ejemplo `ito-matsui-centroide`. Con `force` y `lateral_pressure` a la vez:

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.force esperado=error:reinforcements[0]:~force~y~lateral_pressure~se~excluyen esquema=rechaza -->
```json
50.0
```

Con un `spacing` que no supera el diámetro:

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.spacing esperado=error:reinforcements[0].spacing~debe~ser~mayor~que~lateral_pressure.diameter~0.8,~no~0.8 esquema=acepta -->
```json
0.8
```

Con un `spacing` apenas mayor que el diámetro (S/D = 1,000125), el perfil de presión no es finito (E15l-11):

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.spacing esperado=error:la~presión~de~Ito-Matsui~no~es~finita esquema=acepta -->
```json
0.8001
```

Con un pilote inclinado:

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.x2 esperado=error:reinforcements[0].x2~debe~ser~igual~a~x1~(lateral_pressure~exige~un~pilote~vertical) esquema=acepta -->
```json
18.5
```

Con una `capacity` sin campos:

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.capacity esperado=error:reinforcements[0].capacity~debe~tener~shear,~moment~o~ambos esquema=rechaza -->
```json
{}
```

Con una `location` que no existe, el error lo da el deserializador y **no lleva ruta**:

<!-- ogs-fragmento base=ito-matsui-centroide ruta=reinforcements.0.lateral_pressure.location esperado=error:unknown~variant~`base`,~expected~`centroid`~or~`slip_surface` esquema=rechaza -->
```json
"base"
```

Con `version` `"0.4"`:

<!-- ogs-fragmento base=ito-matsui-centroide ruta=version esperado=error:lateral_pressure~requiere~version~"0.5" esquema=rechaza -->
```json
"0.4"
```

## Agua embalsada (todas las versiones)

Cuando la línea piezométrica pasa **sobre el terreno** (un embalse al pie del talud, un río, una presa), el motor
incluye el agua libre **sin ningún campo nuevo y en todas las versiones del formato**, como hacen Slide2, SLOPE/W y
cSlope: el agua entre la piezométrica y el terreno carga las dovelas con su peso y con su empuje. Antes de la v0.5
(hasta la 0.3.0), el motor contaba la presión de poros con la carga completa, pero ni el peso ni el empuje del agua, y el
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
- **γw** es `water.unit_weight`. Si falta, vale 9,81 kN/m³ en `SI` y, en `imperial`, el resultado de convertir 9,81 kN/m³
  con el mismo factor que usa la web (alrededor de 62,45 pcf) (E15l-6); rige para la piezométrica, el agua embalsada y el
  agua de la grieta. En `imperial` y sin `water.unit_weight`, el motor emite el aviso `water_unit_weight_default` (E15m-6;
  [tercera excepción a la identidad con la v0.3.0](limitaciones.md#tercera-excepción-a-la-identidad-con-la-v030-γw-por-defecto-en-imperial-e15l-6-e15m-6)). La web escribe `water.unit_weight` de forma explícita al convertir unidades
  ([Limitaciones](limitaciones.md#avisos-geotécnicos-de-la-aplicación)). Medido con una grieta de 2 m con agua y sin
  `water`: en `imperial`, Bishop da 1,69865, igual que en `SI`, y `Pw` = 1344,40 lbf/ft (γw = 62,449 pcf); antes daba 1,71248 y
  211,19 lbf/ft.
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
- **Profundidad sobre una discontinuidad de `d(x)` (E15m-15, revisa E15l-2).** La profundidad y el agua de la grieta
  salen de `d(x_c)`, en el `x_c` donde termina la bisección: `water_height = water_fill·d(x_c)`. Es la convención de
  cSlope y la de antes de R12. Vale para `"auto"` (la de Rankine en `x_c`) y para una profundidad numérica (la suya). Una
  carga `udl` o un cambio lateral de material hacen saltar `d(x)` en su borde, y entonces la cara que corta la
  superficie, `terreno(x_c) − base(x_c)`, no coincide con `depth`: el informe agrega `tension_crack.face_height` con esa
  cara (véase [La salida](#la-salida)). Si esa cara no pasa de la tolerancia, no hay grieta y no se trunca la masa. Con
  una `udl` de 100 kN/m sobre la cresta (el ejemplo `grieta-udl-automatica`, más abajo), la grieta cae en el borde de la
  carga y la profundidad de Rankine bajo ella es 0: el informe trae `depth` 0, `water_force` 0 y `face_height` 1,7827
  (Bishop 1,102248; cSlope 1,102311). E15l-2 había tomado la cara cortada como profundidad (`depth` 1,7827 y `Pw`
  15,5885, Bishop 1,095348); E15m-15 la revisó tras comparar con cSlope, que se aparta 0,63 % de esa regla. Con un
  escalón del terreno en `x = 5` (`docs/fase3/r13/repro/a03_escalon_auto.json`, `"auto"`), `depth` 2,61614, `water_force`
  33,57 y `face_height` 4,97068 (Bishop 1,862343; cSlope 1,862416); con `depth` 2 (`a03_escalon_fija.json`), `depth` 2,
  `water_force` 19,62 y `face_height` 4,97068 (Bishop 1,882066; cSlope 1,882138).
- **No hay tope de profundidad** por la altura del talud (G8): una grieta más profunda que el talud es un dato suyo.
- **Búsqueda (G9).** Un candidato que no alcanza la grieta **se descarta**, y si se descartan todos, `NoValidSurface`. Si
  al menos uno se descartó por esa causa, el mensaje termina en `({e} evaluadas, 0 válidas; {k} no alcanzan la grieta de
  tracción, tension_crack_not_reached)` (E15l-7); con k = 0, el mensaje es el de siempre. Con `depth` 40 y una búsqueda circular de
  entrada y salida en el talud de `a01_ltr.json`, el mensaje termina en `(7400 evaluadas, 0 válidas; 7397 no alcanzan la
  grieta de tracción, tension_crack_not_reached)`.
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

Cada resultado cuya superficie se truncó lleva `tension_crack: { x, depth, water_force, face_height? }`: la `x` de la
grieta (`x_c`), su profundidad y `Pw`. Se omite cuando no hay grieta.

`face_height` (E15m-15) es la altura de la cara cortada, `terreno(x_c) − base(x_c)`, medida desde el terreno del lado
de la masa. Es opcional: se omite cuando `|face_height − depth|` no pasa de la tolerancia, de modo que la salida de una
grieta normal no cambia. Aparece cuando `depth` y la cara difieren, es decir, cuando la grieta cae sobre una
discontinuidad del terreno, de una carga `udl` o del material (`depth` 0 y `face_height` > 0 es un corte de la masa sin
grieta de tracción: la profundidad de Rankine es 0 en ese punto). `Pw` se calcula con `depth`, no con `face_height`.

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

**Grieta automática sobre una carga (E15m-15).** Una `udl` en la coronación hace saltar la profundidad de Rankine en su
borde. Con `"auto"`, la grieta cae en ese borde (x = −66,5) y, bajo la carga, la profundidad de Rankine es 0: el informe
trae `depth` 0 y `water_force` 0, y Bishop da 1,1022 (cSlope, 1,1023). El campo `face_height` informa que el corte de
la masa pasa por una cara de 1,7827 m:

<!-- ogs-ejemplo nombre=grieta-udl-automatica estado=converged fos=bishop:1.1022,spencer:1.1009 grieta=x:-66.5,depth:0.0,water_force:0.0,face_height:1.7827 -->
```json
{
  "format": "opengeoslide",
  "version": "0.5",
  "meta": { "id": "ejemplo-grieta-udl", "title": "Talud de 10 m con una udl en la coronación y una grieta automática llena" },
  "units": "SI",
  "materials": [
    { "id": "s", "name": "Suelo", "model": "mohr_coulomb", "unit_weight": 18.0, "cohesion": 20.0, "friction_angle": 10.0 }
  ],
  "regions": [
    { "material": "s", "polygon": [[-70, 20], [-70, 35], [-50, 35], [-30, 25], [-20, 25], [-20, 20]] }
  ],
  "loads": [
    { "type": "udl", "id": "u1", "x1": -66.5, "x2": -55.0, "q": 100.0 }
  ],
  "slope": { "direction": "left_to_right" },
  "analysis": {
    "methods": ["bishop", "spencer"],
    "slices": 50,
    "tolerance": 1e-6,
    "tension_crack": { "depth": "auto", "water_fill": 1.0 },
    "surface": { "type": "circle", "xc": -42.421052631578945, "yc": 55.0, "r": 32.46971740678465 }
  }
}
```

Con la regla de E15l-2 (la profundidad como la cara cortada), el informe traía `depth` 1,7827 y `water_force` 15,5885, y Bishop daba 1,0953; E15m-15 la revisó porque cSlope da 1,1023 (1,102311).

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

## Hoek-Brown, SHANSEP y búsqueda no circular (v0.6)

La versión `"0.6"` agrega dos modelos de resistencia, `hoek_brown` y `shansep`, y la búsqueda no circular
(`analysis.search.non_circular`). El esquema es [`schema/ogs-0.6.schema.json`](../schema/ogs-0.6.schema.json). **Un modelo
sin ninguno de estos campos da la misma salida, byte a byte, que la 0.4.0** (con la versión del motor normalizada). La v0.6
se publicó con la 0.5.0; la 0.4.0 llega hasta el formato v0.5.

### Versión mínima 0.6

Exigen `"0.6"`, en este orden (el error nombra el **primero** que encuentra):

1. por material, en el orden de la lista: `materials[i].model = "hoek_brown"` o `materials[i].model = "shansep"`; después,
   los campos `ucs`, `gsi`, `mi`, `disturbance` y `shansep`, en ese orden, presentes en cualquier material;
2. `analysis.search.non_circular`.

Con una versión menor, el error es `InvalidModel: <campo> requiere version "0.6"`, por ejemplo
`materials[0].model = "hoek_brown" requiere version "0.6"`, `materials[0].ucs requiere version "0.6"` o
`analysis.search.non_circular requiere version "0.6"`. Un campo que exigía `"0.3"`, `"0.4"` o `"0.5"` se acepta también
con `"0.6"`. La web guarda `"0.6"` solo si el modelo usa alguno de estos campos.

### Material Hoek-Brown (`model: "hoek_brown"`)

La resistencia de una roca fracturada según el criterio generalizado de Hoek-Brown (Hoek, Carranza-Torres y Corkum,
2002, «Hoek-Brown failure criterion, 2002 edition»), con la tangente instantánea a la envolvente en el esfuerzo normal
efectivo de cada dovela.

```json
{ "id": "roca", "name": "Roca", "model": "hoek_brown", "unit_weight": 25.0, "ucs": 12000.0, "gsi": 25.0, "mi": 8.0,
  "disturbance": 0.7 }
```

| Campo | Significado | Rango |
|---|---|---|
| `unit_weight` | peso unitario | número finito > 0, como siempre |
| `ucs` | resistencia a compresión simple de la roca intacta, σci, en la unidad de esfuerzo del modelo (kPa en SI, psf en imperial) | número finito > 0 |
| `gsi` | Geological Strength Index | número finito en [0, 100] |
| `mi` | constante de la roca intacta | número finito > 0 |
| `disturbance` | factor de perturbación D. **Obligatorio, sin valor por defecto** | número finito en [0, 1] |
| `unit_weight_sat`, `ru` | opcionales, con las reglas de Mohr-Coulomb | |

- **D no tiene valor por defecto.** cSlope usa 0 cuando falta, pero Hoek et al. (2002, §7) advierten que D = 0 da
  propiedades demasiado optimistas en minas a cielo abierto. El editor pide elegirlo y muestra la guía de su Tabla 1.
- **Prohibidos** en un material `hoek_brown`: `cohesion`, `friction_angle`, `undrained_strength`, `strength_datum`,
  `strength_gradient`, `strength_limit` y `shansep`. A la inversa, `ucs`, `gsi`, `mi` y `disturbance` están prohibidos en
  `mohr_coulomb`, `undrained` y `shansep`.
- **Los parámetros derivados no son campos del formato.** El motor los calcula con las ecuaciones 3 a 5 de Hoek et al.
  (2002), y la web los muestra con la misma fórmula:
  - `mb = mi·exp((GSI − 100)/(28 − 14·D))`
  - `s = exp((GSI − 100)/(9 − 3·D))`
  - `a = 1/2 + (exp(−GSI/15) − exp(−20/3))/6`

  Para el ejemplo de abajo (σci 12 000 kPa, GSI 25, mi 8, D 0,7): mb = 0,1298, s = 1,903·10⁻⁵ y a = 0,5313.
- **Unidades.** `ucs` es un esfuerzo. Una σci escrita en MPa como si fueran kPa es el error más común: la web avisa cuando
  σci es menor que 1000 kPa o mayor que 300 000 kPa (o su equivalente imperial).
- **Sismo y agua.** El sismo entra en el esfuerzo normal efectivo como en los demás materiales, y `unit_weight_sat` y `ru`
  funcionan igual.

#### La envolvente y la tangente

Con σ3 como esfuerzo principal menor, σ1 = σ3 + σci·(mb·σ3/σci + s)^a (ecuación 2). En el punto de la envolvente con
σn = σ′n, la tangente es `sen φᵢ = (k − 1)/(k + 1)`, con `k = dσ1/dσ3`, y `cᵢ = τ − σ′n·tan φᵢ` (ecuaciones 8 a 10). El σ3 de
ese punto se busca por Newton salvaguardado, con bisección de respaldo cuando el paso sale del intervalo, hasta
`|Δσ3| ≤ 1e-12·ucs` (E16w; coincide con la bisección pura de antes a 1e-9 relativo en el FS). Se impone `cᵢ ≥ 0` y `φᵢ ≤ 89,9°`.

#### Bajo confinamiento: la envolvente completa

Con `σt = −s·σci/mb` (la resistencia a tracción del macizo) y `sn(0)`, el σn del punto con σ3 = 0:

| Esfuerzo normal efectivo | Tangente que usa el motor |
|---|---|
| `σ′n > sn(0)` | la del punto con σ3 ≥ 0 (igual que cSlope) |
| `σt < σ′n ≤ sn(0)` | la del punto de la **misma envolvente** con σ3 en (σt, 0] |
| `σ′n ≤ σt` | `c = 0` y `tan φ = 0`: la base no resiste |

cSlope usa en cambio la tangente de σ3 = 0 para todo `σ′n ≤ sn(0)`. Esa recta queda sobre la envolvente cóncava y da
resistencia incluso en tracción (9,5 kPa con `σ′n = −0,88 kPa` en el caso de X25 §3.4). **La regla del producto nunca
sobreestima la resistencia** y es el criterio tal como lo define la fuente; su diferencia con cSlope es conservadora y
crece con las dovelas en bajo confinamiento (véase [Limitaciones](limitaciones.md#hoek-brown-envolvente-completa-costo-y-no-convergencia-v06)).
En el ejemplo de abajo, `sn(0)` = 2,811 kPa y `σt` = −1,759 kPa.

Si alguna dovela de base `hoek_brown` tiene `σ′n ≤ sn(0)` en la solución reportada, el motor emite la nota informativa
`hoek_brown_low_confinement`, **una vez por método**: revise la presión de poros y las grietas.

#### El lazo por dovela

La resistencia depende de `σ′n`, y `σ′n` depende del FS. El motor itera, sin tocar los métodos de equilibrio:

1. **Estado inicial:** `σ′n₀ = máx(0, (W/b)·cos²α − u)` en cada dovela de base `hoek_brown` (E16w: con el arranque sin el
   `máx(0, ·)`, las dovelas empinadas con `σ′n₀ ≤ σt` partían en (0, 0) y los cinco métodos fallaban en la primera pasada, como en
   `X28-R-SB-RU03`, que ahora converge: [Limitaciones](limitaciones.md#hoek-brown-envolvente-completa-costo-y-no-convergencia-v06)).
2. **Pasada:** resuelve el método con los (c, tan φ) actuales. Con el N′ de esa solución, `σ′n = N′/l`, calcula la
   tangente (cT, tT) y promedia: `c ← (c + cT)/2` y `tan φ ← (tan φ + tT)/2` (**w = 0,5**, como cSlope).
3. **Convergencia:** `|ΔF| ≤ 1e-6·|F|`, con un máximo de **50 pasadas**.
4. **Sin convergencia:** el estado es `not_converged` con el aviso `hoek_brown_not_converged` y **`fos` `null`**, como en los
   demás `not_converged` (no queda el F de la última pasada); la nota `hoek_brown_low_confinement` se conserva. En una
   búsqueda, ese candidato se descarta, como en cSlope. Si el método no tiene solución en alguna pasada (por ejemplo, sin raíz de λ), el resultado es
   el estado de esa pasada y el lazo se detiene.

Sin el promedio (w = 1), el lazo cicla en un modelo de dos bancos con Bishop y Janbu (no converge en 200 pasadas); con w = 0,5
converge en 10 a 12 pasadas en los cuatro modelos medidos (X28). N′ es el de la ecuación de cada método: el de Bishop, el de
(F, λ) en Spencer y Morgenstern-Price, y el de F₀ en los dos Janbu (el factor de corrección de Janbu corregido se aplica al
final, con los (c, tan φ) finales). En ningún modelo medido (X28 y la batería F3B) se llegó al máximo de pasadas.

#### La salida: `strength`

Un resultado con dovelas `hoek_brown` o `shansep` agrega `strength`; sin esos materiales se omite y la salida no cambia:

```json
"strength": { "passes": 13,
              "slices": [ { "law": "hoek_brown", "index": 0, "normal_stress": -0.1350 },
                          { "law": "hoek_brown", "index": 12, "normal_stress": 25.8956 } ] }
```

- `passes`: el número de pasadas del lazo de ese método (solo con Hoek-Brown).
- `slices`: solo las dovelas de base `hoek_brown` o `shansep`, con su `index` en `slices` del mismo informe y su
  `normal_stress` (σ′n en esa solución) en Hoek-Brown.
- En `slices[].cohesion` y `slices[].tan_phi` están los (c, tan φ) **con los que se calculó** la última solución, no los
  promediados después; así el equilibrio global se comprueba con las fuerzas reales de esa solución. Por el promedio con
  w = 0,5, la tangente evaluada en el σ′n final difiere de ellos en ~0,1 %, y una cohesión grande cerca de σt es el
  intercepto de una tangente casi vertical que no cambia τ en σ′n (R15A-07).

#### Errores

Todos son `InvalidModel` y nombran el material y el campo. Los valores de abajo son los del ejemplo (`roca`):

| Caso | Mensaje |
|---|---|
| falta `ucs`, `gsi`, `mi` o `disturbance` | `el material 'roca' con model "hoek_brown" requiere el campo 'disturbance'` |
| `ucs` ≤ 0 o no finito | `el ucs del material 'roca' debe ser finito y > 0` |
| `gsi` fuera de [0, 100] | `el GSI del material 'roca' debe estar en [0, 100]` |
| `mi` ≤ 0 o no finito | `el mi del material 'roca' debe ser finito y > 0` |
| `disturbance` fuera de [0, 1] | `el disturbance del material 'roca' debe estar en [0, 1]` |
| un campo prohibido | `el material 'roca' con model "hoek_brown" no admite el campo 'cohesion'` |
| `ucs`, `gsi`, `mi` o `disturbance` en otro modelo | `el material 'roca' con model "mohr_coulomb" no admite el campo 'gsi'` |
| `version` menor que `"0.6"` | `materials[0].model = "hoek_brown" requiere version "0.6"` |

#### Ejemplo: el rajo SA con Hoek-Brown

El sintético SA de X23 §4.1: tres bancos de 10 m con taludes de 60°, en una roca débil (σci 12 000 kPa, GSI 25, mi 8,
D 0,7), seco, con un círculo fijo. Las dovelas 0, 1, 39 y 40 quedan en bajo confinamiento (σ′n de −0,135, 2,172, 1,757 y
−0,787 kPa, todas ≤ `sn(0)` y por encima de `σt`), así que sale la nota `hoek_brown_low_confinement`. El lazo converge en 13
pasadas con Bishop y los dos Janbu, y en 11 con Spencer y Morgenstern-Price. Frente a cSlope en el mismo círculo
(1,1816, 1,1881, 1,1368 y 1,1794), el FS del motor es de 0,05 % a 0,15 % menor; en este modelo, solo 4 de 41 dovelas quedan en
bajo confinamiento.

<!-- ogs-ejemplo nombre=hb-roca-sa estado=converged fos=bishop:1.1804,spencer:1.1874,morgenstern_price:1.1874,janbu_simplified:1.1351,janbu_corrected:1.1777 avisos=hoek_brown_low_confinement pasadas=bishop:13,spencer:11,morgenstern_price:11,janbu_simplified:13,janbu_corrected:13 ley=hoek_brown -->
```json
{
  "format": "opengeoslide",
  "version": "0.6",
  "meta": {
    "id": "ejemplo-hoek-brown",
    "title": "Sintético SA (X23 §4.1): rajo de tres bancos en roca débil con Hoek-Brown, círculo fijo"
  },
  "units": "SI",
  "materials": [
    {
      "id": "roca",
      "name": "Roca",
      "model": "hoek_brown",
      "unit_weight": 25.0,
      "ucs": 12000.0,
      "gsi": 25.0,
      "mi": 8.0,
      "disturbance": 0.7
    }
  ],
  "regions": [
    {
      "material": "roca",
      "polygon": [
        [-40, -10], [72.3205, -10], [72.3205, 30], [32.3205, 30], [27.3205, 30], [21.547, 20], [16.547, 20], [10.7735, 10],
        [5.7735, 10], [0, 0], [-40, 0]
      ]
    }
  ],
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 40,
    "tolerance": 1e-05,
    "max_iterations": 1000,
    "min_m_alpha": 0.2,
    "surface": { "type": "circle", "xc": 11.064761108572334, "yc": 35.672573017328205, "r": 18.85046460530379 },
    "interslice": { "function": "constant" }
  }
}
```

**D = 0.** Con un macizo sin perturbar, la roca es mucho más resistente (Bishop pasa de 1,1804 a 2,0215):

<!-- ogs-fragmento base=hb-roca-sa ruta=materials.0.disturbance esperado=ok esquema=acepta estado=converged fos=bishop:2.0215,spencer:2.0351,morgenstern_price:2.0351,janbu_simplified:1.9563,janbu_corrected:2.0297 -->
```json
0.0
```

**Grieta con profundidad fija.** Con Hoek-Brown se admite la grieta de profundidad fija (la automática no, véase
[Combinaciones no admitidas](#combinaciones-no-admitidas-v06)):

<!-- ogs-fragmento base=hb-roca-sa ruta=analysis.tension_crack esperado=ok esquema=acepta estado=converged fos=bishop:1.1806,spencer:1.1868,morgenstern_price:1.1868,janbu_simplified:1.1324,janbu_corrected:1.1684 -->
```json
{ "depth": 2.0, "water_fill": 0.0 }
```

**Rechazos.** Cada uno cambia un campo del ejemplo `hb-roca-sa`. Sin `disturbance`:

<!-- ogs-fragmento base=hb-roca-sa ruta=materials.0 esperado=error:el~material~'roca'~con~model~"hoek_brown"~requiere~el~campo~'disturbance' esquema=rechaza -->
```json
{ "id": "roca", "name": "Roca", "model": "hoek_brown", "unit_weight": 25.0, "ucs": 12000.0, "gsi": 25.0, "mi": 8.0 }
```

Con GSI 120:

<!-- ogs-fragmento base=hb-roca-sa ruta=materials.0.gsi esperado=error:el~GSI~del~material~'roca'~debe~estar~en~[0,~100] esquema=rechaza -->
```json
120.0
```

Con `ucs` 0:

<!-- ogs-fragmento base=hb-roca-sa ruta=materials.0.ucs esperado=error:el~ucs~del~material~'roca'~debe~ser~finito~y~>~0 esquema=rechaza -->
```json
0.0
```

Con `mi` 0:

<!-- ogs-fragmento base=hb-roca-sa ruta=materials.0.mi esperado=error:el~mi~del~material~'roca'~debe~ser~finito~y~>~0 esquema=rechaza -->
```json
0.0
```

Con D = 1,5:

<!-- ogs-fragmento base=hb-roca-sa ruta=materials.0.disturbance esperado=error:el~disturbance~del~material~'roca'~debe~estar~en~[0,~1] esquema=rechaza -->
```json
1.5
```

Con una `cohesion`, que un material `hoek_brown` no admite:

<!-- ogs-fragmento base=hb-roca-sa ruta=materials.0 esperado=error:el~material~'roca'~con~model~"hoek_brown"~no~admite~el~campo~'cohesion' esquema=rechaza -->
```json
{ "id": "roca", "name": "Roca", "model": "hoek_brown", "unit_weight": 25.0, "ucs": 12000.0, "gsi": 25.0, "mi": 8.0,
  "disturbance": 0.7, "cohesion": 10.0 }
```

Con un campo de Hoek-Brown en un material de Mohr-Coulomb:

<!-- ogs-fragmento base=hb-roca-sa ruta=materials.0 esperado=error:el~material~'roca'~con~model~"mohr_coulomb"~no~admite~el~campo~'gsi' esquema=rechaza -->
```json
{ "id": "roca", "name": "Roca", "model": "mohr_coulomb", "unit_weight": 25.0, "cohesion": 10.0, "friction_angle": 30.0, "gsi": 25.0 }
```

Con `version` `"0.5"`:

<!-- ogs-fragmento base=hb-roca-sa ruta=version esperado=error:materials[0].model~=~"hoek_brown"~requiere~version~"0.6" esquema=rechaza -->
```json
"0.5"
```

### Material SHANSEP (`model: "shansep"`)

La resistencia no drenada normalizada por el esfuerzo vertical efectivo, `Su = S·σ′v·OCR^m` (Ladd, 1991), con φ = 0. El
motor la calcula **una vez por dovela y por superficie**, en el punto medio de la base; no depende de F, así que no hay
iteración.

```json
{ "id": "arcilla", "name": "Arcilla", "model": "shansep", "unit_weight": 18.0,
  "shansep": { "ratio": 0.25, "exponent": 0.8, "pop": 30.0 } }
```

| Campo | Significado | Rango |
|---|---|---|
| `unit_weight` | peso unitario | número finito > 0 |
| `shansep.ratio` | el cociente S de resistencia normalizada | número finito > 0 |
| `shansep.exponent` | el exponente m. **Opcional**; vale **0,8** si falta (cSlope; Ladd, 1991) | número finito en [0, 1] |
| `shansep.ocr` | OCR constante | número finito ≥ 1 |
| `shansep.pop` | presión de preconsolidación en exceso (POP), en la unidad de esfuerzo del modelo | número finito ≥ 0 |
| `shansep.ocr_by_elevation` | tabla `[[y, OCR], …]` | al menos 2 filas, `y` estrictamente creciente y OCR finito ≥ 1 |
| `unit_weight_sat`, `ru` | opcionales | como en Mohr-Coulomb |

- **Exactamente una** de `ocr`, `pop` u `ocr_by_elevation`. Ninguna o más de una es
  `InvalidModel: el material '<id>' requiere exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation`. cSlope
  usa OCR = 1 sin avisar cuando falta; aquí es un error.
- **Prohibidos** en un material `shansep`: `cohesion`, `friction_angle`, `undrained_strength`, `strength_datum`,
  `strength_gradient`, `strength_limit`, `ucs`, `gsi`, `mi` y `disturbance`. El campo `shansep` está prohibido en los demás
  modelos. El objeto `shansep` rechaza campos desconocidos.
- **Fuera del formato v0.6** (cSlope los tiene): `su_min`, `yield_stress`, `su_by_stress`, `anisotropy`,
  `yield_from_earlier_stage`, `above_water` y `b_bar`.

#### El esfuerzo vertical efectivo en la base (σ′v)

`σ′v = (W + Q + V)/b − u`, en el punto medio de la base de cada dovela, donde:

- `W` es el peso **estático** de la dovela (sin `kv·W`);
- `Q` son las cargas verticales estáticas (`udl` y `line`) sobre la dovela;
- `V` es el peso del agua embalsada sobre la dovela;
- `b` es el ancho de la dovela, y
- `u` es la presión de poros de la base que ya calcula el motor: la piezométrica sin recortar al terreno, el agua embalsada
  y `ru`.

**El sismo no entra en σ′v.** Con `kh` y `kv`, Su queda idéntico dovela por dovela (diferencia de 0,0 en el oráculo); el
sismo actúa solo en las fuerzas de los métodos, como siempre.

- **OCR.** Con `ocr`, el valor constante. Con `pop`, `OCR = (σ′v + pop)/σ′v` y, para σ′v > 0, el motor calcula Su como
  `ratio·σ′v^(1−m)·(σ′v + pop)^m`, la misma expresión sin el cociente (E16y). Con `ocr_by_elevation`, la interpolación
  lineal en la cota del punto medio de la base, `(y_izq + y_der)/2`, y **constante fuera de la tabla**: debajo de la primera
  fila vale el OCR de la primera; encima de la última, el de la última.
- **σ′v ≤ 0.** Su = 0, sin evaluar el OCR, y la nota informativa `shansep_nonpositive_stress`, **una vez por método**. Con
  entradas válidas solo ocurre bajo el agua, con `unit_weight` menor que γw y sin `unit_weight_sat`
  ([ejemplo](#ejemplo-shansep-con-ocr-por-cota-y-la-piezométrica-sobre-el-terreno)).
- **Las caras de las dovelas** (el aviso [`interslice_shear_exceeds_strength`](#aviso-interslice_shear_exceeds_strength)):
  la resistencia de una cara es `∫ Su(σ′v(z)) dz` sobre la cara, con puntos medios. `σ′v(z)` es el esfuerzo vertical de la
  **columna de suelo** a la cota z, menos `u(z)`: la misma convención que usan las caras de los otros materiales. En un
  material `hoek_brown`, la cara usa `τ(σ′n)` de la misma envolvente y con la misma regla de bajo confinamiento, con σ′n
  igual al esfuerzo efectivo vertical. Desde E16y, en las caras de `hoek_brown` y `shansep`, σv(z) suma el peso del agua
  embalsada `γw·máx(0, piezométrica − cota)`, porque u(z) ya cuenta esa columna; la capacidad de cara de una capa seca con γ′
  y la de la misma capa sumergida coinciden a 5,6e-16 (el FS no es invariante: +0,15 %,
  [Limitaciones](limitaciones.md#shansep-v06)). La rama lineal no cambia.

#### La salida de SHANSEP

Cada dovela de base `shansep` trae en `strength.slices` su `vertical_stress` (σ′v) y su `ocr`; `cohesion` es Su y `tan_phi`
es 0. No hay `passes`.

```json
"strength": { "slices": [ { "law": "shansep", "index": 24, "vertical_stress": 61.2810, "ocr": 1.1632 } ] }
```

#### Errores

| Caso | Mensaje |
|---|---|
| falta el objeto `shansep` | `el material 'soil' con model "shansep" requiere el campo 'shansep'` |
| `ratio` ≤ 0 o no finito | `el shansep.ratio del material 'soil' debe ser finito y > 0` |
| `exponent` fuera de [0, 1] | `el shansep.exponent del material 'soil' debe estar en [0, 1]` |
| ninguna o más de una fuente de OCR | `el material 'soil' requiere exactamente uno de shansep.ocr, shansep.pop o shansep.ocr_by_elevation` |
| `ocr` < 1 | `el shansep.ocr del material 'soil' debe ser finito y ≥ 1` |
| `pop` < 0 | `el shansep.pop del material 'soil' debe ser finito y ≥ 0` |
| tabla con menos de 2 filas | `el shansep.ocr_by_elevation del material 'soil' necesita al menos 2 filas` |
| un OCR < 1 o un valor no finito en la tabla | `el shansep.ocr_by_elevation del material 'soil' tiene valores no finitos o OCR < 1` |
| `y` no estrictamente creciente | `el shansep.ocr_by_elevation del material 'soil' debe tener y estrictamente creciente` |
| un campo prohibido | `el material 'soil' con model "shansep" no admite el campo 'friction_angle'` |
| un campo desconocido en `shansep` (por ejemplo `su_min`) | ``unknown field `su_min`, expected one of …`` |
| Su (en la base o en una cara) o la cohesión equivalente no es finita, por ejemplo `ocr` = 1e308 | `la resistencia SHANSEP del material 'soil' no es finita (revise shansep.ocr, pop u ocr_by_elevation)` (también en una búsqueda, con código de salida 2) |
| `version` menor que `"0.6"` | `materials[0].model = "shansep" requiere version "0.6"` |

#### Ejemplo: SHANSEP con POP

V047a (la geometría de ACADS 1(a): talud de 10 m, 2H:1V) con una arcilla SHANSEP (S 0,25, m 0,8) y un POP de 10 kPa, seca, en el círculo
crítico de Mohr-Coulomb. En la dovela 24, `W/b` = 61,281 kPa y `u` = 0, así que σ′v = 61,281, `OCR = (61,281 + 10)/61,281`
= 1,1632 y `Su = 0,25·61,281·1,1632^0,8` = 17,290 kPa. Contra cSlope, los cinco métodos difieren 0,0007 % o menos en
Bishop, Spencer y Morgenstern-Price y 0,0051 % o menos en los dos Janbu:

<!-- ogs-ejemplo nombre=shansep-pop estado=converged fos=bishop:0.8041,spencer:0.8041,morgenstern_price:0.8041,janbu_simplified:0.7830,janbu_corrected:0.8322 ley=shansep sv=24:61.2810:1.1632 -->
```json
{
  "format": "opengeoslide",
  "version": "0.6",
  "meta": {
    "id": "ejemplo-shansep-pop",
    "title": "V047a con arcilla SHANSEP (S 0,25, m 0,8) y POP de 10 kPa, círculo fijo, seco"
  },
  "units": "SI",
  "materials": [
    {
      "id": "soil",
      "name": "Soil",
      "model": "shansep",
      "unit_weight": 20.0,
      "shansep": { "ratio": 0.25, "exponent": 0.8, "pop": 10.0 }
    }
  ],
  "regions": [
    {
      "material": "soil",
      "polygon": [[20.0, 20.0], [20.0, 25.0], [30.0, 25.0], [50.0, 35.0], [70.0, 35.0], [70.0, 20.0]]
    }
  ],
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "tolerance": 1e-05,
    "max_iterations": 500,
    "min_m_alpha": 0.2,
    "surface": { "type": "circle", "xc": 29.511, "yc": 53.738, "r": 28.742 }
  }
}
```

**`ocr` constante.** Con `ocr` 1,5 y el exponente por defecto, Bishop da 0,9436 (cSlope, 0,9437):

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=ok esquema=acepta estado=converged fos=bishop:0.9436,spencer:0.9436,morgenstern_price:0.9436,janbu_simplified:0.9178,janbu_corrected:0.9754 ley=shansep -->
```json
{ "ratio": 0.25, "ocr": 1.5 }
```

**`ocr_by_elevation`.** Con una tabla de 1,0 en la cota 20 a 1,5 en la cota 35, el OCR sube con la cota de la base:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=ok esquema=acepta estado=converged fos=bishop:0.8310,spencer:0.8310,morgenstern_price:0.8310,janbu_simplified:0.8125,janbu_corrected:0.8635 ley=shansep -->
```json
{ "ratio": 0.25, "exponent": 0.8, "ocr_by_elevation": [[20.0, 1.0], [35.0, 1.5]] }
```

Fuera de la tabla, el OCR es constante: con una tabla de 1,0 en la cota 22 a 2,0 en la cota 30, toda base bajo 22 m
usa 1,0 y toda base sobre 30 m usa 2,0 (Bishop, 1,0622):

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=ok esquema=acepta estado=converged fos=bishop:1.0622,spencer:1.0622,morgenstern_price:1.0622,janbu_simplified:1.0427,janbu_corrected:1.1081 ley=shansep -->
```json
{ "ratio": 0.25, "exponent": 0.8, "ocr_by_elevation": [[22.0, 1.0], [30.0, 2.0]] }
```

#### Ejemplo: SHANSEP con OCR por cota y la piezométrica sobre el terreno

El mismo talud, con una piezométrica a la cota 30 que pasa **sobre el terreno** al pie (cota 25), y el OCR por cota. La
dovela 0 tiene `W` = 0,8634 kN/m, `V` = 20,454 kN/m de agua embalsada, `b` = 0,4261 m y `u` = 48,997 kPa, de modo que
`σ′v = (0,8634 + 20,454)/0,4261 − 48,997` = 1,0324 kPa. El punto medio de su base está en la cota 25,005, donde el OCR
interpolado es 1,1668 y `Su` = 0,292 kPa. Los cinco métodos coinciden con cSlope a 0,021 % o menos:

<!-- ogs-ejemplo nombre=shansep-ocr-cota estado=converged fos=bishop:0.7798,spencer:0.7799,morgenstern_price:0.7799,janbu_simplified:0.7653,janbu_corrected:0.8133 avisos=water_above_ground ley=shansep sv=0:1.0324:1.1668 -->
```json
{
  "format": "opengeoslide",
  "version": "0.6",
  "meta": {
    "id": "ejemplo-shansep-ocr-cota",
    "title": "V047a con SHANSEP, OCR por cota y la piezométrica sobre el terreno al pie"
  },
  "units": "SI",
  "materials": [
    {
      "id": "soil",
      "name": "Soil",
      "model": "shansep",
      "unit_weight": 20.0,
      "unit_weight_sat": 20.0,
      "shansep": { "ratio": 0.25, "exponent": 0.8, "ocr_by_elevation": [[20.0, 1.0], [35.0, 1.5]] }
    }
  ],
  "regions": [
    {
      "material": "soil",
      "polygon": [[20.0, 20.0], [20.0, 25.0], [30.0, 25.0], [50.0, 35.0], [70.0, 35.0], [70.0, 20.0]]
    }
  ],
  "water": { "piezometric_line": [[0.0, 30.0], [100.0, 30.0]] },
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["bishop", "spencer", "morgenstern_price", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "tolerance": 1e-05,
    "max_iterations": 500,
    "min_m_alpha": 0.2,
    "surface": { "type": "circle", "xc": 29.511, "yc": 53.738, "r": 28.742 }
  }
}
```

**σ′v ≤ 0.** Con `unit_weight` 8 (menor que γw = 9,81) y sin `unit_weight_sat`, el suelo bajo el agua tiene un esfuerzo
efectivo negativo. Las dovelas con σ′v ≤ 0 tienen Su = 0, y el motor lo avisa con `shansep_nonpositive_stress`; además,
la masa sin resistencia tiene tracción, y sale `negative_effective_normal_major`. Bishop baja de 0,7798 a 0,7660:

<!-- ogs-fragmento base=shansep-ocr-cota ruta=materials.0 esperado=ok esquema=acepta estado=converged fos=bishop:0.7660,spencer:0.7660,morgenstern_price:0.7660,janbu_simplified:0.7480,janbu_corrected:0.7950 avisos=shansep_nonpositive_stress,negative_effective_normal_major -->
```json
{ "id": "soil", "name": "Soil", "model": "shansep", "unit_weight": 8.0,
  "shansep": { "ratio": 0.25, "exponent": 0.8, "ocr_by_elevation": [[20.0, 1.0], [35.0, 1.5]] } }
```

**Rechazos.** Cada uno cambia el objeto `shansep` del ejemplo `shansep-pop`. Con `ocr` y `pop` a la vez:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:el~material~'soil'~requiere~exactamente~uno~de~shansep.ocr,~shansep.pop~o~shansep.ocr_by_elevation esquema=rechaza -->
```json
{ "ratio": 0.25, "ocr": 1.5, "pop": 10.0 }
```

Con ninguna de las tres:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:el~material~'soil'~requiere~exactamente~uno~de~shansep.ocr,~shansep.pop~o~shansep.ocr_by_elevation esquema=rechaza -->
```json
{ "ratio": 0.25, "exponent": 0.8 }
```

Con `ratio` 0:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:el~shansep.ratio~del~material~'soil'~debe~ser~finito~y~>~0 esquema=rechaza -->
```json
{ "ratio": 0.0, "pop": 10.0 }
```

Con `exponent` 1,5:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:el~shansep.exponent~del~material~'soil'~debe~estar~en~[0,~1] esquema=rechaza -->
```json
{ "ratio": 0.25, "exponent": 1.5, "pop": 10.0 }
```

Con `ocr` menor que 1:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:el~shansep.ocr~del~material~'soil'~debe~ser~finito~y~≥~1 esquema=rechaza -->
```json
{ "ratio": 0.25, "ocr": 0.9 }
```

Con `pop` negativo:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:el~shansep.pop~del~material~'soil'~debe~ser~finito~y~≥~0 esquema=rechaza -->
```json
{ "ratio": 0.25, "pop": -1.0 }
```

Con una tabla de una sola fila:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:el~shansep.ocr_by_elevation~del~material~'soil'~necesita~al~menos~2~filas esquema=rechaza -->
```json
{ "ratio": 0.25, "ocr_by_elevation": [[20.0, 1.0]] }
```

Con la `y` de la tabla en desorden. **Este rechazo es solo del motor** (E16n): el esquema no compara valores entre sí
([Qué valida el esquema y qué solo el motor](#qué-valida-el-esquema-y-qué-solo-el-motor)):

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:el~shansep.ocr_by_elevation~del~material~'soil'~debe~tener~y~estrictamente~creciente esquema=acepta -->
```json
{ "ratio": 0.25, "ocr_by_elevation": [[35.0, 1.5], [20.0, 1.0]] }
```

Con un campo que el formato no admite (`su_min`):

<!-- ogs-fragmento base=shansep-pop ruta=materials.0.shansep esperado=error:unknown~field~`su_min` esquema=rechaza -->
```json
{ "ratio": 0.25, "pop": 10.0, "su_min": 5.0 }
```

Con una `friction_angle`, que un material `shansep` no admite:

<!-- ogs-fragmento base=shansep-pop ruta=materials.0 esperado=error:el~material~'soil'~con~model~"shansep"~no~admite~el~campo~'friction_angle' esquema=rechaza -->
```json
{ "id": "soil", "name": "Soil", "model": "shansep", "unit_weight": 20.0, "friction_angle": 20.0,
  "shansep": { "ratio": 0.25, "pop": 10.0 } }
```

Con `version` `"0.5"`:

<!-- ogs-fragmento base=shansep-pop ruta=version esperado=error:materials[0].model~=~"shansep"~requiere~version~"0.6" esquema=rechaza -->
```json
"0.5"
```

### Búsqueda no circular (`analysis.search.non_circular`)

Un objeto opcional dentro de `analysis.search` que refina el círculo crítico a una polilínea. Es la variación alterna de
Celestino y Duncan (1981) tal como la implementa cSlope, con las diferencias de abajo.

```json
"search": { "type": "circular_entry_exit", "non_circular": { "seeds": 3, "max_vertices": 33 } }
```

| Campo | Significado | Rango |
|---|---|---|
| `seeds` | número de semillas (círculos de partida) | entero en [1, 10]; **3** por defecto |
| `max_vertices` | número máximo de vértices de la polilínea | `9`, `17` o `33`; **33** por defecto |

- Los dos campos son opcionales, `{}` es válido y `null` en `seeds` o en `max_vertices` equivale a omitirlo (el esquema 0.6
  y el motor lo admiten, como en los demás campos opcionales; E16z). El objeto rechaza campos desconocidos y exige `analysis.search`.
- **Bishop no se admite.** Con `non_circular` y `bishop` en `analysis.methods`, el error es
  `InvalidModel: el método bishop no se admite con analysis.search.non_circular (la superficie crítica es una polilínea)`.
  Quedan Spencer, Morgenstern-Price y los dos Janbu. La web deshabilita Bishop con esa razón.
- Exige `"0.6"`.

#### El algoritmo

Se aplica por método, después de la búsqueda circular de ese mismo método:

1. **Semillas.** La semilla 1 es el círculo crítico de la búsqueda circular, ya refinado. Las otras `seeds − 1` son los
   mejores círculos de la malla (entrada × salida × radio), en orden de (FS, índice); cada una debe diferir de **todas** las
   ya elegidas en más del 5 % del rango de la búsqueda, en la entrada o en la salida. Si no hay suficientes círculos
   distintos, se usan los que haya; `search.non_circular.seeds` dice cuántos.
2. **Conversión.** Cada semilla se convierte en una polilínea de **9 vértices** igualmente espaciados en x sobre el arco
   inferior, con los extremos exactamente sobre el terreno. Los extremos son los del **tramo que analiza el slicer** para ese
   círculo (la masa deslizante, sin el lente que se descarta bajo el pie), que en un círculo de la malla coinciden con su
   entrada y su salida (E16x; antes, 14 de 16 taludes homogéneos no evaluaban ninguna polilínea).
3. **Niveles.** 9, 17 y 33 vértices, insertando los puntos medios; se para en `max_vertices`.
4. **Variación alterna,** en cada nivel. El paso inicial es el 0,1 del segmento más corto. Cada vértice interior se mueve
   hacia arriba o hacia abajo sobre la bisectriz de las normales de sus dos segmentos, y cada extremo se mueve en x,
   siempre dentro de las ventanas `entry` y `exit` de la búsqueda (o del modelo, si faltan), con una holgura de
   `máx(tol, 1e-6·ancho)` (E16x). Por vértice se ajusta una
   parábola; se evalúan el movimiento conjunto de todos los vértices y el mejor movimiento individual, y se toma **el de
   menor F** de los dos. Una ronda mejora si F baja más de 1e-6; hasta 6 rondas por paso, y después de una sin mejora
   el paso se divide entre 2. El nivel termina cuando el paso baja a 1/50 del inicial.
5. **Presupuesto.** 1500 evaluaciones admisibles por semilla, sumando todos los niveles. Los candidatos inadmisibles no
   cuentan. **No hay pulido final** (la v0.7 lo agrega en la etapa global, [más abajo](#v07-búsqueda-global-no-circular)).
6. **Admisibilidad** de cada candidato, además de las reglas de una [polilínea fija](#polilínea-fija): `x` estrictamente
   creciente, vértices y segmentos bajo el terreno, y **concavidad**: cada tramo puede inclinarse a lo sumo 1° más que
   el anterior (`α_{i+1} ≤ α_i + 1°`, con `α_i = atan2(y_i − y_{i+1}, x_{i+1} − x_i)`). **La concavidad vale solo para los candidatos de la
   búsqueda;** una polilínea que usted fija no cambia. Un candidato sin FS convergido nunca es una mejora.
7. **Resultado por método: el mínimo entre la semilla 1 y la mejor polilínea refinada.** Con empate, gana el círculo. Si
   gana la polilínea, `surface` es una polilínea (`{ "points": [...] }`); si gana el círculo, es el círculo. Por eso el FS
   reportado **nunca** supera el de la búsqueda circular del mismo método.
8. **Determinismo.** No hay aleatoriedad y los desempates son por (FS, índice). El resultado es el mismo en dos corridas y
   con o sin la característica `parallel` del motor.

#### La salida de la búsqueda no circular

`search.non_circular` es `{ seeds, evaluated, seed_fos, polyline_fos }`:

| Campo | Significado |
|---|---|
| `seeds` | semillas usadas |
| `evaluated` | evaluaciones admisibles de la etapa no circular; a lo sumo `seeds × 1500` |
| `seed_fos` | el FS del círculo de la semilla 1, antes de refinar |
| `polyline_fos` | el FS de la mejor polilínea refinada; se omite si ninguna fue admisible |

`search.evaluated` y `search.valid` siguen contando la etapa circular. El `fos` del resultado es el mínimo entre
`seed_fos` y `polyline_fos`.

**Nota `non_circular_not_refined`** (informativa, E16x): se pidió `non_circular` y `evaluated` = 0, es decir, ninguna
polilínea fue admisible. El resultado es el círculo de la búsqueda circular, `polyline_fos` se omite y la nota dice «La
búsqueda no circular no encontró ninguna polilínea admisible: el resultado es el círculo de la búsqueda circular». Se emite
una vez por método.

**Nota `non_circular_large_change`** (informativa): `(seed_fos − fos)/seed_fos > 0,15`, el criterio de SLOPE/W. Es una
señal para revisar la geometría de la superficie crítica, no un error.

#### Ejemplo: V001, un talud homogéneo de 20 m

V001 (Arai y Tagyo, 1985, ejemplo 1; el programa A comercial publica 1,386 con búsqueda no circular). El círculo crítico da
Spencer 1,4021 y la polilínea de 33 vértices, **1,3839**: −1,3 % frente al círculo, +0,01 % frente a cSlope (1,3837) y −0,15 %
frente al publicado. Las 4500 evaluaciones son las 3 semillas × 1500. Con Janbu simplificado el círculo da 1,3185 y la
polilínea, 1,2525.

<!-- ogs-ejemplo nombre=nc-v001 estado=converged fos=spencer:1.3839,janbu_simplified:1.2525,janbu_corrected:1.3451 avisos=negative_effective_normal nc=spencer:seeds:3,spencer:evaluated:4500,spencer:seed_fos:1.4021,spencer:polyline_fos:1.3839 superficie=polilinea:33 -->
```json
{
  "format": "opengeoslide",
  "version": "0.6",
  "meta": {
    "id": "ejemplo-no-circular",
    "title": "V001 (Arai y Tagyo, 1985): talud homogéneo de 20 m con búsqueda no circular"
  },
  "units": "SI",
  "materials": [
    {
      "id": "soil",
      "name": "Soil",
      "model": "mohr_coulomb",
      "unit_weight": 18.82,
      "cohesion": 41.65,
      "friction_angle": 15.0
    }
  ],
  "regions": [
    {
      "material": "soil",
      "polygon": [[-30.0, 0.0], [-30.0, 15.0], [18.0, 15.0], [48.0, 35.0], [100.0, 35.0], [100.0, 0.0]]
    }
  ],
  "slope": { "direction": "auto" },
  "analysis": {
    "methods": ["spencer", "janbu_simplified", "janbu_corrected"],
    "slices": 50,
    "tolerance": 1e-05,
    "max_iterations": 500,
    "min_m_alpha": 0.2,
    "search": {
      "type": "circular_entry_exit",
      "entry": [0.0, 66.0],
      "exit": [0.0, 66.0],
      "n_entry": 20,
      "n_exit": 20,
      "n_radius": 20,
      "max_radius_factor": 5.0,
      "refine": true,
      "non_circular": { "seeds": 3, "max_vertices": 33 }
    }
  }
}
```

**Valores por defecto.** `{}` equivale a `seeds` 3 y `max_vertices` 33:

<!-- ogs-fragmento base=nc-v001 ruta=analysis.search.non_circular esperado=ok esquema=acepta estado=converged fos=spencer:1.3839,janbu_simplified:1.2525,janbu_corrected:1.3451 nc=spencer:seeds:3,spencer:evaluated:4500 superficie=polilinea:33 -->
```json
{}
```

`null` en un campo opcional equivale a omitirlo (E16z):

<!-- ogs-fragmento base=nc-v001 ruta=analysis.search.non_circular esperado=ok esquema=acepta estado=converged fos=spencer:1.3839,janbu_simplified:1.2525,janbu_corrected:1.3451 nc=spencer:seeds:3,spencer:evaluated:4500 superficie=polilinea:33 -->
```json
{ "seeds": null, "max_vertices": null }
```

**Una semilla y 9 vértices.** Una búsqueda más barata (419 evaluaciones) y menos refinada: Spencer da 1,3927:

<!-- ogs-fragmento base=nc-v001 ruta=analysis.search.non_circular esperado=ok esquema=acepta estado=converged fos=spencer:1.3927,janbu_simplified:1.2583,janbu_corrected:1.3515 nc=spencer:seeds:1,spencer:evaluated:419,spencer:polyline_fos:1.3927 superficie=polilinea:9 -->
```json
{ "seeds": 1, "max_vertices": 9 }
```

**Hasta 17 vértices** (3963 evaluaciones; Spencer 1,3855):

<!-- ogs-fragmento base=nc-v001 ruta=analysis.search.non_circular esperado=ok esquema=acepta estado=converged fos=spencer:1.3855,janbu_simplified:1.2527,janbu_corrected:1.3461 nc=spencer:evaluated:3963 superficie=polilinea:17 -->
```json
{ "seeds": 3, "max_vertices": 17 }
```

**Más semillas no siempre mejoran.** Con 10 semillas, el costo es de 15 000 evaluaciones y Spencer da el mismo 1,3839:

<!-- ogs-fragmento base=nc-v001 ruta=analysis.search.non_circular esperado=ok esquema=acepta estado=converged fos=spencer:1.3839,janbu_simplified:1.2525,janbu_corrected:1.3451 nc=spencer:seeds:10,spencer:evaluated:15000 superficie=polilinea:33 -->
```json
{ "seeds": 10, "max_vertices": 33 }
```

**Rechazos.** Sin semillas:

<!-- ogs-fragmento base=nc-v001 ruta=analysis.search.non_circular esperado=error:analysis.search.non_circular.seeds~debe~estar~en~[1,~10],~no~0 esquema=rechaza -->
```json
{ "seeds": 0 }
```

Con 11 semillas:

<!-- ogs-fragmento base=nc-v001 ruta=analysis.search.non_circular esperado=error:analysis.search.non_circular.seeds~debe~estar~en~[1,~10],~no~11 esquema=rechaza -->
```json
{ "seeds": 11 }
```

Con 20 vértices:

<!-- ogs-fragmento base=nc-v001 ruta=analysis.search.non_circular esperado=error:analysis.search.non_circular.max_vertices~debe~ser~9,~17~o~33,~no~20 esquema=rechaza -->
```json
{ "max_vertices": 20 }
```

Con Bishop. **Este rechazo es solo del motor** (E16n):

<!-- ogs-fragmento base=nc-v001 ruta=analysis.methods esperado=error:el~método~bishop~no~se~admite~con~analysis.search.non_circular esquema=acepta -->
```json
["bishop", "spencer"]
```

Con `version` `"0.5"`:

<!-- ogs-fragmento base=nc-v001 ruta=version esperado=error:analysis.search.non_circular~requiere~version~"0.6" esquema=rechaza -->
```json
"0.5"
```

#### Ejemplo: un cambio grande respecto del círculo (V050b)

ACADS 3(a) con una capa débil de 0,5 m (c 0, φ 10°): el mejor círculo da Spencer 1,5117, y la polilínea, que corre por la
base de la capa débil (cota 26,5) y sube a la cresta, da **1,2388**. El cambio es de 18,05 %, mayor que 15 %, y el motor
emite `non_circular_large_change`. El publicado es 1,246 (el programa A comercial, con tolerancia de 2,04 %):

<!-- ogs-ejemplo nombre=nc-v050b estado=converged fos=spencer:1.2388 avisos=non_circular_large_change,negative_effective_normal nc=spencer:seed_fos:1.5117,spencer:polyline_fos:1.2388 superficie=polilinea:33 -->
```json
{
  "format": "opengeoslide",
  "version": "0.6",
  "meta": {
    "id": "ejemplo-no-circular-capa-debil",
    "title": "ACADS 3(a) con capa débil: la polilínea baja el FS 18 % respecto del mejor círculo"
  },
  "units": "SI",
  "materials": [
    {
      "id": "soil_1",
      "name": "Soil 1",
      "model": "mohr_coulomb",
      "unit_weight": 18.84,
      "cohesion": 28.5,
      "friction_angle": 20.0
    },
    {
      "id": "weak_layer",
      "name": "Weak layer",
      "model": "mohr_coulomb",
      "unit_weight": 18.84,
      "cohesion": 0.0,
      "friction_angle": 10.0
    },
    {
      "id": "soil_1_below",
      "name": "Soil 1 below",
      "model": "mohr_coulomb",
      "unit_weight": 18.84,
      "cohesion": 28.5,
      "friction_angle": 20.0
    }
  ],
  "regions": [
    {
      "material": "soil_1",
      "polygon": [[20.0, 27.0], [20.0, 27.75], [43.0, 27.75], [67.5, 40.0], [84.0, 40.0], [84.0, 27.0]]
    },
    { "material": "soil_1_below", "polygon": [[20.0, 20.0], [20.0, 26.5], [84.0, 26.5], [84.0, 20.0]] },
    { "material": "weak_layer", "polygon": [[20.0, 26.5], [20.0, 27.0], [84.0, 27.0], [84.0, 26.5]] }
  ],
  "water": { "unit_weight": 9.807, "piezometric_line": [[20.0, 26.5], [84.0, 26.5]] },
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["spencer"],
    "slices": 50,
    "tolerance": 1e-05,
    "max_iterations": 500,
    "min_m_alpha": 0.2,
    "search": {
      "type": "circular_entry_exit",
      "n_entry": 20,
      "n_exit": 20,
      "n_radius": 20,
      "max_radius_factor": 5.0,
      "refine": true,
      "non_circular": { "seeds": 3, "max_vertices": 33 }
    }
  }
}
```

### Combinaciones no admitidas (v0.6)

Se rechazan antes de cortar dovelas, con `InvalidModel`:

| Combinación | Mensaje | Por qué |
|---|---|---|
| `bishop` con `analysis.search.non_circular` | `el método bishop no se admite con analysis.search.non_circular (la superficie crítica es una polilínea)` | el FS de Bishop en una superficie no circular depende de un eje de momentos sin significado físico |
| `tension_crack.depth = "auto"` con un material `hoek_brown` o `shansep` | `analysis.tension_crack.depth "auto" no se admite con materiales hoek_brown o shansep; use una profundidad fija` | la profundidad de Rankine necesita c y φ fijos |
| un pilote con `lateral_pressure` (Ito-Matsui) con un material `hoek_brown` o `shansep` | `lateral_pressure (Ito-Matsui) no se admite con materiales hoek_brown o shansep` | la fórmula de Ito-Matsui necesita c y φ fijos |

La grieta con **profundidad fija** sí se admite (ejemplo arriba). El arrancamiento `interface` de un refuerzo usa su propio
`friction_angle` y no cambia. Las tres son reglas que relacionan dos partes del documento: **las valida solo el motor**, y el
esquema las acepta.

Con una grieta automática:

<!-- ogs-fragmento base=hb-roca-sa ruta=analysis.tension_crack esperado=error:analysis.tension_crack.depth~"auto"~no~se~admite~con~materiales~hoek_brown~o~shansep;~use~una~profundidad~fija esquema=acepta -->
```json
{ "depth": "auto", "water_fill": 0.0 }
```

Con un pilote de Ito-Matsui:

<!-- ogs-fragmento base=hb-roca-sa ruta=reinforcements esperado=error:lateral_pressure~(Ito-Matsui)~no~se~admite~con~materiales~hoek_brown~o~shansep esquema=acepta -->
```json
[ { "type": "pile", "id": "P1", "x1": 21.0, "y1": 20.0, "x2": 21.0, "y2": 10.0, "spacing": 2.4, "application": "passive",
    "direction": "angle", "angle": 0, "lateral_pressure": { "model": "ito_matsui", "diameter": 0.8, "location": "centroid" } } ]
```

## v0.7: búsqueda global no circular

La versión `"0.7"` agrega `analysis.search.non_circular.global`: una etapa que **genera** superficies no circulares
propias y las refina, además del refinamiento desde los círculos de la v0.6. El esquema es
[`schema/ogs-0.7.schema.json`](../schema/ogs-0.7.schema.json). **Un modelo sin `global` da la misma salida, byte a byte,
que la 0.5.1** (con la versión del motor normalizada). **El resultado nunca empeora:** el refinamiento de la v0.6 se calcula
siempre, sin cambios, y la etapa global solo lo reemplaza si da un FS estrictamente menor y su superficie es elegible.

La v0.7 aún no está publicada. La última versión publicada, la 0.5.1, llega hasta el formato v0.6.

### Versión mínima 0.7

`analysis.search.non_circular.global` exige `"0.7"`. Con una versión menor, el error es

```
InvalidModel: analysis.search.non_circular.global requiere version "0.7"
```

Un `global: null` cuenta como ausente y no exige nada. Con `"0.7"` quedan abiertas todas las puertas anteriores: un modelo
0.7 admite Hoek-Brown, SHANSEP, refuerzos, grieta y lo demás. **La web** guarda `"0.7"` solo si el modelo tiene `global`.

### Campos

`global` es un objeto opcional dentro de `analysis.search.non_circular`. Todos sus campos son opcionales, no admite otros
campos y `{}` es válido: toma todos los valores por defecto.

| Campo | Tipo | Por defecto | Rango | Significado |
|---|---|---|---|---|
| `algorithm` | cadena | `"auto"` | `"auto"`, `"block"` o `"annealing"` | Con `auto`, corre `block` si el modelo tiene contactos entre regiones y `annealing` si no |
| `generated` | entero | `500` | [50, 2000] | Candidatos admisibles que se generan y evalúan |
| `seed` | entero | `0` | [0, 2^53 − 1] | Semilla del generador pseudoaleatorio |
| `polish` | booleano | `true` | — | Pulido final; solo corre si gana la etapa global |

- Un `null` en cualquiera de los cuatro campos equivale a omitirlo.
- **Bishop no se admite**, igual que con `non_circular` a secas: el error es el de la v0.6 y cubre `global`.
- `global` solo existe dentro de `non_circular`. El objeto `non_circular` puede ser `{ "global": {} }`: `seeds` y
  `max_vertices` toman sus valores por defecto (3 y 33).
- No hay reglas nuevas que crucen partes del documento.

### Cómo funciona

La etapa corre por método de cálculo, después de la búsqueda circular de ese método:

1. **El refinamiento de la v0.6, sin cambios.** Da el FS de referencia F₀ y su superficie.
2. **La generación,** según `algorithm`. Cada candidato admisible se evalúa con la guarda de tracción de más abajo.
   - **`block`** (bloque sobre una capa débil). La **capa** es el conjunto de aristas de contacto de la región de menor
     resistencia relativa, ρ = c / (γ · z) + tan φ, con z la profundidad bajo el terreno del centroide de la región. En
     `undrained`, ρ = Su(z) / (γ · z). Los materiales Hoek-Brown y SHANSEP no compiten en la elección de la capa, pero sus
     aristas sí cuentan como contactos. El generador traza 2 o 3 segmentos sobre la capa y los une al terreno con dos
     proyecciones inclinadas entre 15° y 75° sobre la horizontal. Muestrea con una secuencia de Halton, y la semilla es una
     **rotación de Cranley-Patterson** de esa secuencia (la semilla 0 no rota). Con `block` explícito y sin contactos, usa
     las «bases» (aristas no verticales cuyo lado exterior queda fuera de todas las regiones) y no recurre al recocido.
   - **`annealing`** (recocido simulado). Parte de la polilínea de 9 vértices del círculo semilla 1 y perturba las
     profundidades de sus 7 vértices interiores, con enfriamiento geométrico y criterio de Metropolis sobre el FS elegible.
     El círculo de partida se evalúa, pero no cuenta como candidato.
   - **`auto`** elige `block` solo si hay aristas de contacto entre regiones. Si el bloque agota sus intentos
     (20·`generated`) sin ningún candidato admisible, `auto` corre `annealing` con el mismo `generated`, e informa
     `"annealing"`. Un talud homogéneo no tiene contactos: corre `annealing`.
3. **La selección y el descarte sucesivo.** Se toman los 4 mejores candidatos elegibles, con entradas y salidas distintas
   (la regla del 5 % del rango de la búsqueda). Cada uno recibe un refinamiento corto de 60 evaluaciones y quedan 3; luego,
   uno de 150 y queda 1. Ese uno recibe el refinamiento completo de la v0.6 (niveles de 9, 17 y 33 vértices y 1500
   evaluaciones).
4. **La comparación.** Si el FS del candidato refinado es menor que F₀ − 1e-6, gana `global`. Si `polish` es `true`, la
   superficie se pule: hasta 4 ciclos, mientras la ganancia del ciclo supere 0,001, con un presupuesto de 3000 evaluaciones.
   Si no, gana `refinement` y no se pule.
5. **El reporte** (véase abajo).

**Presupuesto.** Con los valores por defecto, la etapa global evalúa a lo sumo 500 + 4·60 + 3·150 + 1500 + 3000 = **5690**
candidatos (más el círculo de partida del recocido). En los 53 modelos medidos, el máximo fue 4064. La búsqueda circular y el
refinamiento de la v0.6 se suman aparte.

**La guarda de tracción.** Una búsqueda global puede hallar superficies en la rama con tracción (la raíz de λ de E12e),
con un FS bajo que no existe. Por eso un candidato solo es elegible si la solución converge **y** sus notas no incluyen
`negative_lambda` ni `negative_effective_normal_major`. No compite, el optimizador lo trata como inválido y cuenta en
`tension_rejected`. Las notas `negative_effective_normal` y `multiple_admissible_roots` no excluyen. El refinamiento de la
v0.6 no se toca: su comportamiento con λ < 0 sigue siendo el de la v0.6 y se sigue informando.

**Determinismo.** El generador es SplitMix64, sin dependencias nuevas. El resultado es el mismo en dos corridas y con o sin la
característica `parallel` del motor, byte a byte. La igualdad entre el motor nativo y WASM no se promete: en V053 y S2 el FS
coincidió a 7e-16.

### La salida de la búsqueda global

`search.non_circular.global` solo aparece si hay `global` en la entrada. Sus 11 campos:

| Campo | Tipo | Significado |
|---|---|---|
| `algorithm` | cadena | El algoritmo que corrió: `"block"` o `"annealing"`. Nunca `"auto"` |
| `generated` | entero | Candidatos admisibles generados y evaluados (≤ `generated` de la entrada) |
| `attempts` | entero | Intentos geométricos, incluidos los no admisibles (≤ 40·`generated`) |
| `converged` | entero | Candidatos con solución convergida |
| `eligible` | entero | Convergidos que pasan la guarda de tracción |
| `tension_rejected` | entero | Convergidos que rechazó la guarda: `converged = eligible + tension_rejected` |
| `refined` | entero | Polilíneas del generador que recibieron el refinamiento completo (hoy, 1 si hubo candidatos) |
| `evaluated` | entero | Evaluaciones del motor en toda la etapa global: generación, refinamiento y pulido |
| `polish_evaluated` | entero | Evaluaciones del pulido (0 si no corrió) |
| `global_fos` | número o `null` | El mejor FS elegible de la etapa global, después de refinar y pulir; `null` si no hubo ninguno |
| `winner` | cadena | `"global"` o `"refinement"` |

- `seeds`, `evaluated`, `seed_fos` y `polyline_fos`, del nivel de `search.non_circular`, siguen significando lo mismo que en
  la v0.6: describen el refinamiento. El `evaluated` de `global` es aparte.
- **La superficie crítica es la del ganador:** una polilínea (`{ "points": [...] }`). Si gana `"refinement"`, es la misma que
  en la v0.6.
- Con `winner = "refinement"`, `global_fos` es el mejor FS elegible del generador, sin pulir, y puede ser mayor que el `fos`
  del resultado.

**Dos notas nuevas,** en el lugar de las notas del método (`warnings`):

- **`non_circular_global_no_candidates`:** `eligible = 0`. El generador no dio ninguna superficie elegible y el resultado es el
  del refinamiento. Pasa, por ejemplo, en un talud sin círculo semilla elegible para el recocido.
- **`non_circular_global_tension_rejected`:** la guarda rechazó al menos una superficie con un FS menor que el reportado. Hay
  un FS menor en la rama con tracción, y no se tomó. No es un error: compare con la búsqueda circular y revise N′ por
  dovela.

#### Ejemplo: V053, un talud con una capa débil

V053 (Greco, 1996, ejemplo 5): el programa A comercial publica 1,01 con una búsqueda no circular. El mejor círculo da Spencer
1,0917 y el refinamiento de la v0.6, 1,0847 (+7,4 % sobre el publicado). Con `global: {}`, el bloque halla el mecanismo de la
capa débil y Spencer da **1,0103** (+0,02 % frente a cSlope, que evalúa esa misma polilínea en 1,0101):

<!-- ogs-ejemplo nombre=global-v053 estado=converged fos=spencer:1.0103 nc=spencer:seeds:3,spencer:evaluated:4500,spencer:seed_fos:1.0917,spencer:polyline_fos:1.0847 superficie=polilinea:33 -->
```json
{
  "format": "opengeoslide",
  "version": "0.7",
  "meta": {
    "id": "ejemplo-busqueda-global",
    "title": "V053 (Greco, 1996, ejemplo 5): talud con una capa débil y búsqueda global"
  },
  "units": "SI",
  "materials": [
    {
      "id": "layer_1",
      "name": "Layer 1",
      "model": "mohr_coulomb",
      "unit_weight": 20.0,
      "cohesion": 9.8,
      "friction_angle": 35.0
    },
    {
      "id": "layer_2",
      "name": "Layer 2",
      "model": "mohr_coulomb",
      "unit_weight": 19.0,
      "cohesion": 58.8,
      "friction_angle": 25.0
    },
    {
      "id": "layer_3",
      "name": "Layer 3",
      "model": "mohr_coulomb",
      "unit_weight": 21.5,
      "cohesion": 19.8,
      "friction_angle": 30.0
    },
    {
      "id": "layer_4",
      "name": "Layer 4",
      "model": "mohr_coulomb",
      "unit_weight": 21.5,
      "cohesion": 9.8,
      "friction_angle": 16.0
    }
  ],
  "regions": [
    {
      "material": "layer_1",
      "polygon": [[100.0, 40.0], [145.0, 70.0], [240.0, 70.0], [240.0, 55.0], [190.0, 55.0]]
    },
    {
      "material": "layer_2",
      "polygon": [[75.0, 30.0], [95.0, 40.0], [100.0, 40.0], [190.0, 55.0], [240.0, 55.0], [240.0, 30.0]]
    },
    {
      "material": "layer_3",
      "polygon": [[0.0, 0.5], [0.0, 20.0], [55.0, 20.0], [75.0, 30.0], [240.0, 30.0], [240.0, 15.5], [150.0, 15.5]]
    },
    {
      "material": "layer_4",
      "polygon": [[0.0, 0.0], [0.0, 0.5], [150.0, 15.5], [240.0, 15.5], [240.0, 15.0], [150.0, 15.0]]
    }
  ],
  "water": { "unit_weight": 9.807, "piezometric_line": [[0.0, 20.0], [55.0, 20.0], [75.0, 30.0], [95.0, 40.0], [100.0, 40.0], [190.0, 55.0], [240.0, 55.0]] },
  "slope": { "direction": "right_to_left" },
  "analysis": {
    "methods": ["spencer"],
    "slices": 50,
    "tolerance": 1e-05,
    "max_iterations": 500,
    "min_m_alpha": 0.2,
    "search": {
      "type": "circular_entry_exit",
      "entry": [145.0, 240.0],
      "exit": [0.0, 55.0],
      "n_entry": 20,
      "n_exit": 20,
      "n_radius": 20,
      "max_radius_factor": 5.0,
      "refine": true,
      "non_circular": { "seeds": 3, "max_vertices": 33, "global": {} }
    }
  }
}
```

El informe de `ogs analyze` para ese modelo (aquí sin `surface` ni `slices`; la superficie es una polilínea de 33 vértices,
de (29,15; 20,0) a (164,37; 70,0)):

```json
{
  "method": "spencer",
  "fos": 1.010300223400116,
  "status": "converged",
  "iterations": 43,
  "lambda": 0.24921243035715315,
  "search": {
    "evaluated": 10561,
    "valid": 8207,
    "non_circular": {
      "seeds": 3,
      "evaluated": 4500,
      "seed_fos": 1.0916705168536467,
      "polyline_fos": 1.0847376214469184,
      "global": {
        "algorithm": "block",
        "generated": 500,
        "attempts": 3259,
        "converged": 202,
        "eligible": 202,
        "tension_rejected": 0,
        "refined": 1,
        "evaluated": 3349,
        "polish_evaluated": 659,
        "global_fos": 1.010300223400116,
        "winner": "global"
      }
    }
  },
  "warnings": []
}
```

Se lee así: de 500 candidatos admisibles (3259 intentos), 202 convergieron y los 202 pasaron la guarda. Uno se refinó, y el
pulido gastó 659 evaluaciones. `global_fos` (1,0103) es menor que `polyline_fos` (1,0847), así que gana `global`.

#### Valores y variantes

`{}` equivale a `auto`, 500 candidatos, semilla 0 y pulido. Los campos `null` también:

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=ok esquema=acepta estado=converged fos=spencer:1.0103 nc=spencer:seeds:3,spencer:evaluated:4500 superficie=polilinea:33 -->
```json
{ "algorithm": null, "generated": null, "seed": null, "polish": null }
```

**Recocido.** El recocido no usa el contacto con la capa débil. En V053, Spencer da 1,0844, casi el del refinamiento:

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=ok esquema=acepta estado=converged fos=spencer:1.0844 superficie=polilinea:33 -->
```json
{ "algorithm": "annealing" }
```

**Menos candidatos.** Con 100, la etapa global cuesta menos (2699 evaluaciones) y en V053 da 1,0079. **No es una regla:** más
candidatos no garantizan un FS menor, porque el orden de los candidatos crudos predice mal el FS refinado.

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=ok esquema=acepta estado=converged fos=spencer:1.0079 superficie=polilinea:33 -->
```json
{ "generated": 100 }
```

**Otra semilla.** El resultado cambia con la semilla, y es el mismo con la misma semilla. Con 48 semillas (de 0 a 47), V053
dio de 1,0029 a 1,0239, todas dentro de la banda publicada (véase [Verificación](verificacion.md#búsqueda-global-no-circular-v07)):

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=ok esquema=acepta estado=converged fos=spencer:1.0068 superficie=polilinea:33 -->
```json
{ "seed": 12345 }
```

**Sin pulido.** En V053 el pulido cuesta 659 evaluaciones y baja el FS en 0,0001 (1,0104 sin pulir):

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=ok esquema=acepta estado=converged fos=spencer:1.0104 superficie=polilinea:33 -->
```json
{ "polish": false }
```

**`global: null`** cuenta como ausente: el resultado es el del refinamiento de la v0.6 (1,0847) y no hay objeto `global` en
la salida:

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=ok esquema=acepta estado=converged fos=spencer:1.0847 superficie=polilinea:33 -->
```json
null
```

**Con otros métodos.** Spencer, Morgenstern-Price y los dos Janbu admiten `global`; Bishop no.

#### Ejemplo de la nota `non_circular_global_tension_rejected`: V051

V051 con `global: {}` (`verification/global/models/V051.json`, con la versión cambiada a `"0.7"`). Gana `refinement` con
0,7071 (el publicado es 0,707). El generador halló 306 candidatos convergidos, de los cuales la guarda rechazó 32 por tracción,
y el mejor elegible dio 0,7285: no mejora al refinamiento. Las notas del método:

```
load_outside_mass, negative_effective_normal, non_circular_large_change, non_circular_global_tension_rejected
```

Sin la guarda, el generador habría tomado una superficie con un FS de 0,630, que cSlope evalúa en 1,048 (X37 §4.2).

#### Rechazos

Con 49 candidatos, el mínimo es 50:

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=error:analysis.search.non_circular.global.generated~debe~estar~en~[50,~2000] esquema=rechaza -->
```json
{ "generated": 49 }
```

Con 2001 candidatos:

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=error:analysis.search.non_circular.global.generated~debe~estar~en~[50,~2000] esquema=rechaza -->
```json
{ "generated": 2001 }
```

Con una semilla fuera de [0, 2^53 − 1]:

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=error:analysis.search.non_circular.global.seed~debe~estar~en~[0,~9007199254740991] esquema=rechaza -->
```json
{ "seed": 9007199254740992 }
```

Con un algoritmo que no existe (el recorrido de rutas, *path search*, no está en la v0.7):

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=error:unknown~variant~`path` esquema=rechaza -->
```json
{ "algorithm": "path" }
```

Con un campo desconocido:

<!-- ogs-fragmento base=global-v053 ruta=analysis.search.non_circular.global esperado=error:unknown~field~`foo` esquema=rechaza -->
```json
{ "foo": 1 }
```

Con `version` `"0.6"`:

<!-- ogs-fragmento base=global-v053 ruta=version esperado=error:analysis.search.non_circular.global~requiere~version~"0.7" esquema=rechaza -->
```json
"0.6"
```

Con Bishop. **Este rechazo es solo del motor:**

<!-- ogs-fragmento base=global-v053 ruta=analysis.methods esperado=error:el~método~bishop~no~se~admite~con~analysis.search.non_circular esquema=acepta -->
```json
["bishop", "spencer"]
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
- **refuerzos**: `id` único, longitud `L > 0`, `x1 = x2` en una `sheet_pile` y `bonded_length ≤ L`;
- **pilotes de Ito-Matsui**: exactamente uno de `force` y `lateral_pressure`, `capacity` solo con `lateral_pressure`,
  pilote vertical y `spacing > diameter`. El esquema sí rechaza un `capacity` vacío y un `model` o `location` fuera de
  su enumeración.
- **Hoek-Brown y SHANSEP (v0.6):** los rangos de cada campo, los campos requeridos y los prohibidos de cada `model`, y
  «exactamente uno de» `ocr`, `pop` u `ocr_by_elevation` (con `oneOf`) los validan el esquema y el motor, con las mismas
  reglas. **Solo el motor** valida la `y` estrictamente creciente de `ocr_by_elevation` (E16n): el esquema comprueba que la
  tabla tenga al menos 2 filas y que cada OCR sea ≥ 1, pero no compara valores entre sí, como tampoco compara `x1 < x2`.
- **Búsqueda no circular (v0.6):** el esquema valida los rangos de `seeds` (entero en [1, 10]) y de `max_vertices` (9, 17 o
  33), y la puerta de versión. **Solo el motor** valida las reglas que relacionan dos partes del documento
  ([Combinaciones no admitidas](#combinaciones-no-admitidas-v06)): Bishop con `non_circular`, la grieta de profundidad
  `"auto"` con un material `hoek_brown` o `shansep`, y un pilote de Ito-Matsui con esos materiales (E16n).
- **Búsqueda global (v0.7):** el esquema valida los rangos de `generated` (entero en [50, 2000]) y de `seed` (entero en
  [0, 2^53 − 1]), la enumeración de `algorithm`, el tipo de `polish`, los campos desconocidos y la puerta de versión. **Solo el
  motor** valida Bishop con `non_circular` (que cubre `global`).

## Cómo se validan los ejemplos

Cada bloque `json` de esta página precedido por un comentario `ogs-ejemplo` u `ogs-fragmento` se prueba con
[`docs/tools/validar_ejemplos.py`](tools/validar_ejemplos.py): los ejemplos completos contra
`schema/ogs-0.7.schema.json` y con `ogs analyze` (estado de cada método y, donde se cita, el FS a 4 decimales, los
`status` de `reinforcement_forces`, los avisos, el objeto `tension_crack` del informe, los campos `soil_force`, `governs` y `arm` del cruce de un pilote de Ito-Matsui, y, en la v0.6, `strength.passes`, la `law` y los `vertical_stress` y `ocr` de `strength.slices`, el objeto `search.non_circular` y que la superficie crítica sea una polilínea de a lo sumo `max_vertices` vértices; en la v0.7, el ejemplo de la búsqueda global); los fragmentos, sustituidos en su ejemplo base, con el resultado
esperado del motor y del esquema.

```sh
cargo build --release -p ogs-cli
env -u PYTHONPATH -u PYTHONHOME uv run -q --no-project --with jsonschema \
  python docs/tools/validar_ejemplos.py --schema schema/ogs-0.7.schema.json
```
