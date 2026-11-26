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
- **E15i.** Reservada para Ito-Matsui (ola G3), que se especificará después del núcleo.
