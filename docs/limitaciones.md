# Limitaciones

OpenGeoSlide es software en desarrollo y no es una herramienta certificada. Esta página reúne lo que **no** hace la
versión actual (con la Fase 3a: formato v0.3, material no drenado, superficies polilínea, Morgenstern-Price y Janbu),
los avisos que muestra la aplicación y las limitaciones numéricas conocidas del motor. El resumen está en el
[README](../README.md#limitaciones-conocidas), y la aplicación lo enlaza desde su Ayuda.

## Alcance: lo que la versión actual no hace

- **Solo equilibrio límite en 2D**, con **Bishop simplificado**, **Spencer**, **Morgenstern-Price** y **Janbu**
  (simplificado y corregido). No calcula deformaciones, ni análisis en tres dimensiones, ni flujo de agua: el agua entra
  como línea piezométrica o como coeficiente `ru`.
- **La búsqueda automática es solo circular** (entrada y salida). Las superficies no circulares se **fijan a mano**
  como polilínea; no hay búsqueda no circular (queda para la Fase 3b, véase [más abajo](#lo-que-queda-para-la-fase-3b)).
- **Solo dos modelos de resistencia:** Mohr-Coulomb (peso unitario, cohesión y ángulo de fricción, con `unit_weight_sat`
  y `ru` opcionales) y **no drenado** (φ = 0, Su constante o lineal con la cota). No hay Hoek-Brown ni SHANSEP.
- **Sin refuerzos.** No hay geosintéticos, anclajes, clavos, pilotes ni tablestacas en el formato ni en el motor.
  OpenGeoSlide **no sirve para diseñar muros de tierra mecánicamente estabilizada (TEM) ni otras estructuras de
  contención**: solo para revisar la estabilidad global con el muro modelado como una región de suelo con sus propiedades
  equivalentes.
- **Sin grieta de tracción ni agua embalsada** (agua sobre el terreno).
- **Sismo solo pseudoestático** (`kh` y `kv`, aplicados al peso del suelo, nunca a las cargas) y **cargas solo `udl` y
  `line`**. No hay análisis dinámico ni de desplazamientos.
- **No está en PyPI ni en crates.io**: se instala desde la web, desde el código fuente o desde los assets del
  [GitHub Release](https://github.com/nibaldox/OpenGeoSlide/releases).

## Fase 3a: límites de las capacidades nuevas

### Bishop solo en círculos

`bishop` con una superficie polilínea es `InvalidModel: el método 'bishop' solo admite superficies circulares; use
spencer, morgenstern_price o janbu`. El FS de Bishop en una superficie no circular depende del eje de momentos, que no
tiene significado físico; cSlope lo calcula con el aviso `bishop-non-circular`, pero OpenGeoSlide no entrega un FS que
dependa de un parámetro arbitrario. En la web, la casilla de Bishop queda deshabilitada con una polilínea y explica por
qué. Con `analysis.search` (círculos), Bishop sigue disponible.

### Ajuste de la polilínea al terreno: primer cruce

Cada extremo de la polilínea se prolonga hasta su **primer cruce** con el terreno (o se recorta en él), a diferencia de
cSlope, que rechaza la polilínea cuando la recta vuelve bajo el terreno en la pared. Consecuencias:

- Una polilínea que sale por una cara y vuelve a entrar es `polyline_outside_ground`.
- **Cara vertical del terreno:** la prolongación termina en la cara, a la ordenada de la recta. Una polilínea que
  atraviesa la cara y sigue sobre el terreno más bajo **no se corta en la cara**: es `polyline_outside_ground`. cSlope
  descarta el resto de la polilínea y analiza el primer bloque; OpenGeoSlide no.
- Un vértice interior sobre el terreno, o un tramo sobre un valle, también es `polyline_outside_ground`.
- Si la prolongación sale del rango x del modelo sin cortar el terreno: `polyline_no_ground_crossing`.
- No se exige concavidad en la superficie.

Los ejemplos están en [`formato-ogs-json.md`](formato-ogs-json.md#polilínea-fija).

### ξ en la x del modelo y el espejo solo con f simétrica

En Morgenstern-Price, `ξ = (x − x₀)/(x₁ − x₀)` crece con la x del modelo, sea cual sea el sentido de deslizamiento
(igual que en cSlope). `x₀` y `x₁` se miden sobre el **bloque de suelo**: las dovelas aéreas de los extremos conservan
ξ = 0 o ξ = 1. Por eso:

- Reflejar el modelo (x → −x) y el sentido de deslizamiento da el **mismo FS solo con funciones simétricas**:
  `constant`, `half_sine`, `clipped_sine`, `trapezoidal` y un `data_points` simétrico.
- Con una función **asimétrica** el FS cambia al reflejar el modelo. Es lo esperado, no un error.

### Guarda m_α en tramos empinados de una polilínea

Una polilínea con un tramo muy empinado puede dar `m_α < min_m_alpha` (0,2 por omisión) en la base de una dovela y se
rechaza como `invalid` con el código `m_alpha`. cSlope no aplica esta guarda: puede entregar un FS donde OpenGeoSlide
declara la superficie inválida. **Se mantiene la guarda** (E4b), que descarta las bases con `m_α` casi nulo. Si
necesita analizar esa superficie, suavice el tramo (más vértices, o una inclinación menor) y compare con Janbu.
Ejemplo reproducible: un tramo que baja 4 m en 0,5 m ([`formato-ogs-json.md`](formato-ogs-json.md#polilínea-fija)).

### Aviso `interslice_shear_exceeds_strength`

**Qué es.** En polilíneas con forma de V (un tramo largo y empinado, de 44° a 66°, paralelo al talud, que deja una losa
delgada en el flanco activo, y un tramo corto que sube hacia el pie), Spencer y Morgenstern-Price pueden **converger**
con FS de 49 a 130 mientras Janbu da entre 4 y 5, y cSlope no converge
([`docs/fase3/d1/DIAGNOSTICO.md`](fase3/d1/DIAGNOSTICO.md)). No es un error de código: son soluciones de equilibrio
válidas (cierre de 1e-11, una sola raíz admisible, sin tracción entre dovelas ni N′ negativos), pero **estáticamente
inadmisibles**: la masa se sostiene por el cortante entre dovelas `X = λ·f·E` y no por la resistencia de la base (en los
tres casos de D-1, el cortante basal movilizado es del orden de 1 % de ΣW). Un FS así es **no conservador**.

**Criterio.** El de Chen y Morgenstern (1983), en la forma (d) de Zhu, Lee y Jiang (2003): el cortante entre dovelas no
debe exceder la resistencia movilizable en las caras verticales.

```
r_v = máx sobre las caras de |X|·F / (c_v·h + máx(E′, 0)·tan φ_v)
```

- `X = λ·f·E` y `E′ = −E − P_w` (compresión positiva); `h` es la altura de la cara, de la base al terreno; `c_v` es el
  promedio en altura de c (Su en no drenado) y `tan φ_v` el promedio en altura de tan φ, de los materiales que cruza la
  cara.
- Solo cuentan las caras con `|E| ≥ 2 %` del máximo de `|E|` y `E′ > 0`. Se **excluyen las caras sin resistencia**
  (`c_v·h + E′·tan φ_v = 0`, como un material de Su = 0).

**Clasificación.** Con `r_v > 3`, el motor emite el aviso `interslice_shear_exceeds_strength` (severidad *aviso*, no
informativo) en Spencer y en M-P. En Janbu no aplica (X = 0).

- El umbral 3 es una **clasificación de avisos calibrada** (como la de E8c), no una tolerancia: queda entre el máximo
  de los casos de referencia (1,63, D13) y el mínimo de las soluciones absurdas (3,88). Los tres casos de D-1 dan
  `r_v` = 122, 34 y 53.
- **No se rechaza la solución**: la bibliografía respalda la comprobación, no un umbral de rechazo. Tampoco hay una nota
  con `r_v > 1`, porque la tendrían 18 de 119 resultados publicados que sí reproducen su valor.
- **Efecto medido:** ningún caso de verificación ni modelo de la batería recibe el aviso.
- **Qué hacer.** El texto de la aplicación: «Las fuerzas de corte entre dovelas superan la resistencia de las caras
  verticales (Chen y Morgenstern, 1983): este FS puede no ser físico. Compárelo con Janbu o revise la forma de la
  superficie.» Un FS de Spencer o M-P varias veces mayor que el de Janbu sobre la misma polilínea es una señal de
  alarma aunque el aviso no salga.
- **Alcance del fenómeno.** En el barrido de D-1 (polilíneas aleatorias admisibles sobre un talud 1:1 de 10 m), de las
  polilíneas en que Spencer y Janbu convergen, el FS de Spencer supera 3·F₀ de Janbu en 198 de 1735 (11 %) con un
  estrato no drenado y en 281 de 1761 (16 %) con suelo homogéneo (`DIAGNOSTICO.md`, §3). Es un riesgo de las
  polilíneas, no de los círculos.

### Janbu: raíz de F₀ y corrección empírica

- F₀ de Janbu es la **menor raíz admisible**, con la nota `multiple_admissible_roots` si hay más de una (E13j-4), igual
  que Spencer (E12e). Dos raíces dentro de un mismo paso de la malla de búsqueda de la raíz no se distinguen.
- Janbu **simplificado** no usa la ecuación de momento. El **corregido** multiplica por un factor empírico
  `f₀ = 1 + b₁·(d/L − 1,4·(d/L)²)`, informado como `correction_factor`; `L` y `d` se miden sobre el **bloque de suelo**
  (sin las dovelas aéreas de los extremos), como en cSlope.

### Material no drenado

- La resistencia Su se evalúa en el **punto medio de la base** de cada dovela, con `tan φ = 0`.
- `strength_datum` es una **cota**, no una profundidad. Un gradiente negativo (Su decrece hacia abajo) es válido.
- `ru` no cambia la resistencia de un material no drenado, porque φ = 0.
- Un material con Su = 0 no aporta resistencia: sus caras quedan excluidas del criterio `r_v`.
- No hay SHANSEP ni Su dependiente de la tensión efectiva (queda para la Fase 3b).

## Checks retenidos y casos especiales

Los casos publicados de cSlope que el motor no reproduce **no se promueven** a `verification/cases/`; se listan con su
diagnóstico en [`verification/pending/`](../verification/pending/INDEX.md). No se relaja ninguna tolerancia ni se toca
ningún dato.

### V027, V028 y V068: retenidos por `negative_effective_normal_major`

El FS reproduce el valor publicado, pero el motor emite el aviso no informativo `negative_effective_normal_major` y la
aceptación rechaza todo aviso que no sea informativo (E5). El aviso sale por la fracción `f = Σ|N′<0| / ΣW` (peso del
bloque), con umbral 0,05:

| Caso | FS publicado | FS de ogs | Dovelas con N′ < 0 | f | Fuente |
|---|---:|---:|---|---:|---|
| V027 y V028 | 1,126 (tol 2,04 %) | 1,1234 (−0,23 %) | 4 | 0,094 | [`pending/lote0`](../verification/pending/lote0/INDEX.md) |
| V068 | 1,14 (tol 2,44 %) | 1,1633 (+2,04 %) | 3 de 55 | 0,204 | [`pending/F3`](../verification/pending/F3/INDEX.md) |

Son las bases del pie de un círculo de φ = 0 con cohesión alta (V027 y V028) y la escarpa vertical del extremo superior
(V068), que cSlope también declara sensible al corte. La decisión del coordinador fue **dejarlos retenidos**. Con el
aviso tratado como informativo, los tres entrarían dentro de la tolerancia.

### V032a: un mínimo real, más conservador, que sale de los rangos efectivos

La búsqueda de OpenGeoSlide encuentra en V032a un mínimo **real** con FS 1,1706 (Bishop y Spencer iguales), por debajo
del publicado (1,23, 1,209 y 1,21 en las tres referencias) y del que cSlope entrega en su búsqueda (1,2240).

- **Qué es.** Una masa casi plana, de talud infinito en el relleno sin cohesión (c = 0, φ = 30°, α de 20,8° a 31,0°):
  un círculo de gran radio (`xc −40,524`, `yc 223,497`, `r 221,416`), no el círculo profundo publicado.
- **cSlope lo confirma sobre el mismo círculo:** 1,17055 frente a 1,17056 de ogs (Δ = 5e-6), con la misma masa. El
  círculo que encuentra cSlope (`xc 54,267`, `yc 43,856`, `r 43,855`) da 1,2245 en ogs sobre ese círculo fijo (+0,04 %).
  La diferencia está en qué superficie halla cada búsqueda, no en el cálculo.
- **Sale de los rangos efectivos.** La cuerda del círculo cruza el terreno justo en el borde del rango de salida
  [0, 34] y entra en el borde del de entrada; entre 34 y 37,78 el arco asoma 0,36 m sobre el terreno y el lente del pie
  se descarta (`truncated_mass`). La masa analizada termina en x = 37,78, 3,78 fuera del rango de salida
  (`effective_ends_outside_range`). Con salida [0, 33] el motor da 1,1718; con [0, 30], 1,1748; con [0, 20], 1,1791.
- **Por qué no se corrige.** Filtrar por extremos efectivos (en lugar de la regla de la cuerda de E10a y E11) sube el
  mínimo hacia el publicado, pero dejó una búsqueda +22 % sobre cSlope en un caso de dos bancos. Se mantiene la regla de
  la cuerda. El caso queda retenido ([`pending/lote0`](../verification/pending/lote0/INDEX.md)).

Si el aviso `effective_ends_outside_range` aparece en su modelo, revise si la superficie crítica corresponde al
mecanismo que usted busca y acote los rangos o fije `search.min_width`.

## Lo que queda para la Fase 3b

La Fase 3b tendrá su propio bloque de enmiendas. Hoy **no** existe:

- **Búsqueda no circular** (refinamiento de Celestino y Duncan): hoy la polilínea se fija a mano.
- **Hoek-Brown generalizado** (cSlope lo tiene: `kind "hoek-brown"`, con σci en `ucs`).
- **SHANSEP.** Por ejemplo, V105a usa un material `shansep`.
- El caso publicado de Hammah et al. (2005b).

## Lo que queda para el bloque de refuerzos

El bloque de refuerzos (formato v0.4) está planeado en
[`docs/fase3/PLAN_REFUERZOS.md`](fase3/PLAN_REFUERZOS.md) y empieza al publicarse la v0.2.0. Hoy **no** hay:

- **Tablestacas** (en voladizo o ancladas), **pilotes y micropilotes**, **anclajes**, **clavos de suelo** y
  **geosintéticos** (geomallas y geotextiles).
- Cuando existan, la tablestaca se revisará solo por **estabilidad global**: el equilibrio límite no cubre el empuje
  sobre la tablestaca, el empotramiento necesario, el momento flector ni la deflexión; para eso hace falta un cálculo
  de muro, de vigas sobre resortes o por elementos finitos.

Después del bloque, el plan recomienda la **grieta de tracción** y el **agua embalsada**, que desbloquean otros casos
publicados.

Los problemas de cSlope con refuerzos, pilotes, grieta de tracción o agua embalsada que el importador no convierte
están en [`verification/pending/F3/INDEX.md`](../verification/pending/F3/INDEX.md), con el motivo de cada uno.

## Avisos geotécnicos de la aplicación

Estos casos están cubiertos por avisos en «Diagnósticos» y en el informe PDF:

- **`unit_weight_sat` (γsat) no está verificado frente a otro programa.** Ninguno de los 93 casos de verificación lo
  usa ([índice de casos](../verification/cases/INDEX.md)). Cada modelo que lo usa lleva un aviso en Diagnósticos y en
  el informe.
- **La piezométrica se prolonga en horizontal hasta los bordes del modelo** cuando no cubre todo su ancho, con el nivel
  de su extremo más cercano. Se dibuja punteada y la leyenda dice «Piezométrica (extrapolada)».
- **`ru` tiene precedencia sobre la piezométrica:** si un material tiene `ru` y el modelo también tiene línea
  piezométrica, ese material usa `ru` y la piezométrica no se aplica.
- **Unidades imperiales con piezométrica:** el peso unitario del agua (γw) debe ser explícito y no menor que 20 pcf
  (se usa 62,4 pcf). Un valor como 9,81 es de kN/m³ y bloquea el cálculo, tanto en el editor como en «Casos».
  El motor nunca convierte unidades: interpreta los números en las unidades declaradas. Al cambiar de sistema, la web
  ofrece convertir los valores del modelo (el FS no cambia) o cambiar solo la etiqueta.
- **Convenciones de signo:** `kh` positivo va en el sentido del deslizamiento y `kv` positivo hacia abajo; el ángulo de
  la carga lineal se mide desde la vertical, positivo hacia +x. Otros programas pueden usar el signo contrario para
  `kv`: compare con cuidado. El informe PDF repite las convenciones.
- **Cargas puntuales o lineales:** pueden generar círculos diminutos con FS muy bajo bajo ellas. Fije un «ancho mínimo»
  de búsqueda y revise aparte la capacidad de soporte local.
- **Aviso de cortante entre dovelas** (`interslice_shear_exceeds_strength`): véase
  [arriba](#aviso-interslice_shear_exceeds_strength).

## Limitaciones numéricas conocidas del motor

Limitaciones que las revisiones adversariales ([`docs/reviews/`](reviews/)) dejaron abiertas, más las que dejó la
verificación de la ola B. Cada una indica el síntoma y el aviso que lo acompaña. Ninguna cambia la aceptación (213/213
checks en 93 casos, [`verification/REPORT.md`](../verification/REPORT.md)) ni la batería diferencial (56/56 en D01-D14
con Bishop y Spencer, 43/43 con M-P, Janbu corregido y D15-D17,
[`verification/differential/REPORT.md`](../verification/differential/REPORT.md)). Las limitaciones de Spencer
(R4-01, R4-02, R5-05) valen también para Morgenstern-Price, que comparte su solver y sus guardas.

- **R4-01, selección de la raíz de λ en Spencer (resuelto por E12e):** entre varias raíces admisibles, Spencer elige
  la de menor F (conservadora), y a igualdad la de menor |λ|. Con la selección anterior (menor |λ|) 47 de 1008 casos
  bicapa diferían más de 1 % de cSlope. Aviso: `multiple_admissible_roots` (nota) cuando hay más de una raíz admisible.
  Residual: cuando cSlope sigue otra raíz, ogs puede quedar por debajo de cSlope (caso R4-01 (2): −7,08 %), por
  elegir la raíz de menor F, y con la nota `multiple_admissible_roots`.
- **R5-05, Spencer con tracción (decidido tras X7: se mantiene E12e):** cuando aparecen juntas las notas
  `multiple_admissible_roots` y `negative_effective_normal_major`, el FS de Spencer puede corresponder a una rama con
  tracción y quedar por debajo de Bishop (hasta −14,30 % frente a cSlope en la familia bicapa de superficie fija de X7;
  −13,9 % en R5-2). Se recomienda revisar Bishop y la distribución de N′. La alternativa evaluada (descartar las raíces con N′
  mayor si hay otra admisible) corrige 49 de 67 casos por debajo de cSlope, pero crea 9 por encima (hasta +10,13 % en
  superficie fija y +7,50 % en búsqueda), lo que contradice el criterio conservador. Evidencia:
  [`docs/fase1/exploracion/X7.md`](fase1/exploracion/X7.md). Aviso: `multiple_admissible_roots`,
  `negative_lambda` y `negative_effective_normal_major`.
- **E12f, cargas lineales fuera del bloque analizado:** una carga lineal que cae a más de `1e-9·ancho` del modelo fuera
  del bloque de suelo analizado no actúa, aunque esté muy cerca del pie de la superficie. Dentro de esa tolerancia, y en
  las fronteras de dovela o los extremos del bloque, sí actúa (reparto 50/50 entre dovelas compartidas). Aviso:
  `load_outside_mass`.
- **Cargas lineales y superficies locales (D13):** una carga puntual o lineal puede generar bajo ella círculos
  diminutos con m_α < `min_m_alpha` (en D13, un círculo de 0,67 m con FS 0,614 en cSlope, que avisa `low-m-alpha`).
  ogs los rechaza (E4b). Conviene fijar `search.min_width` (D13 usa 5 m, y entonces ogs y cSlope coinciden en
  +0,03 %) y revisar aparte la capacidad de soporte local bajo la carga: un análisis de estabilidad global no la cubre.
- **R4-02, paso fijo de 0,05 en el barrido de λ:** dos raíces admisibles dentro del mismo paso no se detectan y el
  resultado es `no_lambda_root`, aunque cSlope converge (p. ej., c_top = 74,05: cSlope 1,914138 y ogs sin FS).
  Aviso: `no_lambda_root`, con estado `not_converged` y sin FS. En Morgenstern-Price el barrido es sobre `λ·f̄`, con paso
  `0,05/f̄`; si `f̄ ≤ 0`, el estado es `no_lambda_root`.
- **R4-03a, avisos de búsqueda:** `truncated_driving_mass` solo se evalúa en la superficie final. Si el círculo crítico
  ganador no está truncado, el aviso de un bloque descartado motriz de un candidato truncado se pierde.
  Aviso: ninguno en ese caso.
- **Frontera de `min_width` (E11d′):** la búsqueda no alcanza la frontera ancho = `min_width`. En el botadero de
  dos bancos con `min_width = 10`, ogs da 0,855 frente a 1,142 de cSlope (conservador). Aviso:
  `effective_width_below_min` y `truncated_mass`.
- **Bloques descartados que salen por una pared lateral (E11e′):** no se pueden clasificar, así que solo reciben la
  nota `truncated_mass`, aunque sean motrices. Aviso: `truncated_mass`.
- **Cierre de fuerzas con suelo casi sin peso (E13j-6):** el cierre y el residuo de momento se miden sobre
  `max(ΣW, ΣW*)` (W* es el peso con sismo y cargas), porque con γ = 1e-6 (problemas de Prandtl) ΣW es mucho menor que las
  fuerzas que mueven la masa. Sin cargas y con kv ≤ 0 la salida es idéntica; en 1206 corridas solo cambian V018, V077 y
  V078.
- **`unit_weight_sat` sin cobertura:** ninguno de los 93 casos de verificación usa `unit_weight_sat`. La ruta de peso
  saturado bajo la piezométrica no está verificada frente a cSlope. Aviso: ninguno.
