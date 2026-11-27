# Cierre del bloque UA: rediseño «A · Flujo de trabajo» (27-nov-2026)

Rama `ua-integracion`, sobre v0.5.0 (`69d0413`); sin push ni merge a `main`. Contrato: `briefs/UA_CONTRATO.md`, con
UA-E1 y UA-E2. Arbitraje de la revisión adversarial: `briefs/ARBITRAJE_RUA.md`, con UA-E3 a UA-E5.

## Olas

| Ola | Qué hizo | Escritores |
|---|---|---|
| XA | Exploración: armazón actual, línea base en Chrome, contrato de tests y e2e, medidas de la maqueta | 4 × Haiku |
| UA1 | Tokens v1.1, tema oscuro por defecto, fuentes locales e ícono; armazón A; modelo puro; paleta y encuadre; HUD y piel de los componentes; guion de aceptación A01-A17 | 6 × Sonnet |
| UA2 | Encuadre que deja libre el HUD, ▾ → SVG, objetivos de clic ≥ 24, tooltips, tabla, móvil (UA2-F); migración de los guiones e2e (UA2-E) | 2 × Sonnet |
| RUA | Revisión adversarial con Antigravity (gemini-4-neon-high), dos lentes: A dio NO APTO y B, APTO CON CORRECCIONES | agy |
| UA3 | Corrección de los hallazgos de RUA (arbitraje): armazón y estado (C1); modelo, HUD, tokens y lienzo (C2) | 2 × Sonnet |
| UA4 | Pie de acción móvil en una fila, lienzo móvil adaptable y `.gp-check` de 24 px | Sonnet |

## Puertas en `f5214dc`

- **typecheck y build:** en verde; el precache de la PWA lleva 23 archivos, con las fuentes Outfit y JetBrains Mono.
- **vitest:** 263 archivos de test pasados y 9 saltados; 4315 tests pasados y 320 saltados. En v0.5.0 eran 233 y 3816.
- **Aceptación** (`docs/suite-a/e2e/aceptacion_ua.mjs`): 17/17 y 0 errores de consola. En v0.5.0 daba 5/17.
- **Regresión e2e completa:** 50 guiones, OK=1224, FAIL=4, no_ok=0. En v0.5.0 daba OK=1223, FAIL=3.
  - Siguen igual que en la base: `u3o_onboarding` 6, `u6d_drafts` R9-11a, y la salida en `exit=1` por la descarga de
    `w1e_polilinea` y `r2i2_tablestaca_inclinada`.
  - Ya no falla: `u4p_polish` 4d.
  - **Falla nueva, abierta:** `u6k_axe` en `light-320` y `dark-320` («lienzo con piezométrica extrapolada»). axe da
    `target-size` en «Agregar vértice» y «Dibujar región», porque a 320 × 844, con el aviso de archivo abierto y la
    línea de avisos del HUD, la segunda fila de la paleta queda bajo el pie fijo a scroll 0. La altura del lienzo
    móvil de UA4 (`100dvh - 530px`) no cuenta los avisos ni el alto variable del HUD.
    - Medido con `measure_mobile.mjs`: la paleta ocupa y = 806-905 y el pie, 787-844.
    - Corrección propuesta: medir la altura disponible con JS (`ResizeObserver` sobre la columna móvil), o llevar las
      herramientas encima del lienzo en móvil, para que lo que cruce el borde del pie no sea interactivo.

## Pendiente para otra ola

1. La falla de `u6k_axe` a 320 px (arriba).
2. Revisar por segunda vez, con Antigravity, sobre `f5214dc`, si se quiere un cierre formal de RUA.
3. Hacer el merge a `main` y el release cuando el usuario apruebe el diseño.
