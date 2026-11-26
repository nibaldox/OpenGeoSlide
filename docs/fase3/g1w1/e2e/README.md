# F3G-W1: recorrido del panel «Análisis» (grieta de tracción) y del panel «Agua»

Requiere `playwright-core` y `axe-core` instalados en un directorio de scratch (no en el repo), `pnpm build` y
`vite preview --port 5183 --strictPort --host 127.0.0.1` de `apps/web`. Cambia el puerto con `OGS_URL`; el axe se busca en `AXE`, `<TMPDIR>/x8-ux/node_modules/axe-core/` o `<TMPDIR>/w2-e2e/node_modules/axe-core/`.

- `g1w1_grieta_panel.mjs` (`THEME=light|dark`, sin él recorre ambos; `OUT=carpeta`, por defecto `<TMPDIR>/g1w1-out`): casilla, «Automática», profundidad fija, errores con el texto del
  motor, guardado en `0.5` con la grieta al final de `analysis`, versión mínima al apagarla y texto del panel «Agua». 15 comprobaciones por tema.
- `g1w1_axe.mjs`: axe (wcag2a/aa/21aa/22aa + best-practice) en claro y oscuro sobre «Análisis» (con un error visible) y «Agua».

No calcula: solo edita el modelo. El recorrido con el motor real (grieta fija y automática, lienzo, Casos, CSV y PDF) es `docs/fase3/g1w2/e2e/g1w2_lienzo.mjs`, sin datos simulados. Los dos guiones están en `docs/fase3/iw/e2e/run_regression.sh`.
