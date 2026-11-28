# Búsqueda global no circular v0.7: medición de las compuertas de F7.7

Binario: `ogs 0.5.1`; commit base: `9f7d842`; semilla 0 y `generated` 500 (los valores por defecto), salvo en A2b.
Modelos medidos: 50 (40 de X37 y 10 casos más con búsqueda no circular); errores: 0.
Generado por `verification/global/run.py`; los datos completos están en `REPORT.json`.

| Compuerta | Veredicto | Cifra |
|---|---|---|
| A1 | **PASA** | 0 diferencias en 196 modelos (variantes own, search, fixed, @0.4 y @0.6; 0 excepciones) y los 24 modelos con agua sobre el terreno, idénticos |
| A2 | **PASA** | V053 = 1.0103 (banda ≤ 1.0453); cSlope 1.0101 (0.02 %) |
| A2b | **PASA** | V053: 48/48 semillas, semilla 0 = 1.0103; S2 mediana 0.7588 |
| A3 | **PASA** | 15/15 checks; ninguno sobre su FS sin `global`: True |
| A4 | **PASA** | 14 ganadores del generador; sin notas de tracción; V051 = 0.7071; cSlope ≤ 0.10 % en 14 |
| A5 | **PASA** | 52/52 resultados ≤ sin `global`; `global` gana en 19 |
| A6 | **PASA** | 50/50 deterministas; 50/50 idénticos con `parallel` |
| A7 | **PASA** | razón de tiempo: mediana 1.55, máximo 3.81 (CPU: 1.55 / 3.81); WASM: razón máxima 2.87, FS igual al nativo a 7e-16 |
| A8 | **PASA** | 24 taludes; `evaluated` = 0 en 1: TAL-H30-b60-f35-c5 |
| A9 | **PASA** | recocido: 31/40 iguales al prototipo original a 1e-6; 40/40 con el alineado a las reglas del contrato |
| A10 | **PASA** | todo en verde; falta vitest y el build de `apps/web` (de otro escritor, no se corrieron aquí) |

## A2 · V053

V053 con `global: {}` en [0.97470, 1.04530] y cSlope en la polilínea ganadora a ±1 %.

| Medida | Valor |
|---|---|
| FS del refinamiento (sin `global`) | 1.084738 |
| FS con `global: {}` | 1.010300 |
| cSlope en la polilínea ganadora | 1.010095 |
| diferencia con cSlope | 0.020 % |
| contadores | {"algorithm": "block", "generated": 500, "attempts": 3259, "converged": 202, "eligible": 202, "tension_rejected": 0, "refined": 1, "evaluated": 3349, "polish_evaluated": 659, "global_fos": 1.010300223400116, "winner": "global"} |

Veredicto: **PASA**.

## A2b · robustez frente a la semilla (48 semillas, 0 a 47)

V053 pasa la banda con la semilla 0 y con al menos 44 de las semillas 0 a 47.

| Modelo | Mínimo | Mediana | Máximo | Semilla 0 | En la banda | Gana `global` |
|---|---|---|---|---|---|---|
| V053 | 1.002888 | 1.007710 | 1.023919 | 1.010300 | 48/48 | 48/48 |
| S2 | 0.741643 | 0.758849 | 0.805075 | 0.750513 | — | 48/48 |

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

V051 con `global`: 0.7071 (mínimo 0,69). Veredicto: **PASA**.

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
| V050b | otro caso | spencer | — | 1.238799 | 1.237121 | global | sí |
| V059a | otro caso | spencer | — | 1.214494 | 1.214494 | refinement | sí |
| V059b | otro caso | spencer | — | 1.289778 | 1.289778 | refinement | sí |
| V059c | otro caso | spencer | — | 1.314757 | 1.314757 | refinement | sí |
| V093-nc | otro caso | spencer | — | 1.325280 | 1.325070 | global | sí |
| V093-nc | otro caso | janbu_simplified | — | 1.177594 | 1.177452 | global | sí |
| V094 | otro caso | spencer | — | 1.399684 | 1.399684 | refinement | sí |
| V094 | otro caso | morgenstern_price | — | 1.391303 | 1.391303 | refinement | sí |
| V102a-nc | otro caso | spencer | — | 0.998021 | 0.997978 | global | sí |
| V102b-nc | otro caso | spencer | — | 0.996632 | 0.996632 | refinement | sí |
| V103 | otro caso | spencer | — | 1.008067 | 1.008062 | global | sí |

Veredicto: **PASA**.

## A6 · determinismo

tres corridas iguales byte a byte y la misma salida con el binario `--features parallel`.

50/50 modelos con tres corridas idénticas; 50/50 con salida idéntica en el binario `parallel`. Veredicto: **PASA**.

## A7 · costo (nativo)

tiempo con `global` (N = 500) ≤ 4 × el circular, mediana de 3 corridas por modelo (nativo).

Razón global/circular por modelo: mediana 1.55, máximo 3.81 (tiempo de CPU: mediana 1.55, máximo 3.81). La columna «Refinamiento» es la razón del refinamiento de v0.6 sin `global`, para ver cuánto agrega la etapa global.

| Modelo | Circular (s) | Global (s) | Razón | Razón CPU | Refinamiento |
|---|---|---|---|---|---|
| V036c | 0.203 | 0.697 | 3.44 | 3.44 | 2.64 |
| V036d | 0.225 | 0.705 | 3.14 | 3.14 | 2.41 |
| V039 | 0.418 | 1.245 | 2.98 | 2.98 | 2.29 |
| V041a | 0.495 | 1.349 | 2.72 | 2.72 | 2.02 |
| V041b | 0.544 | 0.956 | 1.76 | 1.76 | 1.31 |
| V051 | 0.326 | 1.095 | 3.36 | 3.37 | 2.46 |
| V053 | 0.350 | 1.012 | 2.89 | 2.89 | 1.91 |
| V098 | 0.215 | 0.577 | 2.69 | 2.69 | 2.17 |
| V002-nc | 0.313 | 0.688 | 2.20 | 2.20 | 1.74 |
| V001-nc | 0.187 | 0.544 | 2.91 | 2.91 | 2.31 |
| V026-nc | 0.188 | 0.716 | 3.81 | 3.81 | 2.90 |
| V033-nc | 0.281 | 0.800 | 2.85 | 2.85 | 2.16 |
| V034a-nc | 0.247 | 0.778 | 3.15 | 3.15 | 2.49 |
| V034b-nc | 0.243 | 0.860 | 3.54 | 3.55 | 2.87 |
| S1 | 0.320 | 0.687 | 2.15 | 2.15 | 1.75 |
| S2 | 0.320 | 0.622 | 1.95 | 1.95 | 1.61 |
| TAL-H10-b30-f20-c5 | 0.326 | 0.439 | 1.35 | 1.35 | 1.14 |
| TAL-H10-b30-f20-c30 | 0.331 | 0.885 | 2.67 | 2.67 | 1.84 |
| TAL-H10-b30-f35-c5 | 0.321 | 0.477 | 1.49 | 1.49 | 1.14 |
| TAL-H10-b30-f35-c30 | 0.321 | 0.631 | 1.97 | 1.97 | 1.70 |
| TAL-H10-b45-f20-c5 | 0.326 | 0.438 | 1.35 | 1.35 | 1.15 |
| TAL-H10-b45-f20-c30 | 0.317 | 0.495 | 1.56 | 1.56 | 1.34 |
| TAL-H10-b45-f35-c5 | 0.328 | 0.442 | 1.34 | 1.34 | 1.14 |
| TAL-H10-b45-f35-c30 | 0.315 | 0.485 | 1.54 | 1.54 | 1.34 |
| TAL-H10-b60-f20-c5 | 0.319 | 0.434 | 1.36 | 1.36 | 1.15 |
| TAL-H10-b60-f20-c30 | 0.320 | 0.471 | 1.47 | 1.47 | 1.31 |
| TAL-H10-b60-f35-c5 | 0.321 | 0.442 | 1.37 | 1.38 | 1.16 |
| TAL-H10-b60-f35-c30 | 0.316 | 0.424 | 1.34 | 1.34 | 1.34 |
| TAL-H30-b30-f20-c5 | 0.327 | 0.443 | 1.35 | 1.35 | 1.15 |
| TAL-H30-b30-f20-c30 | 0.316 | 0.569 | 1.80 | 1.80 | 1.36 |
| TAL-H30-b30-f35-c5 | 0.327 | 0.477 | 1.46 | 1.46 | 1.15 |
| TAL-H30-b30-f35-c30 | 0.318 | 0.429 | 1.35 | 1.35 | 1.15 |
| TAL-H30-b45-f20-c5 | 0.337 | 0.459 | 1.36 | 1.36 | 1.15 |
| TAL-H30-b45-f20-c30 | 0.315 | 0.431 | 1.37 | 1.37 | 1.16 |
| TAL-H30-b45-f35-c5 | 0.330 | 0.448 | 1.36 | 1.36 | 1.14 |
| TAL-H30-b45-f35-c30 | 0.321 | 0.434 | 1.35 | 1.35 | 1.16 |
| TAL-H30-b60-f20-c5 | 0.319 | 0.442 | 1.38 | 1.38 | 1.16 |
| TAL-H30-b60-f20-c30 | 0.319 | 0.429 | 1.34 | 1.34 | 1.34 |
| TAL-H30-b60-f35-c5 | 0.324 | 0.324 | 1.00 | 1.00 | 1.00 |
| TAL-H30-b60-f35-c30 | 0.323 | 0.438 | 1.36 | 1.36 | 1.15 |

WASM (el motor compilado a `wasm32-unknown-unknown`, corrido en V8 de Node; no es Chrome): tiempo de V053 y S2 con y sin `global` y FS contra el nativo.

| Modelo | WASM circular (s) | WASM global (s) | Razón WASM | Nativo circular (s) | Nativo global (s) | FS nativo | FS WASM | Dif. | Salida idéntica |
|---|---|---|---|---|---|---|---|---|---|
| V053 | 0.424 | 1.217 | 2.87 | 0.350 | 1.012 | 1.010300223400 | 1.010300223400 | 6.7e-16 | no |
| S2 | 0.384 | 0.755 | 1.97 | 0.320 | 0.622 | 0.750512538651 | 0.750512538651 | 4.4e-16 | no |

Veredicto nativo: **PASA**.

## A8 · barrido de 24 taludes

en los 24 taludes `global` no empeora ninguno, `evaluated` > 0 en al menos 23 y no hay avisos nuevos fuera de F7.2 (E17a).

| Talud | Sin `global` | Con `global` | Algoritmo | Evaluaciones | Ganador | Avisos nuevos | Notas F7.2 |
|---|---|---|---|---|---|---|---|
| TAL-H10-b30-f20-c5 | 1.01626 | 1.01626 | annealing | 2211 | refinement | — | — |
| TAL-H10-b30-f20-c30 | 2.07253 | 2.06954 | annealing | 4064 | global | — | — |
| TAL-H10-b30-f35-c5 | 1.68298 | 1.68268 | annealing | 3385 | global | — | — |
| TAL-H10-b30-f35-c30 | 2.89947 | 2.89947 | annealing | 2211 | refinement | — | — |
| TAL-H10-b45-f20-c5 | 0.70727 | 0.70727 | annealing | 2211 | refinement | — | — |
| TAL-H10-b45-f20-c30 | 1.40809 | 1.40809 | annealing | 2211 | refinement | — | — |
| TAL-H10-b45-f35-c5 | 1.12518 | 1.12497 | annealing | 2211 | global | — | — |
| TAL-H10-b45-f35-c30 | 2.05606 | 2.05606 | annealing | 2211 | refinement | — | — |
| TAL-H10-b60-f20-c5 | 0.52535 | 0.52531 | annealing | 2211 | global | — | — |
| TAL-H10-b60-f20-c30 | 1.19938 | 1.19938 | annealing | 1798 | refinement | — | — |
| TAL-H10-b60-f35-c5 | 0.80356 | 0.80348 | annealing | 2211 | global | — | — |
| TAL-H10-b60-f35-c30 | 1.52952 | 1.52952 | annealing | 1 | refinement | — | non_circular_global_no_candidates |
| TAL-H30-b30-f20-c5 | 0.81030 | 0.81024 | annealing | 2211 | global | — | — |
| TAL-H30-b30-f20-c30 | 1.26333 | 1.26295 | annealing | 3242 | global | — | — |
| TAL-H30-b30-f35-c5 | 1.43404 | 1.43391 | annealing | 3132 | global | — | — |
| TAL-H30-b30-f35-c30 | 1.97588 | 1.97588 | annealing | 2211 | refinement | — | — |
| TAL-H30-b45-f20-c5 | 0.52813 | 0.52813 | annealing | 2211 | refinement | — | — |
| TAL-H30-b45-f20-c30 | 0.91878 | 0.91878 | annealing | 2211 | refinement | — | — |
| TAL-H30-b45-f35-c5 | 0.90474 | 0.90469 | annealing | 2211 | global | — | — |
| TAL-H30-b45-f35-c30 | 1.37833 | 1.37833 | annealing | 2211 | refinement | — | — |
| TAL-H30-b60-f20-c5 | 0.36700 | 0.36698 | annealing | 2211 | global | — | — |
| TAL-H30-b60-f20-c30 | 0.65609 | 0.65609 | annealing | 1 | refinement | — | non_circular_global_no_candidates |
| TAL-H30-b60-f35-c5 | 0.60599 | 0.60599 | annealing | 0 | refinement | — | non_circular_global_no_candidates |
| TAL-H30-b60-f35-c30 | 1.02597 | 1.02597 | annealing | 2211 | refinement | — | — |

`evaluated` = 0 en: TAL-H30-b60-f35-c5. Veredicto: **PASA**.

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

## A1

Se agregó la bandera `--include-v06` a `verification/tools/identity_vs_baseline.py`: el binario base v0.5.1 lee la versión 0.6, así que los 17 modelos con campos v0.6 (no circular, Hoek-Brown, SHANSEP) entran; sin la bandera quedaban «saltados aparte» y A1 no tocaba justo el camino que cambió (`noncircular.rs`). Sus variantes @0.4 se omiten (la 0.4 no puede escribir esos campos).
Sin la bandera (el comando literal del brief): 0 diferencias en 180 modelos, 17 saltados; con ella, 0 diferencias en 196 (20 comparaciones `search` con error en ambos binarios y mismo mensaje).

## A10

| Puerta | Resultado |
|---|---|
| `cargo fmt --all --check` | sin diferencias |
| `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings` | sin avisos |
| `cargo test -p ogs-core --release` | 809 pasan, 0 fallan, 3 ignorados |
| `cargo test -p ogs-core --release --features parallel` | 809 pasan, 0 fallan, 3 ignorados |
| aceptación (`--test acceptance`) | 3 pasan; 347 checks, 0 fallas |
| `cargo test -p ogs-cli --release` | 8 pasan |
| `pytest verification/tools` (con `OGS_BIN`) | 763 pasan, 1 omitido |
| harness (`verification/harness/run.py`) | 347/347 OK, cSlope reproduce 346/347 (igual que la base) |
| batería diferencial (`--include-f3b`) | búsqueda 28/28, fija 28/28, F3B 41 OK + 1 explicado (igual que la base) |
| `pytest verification/harness verification/differential` | 796 pasan |
| wheel (`maturin build --release`, instalación, `pytest tests`) | 371 pasan, 2 omitidos |
| vitest y build de la web | no corridos (`apps/web` no es de CM-M) |

Los tests existentes que fallaban por aceptar la 0.7 (`f3g_types`, `f3r_types`, `loads_seismic`, `v03_format`, 4 de `test_schema.py` y `test_v06.py` del wheel) usaban la 0.7 como «versión desconocida»: ahora usan la 0.8. Ninguno se borró; uno cambió de nombre (`..._and_0_7_is_unknown` → `..._and_0_8_is_unknown`). Los comandos del brief para `pytest verification/tools` no traen `shapely` ni `OGS_BIN`: sin ellos fallan por el entorno, no por el código (el mismo error en la base).

