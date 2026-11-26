# Plan del bloque de refuerzos (F3R): tablestacas, pilotes, anclajes, clavos y geosintéticos

Plan del coordinador, basado en la exploración `docs/fase3/exploracion/X14.md` (oráculo y casos), `X15.md` (práctica y
referencias) y `X16.md` (motor, formato y web).
- **Empieza** cuando se publique la v0.2.0, es decir, al cerrar F3a y la revisión R10.
- **El contrato normativo** será `briefs/03_CONTRATOS_REFUERZOS.md` (enmiendas E14). Se congela al empezar, sobre la
  base de F3a ya integrada.

## 1. Alcance (formato v0.4)

| Tipo | Uso | Geometría | Parámetros mínimos |
|---|---|---|---|
| `anchor` | Tirante postensado o pasivo con bulbo; anclaje de una tablestaca anclada | segmento | capacidad a tracción, adherencia del bulbo por metro, espaciamiento, activo o pasivo, dirección |
| `nail` | Clavo de suelo con placa | segmento | tracción, capacidad de placa, adherencia por metro, espaciamiento, activo o pasivo |
| `geosynthetic` | Geomalla o geotextil; muro TEM y terraplén reforzado | segmento, casi siempre horizontal | resistencia de diseño (Tal, o Tult con factores de reducción), arrancamiento por coeficiente de interacción, cobertura, activo o pasivo |
| `pile` | Pilote o micropilote | segmento vertical u oblicuo | capacidad de corte por pilote, espaciamiento, dirección de la fuerza |
| `sheet_pile` | **Tablestaca**, en voladizo o anclada con un `anchor` | segmento vertical | capacidad de corte por metro de muro |

- **Física común**, la del oráculo cSlope y la práctica de Slide2 y Duncan y Wright:
  - Cada cruce de un refuerzo con la superficie de falla aporta una fuerza puntual en la base de la dovela que cruza.
  - La fuerza disponible es `min(T, T₁ + arrancamiento(s), T₂ + arrancamiento(L − s))` dividido por el espaciamiento.
- **Activo:** la fuerza se conoce, por ejemplo el bloqueo de un tirante postensado. Se suma a las fuerzas y no se
  divide por F.
- **Pasivo:** la fuerza se moviliza con el deslizamiento y entra dividida por F, con la convención del oráculo, que el
  contrato fijará con fórmulas por método.
- **Un elemento pasivo trabaja solo a tracción.** Si el movimiento lo comprimiría, es decir, si queda más de 2° pasado
  la normal a la base, no aporta. Lo respaldan Clouterre (1991, §3.2.2.3) y FHWA GEC 7 (§6.3.3c).
  - Esto explica la «anomalía» de X14: los clavos con más de ~34° de inclinación en V047a no reciben fuerza. Es el
    comportamiento correcto, no un error del oráculo.
- **Tablestaca:**
  - En equilibrio límite es una fila continua de pilotes. El indicador `wall: true` de cSlope no cambia el FS (X14).
    Una tablestaca anclada se modela como tablestaca más un `anchor`.
  - **El informe y la Ayuda dirán siempre lo que el equilibrio límite no cubre:** el empuje sobre la tablestaca, el
    empotramiento necesario, el momento flector y la deflexión. Para eso hace falta un cálculo de muro, de vigas sobre
    resortes o MEF.
  - OpenGeoSlide revisa la **estabilidad global** con la tablestaca incluida.
- **Bishop** se ofrece con refuerzos solo en superficies circulares, igual que hoy.

**Se posponen**, según X15 §5.3:
- clavos lanzados y anclajes helicoidales;
- presión de fluido equivalente;
- arrancamiento que depende del material;
- cizalla y compresión de los clavos;
- el soporte definido por el usuario.

## 2. Verificación

- **Casos publicados del corpus de cSlope.** Hay 35 casos, y **30 son importables** con F3a, porque ya hay
  polilíneas y Janbu. Se agrupan en cuatro lotes:

| Lote | Casos |
|---|---|
| R1, anclajes | V016b, V035a, V035b, V037 |
| R2, clavos | V011a, V011b, V012, V064, V065, V066a, V066b, V066c, V066e |
| R3, geosintéticos | V010, V010b, V014, V083, V084a a V084f |
| R4, pilotes | V013b a V013e (Ito y Matsui), V015 y V095c |

  Los otros 5 siguen bloqueados por grieta de tracción, agua o contorno: V017b, V066d, V074, V076 y V086a.
- **Manual de verificación de Slide2.** Hay 14 problemas con datos completos que no usan grieta de tracción:
  - anclajes: VP 58, 59, 85 y 86;
  - clavos: VP 47, 48 y 50;
  - geosintéticos: VP 31, 32, 87, 88 y 94;
  - pilotes: VP 54 y 106.

  Se transcriben como casos nuevos, citando la tabla del manual.
- **Tablestacas:** no hay ningún caso publicado con FS (X15 §2.5). Se verifican contra el oráculo, con un pilote
  `wall: true`, y con identidades:
  - con capacidad 0, el FS es el del talud sin tablestaca;
  - una tablestaca que la superficie no cruza no cambia nada;
  - el FS crece de forma monótona con la capacidad.
- **Batería diferencial:** cada tipo sobre modelos de la batería, con Bishop, M-P y Janbu, a 0,5 % del oráculo.
- **Identidad:** sin refuerzos, todos los modelos actuales dan el mismo resultado, bit a bit.

## 3. Olas de trabajo

| Ola | Quién | Contenido |
|---|---|---|
| **R0**, congelar | 1 escritor | Tipos v0.4 en el motor y la web; `Slice` con términos pasivos, a cero sin refuerzos; informe con fuerzas por refuerzo; test RED con los prototipos del oráculo de X14 §2.2 |
| **R1**, paralelo | 5 escritores | **Motor:** cruces y fuerzas; términos pasivos en los cuatro métodos; validación, esquema 0.4 e importador. **Web:** formato y panel «Refuerzos»; lienzo (dibujar y editar segmentos y verticales con puntero, teclado y táctil), Casos e informe con la tabla de fuerzas y la advertencia de tablestaca |
| **R2**, integración | 2 integradores | Lotes R1 a R4 y problemas de Slide2; recorridos de extremo a extremo (tablestaca anclada, muro TEM, talud con clavos); regresión completa y axe |
| **R3**, cierre | Antigravity, luego el coordinador | Revisión adversarial **R11**, correcciones y publicación de la **v0.3.0** |

## 4. Decisiones que tomará el contrato (coordinador)
1. **Dovela que recibe la fuerza** cuando el cruce cae en una frontera entre dovelas: se agrega un nodo en el cruce, el
   mismo recurso que en las cargas lineales, para que la frontera no ocurra.
2. **Convención de la pasiva:** la del oráculo, con su fórmula explícita por método. Se contrasta también con los VP de
   Slide2.
3. **Tolerancia de 2° pasada la normal** para el elemento pasivo comprimido, con una nota en el informe cuando se
   descarta un elemento.
4. **Pretensado:** se modela como `anchor` activo, con la fuerza de bloqueo como capacidad. No hay un campo
   `prestress` aparte, igual que en Slide2.
5. **Aviso `reinforcement_outside_mass`** cuando un refuerzo no cruza la masa deslizante. Es informativo, como
   `load_outside_mass`.

## 5. Recomendación para después del bloque
La **grieta de tracción** y el **agua embalsada** desbloquean otros 31 casos publicados (X10) y 3 VP de Slide2 con
refuerzos: 30, 39 y 60. Además, son habituales en muros y en rajos. Conviene hacerlas justo después de los refuerzos,
antes que F3b, o junto con ella.
