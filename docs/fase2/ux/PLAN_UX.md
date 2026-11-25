# Plan UX y tema oscuro (Fase 2, bloque U)

Este plan consolida dos revisiones:
- **X8** (Haiku): auditoría práctica en Chrome con axe-core, en `docs/fase2/ux/X8_auditoria_practica.md`.
- **R7** (Antigravity): revisión adversarial del código, en `docs/reviews/R7_agy.md`, con veredicto MEJORABLE.

El coordinador reprodujo en la app publicada estos hallazgos:
- **R7-05:** tras «Nuevo» siguen visibles los FS 0,985 y 0,984 del modelo anterior.
- **R7-07:** Ctrl+S en «Casos de verificación» descarga `nuevo.ogs.json`.
- **R7-01:** confirmado en el código.
- **UX-03 y UX-04:** confirmados visualmente.

## Contrato de tokens de color (normativo para todo el bloque U)
Los nombres siguen la §2 de R7. **Solo la ola T define los valores**, en `apps/web/src/styles/tokens.css`. Las demás olas
**solo consumen** `var(--…)` y no escriben colores literales.

- **UI:**
  - superficies: `--ui-bg`, `--ui-surface`, `--ui-surface-subtle`, `--ui-surface-hover`, `--ui-surface-active` y
    `--ui-backdrop`;
  - texto: `--ui-ink`, `--ui-ink-muted` y `--ui-ink-on-accent`;
  - bordes y foco: `--ui-border`, `--ui-control-border` y `--ui-focus`;
  - acento: `--ui-accent` y `--ui-accent-hover`;
  - estados: `--ui-{ok,warn,err}-{bg,ink,border}`, `--ui-info-{bg,ink}` y `--ui-note-{bg,ink}`;
  - filas e inputs: `--ui-row-selected`, `--ui-row-warn` y `--ui-input-err-bg`.
- **Lienzo** (SVG del editor y Canvas 2D de casos):
  - base: `--canvas-bg`, `--canvas-grid`, `--canvas-axis`, `--canvas-axis-text` y `--canvas-halo`;
  - trazos: `--canvas-region-edge`, `--canvas-selected`, `--canvas-surface`, `--canvas-surface-unconverged`,
    `--canvas-piezo`, `--canvas-load`, `--canvas-seismic` y `--canvas-seismic-bg`;
  - bandas: `--canvas-band-entry` y `--canvas-band-exit`;
  - dovelas: `--canvas-slice-fill` y `--canvas-slice-edge`;
  - tiradores: `--canvas-handle-fill`, `--canvas-handle-sel`, `--canvas-handle-snap` y `--canvas-handle-ring`;
  - materiales: `--canvas-mat-0` a `--canvas-mat-6` y `--canvas-mat-unknown`.
- **PDF:** paleta RGB fija en `apps/web/src/report/palette.ts`. **Nunca** lee CSS ni `color-scheme`. Los colores de
  material coinciden en tono con la paleta clara del lienzo.
- **Mecanismo:**
  - `color-scheme: light dark` en `:root`, con `<meta name="color-scheme">` y un script en línea mínimo que evita el
    destello del tema equivocado (`localStorage` `ogs.theme.v1`);
  - un selector **Sistema / Claro / Oscuro**. «Sistema» indica el tema resuelto;
  - `light-dark()` con el respaldo `@media (prefers-color-scheme)` que pide la guía `dark-mode`;
  - `theme-color` con `media` para claro y oscuro.
- **Contraste mínimo en ambos temas:**
  - texto: 4,5:1;
  - bordes de control, foco y trazos esenciales del lienzo (superficie crítica, piezométrica, tiradores) contra su
    fondo inmediato: 3:1.

## Olas
| Ola | Alcance | Hallazgos |
|---|---|---|
| **U1-T** Tema y color | tokens, selector, sin destello del tema equivocado, migración de colores (CSS, lienzo, Canvas 2D, aviso PWA), contraste y halo, paleta PDF alineada, «Más tarde» en el aviso PWA | R7-15, R7-27, R7-29 (CSS), UX-06, UX-15, UX-20, R7-18 (PWA) |
| **U1-A** Estado y correctitud | rótulo y λ no convergidos, reinicio del motor al cambiar de documento, token de solicitud, atajos solo en Editar, `doc/load`, carreras en Casos, fallo o cancelación del Worker, `<dialog>` nativo, base DXF por unidad, CSV inválido bloqueado, motivo visible de exportación bloqueada, `beforeunload`, título del modelo, terminología | R7-01, 03, 05, 06, 07, 08, 09, 14, 17, 18 (borrador), 21, 28, UX-07, 11, 14 |
| **U1-M** Mensajes y unidades | mensajes en lenguaje geotécnico con la acción a tomar, avisos actualizados, unidades imperiales en las etiquetas y valores por defecto | R7-19, 20, 22, UX-13 |
| **U2-B** Interacción y accesibilidad | resultados visibles sin desplazarse, barra agrupada, `<main>` y tabindex itinerante, `aria-live` persistente y avisos que se cierran solos, navegación desde Diagnósticos, tablas sin desborde, teclado y objetivos táctiles en el lienzo, superficie no convergida discontinua, zoom y encuadre, leyenda, móvil | R7-04, 10, 11, 12, 13, 16, 23, 24, 26, UX-02, 03, 04, 05, 08, 09, 10, 16, 18 |
| **U3-C** Modelado desde cero y primer uso | alta y baja de regiones, dibujar región, tabla de vértices, panel Proyecto (metadatos y unidades), guía de primera visita y ayuda, confirmación con estilo, botón instalar | R7-02, UX-01, 12, 17, 19 |
| **R8 + X9** | revisión adversarial y auditoría práctica de verificación (axe en claro y oscuro) | — |
| README | rediseño con capturas reales en ambos temas (brief F2R) | — |

## Reglas para todas las olas
- Cada hallazgo tiene un test que **falla antes** del cambio, cuando el comportamiento se puede probar.
- No cambian los nombres accesibles de los botones «Comprobar», «Informe PDF», «Exportar resultados (CSV)»,
  «Exportar superficie (CSV)», «Nuevo», «Abrir» y «Guardar» hasta U2-B, porque el recorrido e2e los usa.
- El motor no se toca. Los gates de paridad y de ida y vuelta deben seguir en verde.
