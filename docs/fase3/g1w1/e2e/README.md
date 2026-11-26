# F3G-W1: recorrido del panel «Análisis» (grieta de tracción) y del panel «Agua»

Requiere `playwright-core` y `axe-core` instalados en un directorio de scratch (no en el repo), `pnpm build` y
`vite preview --port 5183 --strictPort --host 127.0.0.1` de `apps/web`. Cambia el puerto con `OGS_URL`.

- `g1w1_grieta_panel.mjs` (`THEME=light|dark`, `OUT=carpeta`): casilla, «Automática», profundidad fija, errores con el texto del
  motor, guardado en `0.5` con la grieta al final de `analysis`, versión mínima al apagarla y texto del panel «Agua». 15 comprobaciones.
- `g1w1_axe.mjs`: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro sobre «Análisis» (con un error visible) y «Agua».

No calcula con la grieta: hasta la integración de M-grieta el motor responde con los stubs de G0.
