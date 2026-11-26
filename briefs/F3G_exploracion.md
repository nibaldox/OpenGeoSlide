# Brief F3G-X: exploración del bloque «grieta de tracción y agua embalsada»

Responde en **español neutro, sin voseo**.

## Contexto

- **Proyecto.** OpenGeoSlide v0.3.0, publicado el 2026-11-26. Formato v0.4 con refuerzos; motor Rust `crates/ogs-core`;
  web en `apps/web`.
- **Qué falta.** El motor no modela la **grieta de tracción** ni el **agua embalsada** (agua libre sobre el terreno).
  `docs/limitaciones.md` lo declara.
- **Casos esperando** en `verification/pending/F3/INDEX.md`:
  - unos 20 con «opción de check que cambia el problema: tensionCrackDepth/tensionCrackAuto»;
  - unos 15 con «piezométrica sobre el terreno (agua embalsada)».

  Además están V017b, V066d, V074, V076 y V086a, casos con refuerzos bloqueados por grieta, agua o contorno según
  `docs/fase3/PLAN_REFUERZOS.md` §2, e Ito-Matsui (V013b a V013e), que se pospuso para este bloque.
- **Modelo a seguir.** El bloque de refuerzos se exploró así, y esos archivos sirven de ejemplo de formato y
  profundidad: `docs/fase3/exploracion/X14.md` (oráculo y casos), `X15.md` (práctica y referencias), `X16.md` (motor,
  formato y web) y `X17.md` (prototipo).

## Reglas comunes

- **Solo lectura del repo.** Escribes **un único archivo de hallazgos**, `docs/fase3/exploracion/X<n>.md`, en
  `/home/xodla/archivos/opengeoslide`, que está en la rama `f3g-integracion`. Escríbelo **temprano** y refínalo después.
- **No commitees** y no toques otro archivo del repo.
- **Instrumentación:**
  - va en `$TMPDIR/f3g-x<n>/`; un worktree detached, si te hace falta, va ahí y se borra al final;
  - `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`;
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
- **Cada afirmación lleva su marca:**
  - `[verificado]`, con el comando y su salida, o con la URL y la cita;
  - `[inferido]`, cuando no lo comprobaste.

  **Nada de cifras inventadas.**
- **Herramientas:**
  - Oráculo: `$TMPDIR/oracle-venv/bin/python` con `import cslope` (cslope 0.1.0, binario `a80f9a0`).
  - Clon del código de cSlope: `$TMPDIR/cslope-src` (`0f07e7a`, MIT). Se lee y se cita; **no se copia** código.
  - Binario del motor: `target/release/ogs` del repo (`cargo build --release -p ogs-cli` si falta).
  - Importador: `verification/tools/import_cslope.py`.
  - Conversor: `verification/harness/to_cslope.py`.
- **Presupuesto:** unas 60 iteraciones. Prioriza las tablas de hallazgos sobre la prosa.

## X18: oráculo y casos

1. **Inventario de cada caso bloqueado.** Lista los casos de grieta, los de agua embalsada, los cinco de refuerzos de
   arriba e Ito-Matsui. Para cada uno da:
   - la fuente y el problema;
   - los métodos con su valor publicado y quién lo publica;
   - las opciones que usa: `tensionCrackDepth` con su valor, `tensionCrackAuto`, agua en la grieta, nivel de agua sobre
     el terreno;
   - qué **más** necesita que el motor no tenga, como búsqueda no circular, Hoek-Brown o contorno.
2. **Implementación de cSlope.**
   - **Binario instalado:** cómo se pasan la grieta y el agua al oráculo de Python (nombres de campos, unidades,
     valores por defecto).
   - **Código del clon:** cómo los implementa. Cita archivo y línea de `packages/engine-rs` y de `packages/desktop`
     (por ejemplo `utils/piezo.ts`, `rendering/pond-arrows.ts` y `utils/slip-mass.ts`). Responde:
     - dónde se corta la superficie;
     - si la cara de la grieta es vertical;
     - qué fuerza de agua pone en la grieta, en qué punto y en qué dirección;
     - cómo carga el agua embalsada las dovelas: peso, empuje y momento;
     - cómo resuelve la profundidad automática;
     - qué hace con sismo sobre el agua.
   - Diferencias entre el binario instalado y el código del clon, si las hay.
3. **El oráculo contra los publicados.** Corre el oráculo sobre cada caso bloqueado, con los datos del corpus. Tabla
   por check: publicado, cSlope, diferencia en %, y si entraría con la tolerancia de su fuente. Agrupa los checks que
   se desbloquearían y da **cuántos checks y casos** entrarían con cada capacidad:
   - solo grieta seca;
   - grieta con agua;
   - solo agua embalsada;
   - las dos.
4. **Manual de verificación de Slide2.** Los problemas (VP) con grieta de tracción o agua embalsada, con su
   geometría completa o no. Fuente: `docs/fase3/r1v/VP_SLIDE2.md`, `docs/fase3/exploracion/X14.md` y la web.

## X19: práctica y referencias

1. **Grieta de tracción:**
   - **profundidad:** la fórmula con su fuente, `z = 2c/(γ√Ka)`, y qué hacen con φ = 0 y con el material no drenado;
   - **dónde se ubica:** zona, línea o profundidad;
   - **la superficie:** si termina en la base de la grieta con una cara vertical;
   - **agua en la grieta:** `Pw = γw·z²/2` aplicada a z/3 sobre la base; si es horizontal; si se usa el llenado parcial;
     sobre qué dovela actúa;
   - **en la búsqueda:** si todos los candidatos se truncan.

   Fuentes: Spencer (1967, 1973), Duncan y Wright (2014), USACE EM 1110-2-1902, el manual de teoría de Slide2 y GeoStudio
   SLOPE/W. Cita las URL con la frase exacta.
2. **Agua embalsada:**
   - cómo la modelan Slide2 («ponded water»), SLOPE/W y Duncan y Wright: como carga distribuida normal al terreno o como
     material «agua» sin resistencia;
   - el peso de la columna de agua y el empuje horizontal sobre un terreno inclinado o vertical;
   - qué presión de poros queda en la base;
   - si el sismo actúa sobre el agua;
   - la interacción con `ru`;
   - la equivalencia entre los dos modelos.
3. **Riesgos y avisos** que la práctica recomienda mostrar al usuario: grieta sin agua contra grieta llena, profundidad
   excesiva, desembalse rápido (fuera de alcance) y otros.
4. **Ito-Matsui:** un resumen de una página con la fórmula, los supuestos y cómo lo implementa cSlope (archivo y línea).
   Agrega tu recomendación sobre si cabe en el bloque.

## X20: motor, formato y web

1. **Estado actual del motor.** Qué hace hoy `ogs analyze` con una piezométrica sobre el terreno: si suma la presión de
   poros con la carga completa, si falta el peso del agua y si emite un aviso. **Mídelo** con un modelo simple, como
   V047a con la piezométrica 2 m sobre el pie, y cita archivo y línea en `crates/ogs-core/src` (`slicer.rs`, `water*`,
   `loads.rs`, `methods/*`).
2. **Dónde entraría cada capacidad**, con archivo y función:
   - **grieta:** truncar la superficie, la dovela de la cara, la fuerza horizontal en los métodos (como las cargas de
     línea de E12, o como `H_i`), la admisibilidad, la búsqueda y las polilíneas;
   - **agua embalsada:** el peso de la columna, el empuje y el momento; como cargas de superficie automáticas o como
     término en cada dovela.

   Aclara qué partes ya existen y se reutilizarían: las cargas distribuidas de E12, el agua libre de `interface` en
   `reinforcement.rs` y las fuerzas horizontales.
3. **Formato v0.5.** Propón los campos, con dos o tres alternativas y sus pros y contras:
   - la grieta como `analysis.tension_crack`, con profundidad fija o automática y `water_fill`, o como línea o zona;
   - el agua embalsada automática desde la piezométrica o explícita.

   Incluye la regla de versión mínima (F3.9), la identidad byte a byte sin los campos nuevos y la interacción con
   refuerzos, sismo y `ru`.
4. **Web:**
   - **editor:** dónde se fija la grieta; si se dibuja; cómo se ve el agua embalsada en el lienzo, por ejemplo como un
     relleno azul;
   - **informe PDF, CSV, Diagnósticos y Ayuda.**

   Lista los archivos de `apps/web/src` que tocaría cada parte.
5. Propuesta de **olas y escritores con dueños de archivo disjuntos**, en el estilo de `docs/fase3/PLAN_REFUERZOS.md`.
