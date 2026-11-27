# Contratos del bloque F3G: grieta de tracción y agua embalsada (formato v0.5)

**Este texto es normativo.** Solo lo edita el coordinador, con enmiendas numeradas E15a, E15b… que citan su evidencia.

**Fuentes:**
- `docs/fase3/PLAN_GRIETA_AGUA.md`, con las decisiones D1 a D3;
- la exploración `docs/fase3/exploracion/X18.md` a `X21.md`.

**Las convenciones de G1 a G9 y de E1 a E9 son las de X21 §1, verificadas contra cSlope 0.1.0.**

**Sigue vigente** todo lo de `00_CONTRATOS.md`, `01_CONTRATOS_FASE1.md`, `02_CONTRATOS_FASE3.md` y
`03_CONTRATOS_REFUERZOS.md`, salvo lo que este archivo cambie de forma explícita.

## F5.1 Versión y compatibilidad (E15a)

- **Versiones.** El motor acepta `"version"` de `"0.1"` a `"0.5"`. `analysis.tension_crack` exige `"0.5"`; con una versión
  menor, el error es `InvalidModel: tension_crack requiere version "0.5"`.
- **La regla de versión mínima** (F3.9 y F4.1) se extiende: la web guarda `"0.5"` solo si existe
  `analysis.tension_crack`.
- **El agua embalsada no tiene campo** y se aplica en **todas** las versiones, según la decisión D1 del usuario.
- **Identidad.** Un modelo sin `tension_crack` y sin agua sobre el terreno da la **misma salida, byte a byte**, que la
  v0.3.0, salvo el número de versión del motor.
- **Excepción documentada.** Los modelos en los que la piezométrica pasa sobre el terreno, que hoy llevan
  `water_above_ground`, cambian de resultado porque ahora incluyen el agua embalsada. Es una corrección de física, del
  mismo tipo que V065 en E14o-11. La documentan `docs/limitaciones.md`, `CHANGELOG.md` y `verification/tools/
  identity_vs_baseline.py`, que **separa** esos modelos y los informa por su nombre; no los oculta.

## F5.2 Formato: `analysis.tension_crack` (E15b)

```json
"analysis": { "tension_crack": { "depth": 2.0, "water_fill": 1.0 } }
```

- **`depth`:** un número finito > 0, en la unidad de longitud del modelo, o la cadena `"auto"` (G6). El tipo Rust es un
  enum sin etiqueta: `Fixed(f64)` o `Auto`.
- **`water_fill`:** fracción de la grieta llena de agua, en `[0, 1]`. **Es obligatoria y no tiene valor por defecto.**
  Vale 0 para la grieta seca y 1 para la llena. La web propone 1 al crear la grieta, porque es lo conservador en la
  práctica (Slide2 y USACE EM 1110-2-1902), y lo explica en la Ayuda.
- **`deny_unknown_fields`.**
- **No hay campo de posición.** La posición `x_c` sale de la superficie y de la profundidad (G1).
- **Errores:**
  - un campo ausente, un número no finito, `depth ≤ 0` o `water_fill` fuera de `[0, 1]` dan `InvalidModel` con la ruta
    `analysis.tension_crack.<campo>`;
  - sin `water.piezometric_line` y con `water_fill > 0`, la grieta usa `water.unit_weight` si está y, si no, el γw del
    modelo (E12e). No hace falta piezométrica.
- **Salida.** Cada resultado cuya superficie se truncó lleva
  `"tension_crack": { "x": x_c, "depth": d, "water_force": Pw }`. Se omite cuando no hay grieta, para mantener la
  identidad.
- **Esquema:** `schema/ogs-0.5.schema.json`, que acepta de 0.1 a 0.5 y rechaza lo mismo que el motor.

## F5.3 Agua embalsada (E15c)

- **E1, región.** El agua libre es la región entre la piezométrica y el terreno donde `piezo > terreno`. Abarca **todo
  el modelo**, no solo la masa de la superficie evaluada (X20 §1.6).
  - **Por dovela** y por tramo lineal del terreno, partido en los vértices del terreno, los de la piezométrica y sus
    cruces:
    - `V = γw·∫h dx`, vertical hacia abajo, en la parte superior de la dovela;
    - `H_x = γw·∫h·y′ dx`, en +x del marco del modelo;
    - en el sentido del deslizamiento, `H = s·H_x`.
  - Los momentos se calculan **exactos**, con Gauss de 3 puntos.
- **E2, términos por método.** Con `(xg, yg)` el punto de aplicación y `(xm, ym)` el punto medio de la base:
  - **Spencer y M-P:** `V` entra al peso extra; `H` a las fuerzas horizontales; el momento respecto del punto medio de
    la base es `H·(yg − ym) + s·V·(xg − xm)`.
  - **Bishop:** suma al momento motor `[H·(yc − yg) − s·V·(xg − xm)]/R`.
  - **Janbu:** solo las fuerzas.

  G0 decide si basta con los campos actuales (`weight_extra`, `h_force`, `h_moment_base` y `driving_extra`) o si hace
  falta uno nuevo en `Slice` con valor neutro 0 (E15h).
- **E3, presión de poros.** En la base vale `γw·max(0, piezo − y_base_mid)`, sin recortar al terreno, como ya hace el
  motor.
- **E4, paramento vertical** (cara de presa). El empuje vale `½·γw·[(yw − ya)² − (yw − yb)²]`.
  - Es horizontal, en el centroide de la presión, hacia el lado del suelo.
  - Solo cuenta la parte sobre la superficie de deslizamiento: `ya = max(pie, base(x_w))` y `yb = min(nivel, cabeza)`.
  - Lo recibe la dovela cuyo borde es el paramento, en el lado alto.
- **E7, sismo.** No actúa sobre el agua: ni `kh·V` ni `kv·V`, y tampoco sobre la fuerza de la grieta.
- **E9, γw.** Es el `water.unit_weight` del modelo, con las reglas de E12e en imperial. Las filas de aceptación declaran
  9,807 para comparar con el oráculo sin ruido.
- **E15c-ru, material con `ru`.**
  - `ru` sigue reemplazando a la piezométrica (E14o-4), con `u = ru·(W + V)/b`. `W` es el peso del suelo de la dovela y
    `V` el peso del agua embalsada que tiene encima, **sin** cargas externas ni sismo.
  - Es la regla de Slide2, citada en X21 §2.7, y la conservadora: −1,0 % a −4,5 % frente a usar solo el suelo.
  - **No se puede comparar con el oráculo** y se documenta como limitación.
  - El agua embalsada sigue cargando la dovela, con su peso y su empuje.
  - **E14o-4 no cambia:** el `σ′v` de `interface` en un material con `ru` no cuenta el agua libre.
- **Refuerzos.** Con el agua de `interface` (E14o-4) no hay doble conteo, según X21 §2.9: una entra en el `σ′v` del
  elemento y la otra en el equilibrio de la dovela.
- **Aviso.** El código `water_above_ground` se conserva como **nota informativa**, y su texto pasa a ser: «La
  piezométrica queda sobre el terreno: el agua embalsada se incluye con su peso y su empuje horizontal (sin sismo).»
  Va a E6, a `warnings.ts` y a las listas informativas, sin cambiar el nombre del código.

## F5.4 Grieta de tracción (E15d)

- **G1, posición.**
  - `x_c` es el primer punto, desde la entrada del lado de la cresta, donde `terreno(x) − base(x) ≥ d(x)`.
  - Se busca con un barrido de 200 pasos seguido de bisección a `tol`.
  - Si la superficie nunca llega, **no tiene masa**: es inválida, con el motivo `tension_crack_not_reached`.
- **G2, masa.**
  - Se quitan todas las dovelas del lado de la cresta de `x_c`. Se agrega un nodo obligatorio en `x_c`, como los
    cruces de E14m.
  - La masa termina en una **cara vertical**, y el peso quitado **no** se conserva como carga.
  - Las comprobaciones de extremos del bloque (E10a, E13 y `check_block_ends`) se aplican a la **masa truncada**, cuyo
    extremo de la cresta es `(x_c, base(x_c))`, y no al arco completo. Sin grieta no cambian.
- **G3, agua en la grieta.** `Pw = ½·γw·hw²`, con `hw = d·water_fill`.
  - Es horizontal y va en el **sentido del deslizamiento**, `H_x = s·Pw`. Actúa a `y_g = base(x_c) + hw/3`, sobre la
    dovela adyacente a la cara, del lado de la masa.
  - En Bishop suma `H·(yc − yg)/R`; en Spencer y M-P, `h_moment_base += H·(yg − ym)`; en Janbu entra solo la fuerza.
- **G4.** El agua de la grieta no cambia la presión de poros de la base ni pesa; la cara no tiene resistencia.
- **G5, espejo.** El FS es el mismo con `H` en el sentido del deslizamiento.
- **G6, profundidad automática.** `z(x) = max(0, 2c/(γ·tan(45° − φ/2)) − q/γ)`.
  - `c`, `φ` y `γ` son los del material **bajo el terreno en `x`**, en el punto 1e-3·escala por debajo, y se recalculan
    para cada `x`.
  - Con material no drenado, `c` = Su en ese punto y `φ` = 0.
  - `q` suma las sobrecargas `udl` que cubren `x` y `γw·(piezo − terreno)` del agua embalsada en `x`.
- **G7.** Con φ = 0, `z = 2c/γ`. Mohr-Coulomb con φ = 0 y `undrained` dan el mismo FS.
- **G8. No hay tope por la altura del talud.**
- **G9, búsqueda.** Un candidato que no alcanza la grieta **se descarta**, igual que cSlope. Si se descartan todos,
  `NoValidSurface`.
- **Polilíneas.** El truncado se aplica después del ajuste al terreno (E13), y Bishop sigue sin ofrecerse en ellas.
- **Refuerzos.** Un cruce de refuerzo del lado de la cresta de `x_c` queda fuera de la masa, con
  `reinforcement_outside_mass`.

## F5.5 Criterios de aceptación (E15e)

Estos criterios son gates de cada ola.

1. **Neutralidad.** Sin grieta y sin agua sobre el terreno, la salida es byte a byte la de la v0.3.0. Con
   `water_fill = 0` y sin agua embalsada, `Pw = 0` y los campos extra quedan en cero.
2. **Equilibrio global independiente.**
   - Spencer, M-P y Janbu simplificado: residuo de fuerzas y momentos ≤ 1e-6 de la escala motriz, calculado con las
     fuerzas nuevas en su punto real y sin usar la recurrencia.
   - Bishop: el balance de momentos **en su propia formulación**, con el mismo `R·sin α` del motor, ≤ 1e-9.
3. **Oráculo.** Las 54 filas de X21 (`docs/fase3/exploracion/X21_filas/`, cifras en `resultados.json`) quedan dentro
   de ≤ 0,1 %, con las dovelas que declara cada fila.
   - Las filas se migran al formato final: se quita `water.free_water` y `tension_crack.water` pasa a llamarse
     `water_fill`.
   - **X21-A07** sirve de test de estado: el oráculo la descarta y el motor tiene que dar `tension_crack_not_reached`.
4. **Espejo.** El FS coincide a ≤ 1e-9 en P01/P03, D01/D03, D02/D04 y W100/W100m.
5. **Monotonía y continuidad.**
   - El FS baja con `water_fill` en V047a y V079.
   - Con `depth → 0⁺`, el FS tiende al de la superficie sin grieta.
   - No se exige monotonía con la profundidad de la grieta seca, porque el signo depende del bloque quitado (X21 §3.5).

## F5.6 Verificación (E15f)

- **Promoción.** Se promueven los casos de X18 §3.1: grieta seca, grieta con agua y agua embalsada, 81 checks en 33
  casos.
  - Los 5 checks que el oráculo tampoco reproduce (V009b, V086a, V087 y los tres de V092) van a `HOLD.json` con la causa
    que diagnosticó X18.
  - **No se relaja ninguna tolerancia.**
- **Círculos tangentes al fondo** (V096a y V086b, X21 §5). Es una **enmienda condicional**:
  - si el rechazo viene del redondeo del contacto con el fondo, como V065 en E14o-11, se corrige con un test y con la
    identidad medida;
  - si no, el check se retiene con su causa.
- **Batería diferencial.** Se agrega un bloque `F3G` con 8 a 12 modelos sintéticos: embalse al pie, cara de presa,
  grieta seca, grieta llena y combinados, en búsqueda y en superficie fija frente a cSlope.

## F5.7 Web (E15g)

- **Panel «Análisis».** Grieta de tracción: casilla, profundidad (un número o «Automática») y fracción de agua (de 0 a
  1, con 1 por defecto al crearla). La versión mínima pasa a 0.5.
- **Lienzo.**
  - El agua embalsada se dibuja como relleno azul entre la piezométrica y el terreno, con el token nuevo
    `--canvas-pond` en claro y oscuro, en una capa propia bajo la piezométrica.
  - La grieta se muestra, después del cálculo, en `x_c` de la superficie crítica: una línea discontinua vertical con
    su profundidad, y la flecha de `Pw` si hay agua.
- **Informe PDF, CSV, Diagnósticos y Ayuda.** Llevan la grieta (`x_c`, profundidad y `Pw`) y la nota del agua
  embalsada. La Ayuda agrega los términos «Agua embalsada» y «Grieta de tracción», con sus convenciones: sin sismo
  sobre el agua y la regla de `ru` de E15c.
- **Conversión de unidades.** `depth` es una longitud y `water_fill` no tiene unidad. El FS no cambia (≤ 1e-9).

## F5.8 Enmiendas

- **E15h (G0).** Decide si hace falta un campo nuevo en `Slice` para el momento del peso del agua respecto del punto
  medio. El escritor de G0 lo justifica con el uso real de `h_moment_base` y `driving_extra` en `methods/*` y en el
  equilibrio global. Si hace falta, lo agrega con valor neutro 0 y demuestra la identidad.
- **E15i.** Ito-Matsui (ola G3): véase §F5.10.

## F5.9 Enmiendas tras G1 y G2 (E15j, decisiones del coordinador)

- **E15j-1, punto de muestreo de G6.**
  - `c`, `φ` y `γ` se leen a **2e-5·escala** bajo el terreno, y no a 1e-3·escala.
  - Con 1e-3·escala, la fila A04, de Su con gradiente, da una profundidad de 1,2575 frente a 1,25015 del oráculo
    (`docs/fase3/g1b/NOTAS.md`).
  - cSlope usa 1e-3 absoluto. En los modelos del corpus las dos reglas dan el mismo material.
- **E15j-2, superficie fija que no alcanza la grieta.** El resultado es `NoValidSurface: tension_crack_not_reached: …`,
  un error del análisis y no un `MethodReport` inválido. Así se comporta cualquier superficie fija sin masa.
  - Una superficie que no corta el terreno conserva su motivo de siempre (`CrackError::NoGround`).
- **E15j-3, profundidad automática nula.** No se corta nada y la salida lleva `tension_crack.depth = 0`. La web la
  muestra como «sin grieta».
- **E15j-4, agua bajo la tolerancia.** Una profundidad de agua libre ≤ 1e-9·escala cuenta como **cero**.
  - Sin esta regla, las piezométricas que terminan justo sobre el talud (V021a a V021g, V033, V045 y V046b) generaban
    términos de 1e-29 y cambiaban 50 salidas de identidad (`docs/fase3/g1a/NOTAS.md`).
- **E15j-5, convención de la tolerancia de los checks.**
  - La tolerancia del corpus es **relativa**, `|Δ|/publicado ≤ tolerance`. La usan el harness, `acceptance.rs` y el
    propio cSlope, que en `verification-report.ts` informa `± tolerance·100 %`. X18 §3.1 la tomó por absoluta, y por
    eso marcó 5 checks fuera.
  - Con la convención del repo, V087 y los tres checks de V092 se reproducen y se promueven. No se relaja nada: es la
    misma regla que siguen los 243 checks anteriores.
- **E15j-6, retenidos de F3G**, todos con su causa medida:
  - **V085 ×4.** La búsqueda de ogs encuentra un círculo más crítico: FS de Bishop 1,2947 frente a 1,762 publicado.
    - cSlope evalúa ese mismo círculo en 1,29465, una diferencia de 0,002 %. La grieta no interviene.
    - La búsqueda de cSlope es estocástica: da 1,7591 con 8000 iteraciones y 1,716 con 40 000.
    - El valor publicado corresponde a una búsqueda que no llega a ese mínimo.
  - **V009a y V009b, Spencer.** El FS cae dentro de la tolerancia, pero el motor emite
    `interslice_shear_exceeds_strength` (E13k) con `r_v` de 3,12 y 5,57, por encima del umbral calibrado de 3. Un aviso
    no informativo retiene el check, igual que en los casos anteriores.
- **E15j-7, círculos tangentes al fondo** (E15f, `docs/fase3/g1b/NOTAS.md`).
  - No es redondeo: el círculo de cSlope pasa entre 8e-7 y 9,8e-7 bajo el fondo, de 12 a 33 veces la tolerancia.
    Aceptarlo admitiría superficies que salen del modelo.
  - Afecta a la fila diferencial D39 fija, que se informa como «explicado (E15f)».
  - Los checks de V096a y V086b pasan, porque la búsqueda de ogs encuentra su propio círculo válido.
- **E15j-8, contacto de aire capilar** (D30, `docs/fase3/g2m/NOTAS.md`).
  - **Regla.** Un tramo de aire **interior**, con suelo a ambos lados, se trata como contacto y no parte la masa cuando
    cumple dos condiciones:
    - su ancho total es ≤ 1e-6·ancho del modelo;
    - el arco queda, como mucho, a 10·tol sobre el terreno.
  - **Por qué.** El círculo crítico de cSlope en D30 pasa 3,6e-7 m sobre el pie de un corte vertical. ogs lo partía en
    dos masas y descartaba 23,5 kN/m de suelo y 117,9 kN/m de cohesión.
  - **Efecto:**

    | D30 | Antes | Después |
    |---|---:|---:|
    | Superficie fija | −15,4 % | +0,13 % |
    | Seco | −13,2 % | +0,07 % |

  - **Segunda excepción documentada a la identidad.** Con la v0.3.0 solo cambian los contadores `search.evaluated` y
    `search.valid` de V019, en las variantes `search` y `search@0.4`, que suben de 10040 a 10088 y de 7451 a 7499. El
    FS, la superficie, los avisos y las dovelas quedan idénticos.
  - **Límite.** El umbral sigue siendo discontinuo: un arco entre unos 7e-7 y 3e-6 sobre un vértice todavía puede
    diferir de cSlope.
- **E15j-9, búsqueda en cortes verticales.** En D30, la búsqueda de ogs encuentra círculos más críticos que la de
  cSlope.
  - Bishop da 0,8248 frente a 1,5143 con agua, y 0,7131 en seco.
  - **cSlope evalúa esos mismos círculos igual**: 0,8247, 0,9708, 0,7127 y 0,8217.
  - Es coherente con la física: el corte vertical de 12 m supera su altura crítica, `4c/γ·tan(45° + φ/2) ≈ 7,0 m`.
  - El criterio diferencial `ogs ≤ cSlope·1,01` se cumple.

## F5.10 Ito-Matsui: fuerza de pilote por la presión del suelo (E15i, ola G3)

**Fuente:** `docs/fase3/exploracion/X22.md`. El prototipo coincide con cSlope a ≤ 0,057 % en 28 filas y en los cinco
métodos. Base bibliográfica: Ito y Matsui (1975), *Soils and Foundations* 15(4):43-59, ecuaciones 13, 14 y 23, leídas del
original. Las convenciones de este apartado son las de X22 §1 a §4.

- **E15i-1, formato (v0.5).**
  - En un `pile`, `force` pasa a ser opcional y aparece el campo nuevo `lateral_pressure`:

    ```json
    { "type": "pile", "x1": 17.5, "y1": 5.0, "x2": 17.5, "y2": -10.0, "spacing": 2.4,
      "application": "passive", "direction": "angle", "angle": 0,
      "lateral_pressure": { "model": "ito_matsui", "diameter": 0.8, "location": "centroid" },
      "capacity": { "shear": 150.0, "moment": 250.0 } }
    ```

  - **Exclusión:** `force` y `lateral_pressure` se excluyen; tiene que estar **exactamente uno**.
  - **`lateral_pressure`:**
    - `model` solo admite `"ito_matsui"`;
    - `diameter` es finito y > 0;
    - `location` es `"centroid"` o `"slip_surface"`, es **obligatorio** y la web propone `"centroid"`;
    - `deny_unknown_fields`.
  - **`capacity`** es opcional y solo se admite junto con `lateral_pressure`.
    - Lleva `shear` (fuerza por pilote), `moment` (momento por pilote) o ambos, y no puede ir vacío.
    - Cada valor es finito y > 0.
  - **Validación**, con su ruta JSON:
    - el pilote es vertical, `|x2 − x1| ≤ tol`;
    - `spacing > diameter`;
    - `application` y `direction` siguen siendo obligatorios.
  - Los errores de valor de `model` y `location` (enumeraciones) los da el deserializador sin ruta JSON; el resto lleva
    su ruta. La web valida antes con ruta.
  - **Versión.** `lateral_pressure` o `capacity` exigen `"0.5"`, con el error `InvalidModel: lateral_pressure requiere
    version "0.5"`.
  - Se agrega al esquema 0.5.
- **E15i-2, presión.** `p(z) = c·A1 + σ′v·A2`, por pilote y por unidad de profundidad.
  - Con φ > 0 se usan las ecuaciones 13 y 14, con `X = √Nφ·tanφ + Nφ − 1` y `Nφ = tan²(45° + φ/2)`.
  - Con φ < 0,01° o material `undrained` se usa la ecuación 23 (φ = 0) con la tensión **total** `σv`.
  - Se usan `S = spacing` entre ejes, `D2 = S − diameter` y `d = diameter`.
  - **Piso de φ = 0:** `A = max(A_cφ, A_φ=0)`.
    - No viene del artículo: es la regla de cSlope y de XSLOPE.
    - Hace que la fuerza no baje al subir φ, y solo actúa con S/D ≥ 8.
    - Se documenta como tal (X22 §1.3).
- **E15i-3, integración.**
  - Sobre la vertical del pilote, desde `z_top = max(0, terreno − cabeza)` hasta el cruce `zf = terreno − y_cruce`.
  - Usa la regla del punto medio con un paso ≤ 0,05 m, o el equivalente en imperial. Se admite la integración exacta por
    tramos si cumple las filas.
  - En cada punto se toman el material, `c` y `φ` de ese punto. Con `strength_gradient`, `Su(y)`.
  - **Tensión efectiva:** `σ′v = σv − u − ru·σ_suelo`.
    - `σv` se integra desde el terreno con `γ`, o con `γsat` bajo la piezométrica, y suma el agua embalsada que hay sobre
      el terreno (E15c).
    - `u = γw·max(0, piezo − y)`.
  - Las cargas de superficie **no** entran en `σv`, como en cSlope.
  - Si `zf ≤ z_top`, la fuerza vale 0.
- **E15i-4, fuerza.**
  - Por pilote: `F = min(∫p dz, shear, moment/L_m)`, donde `L_m = ∫(zf − z)·p dz / ∫p dz` es el brazo de la resultante
    sobre el cruce.
  - Por metro: `F/spacing`.
  - Se informa qué gobierna: `soil`, `shear` o `bending`.
- **E15i-5, punto de aplicación.**
  - Con `centroid`, la fuerza actúa sobre la vertical del pilote a `L_m` **por encima** del cruce. Es la regla de Cai y
    Ugai (2000), ecuación 9, y la de cSlope.
  - Con `slip_surface`, actúa en el cruce, como en E14e.
  - Los términos por método son los de E14f y E14g, con el punto de aplicación real.
- **E15i-6, activo o pasivo y dirección.**
  - Valen las reglas de E14f y E14g: lo publicado es **pasivo**, se divide por F.
  - La dirección sale del `direction` del refuerzo (E14e). Una presión de suelo sobre un pilote vertical es horizontal,
    `angle` 0.
  - Con `tangent`, el FS de los casos publicados baja alrededor de 0,3 % y sigue dentro de la tolerancia.
- **E15i-7, salida.**
  - Cada cruce de un pilote con `lateral_pressure` agrega `soil_force` (fuerza del suelo por metro, antes del tope),
    `governs` y `arm` (`L_m`).
  - Esos campos se omiten en un pilote con `force`, para mantener la identidad.
- **E15i-8, aviso.** `ito_matsui_spacing_range` (aviso) se emite si `S/D < 2` o `S/D > 8`, con el texto: «Pilote
  Ito-Matsui con S/D = … fuera de 2 a 8: la fórmula pierde validez (sobrestima la fuerza con S/D pequeño y la subestima con
  S/D grande; Ukritchon y Keawsawasvong 2017). Revise el espaciamiento.»
  - Va a E6 y a `warnings.ts`.
  - La Ayuda explica el límite y los supuestos: pilotes rígidos, deformación plana y dos superficies plásticas.
- **E15i-9, criterios** (gate de G3):
  - las 28 filas de `docs/fase3/exploracion/X22_filas/` a ≤ 0,1 % de `resultados.json`;
  - **S06**, con D1/D = 0,25 y FS de alrededor de 11,6, converge en Bishop, por el acotamiento de E14o-2 o una bisección;
  - neutralidad: sin `lateral_pressure`, la salida es byte a byte, y N01 y N02 dan el FS sin pilote;
  - espejo S05/V013c ≤ 1e-9;
  - equilibrio global independiente;
  - monotonía de la fuerza con S/D;
  - **identidad** con 0 diferencias, según las excepciones declaradas.
- **E15i-10, verificación.**
  - V013b a V013e, con 4 checks de búsqueda de Bishop, pasan a `cases`. El oráculo da entre +0,05 % y +0,50 %.
  - El conversor escribe `diameter` y quita `force`, convierte `location: slip_surface` en `slip-surface` y pasa
    `capacity` a `shearCapacity` y `momentCapacity`.

## F5.11 γsat verificado (E15k)

- **Ya hay verificación publicada.** Cuatro casos promovidos en F3G usan un `unit_weight_sat` distinto de
  `unit_weight` bajo la piezométrica: V082a, V082b, V088 y V089. Cumplen sus checks y cSlope los reproduce.
- **Por lo tanto:**
  - se **retira** el aviso del editor `editor.gamma_sat_unverified`;
  - se corrigen las líneas del README y de `docs/limitaciones.md` que dicen que γsat no está verificado;
  - la nota `editor.gamma_sat_lt_gamma` se mantiene.

## F5.12 Correcciones de la revisión R12 (E15l)

**Fuentes:** `docs/reviews/R12_agy_A.md` (lente A, mecánica) y `docs/reviews/R12_agy_B.md` (lente B, propagación). Las dos
dieron NO APTO. El coordinador reprodujo con el binario integrado (`3975701`) los hallazgos críticos y altos del motor:

- **A-01:** el espejo de la reproducción da RTL Bishop 1,726963 con `depth 0`, frente a 1,692572 en LTR con
  `depth 2,648`.
- **A-02:** con φ = 35°, S/D = 1,001 y `capacity`, los cuatro métodos fallan: Bishop `invalid` y los demás
  `not_converged`.
- **A-03:** se confirmó en el código (`water.rs`, bucle E4 sin asignación única).
- **A-04:** con una UDL en la coronación, la grieta da `x = −66,5`, `depth 0` y `Pw 0`, pero el FS pasa de 1,117139
  a 1,102248.
- **B-01:** `model.rs` y `geometry.rs` usan 9,81 sin mirar las unidades.

Se revisaron los 15 modelos imperiales del corpus: ninguno usa agua sin `unit_weight`.

**Regla común:** las correcciones del motor no cambian ningún byte de los 150 modelos de identidad frente a la v0.3.0, y
los 327 checks siguen con 0 fallas. Los modelos con grieta, agua embalsada o Ito-Matsui pueden cambiar, pero solo por
la enmienda que lo dice, con los números antes y después.

### Motor: grieta y agua (dueño M-A)

- **E15l-1 (A-01): grieta automática en el borde del modelo.**
  - La profundidad de Rankine se evalúa en la columna de `x` acotada a `[x_min + tol, x_max − tol]`, de modo que
    `x = x_max` (o `x_min`) da la columna del borde y no una vacía.
  - El cambio se limita al camino de la grieta. Si `PreparedModel::column` en el borde afecta a otro camino, se informa
    y no se toca.
  - **Criterios:**
    - la reproducción de A-01 (geometría de V047a, c = 20, φ = 10°, γ = 18, círculo `xc 45`, `yc 50` por (70, 35),
      `water_fill 1`) da en RTL lo mismo que su espejo LTR, a ≤ 1e-9;
    - la búsqueda RTL no acepta ningún candidato con `depth 0` cuando `d(x_entry) > 0`.
- **E15l-2 (A-04 y E15j-3): grieta sobre una discontinuidad de `d(x)`**, por una UDL o un cambio lateral de material.
  - **Profundidad que se informa y se usa:** si la bisección termina en `x_c` con `|h_face − d(x_c)| > tol`, la
    profundidad es la cara real cortada, `h_face = ground(x_c) − base(x_c)`. Si no, sigue siendo `d(x_c)`, como hoy.
  - **Altura del agua:** `water_height = water_fill · depth`.
  - **Sin grieta:** si `h_face ≤ tol`, no hay grieta. No se trunca (el cortador recibe `None`) y se informa `depth 0`.
  - **Criterios:**
    - la reproducción de A-04 informa `depth = h_face > 0` y `Pw = ½·γw·(water_fill·h_face)²`;
    - las 55 filas de `f3g_rows.rs` no cambian (≤ 1e-12).
- **E15l-3 (A-08): barrido de la grieta.**
  - Al barrido uniforme de `crack::locate` se suman las abscisas que caen dentro del tramo de deslizamiento:
    - los vértices de una superficie poligonal;
    - los vértices del terreno;
    - los bordes de las UDL;
    - los vértices de las regiones.
  - **Criterio:** la polilínea de A-08 (vano de 86 m, vértice (50,1; 7,0) a 3 m de profundidad, tramo de 0,2 m, d =
    2,5) alcanza la grieta.
- **E15l-4 (A-03): empuje de un paramento vertical (E4).** Cada paramento se aplica a **una sola** dovela: la de borde
  del lado alto más cercano a `wall.x` dentro de `wall_tol`.
  - **Criterio:** en un modelo esbelto, una carga lineal de 1 kN/m a menos de `wall_tol` del paramento no cambia
    `Σ h_force` (≤ 1e-9 relativo).
- **E15l-5 (A-09 y B-03): aviso `water_above_ground`.** Se emite también cuando los términos de agua embalsada
  aplicados a la superficie no son nulos: alguna dovela con peso del agua mayor que 0 o empuje distinto de 0, E4
  incluido. El criterio actual se mantiene.
  - **Criterio:** la presa de B-03 (muro vertical en x = 20 de y = 2 a 14, embalse a y = 10 en x ≤ 20, círculo
    `xc 19`, `yc 18`, `r 13`) y el muro de A-09 emiten el aviso.
- **E15l-6 (B-01): γw por defecto según las unidades.** Si falta `water.unit_weight`:
  - en `SI`, vale 9,81 kN/m³;
  - en `imperial`, vale el resultado de convertir 9,81 kN/m³ con el mismo factor que usa
    `apps/web/src/editor/state/units.ts`. Se cita la constante y el valor ronda 62,45 pcf.
  - **Alcance:** el valor rige para la piezométrica, el agua embalsada y el agua en la grieta.
  - **Esquema:** cambia solo la descripción del campo en el esquema 0.5.
  - **Conversor:** `verification/harness/to_cslope.py` sigue la misma regla. Es el único archivo de `verification/`
    de M-A.
  - **Criterio:** la grieta con agua de B-01 en imperial, sin `water`, da el mismo FS que en SI, a ≤ 1e-9.
- **E15l-7 (B-06): mensaje de una búsqueda sin superficies por la grieta.** Si una búsqueda termina en
  `NoValidSurface` y hubo k > 0 candidatos descartados por `tension_crack_not_reached`, el paréntesis final pasa a:

  ```
  ({e} evaluadas, 0 válidas; {k} no alcanzan la grieta de tracción, tension_crack_not_reached)
  ```

  Con k = 0, el mensaje es el de siempre, byte a byte.
- **E15l-8 (A-13): tolerancias de la grieta.**
  - `crack.rs` compara el agua con `ground + tol` (E15j-4).
  - `Pw` se asigna a la última dovela con peso mayor que 0, nunca a una dovela de aire.
- **E15l-9 (A-12): solo documentación.** El docstring de `Slice` (M-A) y `docs/limitaciones.md` (P) dicen que, tras
  E15j-8, puede quedar un hueco ≤ 1e-6·ancho entre dos dovelas vecinas. El motor no cambia.
- **E15l-10 (A-11): filas de agua embalsada.** M-A agrega a `f3g_rows.rs` al menos dos filas con términos de agua
  embalsada no nulos sobre la superficie analizada, con su valor del oráculo.
  - Las filas `X21-CP-V042` y `X21-CP-V061` se quedan, con un comentario: «sin términos embalsados en la superficie».
  - P documenta en `docs/verificacion.md` qué casos ejercitan de verdad el agua embalsada en la superficie de su check.
    Lo mide con `Σ|weight_extra|` y `Σ|h_force|`.

### Motor: Ito-Matsui (dueño M-B)

- **E15l-11 (A-02): perfil no finito.**
  - Si un nodo del perfil del pilote (`p`, `F` o `Q`) no es finito, el análisis termina con este error antes de resolver:

    ```
    InvalidModel: reinforcements[i].lateral_pressure: la presión de Ito-Matsui no es finita con S/D = {s/d} y φ = {φ}° (las ecuaciones 13 y 14 desbordan cuando S/D se acerca a 1); aumente spacing
    ```

  - La salida nunca lleva `NaN` ni `∞`.
  - **Criterios:** la reproducción de A-02 da ese error; el perfil 1,47e141 con φ = 25° sigue calculando.
- **E15l-12 (A-06): precedencia de `ru` en σ′v. Enmienda E15i-3.**
  - **En un material con `ru`:** `σ′v = σv − ru·σ_suelo`, sin restar la `u` de la piezométrica (E14o-4). Así lo
    hacen `slicer.rs`, el `interface` de los refuerzos y el conversor a cSlope.
  - `σv` toma `γ` o `γsat` exactamente como lo hace el cortador para ese material, y suma la sobrecarga del agua
    embalsada (E15c).
  - **Sin `ru`:** `σ′v = σv − u`.
  - **Criterio:** una fila nueva con `ru = 0,2` y piezométrica queda a ≤ 0,1 % del oráculo, pasando por `to_cslope`.
- **E15l-13 (A-07): el brazo en el primer tramo.** Entre nodos, `F(zf)` sigue interpolándose linealmente, como en
  cSlope, y `Q` se calcula con la misma fracción:

  ```
  Q(zf) = Q[k−1] + (F(zf) − F[k−1])·(z[k−1] + zf)/2
  ```

  - Así `0 < arm ≤ zf − z_top` siempre que `zf > z_top`, y `capacity.moment` aplica siempre que `arm > 0`.
  - **Criterios:**
    - la reproducción de A-07 (cabeza a 1,87, cruce a 1,8576, `moment 0,01`) da `governs: bending`;
    - las 28 filas de X22 siguen a ≤ 0,1 % del oráculo, informando el nuevo máximo.

### Web: agua y grieta (dueño W1)

- **E15l-14 (B-01): γw en la web.**
  - `convertDocUnits` escribe `water.unit_weight` siempre que se usa agua: con `piezometric_line` o con
    `tension_crack.water_fill > 0`.
  - `AnalysisPanel` lo escribe al activar el agua de la grieta en imperial si falta.
  - El informe muestra γw cuando hay piezométrica, agua embalsada o agua en la grieta. «Sin agua (no aplica)» queda
    solo para el modelo sin ningún uso del agua.
  - **Criterio:** la reproducción de B-01 (SI → imperial) da el mismo FS con el motor real, a ≤ 1e-9.
- **E15l-15 (B-02): grieta con `depth ≤ 0` en el resultado.** La tabla, el PDF, el CSV, el resumen y el lienzo
  muestran «Sin grieta (z = 0)», sin `x_c` ni porcentaje de agua. `warningContext` marca `tensionCrack` solo si
  `depth > 0`.
- **E15l-16 (B-06): errores de la grieta.**
  - `errors.ts` traduce `tension_crack_not_reached` al español, en las dos formas: superficie fija y búsqueda (E15l-7).
  - `issueNav` lleva al control de la grieta, `/analysis/tension_crack`.
- **E15l-17 (B-08): motor simulado.** `mockEngine` rechaza un modelo con agua sobre el terreno o con agua en la
  grieta, igual que hace con los refuerzos y la grieta: «El motor simulado no modela el agua embalsada; use el motor
  WASM.».
- **E15l-18 (B-09): textos.**
  - `editor.ru_over_piezo` dice que, en ese material, la presión de poros sale de `ru` y no de la piezométrica, pero
    que la piezométrica sigue aportando el agua embalsada sobre el terreno, su peso y su empuje. Comprueba con el motor
    lo que hace γsat con `ru` y escríbelo tal cual.
  - `WaterPanel` y `App` cuentan el agua de la grieta.
- **E15l-19 (B-10): cambio de criterio al abrir un modelo.**
  - Un documento de cualquier versión con la piezométrica sobre el terreno produce la nota informativa
    `io.pond_changed` al abrirlo: «La piezométrica pasa sobre el terreno: desde la v0.4.0 se suma el agua embalsada
    (peso y empuje), así que el FS puede diferir del calculado con la v0.3.0 o anteriores.».
  - Si el documento tiene agua sobre el terreno, `io.version_upgraded` no dice «el resultado del cálculo no cambia».
  - La Ayuda (`POND_CONVENTIONS`) agrega la misma frase.
- **E15l-20 (A-13, interfaz):** con una grieta de profundidad fija y búsqueda, Diagnósticos muestra la nota
  informativa `editor.crack_fixed_search`: «Una grieta de profundidad fija descarta las superficies más someras que su
  profundidad; compare con un análisis sin grieta.». Se agrega solo si no existe ya una equivalente.

### Web: Ito-Matsui en el lienzo y las salidas (dueño W2)

- **E15l-21 (B-05): verticalidad.** `isVerticalReinforcement(r)` es verdadero para una `sheet_pile` o un `pile` con
  `lateral_pressure`. `moveEnd`, `keys.ts` y `gesture.ts` lo usan para mantener `x1 = x2`.
- **E15l-22 (B-11): punto de aplicación.**
  - Con `location: centroid`, la flecha nace en `(x, y + arm)`; con `slip_surface`, en `(x, y)`. Vale para el lienzo,
    Casos y el PDF.
  - La información emergente del lienzo muestra `soil_force`, `governs` y `arm`.
- **E15l-23 (B-12b y B-12c).**
  - `validate.ts` comprueba la forma de `tension_crack` en el resultado: `x`, `depth` ≥ 0 y `water_force` ≥ 0, todos
    finitos.
  - El aviso de S/D de la tarjeta lleva `role="status"`.

### Python, CLI y documentación (dueño P)

- **E15l-24 (B-04): Python v0.5.**
  - El docstring de `crates/ogs-py/python/opengeoslide/__init__.py` y `crates/ogs-py/README.md` cubren:
    - la grieta;
    - el agua embalsada automática y su cambio frente a la v0.3.0;
    - Ito-Matsui con su alcance estructural exacto.
  - Se quitan las afirmaciones de la v0.4 que ya son falsas.
  - Se agrega `crates/ogs-py/tests/test_v05.py`, que se corre con el procedimiento de `docs/desarrollo.md`.
- **E15l-25 (B-12a): ayuda de la CLI.** El `USAGE` de `crates/ogs-cli/src/main.rs` lista `tension_crack`,
  `lateral_pressure` y `capacity`, y quita la nota de antes de Ito-Matsui.
- **E15l-26 (B-07 y A-10): documentación.**
  - `docs/limitaciones.md`:
    - quita las entradas de «γsat sin cobertura» (E15k);
    - actualiza las cifras a 327/327, 151 casos y D28-D42;
    - documenta E15l-9 (hueco de dovelas) y A-05.
  - `docs/verificacion.md` y `docs/desarrollo.md` citan `schema/ogs-0.5.schema.json`.
  - En el bloque en inglés del README, la frase de los pilotes queda coherente con Ito-Matsui.
- **E15l-27 (A-05): limitación documentada, sin cambio del motor.** Spencer, M-P y los dos Janbu rechazan con
  `no_driving` una polilínea totalmente sumergida. cSlope tampoco la resuelve.

### Lo que no se adopta o queda para la publicación

- **A-05:** el motor no cambia; queda la documentación de E15l-27. Rechazar es del lado seguro y el oráculo tampoco
  resuelve el caso.
- **A-12:** el motor no cambia; queda la documentación de E15l-9. El hueco es de 0,8 µm en un modelo de 100 m.
- **A-13 (G9):** descartar las superficies más someras es la convención declarada de G9. Solo se agrega la nota de
  E15l-20.
- **B-12d:** las versiones `0.4.0` de `Cargo.toml`, `package.json` y `CITATION.cff` las cambia el coordinador en el
  commit de la publicación.

## F5.13 Correcciones de la revisión de cierre R13 (E15m)

**Fuentes.** `docs/reviews/R13_agy_A.md` (lente A, motor) y `R13_agy_B.md` (lente B, salidas). Las dos lentes dieron
«APTO CON CORRECCIONES».
- **Lente A:** de los 13 hallazgos de R12 cierra 9 (A-01, A-03, A-04, A-06, A-07, A-09, A-10, A-11, A-13); deja 2
  parciales (A-02, A-08) y 2 no adoptados con justificación (A-05, A-12).
- **Lente B:** cierra 11 de los 13 renglones de R12 (B-01 a B-10, más B-12a/b/c); B-11 queda parcial y B-12d queda
  no adoptado, porque el contrato lo difiere a la publicación.

**Reproducciones del coordinador** con el binario `32b1fa7`, en `docs/fase3/r13/repro/`:
- **A-03:** el escalón vertical con una grieta fija de 2 m da en el binario actual `depth 4,9707`, `Pw 121,19` y Bishop
  1,751144. Antes de R12 daba `depth 2`, `Pw 19,62` y 1,882066.
- **A-02:** una polilínea que nace 1e-12 dentro del paramento lleva Spencer de 2,66591 a 3,49275, un 31 % del lado
  inseguro. El defecto ya existía antes de R12.
- **A-01:** el pilote da `arm: null` y `no_capacity`.
- **B-01:** se confirmó que cambia el FS de un archivo imperial v0.3 que tiene piezométrica y no tiene
  `water.unit_weight`.

**Regla común.** Las de §F5.12 siguen vigentes:
- identidad con 0 diferencias en 150 modelos;
- 327 checks y 0 fallas;
- todo cambio en los modelos con grieta, agua embalsada o Ito-Matsui se explica por su enmienda, con los números antes y
  después.

### Motor: grieta y agua (dueño M)

- **E15m-1 (A-03): la grieta fija no se reescribe. Enmienda E15l-2.**
  - Con `depth` numérica, la profundidad informada y aplicada es **siempre** la del usuario, igual que antes de R12 y
    que cSlope.
  - La regla de la cara real de E15l-2 rige solo con `depth: "auto"`.
  - **En un escalón vertical del terreno con `auto`,** la cara se mide desde el terreno del **lado de la entrada** de
    `x_c`, es decir, desde el límite lateral por el que llega el barrido.
  - **Antes de fijar la regla de `auto`,** M compara contra el oráculo, con `to_cslope`, el escalón de
    `a03_escalon_fija.json` con `auto` y con fija. Si cSlope no coincide con ninguna de las dos variantes, M informa con
    números y no implementa esa variante.
  - **Criterios:**
    - `a03_escalon_fija.json` da `depth 2`, `Pw 19,62` y Bishop 1,882066 (≤ 1e-9), y queda a ≤ 0,1 % de cSlope;
    - `a04_udl.json` no cambia;
    - las 55 filas de `f3g_rows.rs` y las 3 de `r12` no cambian.
- **E15m-2 (A-02): el paramento no se pierde por redondeo.**
  - `ground_pieces` se consulta con el tramo ampliado en `wall_tol` a cada lado, solo para detectar los paramentos (E4).
    Los términos de peso de los tramos no cambian.
  - **Criterio:** `a02_paramento_dx1e-12.json` da el mismo FS y el mismo `Σh_force` que `a02_paramento_dx0.json`, a
    ≤ 1e-6 relativo. Se agrega también el caso con dx = 1e-9.
- **E15m-3 (A-05): el empuje del paramento va al lado alto.** E15l-4 asigna el paramento solo a una dovela cuyo centro
  esté del lado alto: `(x_m − wall.x)·high_side > 0`.
  - **Criterio:** la reproducción de A-05 (muro esbelto, carga lineal en x = 5,999995 y polilínea solo del lado bajo)
    da `Σh_force` igual al caso sin carga lineal.
- **E15m-4 (A-04): el barrido de la grieta incluye los vértices de la piezométrica.** Se agregan a E15l-3.
  - **Criterio:** la reproducción de A-04 (pico piezométrico entre dos pasos) da la misma grieta que cuando el pico
    coincide con un paso.
- **E15m-5 (A-06): el atajo de la entrada se evalúa hacia dentro.** El atajo `depth.at(x_entry) <= 0` se evalúa en
  `x_entry + s·tol`, donde `s` es el sentido hacia la masa. Así, una UDL que solo toca la entrada desde fuera no anula
  la grieta.
  - **Criterio:** con δ = 0 y con δ = +1e-6 la reproducción de A-06 da lo mismo, a ≤ 1e-6, y queda a ≤ 0,1 % de
    cSlope (1,564943).
- **E15m-6 (B-01): aviso de γw por defecto. Excepción de identidad declarada.**
  - **La excepción:** E15l-6 corrigió el γw por defecto en imperial, que pasó de 9,81 «pcf» a 62,45 pcf. Esto cambia
    **a propósito** el FS de un archivo imperial que **usa agua** (piezométrica, agua embalsada o agua en la grieta) y
    **no tiene** `water.unit_weight`. Es la tercera clase de excepción a la identidad, después del agua embalsada y de
    V019.
  - **El aviso:** en ese caso el motor emite el aviso informativo nuevo `water_unit_weight_default`, una vez por
    análisis, con el texto: «El modelo usa agua y no indica `water.unit_weight`: se toma γw = 62,4 pcf (9,81 kN/m³).
    Las versiones anteriores a la v0.4.0 tomaban 9,81 también en unidades imperiales; indique el valor para fijarlo.».
  - **En SI** no se emite el aviso: el valor no cambia y la salida es la de siempre, byte a byte.
  - El código va a E6 y entra en `INFORMATIVE_WARNINGS`.
  - **Criterios:**
    - la reproducción de B-01 en imperial emite el aviso;
    - el mismo modelo en SI no lo emite y su salida es idéntica a la v0.3.0.

### Motor: Ito-Matsui (dueño M)

- **E15m-7 (A-01): un brazo o una fuerza no finitos son un error.**
  - El brazo se calcula sin el producto intermedio, como `(zf − q/soil).max(0)`.
  - Tras calcular cada cruce, si `soil_force`, `arm` o `available` no son finitos, el análisis termina con el
    `InvalidModel` de E15l-11, con S/D y φ.
  - **Criterio:** `a01_arm_null.json` da ese error o una salida finita con `arm > 0` y `governs` coherente. Nunca da
    `null` ni `no_capacity` por desborde.
- **E15m-8 (A-07):** `pressure_step` usa `model::is_imperial_units`.
  - **Criterio:** con `units: "imp"` el resultado es igual al de `"imperial"`, a ≤ 1e-12.

### Web (dueño W)

- **E15m-9 (B-01, web):**
  - `validateLocal` y `caseGate` dejan de **bloquear** un modelo imperial sin `water.unit_weight`. En su lugar emiten
    la nota informativa `editor.water_unit_weight_default`, con el texto de E15m-6 adaptado a la web.
  - Se mantiene el **error** cuando γw está en unidades incorrectas, por ejemplo 9,81 en imperial.
  - Se corrigen `waterUnitWeightHint` (`forms.ts`) y la Ayuda (`helpContent.ts`): si se deja vacío, el cálculo usa
    9,81 kN/m³ o 62,4 pcf, según las unidades.
  - `warnings.ts` agrega `water_unit_weight_default`.
- **E15m-10 (B-02): información emergente alcanzable.**
  - Las flechas de fuerza de Ito-Matsui y la línea de la grieta tienen un área de acierto, con `pointer-events:
    visibleStroke` o un trazo transparente más ancho.
  - Esa área muestra el `<title>` al pasar el puntero y no intercepta el arrastre de los tiradores ni las herramientas
    activas.
  - Si no es posible sin romper la edición, la misma información se ofrece en la tabla y en el panel, y la promesa de
    E15l-22 sobre la información emergente se retira de la documentación. W decide e informa.
  - El recorrido `r12_ito_lienzo.mjs` lo comprueba con `elementFromPoint`.
- **E15m-11 (B-03):** `pdf.engine.test.ts` no llama al motor durante la recolección, de modo que `pnpm test` sin
  `OGS_BIN` da 0 fallas.
- **E15m-12 (B-06):** Casos (`scene.ts` y `drawSection.ts`) dibuja «Sin grieta (z = 0)», como el editor.

### Python y documentación (dueño P)

- **E15m-13 (B-04), `test_v05.py`:**
  - La prueba de neutralidad compara `"0.3"` contra `"0.5"`.
  - Se agregan:
    - `grieta-udl-automatica` a `V05_BASES`;
    - las filas `f3g/r12` y `f3g3/expected_r12.json`;
    - pruebas de E15l-5, E15l-6 (más E15m-6) y E15l-7.
  - Las pruebas de E15m-1, -2, -6 y -7 se marcan `xfail(strict=False)` hasta la integración, como en R12.
- **E15m-14 (B-05 y B-01), documentación:**
  - Limpiar las referencias a ramas y commits efímeros en `docs/verificacion.md` (`f3g4d`, `f3g5p`, «motor de
    ae5ee73»).
  - `docs/limitaciones.md`: con `ru`, γsat sí usa la piezométrica.
  - Actualizar el resumen de `CITATION.cff` y el ejemplo `version()` de `crates/ogs-py/README.md`.
  - Declarar la excepción de E15m-6 donde se enumeran las excepciones de identidad: CHANGELOG, README, `limitaciones.md`
    y ogs-py.
  - Las cifras nuevas del motor se marcan con `<!-- R13: medir al integrar -->`.

### No adoptado

- Ninguno. Las versiones 0.4.0 de los manifiestos y el WASM recompilado (B-05, punto 5) van en el commit de la
  publicación.
