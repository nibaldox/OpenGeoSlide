# UA3 · Ola correctiva de la revisión RUA

Léase con `briefs/UA_CONTRATO.md` (enmiendas UA-E1 y UA-E2), `briefs/ARBITRAJE_RUA.md` (tabla de decisiones y
**UA-E3**) y los informes `docs/reviews/RUA_agy_A.md` y `RUA_agy_B.md`, que traen la evidencia, los viewports y el
`archivo:línea` de cada hallazgo.

**Base:** `ua-integracion` con UA1 y UA2-F integradas, más el commit de congelamiento UA-E3:
- `StepStatus` suma `warn`;
- `RunStatusInput` suma `advisories?`;
- `ResultSummary` suma `compact?`, `localAdvisories?` y `onShowAdvisories?`.

Puertas de la base: typecheck en verde; vitest con 252 test files pasados más 9 saltados, y 4179 tests pasados más
320 saltados; build en verde. La aceptación da 17/17.

**Invariante que restaura esta ola:** lo que la pantalla dice del cálculo (chip, HUD, superficie dibujada, Informe) es
siempre verdad sobre el modelo actual, en la vista que se ve. Ningún control queda inalcanzable ni actúa sobre algo
que no se ve. Los hallazgos son instancias de esa regla. Una instancia nueva que encuentres va en su propio commit,
con su test, y en el informe la marcas «descartable».

| Escritor | Worktree / rama | Puerto | Archivos propios |
|---|---|---|---|
| **C1** armazón y estado | `opengeoslide-wt/ua3-c1` / `ua3-c1` | 5183 | `src/App.tsx`, `src/App.css`, `src/editor/EditorApp.tsx`, `src/editor/app/shell/**`, `src/editor/app/engineCheck.ts` y su test, `src/editor/app/editMenuLabel.ts` y su test, `src/ui/useRovingTabIndex.ts` (con test nuevo), `src/onboarding/**` |
| **C2** modelo, HUD, tokens y lienzo | `opengeoslide-wt/ua3-c2` / `ua3-c2` | 5187 | `src/editor/app/shellModel.ts` y su test, `src/editor/app/ResultSummary.tsx`, `resultSummary.css` y sus tests, `src/styles/tokens.css`, `tokens.contrast.test.ts`, `src/styles/components.css`, `src/editor/canvas/**`, `src/editor/panels/GeometryPanel.tsx` (solo el texto) |

Rutas relativas a `apps/web/`. Nadie edita `docs/**`. Las reglas de commits, de parada y de informe son las del
contrato §7. Cada hallazgo corregido lleva un test que falla antes del cambio, cuando la lógica se puede probar en
Node, y un commit `UA3-<C1|C2>: <IDs> …`.

## C1 · Armazón y estado

En orden de prioridad:
1. **A-01:** `engineCheck.ts`, cancelación externa (test con un `EngineClient` falso que rechaza con
   `EngineCancelledError`).
2. **A-02 y B-01** (llamada con `current: resultCurrent`) y **A-03** (error del motor a `runStatus`). Pasa también
   `advisories` (UA-E3 §4): incidencias locales con `severity === 'aviso'` más los avisos `aviso` del cálculo actual
   (usa `describeResultWarnings` como `resultSummary.ts`). Pasa `localAdvisories` y `onShowAdvisories` al HUD.
3. **B-05:** el método mostrado por defecto es el del FS mínimo.
4. **UA-E3 §1** (Casos), que cierra A-05, A-13 y B-13(d).
5. **UA-E3 §2** (barra plegada y móvil), que cierra A-06.
6. **A-08:** sin reencuadre al editar.
7. **UA-E3 §3** (ventanas bajas y pestañas), que cierra A-07: calcula `compact` y pásalo al HUD.
8. **A-09, A-10, A-11, A-14, B-07, B-11 y B-13(a)**, en el `shell.css` de C1.

Comprobación en Chrome, contra tu build en el 5183:
- reproduce cada escenario de la evidencia de los informes y anota antes/después:
  - A-01: Comprobar en el editor, pasar a Casos, «Comprobar caso», Cancelar;
  - A-02: borrador inválido tras calcular;
  - A-03: círculo fijo `(999, 999, r=1)`;
  - A-05: Ctrl+Z en Casos;
  - A-06: barra plegada con un cálculo largo, y a 320 px;
  - A-07: 800 × 600 y 768 × 600 con un aviso abierto;
  - A-08: V047a, cambiar y de un vértice de 20 a 40;
- capturas a 1440 × 900 (oscuro y claro), 1024 × 768 y 390 × 844 (oscuro).
- La aceptación (`docs/suite-a/e2e/aceptacion_ua.mjs`, `OGS_Q=$TMPDIR/ua1/Q`) da 17/17.

## C2 · Modelo, HUD, tokens y lienzo

En orden de prioridad:
1. **UA-E3 §5 y A-02 en `runStatus`**, y **UA-E3 §4 en `stepStates`** (el estado `warn` por avisos locales; reusa
   `issueTargetFor` para el paso). Tests por fila.
2. **HUD:**
   - **B-03 y A-12:** píldora plegada y foco;
   - **A-04:** «No convergió» sin solapes; mide las cajas con un script;
   - **A-03:** línea de error del motor con «Ver diagnósticos», que llama a `onShowAdvisories` si existe;
   - **`compact`** (UA-E3 §3), con la regla de la elección manual del usuario;
   - **`localAdvisories`** con «Ver avisos».
3. **B-06, B-09 y B-12** en los resúmenes y en `fsMinimum.text`.
4. **B-08:** tokens y pares.
5. **B-10(c):** paleta compacta o con scroll visible. **B-13(b):** título del eje «y (m)». Ambos van en
   `editor/canvas/`.
6. **B-13(c):** el texto de `GeometryPanel`.

Comprobación en Chrome, en tu build en el 5187:
- **HUD:** capturas del HUD en cuatro casos, en oscuro y claro, más axe con el HUD plegado:
  - plegado con FS < 1;
  - convergencia parcial (V047a con círculo fijo y `max_iterations=8`);
  - sin convergencia;
  - error del motor.
- **Paleta:** captura de la paleta compacta a 1440 × 680.
- `EditorApp` no es tuyo. Para ver `compact`, `localAdvisories` y los avisos, usa una copia sin commit o una página
  de prueba en scratch, y reviértela antes de terminar.
