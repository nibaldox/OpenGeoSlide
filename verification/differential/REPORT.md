# Batería diferencial: ogs vs cSlope 0.1.0 (W9)

Generado: 2026-11-27T22:08:43-03:00 · casos: 14 · checks: 56 (búsqueda + superficie fija, bishop y spencer)

## Motores

- **ogs**: `target/release/ogs` · versión: ogs-core 0.5.1
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Criterio (E9b, briefs/00_CONTRATOS.md §4.4.6)

- **Búsqueda**: `FS_ogs ≤ FS_cSlope · 1,01`, con el mismo método, número de dovelas y rangos. Un FS de ogs menor es más exhaustivo y se acepta.
- **Superficie fija**: `|FS_ogs − FS_cSlope| / FS_cSlope ≤ 0,5 %`, con el mismo círculo.
- **Concordancia (W9)**: si ogs declara la superficie fija sin solución (`not_converged` o `invalid`) y cSlope también (`EngineError` o `converged: false`), el veredicto es `OK (concordancia: ambos sin solución)`. Si solo uno de los dos la declara, es `FALLA`.
- Un resultado de cSlope con `converged: false` (el par Fm/Ff más cercano, no una raíz; X6) es un oráculo sin solución, igual que un `EngineError`, y nunca es un valor de referencia: su `minFOS` figura en la tabla pero no se compara.
- El veredicto no detiene la batería: el exit code es 0 aunque haya fallos.

## Resumen

**búsqueda OK 28/28** · **fija OK 28/28**

| criterio | OK | de ellos, ambos sin solución | FALLA | sin dato |
|---|---:|---:|---:|---:|
| búsqueda | 28 | 0 | 0 | 0 |
| fija | 28 | 1 | 0 | 0 |

Tiempo total: ogs 4.212 s · cSlope 1.803 s.

## Tabla de línea base

| caso | método | búsqueda ogs | búsqueda cSlope | Δ% búsqueda | fija ogs | fija cSlope | Δ% fija | avisos ogs (no informativos) | veredicto |
|---|---|---:|---:|---:|---:|---:|---:|---|---|
| D01 Talud homogéneo 1:1, seco | bishop | 0.8586 | 0.8585 | +0.00 | 0.8586 | 0.8585 | +0.00 | — | OK |
| D01 Talud homogéneo 1:1, seco | spencer | 0.8554 | 0.8553 | +0.01 | 0.8555 | 0.8554 | +0.01 | — | OK |
| D02 Talud 1:1 con r_u = 0,5 | bishop | 0.3678 | 0.3677 | +0.02 | 0.3678 | 0.3677 | +0.02 | — | OK |
| D02 Talud 1:1 con r_u = 0,5 | spencer | 0.3851 | 0.3850 | +0.01 | 0.3872 | 0.3871 | +0.02 | búsqueda: negative_effective_normal_major · fija: negative_effective_normal_major | OK |
| D03 Dos capas con capa débil en la base | bishop | 0.5196 | 0.5185 | +0.21 | 0.5196 | 0.5187 | +0.18 | búsqueda: negative_effective_normal_major · fija: negative_effective_normal_major | OK |
| D03 Dos capas con capa débil en la base | spencer | 0.5497 | 0.5467 | +0.56 | — | — | — | búsqueda: negative_effective_normal_major · fija: no_lambda_root | OK (concordancia: ambos sin solución) |
| D04 Pared de rajo, 3 bancos | bishop | 1.5986 | 1.5985 | +0.01 | 1.5986 | 1.5985 | +0.01 | — | OK |
| D04 Pared de rajo, 3 bancos | spencer | 1.5923 | 1.5921 | +0.01 | 1.5923 | 1.5922 | +0.01 | — | OK |
| D05 Botadero, ángulo de reposo 37° | bishop | 1.0063 | 1.0005 | +0.58 | 1.0063 | 1.0063 | -0.00 | — | OK |
| D05 Botadero, ángulo de reposo 37° | spencer | 1.0063 | 1.0005 | +0.58 | 1.0063 | 1.0063 | +0.00 | — | OK |
| D06 Talud con piezométrica inclinada | bishop | 0.7156 | 0.7154 | +0.03 | 0.7156 | 0.7154 | +0.03 | — | OK |
| D06 Talud con piezométrica inclinada | spencer | 0.7148 | 0.7146 | +0.03 | 0.7148 | 0.7146 | +0.03 | — | OK |
| D07 Arcilla blanda, φ = 0 | bishop | 1.0519 | 1.0504 | +0.14 | 1.0519 | 1.0517 | +0.03 | — | OK |
| D07 Arcilla blanda, φ = 0 | spencer | 1.0519 | 1.0504 | +0.14 | 1.0519 | 1.0517 | +0.03 | — | OK |
| D08 Presa simétrica con rangos de búsqueda | bishop | 1.6057 | 1.6057 | +0.00 | 1.6057 | 1.6057 | +0.00 | — | OK |
| D08 Presa simétrica con rangos de búsqueda | spencer | 1.6041 | 1.6040 | +0.00 | 1.6041 | 1.6041 | +0.00 | — | OK |
| D09 Talud R2-03 (c = 2, φ = 45°, r_u = 0,65) | bishop | 0.3307 | 0.3307 | +0.02 | 0.3408 | 0.3407 | +0.03 | — | OK |
| D09 Talud R2-03 (c = 2, φ = 45°, r_u = 0,65) | spencer | 0.3876 | 0.3876 | -0.01 | 0.4322 | 0.4322 | +0.01 | fija: negative_effective_normal_major | OK |
| D10 Talud con c alto y φ bajo, círculo profundo | bishop | 1.0440 | 1.0436 | +0.04 | 1.0440 | 1.0436 | +0.04 | — | OK |
| D10 Talud con c alto y φ bajo, círculo profundo | spencer | 1.0428 | 1.0424 | +0.03 | 1.0428 | 1.0424 | +0.03 | — | OK |
| D11 Pared de rajo, 3 bancos, kh = 0,15 | bishop | 1.0898 | 1.0897 | +0.01 | 1.0898 | 1.0897 | +0.01 | — | OK |
| D11 Pared de rajo, 3 bancos, kh = 0,15 | spencer | 1.0876 | 1.0876 | +0.01 | 1.0876 | 1.0876 | +0.01 | — | OK |
| D12 Botadero con sobrecarga en la corona y kv = −0,05 | bishop | 1.0488 | 1.0425 | +0.60 | 1.0488 | 1.0488 | -0.00 | — | OK |
| D12 Botadero con sobrecarga en la corona y kv = −0,05 | spencer | 1.0482 | 1.0462 | +0.19 | 1.0482 | 1.0482 | +0.00 | — | OK |
| D13 Talud civil con carga lineal de 100 kN/m a 15° | bishop | 1.4599 | 1.4595 | +0.03 | 1.4599 | 1.4630 | -0.21 | — | OK |
| D13 Talud civil con carga lineal de 100 kN/m a 15° | spencer | 1.4504 | 1.4499 | +0.04 | 1.4505 | 1.4536 | -0.21 | — | OK |
| D14 Terraplén con kh = 0,1 y piezométrica | bishop | 1.1219 | 1.1213 | +0.05 | 1.1219 | 1.1214 | +0.05 | — | OK |
| D14 Terraplén con kh = 0,1 y piezométrica | spencer | 1.1344 | 1.1339 | +0.04 | 1.1357 | 1.1353 | +0.04 | — | OK |

Δ% = (FS_ogs − FS_cSlope) / FS_cSlope · 100. El veredicto de la fila combina las dos comprobaciones.
Avisos de ogs: se listan por comprobación los códigos que no son informativos (`negative_effective_normal`, `truncated_mass` y `negative_lambda` son notas informativas). `—` significa que no hay avisos no informativos.

Checks de ogs con avisos no informativos: 7 de 56.

## Fallos y motivos

Ninguno.

## Tiempos por check

| caso | método | tipo | ogs s | cSlope s |
|---|---|---|---:|---:|
| D01 | bishop | search | 0.053 | 0.050 |
| D01 | bishop | fixed | 0.001 | 0.001 |
| D01 | spencer | search | 0.124 | 0.079 |
| D01 | spencer | fixed | 0.002 | 0.001 |
| D02 | bishop | search | 0.045 | 0.044 |
| D02 | bishop | fixed | 0.001 | 0.001 |
| D02 | spencer | search | 0.159 | 0.076 |
| D02 | spencer | fixed | 0.002 | 0.001 |
| D03 | bishop | search | 0.061 | 0.047 |
| D03 | bishop | fixed | 0.002 | 0.001 |
| D03 | spencer | search | 0.173 | 0.081 |
| D03 | spencer | fixed | 0.002 | 0.001 |
| D04 | bishop | search | 0.136 | 0.032 |
| D04 | bishop | fixed | 0.001 | 0.001 |
| D04 | spencer | search | 0.415 | 0.059 |
| D04 | spencer | fixed | 0.001 | 0.001 |
| D05 | bishop | search | 0.048 | 0.047 |
| D05 | bishop | fixed | 0.001 | 0.001 |
| D05 | spencer | search | 0.136 | 0.077 |
| D05 | spencer | fixed | 0.002 | 0.001 |
| D06 | bishop | search | 0.048 | 0.045 |
| D06 | bishop | fixed | 0.001 | 0.001 |
| D06 | spencer | search | 0.127 | 0.074 |
| D06 | spencer | fixed | 0.002 | 0.001 |
| D07 | bishop | search | 0.037 | 0.043 |
| D07 | bishop | fixed | 0.001 | 0.001 |
| D07 | spencer | search | 0.141 | 0.072 |
| D07 | spencer | fixed | 0.002 | 0.001 |
| D08 | bishop | search | 0.072 | 0.044 |
| D08 | bishop | fixed | 0.001 | 0.034 |
| D08 | spencer | search | 0.258 | 0.064 |
| D08 | spencer | fixed | 0.002 | 0.036 |
| D09 | bishop | search | 0.080 | 0.045 |
| D09 | bishop | fixed | 0.002 | 0.001 |
| D09 | spencer | search | 0.329 | 0.169 |
| D09 | spencer | fixed | 0.002 | 0.001 |
| D10 | bishop | search | 0.043 | 0.045 |
| D10 | bishop | fixed | 0.002 | 0.001 |
| D10 | spencer | search | 0.145 | 0.078 |
| D10 | spencer | fixed | 0.001 | 0.001 |
| D11 | bishop | search | 0.206 | 0.033 |
| D11 | bishop | fixed | 0.002 | 0.001 |
| D11 | spencer | search | 0.463 | 0.062 |
| D11 | spencer | fixed | 0.002 | 0.001 |
| D12 | bishop | search | 0.051 | 0.048 |
| D12 | bishop | fixed | 0.002 | 0.001 |
| D12 | spencer | search | 0.153 | 0.079 |
| D12 | spencer | fixed | 0.002 | 0.001 |
| D13 | bishop | search | 0.058 | 0.038 |
| D13 | bishop | fixed | 0.002 | 0.001 |
| D13 | spencer | search | 0.195 | 0.056 |
| D13 | spencer | fixed | 0.002 | 0.001 |
| D14 | bishop | search | 0.100 | 0.051 |
| D14 | bishop | fixed | 0.002 | 0.001 |
| D14 | spencer | search | 0.316 | 0.075 |
| D14 | spencer | fixed | 0.002 | 0.001 |

## Notas de conversión

- D01: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D02: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D03: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D04: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D05: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D06: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D07: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D08: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D09: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D10: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D11: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D11: sismo pseudoestático kh=0.15, kv=0: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).
- D12: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D12: sismo pseudoestático kh=0, kv=-0.05: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).
- D13: cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; cSlope espeja la geometría rtl y el ángulo internamente).
- D13: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D14: search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- D14: sismo pseudoestático kh=0.1, kv=0: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).

## Errores y rechazos de motor

- D03 spencer/fixed cSlope: EngineError: No valid slip surface was found. Moment and force equilibrium do not meet where the surface enters the slope at 90°: cohesion along a nearly vertical base can only hold it with tension at the base. A 

## Fase 3a: M-P medio seno, Janbu corregido, no drenado y polilínea (F3.8)

Se corre, sobre el círculo fijo de cada uno de los 14 modelos, Morgenstern-Price con la función `half_sine` y Janbu corregido, con el criterio de 0,5 % de E9b. Se agregan nueve modelos v0.3 (`cases_f3/`): D15 terraplén sobre arcilla blanda con Su lineal, D16 depósito de relaves con Su constante, D17 bloque deslizante sobre una capa débil con polilínea fija (sin Bishop, F3.6) y, de R10, D18 corte con Su decreciente y piso, D19 y D20 M-P con `clipped_sine` y `trapezoidal`, D21 polilínea sobre un contacto de materiales y D22 y D23 polilínea en terreno horizontal con kh y con carga lineal horizontal. Cada capacidad que el motor aún no tiene se sondea antes con un modelo mínimo; el check que la necesita queda **pendiente**, nunca falla. El valor de cSlope de un check pendiente igual se calcula y queda como línea base.

| capacidad | soportada por el motor | detalle |
|---|---|---|
| undrained | sí | — |
| morgenstern_price | sí | — |
| janbu_corrected | sí | — |
| polyline | sí | — |

**OK 71/71** · FALLA 0 · sin dato 0 · pendiente 0 (de los OK, 1 por concordancia: ambos sin solución).

| caso | método | tipo | ogs | cSlope | Δ% | veredicto |
|---|---|---|---:|---:|---:|---|
| D01 | morgenstern_price | fixed | 0.8551 | 0.8551 | +0.01 | OK |
| D01 | janbu_corrected | fixed | 0.8572 | 0.8570 | +0.01 | OK |
| D02 | morgenstern_price | fixed | 0.3855 | 0.3854 | +0.02 | OK |
| D02 | janbu_corrected | fixed | 0.3384 | 0.3383 | +0.03 | OK |
| D03 | morgenstern_price | fixed | — | — | — | OK (concordancia: ambos sin solución) |
| D03 | janbu_corrected | fixed | 0.6868 | 0.6860 | +0.13 | OK |
| D04 | morgenstern_price | fixed | 1.5916 | 1.5914 | +0.01 | OK |
| D04 | janbu_corrected | fixed | 1.6010 | 1.6007 | +0.02 | OK |
| D05 | morgenstern_price | fixed | 1.0063 | 1.0063 | +0.00 | OK |
| D05 | janbu_corrected | fixed | 1.0107 | 1.0107 | +0.00 | OK |
| D06 | morgenstern_price | fixed | 0.7147 | 0.7145 | +0.03 | OK |
| D06 | janbu_corrected | fixed | 0.7080 | 0.7078 | +0.03 | OK |
| D07 | morgenstern_price | fixed | 1.0519 | 1.0517 | +0.03 | OK |
| D07 | janbu_corrected | fixed | 1.1144 | 1.1140 | +0.04 | OK |
| D08 | morgenstern_price | fixed | 1.6041 | 1.6040 | +0.00 | OK |
| D08 | janbu_corrected | fixed | 1.6109 | 1.6107 | +0.01 | OK |
| D09 | morgenstern_price | fixed | 0.4254 | 0.4253 | +0.02 | OK |
| D09 | janbu_corrected | fixed | 0.3126 | 0.3125 | +0.04 | OK |
| D10 | morgenstern_price | fixed | 1.0418 | 1.0414 | +0.04 | OK |
| D10 | janbu_corrected | fixed | 1.0574 | 1.0570 | +0.03 | OK |
| D11 | morgenstern_price | fixed | 1.0866 | 1.0865 | +0.01 | OK |
| D11 | janbu_corrected | fixed | 1.0756 | 1.0754 | +0.01 | OK |
| D12 | morgenstern_price | fixed | 1.0483 | 1.0483 | +0.00 | OK |
| D12 | janbu_corrected | fixed | 1.0543 | 1.0543 | +0.00 | OK |
| D13 | morgenstern_price | fixed | 1.4524 | 1.4554 | -0.21 | OK |
| D13 | janbu_corrected | fixed | 1.4026 | 1.4053 | -0.19 | OK |
| D14 | morgenstern_price | fixed | 1.1338 | 1.1333 | +0.04 | OK |
| D14 | janbu_corrected | fixed | 1.0913 | 1.0906 | +0.06 | OK |
| D15 | bishop | search | 1.0809 | 1.0828 | -0.18 | OK |
| D15 | bishop | fixed | 1.0831 | 1.0828 | +0.03 | OK |
| D15 | spencer | search | 1.0753 | 1.0774 | -0.20 | OK |
| D15 | spencer | fixed | 1.0778 | 1.0775 | +0.03 | OK |
| D15 | morgenstern_price | fixed | 1.0806 | 1.0803 | +0.03 | OK |
| D15 | janbu_corrected | fixed | 1.0746 | 1.0743 | +0.03 | OK |
| D16 | bishop | search | 1.1653 | 1.1713 | -0.51 | OK |
| D16 | bishop | fixed | 1.7482 | 1.7480 | +0.01 | OK |
| D16 | spencer | search | 1.1653 | 1.1713 | -0.51 | OK |
| D16 | spencer | fixed | 1.8314 | 1.8313 | +0.00 | OK |
| D16 | morgenstern_price | fixed | 1.8313 | 1.8312 | +0.00 | OK |
| D16 | janbu_corrected | fixed | 1.7476 | 1.7475 | +0.01 | OK |
| D17 | spencer | fixed (polilínea) | 1.6721 | 1.6721 | -0.00 | OK |
| D17 | morgenstern_price | fixed (polilínea) | 1.5938 | 1.5937 | +0.00 | OK |
| D17 | janbu_corrected | fixed (polilínea) | 1.4736 | 1.4735 | +0.00 | OK |
| D18 | bishop | search | 1.0483 | 1.0424 | +0.56 | OK |
| D18 | bishop | fixed | 1.2068 | 1.2055 | +0.10 | OK |
| D18 | spencer | search | 1.0482 | 1.0424 | +0.56 | OK |
| D18 | spencer | fixed | 1.2068 | 1.2055 | +0.10 | OK |
| D18 | morgenstern_price | fixed | 1.2068 | 1.2055 | +0.10 | OK |
| D18 | janbu_corrected | fixed | 1.3582 | 1.3560 | +0.16 | OK |
| D19 | bishop | search | 1.3246 | 1.3245 | +0.01 | OK |
| D19 | bishop | fixed | 1.3246 | 1.3245 | +0.01 | OK |
| D19 | spencer | search | 1.3013 | 1.3012 | +0.01 | OK |
| D19 | spencer | fixed | 1.3016 | 1.3014 | +0.01 | OK |
| D19 | morgenstern_price | fixed | 1.2993 | 1.2992 | +0.01 | OK |
| D19 | janbu_corrected | fixed | 1.2934 | 1.2932 | +0.01 | OK |
| D20 | bishop | search | 1.3246 | 1.3245 | +0.01 | OK |
| D20 | bishop | fixed | 1.3246 | 1.3245 | +0.01 | OK |
| D20 | spencer | search | 1.3013 | 1.3012 | +0.01 | OK |
| D20 | spencer | fixed | 1.3016 | 1.3014 | +0.01 | OK |
| D20 | morgenstern_price | fixed | 1.3007 | 1.3006 | +0.01 | OK |
| D20 | janbu_corrected | fixed | 1.2934 | 1.2932 | +0.01 | OK |
| D21 | spencer | fixed (polilínea) | 2.1527 | 2.1522 | +0.02 | OK |
| D21 | morgenstern_price | fixed (polilínea) | 1.8428 | 1.8424 | +0.02 | OK |
| D21 | janbu_simplified | fixed (polilínea) | 1.4990 | 1.4990 | +0.00 | OK |
| D21 | janbu_corrected | fixed (polilínea) | 1.6310 | 1.6313 | -0.02 | OK |
| D22 | spencer | fixed (polilínea) | 3.9855 | 3.9855 | -0.00 | OK |
| D22 | morgenstern_price | fixed (polilínea) | 3.9306 | 3.9306 | -0.00 | OK |
| D22 | janbu_simplified | fixed (polilínea) | 3.3333 | 3.3333 | +0.00 | OK |
| D22 | janbu_corrected | fixed (polilínea) | 3.7071 | 3.7071 | +0.00 | OK |
| D23 | janbu_simplified | fixed (polilínea) | 7.5000 | 7.5000 | +0.00 | OK |
| D23 | janbu_corrected | fixed (polilínea) | 8.3409 | 8.3409 | +0.00 | OK |

### Fallos y datos faltantes de la Fase 3a

Ninguno.

## v0.4: refuerzos (D24 a D27)

Cuatro modelos en `cases_f3r/` con su círculo fijo, que cruza los refuerzos: D24 talud con clavos pasivos (`bond`), D25 muro TEM con geosintéticos (`development` e `interface`, `axial` y `tangent`), D26 tablestaca anclada (tablestaca pasiva y anclaje activo) y D27 fila de pilotes. Bishop, Morgenstern-Price (`half_sine`) y Janbu corregido, con el criterio de 0,5 % de E9b. La sonda de cada capacidad es V047a con el anclaje de las filas 1 (activo) y 2 (pasivo) de F4.13: se acepta si Bishop da la cifra del oráculo a 0,1 %. El check que necesita una capacidad que el motor no tiene queda **pendiente**, nunca falla; el valor de cSlope se calcula igual y queda como línea base. No hay búsqueda con refuerzos: las fuerzas dependen de la superficie.

| capacidad | soportada por el motor | detalle |
|---|---|---|
| reinforcements_active | sí | — |
| reinforcements_passive | sí | — |

**OK 12/12** · FALLA 0 · sin dato 0 · pendiente 0.

| caso | método | ogs | cSlope | Δ% | veredicto |
|---|---|---:|---:|---:|---|
| D24 | bishop | 1.4911 | 1.4912 | -0.01 | OK |
| D24 | morgenstern_price | 1.4923 | 1.4924 | -0.00 | OK |
| D24 | janbu_corrected | 1.4731 | 1.4735 | -0.03 | OK |
| D25 | bishop | 1.5085 | 1.5086 | -0.00 | OK |
| D25 | morgenstern_price | 1.5080 | 1.5080 | -0.00 | OK |
| D25 | janbu_corrected | 1.5195 | 1.5195 | -0.00 | OK |
| D26 | bishop | 1.9880 | 1.9876 | +0.02 | OK |
| D26 | morgenstern_price | 1.9863 | 1.9857 | +0.03 | OK |
| D26 | janbu_corrected | 1.8423 | 1.8405 | +0.10 | OK |
| D27 | bishop | 2.2371 | 2.2367 | +0.02 | OK |
| D27 | morgenstern_price | 2.2340 | 2.2335 | +0.02 | OK |
| D27 | janbu_corrected | 2.0918 | 2.0915 | +0.02 | OK |

### Fallos y datos faltantes de v0.4

Ninguno.

## v0.5: grieta de tracción, agua embalsada y pilotes de Ito-Matsui (D28 a D42)

Quince modelos en `cases_f3g/`: embalse al pie y en el talud (D28, D29), cara vertical con embalse (D30), presa con embalse (D31), grieta seca, llena y automática (D32 a D35), y combinados: embalse y grieta llena (D36), presa con grieta automática (D37), sismo con embalse y grieta (D38) y arcilla no drenada (D39); y tres filas de pilotes de Ito-Matsui (E15i) en el talud de Cai y Ugai: φ = 0 (D40), c-φ con la fuerza en el cruce y tope de corte (D41) y bajo el agua (D42). Cada uno en búsqueda y en su círculo fijo, con Bishop y Spencer, con los criterios de E9b. La sonda de cada capacidad es V047a: el embalse de 2 m al pie (X21-P01) y la grieta de 2 m llena al 25 % (X21-W025); para `lateral_pressure`, la fila X22-V013c con un pilote de Ito-Matsui. Se acepta si Bishop da la cifra del oráculo a 0,1 %. El check que necesita una capacidad que el motor no tiene queda **pendiente**, nunca falla; el valor de cSlope se calcula igual y queda como línea base.

| capacidad | soportada por el motor | detalle |
|---|---|---|
| ponded_water | sí | — |
| tension_crack | sí | — |
| lateral_pressure | sí | — |

**OK 58/60** · explicado 2 · FALLA 0 · sin dato 0 · pendiente 0. «Explicado» no cuenta como OK ni como falla: el motor rechaza un círculo fijo que pasa por debajo del fondo del modelo en menos de 1e-6 (E15f, E15j-7) y no se relaja la tolerancia.

| caso | método | tipo | ogs | cSlope | Δ% | veredicto |
|---|---|---|---:|---:|---:|---|
| D28 | bishop | search | 0.9246 | 0.9243 | +0.02 | OK |
| D28 | bishop | fixed | 0.9246 | 0.9243 | +0.03 | OK |
| D28 | spencer | search | 0.9243 | 0.9240 | +0.03 | OK |
| D28 | spencer | fixed | 0.9243 | 0.9240 | +0.03 | OK |
| D29 | bishop | search | 0.9544 | 0.9540 | +0.04 | OK |
| D29 | bishop | fixed | 0.9544 | 0.9540 | +0.04 | OK |
| D29 | spencer | search | 0.9553 | 0.9549 | +0.04 | OK |
| D29 | spencer | fixed | 0.9554 | 0.9549 | +0.04 | OK |
| D30 | bishop | search | 0.8248 | 1.5143 | -45.53 | OK |
| D30 | bishop | fixed | 1.5163 | 1.5143 | +0.13 | OK |
| D30 | spencer | search | 0.9702 | 1.5128 | -35.87 | OK |
| D30 | spencer | fixed | 1.5146 | 1.5128 | +0.12 | OK |
| D31 | bishop | search | 2.6132 | 2.6121 | +0.04 | OK |
| D31 | bishop | fixed | 2.6133 | 2.6121 | +0.05 | OK |
| D31 | spencer | search | 2.6134 | 2.6121 | +0.05 | OK |
| D31 | spencer | fixed | 2.6134 | 2.6121 | +0.05 | OK |
| D32 | bishop | search | 1.2113 | 1.2113 | +0.00 | OK |
| D32 | bishop | fixed | 1.2113 | 1.2113 | +0.00 | OK |
| D32 | spencer | search | 1.2051 | 1.2051 | +0.00 | OK |
| D32 | spencer | fixed | 1.2053 | 1.2052 | +0.00 | OK |
| D33 | bishop | search | 1.1674 | 1.1674 | +0.00 | OK |
| D33 | bishop | fixed | 1.1674 | 1.1674 | +0.00 | OK |
| D33 | spencer | search | 1.1592 | 1.1592 | +0.00 | OK |
| D33 | spencer | fixed | 1.1595 | 1.1595 | +0.00 | OK |
| D34 | bishop | search | 1.0714 | 1.0714 | +0.00 | OK |
| D34 | bishop | fixed | 1.0714 | 1.0714 | +0.00 | OK |
| D34 | spencer | search | 1.0538 | 1.0538 | +0.00 | OK |
| D34 | spencer | fixed | 1.0543 | 1.0543 | +0.01 | OK |
| D35 | bishop | search | 1.0488 | 1.0487 | +0.00 | OK |
| D35 | bishop | fixed | 1.0488 | 1.0487 | +0.00 | OK |
| D35 | spencer | search | 1.0305 | 1.0304 | +0.01 | OK |
| D35 | spencer | fixed | 1.0309 | 1.0308 | +0.01 | OK |
| D36 | bishop | search | 0.9119 | 0.9118 | +0.02 | OK |
| D36 | bishop | fixed | 0.9119 | 0.9118 | +0.01 | OK |
| D36 | spencer | search | 0.9115 | 0.9114 | +0.01 | OK |
| D36 | spencer | fixed | 0.9116 | 0.9114 | +0.01 | OK |
| D37 | bishop | search | 2.5958 | 2.5949 | +0.04 | OK |
| D37 | bishop | fixed | 2.5958 | 2.5949 | +0.04 | OK |
| D37 | spencer | search | 2.5959 | 2.5948 | +0.04 | OK |
| D37 | spencer | fixed | 2.5959 | 2.5948 | +0.04 | OK |
| D38 | bishop | search | 0.7361 | 0.7359 | +0.03 | OK |
| D38 | bishop | fixed | 0.7360 | 0.7359 | +0.01 | OK |
| D38 | spencer | search | 0.7388 | 0.7388 | +0.00 | OK |
| D38 | spencer | fixed | 0.7389 | 0.7388 | +0.01 | OK |
| D39 | bishop | search | 1.2269 | 1.2263 | +0.05 | OK |
| D39 | bishop | fixed | — | 1.2263 | — | explicado (E15f, E15j-7) |
| D39 | spencer | search | 1.2270 | 1.2263 | +0.05 | OK |
| D39 | spencer | fixed | — | 1.2263 | — | explicado (E15f, E15j-7) |
| D40 | bishop | search | 1.3360 | 1.3351 | +0.06 | OK |
| D40 | bishop | fixed | 1.3360 | 1.3351 | +0.07 | OK |
| D40 | spencer | search | 1.3360 | 1.3351 | +0.07 | OK |
| D40 | spencer | fixed | 1.3361 | 1.3351 | +0.07 | OK |
| D41 | bishop | search | 1.2311 | 1.2311 | -0.01 | OK |
| D41 | bishop | fixed | 1.2312 | 1.2311 | +0.01 | OK |
| D41 | spencer | search | 1.2268 | 1.2269 | -0.01 | OK |
| D41 | spencer | fixed | 1.2272 | 1.2271 | +0.01 | OK |
| D42 | bishop | search | 1.2128 | 1.2126 | +0.02 | OK |
| D42 | bishop | fixed | 1.2128 | 1.2126 | +0.02 | OK |
| D42 | spencer | search | 1.2098 | 1.2095 | +0.02 | OK |
| D42 | spencer | fixed | 1.2098 | 1.2096 | +0.02 | OK |

### Fallos y datos faltantes de v0.5

Ninguno.

### Explicados de v0.5

- D39 bishop/fixed: **explicado (E15f, E15j-7)**. círculo fijo tangente al fondo: el de cSlope pasa 9.20e-07 bajo el fondo (y = -10), más que la tolerancia del motor, que lo rechaza (NoValidSurface); cSlope da FS 1.2263. Se explica por E15f y E15j-7; no se relaja la tolerancia
- D39 spencer/fixed: **explicado (E15f, E15j-7)**. círculo fijo tangente al fondo: el de cSlope pasa 9.20e-07 bajo el fondo (y = -10), más que la tolerancia del motor, que lo rechaza (NoValidSurface); cSlope da FS 1.2263. Se explica por E15f y E15j-7; no se relaja la tolerancia

## Reproducir

```
export TMPDIR="$(mktemp -d)"
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/differential/run.py --ogs PATH_BINARIO_OGS
```

## F3B: Hoek-Brown, SHANSEP y búsqueda no circular

**OK 41/42** · explicado 1 · FALLA 0 · sin dato 0

| Caso | Método | Tipo | OGS | cSlope | Prototipo F6.8 | Veredicto | Motivo |
|---|---|---|---:|---:|---:|---|---|
| F3B-HB-01 | bishop | search | 1.1414213591695046 | 1.1414336659642357 |  | OK |  |
| F3B-HB-01 | bishop | fixed | 1.1804110914399426 | 1.1816320142387637 | 1.180419325351821 | OK |  |
| F3B-HB-01 | spencer | search | 1.1380645623208008 | 1.1380494027198045 |  | OK |  |
| F3B-HB-01 | spencer | fixed | 1.187409769034763 | 1.1880550637138545 | 1.1874088035105692 | OK |  |
| F3B-HB-02 | bishop | search | 2.0656893699899936 | 2.074093699485063 |  | OK |  |
| F3B-HB-02 | bishop | fixed | 2.0676681662401117 | 2.090902265431638 | 2.0676469376749806 | OK (F6.8: envolvente completa) | |Δ cSlope| = 1.11 % > 0,5 %: cSlope usa la tangente de σ3 = 0 en bajo confinamiento; ogs coincide con el prototipo de la envolvente completa 2.067647 (+0.001 %) |
| F3B-HB-02 | spencer | search | 2.0679365794340216 | 2.0710076444791756 |  | OK |  |
| F3B-HB-02 | spencer | fixed | 2.0946593601560504 | 2.1078856864141917 | 2.094657315425958 | explicado (E16t) | cSlope no tiene raíz de λ con su regla de bajo confinamiento (no convergido (status not_converged, minFOS 2.1079 no es una raíz)); no es referencia. Prototipo de la envolvente completa 2.094657; ogs 2.094659 (+0.000 %, sin gate: F6.8) |
| F3B-HB-03 | bishop | search | 0.4281878350260759 | 0.4281982950648746 |  | OK |  |
| F3B-HB-03 | bishop | fixed | 0.4785772031219493 | 0.4786748697490631 | 0.47857970200201533 | OK |  |
| F3B-HB-03 | spencer | search | 0.4273442606015364 | 0.42728218504641796 |  | OK |  |
| F3B-HB-03 | spencer | fixed | 0.4826379870541104 | 0.48269847787183534 | 0.48263768864009626 | OK |  |
| F3B-HB-04 | bishop | search | 1.9240609898334131 | 1.928051868339857 |  | OK |  |
| F3B-HB-04 | bishop | fixed | 3.125977756315291 | 3.2084049537182855 | 3.1259887667595705 | OK (F6.8: envolvente completa) | |Δ cSlope| = 2.57 % > 0,5 %: cSlope usa la tangente de σ3 = 0 en bajo confinamiento; ogs coincide con el prototipo de la envolvente completa 3.125989 (+0.000 %) |
| F3B-HB-04 | spencer | search | 1.919907450635764 | 1.9244920330590896 |  | OK |  |
| F3B-HB-04 | spencer | fixed | 3.146257262588547 | 3.204112520906414 | 3.1462554502752855 | OK (F6.8: envolvente completa) | |Δ cSlope| = 1.81 % > 0,5 %: cSlope usa la tangente de σ3 = 0 en bajo confinamiento; ogs coincide con el prototipo de la envolvente completa 3.146255 (+0.000 %) |
| F3B-HB-05 | bishop | search | 2.0958560736608143 | 2.0965525772520515 |  | OK |  |
| F3B-HB-05 | bishop | fixed | 2.324078639898878 | 2.341518927540367 | 2.3240961934818136 | OK (F6.8: envolvente completa) | |Δ cSlope| = 0.74 % > 0,5 %: cSlope usa la tangente de σ3 = 0 en bajo confinamiento; ogs coincide con el prototipo de la envolvente completa 2.324096 (+0.001 %) |
| F3B-HB-05 | spencer | search | 2.090739590523947 | 2.0915655541621567 |  | OK |  |
| F3B-HB-05 | spencer | fixed | 2.3410125229977368 | 2.3502932427401517 | 2.3410113108033306 | OK |  |
| F3B-HB-06 | bishop | search | 0.5243665673618269 | 0.5278775675258732 |  | OK |  |
| F3B-HB-06 | bishop | fixed | 0.5603457944547486 | 0.5618892862946161 | 0.5603591750249114 | OK |  |
| F3B-HB-06 | spencer | search | 0.5328142943767736 | 0.5426414201144181 |  | OK |  |
| F3B-HB-06 | spencer | fixed | 0.5750461753274969 | 0.5761687785082695 | 0.5750458281315887 | OK |  |
| F3B-HB-07 | bishop | search | 2.799495435059312 | 2.8125518957463873 |  | OK |  |
| F3B-HB-07 | bishop | fixed | 2.7996495311018252 | 2.8125518957463873 | 2.799661549325849 | OK |  |
| F3B-HB-07 | spencer | search | 2.8018736914061426 | 2.8111497623468744 |  | OK |  |
| F3B-HB-07 | spencer | fixed | 2.8031970682701774 | 2.8121059047901795 | 2.8031948762058274 | OK |  |
| F3B-HB-08 | bishop | search | 1.230504524566203 | 1.2393346067134332 |  | OK |  |
| F3B-HB-08 | bishop | fixed | 1.2391373860125927 | 1.2488134011253267 | 1.2391457342103986 | OK (F6.8: envolvente completa) | |Δ cSlope| = 0.77 % > 0,5 %: cSlope usa la tangente de σ3 = 0 en bajo confinamiento; ogs coincide con el prototipo de la envolvente completa 1.239146 (+0.001 %) |
| F3B-HB-08 | spencer | search | 1.2176504488974749 | 1.2310134075766346 |  | OK |  |
| F3B-HB-08 | spencer | fixed | 1.2398808937627743 | 1.2471791754688126 | 1.2398797880624928 | OK (F6.8: envolvente completa) | |Δ cSlope| = 0.59 % > 0,5 %: cSlope usa la tangente de σ3 = 0 en bajo confinamiento; ogs coincide con el prototipo de la envolvente completa 1.239880 (+0.000 %) |
| F3B-NC-V001 | spencer | search | 1.3838760786423974 | 1.3837204423582525 |  | OK |  |
| F3B-NC-V034a | spencer | search | 1.2649823216325031 | 1.2649251927651408 |  | OK |  |
| F3B-SH-OCR1 | bishop | search | 0.6250000007322929 | 0.6250261045392922 |  | OK |  |
| F3B-SH-OCR1 | bishop | fixed | 0.6822385279669482 | 0.6822607730327611 |  | OK |  |
| F3B-SH-OCR1 | spencer | search | 0.625000000732293 | 0.6250212039438209 |  | OK |  |
| F3B-SH-OCR1 | spencer | fixed | 0.6822398961644295 | 0.6822607730327611 |  | OK |  |
| F3B-SH-POP | bishop | search | 0.8031320926045149 | 0.8031259296941016 |  | OK |  |
| F3B-SH-POP | bishop | fixed | 0.8040681163068664 | 0.8040642710227669 |  | OK |  |
| F3B-SH-POP | spencer | search | 0.8031332389616765 | 0.8031259296941016 |  | OK |  |
| F3B-SH-POP | spencer | fixed | 0.804069636715796 | 0.8040642710227669 |  | OK |  |
