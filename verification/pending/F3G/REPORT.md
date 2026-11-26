# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-26T17:34:18-03:00 · harness v1 · casos: `verification/pending/F3G` (32 casos, 81 checks)

## Motores

- **ogs**: no se ejecutó (`--oracle-only`): estos casos esperan al motor; se verifica solo que cSlope reproduzca el valor publicado.
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | — | — | — (no aplica: solo oráculo) | — |
| cSlope | 81 | 0 | 0 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **81/81** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V009a | spencer | fixed | 1.9250 | — | — | 1.9260 | +0.05 | 1.03 | cSlope reproduce |
| V023 | spencer | fixed | 1.1450 | — | — | 1.1381 | -0.60 | 1.04 | cSlope reproduce |
| V024 | bishop | fixed | 1.5630 | — | — | 1.5717 | +0.56 | 1.03 | cSlope reproduce |
| V024 | spencer | fixed | 1.5570 | — | — | 1.5622 | +0.33 | 1.03 | cSlope reproduce |
| V024 | bishop | fixed | 1.5700 | — | — | 1.5717 | +0.11 | 1.32 | cSlope reproduce |
| V024 | bishop | fixed | 1.5720 | — | — | 1.5717 | -0.02 | 1.03 | cSlope reproduce |
| V038 | bishop | search | 1.0900 | — | — | 1.0693 | -1.90 | 2.46 | cSlope reproduce |
| V038 | spencer | search | 1.1000 | — | — | 1.0771 | -2.09 | 2.45 | cSlope reproduce |
| V038 | bishop | search | 1.0700 | — | — | 1.0693 | -0.06 | 2.47 | cSlope reproduce |
| V038b | spencer | search | 1.1600 | — | — | 1.1578 | -0.19 | 2.43 | cSlope reproduce |
| V041a | bishop | search | 1.6030 | — | — | 1.5965 | -0.40 | 2.03 | cSlope reproduce |
| V041a | spencer | search | 1.5990 | — | — | 1.5937 | -0.33 | 2.03 | cSlope reproduce |
| V041a | spencer | search | 1.6000 | — | — | 1.5937 | -0.39 | 2.31 | cSlope reproduce |
| V041b | bishop | search | 1.6030 | — | — | 1.5964 | -0.41 | 2.03 | cSlope reproduce |
| V041b | spencer | search | 1.5990 | — | — | 1.5931 | -0.37 | 2.03 | cSlope reproduce |
| V041b | spencer | search | 1.6000 | — | — | 1.5931 | -0.43 | 2.31 | cSlope reproduce |
| V042 | bishop | fixed | 1.5840 | — | — | 1.5820 | -0.13 | 1.03 | cSlope reproduce |
| V042 | spencer | fixed | 1.6480 | — | — | 1.6492 | +0.07 | 1.03 | cSlope reproduce |
| V047b | bishop | search | 1.6640 | — | — | 1.6591 | -0.30 | 2.03 | cSlope reproduce |
| V047b | morgenstern_price | search | 1.6600 | — | — | 1.6560 | -0.24 | 2.30 | cSlope reproduce |
| V048 | bishop | search | 1.5960 | — | — | 1.5869 | -0.57 | 2.03 | cSlope reproduce |
| V048 | spencer | search | 1.5920 | — | — | 1.5824 | -0.60 | 2.03 | cSlope reproduce |
| V048 | janbu_corrected | search | 1.4890 | — | — | 1.4748 | -0.95 | 2.03 | cSlope reproduce |
| V058 | spencer | search | 1.9000 | — | — | 1.9152 | +0.80 | 5.00 | cSlope reproduce |
| V058 | spencer | search | 1.9150 | — | — | 1.9152 | +0.01 | 2.03 | cSlope reproduce |
| V061 | morgenstern_price | fixed | 2.3600 | — | — | 2.3483 | -0.49 | 1.21 | cSlope reproduce |
| V061 | morgenstern_price | fixed | 2.3430 | — | — | 2.3483 | +0.23 | 1.02 | cSlope reproduce |
| V061 | spencer | fixed | 2.3830 | — | — | 2.3879 | +0.21 | 1.02 | cSlope reproduce |
| V070 | bishop | search | 1.4170 | — | — | 1.4147 | -0.17 | 2.04 | cSlope reproduce |
| V070 | bishop | search | 1.4100 | — | — | 1.4147 | +0.33 | 3.35 | cSlope reproduce |
| V070 | spencer | search | 1.4220 | — | — | 1.4210 | -0.07 | 2.04 | cSlope reproduce |
| V072a | bishop | fixed | 1.2850 | — | — | 1.2821 | -0.23 | 1.04 | cSlope reproduce |
| V072a | spencer | fixed | 1.2900 | — | — | 1.2875 | -0.19 | 1.39 | cSlope reproduce |
| V072b | bishop | search | 1.2850 | — | — | 1.2815 | -0.27 | 2.04 | cSlope reproduce |
| V072b | spencer | search | 1.2900 | — | — | 1.2871 | -0.22 | 2.39 | cSlope reproduce |
| V072b | janbu_simplified | search | 1.1410 | — | — | 1.1352 | -0.51 | 2.04 | cSlope reproduce |
| V073 | bishop | search | 1.4170 | — | — | 1.4099 | -0.50 | 2.04 | cSlope reproduce |
| V073 | spencer | search | 1.4220 | — | — | 1.4146 | -0.52 | 2.04 | cSlope reproduce |
| V079 | janbu_simplified | fixed | 1.0490 | — | — | 1.0483 | -0.07 | 1.05 | cSlope reproduce |
| V079 | spencer | fixed | 1.0490 | — | — | 1.0483 | -0.07 | 1.05 | cSlope reproduce |
| V080 | morgenstern_price | fixed | 1.0490 | — | — | 1.0490 | -0.00 | 1.05 | cSlope reproduce |
| V080 | spencer | fixed | 1.0490 | — | — | 1.0490 | -0.00 | 1.05 | cSlope reproduce |
| V082a | bishop | fixed | 1.5320 | — | — | 1.5204 | -0.76 | 2.03 | cSlope reproduce |
| V082a | spencer | fixed | 1.5320 | — | — | 1.5196 | -0.81 | 2.03 | cSlope reproduce |
| V082a | morgenstern_price | fixed | 1.5320 | — | — | 1.5196 | -0.81 | 2.03 | cSlope reproduce |
| V082a | janbu_corrected | fixed | 1.5440 | — | — | 1.5333 | -0.69 | 2.03 | cSlope reproduce |
| V082b | bishop | fixed | 1.5110 | — | — | 1.4994 | -0.77 | 2.03 | cSlope reproduce |
| V082b | spencer | fixed | 1.5100 | — | — | 1.4985 | -0.76 | 2.33 | cSlope reproduce |
| V082b | morgenstern_price | fixed | 1.5100 | — | — | 1.4986 | -0.76 | 2.33 | cSlope reproduce |
| V082b | janbu_corrected | fixed | 1.5200 | — | — | 1.5088 | -0.74 | 2.33 | cSlope reproduce |
| V085 | bishop | search | 1.7620 | — | — | 1.7591 | -0.16 | 2.03 | cSlope reproduce |
| V085 | spencer | search | 1.7580 | — | — | 1.7591 | +0.06 | 2.03 | cSlope reproduce |
| V085 | janbu_corrected | search | 1.7360 | — | — | 1.7352 | -0.04 | 2.03 | cSlope reproduce |
| V085 | janbu_simplified | search | 1.6280 | — | — | 1.6269 | -0.07 | 2.03 | cSlope reproduce |
| V086b-auto | spencer | search | 0.9750 | — | — | 0.9665 | -0.88 | 2.05 | cSlope reproduce |
| V086b | spencer | search | 0.9750 | — | — | 0.9683 | -0.69 | 2.05 | cSlope reproduce |
| V086b | morgenstern_price | search | 0.9750 | — | — | 0.9683 | -0.69 | 2.05 | cSlope reproduce |
| V086c | spencer | search | 1.2090 | — | — | 1.2064 | -0.21 | 2.04 | cSlope reproduce |
| V086c | morgenstern_price | search | 1.2180 | — | — | 1.2151 | -0.23 | 2.04 | cSlope reproduce |
| V086d | spencer | search | 0.9810 | — | — | 0.9730 | -0.82 | 2.05 | cSlope reproduce |
| V088 | spencer | fixed | 2.4450 | — | — | 2.4416 | -0.14 | 2.02 | cSlope reproduce |
| V088 | bishop | fixed | 2.4470 | — | — | 2.4423 | -0.19 | 2.02 | cSlope reproduce |
| V088 | janbu_corrected | fixed | 2.4300 | — | — | 2.4438 | +0.57 | 2.21 | cSlope reproduce |
| V088 | morgenstern_price | fixed | 2.4470 | — | — | 2.4416 | -0.22 | 2.02 | cSlope reproduce |
| V089 | bishop | fixed | 2.7160 | — | — | 2.6982 | -0.65 | 2.02 | cSlope reproduce |
| V089 | spencer | fixed | 2.7360 | — | — | 2.7208 | -0.56 | 2.02 | cSlope reproduce |
| V089 | janbu_corrected | fixed | 2.6500 | — | — | 2.6473 | -0.10 | 2.19 | cSlope reproduce |
| V089 | morgenstern_price | fixed | 2.7440 | — | — | 2.7270 | -0.62 | 2.02 | cSlope reproduce |
| V091 | bishop | fixed | 1.2410 | — | — | 1.2364 | -0.37 | 1.04 | cSlope reproduce |
| V091 | spencer | fixed | 1.2410 | — | — | 1.2364 | -0.37 | 1.04 | cSlope reproduce |
| V091 | morgenstern_price | fixed | 1.2440 | — | — | 1.2364 | -0.61 | 1.04 | cSlope reproduce |
| V091 | janbu_corrected | fixed | 1.3850 | — | — | 1.3905 | +0.40 | 1.04 | cSlope reproduce |
| V092 | janbu_corrected | fixed | 1.8300 | — | — | 1.8232 | -0.37 | 2.27 | cSlope reproduce |
| V096a | bishop | search | 1.8040 | — | — | 1.7935 | -0.58 | 2.03 | cSlope reproduce |
| V096a | spencer | search | 1.8040 | — | — | 1.7944 | -0.53 | 2.03 | cSlope reproduce |
| V096a | morgenstern_price | search | 1.7900 | — | — | 1.7800 | -0.56 | 2.28 | cSlope reproduce |
| V096b | bishop | search | 1.1760 | — | — | 1.1734 | -0.22 | 2.04 | cSlope reproduce |
| V096b | spencer | search | 1.1890 | — | — | 1.1868 | -0.19 | 2.04 | cSlope reproduce |
| V096b | morgenstern_price | search | 1.1740 | — | — | 1.1720 | -0.17 | 2.04 | cSlope reproduce |
| V096c | spencer | fixed | 1.8040 | — | — | 1.7997 | -0.24 | 1.03 | cSlope reproduce |
| V096c | bishop | fixed | 1.8040 | — | — | 1.7992 | -0.26 | 1.03 | cSlope reproduce |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Notas de conversión

- V038 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V038b (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V041a (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V041b (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V047b (bishop/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V047b (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V048 (bishop/search, spencer/search, janbu_corrected/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V058 (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V061 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V070 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V072b (bishop/search, spencer/search, janbu_simplified/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V073 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V080 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V082a (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V082b (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V085 (bishop/search, spencer/search, janbu_corrected/search, janbu_simplified/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V086b-auto (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V086b (spencer/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V086b (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V086c (spencer/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V086c (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V086d (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V088 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V089 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V091 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V096a (bishop/search, spencer/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V096a (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V096b (bishop/search, spencer/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V096b (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
