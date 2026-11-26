# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-26T05:57:38-03:00 · harness v1 · casos: `verification/pending/F3` (48 casos, 123 checks)

## Motores

- **ogs**: no se ejecutó (`--oracle-only`): estos casos esperan al motor; se verifica solo que cSlope reproduzca el valor publicado.
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | — | — | — (no aplica: solo oráculo) | — |
| cSlope | 123 | 0 | 0 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **123/123** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V001 | bishop | search | 1.4090 | — | — | 1.4041 | -0.35 | 2.04 | cSlope reproduce |
| V001 | morgenstern_price | search | 1.4140 | — | — | 1.4010 | -0.92 | 2.04 | cSlope reproduce |
| V001 | bishop | search | 1.4170 | — | — | 1.4041 | -0.91 | 2.04 | cSlope reproduce |
| V001 | morgenstern_price | search | 1.4140 | — | — | 1.4010 | -0.92 | 2.04 | cSlope reproduce |
| V003 | bishop | search | 1.1180 | — | — | 1.1130 | -0.44 | 2.04 | cSlope reproduce |
| V003 | spencer | search | 1.1180 | — | — | 1.1138 | -0.38 | 2.04 | cSlope reproduce |
| V003 | janbu_corrected | search | 1.1310 | — | — | 1.1289 | -0.18 | 2.04 | cSlope reproduce |
| V003 | bishop | search | 1.1120 | — | — | 1.1130 | +0.09 | 2.04 | cSlope reproduce |
| V004a | spencer | search | 2.7940 | — | — | 2.8020 | +0.28 | 2.02 | cSlope reproduce |
| V004a | janbu_simplified | search | 2.6620 | — | — | 2.6762 | +0.53 | 2.02 | cSlope reproduce |
| V004b | janbu_simplified | search | 2.6100 | — | — | 2.6089 | -0.04 | 2.19 | cSlope reproduce |
| V004b | spencer | search | 2.6960 | — | — | 2.6678 | -1.05 | 2.02 | cSlope reproduce |
| V006 | spencer | fixed | 1.3510 | — | — | 1.3520 | +0.07 | 1.04 | cSlope reproduce |
| V006 | janbu_simplified | fixed | 1.3510 | — | — | 1.3520 | +0.07 | 1.04 | cSlope reproduce |
| V007a | janbu_simplified | fixed | 1.4690 | — | — | 1.4683 | -0.04 | 1.03 | cSlope reproduce |
| V007b | janbu_simplified | search | 0.9570 | — | — | 0.9553 | -0.18 | 2.05 | cSlope reproduce |
| V007b | spencer | search | 0.9810 | — | — | 0.9776 | -0.35 | 2.05 | cSlope reproduce |
| V007c | janbu_simplified | search | 1.2910 | — | — | 1.2901 | -0.07 | 2.04 | cSlope reproduce |
| V018 | spencer | fixed | 1.0510 | — | — | 1.0520 | +0.10 | 1.05 | cSlope reproduce |
| V018 | morgenstern_price | fixed | 1.0090 | — | — | 1.0078 | -0.12 | 1.05 | cSlope reproduce |
| V018 | morgenstern_price | fixed | 1.0170 | — | — | 1.0078 | -0.91 | 1.05 | cSlope reproduce |
| V021a | morgenstern_price | fixed | 1.1320 | — | — | 1.1283 | -0.33 | 2.04 | cSlope reproduce |
| V021a | bishop | fixed | 1.1178 | — | — | 1.1283 | +0.94 | 2.00 | cSlope reproduce |
| V021a | bishop | fixed | 1.1280 | — | — | 1.1283 | +0.03 | 2.04 | cSlope reproduce |
| V021b | morgenstern_price | fixed | 1.1160 | — | — | 1.1098 | -0.56 | 2.04 | cSlope reproduce |
| V021b | bishop | fixed | 1.1088 | — | — | 1.1098 | +0.09 | 2.00 | cSlope reproduce |
| V021b | bishop | fixed | 1.1090 | — | — | 1.1098 | +0.07 | 2.05 | cSlope reproduce |
| V021c | morgenstern_price | fixed | 1.1100 | — | — | 1.1084 | -0.15 | 2.45 | cSlope reproduce |
| V021c | bishop | fixed | 1.1096 | — | — | 1.1084 | -0.11 | 2.00 | cSlope reproduce |
| V021c | bishop | fixed | 1.1080 | — | — | 1.1084 | +0.04 | 2.05 | cSlope reproduce |
| V021d | morgenstern_price | fixed | 1.0630 | — | — | 1.0580 | -0.47 | 2.05 | cSlope reproduce |
| V021d | bishop | fixed | 1.0639 | — | — | 1.0580 | -0.55 | 2.00 | cSlope reproduce |
| V021d | bishop | fixed | 1.0580 | — | — | 1.0580 | +0.00 | 2.05 | cSlope reproduce |
| V021e | morgenstern_price | fixed | 2.2480 | — | — | 2.2449 | -0.14 | 2.02 | cSlope reproduce |
| V021e | bishop | fixed | 2.2343 | — | — | 2.2449 | +0.48 | 2.00 | cSlope reproduce |
| V021e | bishop | fixed | 2.2450 | — | — | 2.2449 | -0.00 | 2.02 | cSlope reproduce |
| V021f | morgenstern_price | fixed | 2.1380 | — | — | 2.1281 | -0.46 | 2.02 | cSlope reproduce |
| V021f | bishop | fixed | 2.1396 | — | — | 2.1281 | -0.54 | 2.00 | cSlope reproduce |
| V021f | bishop | fixed | 2.1280 | — | — | 2.1281 | +0.00 | 2.02 | cSlope reproduce |
| V021g | morgenstern_price | fixed | 1.4220 | — | — | 1.4281 | +0.43 | 2.04 | cSlope reproduce |
| V021g | bishop | fixed | 1.4239 | — | — | 1.4279 | +0.28 | 2.00 | cSlope reproduce |
| V022a | morgenstern_price | fixed | 1.1580 | — | — | 1.1571 | -0.07 | 1.04 | cSlope reproduce |
| V022a | bishop | fixed | 1.1625 | — | — | 1.1586 | -0.34 | 1.00 | cSlope reproduce |
| V022a | bishop | fixed | 1.1600 | — | — | 1.1586 | -0.12 | 1.43 | cSlope reproduce |
| V022b | morgenstern_price | fixed | 1.1780 | — | — | 1.1746 | -0.29 | 1.04 | cSlope reproduce |
| V022b | bishop | fixed | 1.1850 | — | — | 1.1773 | -0.65 | 1.04 | cSlope reproduce |
| V034a | bishop | search | 1.3130 | — | — | 1.3060 | -0.53 | 2.04 | cSlope reproduce |
| V034a | spencer | search | 1.2760 | — | — | 1.2762 | +0.01 | 2.04 | cSlope reproduce |
| V034b | bishop | search | 1.3350 | — | — | 1.3299 | -0.38 | 2.04 | cSlope reproduce |
| V034b | spencer | search | 1.3280 | — | — | 1.3280 | +0.00 | 2.04 | cSlope reproduce |
| V036a | bishop | search | 0.7610 | — | — | 0.7568 | -0.56 | 2.07 | cSlope reproduce |
| V036a | spencer | search | 0.7560 | — | — | 0.7521 | -0.52 | 2.07 | cSlope reproduce |
| V036a | spencer | search | 0.7500 | — | — | 0.7521 | +0.28 | 2.67 | cSlope reproduce |
| V036b | bishop | search | 0.9090 | — | — | 0.9059 | -0.35 | 2.06 | cSlope reproduce |
| V036b | spencer | search | 0.8980 | — | — | 0.8982 | +0.02 | 2.06 | cSlope reproduce |
| V036b | spencer | search | 0.9000 | — | — | 0.8982 | -0.20 | 2.56 | cSlope reproduce |
| V036c | bishop | search | 1.0450 | — | — | 1.0425 | -0.24 | 2.05 | cSlope reproduce |
| V036c | spencer | search | 1.0320 | — | — | 1.0286 | -0.33 | 2.05 | cSlope reproduce |
| V036c | spencer | search | 1.0300 | — | — | 1.0286 | -0.14 | 2.49 | cSlope reproduce |
| V036d | bishop | search | 1.1540 | — | — | 1.1521 | -0.17 | 2.04 | cSlope reproduce |
| V036d | spencer | search | 1.1340 | — | — | 1.1315 | -0.22 | 2.04 | cSlope reproduce |
| V036d | spencer | search | 1.1300 | — | — | 1.1315 | +0.14 | 2.44 | cSlope reproduce |
| V040 | bishop | search | 1.4610 | — | — | 1.4593 | -0.12 | 3.03 | cSlope reproduce |
| V044 | bishop | fixed | 2.0800 | — | — | 2.0760 | -0.19 | 1.24 | cSlope reproduce |
| V044 | morgenstern_price | fixed | 2.0760 | — | — | 2.0717 | -0.21 | 1.02 | cSlope reproduce |
| V044 | spencer | fixed | 2.0730 | — | — | 2.0721 | -0.04 | 1.02 | cSlope reproduce |
| V044b | bishop | fixed | 1.7660 | — | — | 1.7595 | -0.37 | 1.03 | cSlope reproduce |
| V044b | morgenstern_price | fixed | 1.7640 | — | — | 1.7569 | -0.40 | 1.03 | cSlope reproduce |
| V044b | spencer | fixed | 1.7610 | — | — | 1.7576 | -0.19 | 1.03 | cSlope reproduce |
| V045 | bishop | fixed | 1.8340 | — | — | 1.8290 | -0.27 | 1.03 | cSlope reproduce |
| V045 | morgenstern_price | fixed | 1.8320 | — | — | 1.8267 | -0.29 | 1.03 | cSlope reproduce |
| V045 | spencer | fixed | 1.8300 | — | — | 1.8275 | -0.14 | 1.27 | cSlope reproduce |
| V046a | spencer | fixed | 1.3820 | — | — | 1.3794 | -0.19 | 1.04 | cSlope reproduce |
| V046a | morgenstern_price | fixed | 1.3700 | — | — | 1.3699 | -0.01 | 1.36 | cSlope reproduce |
| V046a | spencer | fixed | 1.3730 | — | — | 1.3794 | +0.47 | 1.04 | cSlope reproduce |
| V046b | spencer | fixed | 1.2450 | — | — | 1.2417 | -0.27 | 1.04 | cSlope reproduce |
| V046b | morgenstern_price | fixed | 1.2450 | — | — | 1.2349 | -0.81 | 1.04 | cSlope reproduce |
| V046c | spencer | fixed | 1.1240 | — | — | 1.1222 | -0.16 | 1.04 | cSlope reproduce |
| V046c | morgenstern_price | fixed | 1.1180 | — | — | 1.1125 | -0.49 | 1.04 | cSlope reproduce |
| V046c | spencer | fixed | 1.1180 | — | — | 1.1222 | +0.38 | 1.04 | cSlope reproduce |
| V047a | bishop | search | 0.9870 | — | — | 0.9851 | -0.19 | 2.05 | cSlope reproduce |
| V047a | spencer | search | 0.9860 | — | — | 0.9841 | -0.19 | 2.05 | cSlope reproduce |
| V047a | janbu_corrected | search | 0.9900 | — | — | 0.9855 | -0.46 | 2.51 | cSlope reproduce |
| V047a | morgenstern_price | search | 0.9910 | — | — | 0.9841 | -0.70 | 2.05 | cSlope reproduce |
| V047a | bishop | search | 0.9920 | — | — | 0.9851 | -0.70 | 2.05 | cSlope reproduce |
| V047a | spencer | search | 1.0000 | — | — | 0.9841 | -1.59 | 2.50 | cSlope reproduce |
| V049 | bishop | search | 1.4050 | — | — | 1.4029 | -0.15 | 2.04 | cSlope reproduce |
| V049 | spencer | search | 1.3750 | — | — | 1.3721 | -0.21 | 2.04 | cSlope reproduce |
| V049 | janbu_corrected | search | 1.3570 | — | — | 1.3550 | -0.15 | 2.04 | cSlope reproduce |
| V049 | morgenstern_price | search | 1.3820 | — | — | 1.3716 | -0.75 | 2.04 | cSlope reproduce |
| V049 | bishop | search | 1.4030 | — | — | 1.4029 | -0.01 | 2.04 | cSlope reproduce |
| V050a | janbu_corrected | fixed | 1.2940 | — | — | 1.2939 | -0.01 | 1.04 | cSlope reproduce |
| V050a | spencer | fixed | 1.2770 | — | — | 1.2762 | -0.06 | 1.04 | cSlope reproduce |
| V050a | morgenstern_price | fixed | 1.2610 | — | — | 1.2605 | -0.04 | 1.04 | cSlope reproduce |
| V052a | bishop | search | 1.9480 | — | — | 1.9483 | +0.01 | 2.03 | cSlope reproduce |
| V052a | spencer | search | 1.9480 | — | — | 1.9483 | +0.01 | 2.03 | cSlope reproduce |
| V052a | janbu_corrected | search | 1.9490 | — | — | 1.9520 | +0.16 | 2.03 | cSlope reproduce |
| V052a | bishop | search | 1.9510 | — | — | 1.9483 | -0.14 | 2.03 | cSlope reproduce |
| V052b | bishop | fixed | 2.2080 | — | — | 2.2064 | -0.07 | 1.02 | cSlope reproduce |
| V052b | spencer | fixed | 2.2920 | — | — | 2.2901 | -0.08 | 1.02 | cSlope reproduce |
| V052b | janbu_corrected | fixed | 2.0730 | — | — | 2.0728 | -0.01 | 1.02 | cSlope reproduce |
| V052b | morgenstern_price | fixed | 2.2990 | — | — | 2.2994 | +0.02 | 1.02 | cSlope reproduce |
| V056 | janbu_corrected | fixed | 0.4850 | — | — | 0.4995 | +2.98 | 3.10 | cSlope reproduce |
| V057a | spencer | search | 1.4600 | — | — | 1.4721 | +0.83 | 3.34 | cSlope reproduce |
| V057a | spencer | search | 1.4680 | — | — | 1.4721 | +0.28 | 2.03 | cSlope reproduce |
| V057b | spencer | search | 2.0400 | — | — | 2.0229 | -0.84 | 3.25 | cSlope reproduce |
| V057b | spencer | search | 2.0220 | — | — | 2.0229 | +0.05 | 2.02 | cSlope reproduce |
| V067 | bishop | search | 1.4390 | — | — | 1.4359 | -0.22 | 2.03 | cSlope reproduce |
| V068 | bishop | fixed | 1.1400 | — | — | 1.1429 | +0.25 | 2.44 | cSlope reproduce |
| V071b | bishop | search | 1.2930 | — | — | 1.2883 | -0.36 | 2.04 | cSlope reproduce |
| V071b | spencer | search | 1.3000 | — | — | 1.2944 | -0.43 | 2.38 | cSlope reproduce |
| V071b | janbu_simplified | search | 1.1510 | — | — | 1.1478 | -0.28 | 2.04 | cSlope reproduce |
| V077 | spencer | fixed | 0.9400 | — | — | 0.9428 | +0.30 | 1.53 | cSlope reproduce |
| V078 | morgenstern_price | fixed | 0.9600 | — | — | 0.9578 | -0.23 | 1.52 | cSlope reproduce |
| V086e | spencer | search | 1.2190 | — | — | 1.2044 | -1.20 | 2.04 | cSlope reproduce |
| V090 | bishop | fixed | 1.3320 | — | — | 1.3205 | -0.86 | 1.04 | cSlope reproduce |
| V090 | spencer | fixed | 1.3280 | — | — | 1.3167 | -0.85 | 1.04 | cSlope reproduce |
| V090 | janbu_corrected | fixed | 1.3450 | — | — | 1.3405 | -0.33 | 1.04 | cSlope reproduce |
| V090 | morgenstern_price | fixed | 1.3270 | — | — | 1.3164 | -0.80 | 1.04 | cSlope reproduce |
| V096d | spencer | fixed | 1.8360 | — | — | 1.8239 | -0.66 | 2.03 | cSlope reproduce |
| V096d | morgenstern_price | fixed | 1.8230 | — | — | 1.8084 | -0.80 | 2.03 | cSlope reproduce |
| V096e | spencer | fixed | 1.2110 | — | — | 1.2120 | +0.08 | 2.04 | cSlope reproduce |
| V096e | morgenstern_price | fixed | 1.1970 | — | — | 1.1969 | -0.01 | 2.04 | cSlope reproduce |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Notas de conversión

- V001 (bishop/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V001 (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V003 (bishop/search, spencer/search, janbu_corrected/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V004a (spencer/search, janbu_simplified/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V004b (janbu_simplified/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V007b (janbu_simplified/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V007c (janbu_simplified/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V018 (morgenstern_price/fixed): Morgenstern-Price con la función interslice data-point-specified (kebab-case de cSlope).
- V021a (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021b (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021c (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021d (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021e (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021f (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021g (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V022a (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V022b (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V034a (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V034b (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V036a (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V036b (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V036c (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V036d (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V040 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V044 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V044b (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V045 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V046a (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V046b (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V046c (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V047a (bishop/search, spencer/search, janbu_corrected/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V047a (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V049 (bishop/search, spencer/search, janbu_corrected/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V049 (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V050a (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V052a (bishop/search, spencer/search, janbu_corrected/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V052b (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V057a (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V057b (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V067 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V071b (bishop/search, spencer/search, janbu_simplified/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V078 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V086e (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V090 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V096d (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V096e (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
