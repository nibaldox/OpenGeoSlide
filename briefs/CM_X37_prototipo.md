# Brief CM-X37: prototipo de la búsqueda global no circular

## Contexto

- **Proyecto:** OpenGeoSlide v0.5.1. **Plan:** `docs/cm/PLAN_CM.md`, decisión D3. **Exploración que lo motiva:**
  - `docs/cm/exploracion/X31.md`: algoritmos, oráculos, el pulido de cSlope y la recomendación de §6;
  - `X32.md`: casos y brechas;
  - `X33.md`: el gancho del motor;
  - `docs/fase3/exploracion/X29.md`: el prototipo del refinamiento.

  Léelos primero.
- **Qué falta medir.** La búsqueda no circular de hoy refina, por variación alterna (`crates/ogs-core/src/noncircular.rs`),
  tres semillas que salen de la búsqueda circular. **No alcanza los mecanismos de bloque:**

  | Modelo | ogs no circular | cSlope | Diferencia |
  |---|---:|---:|---:|
  | V053 | 1,0847 | 1,0061 | +7,4 % (publicado 1,01) |
  | S1 sintético | 1,1220 | 1,0917 | +2,8 % |
  | S2 sintético | 0,8476 | 0,7156 | +18,4 % |

  Sobre la polilínea de cSlope, ogs da el mismo FS que cSlope: la brecha es de alcance de la búsqueda, no del cálculo
  (`X32.md` §3 y §5).
- **Pregunta:** qué generador global, puesto delante del refinamiento y seguido del pulido, cierra esa brecha **sin
  empeorar** los casos que hoy pasan, con qué presupuesto y con qué determinismo.

## Reglas

- **Solo lectura del repo.** Escribes `docs/cm/exploracion/X37.md` y los guiones en `docs/cm/exploracion/X37_proto/`,
  dentro del worktree `/home/xodla/archivos/opengeoslide-wt/cm-int` (rama `cm-integracion`). Escribe X37.md
  **temprano**, con el esqueleto, y refínalo después.
- **No commitees**, no cambies de rama y no toques ningún otro archivo.
- Dentro de los archivos escribe las rutas como `~/…` o relativas al repo, nunca la ruta absoluta del home.
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. Todo lo pesado va en `$TMPDIR/cm-x37/`.
  Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Evaluador:** el wheel `opengeoslide` 0.5.1 del GitHub Release, en un venv propio:

  ```bash
  uv venv -p 3.13 $TMPDIR/cm-x37/venv
  uv pip install --python $TMPDIR/cm-x37/venv/bin/python \
    https://github.com/nibaldox/OpenGeoSlide/releases/download/v0.5.1/opengeoslide-0.5.1-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl
  ```

  Evalúa cada polilínea como superficie fija con `opengeoslide.analyze(json)`: `analysis.surface` de tipo `polyline` y
  x estrictamente creciente. Así lo hizo X29 (`docs/fase3/exploracion/X29_proto/nc.py`). Cuenta cada llamada como una
  evaluación del motor.
- **El refinamiento de ogs** ya está en Python en `X29_proto/nc.py`: variación alterna 9 → 17 → 33, Δ₀ = 0,1 × el
  segmento más corto, 6 rondas y 1500 evaluaciones por semilla. Reutilízalo y comprueba antes que da el mismo FS que
  el motor en V001-nc (1,383876) y en V034a-nc.
- **Oráculo:** `$TMPDIR/oracle-venv/bin/python` con `import cslope` (0.1.0); el conversor es
  `verification/harness/to_cslope.py`. cSlope tiene `searchMethod: "block"` con objetos de bloque (`X31.md` §2.1).
- **Admisibilidad de toda polilínea generada:** la de `surface.rs:262-295`, es decir `search_polyline_admissible`:
  - `dx ≥ 1e-6·ancho`;
  - concavidad `α_{i+1} ≤ α_i + 1°`;
  - segmentos y vértices bajo el terreno;
  - extremos dentro de las ventanas con margen.

  Escríbela en Python leyendo el Rust: no la inventes.
- **Código ajeno:** OGR Slip2D es AGPL. Lee su documentación, pero no su código, y no lo copies. El código de cSlope
  (MIT) se lee y se cita, pero no se copia.
- **Marcas:** cada afirmación va con `[verificado]` (comando y salida, o `archivo:línea`) o `[inferido]`. Nada de
  cifras inventadas.
- **Presupuesto:** unas 100 iteraciones. Prioriza las tablas; deja la prosa para el final.

## Qué hacer

1. **Generadores.** Implementa tres en `X37_proto/global.py`. Todos usan un PRNG de semilla fija escrito por ti, por
   ejemplo SplitMix64; generan en serie y desempatan por (FS, índice de generación).
   - **G1, *path*:** muestreo de polilíneas por segmentos desde una salida aleatoria en la ventana de salida, al estilo
     de Path Search de Slide2 y OGR (`X31.md` §1 y §2), hasta cortar el terreno dentro de la ventana de entrada.
   - **G2, bloque automático:** sin objetos del usuario. Detecta en el modelo las capas o los contactos débiles:
     - las aristas de las regiones cuyo material tiene la menor resistencia relativa a la profundidad;
     - o, más simple, las bases horizontales o inclinadas de las regiones.

     Genera bloques: dos o tres segmentos sobre la capa, con las proyecciones a la superficie entre 45° y 135° como en
     Block Search (`X31.md` §1). Escribe en X37.md la regla exacta que usaste para elegir las capas.
   - **G3, recocido:** recocido simulado sobre las profundidades de los vértices de una polilínea de 9 vértices que
     parte del mejor círculo. Usa el esquema más simple que funcione (enfriamiento geométrico) y documenta sus
     parámetros.
2. **Tubería.** Para cada generador:
   1. genera hasta N candidatos admisibles, con N en {500, 2000, 5000};
   2. toma las 3 mejores con pares (entrada, salida) distintos, con el criterio del 5 % de `search.rs:349-356`;
   3. refínalas con `nc.py`;
   4. pule la mejor con la regla de cSlope (`X31.md` §4): 4 ciclos y presupuesto doble;
   5. compara con el círculo y con el refinamiento actual: **gana el menor FS**. La tubería completa también recibe las
      semillas circulares de hoy, así que nunca puede quedar por encima del refinamiento local actual.

   Mide además **la tubería actual con pulido y sin generador**, para separar lo que aporta cada parte.
3. **Casos:**
   - **brecha:** V053 (`$TMPDIR/cm-x32/pending/V053.json`), S1 y S2 (`$TMPDIR/cm-x32/synthetic/`);
   - **no regresión:**
     - los 9 checks de `$TMPDIR/cm-x32/pending/`, más V002-nc (`verification/pending/F3B/V002-nc.json`);
     - los 5 casos `-nc` promovidos (`verification/cases/V001-nc.json`, `V026-nc`, `V033-nc`, `V034a-nc` y `V034b-nc`);
   - **barrido:** 24 taludes homogéneos con H ∈ {10, 30} m, β ∈ {30°, 45°, 60°}, φ ∈ {20°, 35°} y c ∈ {5, 30} kPa, con
     γ = 19 y sin agua. Mide el FS circular, el del refinamiento actual y el de cada tubería, y anota `evaluated > 0`.

   Usa Spencer en todos, salvo que el check diga otro método (Bishop no se usa en polilíneas).
4. **Tablas que entrega X37.md:**
   - por caso y por generador y N: el FS, el error frente al publicado con el criterio de un lado de D3, la razón frente
     a cSlope, las evaluaciones y el tiempo;
   - monotonía frente al refinamiento actual, caso por caso;
   - determinismo: dos corridas iguales, byte a byte, en la salida de los FS y de las superficies;
   - los avisos del motor en la superficie ganadora, en especial `negative_lambda` y `negative_effective_normal_major`
     (la rama de tracción de E12e, `X32.md` §3.3). Si una tubería gana con una superficie que tiene esos avisos y cSlope
     la evalúa más de 2 % arriba, márcala;
   - **el aporte del pulido, solo:** el FS y el costo con pulido y sin generador.
5. **Recomendación:**
   - qué generador o combinación conviene, con qué N por defecto y con qué presupuesto total;
   - si el pulido va siempre o solo con el generador;
   - el costo frente a la búsqueda circular, en evaluaciones y en tiempo. La compuerta propuesta es ≤ 4 veces el
     circular nativo; dila con cifras;
   - qué casos quedan abiertos y por qué;
   - qué campos necesita el formato v0.7, contrastados con la alternativa A de `X33.md` §2.3;
   - qué checks publicados sirven de compuerta.
6. **Cierre:** tu respuesta final resume los hallazgos clave en 15 líneas o menos e incluye la ruta del archivo.
