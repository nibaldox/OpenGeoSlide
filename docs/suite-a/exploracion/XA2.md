# XA2 · Línea base de la web actual en Chrome headless

Estado: **completo** (mediciones de la rama `ua-integracion`, commit 807cf30, base v0.5.0).
Alcance: la web actual tal cual, sin cambios en archivos versionados. Solo se escribe este archivo.

## Entorno y método

- [verificado] Worktree `~/archivos/opengeoslide-wt/ua-int`, rama `ua-integracion`, commit `807cf30`.
- [verificado] `bash apps/web/scripts/build-wasm.sh` y `pnpm install --frozen-lockfile && pnpm build` (en `apps/web`): build correcto, precarga del service worker de 14 archivos, versión `ee4687550922`. El `.wasm` servido declara `ogs-core`.
- [verificado] Copia de `apps/web/dist` en `~/.hermes/profiles/open-geoslide/cache/scratch/ua/XA2/dist`, servida con `python3 -m http.server 5183 --bind 127.0.0.1`. Servidor parado por PID al final; 5183 libre. Ningún gate corría sobre el worktree al empezar.
- [verificado] Herramientas en `~/.hermes/profiles/open-geoslide/cache/scratch/ua/XA2/`: playwright-core 1.65.1, axe-core 4.14.1, Chrome `/usr/bin/google-chrome-stable --no-sandbox`. Guion desechable: `xa2_medir.mjs` (fases `main`, `sweep`, `sanidad`). Datos crudos: `medicion-main.json`, `medicion-sweep.json`, `medicion-sanidad.json`.
- [verificado] Recorrido por caso: abrir sin guía de primera visita (`ogs.onboarding.v1 = seen`), tema fijado con `ogs.theme.v1`, esperar «ogs-core 0.5.0», capturar «arranque», menú **Archivo ▸ Elegir un ejemplo… ▸ HAM1**, pulsar **Comprobar** (espera a `result-summary[data-state=current] .rs-fs`), quitar el ratón y capturar «ejemplo-comprobado». En 1440 oscuro, además, la pestaña «Casos de verificación».
- [verificado] Control de axe: una página con `img` sin alt, botón vacío, contraste bajo y sin `h1` produjo 4 violaciones (`button-name`, `color-contrast`, `image-alt`, `page-has-heading-one`). Así se confirma que axe corre de verdad.
- [verificado] Dos correcciones de método, aplicadas antes de dar cifras: (a) tras pulsar «Comprobar» el ratón queda sobre el botón y cambia su fondo por `:hover` (#60a5fa → #93c5fd en oscuro); se mueve el ratón fuera antes de medir. (b) Las filas de la barra se agrupan por `top` con tolerancia de 12 px, porque «Informe PDF» se alinea 5 px más abajo que «Comprobar» dentro de su grupo.

## Mediciones (arranque / ejemplo comprobado)

Tiempos en ms: `ogs-core` en contexto nuevo (frío) / recarga (caliente) / cálculo del ejemplo HAM1.

| Tema | Ancho | ms frío / caliente / cálculo | scrollH (arranque / ejemplo) | Filas barra (alto) | Filas tablist (alto) | Botón Comprobar fondo / texto = contraste | Tamaño botón | Objetivos <24 px | axe serias+críticas (arr / ej) | axe aprobadas (arr / ej) | Consola / HTTP ≥400 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| oscuro | 1440×900 | 124 / 48 / 41 | 1236 / 2170 px (vh 900) | 2 / 2 (94 px) | 3 (110 px, 10 pestañas) | #60a5fa / #0b111b = 7.44:1 | 16px · 42 px | 0 de 68 | 0 / 0 | 52 / 53 | 0 |
| oscuro | 1280×800 | 115 / 48 / 47 | 1236 / 2283 px (vh 800) | 2 / 2 (94 px) | 3 (110 px, 10 pestañas) | #60a5fa / #0b111b = 7.44:1 | 16px · 42 px | 0 de 68 | 0 / 0 | 52 / 54 | 0 |
| oscuro | 390×844 | 114 / 50 / 48 | 2036 / 3923 px (vh 844) | 2 / 2 (82 px) | 3 (110 px, 10 pestañas) | #60a5fa / #0b111b = 7.44:1 | 14.4px · 32 px | 0 de 61 | 0 / 0 | 52 / 54 | 0 |
| claro | 1440×900 | 114 / 49 / 46 | 1236 / 2170 px (vh 900) | 2 / 2 (94 px) | 3 (110 px, 10 pestañas) | #1f4e79 / #ffffff = 8.66:1 | 16px · 42 px | 0 de 68 | 0 / 0 | 52 / 53 | 0 |
| claro | 1280×800 | 115 / 47 / 46 | 1236 / 2283 px (vh 800) | 2 / 2 (94 px) | 3 (110 px, 10 pestañas) | #1f4e79 / #ffffff = 8.66:1 | 16px · 42 px | 0 de 68 | 0 / 0 | 52 / 54 | 0 |
| claro | 390×844 | 111 / 48 / 47 | 2036 / 3923 px (vh 844) | 2 / 2 (82 px) | 3 (110 px, 10 pestañas) | #1f4e79 / #ffffff = 8.66:1 | 14.4px · 32 px | 0 de 61 | 0 / 0 | 52 / 54 | 0 |

- [verificado] Familia tipográfica calculada: cuerpo, FS, números de entrada, números de SVG y coordenadas: `system-ui, -apple-system, Segoe UI, Roboto, sans-serif (pila del sistema)`. En todas las vistas la familia es la misma. No hay `@font-face` ni `document.fonts` cargado.
- [verificado] Número del FS: `.rs-fs`, `font-variant-numeric: tabular-nums`.
- [verificado] Contraste del texto del cuerpo: oscuro #f1f5f9 sobre #0b111b = 17.27:1; claro #111827 sobre #f3f4f6 = 16.12:1.
- [verificado] Casos de verificación (1440 oscuro): scrollH 900 / innerH 900 (sin scroll vertical), scrollW 1440 / 1440, objetivos interactivos 15 (menores de 24 px: 0), axe: 0 serias/críticas, 41 reglas aprobadas, incompletas: [].
- [verificado] Consola: 0 mensajes `error`/`warning`, 0 `pageerror`, 0 respuestas HTTP ≥ 400 en las 6 combinaciones del recorrido completo, en el barrido y en «Casos».

### Barrido de anchos (arranque, sin capturas)

| Tema | Ancho | scrollW / innerW | scrollH / innerH | Filas barra (alto) | Filas tablist (alto) | Objetivos <24 px | Errores consola/HTTP |
|---|---|---|---|---|---|---|---|
| oscuro | 320 | 320 / 320 | 2202 / 900 | 2 (82 px) | 4 (148 px) | 2 | 0 |
| oscuro | 390 | 390 / 390 | 2063 / 900 | 2 (82 px) | 3 (110 px) | 0 | 0 |
| oscuro | 768 | 768 / 768 | 2076 / 900 | 4 (170 px) | 2 (72 px) | 0 | 0 |
| oscuro | 1024 | 1024 / 1024 | 1274 / 900 | 3 (132 px) | 3 (110 px) | 0 | 0 |
| oscuro | 1440 | 1440 / 1440 | 1236 / 900 | 2 (94 px) | 3 (110 px) | 0 | 0 |
| claro | 320 | 320 / 320 | 2202 / 900 | 2 (82 px) | 4 (148 px) | 2 | 0 |
| claro | 390 | 390 / 390 | 2063 / 900 | 2 (82 px) | 3 (110 px) | 0 | 0 |
| claro | 768 | 768 / 768 | 2076 / 900 | 4 (170 px) | 2 (72 px) | 0 | 0 |
| claro | 1024 | 1024 / 1024 | 1274 / 900 | 3 (132 px) | 3 (110 px) | 0 | 0 |
| claro | 1440 | 1440 / 1440 | 1236 / 900 | 2 (94 px) | 3 (110 px) | 0 | 0 |

- [verificado] Sin scroll horizontal a ningún ancho entre 320 y 1440 (`scrollW = innerW`).
- [verificado] Objetivos <24 px solo a 320 px: vértices 5 y 6 de la región 1 del lienzo (`ec-handle`), 24,00 × 24,00 con dos decimales. Quedan marcados por el criterio estricto `< 24`; son subpíxel, no un defecto real.

## Capturas

Carpeta: `~/.hermes/profiles/open-geoslide/cache/scratch/ua/XA2/capturas/`.

- `arranque-{1440,1280,390}-{oscuro,claro}.png` (6)
- `ejemplo-comprobado-{1440,1280,390}-{oscuro,claro}.png` (6)
- `casos-verificacion-1440-oscuro.png` (1)

Solo se captura el viewport, sin página completa. El alto de página se mide en la tabla.

## Conclusiones

1. [verificado] La web arranca con 0 errores de consola, 0 respuestas ≥ 400 y 0 excepciones en las 6 combinaciones tema × ancho, en el barrido y en «Casos».
2. [verificado] axe no encuentra violaciones serias ni críticas en ninguna vista medida (arranque, ejemplo comprobado y casos; ambos temas; 1440, 1280 y 390). Las reglas aprobadas van de 52 a 54 en arranque y ejemplo, y 41 en «Casos». Como el control de sanidad sí detecta fallos, el resultado es real.
3. [verificado] Todo el texto usa la pila del sistema. No hay fuentes web: `dist/fonts/` solo tiene DejaVu Sans (`pdf.ts`, para el informe PDF) y no está en la precarga del service worker (`sw.js` no la nombra). Cualquier fuente nueva de la maqueta debe declararse en la precarga.
4. [verificado] Contraste del botón «Comprobar»: 7.44:1 en oscuro (#0b111b sobre #60a5fa) y 8.66:1 en claro (#ffffff sobre #1f4e79). Ambos superan AA (4.5:1).
5. [verificado] Altura de página: scroll vertical en todos los anchos medidos (1236 px en 1440 de arranque; 2036 px en 390). Con ejemplo comprobado crece a 2170 px en 1440 y 3923 px en 390. Sin scroll horizontal de 320 a 1440.
6. [verificado] Barra de herramientas: 2 filas a 1440, 1280 y 390 (94 y 82 px); 3 filas a 1024 (132 px); 4 a 768 (170 px). En 390 la barra pliega Deshacer/Rehacer en «Editar ▾» (visto en la captura).
7. [verificado] Tablist «Paneles del modelo» (10 pestañas): 3 filas a 1440 (110 px), 2 a 768 (72 px), 4 a 320 (148 px).
8. [verificado] Objetivos pequeños: 0 con menos de 24 px en arranque y ejemplo a 390, 1280 y 1440 (61–82 interactivos por vista). Solo aparecen los vértices de 24 px a 320 (ver nota del barrido).
9. [verificado] Tiempos en localhost, Linux, Chrome headless: `ogs-core` en 111–124 ms en frío, 47–50 ms en caliente; cálculo de HAM1 en 41–48 ms (medición final, tabla).
10. [inferido] Estos tiempos son de localhost, así que no reflejan una red real. No se midió el tema por defecto sin `ogs.theme.v1`.
11. [inferido] La maqueta A usa una tipografía distinta según el brief (Outfit y JetBrains Mono; XA4 lo verifica). Esta línea base la contrasta con la pila del sistema actual.

## Dudas para el coordinador

- ¿Las capturas deben incluir la guía de primera visita? Aquí se omitió con `ogs.onboarding.v1 = seen`. `App.tsx:446` la abre sola la primera vez.
- ¿Los vértices de 24,00 px a 320 cuentan como cumplimiento? El criterio `< 24` los marca por subpíxel.
- ¿Se tomaron las capturas oscuras con el tema forzado por `localStorage`? Sí. El tema de sistema no se midió.
- En `docs/suite-a/exploracion/` hay también un `XA4.md` que no es mío; no lo he tocado.
