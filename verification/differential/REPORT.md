# Batería diferencial: ogs vs cSlope 0.1.0 (W9)

Generado: 2026-11-26T07:45:41-03:00 · casos: 14 · checks: 56 (búsqueda + superficie fija, bishop y spencer)

## Motores

- **ogs**: `target/release/ogs` · versión: ogs-core 0.1.0
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

Tiempo total: ogs 3.887 s · cSlope 1.985 s.

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
| D01 | bishop | search | 0.051 | 0.056 |
| D01 | bishop | fixed | 0.002 | 0.001 |
| D01 | spencer | search | 0.117 | 0.076 |
| D01 | spencer | fixed | 0.002 | 0.001 |
| D02 | bishop | search | 0.037 | 0.045 |
| D02 | bishop | fixed | 0.001 | 0.001 |
| D02 | spencer | search | 0.145 | 0.079 |
| D02 | spencer | fixed | 0.001 | 0.001 |
| D03 | bishop | search | 0.050 | 0.046 |
| D03 | bishop | fixed | 0.010 | 0.001 |
| D03 | spencer | search | 0.178 | 0.137 |
| D03 | spencer | fixed | 0.002 | 0.001 |
| D04 | bishop | search | 0.126 | 0.038 |
| D04 | bishop | fixed | 0.002 | 0.001 |
| D04 | spencer | search | 0.389 | 0.065 |
| D04 | spencer | fixed | 0.001 | 0.001 |
| D05 | bishop | search | 0.042 | 0.050 |
| D05 | bishop | fixed | 0.001 | 0.001 |
| D05 | spencer | search | 0.123 | 0.085 |
| D05 | spencer | fixed | 0.002 | 0.001 |
| D06 | bishop | search | 0.039 | 0.046 |
| D06 | bishop | fixed | 0.002 | 0.001 |
| D06 | spencer | search | 0.115 | 0.080 |
| D06 | spencer | fixed | 0.002 | 0.001 |
| D07 | bishop | search | 0.029 | 0.044 |
| D07 | bishop | fixed | 0.002 | 0.001 |
| D07 | spencer | search | 0.135 | 0.081 |
| D07 | spencer | fixed | 0.002 | 0.001 |
| D08 | bishop | search | 0.060 | 0.048 |
| D08 | bishop | fixed | 0.002 | 0.038 |
| D08 | spencer | search | 0.244 | 0.070 |
| D08 | spencer | fixed | 0.002 | 0.036 |
| D09 | bishop | search | 0.070 | 0.053 |
| D09 | bishop | fixed | 0.002 | 0.001 |
| D09 | spencer | search | 0.313 | 0.194 |
| D09 | spencer | fixed | 0.002 | 0.001 |
| D10 | bishop | search | 0.034 | 0.047 |
| D10 | bishop | fixed | 0.001 | 0.001 |
| D10 | spencer | search | 0.133 | 0.085 |
| D10 | spencer | fixed | 0.002 | 0.001 |
| D11 | bishop | search | 0.182 | 0.035 |
| D11 | bishop | fixed | 0.002 | 0.001 |
| D11 | spencer | search | 0.434 | 0.062 |
| D11 | spencer | fixed | 0.001 | 0.001 |
| D12 | bishop | search | 0.043 | 0.049 |
| D12 | bishop | fixed | 0.001 | 0.001 |
| D12 | spencer | search | 0.138 | 0.081 |
| D12 | spencer | fixed | 0.002 | 0.001 |
| D13 | bishop | search | 0.049 | 0.040 |
| D13 | bishop | fixed | 0.001 | 0.001 |
| D13 | spencer | search | 0.179 | 0.061 |
| D13 | spencer | fixed | 0.002 | 0.001 |
| D14 | bishop | search | 0.088 | 0.053 |
| D14 | bishop | fixed | 0.002 | 0.001 |
| D14 | spencer | search | 0.291 | 0.084 |
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

Se corre, sobre el círculo fijo de cada uno de los 14 modelos, Morgenstern-Price con la función `half_sine` y Janbu corregido, con el criterio de 0,5 % de E9b. Se agregan tres modelos v0.3 (`cases_f3/`): D15 terraplén sobre arcilla blanda con Su lineal, D16 depósito de relaves con Su constante y D17 bloque deslizante sobre una capa débil con polilínea fija (sin Bishop, F3.6). Cada capacidad que el motor aún no tiene se sondea antes con un modelo mínimo; el check que la necesita queda **pendiente**, nunca falla. El valor de cSlope de un check pendiente igual se calcula y queda como línea base.

| capacidad | soportada por el motor | detalle |
|---|---|---|
| undrained | sí | — |
| morgenstern_price | sí | — |
| janbu_corrected | sí | — |
| polyline | sí | — |

**OK 43/43** · FALLA 0 · sin dato 0 · pendiente 0 (de los OK, 1 por concordancia: ambos sin solución).

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

### Fallos y datos faltantes de la Fase 3a

Ninguno.

## Reproducir

```
export TMPDIR="$(mktemp -d)"
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/differential/run.py --ogs PATH_BINARIO_OGS
```
