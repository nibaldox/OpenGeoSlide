# Brief X9: auditoría práctica de verificación de la UX (explorador Haiku, **solo lectura**)

Responde en **español neutro, sin voseo**.

**Objetivo:** repetir la auditoría X8 (`docs/fase2/ux/X8_auditoria_practica.md`) sobre la versión actual de la app, con
las olas U1-U3 aplicadas, y medir con los mismos criterios si cada hallazgo UX-01 a UX-20 quedó cerrado. Además, evaluar
con un **usuario simulado** el flujo de un ingeniero que llega por primera vez.

## Objetivo de la prueba
El build local de `main`. Sírvelo tú: `cd /home/xodla/archivos/opengeoslide/apps/web && pnpm build && pnpm preview --port 5184 --strictPort --host 127.0.0.1`,
en segundo plano y solo en el puerto **5184**. Al terminar, mata el servidor por PID; no uses `pkill -f`. El WASM ya
está compilado en `src/wasm`; si falta, ejecuta `bash scripts/build-wasm.sh`. **No modifiques el código.**

## Herramientas
- `playwright-core` en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/f1c-e2e`, con Chrome
  `/usr/bin/google-chrome-stable` y `--no-sandbox`.
- axe en `/home/xodla/.hermes/profiles/open-geoslide/cache/scratch/x8-ux/node_modules/axe-core/axe.min.js`.
- Scripts de referencia: los de X8 en `$TMPDIR/x8-ux/` y los recorridos en `docs/fase2/ux/u3i-e2e/`.
- Capturas en `$TMPDIR/x9-ux/shots/`, revisadas con visión.

## Cobertura
1. **Cierre de X8:** cada hallazgo de UX-01 a UX-20, con la **misma medición** que en X8, o una mejor:
   - posición del FS tras «Comprobar»;
   - `scrollWidth` frente al ancho del viewport en 320, 390, 768, 1024 y 1440 px;
   - tamaño de los objetivos;
   - contraste;
   - axe por vista;
   - teclado.
   Marca cada uno como `CERRADO | PARCIAL | ABIERTO`, con números.
2. **Usuario simulado** («geotécnico, primera vez, sin leer documentación»). Mide clics, tiempo y obstáculos en cada
   tarea:
   - **T1:** entender qué es la app y calcular un ejemplo.
   - **T2:** crear desde cero un talud de 15 m a 1,5H:1V con dos estratos (arcilla sobre roca), con la piezométrica,
     calcularlo y leer el FS.
   - **T3:** agregar `kh = 0,15` y una carga distribuida en la corona, y recalcular.
   - **T4:** exportar el informe PDF y guardar el modelo.
   - **T5:** reabrir el modelo guardado y deshacer un cambio.
   Para cada tarea, informa si se completó (sí o no), el número de pasos, los puntos de duda y las mejoras concretas.
3. axe en claro y oscuro, en todas las vistas y diálogos.
4. **Rendimiento:** LCP, CLS, tiempo hasta el primer cálculo, y arrastre de vértices con un modelo de 300 vértices o
   más. Para el arrastre, mide los fotogramas con `requestAnimationFrame` y la cantidad de long tasks.
5. Lo nuevo: guía de primera visita, Ayuda, `ConfirmDialog`, Proyecto, «Talud simple…», «Dibujar región» e «Instalar
   app».

## Entregable (único archivo que escribes)
`/home/xodla/archivos/opengeoslide/docs/fase2/ux/X9_verificacion.md`, de 300 líneas o menos:
- resumen;
- tabla de cierre de X8;
- tabla de tareas T1 a T5;
- hallazgos nuevos `UX9-xx | severidad | vista | qué pasa | evidencia | recomendación | esfuerzo`;
- axe;
- rendimiento;
- Top 10.

Sin commits. `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. **Presupuesto:** ~70 iteraciones.
Al final responde con el resumen y el Top 10.
