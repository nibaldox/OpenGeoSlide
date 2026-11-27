# Limitaciones

OpenGeoSlide es software en desarrollo y no es una herramienta certificada. Esta página reúne lo que **no** hace la
versión actual (con la Fase 3a: formato v0.3, material no drenado, superficies polilínea, Morgenstern-Price y Janbu;
con el bloque de refuerzos: formato v0.4, y con el de grieta de tracción, agua embalsada y pilotes de Ito-Matsui: formato
v0.5, en desarrollo y sin publicar), los avisos que muestra la aplicación y las limitaciones numéricas conocidas del motor, con lo que cambió y lo que
quedó retenido tras la revisión R10 (enmiendas E13l), más lo que corrigió la revisión R11 del bloque de refuerzos
(enmiendas E14o) y lo que documenta la revisión R12 del bloque v0.5 (enmiendas E15l). El resumen está en el
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
- **Pilotes de Ito-Matsui con límites** (formato v0.5, en desarrollo): la fuerza que el suelo entre pilotes ejerce sobre
  una fila de pilotes **rígidos y verticales**, en deformación plana, con S/D de 2 a 8 como rango de validez de la
  fórmula. Es una estimación de la presión del suelo, no el diseño del pilote. Los detalles están
  [más abajo](#pilotes-de-ito-matsui-e15i-qué-hace-y-qué-no).
- **Grieta de tracción con límites** (formato v0.5, en desarrollo): solo vertical, una por superficie, sin zona ni
  ángulo, sin tope de profundidad y con la regla de que descarta los candidatos que no la alcanzan. El **agua embalsada**
  (agua sobre el terreno) se incluye ahora en todas las versiones, con límites: sin desembalse rápido, sin sismo sobre el
  agua y con una regla de `ru` que no se puede comparar con el oráculo. Los detalles están
  [más abajo](#grieta-de-tracción-y-agua-embalsada-formato-v05-qué-hace-y-qué-no).
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

### V085 ×4, V009a y V009b: los 6 retenidos de F3G (E15j-6)

El lote F3G (grieta de tracción y agua embalsada) promovió 31 casos y 80 checks. Quedan **6 checks retenidos** en
[`pending/F3G`](../verification/pending/F3G/INDEX.md) (`HOLD.json`), cada uno con su causa medida y sin relajar ninguna
tolerancia (la de los checks es relativa, `|Δ|/publicado`, E15j-5):

- **V085 ×4** (Bishop, Spencer, Janbu simplificado y Janbu corregido): la búsqueda de ogs encuentra un círculo más
  crítico, el mismo en los cuatro métodos (Bishop 1,2947 frente a 1,762 publicado). cSlope evalúa ese círculo en 1,29465
  (0,002 %): con superficie fija los dos motores coinciden y la grieta no interviene. La búsqueda de cSlope es
  estocástica y da 1,7591 con 8000 iteraciones y 1,716 con 40 000; el valor publicado corresponde a una búsqueda que no
  llega a ese mínimo.
- **V009a y V009b** (Spencer): el FS está dentro de la tolerancia (+0,09 % y −1,47 %), pero el motor emite
  `interslice_shear_exceeds_strength` (E13k) con `r_v` de 3,12 y 5,57, sobre el umbral calibrado de 3, y la aceptación
  rechaza todo aviso que no es informativo (E5), igual que V035b y V083.

### V035b y V083: retenidos por `negative_effective_normal_major`, tracción real del modelo (E14n-1)

El FS de ogs reproduce el publicado (V035b, Bishop: 1,3210 frente a 1,324 y 1,32; V083, Janbu corregido: 0,8845 frente a
0,89), pero el motor emite `negative_effective_normal_major` y la aceptación lo rechaza (E5). Es una **tracción real del
modelo, presente también sin refuerzos**; no es un artefacto de la fuerza puntual de un cruce:

| Caso | Dovelas con N′ < 0 | FS sin refuerzos | Fuente |
|---|---|---:|---|
| V035b (Bishop, 2 checks) | 4 dovelas normales, k = 59 a 62, x 12,03 a 12,56, ancho 0,133 m; N′ de −2,14 a −30,57 kN | 0,929 | [`pending/F3R`](../verification/pending/F3R/INDEX.md) |
| V083 (Janbu corregido, 1 check) | 12 dovelas normales, k = 45 a 56, x 4,77 a 6,28, ancho 0,126 m; N′ de −0,16 a −4,61 kN | 0,834 | ídem |

La **E14n-1** (§F4.17, adoptada) suma, solo para clasificar la N′ negativa, las dovelas finas de un cruce con las dos
vecinas. Equilibrio, FS y dovelas del informe no cambian. Elimina el aviso en V014 con Janbu corregido, donde venía de 8
dovelas finas de 7,6e-5 m (ese caso volvió a `verification/cases`), y en V010 con M-P y V014 con Spencer quita la nota
`negative_effective_normal`. No toca V035b ni V083: en V035b la dovela fina del cruce no tiene N′ < 0 (el ancla es
horizontal y en Bishop `passive_h` solo entra en el momento) y en V083 las dovelas finas de los dos cruces tampoco; los
negativos son los de arriba, idénticos con y sin la regla. Una tracción real sobre dovelas de ancho normal sigue dando el
aviso mayor (test `crates/ogs-core/tests/f3r2_e14n1.rs`). Los dos casos quedan retenidos junto con V027, V028 y V068, sin
relajar ninguna tolerancia; los checks están en `verification/pending/F3R/HOLD.json`.

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
byte a la de la v0.2.0, con [una excepción](#excepción-a-la-identidad-con-la-v020-círculos-con-la-tangente-vertical-v065).
Lo que sigue son sus límites.

### Excepción a la identidad con la v0.2.0: círculos con la tangente vertical (V065)

La identidad byte a byte de un modelo sin refuerzos con la v0.2.0 (F4.1) tiene **una sola excepción**, una corrección
de un defecto (E14o-11). Un círculo con el centro a la cota de la coronación termina su arco con la tangente vertical
sobre el terreno, en `x = xc ± r`. La v0.2.0 perdía cifras en `(xc + r) − xc` y rechazaba el círculo con
`NoValidSurface: el círculo no corta el terreno`; ahora `check_block_ends_circle` toma la altura `yc` por construcción y
el modelo se analiza. Ejemplo medido: V065 **sin refuerzos** (versión 0.3), con el binario de la v0.2.0 el código de
salida es 2 y con el actual el código es 0 y Spencer da 0,9260. Es una mejora: un modelo que antes se rechazaba por
redondeo ahora da un resultado; ninguno de los modelos sin refuerzos que la v0.2.0 analizaba cambia.

### Los cruces con refuerzos: tangencia, capacidad nula y notas (E14o-1, E14o-11)

- **Un elemento tangente a la superficie no cruza.** En un círculo, un cruce solo cuenta si el elemento **penetra**: la
  semicuerda de su recta dentro del círculo debe ser mayor que `tol`; si entra y sale a menos de `tol` a lo largo del
  arco, se descartan los dos cruces. La normal y el movimiento se calculan en el punto exacto del cruce. Antes, un
  anclaje tangente a un círculo de V047a inyectaba dos fuerzas completas en la misma dovela fina (FS 2,0768 con
  `eps_r = −1e-12` frente a 0,9851 sin refuerzo, R11A-01).
- **Un cruce con capacidad nula o sobre el terreno no agrega nodos.** El FS con `force = 0` o con `no_capacity` es
  **exactamente** el del talud sin refuerzo, y no cambia el número de dovelas.

### Pilotes y tablestacas: el límite estructural (F4.8)

> **OpenGeoSlide calcula la estabilidad global con el pilote o la tablestaca incluidos como una fuerza. No calcula:**
>
> - **el empuje del suelo sobre el elemento** (con `force`, que es un dato; la presión de Ito-Matsui, con
>   `lateral_pressure`, es una estimación aparte: [más abajo](#pilotes-de-ito-matsui-e15i-qué-hace-y-qué-no));
> - **el empotramiento necesario;**
> - **el momento flector;**
> - **la deflexión;**
> - **las comprobaciones internas o externas de un muro** (vuelco, deslizamiento de la base, capacidad de apoyo,
>   resistencia del perfil, del tirante o del bulbo).

- La `force` de un `pile` o de una `sheet_pile` es un **dato** que usted fija: es la fuerza de corte que el elemento
  puede entregar en el cruce con la superficie. El motor no comprueba que el elemento la resista ni que el suelo se la
  transmita.
- Con `force` es una fuerza **constante** en el cruce: no hay perfil de empuje, y el campo `location` no existe en el
  pilote porque con fuerza constante no cambia ningún número (E14m-3). El perfil de empuje de Ito-Matsui existe desde la
  v0.5, con `lateral_pressure` en lugar de `force`, y `location` va dentro de ese objeto.
- El motor emite la nota `structural_checks_not_covered` siempre que el modelo tiene un `pile` o una `sheet_pile`, la
  crucen o no. El informe PDF, la Ayuda y la tabla de fuerzas de la web repiten el texto del límite.
- Para el empuje, el empotramiento, el momento y la deflexión hace falta un cálculo de muro, de vigas sobre resortes o
  por elementos finitos.
- La tablestaca en equilibrio límite es una fila continua de pilotes. Una **tablestaca anclada** es una `sheet_pile`
  más un `anchor`; el FS global incluye las dos fuerzas, pero el diseño del muro anclado es del proyectista.

### Lo que se pospone (F4.1)

No existen hoy, ni en el formato ni en el motor:

- **Ito-Matsui** existe desde la v0.5 (véase [abajo](#pilotes-de-ito-matsui-e15i-qué-hace-y-qué-no)). Sigue sin
  existir otro modelo de presión de suelo sobre el pilote: `lateral_pressure.model` solo admite `"ito_matsui"`;
- el campo de **pretensado**: el pretensado es un `anchor` activo con la carga de bloqueo como capacidad, igual que en
  Slide2;
- la **cizalla y la compresión de los clavos**: un clavo trabaja solo a tracción;
- el **arrancamiento que depende del material**;
- los **clavos lanzados** y los **anclajes helicoidales**;
- la **presión de fluido equivalente** (EFP);
- el **soporte definido por el usuario**.

Además, el **sismo** (`kh` y `kv`) no actúa sobre las fuerzas de los refuerzos, y `interface` no cuenta las sobrecargas
ni las cargas lineales en el esfuerzo vertical `σ′v` del arrancamiento.

### El arrancamiento `interface`: agua y contactos (E14o-4, E14o-5)

- **`ru` o piezométrica, nunca las dos.** En `interface`, `σ′v` sigue la precedencia del rebanado: un material con `ru`
  usa `u = ru·σ_suelo` y **no** recibe el agua libre de la línea piezométrica; un material sin `ru` usa la piezométrica,
  y el agua libre sobre el terreno cuenta. Antes, un material con `ru` sumaba el agua libre sin restar la presión de
  poros: en V047a (`ru = 0,3`, piezométrica en y = 32) el arrancamiento daba 334,18 kN/m frente a 161,01 kN/m sin
  piezométrica (cSlope, 161,00), y el FS 1,5549 frente a 1,1247 de cSlope (R11A-04).
- **En un contacto entre estratos, el mínimo.** Si el elemento corre sobre un contacto (en y, o en x si es vertical),
  `σ′v` es el **mínimo** de los dos materiales, como E13l-5. Antes dependía del orden de `regions`: en un contacto
  horizontal de `ru` 0,5 y 0, el FS iba de 1,3278 a 1,6258 (+22,4 %) al invertir el orden (R11A-05). Es lo conservador y el resultado no depende del orden de `regions` ni del espejo x → −x.

### Las fuerzas pasivas en los métodos (E14o-2, E14o-3, E14o-10)

- **`no_driving` solo mira lo motriz** (E14o-3). La comprobación de que hay momento o fuerza motriz se evalúa **una vez,
  antes de resolver**, con el peso, el sismo, las cargas y las fuerzas **activas**. Una fuerza pasiva es resistente y
  no entra en esa comprobación; antes, un suelo muy blando (por ejemplo `Su = 0` con una tablestaca pasiva de
  500 kN/m) o un pilote pasivo inclinado daban `invalid (no_driving)` en los cinco métodos (o solo en Janbu), mientras
  cSlope daba Bishop 1,3397 y Janbu 1,2209 (R11A-03). Janbu ya no usa el momento motor de Bishop.
- **Bishop con pasivas** (E14o-2). El arranque del punto fijo incluye las pasivas, y antes de bisecar se acota el
  cambio de signo con una malla geométrica. Antes, un pilote pasivo con componente vertical ascendente daba
  `invalid ("m_alpha")` (cSlope 3,526; Spencer 3,512) (R11A-02).
- **Janbu corregido: el punto de igualdad activo/pasivo es `F₀ = 1`** (E14o-10). La fuerza pasiva se divide por `F₀`, no
  por `f₀·F₀`: es coherente con el tratamiento de `c` y `tan φ` en Janbu (donde `f₀` es una corrección empírica
  posterior al equilibrio) y con cSlope. Por eso un elemento activo y el mismo elemento pasivo dan el mismo FS cuando
  `F₀ = 1`, es decir cuando el FS **corregido** vale `f₀`, y **no** cuando vale 1. Con `f₀ = 1,0456` (V047a),
  Bishop, Spencer, M-P y Janbu simplificado dan 1,0000 en los dos con FS = 1, y Janbu corregido da 1,0000 (activo)
  frente a 1,0097 (pasivo). Entre `FS = 1` y `FS = f₀` el pasivo supera al activo; no es un error.

### El espaciamiento por defecto depende de la unidad (E14o-12)

Un `spacing` omitido vale **1 en la unidad de longitud del modelo**: 1 m en SI y 1 ft en imperial. Las capacidades y la
`force` son por elemento y el motor las divide por `spacing`, así que el mismo elemento con `spacing` omitido da una fuerza
por unidad de ancho **3,28084 veces mayor** en imperial que en SI. El motor no convierte unidades. Antes de E14o, al
convertir un modelo con `spacing` omitido de SI a imperial, la web dejaba el campo vacío mientras multiplicaba las
capacidades, y el FS de V047a con un anclaje y un pilote subía de 1,4914 a 4,5258 en Bishop (R11B-01, +203 %). Ahora la
web escribe siempre un `spacing` explícito convertido, y el FS no cambia con el motor real. **Si usted cambia de sistema
a mano en un `.ogs.json`, escriba el `spacing` de forma explícita.**

### El tramo libre sin placa (`no_capacity`)

Un `anchor` con `pullout.bond` y `bonded_length` solo tiene arrancamiento en los últimos `bonded_length` metros. Un cruce
en el **tramo libre** y sin `end1_capacity` tiene `T(s_c) = 0`: no aplica fuerza, queda con el estado `no_capacity` en
`reinforcement_forces` y **no hay nota ni aviso**, así que el FS es el del talud sin ese refuerzo. Es el comportamiento
del oráculo y de Slide2 (la placa de cabeza transmite la carga al tramo libre). Para que el tramo libre transmita,
`end1_capacity` debe valer al menos lo que se espera del elemento; la web lo propone igual a `tensile_capacity` al crear
un `anchor`. El ejemplo está en el [formato](formato-ogs-json.md#un-fragmento-por-tipo).

### El activo comprimido (E14m-1, E14o-8) y el oráculo instalado

Un elemento **activo** se aplica siempre, también cuando el deslizamiento lo comprimiría (`along > 0`), axial y con su
fuerza completa: es una carga externa conocida, la de bloqueo (Duncan y Wright, método A). Es la regla vigente de
cSlope en su código fuente. El **binario instalado del oráculo** (`cslope` 0.1.0, `a80f9a0`) es anterior y descarta esos
cruces, con la misma regla de compresión que a un pasivo (X17 §1.5).

**Es falso que aplicarlo sea siempre conservador.** La justificación de E14m-1 («con `along > 0` la fuerza tiene una
componente a favor del deslizamiento, así que aplicarla es lo conservador») se corrige en E14o-8: la componente
tangencial `T·sin θ` sí empuja a favor del deslizamiento, pero la normal `T·cos θ` **confina la base** y aumenta la
resistencia friccionante en `T·cos θ·tan φ / F`. En un suelo con `φ > 0`, esa segunda componente domina mientras
`0 < θ < atan(tan φ / F)`, y el FS **sube**. Medido en V047a (`φ` = 19,6°; Bishop sin refuerzo 0,9851) con un anclaje
activo de 100 kN/m en (40; 26,973) girado `θ` pasada la normal (R11A-08):

| `θ` | `along` | Bishop | Spencer |
|---:|---:|---:|---:|
| +2° | +0,0349 | 1,0696 (+8,6 %) | 1,0679 |
| +5° | +0,0872 | 1,0549 (+7,1 %) | 1,0533 |
| +10° | +0,1736 | 1,0307 (+4,6 %) | 1,0294 |
| +15° | +0,2588 | 1,0072 (+2,2 %) | 1,0061 |
| +20° | +0,3420 | 0,9846 | 0,9837 |

(Spencer sin refuerzo, 0,9841. Un ejemplo ejecutable está en el
[formato](formato-ogs-json.md#un-activo-comprimido-puede-subir-el-fs).) Por eso el motor **sigue aplicando** el activo
comprimido, pero emite la nota informativa `reinforcement_active_compression`: «Un refuerzo activo se aplica con su
fuerza aunque el deslizamiento lo comprimiría; en suelos con fricción esa fuerza puede aumentar el FS. Verifique la
orientación y la carga de bloqueo.» La carga de bloqueo es un dato suyo: si el tirante pierde pretensado, el aporte
desaparece. Consecuencias con el oráculo:

- OpenGeoSlide y el oráculo instalado **dan FS distintos** en un activo con `along > 0` (por ejemplo, anclajes activos
  que suben hacia el macizo, más empinados que la base). Las filas de aceptación con el oráculo solo usan cruces con
  `along < 0`.
- Los activos con `along > 0` se verifican con el equilibrio global independiente y con un test que fija `u = d`, no con
  el oráculo. Ninguno de los casos del corpus ejercita este caso contra el oráculo. V016b no es uno: sus tres elementos
  quedan dentro del círculo, sin cruce, y ni ogs ni el oráculo aplican fuerza, así que su acuerdo con lo publicado no
  prueba nada sobre los refuerzos (`verification/cases/INDEX.md`, sección «Casos con refuerzos»).
- Los **pasivos** comprimidos se descartan en los dos (`compression_ignored`, con la nota
  `reinforcement_compression_ignored`). El umbral `cos 88°` es **discontinuo**: el pasivo aporta la fuerza completa a un lado y nada
  al otro (barrido de R11 en V047a: Bishop 1,1331 con el ángulo en 88,00° y 0,9851 en 87,99°, un salto de −13,1 %). Es la
  regla de Clouterre y de FHWA GEC 7; revise los pasivos cuya orientación esté cerca de ese umbral.

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

**La búsqueda por defecto puede perder el mínimo real (R11A-07, E14o-7).** Medido en V047a con Bishop, la búsqueda por
defecto (20 × 20 × 20 con refinamiento) frente a una malla fina (60 × 60 × 40 con refinamiento): con dos anclajes
pasivos de 400 kN en y = 25,5 y y = 30,0, 1,6842 frente a 1,5717 (**+7,15 %, del lado inseguro**; cSlope, 1,7190), y con
un anclaje activo de 300 kN en (33; 26,5)-(48; 26,5), 0,9621 frente a 0,9427 (+2,06 %). La búsqueda converge a veces a
un círculo con dos cruces de fuerza opuesta que se anulan, sin la nota `reinforcement_outside_mass`. El contrato E14o-7
agrega, **solo con refuerzos**, candidatos que pasan por las puntas y las cabezas de los refuerzos (como los vértices del
terreno de E9a) y diversifica las semillas del refinamiento por el número de cruces aplicados, con el criterio de una
brecha de menos de 1 % frente a la malla fina; sin refuerzos no cambia nada. Si el cierre no la alcanza, la
recomendación es **comprobar con una malla fina** (por ejemplo 60 × 60 × 40 con refinamiento) y con superficies fijas;
las cifras finales están en [`docs/fase3/r11c/NOTAS.md`](fase3/r11c/NOTAS.md).

**La búsqueda puede esquivar el refuerzo.** El círculo crítico no tiene por qué cruzar el elemento: si un círculo
menor, que no lo toca, tiene un FS más bajo, ese es el mínimo y el refuerzo no aporta. Ejemplo: ACADS 1(a) con su
búsqueda por defecto y el anclaje activo de 100 kN del [ejemplo del formato](formato-ogs-json.md#ejemplo-un-talud-con-un-anclaje-activo).
Sin refuerzos, Bishop da 0,9851 y, con el anclaje, 1,0623, con la nota `reinforcement_outside_mass` y sin ninguna fuerza
en `reinforcement_forces`: la superficie crítica (xc 36,61, yc 46,55, r 18,54) pasa por encima del anclaje. En el mismo
modelo con una tablestaca activa de 120 kN por metro en x = 40, Bishop da 1,1553 y el elemento también queda
`outside_mass`; con el círculo fijo que cruza la tablestaca, el FS es 1,4557. **Cuando una búsqueda con refuerzos trae la
nota `reinforcement_outside_mass`, el FS mínimo es el de una superficie que el refuerzo no cruza:** mueva el refuerzo,
alárguelo o acote los rangos de entrada y salida para que el refuerzo trabaje donde se espera, y revise el resultado con
superficies fijas.

Para un diseño, contraste el resultado de la búsqueda con superficies fijas (círculo o polilínea) cercanas a la crítica.

## Grieta de tracción y agua embalsada (formato v0.5): qué hace y qué no

El motor calcula la **grieta de tracción** (`analysis.tension_crack`, que exige la versión `"0.5"`) y el **agua
embalsada** (la piezométrica sobre el terreno, en todas las versiones). Ambas están en desarrollo y **sin publicar**
([formato](formato-ogs-json.md#agua-embalsada-todas-las-versiones)). Lo que sigue son sus límites.

### Excepción a la identidad con la v0.3.0: agua sobre el terreno

Un modelo sin `tension_crack` y sin agua sobre el terreno da la misma salida, byte a byte, que la v0.3.0 (salvo el número
de versión del motor), con **dos excepciones documentadas**: esta (F5.1) y
[el contacto de aire capilar de V019](#segunda-excepción-a-la-identidad-con-la-v030-contacto-de-aire-capilar-v019-e15j-8)
(E15j-8). **La primera** (F5.1, D1) son los modelos cuya piezométrica pasa sobre el terreno,
los que la v0.3.0 marcaba con `water_above_ground`: **cambian de resultado a propósito**, porque ahora incluyen el agua
embalsada con su peso y su empuje. Es una corrección de física, del mismo tipo que la de V065: la v0.3.0 contaba la
presión de poros con la carga completa, pero ni el peso ni el empuje del agua, y el FS salía muy bajo.

Ejemplo medido, V047a (ACADS 1(a)) con 2 m de agua sobre el pie (piezométrica en y = 27), Bishop:

| | v0.3.0 | ahora | cSlope (con agua libre) |
|---|---:|---:|---:|
| Superficie fija (el círculo de la búsqueda sin agua) | 0,848 | 0,939 | 0,939 |
| Búsqueda | 0,132 | 0,924 | 0,924 |

Con la v0.3.0, ese modelo traía además la nota `negative_effective_normal` (superficie fija) o
`negative_effective_normal_major` (búsqueda); ahora ya no. La herramienta
`verification/tools/identity_vs_baseline.py` **separa** estos modelos y los informa por su nombre; no los oculta ni los
cuenta como diferencias. Si usted tiene resultados guardados de un modelo con agua sobre el terreno, **vuelva a
calcularlos**: los de la v0.3.0 no incluían el agua libre.

### Segunda excepción a la identidad con la v0.3.0: contacto de aire capilar (V019, E15j-8)

Un tramo de aire **interior**, con suelo a ambos lados, se trata ahora como contacto y **no parte la masa** cuando cumple
dos condiciones: su ancho total es ≤ 1e-6 del ancho del modelo y el arco queda, como mucho, a 10 veces la tolerancia
sobre el terreno. Se halló con el caso D30 (corte vertical de 12 m): el círculo crítico de cSlope pasa 3,6e-7 m sobre el
pie y ogs lo partía en dos masas, con lo que descartaba 23,5 kN/m de suelo y 117,9 kN/m de cohesión. Con la regla, la
fila D30 de superficie fija pasa de −15,4 % a +0,13 % y la seca de −13,2 % a +0,07 % respecto de cSlope.

Frente a la v0.3.0, **un solo modelo del corpus cambia**: V019, en las variantes `search` y `search@0.4` (búsqueda de
cinco métodos), y solo en los **contadores** de la búsqueda de Janbu simplificado: `search.evaluated` pasa de 10040 a
10088 y `search.valid` de 7451 a 7499, porque ahora hay 48 círculos más que se evalúan y son válidos. El FS, la superficie
crítica, los avisos y las dovelas son **idénticos**, y los demás métodos y variantes de V019 también.

- **Cómo se declara.** La herramienta `verification/tools/identity_vs_baseline.py` lee
  [`verification/tools/identity_exceptions.json`](../verification/tools/identity_exceptions.json), con una entrada
  `{modelo, variante, campos, motivo, enmienda}` por modelo y variante. Si la **única** diferencia está en los campos JSON
  permitidos (`results.*.search.evaluated` y `results.*.search.valid`), la informa aparte
  («EXCEPCIÓN V019 [search]: E15j-8») y no la cuenta. Cualquier otro campo, otro modelo, otra variante, otro estado u
  otro stderr sigue contando como diferencia. El resultado de la compuerta es **0 diferencias, 2 excepciones** (V019 en
  `search` y en `search@0.4`) y los 18 modelos con agua sobre el terreno, listados aparte.
- **Límite.** El umbral es discontinuo: un arco entre unos 7e-7 y 3e-6 sobre un vértice todavía puede diferir de cSlope.

### La grieta: solo vertical, una por superficie (F5.2, F5.4)

- **Solo una grieta vertical por superficie**, en la coronación. No hay grieta inclinada, ni varias, ni zona de
  tracción con su ángulo: `tension_crack` es un único objeto con `depth` y `water_fill`.
- **Sin posición propia.** La `x` de la grieta sale de la superficie y de la profundidad: es el primer punto, desde la
  entrada del lado de la cresta, donde `terreno(x) − base(x) ≥ profundidad`. No se puede fijar la grieta en una `x`.
- **Sin tope de profundidad por la altura del talud** (G8). Una profundidad mayor que el talud es un dato del usuario; el
  motor no la recorta.
- **La grieta descarta los candidatos que no la alcanzan** (G9). En una búsqueda, la superficie que no llega a la
  profundidad de la grieta **no cuenta**, como en cSlope: el mínimo es el de las superficies que sí la alcanzan, y si no
  hay ninguna, `NoValidSurface`. Con una superficie fija que no la alcanza, el modelo es válido pero el análisis da
  `NoValidSurface: tension_crack_not_reached`. Una grieta profunda deja pocas superficies válidas: no es un resultado
  sobre «el talud con una grieta», sino sobre las superficies que la cruzan.
- **Profundidad informada sobre una discontinuidad de `d(x)` (E15l-2, R12A-04).** Con la profundidad automática, una
  carga `udl` en la coronación o un cambio lateral de material hacen que `d(x)` salte. Si la bisección termina en un `x_c`
  donde la cara cortada, `h_face = terreno(x_c) − base(x_c)`, difiere de `d(x_c)` más que la tolerancia, la profundidad
  que se informa y se usa es `h_face` (y la altura del agua es `water_fill·h_face`); si no, sigue siendo `d(x_c)`. Si
  `h_face` no pasa de la tolerancia, no hay grieta: el motor no trunca la masa e informa `depth = 0`. Antes, la masa se
  truncaba y el informe traía `depth = 0` y `Pw = 0`, y el FS bajaba sin que la grieta lo explicara. Medido con una `udl` de 100 kN/m sobre la cresta
  (`docs/fase3/r12/repro/a04_udl.json`, círculo fijo): `depth` 1,7827 m, `Pw` 15,5885 kN/m y Bishop 1,095348; antes, `depth` 0,
  `Pw` 0 y Bishop 1,102248. Con la carga a 1e-10 m de la entrada del círculo, la cara es nula, `depth` vale 0 y el FS es el
  de la superficie sin grieta (Bishop 1,063223).
- **Una búsqueda que se queda sin superficies por la grieta lo dice (E15l-7, R12B-06).** Si todos los candidatos se
  descartan y al menos uno es por `tension_crack_not_reached`, el error termina en `({e} evaluadas, 0 válidas; {k} no
  alcanzan la grieta de tracción, tension_crack_not_reached)`: revise la profundidad de la grieta o los rangos de búsqueda.
  Con k = 0 el mensaje es el de siempre. Medido con `depth` 40 m y una búsqueda circular de entrada y salida en el talud de
  `a01_ltr.json`: `(7400 evaluadas, 0 válidas; 7397 no alcanzan la grieta de tracción, tension_crack_not_reached)`; antes,
  el mensaje terminaba en `(7400 evaluadas, 0 válidas)`.
- **La masa del lado de la cresta se quita y no se conserva como carga**; la cara vertical no tiene resistencia.
- **El FS no es monótono con la profundidad de una grieta seca**: el signo depende del bloque que se quita. Una grieta
  seca puede **subir** el FS (ejemplo del [formato](formato-ogs-json.md#ejemplos-grieta-seca-llena-y-automática): de
  0,9851 a 1,0263 en Bishop con 2 m). Sí baja con la fracción de agua.
- **`water_fill` es obligatorio**, sin valor por defecto: 0 es seca y 1 llena. La llena es lo conservador en la práctica
  (Slide2 y USACE EM 1110-2-1902) y es lo que propone la web.
- **El agua de la grieta no cambia la presión de poros de la base ni pesa.** `Pw = ½·γw·hw²` es una fuerza horizontal en
  el sentido del deslizamiento, a `hw/3` sobre la base de la grieta.
- Con refuerzos, un cruce que queda del lado de la cresta de la grieta queda fuera de la masa (nota
  `reinforcement_outside_mass`).

### Agua embalsada con `ru`: sin oráculo

Con un material con `ru`, la presión de poros es `u = ru·(W + V)/b`, con `W` el peso del suelo de la dovela y `V` el del
agua embalsada que tiene encima, sin cargas externas ni sismo. Es la regla de Slide2 (su presión vertical incluye el
peso del agua embalsada, pero no las cargas externas ni el sismo) y la conservadora: da un FS entre 1,0 % y 4,5 % menor
que usar solo el suelo (X21, pregunta 7). **No se puede verificar contra el oráculo**: cSlope suma `ru·W/b` a la presión
de la línea de agua del material, una convención distinta que OpenGeoSlide no puede expresar, porque aquí `ru`
reemplaza a la piezométrica. Queda como decisión de diseño, no como resultado verificado. El arrancamiento `interface` no cambia: su `σ′v` en un material con `ru` no cuenta el agua libre (E14o-4).

### Sin desembalse rápido, y el sismo no actúa sobre el agua

- **No hay desembalse rápido** (rapid drawdown): el nivel del agua es una piezométrica estacionaria, y el agua embalsada
  entra con ese nivel. Ni la presión de poros transitoria ni el cambio de resistencia del suelo al bajar el nivel se
  calculan; hágalos con una piezométrica que usted defina o con otra herramienta.
- **El sismo pseudoestático no actúa sobre el agua** (E7): ni `kh·V` ni `kv·V`, y tampoco sobre la fuerza `Pw` de la
  grieta. Solo se aplica al peso del suelo, como siempre (y nunca a las cargas). Es lo que hace el oráculo: en V047a con
  `kh = 0,1`, `kv = 0,05` y Spencer, el prototipo sin sismo sobre el agua quedó a +0,02 % de cSlope, y aplicarlo
  habría dado −1,05 % respecto del oráculo con `kh` (X21, pregunta 6). El agua embalsada **no recibe** la inercia sísmica: un análisis que
  la considere sacudida daría otro FS.

### Círculos tangentes al fondo (V096a y V086b)

Hay círculos del oráculo que el motor rechaza con `NoValidSurface: el arco de deslizamiento sale del modelo`, con o sin
grieta, y **no es el redondeo del contacto** de V065. En V096a (fondo en y = −9) y V086b (fondo en y = 0), el círculo de
cSlope pasa por debajo del fondo por 8,35e-7 y 9,76e-7, que es **12 y 33 veces** la tolerancia del motor
(`1e-9·escala`, de 7,0e-8 y 3,0e-8): es el **límite de la búsqueda de cSlope** (1e-6) y no 1 ulp de `xc + r`, como en
V065. Con el fondo 1e-8, 1e-7 y 3e-7 más abajo sigue rechazado; con 1e-6 pasa y queda a 0,022 % (V096a, Bishop) y 0,016 %
(V086b, Bishop) del oráculo. Relajar la tolerancia admitiría círculos que de verdad salen del modelo, así que **no se
toca**. Los checks de V096a y V086b **pasan** (E15j-7), porque la búsqueda de OpenGeoSlide encuentra su propio círculo
válido y no genera ese círculo. Afecta a la fila diferencial **D39 fija** (Bishop y Spencer: el círculo de cSlope pasa
9,2e-7 bajo el fondo), que el informe marca «explicado (E15f, E15j-7)»: no cuenta como OK ni como falla, y la
tolerancia sigue intacta.

Lo que sí cambió con la masa truncada: V086b con grieta automática y el fondo original (el círculo queda 7,8e-5 sobre el
fondo) ahora es válido (0,9666 frente a 0,96646 del oráculo), porque las comprobaciones de los extremos se aplican a la
masa truncada y no al arco completo.

Los problemas de cSlope con grieta de tracción o agua embalsada que el importador no convierte, y los 6 checks
retenidos, están en [`verification/pending/F3G/INDEX.md`](../verification/pending/F3G/INDEX.md), con el motivo de cada
uno; los otros 31 casos (80 checks) están promovidos a `verification/cases/`.

## Pilotes de Ito-Matsui (E15i): qué hace y qué no

Un `pile` con `lateral_pressure` ([formato](formato-ogs-json.md#pilotes-con-presión-de-suelo-de-ito-matsui-v05)) calcula
la fuerza del suelo entre pilotes con la fórmula de Ito y Matsui (1975), *Soils and Foundations* 15(4):43-59,
ecuaciones 13, 14 y 23, y la aplica en el cruce con la superficie como cualquier otro refuerzo. En el corpus, los
checks V013b a V013e (Cai y Ugai, 2000) la reproducen, y 28 filas de superficie fija coinciden con cSlope a 0,06 % o
menos en los cinco métodos. **Esto no es el diseño de un pilote:** el límite estructural de
[arriba](#pilotes-y-tablestacas-el-límite-estructural-f48) sigue vigente (empotramiento, flexión, deflexión).

- **Pilotes rígidos y verticales.** La fórmula supone un pilote rígido: no hay deflexión ni reacción del suelo según el
  desplazamiento del pilote. El motor rechaza un pilote inclinado cuando lleva `lateral_pressure`.
- **Deformación plana.** El artículo supone dos superficies plásticas que se forman entre pilotes y presión activa de
  Rankine en el plano AA′; no representa el efecto tridimensional de un pilote aislado.
- **Rango de validez: S/D de 2 a 8.** Fuera de él, el motor emite el aviso `ito_matsui_spacing_range`. La crítica
  publicada de Ukritchon y Keawsawasvong (2017), *J. Geotech. Geoenviron. Eng.* 143(9), con análisis límite por
  elementos finitos, encuentra que la solución de Ito y Matsui **sobrestima** la fuerza con S/D pequeño y la
  **subestima** con S/D grande, más cuanto mayor es φ (solo se leyó el resumen). El motor no corrige la fórmula, porque
  los valores publicados que la usan la aplican tal cual: avisa. Con `S/D = 1,5` en el ejemplo del formato, la fuerza
  crece tanto que el FS de Bishop pasa de 1,4373 (S/D = 3) a 3,2864.
- **Piso de φ = 0 que no viene del artículo.** El motor toma `A = max(A_cφ, A_φ=0)`, la regla de cSlope y de XSLOPE,
  para que la fuerza no baje al subir φ. Solo actúa con S/D ≥ 8 (por ejemplo, S/D = 10 con φ ≤ 9,85°). Se documenta como
  una decisión de esos programas, no como parte de la fórmula original.
- **Con φ = 0 o un material `undrained`** se usa la ecuación 23 con la tensión **total** `σv`, porque los parámetros no
  drenados son de tensión total. Con Mohr-Coulomb de φ < 0,01° pasa lo mismo.
- **Las cargas de superficie no entran en `σv`.** Ni `udl` ni `line` suman a la sobrecarga del pilote, como en cSlope. Una
  sobrecarga en la corona **no** aumenta la presión que calcula la fórmula, aunque sí carga la masa que desliza.
- **`ru` tiene precedencia sobre la piezométrica en `σ′v` (E15l-12, R12A-06).** En un material con `ru`,
  `σ′v = σv − ru·σ_suelo`, **sin** restar la `u` de la piezométrica; sin `ru`, `σ′v = σv − u`. Es la misma precedencia
  del rebanado, del arrancamiento `interface` y del conversor a cSlope. `σv` toma `γ` o `γsat` como lo hace el cortador
  para ese material y suma el agua embalsada. Es una regla distinta de la del cuerpo de las dovelas, donde
  `u = ru·(W + V)/b` (E15c): en un modelo con `ru` y un pilote de Ito-Matsui, las dos cuentas coexisten y no se comparan
  entre sí. Antes de E15l-12, la presión restaba las dos (`σ′v = σv − u − ru·σ_suelo`) y, con `ru` y piezométrica, quedaba
  por debajo de cSlope: en la fila X22-S16 (`ru` = 0,2 y piezométrica), de −1,88 % a −1,97 % en el FS y −10,2 % en la fuerza por
  metro. Ahora, la diferencia es de 0,026 % o menos en el FS (0,0185 % en Bishop) y de 0,041 % en la fuerza.
- **Un perfil de presión que desborda se rechaza (E15l-11, R12A-02).** Las ecuaciones 13 y 14 desbordan cuando S/D se
  acerca a 1 (más cuanto mayor es φ). Si un nodo del perfil (`p`, `F` o `Q`) no es finito, el análisis termina antes de
  resolver con `InvalidModel: reinforcements[i].lateral_pressure: la presión de Ito-Matsui no es finita con S/D = … y φ = …°
  (las ecuaciones 13 y 14 desbordan cuando S/D se acerca a 1); aumente spacing`. La salida nunca lleva `NaN` ni `∞`. Antes, con
  φ = 35°, S/D = 1,00125 y `capacity` (`docs/fase3/r12/repro/a02_fixed.json`), los cuatro métodos fallaban (Bishop `invalid` y
  los demás `not_converged`). El aviso `ito_matsui_spacing_range` ya salía con S/D < 2.
- **El agua actúa por las dos caras del pilote**: no empuja. Entra solo en `σ′v` (γ′ bajo la piezométrica) y el agua
  embalsada sobre el terreno suma su peso a `σv`.
- **Es una estimación por capas.** Se integra con la regla del punto medio y un paso de 0,05 m en el material, `c` y φ de
  cada punto; no hay un análisis de interacción suelo-estructura. Con un paso de 0,002 m el FS cambia 1,7e-3 % o menos
  (X22).
- **La `capacity` es un tope, no una comprobación.** `min(∫p dz, shear, moment/L_m)` por pilote: el motor reduce la fuerza
  al límite que usted declara y lo informa en `governs`, pero no verifica el perfil, la armadura ni el momento de
  fluencia. `L_m` es el brazo de la resultante de la presión, no una distribución de momentos en el pilote.
- **Con `centroid`, la posición de la fuerza** (a `L_m` sobre el cruce) es la de cSlope y de Cai y Ugai (2000); con
  Janbu, que no tiene ecuación de momentos, la posición no cambia el FS.
- **Un pilote que no cruza la superficie no aplica fuerza**, como cualquier refuerzo. Si el círculo crítico sale justo en
  la cabeza del pilote (un cruce en el extremo no cuenta), el pilote no aparece en el resultado: es lo que mide X22 en
  V013b con el círculo crítico de cSlope.
- **Con refuerzos, la búsqueda circular puede esquivar el pilote** ([más arriba](#la-búsqueda-con-refuerzos-tiene-discontinuidades)).

## Avisos geotécnicos de la aplicación

Estos casos están cubiertos por avisos en «Diagnósticos» y en el informe PDF:

- **`unit_weight_sat` (γsat) está verificado en cuatro casos publicados** (E15k): V082a, V082b, V088 y V089, que usan un
  `unit_weight_sat` distinto de `unit_weight` bajo la piezométrica. Cumplen sus checks y cSlope los reproduce
  ([índice de casos](../verification/cases/INDEX.md)). La aplicación ya **no** emite el aviso «γsat sin verificar»; sigue
  la nota de que γsat sea menor que γ. Sin línea piezométrica, γsat no interviene en el cálculo, y la verificación no
  cubre otras combinaciones (por ejemplo, γsat con `ru`).
- **La piezométrica se prolonga en horizontal hasta los bordes del modelo** cuando no cubre todo su ancho, con el nivel
  de su extremo más cercano. Se dibuja punteada y la leyenda dice «Piezométrica (extrapolada)».
- **`ru` tiene precedencia sobre la piezométrica:** si un material tiene `ru` y el modelo también tiene línea
  piezométrica, ese material usa `ru` y la piezométrica no se aplica. El agua embalsada, en cambio, sigue cargando la
  dovela con su peso y su empuje, y `u = ru·(W + V)/b` ([más arriba](#agua-embalsada-con-ru-sin-oráculo)).
- **Agua sobre el terreno (nota `water_above_ground`).** Es informativa: «La piezométrica queda sobre el terreno: el agua
  embalsada se incluye con su peso y su empuje horizontal (sin sismo).» Los resultados guardados con la v0.3.0 no
  incluían ese peso ni ese empuje ([excepción a la identidad](#excepción-a-la-identidad-con-la-v030-agua-sobre-el-terreno)).
  Se emite también cuando la superficie analizada recibe términos de agua embalsada no nulos aunque ninguna dovela quede
  bajo una piezométrica sobre el terreno (peso del agua mayor que 0 o empuje distinto de 0, incluido el de un paramento
  vertical de presa, E15l-5): sin esa regla, una presa con muro vertical cambiaba su FS en un 26 % sin la nota (la presa de B-03, con muro en x = 20 de
  y = 2 a 14 y embalse a y = 10: Bishop 1,0010 con la v0.3.0 y 1,2629 ahora, ya con `water_above_ground`).
- **Unidades imperiales con piezométrica:** el peso unitario del agua (γw) debe ser explícito y no menor que 20 pcf
  (se usa 62,4 pcf). Un valor como 9,81 es de kN/m³ y bloquea el cálculo, tanto en el editor como en «Casos».
  El motor nunca convierte los números del modelo: los interpreta en las unidades declaradas. Al cambiar de sistema, la web
  ofrece convertir los valores del modelo (el FS no cambia) o cambiar solo la etiqueta.
- **γw por defecto del motor (E15l-6, R12B-01):** si falta `water.unit_weight`, vale 9,81 kN/m³ en `SI` y, en `imperial`,
  el resultado de convertir 9,81 kN/m³ con el mismo factor que usa la web (alrededor de 62,45 pcf), en lugar de 9,81 sin
  mirar las unidades. Rige para la piezométrica, el agua embalsada y el agua de la grieta, y el conversor a cSlope sigue
  la misma regla. Antes, una grieta con agua y sin `water`, convertida de SI a imperial, daba una fuerza `Pw` 6,37 veces
  menor y un FS mayor (grieta de 2 m: `Pw` 211,19 en lugar de 1344,40 lbf/ft y Bishop 1,71248 en lugar de 1,69865, +0,81 %). En
  el corpus, ninguno de los 15 modelos imperiales de `verification/cases/` usa agua (piezométrica o grieta con agua).
- **Convenciones de signo:** `kh` positivo va en el sentido del deslizamiento y `kv` positivo hacia abajo; el ángulo de
  la carga lineal se mide desde la vertical, positivo hacia +x. Otros programas pueden usar el signo contrario para
  `kv`: compare con cuidado. El informe PDF repite las convenciones.
- **Cargas puntuales o lineales:** pueden generar círculos diminutos con FS muy bajo bajo ellas. Fije un «ancho mínimo»
  de búsqueda y revise aparte la capacidad de soporte local.
- **Aviso de cortante entre dovelas** (`interslice_shear_exceeds_strength`): véase
  [arriba](#aviso-interslice_shear_exceeds_strength).
- **Notas de refuerzos** (informativas): `reinforcement_outside_mass` (un refuerzo no aplica fuerza sobre la
  superficie), `reinforcement_compression_ignored` (un pasivo comprimido no aporta), `reinforcement_active_compression` (un activo
  se aplica comprimido y, en suelos con fricción, puede subir el FS: [el activo comprimido](#el-activo-comprimido-e14m-1-e14o-8-y-el-oráculo-instalado))
  y `structural_checks_not_covered`
  (hay pilotes o tablestacas: [el límite estructural](#pilotes-y-tablestacas-el-límite-estructural-f48)). El estado
  `no_capacity` de un cruce **no** emite nota: se ve en la tabla de fuerzas.

## Limitaciones numéricas conocidas del motor

Limitaciones que las revisiones adversariales ([`docs/reviews/`](reviews/)) dejaron abiertas, más las que dejó la
verificación de la ola B. Cada una indica el síntoma y el aviso que lo acompaña. Ninguna cambia la aceptación (327/327
checks en 151 casos, [`verification/REPORT.md`](../verification/REPORT.md)) ni la batería diferencial (56/56 en D01-D14
con Bishop y Spencer; M-P, Janbu corregido, D15-D23 y el bloque v0.5 D28-D42, con 58 OK, 2 explicados y 0 fallas, en
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
- **Polilínea totalmente sumergida (E15l-27, R12A-05):** Spencer, Morgenstern-Price y los dos Janbu rechazan con
  `invalid` y el aviso `no_driving` una polilínea fija que queda completamente bajo el agua embalsada (por ejemplo, la
  piezométrica en `y = 35 m` sobre una cresta en 20 m). La comprobación de la fuerza motriz de las polilíneas suma
  `W*·sen α + H·cos α` sin el término de poros de la base, y el empuje del embalse sobre la cara inclinada, que
  estabiliza, vuelve negativa la fuerza motriz neta. **El motor no cambia**: rechazar es del lado seguro, y cSlope
  tampoco resuelve ese caso (X21 §5 no probó una polilínea con embalse y sin grieta). Un talud sumergido tiene un
  equilibrio físico bien definido: el mismo talud en seco con `γ′ = γ − γw` converge (Spencer 3,748, Morgenstern-Price
  3,747, Janbu simplificado 1,559 y corregido 1,678 en el caso de R12A-05). Si necesita su FS, calcúlelo así, o con un
  círculo: un círculo totalmente sumergido sí converge (la revisión R12 lo verificó contra la flotación de Arquímedes).
  Aviso: `no_driving`.
- **Hueco entre dovelas vecinas (E15l-9, R12A-12):** tras el contacto de aire capilar
  ([E15j-8](#segunda-excepción-a-la-identidad-con-la-v030-contacto-de-aire-capilar-v019-e15j-8)), el borde derecho de una
  dovela puede quedar a **menos de 1e-6 veces el ancho del modelo** del borde izquierdo de la siguiente
  (`slices[k−1].x_right < slices[k].x_left`): es el tramo de aire que se descartó, de 0,8 µm en un modelo de 100 m. No
  cambia el cálculo; un consumidor del informe que suponga bordes continuos debe tolerar esa holgura. La misma regla une
  dos masas separadas por una muesca en V real de ese orden: con una muesca de 8e-5 m de ancho y 8e-7 m de profundidad en
  un modelo de 100 m, el FS pasó de 1,500 a 3,026 (la masa se une) sin aviso; con 2e-4 m de ancho o 2e-6 m de profundidad,
  las separa y el FS es 1,500. No ocurre en un terreno que no tenga una muesca real tan fina. Aviso: ninguno.
