# U3-O: primera visita, ayuda, confirmación, proyecto e instalación

Escritor U3-O, rama `u3o-onboarding`. Hallazgos que cubre: UX-12, UX-17 (el diálogo; el cambio en `EditorApp` lo hace el coordinador) y UX-19.

## Guía de primera visita (`src/onboarding/`, `GuidedTour.tsx`)
- 5 pasos sobre controles reales: menú Archivo, pestañas del panel, «Comprobar», resumen de FS (`result-summary`) e «Informe PDF». Los destinos son datos (`TOUR_STEPS[].target`: selector y, si hace falta, texto), así que cambiar un control se arregla en un solo lugar.
- **No modal:** `popover="manual"` con `role="dialog"` y `aria-modal="false"`; no hay `inert`, ni fondo atenuado. El anillo es otro popover manual con `pointer-events: none`.
- **Posición por script**, con `placePopover` (función pura): debajo, encima, a la derecha o a la izquierda, el primero que cabe sin tapar el control; si ninguno cabe, flota abajo. No se usó anchor positioning: en Firefox no existe y el cálculo puro se prueba en Node.
- **Foco:** al abrirse sola NO se mueve (la guía de popovers lo desaconseja); el cuadro va justo tras la cabecera en el orden de tabulación y una región `polite` anuncia el paso. Si se abre desde «Ayuda», el foco entra en «Siguiente». Al cerrar con el foco dentro, vuelve al control destacado o, si no es enfocable o está deshabilitado, al botón «Ayuda». Esc cierra desde dentro del cuadro.
- **Persistencia:** `localStorage` `ogs.onboarding.v1`. Cualquier valor cuenta como visto. Se marca al abrirse la primera vez (recargar a mitad no la repite). Sin almacenamiento utilizable se da por vista, para no insistir en cada visita.
- En «Casos de verificación» no tiene destino y se cierra sola.
- `prefers-reduced-motion`: la única animación (la transición del anillo) solo existe con `no-preference`.

## Recorridos e2e
Las tres copias con el puerto 5187 marcan la guía como vista con `addInitScript` (`localStorage.setItem('ogs.onboarding.v1', 'seen')`) antes de cargar la página. En `u3o_walk_u2x.mjs` además se espera a que el indicador diga «ogs-core» antes de leerlo: la lectura inmediata del paso 1 ya era una carrera en `50d8b0b` (11 de 12 lecturas decían «Cargando el motor…» también allí).

## Ayuda (`ui/HelpDialog.tsx`, `onboarding/helpContent.ts`)
- `<dialog>` modal con índice interno (enlaces que llevan el foco al encabezado), inicio rápido (los mismos 5 pasos de la guía: `QUICK_START === TOUR_STEPS`), glosario, atajos, limitaciones, advertencia profesional y enlaces.
- **Atajos sin texto duplicado:** `SHORTCUTS` es la única fuente. Cada entrada lleva las pulsaciones con que se prueba, y `helpContent.test.ts` las envía a `shortcutFor` (globales) y a `keyActions` (lienzo): si un atajo cambia, la prueba falla. La herramienta `R` («Dibujar región») de U3-M **no está** porque aún no existe en `shortcuts.ts`; al integrar hay que agregarla a `SHORTCUTS`.
- Detalle de los controles en `.help-scroll { position: relative }`: sin eso, el texto `.visually-hidden` de los enlaces externos (posición absoluta) toma como bloque contenedor el `<dialog>` y lo hace desbordar, y `scrollIntoView` desplaza la cabecera.
- Los estilos de los diálogos usan `dialog.ea-dialog.help-dialog` (especificidad mayor que `dialog.ea-dialog`, que se carga después).

## `useConfirm` / `ConfirmHost` (`ui/ConfirmDialog.tsx`, `ui/confirmQueue.ts`)
- Cola pura (`createConfirmQueue`): una solicitud a la vez, en orden; `resolve(true|false)`; `cancelAll()` si el host se desmonta (nadie queda colgado). `useConfirm()` devuelve una función estable y guarda el elemento enfocado para devolverle el foco.
- `<dialog role="alertdialog">` con `showModal()`. Foco inicial: «Cancelar» en `tone: 'danger'`, y el botón de confirmar en el resto. Esc = cancelar. El disparador se fija con `useState` (no con una variable del efecto) porque en StrictMode (desarrollo) el efecto corre dos veces y el foco ya estaría dentro del diálogo.
- `App.tsx` no tenía `window.confirm`. El de `EditorApp.confirmDiscard` (síncrono, también lo recibe `readOpenFile`) lo cambia el coordinador: hay que volverlo asíncrono (`await confirm({ tone: 'danger', … })`).

## Panel «Proyecto» (`editor/panels/ProjectPanel.tsx`, `projectForm.ts`)
- **Campos reales de `Meta`:** `id`, `title` y `notes`; el esquema (`$defs/meta`, `additionalProperties: false`) y `ogs-core` (`deny_unknown_fields`) **no tienen «autor»**. Agregarlo exige cambiar el esquema y el motor, y el brief dice que el motor no se toca. Queda como decisión del coordinador. «Descripción» es `notes`; también aparece en el informe PDF (`report/content.ts`).
- Un campo vacío se quita del documento (`meta/patch` con `undefined`), no se deja `null` ni `""`. Sin cambios no hay comando.
- **Unidades:** no hay comando `units/set`, así que usa `doc/replace` con `fileName: null` (un paso deshacible). Con el nombre del archivo, `doc/replace` marcaría el documento como guardado y se perdería el aviso al cerrar la pestaña; con `null` queda «con cambios sin guardar» y solo se pierde el nombre del archivo en la barra de estado (muestra el título). Si M agrega `units/set` al reductor, basta cambiar `unitsChangeCommand`.
- Antes de aplicar el cambio, `useConfirm` explica que no se convierten los valores (con las unidades de origen y de destino).
- **Barra de estado:** `documentTitle` muestra «Título (archivo)» cuando hay archivo y título; antes mostraba solo el archivo. El cableado ya existía en `EditorApp`.
- **Registro pendiente (coordinador):** `{ id: 'project', label: 'Proyecto', Panel: ProjectPanel }` en `TABS` de `EditorApp`, `'project'` en `PanelTabId` (`app/issueNav.ts`) y `export { ProjectPanel }` en `panels/index.ts` (o importarlo de su archivo).

## Instalar app (`pwa/installPrompt.ts`, `ui/InstallButton.tsx`)
- `beforeinstallprompt` puede llegar antes de que React monte: el controlador se crea al importar `pwa/register.ts` (cargado desde `index.html`) y el botón lee su estado con `useSyncExternalStore`. Captura el evento (`preventDefault`), `install()` llama a `prompt()` una sola vez y oculta el botón; `appinstalled` y `display-mode: standalone` (o `navigator.standalone`) lo ocultan siempre.
- Sin oferta del navegador (Firefox, Safari, ya instalada) no hay botón.

## Comprobación
`docs/fase2/ux/u3o-e2e/`: `u3o_onboarding.mjs` (guía, ayuda, instalar, proyecto y confirmación en Chrome), `u3o_axe_shots.mjs` (axe en claro y oscuro y capturas a 1440 y 390 px) y la copia del recorrido de regresión con el puerto 5187. La pestaña «Proyecto» la registra el coordinador; para probarla antes se aplicó un parche temporal a `EditorApp.tsx` que **no** se confirmó (`WITH_PROJECT=0` omite esos pasos).
