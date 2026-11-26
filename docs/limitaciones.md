# Limitaciones

OpenGeoSlide es software en desarrollo y no es una herramienta certificada. Esta página reúne lo que **no** hace la
versión actual (con la Fase 3a: formato v0.3, material no drenado, superficies polilínea, Morgenstern-Price y Janbu;
y con el bloque de refuerzos: formato v0.4),
los avisos que muestra la aplicación y las limitaciones numéricas conocidas del motor, con lo que cambió y lo que
quedó retenido tras la revisión R10 (enmiendas E13l). El resumen está en el
[README](../README.md#limitaciones-conocidas), y la aplicación lo enlaza desde su Ayuda.

## Alcance: lo que la versión actual no hace

- **Solo equilibrio límite en 2D**, con **Bishop simplificado**, **Spencer**, **Morgenstern-Price** y **Janbu**
  (simplificado y corregido). No calcula deformaciones, ni análisis en tres dimensiones, ni flujo de agua: el agua entra
  como línea piezométrica o como coeficiente `ru`.
- **La búsqueda automática es solo circular** (entrada y salida). Las superficies no circulares se **fijan a mano**
  como polilínea; no hay búsqueda no circular (queda para la Fase 3b, véase [más abajo](#lo-que-queda-para-la-fase-3b)).
- **Solo dos modelos de resistencia:** Mohr-Coulomb (peso unitario, cohesión y ángulo de fricción, con `unit_weight_sat`
  y `ru` opcionales) y **no drenado** (φ = 0, Su constante o lineal con la cota). No hay Hoek-Brown ni SHANSEP.
- **Refuerzos con límites** (formato v0.4: anclajes, clavos, geosintéticos, pilotes y tablestacas). OpenGeoSlide calcula
  la estabilidad **global** con la fuerza del refuerzo incluida en el equilibrio límite. **No** sirve para diseñar
  muros de tierra mecánicamente estabilizada (TEM) ni otras estructuras de contención, y **no** calcula el empuje sobre
  una tablestaca o un pilote, el empotramiento, el momento flector ni la deflexión
  ([el límite estructural](#pilotes-y-tablestacas-el-límite-estructural-f48)). Lo que se pospone está
  [más abajo](#refuerzos-formato-v04-qué-hace-y-qué-no).
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

### Límite del aviso `interslice_shear_exceeds_strength` (R10A-06)

**Que el aviso no salga no garantiza que la solución sea física.** La revisión R10 construyó un caso bicapa en que
Spencer da un FS casi triple que Janbu, con `r_v ≤ 3` y sin ningún aviso:

- Capa superior resistente (`c = 20 kPa`, `φ = 45°`) sobre un estrato débil (`c = 2 kPa`, `φ = 10°`) y la polilínea
  `[[5, 20], [12, 10], [17, 9.9], [22, 10], [30, 30]]`: Spencer **12,665** (λ = 0,227) frente a **4,356** de Janbu
  simplificado (2,91 veces) y 4,598 de Janbu corregido. cSlope coincide con Janbu (4,356) y **no converge** en Spencer.
- Con `c = 40 kPa` arriba, `c = 1 kPa` abajo y el vértice a `y = 9,8`: Spencer 12,100 frente a 4,788 (2,53 veces).

La capacidad vertical `c_v·h + E′·tan φ_v` de la cara usa el promedio en altura de la capa fuerte, y eso mantiene
`r_v ≤ 3`. El umbral 3 queda como está: es una clasificación calibrada entre los casos de referencia y las soluciones
absurdas de D-1, no una garantía. Además:

- **Solo cuentan las caras con `E′ > 0`** (aclaración de E13k, E13l): la fórmula usa `E′` y no `máx(E′, 0)`. Una cara
  en tracción o con presión de agua mayor que el empuje no entra en el criterio, aunque tenga cohesión; esa condición se
  trata con los avisos de tracción (`negative_effective_normal`, `negative_effective_normal_major`) y no con este.
- La resistencia de una cara vertical sobre un **contacto vertical** entre dos materiales se toma del lado más débil
  (E13l-6); en cualquier otro punto de la cara, del promedio en altura de los materiales que cruza.

**Qué hacer.** Compare siempre Spencer y Morgenstern-Price con Janbu sobre la misma polilínea: un cociente mayor que 2
es una señal de alarma aunque no haya aviso, y el FS de Janbu es entonces la referencia conservadora. Esta es una
limitación del criterio, no un error que se vaya a corregir con otro umbral.

### Janbu: raíz de F₀ y corrección empírica

- F₀ de Janbu es la **menor raíz admisible**, con la nota `multiple_admissible_roots` si hay más de una (E13j-4), igual
  que Spencer (E12e). Dos raíces dentro de un mismo paso de la malla de búsqueda de la raíz no se distinguen.
- Janbu **simplificado** no usa la ecuación de momento. El **corregido** multiplica por un factor empírico
  `f₀ = máx(1, 1 + b₁·(d/L − 1,4·(d/L)²))`, informado como `correction_factor`; `L` y `d` se miden sobre el **bloque de
  suelo** (sin las dovelas aéreas de los extremos), como en cSlope. **La corrección nunca reduce F₀** (E13l-1).
- **Límite del gráfico (E13l-1).** La parábola ajusta el gráfico de Janbu et al. (1973), cuyo eje `d/L` llega a 0,4
  (Abramson et al., 2002). Con `d/L > 0,4`, `f₀` es una **extrapolación** y el motor agrega la nota
  `janbu_correction_extrapolated`. Sin el piso de 1, `f₀` baja de 1 desde `d/L = 0,714` y se vuelve negativo desde
  `d/L ≈ 1,4`: la revisión R10 obtuvo con una polilínea profunda un FS de −23,43 marcado `converged` (R10A-01) y de
  −0,752 (R10B-01). Para esas superficies, F₀ de Janbu simplificado es la cota que no depende de la corrección.
- **Ningún método devuelve `converged` con un FS menor o igual que cero o no finito** (E13l-1): el resultado pasa a
  `not_converged`, sin FS, con el motivo `non_positive_fos`.

### Material no drenado

- La resistencia Su se evalúa en el **punto medio de la base** de cada dovela, con `tan φ = 0`.
- `strength_datum` es una **cota**, no una profundidad. Un gradiente negativo (Su decrece hacia abajo) es válido.
- `ru` no cambia la resistencia de un material no drenado, porque φ = 0.
- Un material con Su = 0 no aporta resistencia: sus caras quedan excluidas del criterio `r_v`.
- No hay SHANSEP ni Su dependiente de la tensión efectiva (queda para la Fase 3b).

## Revisión R10: lo que cambió (E13l) y lo que sigue abierto

La revisión adversarial R10 (Antigravity, dos lentes: [`R10_agy_A.md`](reviews/R10_agy_A.md) y
[`R10_agy_B.md`](reviews/R10_agy_B.md)) encontró hallazgos que el contrato resuelve en las enmiendas E13l
(`briefs/02_CONTRATOS_FASE3.md`, F3.10c). Lo que el usuario nota:

| Enmienda | Qué cambia | Hallazgo |
|---|---|---|
| E13l-1 | `f₀` de Janbu nunca baja de 1, con la nota `janbu_correction_extrapolated` más allá de `d/L = 0,4`; ningún método da `converged` con FS ≤ 0 (`not_converged`, `non_positive_fos`) | R10A-01, R10B-01 |
| E13l-2 | En polilíneas, la comprobación `no_driving` (E3) evalúa `Σ(W*·sen α + H·cos α)` en el sentido del deslizamiento, la misma `t` del equilibrio de fuerzas. Antes, una polilínea sobre terreno horizontal con `kh` o con una carga horizontal era `invalid` (`no_driving`) aunque cSlope converge. Los círculos no cambian | R10A-02 |
| E13l-3 | La escala de los residuos de fuerza y de momento, y la clasificación E7d de la N′ negativa, usan una **escala motriz** que no se infla con cargas verticales inertes: `máx(D, mín(máx(ΣW, ΣW*), 3·D))`, con `D = máx(ΣW, Σ|t_i|, Σ|H_i|)`. Una sobrecarga vertical enorme sobre un tramo horizontal no drenado ya no oculta un desequilibrio (1,68263 con cualquier carga, antes 1,546 `converged` con 1e9 kPa); V068 con carga en el pie conserva `negative_effective_normal_major`; un suelo sin peso con carga horizontal pura converge como cSlope. Ninguno de los modelos del repositorio cambia (3350 corridas) | R10A-03, R10A-07 |
| E13l-4 | En M-P con `data_points`, si el barrido de λ de siempre no converge, se repite con f normalizada por `f_máx` y con paso `0,05 / máx(f̄, f_máx/2)`; λ se informa en la escala del usuario. Las cinco funciones con nombre no cambian. Un `data_points` de pico angosto (D10 con el pico en `[0,8; 0,9; 1,0]`) converge como cSlope (1,047929 frente a 1,047543) | R10A-08 |
| E13l-5 | Si el punto medio de la base está a menos de `tol` de un **contacto entre dos materiales**, se toma el **más débil**, por `c + máx(0, σ′)·tan φ` (o Su) con `σ′ = W·cos²α/b − u`. Antes se tomaba siempre el de arriba: una polilínea sobre el techo de un estrato débil daba 3,630 frente a 3,018 de cSlope (+20,3 %, no conservador) | R10A-04 |
| E13l-6 | La prolongación y el recorte de los extremos de la polilínea usan la **distancia 2D** (un tramo casi vertical ya no se corta ni se deja bajo el terreno); los **vértices de la polilínea** tienen prioridad sobre las fronteras de las cargas y sobre la fusión por `tol`, así que la base de cada dovela sigue siendo recta; la cara vertical sobre un contacto vertical toma la resistencia del lado más débil | R10A-05, R10A-09 |
| E13l-7 | Con la masa truncada (`truncated_driving_mass` o `truncated_mass`), `report.surface` de una polilínea se recorta al **rango analizado**, como el trazo de los círculos; la web dibuja y exporta ese rango | R10B-05 |
| E13l-8 | El esquema `ogs-0.3.schema.json` exige `analysis.methods` en una polilínea fija (el valor por defecto `["bishop"]` la rechaza); `validateLocal` aplica ese valor por defecto | R10A-10, R10B-04 |

Los modelos D18 a D23 de la batería diferencial cubren lo que R10 señaló sin cobertura: Su con gradiente negativo y
piso (D18), M-P con `clipped_sine` y `trapezoidal` (D19 y D20), una polilínea sobre un contacto (D21, E13l-5) y una
polilínea en terreno horizontal con `kh` o con carga horizontal (D22 y D23, E13l-2). Véase
[`verificacion.md`](verificacion.md#batería-diferencial-frente-a-cslope).

### Lo que sigue abierto

- **Picos muy angostos de `data_points` (R10A-08).** Con un pico de ancho 0,04 (D10, `[0,88; 0,9; 0,92]`) la raíz de
  momentos existe pero queda `not_converged` (`no_lambda_root`): la guarda `m_α` (E11b) la declara no admisible y no se
  relaja (cSlope da 1,047735). Una f de 1e-310 da `invalid` (`non_finite`), porque λ no cabe en un número de doble
  precisión. Use funciones más anchas o de escala normal.
- **Criterio de cortante entre dovelas:** `r_v ≤ 3` no garantiza una solución física
  ([arriba](#límite-del-aviso-interslice_shear_exceeds_strength-r10a-06)).
- **Raíz de Janbu en `F₀ = 0` (R10A-11, 3):** la búsqueda de la raíz de E13j-4 (`force_root_at_zero`) explora el
  intervalo `[máx(lo, near/100), mín(3·near, 1e3)]` y esas evaluaciones **no cuentan** en el presupuesto
  `max_iterations`, que se comprueba antes de llamarla. Es un límite acotado, no un lazo abierto; se documenta y no se
  cambia.
- **`unit_weight_sat` sin cobertura frente a otro programa** (R10A-11, 4): véase la última entrada de
  [Limitaciones numéricas](#limitaciones-numéricas-conocidas-del-motor).

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

## Refuerzos (formato v0.4): qué hace y qué no

El bloque de refuerzos incorpora al formato `anchor`, `nail`, `geosynthetic`, `pile` y `sheet_pile`, activos y
pasivos ([formato](formato-ogs-json.md#refuerzos-v04)). Cada cruce del refuerzo con la superficie de deslizamiento
aporta una **fuerza puntual** al equilibrio; el resto del motor no cambia, y sin refuerzos la salida es idéntica byte a
byte a la de la v0.2.0. Lo que sigue son sus límites.

### Pilotes y tablestacas: el límite estructural (F4.8)

> **OpenGeoSlide calcula la estabilidad global con el pilote o la tablestaca incluidos como una fuerza. No calcula:**
>
> - **el empuje del suelo sobre el elemento;**
> - **el empotramiento necesario;**
> - **el momento flector;**
> - **la deflexión;**
> - **las comprobaciones internas o externas de un muro** (vuelco, deslizamiento de la base, capacidad de apoyo,
>   resistencia del perfil, del tirante o del bulbo).

- La `force` de un `pile` o de una `sheet_pile` es un **dato** que usted fija: es la fuerza de corte que el elemento
  puede entregar en el cruce con la superficie. El motor no comprueba que el elemento la resista ni que el suelo se la
  transmita.
- Es una fuerza **constante** en el cruce. No hay perfil de empuje (Ito-Matsui, pospuesto), y el campo `location` se
  quitó del formato porque con fuerza constante no cambia ningún número (E14m-3).
- El motor emite la nota `structural_checks_not_covered` siempre que el modelo tiene un `pile` o una `sheet_pile`, la
  crucen o no. El informe PDF, la Ayuda y la tabla de fuerzas de la web repiten el texto del límite.
- Para el empuje, el empotramiento, el momento y la deflexión hace falta un cálculo de muro, de vigas sobre resortes o
  por elementos finitos.
- La tablestaca en equilibrio límite es una fila continua de pilotes. Una **tablestaca anclada** es una `sheet_pile`
  más un `anchor`; el FS global incluye las dos fuerzas, pero el diseño del muro anclado es del proyectista.

### Lo que se pospone (F4.1)

No existen hoy, ni en el formato ni en el motor:

- **Ito-Matsui** (la fuerza de pilote calculada por el empuje del suelo), que irá con el bloque de grieta de tracción y
  agua;
- el campo de **pretensado**: el pretensado es un `anchor` activo con la carga de bloqueo como capacidad, igual que en
  Slide2;
- la **cizalla y la compresión de los clavos**: un clavo trabaja solo a tracción;
- el **arrancamiento que depende del material**;
- los **clavos lanzados** y los **anclajes helicoidales**;
- la **presión de fluido equivalente** (EFP);
- el **soporte definido por el usuario**.

Además, el **sismo** (`kh` y `kv`) no actúa sobre las fuerzas de los refuerzos, y `interface` no cuenta las sobrecargas
ni las cargas lineales en el esfuerzo vertical `σ′v` del arrancamiento.

### El tramo libre sin placa (`no_capacity`)

Un `anchor` con `pullout.bond` y `bonded_length` solo tiene arrancamiento en los últimos `bonded_length` metros. Un cruce
en el **tramo libre** y sin `end1_capacity` tiene `T(s_c) = 0`: no aplica fuerza, queda con el estado `no_capacity` en
`reinforcement_forces` y **no hay nota ni aviso**, así que el FS es el del talud sin ese refuerzo. Es el comportamiento
del oráculo y de Slide2 (la placa de cabeza transmite la carga al tramo libre). Para que el tramo libre transmita,
`end1_capacity` debe valer al menos lo que se espera del elemento; la web lo propone igual a `tensile_capacity` al crear
un `anchor`. El ejemplo está en el [formato](formato-ogs-json.md#un-fragmento-por-tipo).

### El activo comprimido (E14m-1) y el oráculo instalado

Un elemento **activo** se aplica siempre, también cuando el deslizamiento lo comprimiría (`along > 0`), axial y con su
fuerza completa: es una carga externa conocida, la de bloqueo (Duncan y Wright, método A). Es la regla vigente de
cSlope en su código fuente. El **binario instalado del oráculo** (`cslope` 0.1.0, `a80f9a0`) es anterior y descarta esos
cruces, con la misma regla de compresión que a un pasivo (X17 §1.5). Consecuencias:

- OpenGeoSlide y el oráculo instalado **dan FS distintos** en un activo con `along > 0` (por ejemplo, anclajes activos
  que suben hacia el macizo, más empinados que la base). Las filas de aceptación con el oráculo solo usan cruces con
  `along < 0`.
- Los activos con `along > 0` se verifican con el equilibrio global independiente y con un test que fija `u = d`, no con
  el oráculo. El caso de V016b es de este tipo: el oráculo no aplica ninguna fuerza, y por eso su acuerdo con lo
  publicado no prueba nada sobre los refuerzos (`verification/pending/F3R/INDEX.md`).
- Los **pasivos** comprimidos se descartan en los dos (`compression_ignored`, con la nota
  `reinforcement_compression_ignored`).

### La discretización del oráculo en `interface`

cSlope integra el arrancamiento de `interface` en 200 pasos como máximo, y decide «en el suelo» en el punto medio de
cada paso. OpenGeoSlide **integra exactamente**, con cortes en el terreno y en los contactos. Con un elemento de 27 m,
la diferencia llega a −0,47 % en la fuerza `T` (X17 §2.1). En las filas de aceptación donde la integral de `interface`
gobierna (en vez del tope de la barra), el FS difiere hasta 0,18 % del oráculo; por eso esas dos filas
(`X17-cap-interface` y `X17-cap-interface-cov.5-sp2`) usan una tolerancia de 0,25 % y el resto, 0,1 %. No es un error del
motor: la integral exacta es la correcta, y el oráculo discretiza.

### VP 58 pendiente

El problema de verificación **VP 58** de Slide2 (tieback activo con Spencer 1,145, ocho estratos con agua) **no está
transcrito**: su geometría solo está en la Figura 58.1 del manual, sin coordenadas rotuladas (X17 §5.2), y el esquema
`.ogs.json` no tiene la «profundidad mínima» de 25 ft de su búsqueda. No se publica una cifra propia con datos
inventados. Queda pendiente hasta tener las coordenadas del archivo de Rocscience o de Pockoski y Duncan (2000). El
estado del resto de los VP está en [`docs/fase3/r1v/VP_SLIDE2.md`](fase3/r1v/VP_SLIDE2.md).

El **VP 47** (clavos pasivos, Janbu 0,890) tiene la geometría leída de una figura (±0,05 m): con ella el oráculo da
0,902 (+1,3 %), y no se tomó como un check de 1 %, sino con la tolerancia de su fuente y con esa nota (E14m-5).

### La búsqueda con refuerzos tiene discontinuidades

Con `analysis.search`, los cruces y los nodos se recalculan para **cada candidato**. Un círculo candidato puede ganar o
perder un cruce con un refuerzo al cambiar un poco, y cada cruce suma una fuerza completa: el FS es **discontinuo** en el
espacio de los círculos y el refinamiento por Hooke-Jeeves puede ver saltos (X16). Consecuencias:

- el mínimo hallado puede estar en un salto, y un candidato cercano distinto puede dar un FS notablemente menor o
  mayor;
- `reinforcement_forces` se emite solo sobre la **superficie final** de cada método, no para cada candidato;
- el coste de la búsqueda crece con el número de refuerzos.

Para un diseño, contraste el resultado de la búsqueda con superficies fijas (círculo o polilínea) cercanas a la crítica.

Los problemas de cSlope con grieta de tracción o agua embalsada que el importador no convierte están en
[`verification/pending/F3/INDEX.md`](../verification/pending/F3/INDEX.md), con el motivo de cada uno. Después del bloque,
el plan recomienda la **grieta de tracción** y el **agua embalsada**, que desbloquean otros casos publicados.

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
- **Notas de refuerzos** (informativas): `reinforcement_outside_mass` (un refuerzo no aplica fuerza sobre la
  superficie), `reinforcement_compression_ignored` (un pasivo comprimido no aporta) y `structural_checks_not_covered`
  (hay pilotes o tablestacas: [el límite estructural](#pilotes-y-tablestacas-el-límite-estructural-f48)). El estado
  `no_capacity` de un cruce **no** emite nota: se ve en la tabla de fuerzas.

## Limitaciones numéricas conocidas del motor

Limitaciones que las revisiones adversariales ([`docs/reviews/`](reviews/)) dejaron abiertas, más las que dejó la
verificación de la ola B. Cada una indica el síntoma y el aviso que lo acompaña. Ninguna cambia la aceptación (213/213
checks en 93 casos, [`verification/REPORT.md`](../verification/REPORT.md)) ni la batería diferencial (56/56 en D01-D14
con Bishop y Spencer; M-P, Janbu corregido y D15-D23 en
[`verification/differential/REPORT.md`](../verification/differential/REPORT.md), con el detalle de D21 a D23 en
[`verificacion.md`](verificacion.md)). Las limitaciones de Spencer
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
  `0,05 / máx(f̄, f_máx/2)` (E13l-4); si `f̄ ≤ 0`, el estado es `no_lambda_root`. Un pico de `f` más angosto que una
  dovela, que cae entre dos fronteras, puede dar `f̄ = 0` y el estado `invalid` con `no_lambda_root`: use una función más
  ancha o más dovelas.
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
  V078. Con cargas verticales grandes la escala puede ocultar un desequilibrio: véase
  [lo que sigue abierto](#lo-que-sigue-abierto) (R10A-03).
- **`unit_weight_sat` sin cobertura:** ninguno de los 93 casos de verificación usa `unit_weight_sat`. La ruta de peso
  saturado bajo la piezométrica no está verificada frente a cSlope. Aviso: ninguno.
