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
  - Con `along > 0` la fuerza tiene una componente a favor del deslizamiento, así que aplicarla es lo conservador.
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
