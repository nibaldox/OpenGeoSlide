# Batería diferencial: ogs vs cSlope 0.1.0 (W9)

Generado: 2026-11-25T10:44:45-03:00 · casos: 14 · checks: 56 (búsqueda + superficie fija, bishop y spencer)

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

Tiempo total: ogs 4.122 s · cSlope 2.079 s.

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
| D01 | bishop | search | 0.037 | 0.063 |
| D01 | bishop | fixed | 0.002 | 0.001 |
| D01 | spencer | search | 0.119 | 0.095 |
| D01 | spencer | fixed | 0.002 | 0.001 |
| D02 | bishop | search | 0.037 | 0.055 |
| D02 | bishop | fixed | 0.002 | 0.001 |
| D02 | spencer | search | 0.166 | 0.091 |
| D02 | spencer | fixed | 0.002 | 0.001 |
| D03 | bishop | search | 0.052 | 0.051 |
| D03 | bishop | fixed | 0.002 | 0.001 |
| D03 | spencer | search | 0.169 | 0.094 |
| D03 | spencer | fixed | 0.002 | 0.001 |
| D04 | bishop | search | 0.118 | 0.037 |
| D04 | bishop | fixed | 0.002 | 0.001 |
| D04 | spencer | search | 0.406 | 0.065 |
| D04 | spencer | fixed | 0.002 | 0.001 |
| D05 | bishop | search | 0.042 | 0.054 |
| D05 | bishop | fixed | 0.002 | 0.001 |
| D05 | spencer | search | 0.134 | 0.095 |
| D05 | spencer | fixed | 0.002 | 0.001 |
| D06 | bishop | search | 0.040 | 0.052 |
| D06 | bishop | fixed | 0.002 | 0.001 |
| D06 | spencer | search | 0.124 | 0.085 |
| D06 | spencer | fixed | 0.002 | 0.001 |
| D07 | bishop | search | 0.029 | 0.048 |
| D07 | bishop | fixed | 0.002 | 0.001 |
| D07 | spencer | search | 0.142 | 0.081 |
| D07 | spencer | fixed | 0.002 | 0.001 |
| D08 | bishop | search | 0.060 | 0.056 |
| D08 | bishop | fixed | 0.002 | 0.037 |
| D08 | spencer | search | 0.264 | 0.074 |
| D08 | spencer | fixed | 0.002 | 0.037 |
| D09 | bishop | search | 0.070 | 0.052 |
| D09 | bishop | fixed | 0.002 | 0.001 |
| D09 | spencer | search | 0.364 | 0.182 |
| D09 | spencer | fixed | 0.002 | 0.001 |
| D10 | bishop | search | 0.035 | 0.054 |
| D10 | bishop | fixed | 0.002 | 0.001 |
| D10 | spencer | search | 0.144 | 0.091 |
| D10 | spencer | fixed | 0.002 | 0.001 |
| D11 | bishop | search | 0.189 | 0.036 |
| D11 | bishop | fixed | 0.002 | 0.001 |
| D11 | spencer | search | 0.460 | 0.069 |
| D11 | spencer | fixed | 0.002 | 0.001 |
| D12 | bishop | search | 0.045 | 0.058 |
| D12 | bishop | fixed | 0.002 | 0.001 |
| D12 | spencer | search | 0.152 | 0.091 |
| D12 | spencer | fixed | 0.002 | 0.001 |
| D13 | bishop | search | 0.050 | 0.044 |
| D13 | bishop | fixed | 0.002 | 0.001 |
| D13 | spencer | search | 0.200 | 0.065 |
| D13 | spencer | fixed | 0.002 | 0.001 |
| D14 | bishop | search | 0.091 | 0.057 |
| D14 | bishop | fixed | 0.002 | 0.001 |
| D14 | spencer | search | 0.335 | 0.091 |
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

## Reproducir

```
export TMPDIR="$(mktemp -d)"
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/differential/run.py --ogs PATH_BINARIO_OGS
```
