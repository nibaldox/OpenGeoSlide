# Contratos del bloque de refuerzos (F3R): formato v0.4

**Normativo.** Complementa a `00_CONTRATOS.md`, `01_CONTRATOS_FASE1.md` y `02_CONTRATOS_FASE3.md`. Las enmiendas se
numeran E14x y citan su evidencia.

**Base:** `main` en `bf1655c`, que es la v0.2.0.

**Evidencia:**
- `docs/fase3/exploracion/X14.md`: oráculo cSlope y prototipos sobre V047a;
- `X15.md`: práctica, Slide2 y Duncan y Wright;
- `X16.md`: mapa del motor, del formato y de la web;
- `docs/fase3/PLAN_REFUERZOS.md`.

Las partes marcadas **[cerrado en F4.16]** se cierran con el prototipo X17 (§F4.15) antes de la ola R1. Las demás están
congeladas desde ya.

## F4.1 Alcance y versión (E14a)

- **Formato `"0.4"`.**
  - El motor acepta 0.1, 0.2, 0.3 y 0.4.
  - `reinforcements` no vacío exige `version: "0.4"`. Con una versión menor el error es
    `InvalidModel: reinforcements requiere version "0.4"`, siguiendo el patrón de `first_v03_field`.
  - La web guarda la versión mínima (F3.9 extendida): 0.4 solo si hay refuerzos.
- **Tipos:**
  - `anchor`: tirante, activo o pasivo;
  - `nail`: clavo de suelo;
  - `geosynthetic`: geomalla o geotextil;
  - `pile`: pilote o micropilote, con fuerza constante;
  - `sheet_pile`: tablestaca, una fila continua de pilotes con su fuerza por metro de muro.

  Una tablestaca anclada se modela como `sheet_pile` más un `anchor`.
- **Se posponen**, con limitación documentada:
  - Ito-Matsui, que irá con el bloque de grieta de tracción y agua;
  - el campo de pretensado: el pretensado es un `anchor` activo con la carga de bloqueo como capacidad, igual que en
    Slide2;
  - la cizalla y la compresión de los clavos;
  - el arrancamiento que depende del material;
  - los clavos lanzados y los anclajes helicoidales;
  - la presión de fluido equivalente (EFP);
  - el soporte definido por el usuario.
- **Identidad:** con `reinforcements` ausente o vacío, la salida es idéntica **byte a byte** a la de la v0.2.0 para
  todos los modelos. Es gate de cada ola.

## F4.2 Esquema (E14b)

`Model.reinforcements: Vec<Reinforcement>` va al nivel raíz, después de `loads`. Es opcional y se omite al serializar
si está vacío.

- **Serde:**
  - `tag = "type"`, `rename_all = "snake_case"` y `deny_unknown_fields` en cada variante;
  - unidades del modelo (SI o imperial);
  - fuerzas por elemento, salvo que se diga otra cosa.

**Campos comunes** (todos los tipos):

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string | Obligatorio, no vacío y único en `reinforcements` |
| `x1`, `y1` | número | Obligatorios. Cabeza: el extremo en el paramento o en la superficie del terreno. En pilotes y tablestacas, la cabeza superior |
| `x2`, `y2` | número | Obligatorios. Extremo embebido, es decir, la punta. Longitud `L = ‖(x2−x1, y2−y1)‖ > 0` |
| `application` | `"active"` \| `"passive"` | **Obligatorio**, sin valor por defecto |

**`anchor`, `nail`, `geosynthetic`:**

| Campo | Tipo | Regla |
|---|---|---|
| `tensile_capacity` | número ≥ 0 | Obligatorio. Tope de la barra o tira, por elemento |
| `end1_capacity` | número ≥ 0 | Opcional, 0 por defecto. Placa o anclaje en la cabeza |
| `end2_capacity` | número ≥ 0 | Opcional, 0 por defecto. Anclaje en la punta |
| `spacing` | número > 0 | Opcional, 1 por defecto. Espaciamiento fuera del plano, centro a centro |
| `direction` | `"axial"` \| `"tangent"` \| `"bisector"` | **Obligatorio** |
| `pullout` | objeto o ausente | Ausente: los dos extremos totalmente anclados, `T(s) = tensile_capacity` en todo el elemento |

**`pullout`**, objeto etiquetado por `model`, con `deny_unknown_fields`:
- `{ "model": "bond", "strength": r ≥ 0, "bonded_length": ℓ > 0 opcional }`
  - `strength` es la fuerza por metro de elemento.
  - Sin `bonded_length`, la adherencia actúa en todo el elemento.
  - Con `bonded_length`, solo en los últimos ℓ metros hacia la punta (extremo 2), con ℓ ≤ L.
- `{ "model": "interface", "adhesion": a ≥ 0, "friction_angle": δ en [0, 90), "coverage": Rc en (0, 1] }`
  - Usa el coeficiente de interacción del geosintético con el suelo, por ambas caras.
  - Fórmula y esfuerzo vertical: **[cerrado en F4.16]**.
- `{ "model": "development", "length1": ℓ₁ ≥ 0, "length2": ℓ₂ ≥ 0 }`
  - La capacidad crece linealmente desde cada extremo hasta `tensile_capacity`.
  - Con ℓ = 0, ese extremo queda totalmente anclado.
  - Forma exacta: **[cerrado en F4.16]**.

**`pile`:**

| Campo | Tipo | Regla |
|---|---|---|
| `force` | número ≥ 0 | Obligatorio. Fuerza de corte constante por pilote |
| `spacing` | número > 0 | Opcional, 1 por defecto |
| `direction` | `"angle"` \| `"tangent"` \| `"perpendicular"` | **Obligatorio** |
| `angle` | grados en (−90, 90) | Obligatorio **solo** con `direction: "angle"` y prohibido con las otras. Se mide sobre la horizontal: 0 es horizontal |
| `location` | `"slip_surface"` \| `"centroid"` | **Obligatorio**. Semántica: **[cerrado en F4.16]** |

**`sheet_pile`:**

| Campo | Tipo | Regla |
|---|---|---|
| `force` | número ≥ 0 | Obligatorio. Fuerza de corte **por metro de muro**, sin `spacing` |
| `direction`, `angle`, `location` | | Como en `pile` |

Además, la tablestaca es vertical: `x1 = x2`.

- **Rangos:** todo finito; las capacidades y la fuerza ≥ 0; `spacing > 0`; `friction_angle` en [0, 90); `coverage` en
  (0, 1].
  - El error es `InvalidModel` con la ruta JSON del campo, por ejemplo `reinforcements[2].pullout.coverage`.
- **El esquema se publica** en `schema/ogs-0.4.schema.json`, con las mismas reglas.
  - El esquema y el motor aceptan y rechazan los mismos documentos.
  - La tabla de acuerdo de `verification/tools/test_schema.py` se extiende con los casos de rechazo.

## F4.3 Capacidad disponible (E14c)

Para un elemento de tracción (`anchor`, `nail` o `geosynthetic`), en la estación `s ∈ [0, L]` medida desde la cabeza:

```
T(s) = max(0, min(Tmax, T1 + ∫₀ˢ r(σ) dσ, T2 + ∫ₛᴸ r(σ) dσ)) / spacing
```

donde Tmax = `tensile_capacity`, T1 = `end1_capacity`, T2 = `end2_capacity` y r es la resistencia de arrancamiento
por metro.
- Sin `pullout`, `T(s) = Tmax / spacing`.
- Con `bond`, r = `strength` en el tramo adherido y 0 fuera de él.
- `interface` y `development`: **[cerrado en F4.16]**. Se debe reproducir cSlope en `model/reinforcement.rs`, que se
  lee y no se copia.

## F4.4 Cruces, nodos y dovela (E14d)

1. **Cruces.**
   - Cada cruce del segmento del refuerzo con la **superficie de deslizamiento ya ajustada**, ya sea el arco inferior
     del círculo o la polilínea ajustada, da un cruce `(x_c, y_c)` con su estación `s_c = t_c·L`.
   - Un elemento que cruza dos veces da dos fuerzas, cada una con su `T(s_c)`.
   - Un cruce en un extremo del refuerzo, con t_c igual a 0 o a 1 dentro de `tol`, no cuenta.
2. **Nodos.**
   - Cada `x_c` aporta los nodos `x_c ± 1e-6·ancho`, igual que una carga lineal (E12f).
   - La fuerza actúa en la dovela fina centrada en `x_c`, y así el brazo de la componente vertical respecto del punto
     medio de la base es cero.
   - **Con eso no hay frontera compartida.** Si en un caso degenerado `x_c` cae en una frontera, la fuerza va a la
     dovela del lado del pie.
3. **Fuera de la masa.**
   - Un cruce sobre una dovela aérea o sobre un bloque descartado por truncamiento (E7a) no aplica fuerza. Tampoco un
     refuerzo sin cruces.
   - Si ningún cruce de un refuerzo aplica fuerza, se emite la nota `reinforcement_outside_mass`, que es informativa,
     igual que `load_outside_mass`.
4. **Búsqueda.** Los cruces y los nodos se calculan para **cada candidato**. Ningún cálculo cambia de firma.

## F4.5 Dirección y sentido (E14e) **[cerrado en F4.16]**

Se fija con X17 a partir de cSlope (`model/reinforcement.rs`, en las líneas que cita X14 §1.3):
- el vector de movimiento m en la base;
- el vector d del elemento hacia el lado estable;
- el criterio `along` y los modos `axial`, `tangent` y `bisector`;
- la regla de **compresión** del pasivo: no aporta si queda más de 2° pasado la normal a la base, según Clouterre
  (1991) y FHWA GEC 7;
- en pilotes, `angle`, `tangent` y `perpendicular`, siempre opuestos al movimiento.

Cuando un pasivo se descarta por compresión, se emite la nota `reinforcement_compression_ignored`, informativa.

## F4.6 Fuerza activa (E14f)

Una fuerza activa P = (Px, Py), en coordenadas del modelo con y hacia arriba, aplicada en `(x_c, y_c)`, es una carga
externa conocida y **no se divide por F** (Duncan y Wright, método A). Con s = +1 si el deslizamiento va hacia +x y
s = −1 en caso contrario, se suma a la dovela k que la recibe:

```
weight_extra_k   += −Py                     (V, hacia abajo)
h_force_k        += s·Px                    (H, en el sentido del deslizamiento)
h_moment_base_k  += s·Px · (y_c − y_base_mid_k)
driving_extra_k  += s·Px · (yc − y_c) / R   (solo en círculo, Bishop)
```

- Es la misma ruta que las cargas lineales (E12b y E12f), con el punto de aplicación en el cruce y no en el terreno.
- La dovela que recibe la fuerza **no** entra en E3 de forma distinta.
- El sismo (kh y kv) **no** actúa sobre las fuerzas de los refuerzos.

## F4.7 Fuerza pasiva (E14g)

Una fuerza pasiva se moviliza con el deslizamiento y **se divide por F** (Duncan y Wright, método B, el mismo criterio
de cSlope). Toda componente de una fuerza pasiva entra en las ecuaciones de equilibrio del método **en los mismos
términos que una activa de F4.6, multiplicada por 1/F**, con el F que se está evaluando.
- En la dovela van campos propios, que valen **cero sin refuerzos**: `passive_v`, `passive_h`,
  `passive_h_moment_base` y `passive_driving_extra`.
- Cada método evalúa `W* + passive_v/F`, `H + passive_h/F` y así con los demás, en cada evaluación de F.
- **Bishop:** la iteración de punto fijo ya evalúa `rhs(F)`; los términos pasivos entran en N′ y en el momento motor
  con 1/F.
- **Spencer y M-P:** `Prep` deja de ser constante por resolución cuando hay pasivos. Sin pasivos, el camino de
  siempre debe quedar byte a byte.
- **Janbu:** la raíz F₀ de `E_n(F, λ = 0)` incluye los pasivos con 1/F. El corregido es `f₀·F₀` con el f₀ de
  E13l-1, que no cambia con los refuerzos.
- La equivalencia algebraica con la forma de cSlope, «momento pasivo completo en el resistente», se comprueba en X17.
  El criterio de aceptación es el oráculo de F4.13.

## F4.8 Pilotes y tablestacas (E14h)

- **Fuerza en el cruce:** `force / spacing` en `pile` y `force` en `sheet_pile`.
  - Actúa siempre **opuesta al movimiento**, con la dirección de `direction`.
  - Se aplica activa o pasiva según `application`, con F4.6 y F4.7.
  - **No hay** regla de compresión, como en cSlope (X14 §1.4).
- **`location`:** **[cerrado en F4.16]**.
- **Límite declarado.** Con un `pile` o una `sheet_pile` en el modelo, el informe, el PDF y la Ayuda dicen siempre que
  OpenGeoSlide calcula la estabilidad **global** con el elemento incluido. **No** calcula:
  - el empuje sobre el elemento;
  - el empotramiento;
  - el momento flector;
  - la deflexión;
  - las comprobaciones internas o externas de un muro.

  El motor emite la nota `structural_checks_not_covered`, informativa, siempre que exista un `pile` o una `sheet_pile`
  en el modelo, lo crucen o no.

## F4.9 Informe (E14i)

`MethodResult` gana `reinforcement_forces`, que se omite si está vacío.

```json
"reinforcement_forces": [
  { "id": "ancla-1", "crossing": 0, "x": 42.31, "y": 28.0, "station": 9.69,
    "available": 100.0, "fx": 100.0, "fy": 0.0, "application": "active", "status": "applied" }
]
```

- `available` es T(s_c) por metro, o la fuerza del pilote por metro.
- `fx` y `fy` son la fuerza **aplicada** por metro.
  - En un pasivo es la fuerza disponible, antes de dividir por F. El informe dice «pasiva: se moviliza dividida por
    F».
- `status` toma uno de tres valores:
  - `applied`;
  - `outside_mass`, cuando el cruce cae en el aire o en un bloque descartado;
  - `compression_ignored`.
- Se emiten solo para los métodos convergidos y sobre la superficie final, no para cada candidato de la búsqueda.

**Códigos nuevos**, todos notas informativas que van a la lista blanca de aceptación:
- `reinforcement_outside_mass`;
- `reinforcement_compression_ignored`;
- `structural_checks_not_covered`.

Se agregan a E6 (`00_CONTRATOS.md`) y a `apps/web/src/engine/warnings.ts` **en el mismo merge**.

## F4.10 Métodos y superficies (E14j)

- Los refuerzos funcionan con **todos** los métodos de F3a y con las dos superficies.
- **Bishop** sigue limitado a los círculos (F3.6).
- E13k, el aviso de cortante entre dovelas, se evalúa igual; los refuerzos no entran en la resistencia de las caras.
- La escala de E13l-3 incluye las fuerzas de los refuerzos en `t_i` y `H_i`; las pasivas, con su valor disponible.
  **[cerrado en F4.16: lo mide R1-M]**

## F4.11 Web (E14k)

- **Formato:**
  - `minimalVersion` sube a 0.4 solo con refuerzos;
  - lectura y guardado sin pérdida, con `deny` de claves desconocidas;
  - el motor simulado rechaza los modelos 0.4 con un error explícito.
- **Panel «Refuerzos»:**
  - lista, alta, baja y edición por tipo, con la validación local de F4.2;
  - los tipos rotulados en español: Anclaje, Clavo, Geosintético, Pilote y Tablestaca.
- **Lienzo:**
  - cada refuerzo es un segmento con dos tiradores, y la tablestaca tiene la x fija;
  - funciona con puntero, teclado y táctil;
  - herramienta «Dibujar refuerzo»: dos clics;
  - arrastrar el centro mueve los dos extremos en un solo paso de historial;
  - un símbolo por tipo y una flecha de fuerza en el resultado.
- **Informe PDF, CSV y Casos:**
  - una tabla de fuerzas por refuerzo con id, tipo, cruce, estación, disponible, aplicada y estado;
  - el texto de límite de F4.8 cuando hay pilotes o tablestacas.
- **Contrato UX:** solo tokens `var(--ui-*)` y `var(--canvas-*)`, AA, nombres accesibles estables y axe sin
  hallazgos serios ni críticos.

## F4.12 Verificación (E14l)

- **Casos publicados del corpus de cSlope (X14 §7):**
  - **R1, anclajes:** V016b, V035a y V035b; también V037, si la búsqueda circular basta;
  - **R2, clavos:** V011a, V011b, V012, V064, V065, V066a, V066b, V066c y V066e;
  - **R3, geosintéticos:** V010, V010b, V014, V083 y V084a a V084f;
  - **R4, pilotes de fuerza constante:** V015 y V095c.

  V013b a V013e (Ito-Matsui) quedan en `pending/`.
- **Manual de Slide2:**
  - VP 58, 59, 85 y 86;
  - VP 47, 48 y 50;
  - VP 31, 32, 87, 88 y 94;
  - VP 54.

  Se transcriben citando la tabla del manual.
- **Tablestaca:** se verifica contra el oráculo (pilote `wall: true`) y con tres identidades:
  - con capacidad cero, el talud sin el elemento;
  - un elemento que la superficie no cruza no cambia nada;
  - el FS crece de forma monótona con la fuerza.
- **Batería diferencial:** cada tipo sobre modelos de la batería, con Bishop, M-P y Janbu, a 0,5 % del oráculo.
- **Equilibrio global independiente:** el momento respecto de dos puntos y la fuerza, con las fuerzas de los refuerzos
  (activas, y pasivas divididas por F), con un residuo menor que 1e-6 de la escala.
- **Espejo:** x → −x invierte el refuerzo y da el mismo FS.

## F4.13 Criterio de aceptación de los métodos (oráculo)

Sobre V047a, con el círculo fijo de F3.8 (`xc 29.54334963719809`, `yc 53.63784815923435`, `r 28.641487934160704`,
50 dovelas, tolerancia 1e-5), con Bishop, M-P `constant` y Janbu corregido, dentro de **0,1 %** de cSlope en las filas
de X14 §2.2:

| Fila | Escenario | Bishop | M-P `constant` | Janbu corregido |
|---|---|---|---|---|
| 1 | Ancla activa | 1,333661 | 1,329252 | 1,319292 |
| 2 | Ancla pasiva | 1,248405 | 1,245588 | 1,252327 |
| 3 | Clavo pasivo, `bond` | 1,375819 | 1,372304 | 1,379714 |
| 5 | Geomalla pasiva, `interface` | 1,139869 | 1,137672 | 1,142257 |
| 7 | Pilote activo | 1,108256 | 1,105923 | 1,101488 |
| 9 | Pilote pasivo | 1,096378 | 1,094400 | 1,095828 |
| 11 | Tablestaca | 1,455483 | 1,448712 | 1,409314 |

- X17 repite estas cifras con el oráculo antes de fijarlas y agrega las filas de dirección inclinada.
- El test de aceptación de R0 las escribe en RED.

## F4.14 Gates del bloque

Son los de F3.11, más:
- identidad byte a byte sin refuerzos;
- los criterios de F4.13;
- la tabla de acuerdo entre el esquema y el motor;
- la ida y vuelta de la web con los modelos 0.4;
- los recorridos de Chrome del panel y del lienzo, en claro y en oscuro, con axe.

## F4.15 X17: prototipo de las partes condicionales

Un explorador (Sonnet, solo lectura, con código desechable en `$TMPDIR`) entrega `docs/fase3/exploracion/X17.md`, con
cada punto verificado con números del oráculo:
1. F4.5 completo, en notación de ogs:
   - m, d, `along` y los tres modos;
   - la regla de compresión;
   - la dirección de los pilotes;
   - la anomalía de X14 §5, con su causa.
2. `interface`: la fórmula de r y el σ′v que usa cSlope, con agua y sin agua. `development`: la forma de la rampa.
3. `location` de los pilotes: dónde se aplica la fuerza con `centroid` y con `slip_surface`, para fuerza constante.
4. **Prototipo numérico.**
   - Con las dovelas de ogs (`ogs analyze` del círculo fijo de V047a), implementa en Python Bishop y Janbu
     simplificado con activas y pasivas según F4.6 y F4.7.
   - Reproduce las filas de F4.13 dentro de 0,1 %. Spencer, si alcanza.
   - Si F4.7 no reproduce el oráculo, mide la convención alternativa y repórtala sin elegir.
5. **VP 58 (tieback activo, Spencer 1,145) y VP 47 (clavos pasivos, Janbu 0,890) de Slide2 en cSlope:** ¿la
   convención del oráculo reproduce a Slide2? La respuesta va con números.

## F4.16 Cierre de las partes condicionales con X17 (E14m, decisiones del coordinador)

Evidencia: `docs/fase3/exploracion/X17.md`. El oráculo instalado (`a80f9a0`) se midió y el clon (`0f07e7a`) se leyó.
Prevalece sobre el texto de F4.2 a F4.13 donde difieran.

### E14m-1, dirección, sentido y compresión (cierra F4.5)

- **Notación:**
  - s = +1 si el deslizamiento va hacia +x.
  - α es la inclinación de la base, con el campo `alpha` de ogs.
  - El movimiento en la base es `m = (s·cos α, −sin α)`.
  - `n` es la normal a la base hacia la masa.
  - `a = (x2 − x1, y2 − y1)/L`.
  - `d = −a` si `a·n > 0`, y `d = a` en caso contrario. Es la parte del elemento bajo la superficie, hacia el lado
    estable, y no depende de cuál extremo es la cabeza.
  - `along = d·m`.
- **Dirección de la fuerza sobre la masa `u`:**
  - si `along > 0`, `u = d` (axial), sea cual sea `direction`;
  - si no, `axial` da `u = d`, `tangent` da `u = −m` y `bisector` da `u = (d − m)/‖d − m‖`.

  La fuerza es `P = T(s_c)·u`, en **coordenadas del modelo**, con y hacia arriba.
- **Compresión del pasivo:** un elemento **pasivo** con `along ≥ cos 88°` no aporta. Su estado es
  `compression_ignored` y se emite la nota `reinforcement_compression_ignored`.
- **Activo comprimido, decisión del coordinador.** Un elemento **activo** se aplica **siempre**, también con
  `along > 0`, axial y con su fuerza completa.
  - **Motivo:** es una carga externa conocida, la de bloqueo (F4.6; Duncan y Wright, método A). Es la regla vigente de
    cSlope (`CHANGELOG.md:24` del clon).
  - Con `along > 0` la fuerza tiene una componente a favor del deslizamiento; **no** es siempre conservador aplicarla, porque con φ > 0 su componente normal confina la base (corregido en E14o-8, que agrega la nota `reinforcement_active_compression`).
  - El binario instalado del oráculo es anterior y descarta esos cruces, por lo que **las filas de aceptación con el
    oráculo solo usan cruces con `along < 0`**.
  - Los activos con `along > 0` se verifican con el equilibrio global independiente y con un test que fija `u = d`.
- **Pilotes y tablestacas:**
  - `angle` se mide sobre la horizontal y es positivo hacia arriba: `u = (−s·cos a, sin a)`;
  - `tangent` da `u = −m`;
  - `perpendicular` da la normal al eje que se opone al movimiento;
  - **sin** regla de compresión;
  - invariante al espejo.
- **Cruces múltiples:** cada cruce se evalúa con su propio `along`, como en F4.4.
- No se exige que la cabeza esté sobre el paramento.

### E14m-2, capacidad (cierra F4.3)

- **`bond`:** r = `strength` solo en los tramos del elemento **dentro del suelo**, en la parte adherida (los últimos
  `bonded_length` hacia la punta, o todo el elemento), y 0 en el aire.
- **`interface`:** `r = 2·(a + σ′v·tan δ)·Rc` por metro de talud, con r = 0 fuera del suelo.
  - El `spacing` se cancela y Rc **no** escala las capacidades de la barra ni de los extremos.
  - `σ′v = max(0, σ − u − ru·σ_suelo)`, donde σ es la columna de suelo sobre el punto, con γsat bajo la línea de agua
    del material, más el agua libre sobre el terreno si la hay.
  - σ′v no incluye sobrecargas ni cargas lineales.
  - ogs **integra exactamente**, con los cortes en el terreno y en los contactos. El oráculo discretiza en 200 pasos,
    lo que da hasta −0,47 % en T.
- **`development`:**
  - `f1 = T1 + Tmax·s/ℓ1` y `f2 = T2 + Tmax·(L − s)/ℓ2`;
  - ℓ = 0 vale +∞;
  - `T = max(0, min(Tmax, f1, f2))/spacing`.

  T1 y T2 **se suman** a la rampa, que no mira el suelo.
- **Capacidad nula:**
  - Un cruce con `T(s_c) = 0` no aplica fuerza y queda con el estado `no_capacity` en `reinforcement_forces`.
  - El caso típico es el tramo libre de un tirante con `bonded_length` y sin `end1_capacity`.
  - No se emite nota. Lo documentan la Ayuda y la limitación correspondiente.
  - La web propone `end1_capacity = tensile_capacity` al crear un `anchor`.

### E14m-3, `location` (cierra F4.8)

- **Se quita `location` de `pile` y `sheet_pile` en v0.4.** Con fuerza constante no tiene efecto: el FS de X17 §3 es
  idéntico a 16 cifras.
- La fuerza actúa en el cruce.
- Volverá, si hace falta, con Ito-Matsui en una versión posterior del formato.
- El esquema, el motor y TypeScript lo rechazan como campo desconocido. El conversor al oráculo escribe
  `"slip-surface"`.

### E14m-4, informe (completa F4.9)

- `fx` y `fy` se dan en coordenadas del modelo.
- `status` toma uno de cuatro valores: `applied`, `outside_mass`, `compression_ignored` o `no_capacity`.

### E14m-5, aceptación (completa F4.13)

- **Siete filas de F4.13, con la geometría exacta de X17 §4.4.**
  - El pilote va de (40; 33) a (40; 22), con `force` 60, `spacing` 1,5 y `angle` 0.
  - La tablestaca va de (40; 33) a (40; 22), con `force` 120 y `angle` 0.
  - Se agrega Janbu simplificado.
- **16 filas inclinadas y 9 filas de capacidad de X17 §4.3 a §4.5,** con sus JSON exactos y las cifras del oráculo.
  - La tolerancia es **0,1 %**.
  - En `X17-cap-interface` y `X17-cap-interface-cov.5-sp2` es **0,25 %**, porque gobierna la discretización del
    oráculo; queda documentado en el test.
- **Spencer y M-P:** las cifras de M-P `constant` son del oráculo.
- **Slide2:**
  - VP 47, con la geometría leída de la figura, da 0,902 en el oráculo frente a 0,890 publicado (+1,3 %). Entra como
    caso con la tolerancia de su fuente (2,5 %), con la nota de geometría digitalizada, y no como check de 1 %.
  - VP 58 queda pendiente hasta tener sus coordenadas.

### E14m-6, escala E13l-3 con refuerzos

- Las fuerzas de los refuerzos entran en `t_i` y `H_i` de la escala motriz: las activas con su valor y las pasivas con
  su valor disponible, sin dividir por F.
- R1-M mide en las filas de aceptación que la escala no cambie ningún FS más de 1e-9 respecto de usar solo ΣW, y lo
  reporta.

## F4.17 Enmiendas de la integración R2 (E14n, decisiones del coordinador)

### E14n-1, clasificación E7d en las dovelas finas de un cruce

- **Hallazgo:** con la promoción, V014 (×2), V035b (×2) y V083 dan `negative_effective_normal_major`.
  - En V035b con Bishop, la dovela fina del cruce mide 2,6e-5 m y pesa 0,0012 kN. Recibe la fuerza pasiva completa:
    `passive_h` = −131,3 kN y `passive_driving_extra` = −77,7.
  - Su N′ concentra esa fuerza puntual sobre una base de 4e-5 m.
  - Es un artefacto de la discretización de F4.4.2. Los nodos `x_c ± 1e-6·ancho` existen para anular el brazo, no
    para representar la base que resiste la fuerza.
  - cSlope aplica la fuerza en la dovela normal que contiene el cruce.
- **Regla:**
  - Para **clasificar** la N′ negativa (E7d, E8c y E11f), las dovelas finas de un cruce de refuerzo se **suman** con
    las dos dovelas vecinas que comparten la dovela original antes de agregar los nodos del cruce. La N′ de esa
    dovela original es la suma de sus N′.
  - **Solo cambia la clasificación:** el equilibrio, el FS y las dovelas del informe quedan iguales.
  - Los nodos de las cargas lineales (E12f) no se agregan; así la salida sin refuerzos queda byte a byte.
- **Criterios de aceptación**, que el integrador mide antes de dejar el cambio:
  1. identidad byte a byte de todos los modelos sin refuerzos;
  2. en los 5 checks, el aviso mayor viene **solo** de dovelas finas de cruce, lo que se demuestra con la lista de
     dovelas con N′ < 0 antes y después;
  3. un test en el que un refuerzo produce una tracción real sobre una dovela de ancho normal conserva el aviso mayor:
     por ejemplo, un ancla activa grande hacia afuera sobre una base de varios metros;
  4. ningún FS cambia.
- Si algún criterio falla, los 5 checks quedan retenidos con su número y se reporta.

### E14n-1b, resultado medido y decisión

I1b midió el criterio 2 en cada check por separado:
- **V014, Janbu corregido (×2):** el aviso mayor venía **solo** de 8 dovelas finas de cruce de 7,6e-5 m. Con E14n-1
  quedan 0 dovelas con N′ < 0 y no hay aviso. **Es el artefacto.**
- **V035b, Bishop (×2) y V083, Janbu corregido:** las N′ < 0 están en dovelas **normales**, de 0,133 m y 0,126 m, y son
  las mismas con E14n-1 y sin él. **El modelo sin refuerzos también da el aviso mayor.** Es una tracción real del
  modelo, no un artefacto.

**Decisión:** E14n-1 **se adopta**, porque el mecanismo es correcto donde existe el artefacto.
- Cumple los criterios 1, 3 y 4: identidad byte a byte sin refuerzos, conserva el aviso con una tracción real sobre
  bases normales, y ningún FS cambia.
- El criterio 2 se evalúa por check. V014 vuelve a `verification/cases`.
- V035b y V083 quedan **retenidos** por `negative_effective_normal_major`, igual que V027, V028 y V068, con la causa
  «tracción real del modelo, presente también sin refuerzos».
- Efecto adicional medido: en V010 con M-P y en V014 con Spencer desaparece la nota `negative_effective_normal`, que
  venía de dovelas finas de cruce. El FS es idéntico.

## F4.18 Enmiendas por R11 (E14o, decisiones del coordinador)

**Fuentes:**
- `docs/reviews/R11_agy_A.md`, lente A, con veredicto APTO CON CORRECCIONES;
- `docs/reviews/R11_agy_B.md`, lente B, con veredicto NO APTO.

Cada punto lleva su test RED con el contraejemplo del revisor y su efecto medido. **Sin refuerzos, todo queda
idéntico byte a byte**, salvo la corrección de V065, que es la única excepción y se documenta en E14o-11.

**Motor:**
- **E14o-1, tangencia (R11A-01).**
  - En un círculo, un cruce solo cuenta si el elemento **penetra**: la semicuerda de su recta dentro del círculo debe
    ser mayor que `tol`.
  - Si el elemento entra y sale a menos de `tol` de distancia a lo largo del arco, los dos cruces se descartan, porque
    es una tangencia.
  - La normal n y el movimiento m se calculan **en el punto exacto del cruce**, con la normal radial del círculo o la
    dirección del tramo de la polilínea, y no con el `alpha` de la dovela fina.
  - En una polilínea, un elemento que toca un vértice sin atravesar la superficie no cuenta.
  - **Criterio:** los contraejemplos de R11A-01 (eps_r 0, ±1e-12 y −1e-6) dan, de forma continua, el FS sin refuerzo
    o el de un cruce real, sin duplicados ni fuerzas fantasma.
- **E14o-2, Bishop con pasivas (R11A-02).**
  - El arranque incluye las pasivas.
  - Antes de bisecar, se acota el cambio de signo de `h(F) = F·D(F) − N(F)` con una malla geométrica en
    `[F_adm o 1e-3, FOS_MAX]`.
  - **Criterio:** el contraejemplo converge dentro de 0,5 % de cSlope (3,526) y nada cambia sin pasivas.
- **E14o-3, E3 con pasivas (R11A-03).**
  - `no_driving` se evalúa **solo** antes de resolver, con el peso, el sismo, las cargas y las fuerzas **activas**.
  - Una fuerza pasiva es resistente y no entra en E3; **se elimina la comprobación posterior con pasivas**.
  - Así, Janbu deja de usar el momento de Bishop.
  - **Criterio:** los cuatro contraejemplos convergen dentro de 0,5 % de cSlope en Janbu simplificado, y nada cambia
    sin pasivas.
- **E14o-4, `interface` con `ru` (R11A-04).** σ′v sigue la precedencia del slicer:
  - un material con `ru` usa `u = ru·σ_suelo` y **sin** agua libre de la piezométrica;
  - un material sin `ru` usa la piezométrica, y el agua libre sobre el terreno cuenta.

  E14m-2 se corrige así. **Criterio:** el contraejemplo da 161,0 kN/m, como cSlope.
- **E14o-5, `interface` sobre un contacto (R11A-05).**
  - Si y está a menos de `tol` de un contacto horizontal, σ′v es el **mínimo** de los dos materiales.
  - En un contacto vertical, a menos de `tol` en x, se toma el mínimo de los dos lados. Es lo conservador, como
    E13l-5.
  - **Criterio:** el resultado es invariante al orden de `regions` y al espejo.
- **E14o-6, agrupación de E14n-1 (R11A-06).** Las dovelas finas de un cruce se agrupan con **todas** las piezas de la
  dovela original, entre los cortes que existían antes de agregar los nodos de los cruces, y no con un índice fijo.
  - **Criterio:** los dos contraejemplos de V014 ya no dan el aviso mayor, y la tracción real lo conserva.
- **E14o-7, búsqueda con refuerzos (R11A-07).**
  - Con refuerzos, se agregan a la búsqueda candidatos que pasan por las puntas y las cabezas de cada refuerzo, como
    los vértices del terreno de E9a.
  - Las semillas de refinamiento se diversifican por número de cruces aplicados.
  - **Criterio:** la brecha frente a la malla fina en los dos contraejemplos baja de 1 %, y nada cambia sin
    refuerzos. Si no se logra, se documenta con números y se recomienda la malla fina.
- **E14o-8, activo comprimido (R11A-08).**
  - Se **sigue aplicando**, porque es una carga externa conocida. Pero **es falso que sea siempre conservador**: con
    φ > 0, su componente normal confina la base y puede subir el FS.
  - Se corrige la justificación de E14m-1, y en `docs/limitaciones.md`.
  - Se agrega la nota informativa `reinforcement_active_compression`: «Un refuerzo activo se aplica con su fuerza
    aunque el deslizamiento lo comprimiría; en suelos con fricción esa fuerza puede aumentar el FS. Verifique la
    orientación y la carga de bloqueo.» Va a E6, a `warnings.ts` y a las listas informativas.
- **E14o-9, filas del oráculo (R11A-09).**
  - Las filas `inc_up30_pas` e `inc_up45_pas` se reemplazan por elementos **embebidos** que crucen la masa con
    `along ≥ cos 88°`.
  - Se verifica que su estado sea `compression_ignored`, que se emita la nota y que el FS sea el del oráculo.
  - Se agregan filas de `bond` y `interface` en las que la capacidad no esté acotada por `tensile_capacity`.
- **E14o-10, Janbu corregido con pasivas (R11A-10).** Se mantiene la división por F₀, coherente con el suelo y con
  cSlope. Se documenta que el punto de igualdad entre activo y pasivo es F₀ = 1, es decir, FS = f₀.
- **E14o-11 (R11A-11):**
  - No se agregan nodos para los cruces con capacidad disponible nula ni para los cruces sobre el terreno, que se
    pueden decidir antes de rebanar. Así el FS es **exactamente** el del talud sin refuerzo.
  - La corrección de V065 (`check_block_ends_circle`) es una **excepción documentada a F4.1**: un modelo sin refuerzos
    que la v0.2.0 rechazaba por redondeo ahora se analiza.
  - `to_cslope.py` valida los rangos.

**Web, CLI y documentación:**
- **E14o-12, unidades y espaciamiento (R11B-01 y R11B-07).**
  - Un `spacing` omitido vale 1 en la unidad de longitud del modelo: 1 m en SI y 1 ft en imperial.
  - Al convertir de unidades, la web escribe **siempre** un `spacing` explícito convertido, de modo que 1 m pasa a
    3,28084 ft.
  - Los valores por defecto del lienzo y del panel en imperial se convierten.
  - **Criterio:** el FS es invariante con `spacing` omitido, a 1e-9, con el motor real.
  - La documentación del formato dice que el espaciamiento por defecto depende de la unidad.
- **E14o-13, CSV de fuerzas (R11B-02).** Agrega las columnas:
  - `fs`, el FS del método;
  - `movilizada_fx` y `movilizada_fy`: en una pasiva, la aplicada dividida por F, y en una activa, la aplicada;
  - `nota`, con «pasiva: se moviliza dividida por F» en las pasivas y, en las filas de `pile` y `sheet_pile`, «solo
    estabilidad global: no calcula empuje, empotramiento, momento ni deflexión».
- **E14o-14, tabla web y leyenda (R11B-03).** La tabla de fuerzas del editor y de Casos lleva la misma aclaración del
  PDF sobre la fuerza disponible antes de dividir por F, y una columna «Movilizada».
- **E14o-15, `ogs bench` (R11B-04).** No baja la versión: usa la mayor entre la declarada y la que el método necesita.
- **E14o-16, interfaz (R11B-05, R11B-06, R11B-08, R11B-09 y R11B-10):**
  - los rótulos del lienzo y de Casos sin solapes;
  - el PDF, cuando ningún refuerzo cruza la superficie convergida, dice exactamente eso y lista los refuerzos sin
    cruce;
  - los valores por defecto de pilote y tablestaca siempre válidos, hacia abajo y dentro del suelo;
  - las unidades de `adhesion`, `end1_capacity` y `end2_capacity` en el PDF;
  - una tablestaca inclinada abierta desde un archivo muestra su `x2` y su error en el panel, sin forzar
    `x2 = x1`.
- **E14o-17, documentación (R11B-11):** las cifras actualizadas en `limitaciones.md` y en el README, y `test_v04.py` y
  el esquema 0.4 en `verificacion.md`. El coordinador sube la versión a 0.3.0 al publicar.

### F4.18b, forma final de E14o tras la implementación

- **E14o-1:** el umbral de penetración es la **sagita** `r − |perp|`, que debe superar `1e-6·ancho`, la misma escala
  que los nodos de cruce. Una semicuerda mayor que `tol = 1e-9·escala` no descarta las penetraciones de 1e-12 m.
  Límite documentado:
  - con una penetración real mayor que el umbral, un pasivo casi tangente puede saltar por la regla de compresión: un
    cruce se descarta y el otro se aplica;
  - cSlope no sirve de referencia a esa escala, porque cruza la recta con las cuerdas de las dovelas.
- **E14o-2 y E14o-3:** con pasivas que levantan, F tiene una **cota inferior física**,
  `lift_bound = −Σpassive_v / ΣW*`, por debajo de la cual las pasivas levantan la masa.
  - Bishop la suma a `F_adm`.
  - Janbu busca raíces solo por encima de ella, porque sin la comprobación E3 posterior aparecía una raíz espuria de
    0,127.
  - Sin pasivas vale cero, y todo queda bit a bit.
  - Bishop acota el cambio de signo con una malla geométrica de 600 pasos y elige el cruce más cercano al arranque.
- **E14o-5:** el contacto vertical se muestrea a ±4·tol en x. El mínimo es deliberado: en el contraejemplo horizontal,
  ogs da 1,0355 y cSlope 1,3293, que depende del orden de `regions`.
- **E14o-6:** la agrupación crece desde el cruce, sobre las piezas finas y los cruces vecinos, hasta la primera dovela
  de ancho normal. Una pieza es fina si su ancho es menor que `1e-2` del de la dovela más ancha.
  - La identificación exacta por dovela original, con un campo `origin` en `Slice`, queda como mejora futura.
- **E14o-7:** con refuerzos, la búsqueda agrega:
  - candidatos que pasan por puntos situados a `±1e-4·ancho` de cada cabeza y punta, sobre el eje del elemento, con ρ
    despejado y refinados sobre el borde;
  - 20 semillas de refinamiento en lugar de 10;
  - hasta 8 semillas extra, una por número de cruces.

  **Medido:**
  - la brecha frente a `60×60×40 + refine` baja de +7,15 % y +2,06 % a −0,44 % y −0,66 %;
  - en 40 modelos aleatorios, el peor caso pasa de +20,8 % a +1,55 %;
  - el tiempo crece entre ×1,15 y ×1,5;
  - sin refuerzos, todo queda bit a bit.

  Límite documentado: los valles estrechos con dos activos (+1,55 %) y los modelos mal condicionados, con FS ≈ 0,1.
