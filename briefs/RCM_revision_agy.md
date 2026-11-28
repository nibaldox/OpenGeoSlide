# RCM · Revisión adversarial del bloque CM, «Cierre del MVP» (lente {L})

Eres un revisor adversarial independiente. Revisa **solo en lectura** OpenGeoSlide en el clon congelado `{CLON}`
(commit `{SHA}`, rama `cm-integracion`). Responde en español neutro.

## Qué se cambió (desde v0.5.1, `1d1d097`)

1. **Motor (`crates/ogs-core`): búsqueda global no circular, formato v0.7** (`analysis.search.non_circular.global`):
   - el algoritmo `auto`, `block` o `annealing`, con los campos `generated`, `seed` y `polish`;
   - el bloque genera candidatos sobre capas de contacto con Halton rotado y proyecciones a 15°-75°;
   - el recocido parte del mejor círculo;
   - después vienen el descarte sucesivo 4 → 3 → 1, el refinamiento de 1500 evaluaciones y el pulido;
   - una **guarda de tracción** rechaza las superficies con `negative_lambda` o `negative_effective_normal_major`;
   - la salida es `search.non_circular.global` (11 campos), con las notas `non_circular_global_no_candidates` y
     `non_circular_global_tension_rejected`;
   - **identidad:** sin `global`, la salida es la de la v0.5.1 byte a byte.
2. **Web (`apps/web`):**
   - la versión 0.7, el panel «Búsqueda global» y las salidas en la tabla, el CSV, el PDF, el chip y la Ayuda;
   - los cuatro defectos de borradores (`docEpoch` en `useDraft`, un borrador por eje, tablas de puntos con una fila
     pendiente, Ctrl+Intro con el foco en un campo);
   - el selector de ejemplos con destacados y filtro, y el rótulo del documento;
   - pantallas de 360 px o menos;
   - el reencuadre del HUD tras una edición;
   - la primera visita: importar sobre el modelo de arranque crea un modelo nuevo, la guía parte del ejemplo abierto, el
     aviso de bloqueo nombra el primer error, hay un DXF y un CSV de ejemplo, y el HUD y el chip nombran el método que
     rige.
3. **Verificación:** xslope 1.1.0 como columna informativa (`verification/xslope/`) y `verification/global/` (la
   medición de las compuertas A1 a A10).

**Documentos normativos en el clon:**
- `briefs/06_CONTRATOS_CM.md`, de F7.0 a F7.7 más las enmiendas E17a a E17d, **que mandan sobre el texto original**;
- `briefs/CM_C1_motor.md`, `briefs/CM_C1_web.md`, `briefs/CM_W1_tareas.md` y `briefs/CM_W2_tareas.md`;
- `docs/cm/PLAN_CM.md`;
- la exploración `docs/cm/exploracion/X31.md` a `X37.md`.

**Para ver los cambios:** `git -C {CLON} diff 1d1d097..{SHA} -- <ruta>`.

**Verificación declarada por el equipo, que debes atacar, no aceptar:**
- `verification/global/REPORT.md` dice A1 a A10 y A2b en verde. V053 baja de 1,0847 a 1,0103 (publicado 1,01 ± 3,5 %;
  cSlope evalúa la ganadora en 1,0101). La robustez es de 48 de 48 semillas. La guarda no deja ganadores con tracción.
  El costo máximo es 3,81 veces el circular. La salida es la misma con y sin `parallel`.
- Puertas: `cargo test` con y sin `parallel`, la aceptación con 347 checks, vitest con unos 4800 tests, y la regresión
  e2e de Chrome con 51 guiones, OK=1302 y FAIL=0.

## Entorno

- **El binario v0.7** está en `{BIN}`, y el binario de la v0.5.1 en `{BASE}`.
  - Para compilar o correr tests, usa `CARGO_TARGET_DIR={SCRATCH}/target`. Nunca compiles dentro del clon.
  - Python siempre con `env -u PYTHONPATH -u PYTHONHOME`.
  - El oráculo cSlope es `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/oracle-venv/bin/python`
    (`import cslope`, 0.1.0), y el conversor `verification/harness/to_cslope.py`.
- **La web** ya está construida en `{CLON}/apps/web/dist`, con el WASM v0.7.
  - Sírvela con `python3 -m http.server {PUERTO} --bind 127.0.0.1 -d {CLON}/apps/web/dist` y mata el servidor por PID al
    terminar.
  - `playwright-core` y `axe-core` están en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/ua1/Q/node_modules`;
    Chrome, en `/usr/bin/google-chrome-stable` con `--no-sandbox`.
  - Antes de cargar la app, marca la guía como vista con `localStorage.setItem('ogs.onboarding.v1','seen')`, salvo que
    revises la primera visita. Luego espera a que `[data-testid="engine-banner"]` diga «ogs-core».
- Tus scripts y registros van solo en `{SCRATCH}/`.
- **No modifiques ningún archivo del clon.** Antes de terminar, comprueba que `git -C {CLON} status --porcelain` sigue
  vacío.

## Tu lente

{LENTE}

## Formato obligatorio del informe

1. **Primera línea:** `VEREDICTO: APTO`, `APTO CON CORRECCIONES` o `NO APTO`.
2. **Una tabla de hallazgos** con las columnas `ID | severidad (CRÍTICA/ALTA/MEDIA/BAJA) | archivo:línea | problema |
   por qué afecta | corrección propuesta | esfuerzo S/M/L`.
   - Usa los ids `RCM-{L}-01`, `RCM-{L}-02`…
   - Cada CRÍTICA o ALTA lleva su evidencia ejecutada: el modelo o el script, el comando y la salida.
   - Lo que solo leíste en el código, sin ejecutarlo, va como MEDIA como máximo y marcado «[sin ejecutar]».
3. **Notas de contrato:** dónde el código y el contrato no coinciden, y cuál de los dos te parece que está mal.
4. **El top 10**, por prioridad.
5. **La cobertura:** qué comprobaste en vivo, qué solo en el código y qué no revisaste.

Guarda el informe completo también en `{SCRATCH}/RCM_{L}.md`.

## Ejecución sin aprobación

No hay un plan previo que aprobar. Arma tu plan y **ejecútalo completo de una vez, sin pedir aprobación ni hacer
preguntas**: nadie va a responder. Si el tiempo no alcanza, prioriza los hallazgos de severidad alta con evidencia
ejecutada y termina **siempre** con el informe en el formato obligatorio.
