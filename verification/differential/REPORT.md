# Batería diferencial: ogs vs cSlope 0.1.0 (línea base W7b)

Generado: 2026-11-24T23:33:53-03:00 · casos: 10 · checks: 40 (búsqueda + superficie fija, bishop y spencer)

## Motores

- **ogs**: `target/release/ogs` · versión: ogs-core 0.1.0
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Criterio (E9b, briefs/00_CONTRATOS.md §4.4.6)

- **Búsqueda**: `FS_ogs ≤ FS_cSlope · 1,01`, con el mismo método, número de dovelas y rangos. Un FS de ogs menor es más exhaustivo y se acepta.
- **Superficie fija**: `|FS_ogs − FS_cSlope| / FS_cSlope ≤ 0,5 %`, con el mismo círculo.
- El veredicto no detiene la batería: el exit code es 0 aunque haya fallos.

## Resumen

**búsqueda OK 19/20** · **fija OK 19/20**

| criterio | OK | FALLA | sin dato |
|---|---:|---:|---:|
| búsqueda | 19 | 1 | 0 |
| fija | 19 | 1 | 0 |

Tiempo total: ogs 7.219 s · cSlope 1.57 s.

## Tabla de línea base

| caso | método | búsqueda ogs | búsqueda cSlope | Δ% búsqueda | fija ogs | fija cSlope | Δ% fija | veredicto |
|---|---|---:|---:|---:|---:|---:|---:|---|
| D01 Talud homogéneo 1:1, seco | bishop | 0.8586 | 0.8585 | +0.00 | 0.8586 | 0.8585 | +0.00 | OK |
| D01 Talud homogéneo 1:1, seco | spencer | 0.8554 | 0.8553 | +0.01 | 0.8555 | 0.8554 | +0.01 | OK |
| D02 Talud 1:1 con r_u = 0,5 | bishop | 0.3678 | 0.3677 | +0.02 | 0.3678 | 0.3677 | +0.02 | OK |
| D02 Talud 1:1 con r_u = 0,5 | spencer | 0.3851 | 0.3850 | +0.01 | 0.3872 | 0.3871 | +0.02 | OK |
| D03 Dos capas con capa débil en la base | bishop | 0.5196 | 0.5185 | +0.21 | 0.5196 | 0.5187 | +0.18 | OK |
| D03 Dos capas con capa débil en la base | spencer | 0.5560 | 0.5467 | +1.71 | 2.8354 | — | — | FALLA (búsqueda, fija) |
| D04 Pared de rajo, 3 bancos | bishop | 1.5986 | 1.5985 | +0.01 | 1.5986 | 1.5985 | +0.01 | OK |
| D04 Pared de rajo, 3 bancos | spencer | 1.5923 | 1.5921 | +0.01 | 1.5923 | 1.5922 | +0.01 | OK |
| D05 Botadero, ángulo de reposo 37° | bishop | 1.0063 | 1.0005 | +0.58 | 1.0063 | 1.0063 | -0.00 | OK |
| D05 Botadero, ángulo de reposo 37° | spencer | 1.0063 | 1.0005 | +0.58 | 1.0063 | 1.0063 | +0.00 | OK |
| D06 Talud con piezométrica inclinada | bishop | 0.7156 | 0.7154 | +0.03 | 0.7156 | 0.7154 | +0.03 | OK |
| D06 Talud con piezométrica inclinada | spencer | 0.7148 | 0.7146 | +0.03 | 0.7148 | 0.7146 | +0.03 | OK |
| D07 Arcilla blanda, φ = 0 | bishop | 1.0519 | 1.0504 | +0.14 | 1.0519 | 1.0517 | +0.03 | OK |
| D07 Arcilla blanda, φ = 0 | spencer | 1.0519 | 1.0504 | +0.14 | 1.0519 | 1.0517 | +0.03 | OK |
| D08 Presa simétrica con rangos de búsqueda | bishop | 1.6057 | 1.6057 | +0.00 | 1.6057 | 1.6057 | +0.00 | OK |
| D08 Presa simétrica con rangos de búsqueda | spencer | 1.6041 | 1.6040 | +0.00 | 1.6041 | 1.6041 | +0.00 | OK |
| D09 Talud R2-03 (c = 2, φ = 45°, r_u = 0,65) | bishop | 0.3309 | 0.3307 | +0.06 | 0.3408 | 0.3407 | +0.03 | OK |
| D09 Talud R2-03 (c = 2, φ = 45°, r_u = 0,65) | spencer | 0.3877 | 0.3876 | +0.03 | 0.4322 | 0.4322 | +0.01 | OK |
| D10 Talud con c alto y φ bajo, círculo profundo | bishop | 1.0440 | 1.0436 | +0.04 | 1.0440 | 1.0436 | +0.04 | OK |
| D10 Talud con c alto y φ bajo, círculo profundo | spencer | 1.0428 | 1.0424 | +0.03 | 1.0428 | 1.0424 | +0.03 | OK |

Δ% = (FS_ogs − FS_cSlope) / FS_cSlope · 100. El veredicto de la fila combina las dos comprobaciones.

## Fallos y motivos

- D03 spencer/search: **FALLA**. ogs 0.5560 > cSlope·1,01 = 0.5521 (ogs no conservador)
- D03 spencer/fixed: **FALLA**. ogs no válido (status not_converged, FS 2.8354268575855888)

## Tiempos por check

| caso | método | tipo | ogs s | cSlope s |
|---|---|---|---:|---:|
| D01 | bishop | search | 0.037 | 0.061 |
| D01 | bishop | fixed | 0.002 | 0.001 |
| D01 | spencer | search | 0.686 | 0.086 |
| D01 | spencer | fixed | 0.002 | 0.001 |
| D02 | bishop | search | 0.037 | 0.052 |
| D02 | bishop | fixed | 0.002 | 0.001 |
| D02 | spencer | search | 0.701 | 0.091 |
| D02 | spencer | fixed | 0.002 | 0.001 |
| D03 | bishop | search | 0.052 | 0.052 |
| D03 | bishop | fixed | 0.002 | 0.001 |
| D03 | spencer | search | 1.099 | 0.097 |
| D03 | spencer | fixed | 0.002 | 0.001 |
| D04 | bishop | search | 0.076 | 0.037 |
| D04 | bishop | fixed | 0.002 | 0.001 |
| D04 | spencer | search | 1.124 | 0.067 |
| D04 | spencer | fixed | 0.002 | 0.001 |
| D05 | bishop | search | 0.041 | 0.054 |
| D05 | bishop | fixed | 0.002 | 0.001 |
| D05 | spencer | search | 0.169 | 0.095 |
| D05 | spencer | fixed | 0.002 | 0.001 |
| D06 | bishop | search | 0.039 | 0.051 |
| D06 | bishop | fixed | 0.002 | 0.001 |
| D06 | spencer | search | 0.406 | 0.091 |
| D06 | spencer | fixed | 0.002 | 0.001 |
| D07 | bishop | search | 0.029 | 0.047 |
| D07 | bishop | fixed | 0.002 | 0.001 |
| D07 | spencer | search | 0.338 | 0.085 |
| D07 | spencer | fixed | 0.002 | 0.001 |
| D08 | bishop | search | 0.059 | 0.053 |
| D08 | bishop | fixed | 0.002 | 0.036 |
| D08 | spencer | search | 0.252 | 0.075 |
| D08 | spencer | fixed | 0.002 | 0.036 |
| D09 | bishop | search | 0.053 | 0.053 |
| D09 | bishop | fixed | 0.002 | 0.001 |
| D09 | spencer | search | 0.418 | 0.187 |
| D09 | spencer | fixed | 0.002 | 0.001 |
| D10 | bishop | search | 0.035 | 0.054 |
| D10 | bishop | fixed | 0.002 | 0.001 |
| D10 | spencer | search | 1.536 | 0.094 |
| D10 | spencer | fixed | 0.002 | 0.001 |

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

## Errores y rechazos de motor

- D03 spencer/fixed cSlope: EngineError: No valid slip surface was found. Moment and force equilibrium do not meet where the surface enters the slope at 90°: cohesion along a nearly vertical base can only hold it with tension at the base. A 

## Reproducir

```
export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/differential/run.py --ogs PATH_BINARIO_OGS
```
