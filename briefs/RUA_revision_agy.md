# RUA · Revisión adversarial del rediseño «A · Flujo de trabajo» (lente {L})

Eres un revisor adversarial independiente. Revisa **solo en lectura** la web de OpenGeoSlide en el clon congelado
`{CLON}` (commit `{SHA}`, rama `ua-integracion`). Responde en español neutro.

## Qué se cambió

El bloque UA reemplazó el armazón de la web (`apps/web`) por el armazón A de la familia de apps del usuario:
- cabecera con marca y chip de estado;
- barra lateral «Modelo», con los 10 pasos como pestañas verticales y el panel abierto debajo del paso activo;
- pie de acción con «Comprobar»;
- cuatro vistas: Lienzo, Resultados, Casos de verificación e Informe;
- tarjeta del lienzo con el HUD del FS mínimo, la paleta flotante y la leyenda;
- barra de estado al pie;
- tokens v1.1 de la suite, tema oscuro por defecto y fuentes Outfit y JetBrains Mono locales.

El motor, el formato y el PDF no cambian.

Documentos normativos en el clon:
- `briefs/UA_CONTRATO.md`, con las enmiendas UA-E1 y UA-E2 al final;
- `briefs/UA1_tareas.md` y `briefs/UA2_tareas.md`;
- la exploración `docs/suite-a/exploracion/XA1-XA4.md`, con el inventario del armazón anterior y los selectores que
  no se podían romper.

La especificación de la familia está en `~/archivos/geo-suite-design/docs/DISENO_B.md`, y la maqueta en
`~/archivos/geo-suite-design/src/flujo.html` con su captura `capturas/03-ogs-A-flujo-oscuro.png`.

Para ver los cambios: `git -C {CLON} diff 69d0413..{SHA} -- apps/web` (`69d0413` es v0.5.0).

Verificación declarada por el equipo, que debes atacar, no aceptar:
- **Puertas:** typecheck y build en verde; vitest con 252 test files y 4179 tests pasados, más 320 saltados.
- **Aceptación** `docs/suite-a/e2e/aceptacion_ua.mjs`: 17/17. Cubre que no haya scroll a 1440 × 900 y a 1280 × 800,
  que no haya scroll horizontal de 320 a 1440, las fuentes, el color del acento, el tema por defecto, la marca, los
  pasos, las vistas, `fs-min`, un solo «Comprobar», la ausencia de dingbats, axe en los dos temas, los objetivos de
  clic, los nombres de los botones, la paleta y la leyenda libres tras «Encuadrar», y el pie fijo en móvil.

## Entorno

- La app ya está construida en `{CLON}/apps/web/dist`. Sírvela con
  `python3 -m http.server {PUERTO} --bind 127.0.0.1 -d {CLON}/apps/web/dist` y mata el servidor por PID al terminar.
- `playwright-core` y `axe-core` están en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/ua1/Q/node_modules`.
  Chrome está en `/usr/bin/google-chrome-stable` y se lanza con `--no-sandbox`.
- Antes de cargar la app, marca la guía de primera visita como vista con
  `localStorage.setItem('ogs.onboarding.v1','seen')` y espera a que `[data-testid="engine-banner"]` diga «ogs-core».
- Los ejemplos se abren desde el menú «Archivo» con el selector «Ejemplos».
- Tus scripts y registros van solo en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/rua-{L}/`.
- **No modifiques ningún archivo del clon.** Antes de terminar, comprueba que `git -C {CLON} status --porcelain`
  sigue vacío; `dist/` y `node_modules/` están ignorados.

## Tu lente

{LENTE}

## Formato obligatorio del informe

1. Primera línea: `VEREDICTO: APTO`, `APTO CON CORRECCIONES` o `NO APTO`.
2. Una tabla de hallazgos: `ID | severidad (CRÍTICA/ALTA/MEDIA/BAJA) | archivo:línea | problema | por qué afecta | corrección propuesta | esfuerzo S/M/L`. Usa los ids `RUA-{L}-01`, `RUA-{L}-02`… En cada CRÍTICA o ALTA va la evidencia ejecutada: el script, el viewport y la salida o la captura. Lo que no reprodujiste va marcado «sospecha».
3. El top 10, por prioridad.
4. La cobertura: qué comprobaste en vivo, qué solo en el código y qué no revisaste.

Guarda el informe completo también en
`/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/rua-{L}/RUA_{L}.md`.

## Ejecución sin aprobación

No hay un plan previo que aprobar. Arma tu plan y **ejecútalo completo de una vez, sin pedir aprobación ni hacer
preguntas**: nadie va a responder. Si el tiempo no alcanza, prioriza los hallazgos de severidad alta con evidencia
ejecutada y termina **siempre** con el informe en el formato obligatorio.
