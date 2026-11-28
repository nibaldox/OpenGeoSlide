# UA5 · Cierre: lienzo móvil sin controles bajo el pie fijo y capturas del README

Base: `ua-integracion` en `9f006ed`. Puertas de la base:
- typecheck y build en verde;
- vitest con 263 archivos de test pasados más 9 saltados, y 4315 tests pasados más 320 saltados;
- aceptación 17/17;
- regresión e2e con 50 guiones, OK=1224, FAIL=4. Una de las fallas es nueva: `u6k_axe` en `light-320` y `dark-320`;
  las demás son de la línea base. Ver `docs/suite-a/CIERRE_UA.md`.

Léase con `briefs/UA_CONTRATO.md` y `briefs/ARBITRAJE_RUA.md` (UA-E1 a UA-E5). Las reglas de commits, de parada y de
informe son las del contrato §7.

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **UA5-M** lienzo móvil | `opengeoslide-wt/ua5-m` / `ua5-m` | 5186 y 5187 (los de la regresión) | `apps/web/src/editor/app/shell/**`, `apps/web/src/editor/EditorApp.tsx`, `apps/web/src/ui/ua4f.css.test.ts`; los guiones `docs/**/e2e/**` solo si el cambio de orden de esta ola rompe alguno, con comentario `// UA5: …` |
| **UA5-D** capturas del README | `opengeoslide-wt/ua5-d` / `ua5-d` | 5183 | `README.md` (solo el bloque `<picture>` de la captura y su `alt`), `assets/readme/app-editor-dark.png`, `assets/readme/app-editor-light.png` |

## UA5-M · Lienzo móvil

**Invariante:** hasta 760 px de ancho, a scroll 0, ningún control interactivo queda **parcialmente** bajo el pie fijo.
El borde superior del pie cae sobre contenido no interactivo (el lienzo, la leyenda o un hueco). Los controles
interactivos son `button`, `a[href]`, `input`, `select`, `textarea`, `[role=tab]` y `[tabindex="0"]`.

**Caso medido** (coordinador, `~/.hermes/profiles/open-geoslide/cache/scratch/ua2/coord/measure_mobile.mjs`): a
320 × 844, con un archivo abierto (aviso de 72 px) y el HUD con «Ver avisos», el lienzo de UA4
(`clamp(260px, calc(100dvh - 530px), 360px)`) deja la paleta en y = 806-905, mientras el pie ocupa 787-844. Pasa lo
mismo a 390 × 844 con un archivo abierto: la paleta queda en 726-825. La altura fija en CSS no puede contar el alto
variable de los avisos ni del HUD.

**Corrección** (enmienda **UA-E6**):
1. **Orden en móvil:** lienzo → paleta → leyenda → HUD. Las herramientas quedan junto al lienzo sobre el que actúan.
   El FS mínimo sigue a la vista a scroll 0 en el chip de la cabecera. Esto reemplaza el orden de §2 y de B-13(a).
2. **Alto del lienzo medido:** `--ua-canvas-h` sale de una función pura de `editor/app/shell/` con tests:
   - fórmula: `alto = max(MIN, innerHeight − alto del pie − margen − top del SVG en el documento − alto de la paleta y
     sus márgenes)`;
   - `MIN = 200`, sin máximo; el margen es de unos 8 px;
   - un hook la aplica sobre la tarjeta, con `ResizeObserver` sobre los bloques que hay por encima del SVG (cabecera,
     avisos, pestañas), sobre la paleta y sobre el pie, más `resize` y `orientationchange`;
   - solo actúa hasta 760 px; en escritorio no toca nada;
   - el `clamp` de UA4 queda como respaldo en CSS, para el primer pintado.
   - **Sin bucles:** cambiar el alto del SVG no cambia ni su top ni el alto de los bloques que mide. Pruébalo con un
     test.
   - Al cambiar el alto, el lienzo reencuadra con la regla de siempre: solo si la vista sigue en el último encuadre
     automático.
3. Se conserva `scroll-padding-bottom` del pie.

**Comprobación obligatoria**, contra tu build:
- **Barrido de viewports** (320 × 568, 320 × 640, 320 × 844, 360 × 740, 390 × 664, 390 × 844, 412 × 915 y
  760 × 1024) por los cuatro estados: vacío (tras «Nuevo»), archivo abierto con aviso
  (`~/.hermes/profiles/open-geoslide/cache/scratch/u6k-axe-short.ogs.json`), ejemplo calculado y ejemplo calculado con
  avisos.
  - En cada caso, a scroll 0, cuenta los controles interactivos visibles cuya caja **cruza** el borde superior del pie
    (intersecta sin quedar contenida).
  - Debe dar 0. La única excepción son los casos en que el alto disponible cae bajo `MIN`; lístalos con sus cifras.
- **Guiones e2e** a 320, 390 y 1440:
  - `docs/fase2/ux/u6k-e2e/u6k_axe.mjs`, `u3m-e2e/u3m_axe.mjs`, `u4p-e2e/u4p_targets.mjs`, `u5e-e2e/u5e_axe.mjs`,
    `u5e-e2e/u5e_demo.mjs` y `u2c-e2e/u3i_u2c_touch.mjs` (o donde esté), todos con 0 FAIL;
  - córrelos con `OGS_URL` y `OGS_REPO`, contra `vite preview` en el 5186.
- **Regresión completa con `full_regression.sh`** (ver
  `~/.hermes/profiles/open-geoslide/skills/software-development/ogs-e2e-preview-integration/SKILL.md`):
  - FAIL ≤ 3, y solo los de la línea base: `u3o_onboarding` 6 y `u6d_drafts` R9-11a;
  - más los mismos dos `exit=1` por la descarga de `w1e_polilinea` y `r2i2_tablestaca_inclinada`.
- **Aceptación:** 17/17.
- **Capturas** a 390 × 844 y 320 × 844, en oscuro, a scroll 0, con un archivo abierto y con un ejemplo calculado.

**Entorno:**
- `TMPDIR=~/.hermes/profiles/open-geoslide/cache/scratch`;
- `node_modules`, `src/wasm` y `target/release/ogs` (v0.5.0) ya están en tu worktree;
- `playwright-core` en `$TMPDIR/f1c-e2e/node_modules`, y la aceptación con `OGS_Q=$TMPDIR/ua1/Q`.

## UA5-D · Capturas del README

Las dos capturas de `assets/readme/` son de la interfaz anterior. Regenéralas con la nueva. Usa el mismo modelo que
describe el `alt`: un talud de 15 m (1,5H:1V) de arcilla sobre roca, con la piezométrica. Búscalo en el selector
«Ejemplos» o en `verification/cases/`.

- **Tamaño:** el mismo de las actuales (léelo del PNG).
- **Tema:** claro en `app-editor-light.png` y oscuro en `app-editor-dark.png`.
- **Estado de la pantalla:**
  - la vista Lienzo con el modelo calculado;
  - un paso abierto que muestre el armazón, por ejemplo Materiales o Análisis;
  - el HUD desplegado;
  - sin avisos de sesión;
  - la guía de primera visita marcada como vista.
- Actualiza el `alt` con lo que muestra la captura nueva: métodos y FS, usando la coma decimal.
- Mira las dos capturas tú mismo antes de hacer commit.
- PNG optimizados: si cada captura supera 400 KB, recomprímela sin perder calidad visible.

Construye y sirve tu build en el 5183, desde una copia de `dist` en `$TMPDIR/ua5/D/dist`. `playwright-core` y Chrome
son los de la aceptación (`$TMPDIR/ua1/Q/node_modules`, `/usr/bin/google-chrome-stable --no-sandbox`).

En el informe, propone de 4 a 8 líneas para la sección `[Unreleased]` de `CHANGELOG.md`, con el formato del archivo,
resumiendo el rediseño a partir de `docs/suite-a/CIERRE_UA.md` y de los briefs. No edites `CHANGELOG.md`: es del
coordinador.
