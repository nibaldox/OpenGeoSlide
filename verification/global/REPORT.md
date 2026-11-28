# Búsqueda global no circular v0.7: medición de las compuertas de F7.7

Binario: `ogs 0.5.1`; commit base: `a66a1ba`; semilla 0 y `generated` 500 (los valores por defecto), salvo en A2b.
Modelos medidos: 55 (40 de X37 y 15 casos más con búsqueda no circular); errores: 0.
Generado por `verification/global/run.py`; los datos completos están en `REPORT.json`.

| Compuerta | Veredicto | Cifra |
|---|---|---|
| A1 | **PASA** | 0 diferencias en 202 modelos (variantes own, search, fixed, @0.4 y @0.6; 0 excepciones) y los 26 modelos con agua sobre el terreno, idénticos |
| A2 | **PASA** | V053 = 1.0103 (banda ≤ 1.0453); cSlope 1.0101 (0.02 %) |
| A2b | **PASA** | V053: 48/48 semillas, semilla 0 = 1.0103; S2 mediana 0.7611 |
| A3 | **PASA** | 15/15 checks; ninguno sobre su FS sin `global`: True |
| A4 | **PASA** | 38 ganadores del generador; sin notas de tracción; V051 = 0.7071; cSlope ≤ 0.10 % en 38 |
| A5 | **PASA** | 57/57 resultados ≤ sin `global`; `global` gana en 21 |
| A6 | **PASA** | 55/55 deterministas; 55/55 idénticos con `parallel` |
| A7 | **PASA** | razón de tiempo: mediana 1.56, máximo 3.81 (CPU: 1.56 / 3.81); WASM: razón máxima 2.83, FS igual al nativo a 1e-15 |
| A8 | **PASA** | 24 taludes; `evaluated` = 0 en 1: TAL-H30-b60-f35-c5; `eligible` = 0 en 3 |
| A9 | **PASA** | recocido: 31/40 iguales al prototipo original a 1e-6; 40/40 con el alineado a las reglas del contrato |
| A10 | **PASA** | todo en verde (CM-M2: 827 tests de ogs-core, 356/356 checks del harness, tsc y vitest 4922) |

## A2 · V053

V053 con `global: {}` en [0.97470, 1.04530] y cSlope en la polilínea ganadora a ±1 %.

| Medida | Valor |
|---|---|
| FS del refinamiento (sin `global`) | 1.084738 |
| FS con `global: {}` | 1.010300 |
| cSlope en la polilínea ganadora | 1.010095 |
| diferencia con cSlope | 0.020 % |
| contadores | {"algorithm": "block", "generated": 500, "attempts": 3252, "converged": 203, "eligible": 203, "tension_rejected": 0, "refined": 1, "evaluated": 3349, "polish_evaluated": 659, "global_fos": 1.0103002234001155, "winner": "global"} |

Veredicto: **PASA**.

## A2b · robustez frente a la semilla (48 semillas, 0 a 47)

V053 pasa la banda con la semilla 0 y con al menos 44 de las semillas 0 a 47.

| Modelo | Mínimo | Mediana | Máximo | Semilla 0 | En la banda | Gana `global` |
|---|---|---|---|---|---|---|
| V053 | 1.002888 | 1.007710 | 1.023919 | 1.010300 | 48/48 | 48/48 |
| S2 | 0.741643 | 0.761091 | 0.805075 | 0.750513 | — | 48/48 |

Veredicto: **PASA**.

## A3 · los 15 checks no circulares

los 15 checks no circulares con `global: {}`: criterio de un lado y ninguno por encima de su FS sin `global`.

| Caso | Método | Publicado | Límite | Sin `global` | Con `global` | Pasa | No sube |
|---|---|---|---|---|---|---|---|
| V036c | spencer | 1.018 | 1.0389 | 1.0156 | 1.0156 | sí | sí |
| V036d | spencer | 1.116 | 1.1388 | 1.1200 | 1.1200 | sí | sí |
| V039 | spencer | 1.167 | 1.1908 | 1.1596 | 1.1596 | sí | sí |
| V039 | spencer | 1.16 | 1.1882 | 1.1596 | 1.1596 | sí | sí |
| V041a | spencer | 1.592 | 1.6243 | 1.5901 | 1.5899 | sí | sí |
| V041b | spencer | 1.59 | 1.6268 | 1.5892 | 1.5886 | sí | sí |
| V051 | spencer | 0.707 | 0.7216 | 0.7071 | 0.7071 | sí | sí |
| V053 | spencer | 1.01 | 1.0453 | 1.0847 | 1.0103 | sí | sí |
| V098 | spencer | 1.36 | 1.3922 | 1.3571 | 1.3571 | sí | sí |
| V002-nc | spencer | 0.414 | 0.4228 | 0.3864 | 0.3864 | sí | sí |
| V001-nc | spencer | 1.386 | 1.4142 | 1.3839 | 1.3839 | sí | sí |
| V026-nc | spencer | 1.19 | 1.2188 | 1.1731 | 1.1731 | sí | sí |
| V033-nc | spencer | 1.534 | 1.5652 | 1.5236 | 1.5236 | sí | sí |
| V034a-nc | spencer | 1.262 | 1.2877 | 1.2650 | 1.2650 | sí | sí |
| V034b-nc | spencer | 1.182 | 1.2061 | 1.1705 | 1.1705 | sí | sí |

Veredicto: **PASA**.

## A4 · guarda de tracción

ninguna polilínea ganadora del generador con negative_lambda ni negative_effective_normal_major; V051 ≥ 0,69; cSlope a ±2 %.

«FS reeval.» es la polilínea ganadora evaluada como superficie fija en `ogs`; sus notas se miran contra `negative_lambda` y `negative_effective_normal_major`. Solo hay polilínea del generador en los modelos donde gana `global`.

| Modelo | FS global | FS reeval. | cSlope | Dif. | Notas de tracción |
|---|---|---|---|---|---|
| V041a | 1.5899 | 1.5899 | 1.5911 | 0.07 % | ninguna |
| V041b | 1.5886 | 1.5886 | 1.5901 | 0.10 % | ninguna |
| V053 | 1.0103 | 1.0103 | 1.0101 | 0.02 % | ninguna |
| S2 | 0.7505 | 0.7505 | 0.7506 | 0.01 % | ninguna |
| TAL-H10-b30-f20-c30 | 2.0695 | 2.0695 | 2.0695 | 0.00 % | ninguna |
| TAL-H10-b30-f35-c5 | 1.6827 | 1.6827 | 1.6827 | 0.00 % | ninguna |
| TAL-H10-b45-f35-c5 | 1.1250 | 1.1250 | 1.1250 | 0.00 % | ninguna |
| TAL-H10-b60-f20-c5 | 0.5253 | 0.5253 | 0.5253 | 0.00 % | ninguna |
| TAL-H10-b60-f35-c5 | 0.8035 | 0.8035 | 0.8035 | 0.00 % | ninguna |
| TAL-H30-b30-f20-c5 | 0.8102 | 0.8102 | 0.8102 | 0.00 % | ninguna |
| TAL-H30-b30-f20-c30 | 1.2629 | 1.2629 | 1.2630 | 0.00 % | ninguna |
| TAL-H30-b30-f35-c5 | 1.4339 | 1.4339 | 1.4339 | 0.00 % | ninguna |
| TAL-H30-b45-f35-c5 | 0.9047 | 0.9047 | 0.9047 | 0.00 % | ninguna |
| TAL-H30-b60-f20-c5 | 0.3670 | 0.3670 | 0.3670 | 0.00 % | ninguna |
| V041a-nc (otro caso) | 1.5899 | 1.5899 | 1.5911 | 0.07 % | ninguna |
| V041b-nc (otro caso) | 1.5886 | 1.5886 | 1.5901 | 0.10 % | ninguna |
| V050b (otro caso) | 1.2371 | 1.2371 | 1.2377 | 0.05 % | ninguna |
| V093-nc (otro caso) | 1.3251 | 1.3251 | 1.3251 | 0.00 % | ninguna |
| V093-nc (otro caso) · janbu_simplified | 1.1775 | 1.1775 | 1.1774 | 0.00 % | ninguna |
| V102a-nc (otro caso) | 0.9980 | 0.9980 | 0.9980 | 0.00 % | ninguna |
| V103 (otro caso) | 1.0081 | 1.0081 | 1.0081 | 0.00 % | ninguna |
| V053 · janbu_simplified | 0.8503 | 0.8503 | 0.8501 | 0.02 % | ninguna |
| V053 · janbu_corrected | 0.9242 | 0.9242 | 0.9238 | 0.04 % | ninguna |
| V053 · morgenstern_price/half_sine | 0.9919 | 0.9919 | 0.9918 | 0.01 % | ninguna |
| V053 · morgenstern_price/trapezoidal | 1.0155 | 1.0155 | 1.0153 | 0.02 % | ninguna |
| V053 · morgenstern_price/data_points | 0.9912 | 0.9912 | 0.9912 | 0.00 % | ninguna |
| S2 · janbu_simplified | 0.6884 | 0.6884 | 0.6884 | 0.00 % | ninguna |
| S2 · janbu_corrected | 0.7445 | 0.7445 | 0.7444 | 0.02 % | ninguna |
| S2 · morgenstern_price/half_sine | 0.7465 | 0.7465 | 0.7465 | 0.01 % | ninguna |
| S2 · morgenstern_price/trapezoidal | 0.7465 | 0.7465 | 0.7465 | 0.01 % | ninguna |
| S2 · morgenstern_price/data_points | 0.7465 | 0.7465 | 0.7465 | 0.01 % | ninguna |
| V001-nc · janbu_corrected | 1.3449 | 1.3449 | 1.3449 | 0.00 % | ninguna |
| V001-nc · morgenstern_price/half_sine | 1.3666 | 1.3666 | 1.3665 | 0.00 % | ninguna |
| V001-nc · morgenstern_price/trapezoidal | 1.3714 | 1.3714 | 1.3714 | 0.00 % | ninguna |
| V001-nc · morgenstern_price/data_points | 1.3651 | 1.3651 | 1.3651 | 0.00 % | ninguna |
| V041a · janbu_simplified | 1.4684 | 1.4684 | 1.4685 | 0.01 % | ninguna |
| V041a · morgenstern_price/trapezoidal | 1.5815 | 1.5815 | 1.5828 | 0.08 % | ninguna |
| V041a · morgenstern_price/data_points | 1.5756 | 1.5756 | 1.5769 | 0.08 % | ninguna |

V051 con `global`: 0.7071 (mínimo 0,69). Métodos recorridos: janbu_corrected, janbu_simplified, morgenstern_price/data_points, morgenstern_price/half_sine, morgenstern_price/trapezoidal, spencer. Janbu y Morgenstern-Price: 20 corridas, 17 con ganador del generador.

Advertencias de cSlope: ninguna (las 38 polilíneas ganadoras tienen FS de cSlope).

Veredicto: **PASA**.

## A5 · monotonía

FS con `global` ≤ FS sin `global` en los 40 modelos y en los demás casos con búsqueda no circular.

| Caso | Grupo | Método | Circular | Sin `global` | Con `global` | Ganador | ≤ |
|---|---|---|---|---|---|---|---|
| V036c | publicado | spencer | 1.0287 | 1.015571 | 1.015571 | refinement | sí |
| V036d | publicado | spencer | 1.1317 | 1.119974 | 1.119974 | refinement | sí |
| V039 | publicado | spencer | 1.4497 | 1.159586 | 1.159586 | refinement | sí |
| V041a | publicado | spencer | 1.5958 | 1.590085 | 1.589911 | global | sí |
| V041b | publicado | spencer | 1.5953 | 1.589187 | 1.588552 | global | sí |
| V051 | publicado | spencer | 1.0977 | 0.707126 | 0.707126 | refinement | sí |
| V053 | publicado | spencer | 1.0917 | 1.084738 | 1.010300 | global | sí |
| V098 | publicado | spencer | 1.3724 | 1.357063 | 1.357063 | refinement | sí |
| V002-nc | publicado | spencer | 0.4020 | 0.386433 | 0.386433 | refinement | sí |
| V001-nc | promovido | spencer | 1.4021 | 1.383876 | 1.383876 | refinement | sí |
| V026-nc | promovido | spencer | 1.1965 | 1.173144 | 1.173144 | refinement | sí |
| V033-nc | promovido | spencer | 1.5336 | 1.523649 | 1.523649 | refinement | sí |
| V034a-nc | promovido | spencer | 1.2768 | 1.264982 | 1.264982 | refinement | sí |
| V034b-nc | promovido | spencer | 1.3286 | 1.170548 | 1.170548 | refinement | sí |
| S1 | sintetico | spencer | 1.3754 | 1.108365 | 1.108365 | refinement | sí |
| S2 | sintetico | spencer | 0.9690 | 0.849868 | 0.750513 | global | sí |
| TAL-H10-b30-f20-c5 | talud | spencer | 1.0206 | 1.016264 | 1.016264 | refinement | sí |
| TAL-H10-b30-f20-c30 | talud | spencer | 2.0931 | 2.072533 | 2.069544 | global | sí |
| TAL-H10-b30-f35-c5 | talud | spencer | 1.6904 | 1.682977 | 1.682684 | global | sí |
| TAL-H10-b30-f35-c30 | talud | spencer | 2.9164 | 2.899471 | 2.899471 | refinement | sí |
| TAL-H10-b45-f20-c5 | talud | spencer | 0.7105 | 0.707269 | 0.707269 | refinement | sí |
| TAL-H10-b45-f20-c30 | talud | spencer | 1.6327 | 1.408093 | 1.408093 | refinement | sí |
| TAL-H10-b45-f35-c5 | talud | spencer | 1.1290 | 1.125185 | 1.124970 | global | sí |
| TAL-H10-b45-f35-c30 | talud | spencer | 2.1940 | 2.056063 | 2.056063 | refinement | sí |
| TAL-H10-b60-f20-c5 | talud | spencer | 0.5284 | 0.525347 | 0.525305 | global | sí |
| TAL-H10-b60-f20-c30 | talud | spencer | 1.4331 | 1.199379 | 1.199379 | refinement | sí |
| TAL-H10-b60-f35-c5 | talud | spencer | 0.8074 | 0.803565 | 0.803477 | global | sí |
| TAL-H10-b60-f35-c30 | talud | spencer | 1.7492 | 1.529522 | 1.529522 | refinement | sí |
| TAL-H30-b30-f20-c5 | talud | spencer | 0.8139 | 0.810305 | 0.810243 | global | sí |
| TAL-H30-b30-f20-c30 | talud | spencer | 1.2691 | 1.263332 | 1.262947 | global | sí |
| TAL-H30-b30-f35-c5 | talud | spencer | 1.4399 | 1.434038 | 1.433912 | global | sí |
| TAL-H30-b30-f35-c30 | talud | spencer | 1.9841 | 1.975875 | 1.975875 | refinement | sí |
| TAL-H30-b45-f20-c5 | talud | spencer | 0.5300 | 0.528130 | 0.528130 | refinement | sí |
| TAL-H30-b45-f20-c30 | talud | spencer | 0.9261 | 0.918782 | 0.918782 | refinement | sí |
| TAL-H30-b45-f35-c5 | talud | spencer | 0.9079 | 0.904742 | 0.904694 | global | sí |
| TAL-H30-b45-f35-c30 | talud | spencer | 1.3848 | 1.378329 | 1.378329 | refinement | sí |
| TAL-H30-b60-f20-c5 | talud | spencer | 0.3683 | 0.367001 | 0.366983 | global | sí |
| TAL-H30-b60-f20-c30 | talud | spencer | 0.7146 | 0.656090 | 0.656090 | refinement | sí |
| TAL-H30-b60-f35-c5 | talud | spencer | 0.6060 | 0.605985 | 0.605985 | refinement | sí |
| TAL-H30-b60-f35-c30 | talud | spencer | 1.0304 | 1.025968 | 1.025968 | refinement | sí |
| V036a-nc | otro caso | spencer | — | 0.736582 | 0.736582 | refinement | sí |
| V036c-nc | otro caso | spencer | — | 1.015571 | 1.015571 | refinement | sí |
| V036d-nc | otro caso | spencer | — | 1.119974 | 1.119974 | refinement | sí |
| V041a-nc | otro caso | spencer | — | 1.590085 | 1.589911 | global | sí |
| V041b-nc | otro caso | spencer | — | 1.589187 | 1.588552 | global | sí |
| V050b | otro caso | spencer | — | 1.238799 | 1.237121 | global | sí |
| V059a | otro caso | spencer | — | 1.214494 | 1.214494 | refinement | sí |
| V059b | otro caso | spencer | — | 1.289778 | 1.289778 | refinement | sí |
| V059c | otro caso | spencer | — | 1.314757 | 1.314757 | refinement | sí |
| V093-nc | otro caso | spencer | — | 1.325280 | 1.325070 | global | sí |
| V093-nc | otro caso | janbu_simplified | — | 1.177594 | 1.177452 | global | sí |
| V094 | otro caso | spencer | — | 1.399684 | 1.399684 | refinement | sí |
| V094 | otro caso | morgenstern_price | — | 1.391303 | 1.391303 | refinement | sí |
| V098-nc | otro caso | spencer | — | 1.357063 | 1.357063 | refinement | sí |
| V102a-nc | otro caso | spencer | — | 0.998021 | 0.997978 | global | sí |
| V102b-nc | otro caso | spencer | — | 0.996632 | 0.996632 | refinement | sí |
| V103 | otro caso | spencer | — | 1.008067 | 1.008062 | global | sí |

Veredicto: **PASA**.

## A6 · determinismo

tres corridas iguales byte a byte y la misma salida con el binario `--features parallel`.

55/55 modelos con tres corridas idénticas; 55/55 con salida idéntica en el binario `parallel`. Veredicto: **PASA**.

## A7 · costo (nativo)

tiempo con `global` (N = 500) ≤ 4 × el circular, mediana de 3 corridas por modelo (nativo).

Razón global/circular por modelo: mediana 1.56, máximo 3.81 (tiempo de CPU: mediana 1.56, máximo 3.81). La columna «Refinamiento» es la razón del refinamiento de v0.6 sin `global`, para ver cuánto agrega la etapa global.

| Modelo | Circular (s) | Global (s) | Razón | Razón CPU | Refinamiento |
|---|---|---|---|---|---|
| V036c | 0.204 | 0.703 | 3.44 | 3.45 | 2.63 |
| V036d | 0.226 | 0.702 | 3.10 | 3.10 | 2.42 |
| V039 | 0.417 | 1.229 | 2.95 | 2.95 | 2.29 |
| V041a | 0.497 | 1.359 | 2.73 | 2.73 | 2.01 |
| V041b | 0.546 | 0.965 | 1.77 | 1.77 | 1.32 |
| V051 | 0.327 | 1.087 | 3.33 | 3.33 | 2.45 |
| V053 | 0.349 | 0.989 | 2.84 | 2.84 | 1.91 |
| V098 | 0.214 | 0.568 | 2.65 | 2.65 | 2.15 |
| V002-nc | 0.312 | 0.685 | 2.20 | 2.20 | 1.74 |
| V001-nc | 0.185 | 0.543 | 2.93 | 2.93 | 2.31 |
| V026-nc | 0.187 | 0.714 | 3.81 | 3.81 | 2.91 |
| V033-nc | 0.280 | 0.796 | 2.84 | 2.84 | 2.17 |
| V034a-nc | 0.246 | 0.772 | 3.13 | 3.14 | 2.50 |
| V034b-nc | 0.241 | 0.857 | 3.56 | 3.56 | 2.88 |
| S1 | 0.319 | 0.681 | 2.14 | 2.14 | 1.75 |
| S2 | 0.316 | 0.616 | 1.95 | 1.95 | 1.61 |
| TAL-H10-b30-f20-c5 | 0.321 | 0.438 | 1.37 | 1.37 | 1.16 |
| TAL-H10-b30-f20-c30 | 0.331 | 0.886 | 2.67 | 2.68 | 1.84 |
| TAL-H10-b30-f35-c5 | 0.321 | 0.477 | 1.49 | 1.49 | 1.14 |
| TAL-H10-b30-f35-c30 | 0.322 | 0.629 | 1.96 | 1.96 | 1.70 |
| TAL-H10-b45-f20-c5 | 0.326 | 0.439 | 1.35 | 1.35 | 1.15 |
| TAL-H10-b45-f20-c30 | 0.315 | 0.495 | 1.57 | 1.57 | 1.35 |
| TAL-H10-b45-f35-c5 | 0.329 | 0.442 | 1.34 | 1.34 | 1.14 |
| TAL-H10-b45-f35-c30 | 0.315 | 0.485 | 1.54 | 1.54 | 1.34 |
| TAL-H10-b60-f20-c5 | 0.319 | 0.439 | 1.38 | 1.38 | 1.15 |
| TAL-H10-b60-f20-c30 | 0.321 | 0.471 | 1.47 | 1.47 | 1.31 |
| TAL-H10-b60-f35-c5 | 0.322 | 0.440 | 1.37 | 1.37 | 1.15 |
| TAL-H10-b60-f35-c30 | 0.315 | 0.423 | 1.34 | 1.34 | 1.34 |
| TAL-H30-b30-f20-c5 | 0.328 | 0.444 | 1.36 | 1.36 | 1.14 |
| TAL-H30-b30-f20-c30 | 0.318 | 0.570 | 1.79 | 1.79 | 1.35 |
| TAL-H30-b30-f35-c5 | 0.326 | 0.479 | 1.47 | 1.47 | 1.15 |
| TAL-H30-b30-f35-c30 | 0.318 | 0.429 | 1.35 | 1.35 | 1.15 |
| TAL-H30-b45-f20-c5 | 0.337 | 0.458 | 1.36 | 1.36 | 1.15 |
| TAL-H30-b45-f20-c30 | 0.315 | 0.431 | 1.37 | 1.37 | 1.16 |
| TAL-H30-b45-f35-c5 | 0.332 | 0.449 | 1.35 | 1.35 | 1.14 |
| TAL-H30-b45-f35-c30 | 0.321 | 0.434 | 1.35 | 1.35 | 1.15 |
| TAL-H30-b60-f20-c5 | 0.320 | 0.439 | 1.37 | 1.37 | 1.16 |
| TAL-H30-b60-f20-c30 | 0.319 | 0.429 | 1.34 | 1.34 | 1.35 |
| TAL-H30-b60-f35-c5 | 0.324 | 0.324 | 1.00 | 1.00 | 1.00 |
| TAL-H30-b60-f35-c30 | 0.323 | 0.438 | 1.35 | 1.35 | 1.15 |

Peor caso: V026-nc con 3.81×; margen frente al tope de 4×: 0.19 (4.8 % del tope).

WASM (el motor compilado a `wasm32-unknown-unknown`, corrido en V8 de Node; no es Chrome): tiempo de V053 y S2 con y sin `global` y FS contra el nativo.

| Modelo | WASM circular (s) | WASM global (s) | Razón WASM | Nativo circular (s) | Nativo global (s) | FS nativo | FS WASM | Dif. | Salida idéntica |
|---|---|---|---|---|---|---|---|---|---|
| V053 | 0.422 | 1.196 | 2.83 | 0.349 | 0.989 | 1.010300223400 | 1.010300223400 | 1.3e-15 | no |
| S2 | 0.385 | 0.754 | 1.96 | 0.316 | 0.616 | 0.750512538651 | 0.750512538651 | 4.4e-16 | no |

Veredicto nativo: **PASA**.

## A8 · barrido de 24 taludes

en los 24 taludes `global` no empeora ninguno, `evaluated` > 0 en al menos 23 y no hay avisos nuevos fuera de F7.2 (E17a).

| Talud | Sin `global` | Con `global` | Algoritmo | Evaluaciones | Elegibles | Ganador | Avisos nuevos | Notas F7.2 |
|---|---|---|---|---|---|---|---|---|
| TAL-H10-b30-f20-c5 | 1.01626 | 1.01626 | annealing | 2211 | 500 | refinement | — | — |
| TAL-H10-b30-f20-c30 | 2.07253 | 2.06954 | annealing | 4064 | 500 | global | — | — |
| TAL-H10-b30-f35-c5 | 1.68298 | 1.68268 | annealing | 3385 | 500 | global | — | — |
| TAL-H10-b30-f35-c30 | 2.89947 | 2.89947 | annealing | 2211 | 500 | refinement | — | — |
| TAL-H10-b45-f20-c5 | 0.70727 | 0.70727 | annealing | 2211 | 500 | refinement | — | — |
| TAL-H10-b45-f20-c30 | 1.40809 | 1.40809 | annealing | 2211 | 484 | refinement | — | — |
| TAL-H10-b45-f35-c5 | 1.12518 | 1.12497 | annealing | 2211 | 500 | global | — | — |
| TAL-H10-b45-f35-c30 | 2.05606 | 2.05606 | annealing | 2211 | 493 | refinement | — | — |
| TAL-H10-b60-f20-c5 | 0.52535 | 0.52531 | annealing | 2211 | 498 | global | — | — |
| TAL-H10-b60-f20-c30 | 1.19938 | 1.19938 | annealing | 1798 | 318 | refinement | — | — |
| TAL-H10-b60-f35-c5 | 0.80356 | 0.80348 | annealing | 2211 | 500 | global | — | — |
| TAL-H10-b60-f35-c30 | 1.52952 | 1.52952 | annealing | 1 | 0 | refinement | — | non_circular_global_no_candidates |
| TAL-H30-b30-f20-c5 | 0.81030 | 0.81024 | annealing | 2211 | 500 | global | — | — |
| TAL-H30-b30-f20-c30 | 1.26333 | 1.26295 | annealing | 3242 | 500 | global | — | — |
| TAL-H30-b30-f35-c5 | 1.43404 | 1.43391 | annealing | 3132 | 500 | global | — | — |
| TAL-H30-b30-f35-c30 | 1.97588 | 1.97588 | annealing | 2211 | 500 | refinement | — | — |
| TAL-H30-b45-f20-c5 | 0.52813 | 0.52813 | annealing | 2211 | 500 | refinement | — | — |
| TAL-H30-b45-f20-c30 | 0.91878 | 0.91878 | annealing | 2211 | 500 | refinement | — | — |
| TAL-H30-b45-f35-c5 | 0.90474 | 0.90469 | annealing | 2211 | 500 | global | — | — |
| TAL-H30-b45-f35-c30 | 1.37833 | 1.37833 | annealing | 2211 | 500 | refinement | — | — |
| TAL-H30-b60-f20-c5 | 0.36700 | 0.36698 | annealing | 2211 | 500 | global | — | — |
| TAL-H30-b60-f20-c30 | 0.65609 | 0.65609 | annealing | 1 | 0 | refinement | — | non_circular_global_no_candidates |
| TAL-H30-b60-f35-c5 | 0.60599 | 0.60599 | annealing | 0 | 0 | refinement | — | non_circular_global_no_candidates |
| TAL-H30-b60-f35-c30 | 1.02597 | 1.02597 | annealing | 2211 | 495 | refinement | — | — |

`evaluated` = 0 en: TAL-H30-b60-f35-c5. `eligible` = 0 en: TAL-H10-b60-f35-c30, TAL-H30-b60-f20-c30, TAL-H30-b60-f35-c5 (sin candidato elegible no hay etapa global efectiva, aunque haya evaluaciones). Veredicto: **PASA**.

## A9 · paridad con el prototipo

el recocido de Rust da el mismo mejor candidato antes de refinar que `X37_proto/global.py` con la misma semilla y el mismo punto de partida (1e-6), o la diferencia se explica con una cifra; el bloque cambió en E17c y no tiene prototipo.

Se compara el mejor candidato generado antes de refinar (500 candidatos, semilla 0, mismo punto de partida: la polilínea del círculo semilla que eligió Rust). Prototipo: `gen_sa` sobre el wheel 0.5.1; Rust: la sonda `a9_probe` de `global.rs`. **Solo el recocido tiene paridad**: el bloque cambió en E17c (Halton rotado, proyecciones a 15°-75°) y no tiene prototipo.

Dos columnas de prototipo: «original» es `gen_sa` sin cambios; «alineado» es el mismo bucle con las dos reglas del contrato que el prototipo no tiene (la guarda de F7.4 y que un candidato rechazado cuenta como generado y adelanta el enfriamiento; `a9_proto.py`). La diferencia entre las dos es la explicación de cada fila que no coincide: los candidatos rechazados por la guarda y los que no convergen son los que el prototipo no cuenta como generados.
Coinciden con el prototipo original: 31/40.

| Modelo | Rust | Proto. original | Dif. | Proto. alineado | Dif. | Rechazados por la guarda | No convergidos | Índice (orig. / alin. / Rust) |
|---|---|---|---|---|---|---|---|---|
| V036c (recocido forzado) | 1.025336560 | 1.025336560 | 4.4e-16 | 1.025336560 | 4.4e-16 | 0 | 0 | 411 / 411 / 411 |
| V036d (recocido forzado) | 1.137596519 | 1.137596519 | 0.0e+00 | 1.137596519 | 0.0e+00 | 0 | 0 | 407 / 407 / 407 |
| V039 (recocido forzado) | 1.199185240 | 1.199185240 | 0.0e+00 | 1.199185240 | 0.0e+00 | 0 | 0 | 261 / 261 / 261 |
| V041a | 1.597917918 | 1.597917918 | 1.6e-15 | 1.597917918 | 1.6e-15 | 0 | 0 | 352 / 352 / 352 |
| V041b | 1.617012985 | 1.617310554 | 3.0e-04 | 1.617012985 | 0.0e+00 | 0 | 24 | 443 / 380 / 380 |
| V051 (recocido forzado) | 0.716194612 | 0.686026624 | 3.0e-02 | 0.716194612 | 0.0e+00 | 7 | 0 | 469 / 486 / 486 |
| V053 (recocido forzado) | 1.095600518 | 1.095600518 | 0.0e+00 | 1.095600518 | 0.0e+00 | 0 | 0 | 499 / 499 / 499 |
| V098 (recocido forzado) | 1.367361523 | 1.367361523 | 2.2e-16 | 1.367361523 | 2.2e-16 | 0 | 0 | 360 / 360 / 360 |
| V002-nc (recocido forzado) | 0.418790664 | 0.418790664 | 1.1e-16 | 0.418790664 | 1.1e-16 | 0 | 0 | 245 / 245 / 245 |
| V001-nc | 1.397817882 | 1.397817882 | 0.0e+00 | 1.397817882 | 0.0e+00 | 0 | 0 | 461 / 461 / 461 |
| V026-nc (recocido forzado) | 1.208014173 | 1.208014173 | 6.7e-16 | 1.208014173 | 6.7e-16 | 0 | 0 | 473 / 473 / 473 |
| V033-nc (recocido forzado) | 1.540026783 | 1.540026783 | 2.2e-16 | 1.540026783 | 2.2e-16 | 0 | 0 | 350 / 350 / 350 |
| V034a-nc (recocido forzado) | 1.290868840 | 1.290868840 | 0.0e+00 | 1.290868840 | 0.0e+00 | 0 | 0 | 499 / 499 / 499 |
| V034b-nc (recocido forzado) | 1.290757845 | 1.290757845 | 2.2e-16 | 1.290757845 | 2.2e-16 | 0 | 0 | 98 / 98 / 98 |
| S1 (recocido forzado) | 1.226114036 | 1.126975621 | 9.9e-02 | 1.226114036 | 0.0e+00 | 87 | 7 | 498 / 461 / 461 |
| S2 (recocido forzado) | 0.933604334 | 0.929660136 | 3.9e-03 | 0.933604334 | 0.0e+00 | 16 | 20 | 498 / 491 / 491 |
| TAL-H10-b30-f20-c5 | 1.022566272 | 1.022566272 | 0.0e+00 | 1.022566272 | 0.0e+00 | 0 | 0 | 456 / 456 / 456 |
| TAL-H10-b30-f20-c30 | 2.089990198 | 2.089990198 | 0.0e+00 | 2.089990198 | 0.0e+00 | 0 | 0 | 433 / 433 / 433 |
| TAL-H10-b30-f35-c5 | 1.691151007 | 1.691151007 | 0.0e+00 | 1.691151007 | 0.0e+00 | 0 | 0 | 349 / 349 / 349 |
| TAL-H10-b30-f35-c30 | 2.921924344 | 2.921924344 | 0.0e+00 | 2.921924344 | 0.0e+00 | 0 | 0 | 439 / 439 / 439 |
| TAL-H10-b45-f20-c5 | 0.712357947 | 0.712357947 | 0.0e+00 | 0.712357947 | 0.0e+00 | 0 | 0 | 306 / 306 / 306 |
| TAL-H10-b45-f20-c30 | 1.624512847 | 1.471222525 | 1.5e-01 | 1.624512847 | 0.0e+00 | 16 | 0 | 494 / 303 / 303 |
| TAL-H10-b45-f35-c5 | 1.130638708 | 1.130638708 | 0.0e+00 | 1.130638708 | 0.0e+00 | 0 | 0 | 254 / 254 / 254 |
| TAL-H10-b45-f35-c30 | 2.230997736 | 2.098350022 | 1.3e-01 | 2.230997736 | 0.0e+00 | 7 | 0 | 474 / 498 / 498 |
| TAL-H10-b60-f20-c5 | 0.538760279 | 0.539503317 | 7.4e-04 | 0.538760279 | 0.0e+00 | 2 | 0 | 302 / 184 / 184 |
| TAL-H10-b60-f20-c30 | 1.553878886 | 1.540495354 | 1.3e-02 | 1.553878886 | 0.0e+00 | 165 | 17 | 499 / 498 / 498 |
| TAL-H10-b60-f35-c5 | 0.808219579 | 0.808219579 | 1.1e-16 | 0.808219579 | 1.1e-16 | 0 | 0 | 421 / 421 / 421 |
| TAL-H10-b60-f35-c30 | — | — | 0.0e+00 | — | 0.0e+00 | 0 | 0 | None / None / None |
| TAL-H30-b30-f20-c5 | 0.813800027 | 0.813800027 | 0.0e+00 | 0.813800027 | 0.0e+00 | 0 | 0 | 380 / 380 / 380 |
| TAL-H30-b30-f20-c30 | 1.271575122 | 1.271575122 | 2.2e-16 | 1.271575122 | 2.2e-16 | 0 | 0 | 457 / 457 / 457 |
| TAL-H30-b30-f35-c5 | 1.439580474 | 1.439580474 | 0.0e+00 | 1.439580474 | 0.0e+00 | 0 | 0 | 483 / 483 / 483 |
| TAL-H30-b30-f35-c30 | 1.986319447 | 1.986319447 | 2.2e-16 | 1.986319447 | 2.2e-16 | 0 | 0 | 464 / 464 / 464 |
| TAL-H30-b45-f20-c5 | 0.530848352 | 0.530848352 | 0.0e+00 | 0.530848352 | 0.0e+00 | 0 | 0 | 10 / 10 / 10 |
| TAL-H30-b45-f20-c30 | 0.926003977 | 0.926003977 | 1.1e-16 | 0.926003977 | 1.1e-16 | 0 | 0 | 498 / 498 / 498 |
| TAL-H30-b45-f35-c5 | 0.908580187 | 0.908580187 | 1.1e-16 | 0.908580187 | 1.1e-16 | 0 | 0 | 209 / 209 / 209 |
| TAL-H30-b45-f35-c30 | 1.386632239 | 1.386632239 | 2.2e-16 | 1.386632239 | 2.2e-16 | 0 | 0 | 313 / 313 / 313 |
| TAL-H30-b60-f20-c5 | 0.369178763 | 0.369178763 | 0.0e+00 | 0.369178763 | 0.0e+00 | 0 | 0 | 419 / 419 / 419 |
| TAL-H30-b60-f20-c30 | — | — | 0.0e+00 | — | 0.0e+00 | 0 | 0 | None / None / None |
| TAL-H30-b60-f35-c5 | — | — | 0.0e+00 | — | 0.0e+00 | 0 | 0 | None / None / None |
| TAL-H30-b60-f35-c30 | 1.048282916 | 1.014849629 | 3.3e-02 | 1.048282916 | 0.0e+00 | 5 | 0 | 451 / 163 / 163 |

Bloque (informativo, sin exigencia): el mejor de 500 del prototipo original (F7.3.2 sin E17c) contra el de Rust (E17c).

| Modelo | Prototipo original | Rust (E17c) |
|---|---|---|
| V036c | 1.842383 | 1.516116 |
| V036d | 1.842383 | 1.516116 |
| V039 | 2.566431 | 1.482238 |
| V051 | 0.731145 | 0.770347 |
| V053 | 1.380334 | 1.049908 |
| V098 | 2.898190 | 1.544857 |
| V002-nc | 0.496078 | 0.448488 |
| V026-nc | 2.351436 | 1.789316 |
| V033-nc | 1.986028 | 1.932909 |
| V034a-nc | 2.483247 | 1.774262 |
| V034b-nc | 3.019613 | 2.100034 |
| S1 | 1.432964 | 1.264668 |
| S2 | 0.766697 | 0.808734 |

Veredicto: **PASA**.

## Reproductores de la revisión adversarial (RCM-A), antes → después

«Antes» es el binario de CM-M (`1399813`, tope de 60 s); «después» es el binario de esta corrida (tope de 120 s). Los modelos están en `verification/global/repro/`.

| Reproductor | Antes | Después | Pasa |
|---|---|---|---|
| 01_project_hang | > 60 s (sin terminar) | FS 1.2705; block; 33 vért.; tension_rejected 8; 0.35 s | sí |
| 02_max_vertices_9 | FS 1.0103; block; 33 vért.; tension_rejected 0; 0.80 s | FS 1.0194; block; 9 vért.; tension_rejected 0; 0.60 s | sí |
| 03_all_hb_auto_bases | FS 7.0198; block; 33 vért.; tension_rejected 0; 6.31 s | FS 7.0198; block; 33 vért.; tension_rejected 20; 4.91 s; non_circular_global_tension_rejected | sí |
| 04_tension_note_zero_count | FS 0.7071; annealing; 33 vért.; tension_rejected 0; 0.98 s; non_circular_global_tension_rejected | FS 0.7071; annealing; 33 vért.; tension_rejected 0; 0.97 s; non_circular_global_tension_rejected | sí |
| 05_global_array | FS 1.3839; block; 33 vért.; tension_rejected 0; 0.43 s; non_circular_global_no_candidates | error: ogs: InvalidModel: el documento no coincide con el esquema:  | sí |
| 06_v053_shansep_layer4 | FS 1.0844; annealing; 33 vért.; tension_rejected 0; 0.99 s | FS 0.7563; block; 33 vért.; tension_rejected 7; 1.07 s | sí |
| 06_v053_hoek_brown_layer4 | FS 1.0844; annealing; 33 vért.; tension_rejected 0; 0.86 s | FS 0.7724; block; 33 vért.; tension_rejected 2; 2.03 s | sí |

El reproductor 01 sin `global` (v0.6) tarda 0.17 s.

## Antes → después (cifras de las compuertas)

«Antes»: `1399813` (CM-M, relevo de Sonnet).

| Cifra | Antes | Después |
|---|---|---|
| V053 con `global: {}` | 1.0103 | 1.0103 |
| V053 semillas en la banda (de 48) | 48 | 48 |
| V053 mediana de 48 semillas | 1.0077 | 1.0077 |
| S2 mediana de 48 semillas | 0.7588 | 0.7611 |
| checks que pasan (de 15) | 15 | 15 |
| polilíneas ganadoras evaluadas en cSlope | 14 | 38 |
| máxima diferencia con cSlope | 0.0010 | 0.0010 |
| resultados con global ≤ sin global | 52 | 57 |
| gana `global` | 19 | 21 |
| razón máxima de costo | 3.8102 | 3.8074 |
| razón mediana de costo | 1.5517 | 1.5552 |
| taludes con `evaluated` = 0 | 1 | 1 |

## A1

- `--include-v06` (CM-M): el binario base v0.5.1 lee la versión 0.6, así que los modelos con campos v0.6 entran a la comparación.
- `without_global` (CM-M2): `verification/cases` trae ahora V053 en versión 0.7 y con `global`, que el binario base no lee. La identidad compara cada documento 0.7 sin `global` y como 0.6 (F7.0: sin `global`, la salida es la de 0.6). Sin ese cambio daba 3 diferencias en V053 (`own`, `search` y `search@0.6`: el base rechaza la versión 0.7).
- Con el comando literal del brief (sin `--include-v06`) quedan saltados aparte los modelos con campos v0.6.

## A10

| Puerta | Resultado |
|---|---|
| `cargo fmt --all --check` | sin diferencias |
| `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings` | sin avisos |
| `cargo test -p ogs-core --release` | 827 pasan, 0 fallan, 3 ignorados |
| `cargo test -p ogs-core --release --features parallel` | 827 pasan, 0 fallan, 3 ignorados |
| aceptación (`--test acceptance`) | 3 pasan; 356 checks, 0 fallas |
| `cargo test -p ogs-cli --release` | 8 pasan |
| `pytest verification/tools` (con `OGS_BIN`) | 767 pasan, 1 omitido |
| harness (`verification/harness/run.py`, 175 casos) | 356/356 OK; cSlope reproduce 355/356 (igual que antes) |
| batería diferencial (`--include-f3b`) | búsqueda 28/28, fija 28/28, F3B 41 OK + 1 explicado (igual que antes) |
| `pytest verification/harness verification/differential` | 798 pasan |
| wheel (`maturin build --release`, instalación, `pytest tests`) | 373 pasan, 2 omitidos |
| `tsc --noEmit` (`apps/web`) | sin errores |
| vitest (`apps/web`) | 289 archivos, 4922 pasan, 3 omitidos |

Antes (CM-M, `1399813`): 809 tests de ogs-core, 347 checks, 763 en `verification/tools`, 796 en harness y diferencial, 371 en el wheel.
Los tests que cambian por E17e: los mensajes de rango de `global` (`ogsJson.v07.test.ts`, `validateLocal.v07.test.ts`), que ahora dicen `[0, 9007199254740991]` en vez de `[0, 2^53 - 1]`.

