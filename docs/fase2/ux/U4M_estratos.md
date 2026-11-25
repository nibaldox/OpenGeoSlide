# Estratos (U4-M)

Hallazgo que cubre: UX9-01 (X9, T2). Código en `apps/web/src/editor/`. Rama `u4m-estratos`.

## Encuadre y espacio para dibujar

- **Encuadrar** (botón, tecla `0` y vista inicial) usa `paddedBounds` (`canvas/viewportOps.ts`): 25 % del alto del modelo bajo la base y a los lados, 10 % arriba, con 24 px de margen. En 1440×900 la base queda a 106 px del borde inferior (X9: 59 px).
- **Autodesplazamiento:** con «Dibujar región» o «Dividir región», el puntero (ratón o lápiz; no el dedo) a menos de 24 px del borde del lienzo desplaza la vista hacia ese lado, más rápido cuanto más cerca (`edgeScrollDelta`, hasta 10 px cada 16 ms). Empieza tras 250 ms de espera, para no desplazar al cruzar el borde de paso; se detiene al salir de la franja.
- **Teclado:** si el cursor de dibujo queda a menos de 24 px del borde, `revealCursor` desplaza la vista lo justo para dejarlo a 24 px más el 20 % del lado (antes la centraba en él).
- Se puede colocar un punto en cualquier lugar, también fuera de la extensión del modelo, y Intro cierra la región igual (la validación no depende de la extensión).

## Ajuste a aristas

`snapPoint` acepta `edges: true` (solo lo piden las dos herramientas de trazo; arrastrar vértices no cambia). Prioridad: vértice > arista > alineación > rejilla. El punto se apoya en la arista **sin redondear** (12 cifras), con la bandera `vertex` de «Ajuste» (ahora «vértices y aristas existentes»). Con rejilla, en una arista vertical u horizontal la coordenada libre sigue la rejilla. Con el dedo el radio es de 22 px (10 px con ratón). Con el teclado, Espacio e Intro ajustan el punto a un vértice o arista si queda a menos de 10 px (el cursor no se mueve solo, para no atraparlo).

Al cerrar una región, cada vértice que cae en medio de una arista de otra región se inserta también en ella (`sharedInsertions` → `vertex/insert`), en un solo gesto con el `region/add`: el estrato nuevo y el vecino comparten el límite, y un solo Deshacer revierte ambos.

## Dividir región (tecla `D`)

Lógica pura en `canvas/regionOps.ts` (`splitRegion`) y `canvas/split.ts` (herramienta); mismo borrador y cursor de teclado que «Dibujar región».

| Entrada | Acción |
|---|---|
| Clic, toque o Espacio | Agrega un punto (con ajuste a vértices y aristas). Un punto sobre el borde, con la línea ya empezada, intenta dividir; si la línea todavía no atraviesa la región (por ejemplo, empezó fuera), sigue. |
| Intro | Con el cursor movido coloca el punto; sin moverlo, divide con los puntos colocados. |
| Retroceso, Esc, Ctrl+Z | Quitan el último punto, cancelan, deshacen. |

- **Regla:** la línea cruza el borde **exactamente dos veces** (entrada y salida; puede empezar y terminar fuera de la región o sobre su borde), no se toca a sí misma, el tramo interior queda dentro y ambas partes tienen área. Si no: mensaje accionable («La línea no entra y sale de la región. Empiece y termine fuera de la región o sobre su borde…», «…cruza el borde más de dos veces…», «…se cruza o se toca a sí misma…», «…va pegado al borde…»). Casos: horizontal, inclinada, con quiebres, entrada o salida en un vértice, región cóncava, inválidas (`regionOps.test.ts`).
- **Qué región:** la seleccionada, si la línea la divide; si no, la única que divide; si son varias, pide seleccionar una.
- **Resultado:** un solo paso deshacible (`gesture/begin` + `material/upsert` + `region/setPolygon` + `region/add` + `vertex/insert` en los vecinos). La parte de arriba (centroide más alto; a igual altura, la izquierda) conserva la región; la otra es la nueva, con el material seleccionado en «Materiales» o con un material nuevo «Estrato N» con los parámetros del original. Se anuncia el resultado y la región nueva queda seleccionada.
- Nuevo comando `region/setPolygon` (reducer) y herramienta `split_region`; la tecla `D` está en `SHORTCUTS` de la ayuda.
- Panel Geometría: botón **«Dividir región…»** (activa la herramienta) y, en cada región, el material con su muestra de color (`--canvas-mat-N`).

## «Talud simple…» con estrato inferior

Casilla «Agregar un estrato inferior (material 2)»: material 2 (nombre, γ, c, φ) y el contacto horizontal, dado por su **profundidad bajo el pie** (> 0 y menor que la profundidad del modelo) o por su **cota** y (entre la base y la corona; el pie está en 0). Los nombres accesibles llevan el prefijo «Estrato inferior:» / «Contacto:». Genera dos regiones (`suelo` arriba, `estrato-2` abajo) con el contacto compartido; un contacto a la altura del pie o sobre él corta la cara del talud (`slopeRegions`). La vista previa muestra ambas.

### Verificado con el motor (`newModelStrata.test.ts`, `strata.test.ts`, con `OGS_BIN`)
H = 15 m, 1,5H:1V, arcilla (c = 25, φ = 20, γ = 18) sobre roca (c = 200, φ = 40, γ = 24), contacto 5 m bajo el pie, piezométrica «en el pie»: Bishop **1,3768** y Spencer **1,3767**, convergidos. **Profundidad mínima de la superficie:** y = −2,64 m (Bishop) y −2,34 m (Spencer), es decir, a unos 2,4 m sobre el contacto (y = −5): la superficie crítica no entra en la roca. Dibujar el estrato bajo la base y dividir la región dan el mismo resultado.

## Recorridos en Chrome (`u4m-e2e/`, puerto 5186)
`u4m_t2.mjs` (T2 por las dos vías), `u4m_draw.mjs` (estrato bajo la base, ajuste a aristas, autodesplazamiento, teclado), `u4m_split_kbd.mjs`, `u4m_split_touch.mjs` y `u4m_axe.mjs` (claro y oscuro, 1440 y 390 px); `lib.mjs` es común (se ejecutan desde un directorio con `playwright-core`). `u3m-e2e/u3m_draw.mjs` se ajustó al nuevo encuadre del modelo vacío (60 × 30 con espacio libre; antes asumía margen 48).

## Fuera de la lista del brief (cambios mínimos)
`app/shortcuts.ts` (acción `tool:split_region`) y `onboarding/helpContent.ts` (fila de la tecla D: un test exige que todo atajo esté documentado), más `state/engineRun.testutil.ts` (ayuda de tests con `OGS_BIN`).
