# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-26T07:45:34-03:00 · harness v1 · casos: `verification/cases` (93 casos, 213 checks)

## Motores

- **ogs**: binario `target/release/ogs` · versión: ogs-core 0.1.0
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | 213 | 0 | 0 | 0 |
| cSlope | 212 | 0 | 0 | 1 |

cSlope reproduce el valor publicado dentro de tolerancia en **212/213** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V001 | bishop | search | 1.4090 | 1.4044 | -0.32 | 1.4041 | -0.35 | 2.04 | OK |
| V001 | morgenstern_price | search | 1.4140 | 1.4013 | -0.90 | 1.4010 | -0.92 | 2.04 | OK |
| V001 | bishop | search | 1.4170 | 1.4044 | -0.89 | 1.4041 | -0.91 | 2.04 | OK |
| V001 | morgenstern_price | search | 1.4140 | 1.4013 | -0.90 | 1.4010 | -0.92 | 2.04 | OK |
| V002 | bishop | search | 0.4200 | 0.4193 | -0.17 | 0.4192 | -0.18 | 3.19 | OK |
| V003 | bishop | search | 1.1180 | 1.1141 | -0.35 | 1.1130 | -0.44 | 2.04 | OK |
| V003 | spencer | search | 1.1180 | 1.1148 | -0.29 | 1.1138 | -0.38 | 2.04 | OK |
| V003 | janbu_corrected | search | 1.1310 | 1.1307 | -0.02 | 1.1289 | -0.18 | 2.04 | OK |
| V003 | bishop | search | 1.1120 | 1.1141 | +0.19 | 1.1130 | +0.09 | 2.04 | OK |
| V004a | spencer | search | 2.7940 | 2.8026 | +0.31 | 2.8020 | +0.28 | 2.02 | OK |
| V004a | janbu_simplified | search | 2.6620 | 2.6863 | +0.91 | 2.6762 | +0.53 | 2.02 | OK |
| V004b | janbu_simplified | search | 2.6100 | 2.6111 | +0.04 | 2.6089 | -0.04 | 2.19 | OK |
| V004b | spencer | search | 2.6960 | 2.6672 | -1.07 | 2.6678 | -1.05 | 2.02 | OK |
| V005 | bishop | search | 2.5000 | 2.5102 | +0.41 | 2.5058 | +0.23 | 2.20 | OK |
| V005 | spencer | search | 2.5000 | 2.5102 | +0.41 | 2.5058 | +0.23 | 2.20 | OK |
| V006 | spencer | fixed | 1.3510 | 1.3520 | +0.07 | 1.3520 | +0.07 | 1.04 | OK |
| V006 | janbu_simplified | fixed | 1.3510 | 1.3520 | +0.07 | 1.3520 | +0.07 | 1.04 | OK |
| V007a | janbu_simplified | fixed | 1.4690 | 1.4686 | -0.02 | 1.4683 | -0.04 | 1.03 | OK |
| V007b | janbu_simplified | search | 0.9570 | 0.9554 | -0.17 | 0.9553 | -0.18 | 2.05 | OK |
| V007b | spencer | search | 0.9810 | 0.9776 | -0.34 | 0.9776 | -0.35 | 2.05 | OK |
| V007c | janbu_simplified | search | 1.2910 | 1.2903 | -0.05 | 1.2901 | -0.07 | 2.04 | OK |
| V008a | spencer | search | 1.5360 | 1.5190 | -1.11 | 1.5188 | -1.12 | 2.03 | OK |
| V008b | spencer | search | 1.3660 | 1.3648 | -0.09 | 1.3647 | -0.10 | 2.04 | OK |
| V013a | bishop | search | 1.1400 | 1.1430 | +0.26 | 1.1429 | +0.25 | 2.44 | OK |
| V013a | bishop | search | 1.1300 | 1.1430 | +1.15 | 1.1429 | +1.14 | 2.44 | OK |
| V016a | bishop | fixed | 1.7870 | 1.7911 | +0.23 | 1.7905 | +0.19 | 1.03 | OK |
| V016a | spencer | fixed | 1.7910 | 1.7981 | +0.40 | 1.7975 | +0.36 | 1.03 | OK |
| V016a | bishop | fixed | 1.7900 | 1.7911 | +0.06 | 1.7905 | +0.03 | 1.28 | OK |
| V016c | bishop | fixed | 1.7900 | 1.7911 | +0.06 | 1.7904 | +0.02 | 1.28 | OK |
| V018 | spencer | fixed | 1.0510 | 1.0520 | +0.10 | 1.0520 | +0.10 | 1.05 | OK |
| V018 | morgenstern_price | fixed | 1.0090 | 1.0078 | -0.12 | 1.0078 | -0.12 | 1.05 | OK |
| V018 | morgenstern_price | fixed | 1.0170 | 1.0078 | -0.91 | 1.0078 | -0.91 | 1.05 | OK |
| V019 | spencer | search | 1.3800 | 1.3987 | +1.36 | 1.3985 | +1.34 | 2.36 | OK |
| V019 | spencer | search | 1.3830 | 1.3986 | +1.13 | 1.3985 | +1.12 | 2.04 | OK |
| V019 | spencer | search | 1.3980 | 1.3987 | +0.05 | 1.3985 | +0.04 | 2.04 | OK |
| V019 | bishop | search | 1.4010 | 1.4012 | +0.01 | 1.4009 | -0.00 | 2.04 | OK |
| V020 | spencer | search | 1.3360 | 1.3330 | -0.22 | 1.3329 | -0.23 | 2.04 | OK |
| V020 | spencer | search | 1.3300 | 1.3330 | +0.23 | 1.3329 | +0.22 | 2.38 | OK |
| V020 | spencer | search | 1.3380 | 1.3330 | -0.37 | 1.3329 | -0.38 | 2.04 | OK |
| V020 | bishop | search | 1.3420 | 1.3374 | -0.34 | 1.3373 | -0.35 | 2.04 | OK |
| V021a | morgenstern_price | fixed | 1.1320 | 1.1286 | -0.30 | 1.1283 | -0.33 | 2.04 | OK |
| V021a | bishop | fixed | 1.1178 | 1.1286 | +0.96 | 1.1283 | +0.94 | 2.00 | OK |
| V021a | bishop | fixed | 1.1280 | 1.1285 | +0.04 | 1.1283 | +0.03 | 2.04 | OK |
| V021b | morgenstern_price | fixed | 1.1160 | 1.1101 | -0.53 | 1.1098 | -0.56 | 2.04 | OK |
| V021b | bishop | fixed | 1.1088 | 1.1101 | +0.12 | 1.1098 | +0.09 | 2.00 | OK |
| V021b | bishop | fixed | 1.1090 | 1.1100 | +0.09 | 1.1098 | +0.07 | 2.05 | OK |
| V021c | morgenstern_price | fixed | 1.1100 | 1.1087 | -0.12 | 1.1084 | -0.15 | 2.45 | OK |
| V021c | bishop | fixed | 1.1096 | 1.1087 | -0.08 | 1.1084 | -0.11 | 2.00 | OK |
| V021c | bishop | fixed | 1.1080 | 1.1087 | +0.06 | 1.1084 | +0.04 | 2.05 | OK |
| V021d | morgenstern_price | fixed | 1.0630 | 1.0583 | -0.44 | 1.0580 | -0.47 | 2.05 | OK |
| V021d | bishop | fixed | 1.0639 | 1.0583 | -0.52 | 1.0580 | -0.55 | 2.00 | OK |
| V021d | bishop | fixed | 1.0580 | 1.0583 | +0.03 | 1.0580 | +0.00 | 2.05 | OK |
| V021e | morgenstern_price | fixed | 2.2480 | 2.2455 | -0.11 | 2.2449 | -0.14 | 2.02 | OK |
| V021e | bishop | fixed | 2.2343 | 2.2455 | +0.50 | 2.2449 | +0.48 | 2.00 | OK |
| V021e | bishop | fixed | 2.2450 | 2.2455 | +0.02 | 2.2449 | -0.00 | 2.02 | OK |
| V021f | morgenstern_price | fixed | 2.1380 | 2.1287 | -0.43 | 2.1281 | -0.46 | 2.02 | OK |
| V021f | bishop | fixed | 2.1396 | 2.1287 | -0.51 | 2.1281 | -0.54 | 2.00 | OK |
| V021f | bishop | fixed | 2.1280 | 2.1287 | +0.03 | 2.1281 | +0.00 | 2.02 | OK |
| V021g | morgenstern_price | fixed | 1.4220 | 1.4286 | +0.46 | 1.4281 | +0.43 | 2.04 | OK |
| V021g | bishop | fixed | 1.4239 | 1.4284 | +0.31 | 1.4279 | +0.28 | 2.00 | OK |
| V022a | morgenstern_price | fixed | 1.1580 | 1.1573 | -0.06 | 1.1571 | -0.07 | 1.04 | OK |
| V022a | bishop | fixed | 1.1625 | 1.1587 | -0.33 | 1.1586 | -0.34 | 1.00 | OK |
| V022a | bishop | fixed | 1.1600 | 1.1586 | -0.12 | 1.1586 | -0.12 | 1.43 | OK |
| V022b | morgenstern_price | fixed | 1.1780 | 1.1756 | -0.20 | 1.1746 | -0.29 | 1.04 | OK |
| V022b | bishop | fixed | 1.1850 | 1.1780 | -0.59 | 1.1773 | -0.65 | 1.04 | OK |
| V025 | bishop | search | 1.1420 | 1.1328 | -0.80 | 1.1323 | -0.85 | 2.04 | OK |
| V025 | spencer | search | 1.1420 | 1.1330 | -0.79 | 1.1325 | -0.83 | 2.04 | OK |
| V026 | bishop | search | 1.2280 | 1.2213 | -0.54 | 1.2198 | -0.67 | 2.04 | OK |
| V026 | bishop | search | 1.2200 | 1.2213 | +0.11 | 1.2198 | -0.02 | 2.41 | OK |
| V026 | spencer | search | 1.1900 | 1.1965 | +0.55 | 1.1949 | +0.41 | 2.42 | OK |
| V027 | spencer | search | 1.1240 | 1.1369 | +1.15 | 1.1344 | +0.93 | 2.04 | OK · cSlope no convergido |
| V028 | spencer | search | 1.1240 | 1.1250 | +0.09 | 1.1235 | -0.04 | 2.04 | OK |
| V029 | bishop | search | 1.1250 | 1.1201 | -0.44 | 1.1183 | -0.60 | 2.04 | OK |
| V029 | spencer | search | 1.1190 | 1.1201 | +0.10 | 1.1183 | -0.07 | 2.04 | OK |
| V030 | bishop | search | 1.4120 | 1.4129 | +0.06 | 1.4083 | -0.26 | 2.04 | OK |
| V030 | spencer | search | 1.4000 | 1.4028 | +0.20 | 1.3989 | -0.08 | 2.36 | OK |
| V031a | bishop | fixed | 2.5490 | 2.5339 | -0.59 | 2.5336 | -0.60 | 1.02 | OK |
| V031a | spencer | fixed | 2.5450 | 2.5309 | -0.55 | 2.5306 | -0.57 | 1.02 | OK |
| V031a | spencer | fixed | 2.5600 | 2.5309 | -1.14 | 2.5306 | -1.15 | 1.20 | OK |
| V031b | bishop | fixed | 1.3980 | 1.3895 | -0.61 | 1.3894 | -0.62 | 1.04 | OK |
| V031b | spencer | fixed | 1.3590 | 1.3521 | -0.51 | 1.3519 | -0.52 | 1.04 | OK |
| V031b | spencer | fixed | 1.3500 | 1.3521 | +0.15 | 1.3519 | +0.14 | 1.37 | OK |
| V032b | bishop | search | 1.1550 | 1.1547 | -0.03 | 1.1548 | -0.02 | 2.04 | OK |
| V032b | spencer | search | 1.1550 | 1.1547 | -0.03 | 1.1548 | -0.02 | 2.04 | OK |
| V032b | spencer | search | 1.1500 | 1.1547 | +0.41 | 1.1548 | +0.41 | 2.43 | OK |
| V033 | bishop | search | 1.5330 | 1.5217 | -0.74 | 1.5209 | -0.79 | 2.03 | OK |
| V033 | spencer | search | 1.5290 | 1.5336 | +0.30 | 1.5328 | +0.25 | 2.03 | OK |
| V034a | bishop | search | 1.3130 | 1.3062 | -0.51 | 1.3060 | -0.53 | 2.04 | OK |
| V034a | spencer | search | 1.2760 | 1.2768 | +0.06 | 1.2762 | +0.01 | 2.04 | OK |
| V034b | bishop | search | 1.3350 | 1.3304 | -0.35 | 1.3299 | -0.38 | 2.04 | OK |
| V034b | spencer | search | 1.3280 | 1.3286 | +0.04 | 1.3280 | +0.00 | 2.04 | OK |
| V036a | bishop | search | 0.7610 | 0.7604 | -0.08 | 0.7568 | -0.56 | 2.07 | OK |
| V036a | spencer | search | 0.7560 | 0.7564 | +0.05 | 0.7521 | -0.52 | 2.07 | OK |
| V036a | spencer | search | 0.7500 | 0.7564 | +0.85 | 0.7521 | +0.28 | 2.67 | OK |
| V036b | bishop | search | 0.9090 | 0.9083 | -0.07 | 0.9059 | -0.35 | 2.06 | OK |
| V036b | spencer | search | 0.8980 | 0.9011 | +0.35 | 0.8982 | +0.02 | 2.06 | OK |
| V036b | spencer | search | 0.9000 | 0.9011 | +0.13 | 0.8982 | -0.20 | 2.56 | OK |
| V036c | bishop | search | 1.0450 | 1.0424 | -0.25 | 1.0425 | -0.24 | 2.05 | OK |
| V036c | spencer | search | 1.0320 | 1.0287 | -0.32 | 1.0286 | -0.33 | 2.05 | OK |
| V036c | spencer | search | 1.0300 | 1.0287 | -0.13 | 1.0286 | -0.14 | 2.49 | OK |
| V036d | bishop | search | 1.1540 | 1.1519 | -0.18 | 1.1521 | -0.17 | 2.04 | OK |
| V036d | spencer | search | 1.1340 | 1.1317 | -0.20 | 1.1315 | -0.22 | 2.04 | OK |
| V036d | spencer | search | 1.1300 | 1.1317 | +0.15 | 1.1315 | +0.14 | 2.44 | OK |
| V040 | bishop | search | 1.4610 | 1.4630 | +0.13 | 1.4593 | -0.12 | 3.03 | OK |
| V044 | bishop | fixed | 2.0800 | 2.0766 | -0.17 | 2.0760 | -0.19 | 1.24 | OK |
| V044 | morgenstern_price | fixed | 2.0760 | 2.0724 | -0.18 | 2.0717 | -0.21 | 1.02 | OK |
| V044 | spencer | fixed | 2.0730 | 2.0728 | -0.01 | 2.0721 | -0.04 | 1.02 | OK |
| V044b | bishop | fixed | 1.7660 | 1.7601 | -0.34 | 1.7595 | -0.37 | 1.03 | OK |
| V044b | morgenstern_price | fixed | 1.7640 | 1.7576 | -0.37 | 1.7569 | -0.40 | 1.03 | OK |
| V044b | spencer | fixed | 1.7610 | 1.7582 | -0.16 | 1.7576 | -0.19 | 1.03 | OK |
| V045 | bishop | fixed | 1.8340 | 1.8298 | -0.23 | 1.8290 | -0.27 | 1.03 | OK |
| V045 | morgenstern_price | fixed | 1.8320 | 1.8276 | -0.24 | 1.8267 | -0.29 | 1.03 | OK |
| V045 | spencer | fixed | 1.8300 | 1.8284 | -0.09 | 1.8275 | -0.14 | 1.27 | OK |
| V046a | spencer | fixed | 1.3820 | 1.3793 | -0.19 | 1.3794 | -0.19 | 1.04 | OK |
| V046a | morgenstern_price | fixed | 1.3700 | 1.3698 | -0.02 | 1.3699 | -0.01 | 1.36 | OK |
| V046a | spencer | fixed | 1.3730 | 1.3793 | +0.46 | 1.3794 | +0.47 | 1.04 | OK |
| V046b | spencer | fixed | 1.2450 | 1.2416 | -0.27 | 1.2417 | -0.27 | 1.04 | OK |
| V046b | morgenstern_price | fixed | 1.2450 | 1.2349 | -0.81 | 1.2349 | -0.81 | 1.04 | OK |
| V046c | spencer | fixed | 1.1240 | 1.1221 | -0.17 | 1.1222 | -0.16 | 1.04 | OK |
| V046c | morgenstern_price | fixed | 1.1180 | 1.1124 | -0.50 | 1.1125 | -0.49 | 1.04 | OK |
| V046c | spencer | fixed | 1.1180 | 1.1221 | +0.37 | 1.1222 | +0.38 | 1.04 | OK |
| V047a | bishop | search | 0.9870 | 0.9851 | -0.19 | 0.9851 | -0.19 | 2.05 | OK |
| V047a | spencer | search | 0.9860 | 0.9841 | -0.19 | 0.9841 | -0.19 | 2.05 | OK |
| V047a | janbu_corrected | search | 0.9900 | 0.9856 | -0.45 | 0.9855 | -0.46 | 2.51 | OK |
| V047a | morgenstern_price | search | 0.9910 | 0.9841 | -0.69 | 0.9841 | -0.70 | 2.05 | OK |
| V047a | bishop | search | 0.9920 | 0.9851 | -0.69 | 0.9851 | -0.70 | 2.05 | OK |
| V047a | spencer | search | 1.0000 | 0.9841 | -1.59 | 0.9841 | -1.59 | 2.50 | OK |
| V049 | bishop | search | 1.4050 | 1.4031 | -0.14 | 1.4029 | -0.15 | 2.04 | OK |
| V049 | spencer | search | 1.3750 | 1.3724 | -0.19 | 1.3721 | -0.21 | 2.04 | OK |
| V049 | janbu_corrected | search | 1.3570 | 1.3556 | -0.10 | 1.3550 | -0.15 | 2.04 | OK |
| V049 | morgenstern_price | search | 1.3820 | 1.3719 | -0.73 | 1.3716 | -0.75 | 2.04 | OK |
| V049 | bishop | search | 1.4030 | 1.4031 | +0.00 | 1.4029 | -0.01 | 2.04 | OK |
| V050a | janbu_corrected | fixed | 1.2940 | 1.2942 | +0.02 | 1.2939 | -0.01 | 1.04 | OK |
| V050a | spencer | fixed | 1.2770 | 1.2762 | -0.06 | 1.2762 | -0.06 | 1.04 | OK |
| V050a | morgenstern_price | fixed | 1.2610 | 1.2605 | -0.04 | 1.2605 | -0.04 | 1.04 | OK |
| V052a | bishop | search | 1.9480 | 1.9574 | +0.48 | 1.9483 | +0.01 | 2.03 | OK |
| V052a | spencer | search | 1.9480 | 1.9574 | +0.48 | 1.9483 | +0.01 | 2.03 | OK |
| V052a | janbu_corrected | search | 1.9490 | 1.9671 | +0.93 | 1.9520 | +0.16 | 2.03 | OK |
| V052a | bishop | search | 1.9510 | 1.9574 | +0.33 | 1.9483 | -0.14 | 2.03 | OK |
| V052b | bishop | fixed | 2.2080 | 2.2064 | -0.07 | 2.2064 | -0.07 | 1.02 | OK |
| V052b | spencer | fixed | 2.2920 | 2.2900 | -0.09 | 2.2901 | -0.08 | 1.02 | OK |
| V052b | janbu_corrected | fixed | 2.0730 | 2.0729 | -0.00 | 2.0728 | -0.01 | 1.02 | OK |
| V052b | morgenstern_price | fixed | 2.2990 | 2.2993 | +0.01 | 2.2994 | +0.02 | 1.02 | OK |
| V054 | bishop | search | 1.0870 | 1.0858 | -0.11 | 1.0855 | -0.14 | 2.05 | OK |
| V054 | spencer | search | 1.0930 | 1.0917 | -0.12 | 1.0913 | -0.15 | 2.05 | OK |
| V055 | spencer | search | 1.4000 | 1.3665 | -2.40 | 1.3662 | -2.42 | 5.00 | OK |
| V055 | spencer | search | 1.3660 | 1.3665 | +0.03 | 1.3662 | +0.01 | 2.04 | OK |
| V056 | janbu_corrected | fixed | 0.4850 | 0.4998 | +3.05 | 0.4995 | +2.98 | 3.10 | OK |
| V057a | spencer | search | 1.4600 | 1.4772 | +1.18 | 1.4721 | +0.83 | 3.34 | OK |
| V057a | spencer | search | 1.4680 | 1.4772 | +0.63 | 1.4721 | +0.28 | 2.03 | OK |
| V057b | spencer | search | 2.0400 | 2.0276 | -0.61 | 2.0229 | -0.84 | 3.25 | OK |
| V057b | spencer | search | 2.0220 | 2.0276 | +0.27 | 2.0229 | +0.05 | 2.02 | OK |
| V060a | bishop | search | 2.5290 | 2.5302 | +0.05 | 2.5303 | +0.05 | 2.02 | OK |
| V060b | bishop | fixed | 2.9730 | 2.9744 | +0.05 | 2.9743 | +0.04 | 1.02 | OK |
| V062a | bishop | fixed | 2.5600 | 2.5486 | -0.45 | 2.5485 | -0.45 | 1.20 | OK |
| V062a | bishop | fixed | 2.5510 | 2.5486 | -0.10 | 2.5485 | -0.10 | 1.02 | OK |
| V062b | bishop | fixed | 2.8060 | 2.8158 | +0.35 | 2.8155 | +0.34 | 1.02 | OK |
| V062b | bishop | fixed | 2.8200 | 2.8158 | -0.15 | 2.8155 | -0.16 | 1.18 | OK |
| V062c | bishop | fixed | 2.7710 | 2.7796 | +0.31 | 2.7792 | +0.29 | 1.02 | OK |
| V062c | bishop | fixed | 2.7770 | 2.7796 | +0.09 | 2.7792 | +0.08 | 1.02 | OK |
| V062d | bishop | fixed | 2.5890 | 2.5767 | -0.48 | 2.5769 | -0.47 | 1.02 | OK |
| V062d | bishop | fixed | 2.5830 | 2.5767 | -0.24 | 2.5769 | -0.24 | 1.02 | OK |
| V062e | bishop | fixed | 2.7030 | 2.6900 | -0.48 | 2.6902 | -0.47 | 1.02 | OK |
| V062e | bishop | fixed | 2.6920 | 2.6900 | -0.08 | 2.6902 | -0.07 | 1.02 | OK |
| V062f | bishop | fixed | 2.6730 | 2.6735 | +0.02 | 2.6732 | +0.01 | 1.02 | OK |
| V062f | bishop | fixed | 2.6720 | 2.6735 | +0.06 | 2.6732 | +0.04 | 1.02 | OK |
| V062g | bishop | fixed | 3.5860 | 3.5926 | +0.18 | 3.5918 | +0.16 | 1.01 | OK |
| V062g | bishop | fixed | 3.5980 | 3.5926 | -0.15 | 3.5918 | -0.17 | 1.01 | OK |
| V062h | bishop | fixed | 6.0690 | 6.0650 | -0.07 | 6.0630 | -0.10 | 1.01 | OK |
| V062h | bishop | fixed | 6.0740 | 6.0650 | -0.15 | 6.0630 | -0.18 | 1.01 | OK |
| V062i | bishop | fixed | 11.5830 | 11.5708 | -0.11 | 11.5667 | -0.14 | 1.00 | OK |
| V063 | spencer | search | 2.4550 | 2.4513 | -0.15 | 2.4511 | -0.16 | 2.02 | OK |
| V063 | bishop | search | 2.4300 | 2.4530 | +0.95 | 2.4528 | +0.94 | 2.21 | OK |
| V067 | bishop | search | 1.4390 | 1.4527 | +0.95 | 1.4359 | -0.22 | 2.03 | OK |
| V069a | bishop | search | 1.2000 | 1.2037 | +0.31 | 1.1998 | -0.02 | 3.42 | OK |
| V069a | spencer | search | 1.2000 | 1.2093 | +0.77 | 1.2049 | +0.41 | 3.42 | OK |
| V069b | bishop | fixed | 1.2120 | 1.2102 | -0.15 | 1.2095 | -0.21 | 1.04 | OK |
| V071a | bishop | fixed | 1.2930 | 1.2906 | -0.18 | 1.2896 | -0.26 | 1.04 | OK |
| V071a | spencer | fixed | 1.3000 | 1.2974 | -0.20 | 1.2964 | -0.28 | 1.38 | OK |
| V071b | bishop | search | 1.2930 | 1.2894 | -0.28 | 1.2883 | -0.36 | 2.04 | OK |
| V071b | spencer | search | 1.3000 | 1.2952 | -0.37 | 1.2944 | -0.43 | 2.38 | OK |
| V071b | janbu_simplified | search | 1.1510 | 1.1499 | -0.10 | 1.1478 | -0.28 | 2.04 | OK |
| V077 | spencer | fixed | 0.9400 | 0.9428 | +0.30 | 0.9428 | +0.30 | 1.53 | OK |
| V078 | morgenstern_price | fixed | 0.9600 | 0.9578 | -0.23 | 0.9578 | -0.23 | 1.52 | OK |
| V081a | bishop | fixed | 0.7640 | 0.7641 | +0.01 | 0.7641 | +0.01 | 1.07 | OK |
| V081b | bishop | fixed | 1.5040 | 1.5015 | -0.17 | 1.5012 | -0.19 | 1.03 | OK |
| V086e | spencer | search | 1.2190 | 1.2067 | -1.01 | 1.2044 | -1.20 | 2.04 | OK |
| V090 | bishop | fixed | 1.3320 | 1.3207 | -0.85 | 1.3205 | -0.86 | 1.04 | OK |
| V090 | spencer | fixed | 1.3280 | 1.3169 | -0.84 | 1.3167 | -0.85 | 1.04 | OK |
| V090 | janbu_corrected | fixed | 1.3450 | 1.3408 | -0.31 | 1.3405 | -0.33 | 1.04 | OK |
| V090 | morgenstern_price | fixed | 1.3270 | 1.3166 | -0.79 | 1.3164 | -0.80 | 1.04 | OK |
| V093 | bishop | search | 1.3440 | 1.3431 | -0.07 | 1.3427 | -0.10 | 2.04 | OK |
| V095a | bishop | fixed | 1.1020 | 1.1010 | -0.09 | 1.1007 | -0.11 | 1.05 | OK |
| V096d | spencer | fixed | 1.8360 | 1.8252 | -0.59 | 1.8239 | -0.66 | 2.03 | OK |
| V096d | morgenstern_price | fixed | 1.8230 | 1.8097 | -0.73 | 1.8084 | -0.80 | 2.03 | OK |
| V096e | spencer | fixed | 1.2110 | 1.2137 | +0.23 | 1.2120 | +0.08 | 2.04 | OK |
| V096e | morgenstern_price | fixed | 1.1970 | 1.1987 | +0.15 | 1.1969 | -0.01 | 2.04 | OK |
| V097a | bishop | fixed | 1.1730 | 1.1725 | -0.05 | 1.1721 | -0.08 | 1.04 | OK |
| V098 | spencer | search | 1.3720 | 1.3724 | +0.03 | 1.3721 | +0.01 | 2.04 | OK |
| V101 | bishop | search | 1.3340 | 1.3339 | -0.01 | 1.3337 | -0.02 | 2.04 | OK |
| V101 | bishop | search | 1.3400 | 1.3339 | -0.45 | 1.3337 | -0.47 | 2.37 | OK |
| V101 | bishop | search | 1.3430 | 1.3339 | -0.68 | 1.3337 | -0.69 | 2.04 | OK |
| V102a | spencer | search | 1.0000 | 1.0010 | +0.10 | 1.0011 | +0.11 | 2.50 | OK |
| V102a | spencer | search | 1.0010 | 1.0010 | -0.00 | 1.0011 | +0.01 | 2.05 | OK |
| V102a | spencer | search | 1.0010 | 1.0010 | -0.00 | 1.0011 | +0.01 | 2.05 | OK |
| V102a | bishop | search | 0.9910 | 0.9913 | +0.03 | 0.9912 | +0.02 | 2.05 | OK |
| V102a | bishop | search | 0.9930 | 0.9913 | -0.17 | 0.9912 | -0.18 | 2.05 | OK |
| V102b | spencer | search | 1.0000 | 1.0007 | +0.07 | 1.0006 | +0.06 | 2.50 | OK |
| V102b | spencer | search | 1.0010 | 1.0007 | -0.03 | 1.0006 | -0.04 | 2.05 | OK |
| V102b | spencer | search | 1.0010 | 1.0007 | -0.03 | 1.0006 | -0.04 | 2.05 | OK |
| V102b | bishop | search | 0.9870 | 0.9865 | -0.06 | 0.9864 | -0.07 | 2.05 | OK |
| V102b | bishop | search | 0.9880 | 0.9865 | -0.16 | 0.9864 | -0.17 | 2.05 | OK |
| V104a | bishop | search | 2.3000 | 2.3058 | +0.25 | 2.2918 | -0.36 | 2.22 | OK |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Notas de conversión

- V001 (bishop/search, morgenstern_price/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V001 (morgenstern_price/search): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V002 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V003 (bishop/search, spencer/search, janbu_corrected/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V004a (spencer/search, janbu_simplified/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V004b (janbu_simplified/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V005 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V007b (janbu_simplified/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V007c (janbu_simplified/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V008a (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V008b (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V013a (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V018 (morgenstern_price/fixed): Morgenstern-Price con la función interslice data-point-specified (kebab-case de cSlope).
- V019 (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V020 (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V021a (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021b (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021c (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021d (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021e (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021f (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V021g (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V022a (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V022b (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V025 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V026 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V027 (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V028 (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V029 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V030 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V032b (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V033 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
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
- V054 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V055 (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V057a (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V057b (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V060a (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V063 (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V067 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V069a (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V071b (bishop/search, spencer/search, janbu_simplified/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V078 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V086e (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V090 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V093 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V096d (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V096e (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V098 (spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V101 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V102a (spencer/search, bishop/search): sismo pseudoestático kh=0.432, kv=0: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).
- V102a (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V102b (spencer/search, bishop/search): sismo pseudoestático kh=0.132, kv=0: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).
- V102b (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V104a (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
