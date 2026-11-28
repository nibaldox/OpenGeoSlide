# Cierre del bloque UA: rediseño «A · Flujo de trabajo» (27-nov-2026)

Rama `ua-integracion`, sobre v0.5.0 (`69d0413`). Contrato: `briefs/UA_CONTRATO.md`, con UA-E1 y UA-E2. Arbitraje de la
revisión adversarial: `briefs/ARBITRAJE_RUA.md`, con UA-E3 a UA-E6.

## Olas

| Ola | Qué hizo | Escritores |
|---|---|---|
| XA | Exploración: armazón actual, línea base en Chrome, contrato de tests y e2e, medidas de la maqueta | 4 × Haiku |
| UA1 | Tokens v1.1, tema oscuro por defecto, fuentes locales e ícono; armazón A; modelo puro; paleta y encuadre; HUD y piel de los componentes; guion de aceptación A01-A17 | 6 × Sonnet |
| UA2 | Encuadre que deja libre el HUD, ▾ → SVG, objetivos de clic ≥ 24, tooltips, tabla, móvil (UA2-F); migración de los guiones e2e (UA2-E) | 2 × Sonnet |
| RUA | Revisión adversarial con Antigravity (gemini-4-neon-high), dos lentes: A dio NO APTO y B, APTO CON CORRECCIONES | agy |
| UA3 | Corrección de los hallazgos de RUA (arbitraje): armazón y estado (C1); modelo, HUD, tokens y lienzo (C2) | 2 × Sonnet |
| UA4 | Pie de acción móvil en una fila, lienzo móvil adaptable y `.gp-check` de 24 px | Sonnet |
| UA5 | Móvil (UA-E6): orden lienzo → paleta → leyenda → HUD y alto del lienzo medido con JS (UA5-M); capturas del README y `capture-app.mjs` con el armazón A (UA5-D) | 2 × Sonnet |

## Puertas en `4469a78`

- **typecheck y build:** en verde; el precache de la PWA lleva 23 archivos, con las fuentes Outfit y JetBrains Mono.
- **vitest:** 264 archivos de test pasados y 9 saltados; 4333 tests pasados y 320 saltados. En v0.5.0 eran 233 y 3816.
- **Aceptación** (`docs/suite-a/e2e/aceptacion_ua.mjs`): 17/17 y 0 errores de consola. En v0.5.0 daba 5/17.
- **Regresión e2e completa** (UA5-M, mismo código de la app): 50 guiones, OK=1226, FAIL=2, no_ok=0. En v0.5.0 daba
  OK=1223, FAIL=3.
  - Siguen igual que en la base: `u3o_onboarding` 6 y `u6d_drafts` R9-11a (con `exit=1`, también en la base), y la
    salida en `exit=1` por la descarga de `w1e_polilinea` y `r2i2_tablestaca_inclinada`.
  - Ya no falla: `u4p_polish` 4d.
  - La falla de `u6k_axe` a 320 px que dejó UA4 quedó corregida en UA5-M.
- **Barrido móvil** (UA5-M, 8 viewports de 320 × 568 a 760 × 1024, 4 estados): a scroll 0 ningún control interactivo
  cruza el borde superior del pie fijo, salvo cuando el alto disponible para el lienzo cae bajo el mínimo de 200 px
  (320 × 568, 320 × 640 y 390 × 664 con avisos). Ahí la paleta queda parcialmente bajo el pie y se alcanza con scroll.
  Los datos están en `$TMPDIR/ua5/M/sweep/sweep.json`.

## Pendiente para otra ola

1. Pantallas muy bajas (≤ 640 px de alto): compactar los avisos o la paleta para que quepa sin scroll.
2. Revisar por segunda vez, con Antigravity, sobre la integración final, si se quiere un cierre formal de RUA.
3. A unos 800 × 600 px el HUD todavía tapa parte del modelo en algunos casos (pendiente de UA2-F1).
