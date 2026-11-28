# Verificación cruzada: publicado vs. ogs vs. xslope (columna informativa)

Generado: 2026-11-27T23:49:40-03:00 · informe v1 · casos: `verification/cases` (167 casos, 347 checks)

xslope **no es un juez**: los criterios de aceptación siguen siendo el publicado y ogs. En superficie fija el veredicto es la concordancia de xslope con ogs (|xslope − ogs| / ogs ≤ 0.5 %); en búsqueda cada motor halla su superficie y la fila es solo un diagnóstico.

## Motores

- **xslope**: `xslope==1.1.0` (versión fijada) · Python 3.13.14
- **ogs**: `ogs-core 0.5.1`

## Resumen

| clase | checks |
|---|---:|
| convertido, búsqueda | 102 |
| convertido, superficie fija | 80 |
| Unsupported: método morgenstern_price | 44 |
| Unsupported: grieta de tracción | 27 |
| Unsupported: método janbu_corrected | 25 |
| Unsupported: refuerzos | 21 |
| Unsupported: búsqueda no circular | 16 |
| Unsupported: método janbu_simplified | 11 |
| Unsupported: sismo | 10 |
| Unsupported: cargas | 6 |
| Unsupported: material hoek_brown | 2 |
| Unsupported: ventana de búsqueda de ancho cero | 2 |
| Unsupported: undrained con gradiente: bases sobre el datum | 1 |
| **total** | **347** |

| superficie | filas | mediana \|xs − ogs\| % | máximo \|xs − ogs\| % | en | concordancia | discrepancia | sin dato |
|---|---:|---:|---:|---|---:|---:|---:|
| fija | 80 | 0.029 | 0.116 | V091 bishop#0 | 80 | 0 | 0 |
| búsqueda (diagnóstico) | 100 | 0.098 | 25.791 | V060a bishop#0 | — | — | 2 |

## Excepciones en superficie fija

Ninguna: los 80 checks de superficie fija concuerdan dentro de 0.5 %.

## Búsqueda: filas con |xs − ogs| > 0.5 % (diagnóstico)

En cada fila se evalúa cada motor, como superficie fija, sobre el círculo crítico del otro. Si xslope sobre la superficie de ogs concuerda con ogs, la fórmula y la conversión son las mismas y lo que difiere es la superficie que halla cada búsqueda (el caso de V020, X36 §3.3).

| check | ogs | xslope | xs − ogs % | círculo crítico de ogs (xc; yc; r) | xslope sobre ese círculo | diagnóstico |
|---|---:|---:|---:|---|---:|---|
| V007b spencer#1 | 0.9776 | 1.0005 | +2.34 | (-9.71; 17.39; 19.91) | 0.9776 | xslope sobre la superficie de ogs: 0.9776 (-0.00 % frente a ogs); ogs sobre la superficie de xslope: 1.0006 (+0.00 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V008a spencer#0 | 1.5190 | 1.5284 | +0.62 | (-0.18; 9.09; 9.09) | 1.5186 | xslope sobre la superficie de ogs: 1.5186 (-0.03 % frente a ogs); ogs sobre la superficie de xslope: 1.5287 (+0.02 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V020 spencer#0 | 1.3330 | 1.4381 | +7.88 | (18.29; 24.17; 9.74) | 1.3327 | xslope sobre la superficie de ogs: 1.3327 (-0.03 % frente a ogs); ogs sobre la superficie de xslope: 1.4382 (+0.01 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V020 spencer#1 | 1.3330 | 1.4381 | +7.88 | (18.29; 24.17; 9.74) | 1.3327 | xslope sobre la superficie de ogs: 1.3327 (-0.03 % frente a ogs); ogs sobre la superficie de xslope: 1.4382 (+0.01 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V020 spencer#2 | 1.3330 | 1.4381 | +7.88 | (18.29; 24.17; 9.74) | 1.3327 | xslope sobre la superficie de ogs: 1.3327 (-0.03 % frente a ogs); ogs sobre la superficie de xslope: 1.4382 (+0.01 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V020 bishop#3 | 1.3374 | 1.4392 | +7.61 | (18.22; 24.33; 9.92) | 1.3371 | xslope sobre la superficie de ogs: 1.3371 (-0.02 % frente a ogs); ogs sobre la superficie de xslope: 1.4393 (+0.01 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V032b bishop#0 | 1.1547 | 1.1685 | +1.20 | (-23.92; 220.14; 209.83) | 1.1547 | xslope sobre la superficie de ogs: 1.1547 (+0.00 % frente a ogs); ogs sobre la superficie de xslope: 1.1685 (-0.00 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V032b spencer#1 | 1.1547 | 1.1685 | +1.20 | (-23.92; 220.14; 209.83) | 1.1546 | xslope sobre la superficie de ogs: 1.1546 (-0.01 % frente a ogs); ogs sobre la superficie de xslope: 1.1685 (+0.00 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V032b spencer#2 | 1.1547 | 1.1685 | +1.20 | (-23.92; 220.14; 209.83) | 1.1546 | xslope sobre la superficie de ogs: 1.1546 (-0.01 % frente a ogs); ogs sobre la superficie de xslope: 1.1685 (+0.00 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |
| V036a bishop#0 | 0.7604 | 0.7561 | -0.57 | (19.65; 16.75; 16.74) | 0.7604 | xslope sobre la superficie de ogs: 0.7604 (-0.01 % frente a ogs); ogs sobre la superficie de xslope: 0.7563 (+0.03 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de ogs no llegó a la superficie de xslope |
| V036a spencer#1 | 0.7564 | 0.7512 | -0.68 | (19.65; 16.75; 16.74) | 0.7563 | xslope sobre la superficie de ogs: 0.7563 (-0.01 % frente a ogs); ogs sobre la superficie de xslope: 0.7516 (+0.05 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de ogs no llegó a la superficie de xslope |
| V036a spencer#2 | 0.7564 | 0.7512 | -0.68 | (19.65; 16.75; 16.74) | 0.7563 | xslope sobre la superficie de ogs: 0.7563 (-0.01 % frente a ogs); ogs sobre la superficie de xslope: 0.7516 (+0.05 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de ogs no llegó a la superficie de xslope |
| V038 bishop#0 | 1.0958 | 1.0701 | -2.35 | (68.76; 20.70; 20.69) | 1.0952 | xslope sobre la superficie de ogs: 1.0952 (-0.05 % frente a ogs); ogs sobre la superficie de xslope: 1.0711 (+0.09 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de ogs no llegó a la superficie de xslope |
| V038 spencer#1 | 1.0994 | 1.0774 | -2.00 | (69.04; 22.77; 22.76) | 1.0985 | xslope sobre la superficie de ogs: 1.0985 (-0.08 % frente a ogs); ogs sobre la superficie de xslope: 1.0779 (+0.05 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de ogs no llegó a la superficie de xslope |
| V038 bishop#2 | 1.0958 | 1.0701 | -2.35 | (68.76; 20.70; 20.69) | 1.0952 | xslope sobre la superficie de ogs: 1.0952 (-0.05 % frente a ogs); ogs sobre la superficie de xslope: 1.0711 (+0.09 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de ogs no llegó a la superficie de xslope |
| V038b spencer#0 | 1.1663 | 1.1574 | -0.76 | (71.56; 24.73; 24.70) | 1.1659 | xslope sobre la superficie de ogs: 1.1659 (-0.03 % frente a ogs); ogs sobre la superficie de xslope: 1.1582 (+0.07 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de ogs no llegó a la superficie de xslope |
| V052a bishop#0 | 1.9574 | 1.8435 | -5.82 | (-46.44; 716.69; 662.08) | 1.9574 | xslope sobre la superficie de ogs: 1.9574 (+0.00 % frente a ogs); ogs declara no válida la superficie de xslope (truncated_mass, no_driving); la fórmula concuerda sobre la superficie de ogs |
| V052a spencer#1 | 1.9574 | 1.8434 | -5.82 | (-46.44; 716.69; 662.08) | 1.9574 | xslope sobre la superficie de ogs: 1.9574 (-0.00 % frente a ogs); ogs declara no válida la superficie de xslope (truncated_mass, no_driving); la fórmula concuerda sobre la superficie de ogs |
| V052a bishop#3 | 1.9574 | 1.8435 | -5.82 | (-46.44; 716.69; 662.08) | 1.9574 | xslope sobre la superficie de ogs: 1.9574 (+0.00 % frente a ogs); ogs declara no válida la superficie de xslope (truncated_mass, no_driving); la fórmula concuerda sobre la superficie de ogs |
| V060a bishop#0 | 2.5302 | 1.8776 | -25.79 | (348.61; 265.12; 118.36) | 2.5300 | xslope sobre la superficie de ogs: 2.5300 (-0.01 % frente a ogs); ogs declara no válida la superficie de xslope (no_driving); la fórmula concuerda sobre la superficie de ogs |
| V067 bishop#0 | 1.4527 | 1.4359 | -1.16 | (29.02; 19.47; 14.96) | 1.4515 | xslope sobre la superficie de ogs: 1.4515 (-0.08 % frente a ogs); ogs sobre la superficie de xslope: 1.4368 (+0.06 % frente a xslope); la fórmula concuerda sobre la superficie de ogs; la búsqueda de ogs no llegó a la superficie de xslope |
| V104a bishop#0 | 2.3058 | 2.4593 | +6.66 | (10.03; 9.29; 4.29) | 2.3239 | xslope sobre la superficie de ogs: 2.3239 (+0.78 % frente a ogs); ogs sobre la superficie de xslope: 2.4620 (+0.11 % frente a xslope); la diferencia persiste sobre la superficie de ogs (fórmula, conversión o rebanado); la búsqueda de xslope no llegó a la superficie de ogs (su FS sobre ella es menor que el que halla) |

## Tabla por check

`err xs` es el error de xslope frente al publicado; `xs − ogs`, la diferencia de xslope con ogs, ambos en %. Veredicto: fija → concordancia / discrepancia; búsqueda → diagnóstico.

| caso | método | tipo | publicado | tol % | ogs | xslope | err xs % | xs − ogs % | veredicto |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V001 | bishop | búsqueda | 1.4090 | 2.0 | 1.4044 | 1.4040 | -0.36 | -0.033 | diagnóstico |
| V001 | bishop | búsqueda | 1.4170 | 2.0 | 1.4044 | 1.4040 | -0.92 | -0.033 | diagnóstico |
| V002 | bishop | búsqueda | 0.4200 | 3.2 | 0.4193 | 0.4192 | -0.18 | -0.013 | diagnóstico |
| V003 | bishop | búsqueda | 1.1180 | 2.0 | 1.1141 | 1.1132 | -0.43 | -0.079 | diagnóstico |
| V003 | spencer | búsqueda | 1.1180 | 2.0 | 1.1148 | 1.1140 | -0.35 | -0.066 | diagnóstico |
| V003 | bishop | búsqueda | 1.1120 | 2.0 | 1.1141 | 1.1132 | +0.11 | -0.079 | diagnóstico |
| V004a | spencer | búsqueda | 2.7940 | 2.0 | 2.8026 | 2.8016 | +0.27 | -0.035 | diagnóstico |
| V004b | spencer | búsqueda | 2.6960 | 2.0 | 2.6672 | 2.6664 | -1.10 | -0.032 | diagnóstico |
| V005 | bishop | búsqueda | 2.5000 | 2.2 | 2.5102 | — | — | — | sin dato |
| V005 | spencer | búsqueda | 2.5000 | 2.2 | 2.5102 | — | — | — | sin dato |
| V006 | spencer | fija, polilínea | 1.3510 | 1.0 | 1.3520 | 1.3520 | +0.07 | -0.000 | concordancia |
| V007b | spencer | búsqueda | 0.9810 | 2.1 | 0.9776 | 1.0005 | +1.99 | +2.342 | diagnóstico |
| V008a | spencer | búsqueda | 1.5360 | 2.0 | 1.5190 | 1.5284 | -0.50 | +0.617 | diagnóstico |
| V008b | spencer | búsqueda | 1.3660 | 2.0 | 1.3648 | 1.3647 | -0.10 | -0.009 | diagnóstico |
| V013a | bishop | búsqueda | 1.1400 | 2.4 | 1.1430 | 1.1429 | +0.25 | -0.012 | diagnóstico |
| V013a | bishop | búsqueda | 1.1300 | 2.4 | 1.1430 | 1.1429 | +1.14 | -0.012 | diagnóstico |
| V016a | bishop | fija | 1.7870 | 1.0 | 1.7911 | 1.7901 | +0.17 | -0.054 | concordancia |
| V016a | spencer | fija | 1.7910 | 1.0 | 1.7981 | 1.7971 | +0.34 | -0.054 | concordancia |
| V016a | bishop | fija | 1.7900 | 1.3 | 1.7911 | 1.7901 | +0.01 | -0.054 | concordancia |
| V016c | bishop | fija | 1.7900 | 1.3 | 1.7911 | 1.7902 | +0.01 | -0.049 | concordancia |
| V019 | spencer | búsqueda | 1.3800 | 2.4 | 1.3987 | 1.4029 | +1.66 | +0.293 | diagnóstico |
| V019 | spencer | búsqueda | 1.3830 | 2.0 | 1.3986 | 1.4029 | +1.44 | +0.306 | diagnóstico |
| V019 | spencer | búsqueda | 1.3980 | 2.0 | 1.3987 | 1.4029 | +0.35 | +0.293 | diagnóstico |
| V019 | bishop | búsqueda | 1.4010 | 2.0 | 1.4012 | 1.4051 | +0.29 | +0.280 | diagnóstico |
| V020 | spencer | búsqueda | 1.3360 | 2.0 | 1.3330 | 1.4381 | +7.64 | +7.884 | diagnóstico |
| V020 | spencer | búsqueda | 1.3300 | 2.4 | 1.3330 | 1.4381 | +8.13 | +7.884 | diagnóstico |
| V020 | spencer | búsqueda | 1.3380 | 2.0 | 1.3330 | 1.4381 | +7.48 | +7.884 | diagnóstico |
| V020 | bishop | búsqueda | 1.3420 | 2.0 | 1.3374 | 1.4392 | +7.24 | +7.608 | diagnóstico |
| V021a | bishop | fija | 1.1178 | 2.0 | 1.1286 | 1.1280 | +0.91 | -0.048 | concordancia |
| V021a | bishop | fija | 1.1280 | 2.0 | 1.1285 | 1.1281 | +0.01 | -0.034 | concordancia |
| V021b | bishop | fija | 1.1088 | 2.0 | 1.1101 | 1.1096 | +0.08 | -0.043 | concordancia |
| V021b | bishop | fija | 1.1090 | 2.0 | 1.1100 | 1.1096 | +0.06 | -0.036 | concordancia |
| V021c | bishop | fija | 1.1096 | 2.0 | 1.1087 | 1.1081 | -0.13 | -0.049 | concordancia |
| V021c | bishop | fija | 1.1080 | 2.0 | 1.1087 | 1.1081 | +0.01 | -0.049 | concordancia |
| V021d | bishop | fija | 1.0639 | 2.0 | 1.0583 | 1.0579 | -0.57 | -0.043 | concordancia |
| V021d | bishop | fija | 1.0580 | 2.0 | 1.0583 | 1.0579 | -0.01 | -0.043 | concordancia |
| V021e | bishop | fija | 2.2343 | 2.0 | 2.2455 | 2.2444 | +0.45 | -0.049 | concordancia |
| V021e | bishop | fija | 2.2450 | 2.0 | 2.2455 | 2.2444 | -0.03 | -0.049 | concordancia |
| V021f | bishop | fija | 2.1396 | 2.0 | 2.1287 | 2.1278 | -0.55 | -0.043 | concordancia |
| V021f | bishop | fija | 2.1280 | 2.0 | 2.1287 | 2.1278 | -0.01 | -0.043 | concordancia |
| V021g | bishop | fija | 1.4239 | 2.0 | 1.4284 | 1.4278 | +0.27 | -0.043 | concordancia |
| V022a | bishop | fija | 1.1625 | 1.0 | 1.1587 | 1.1584 | -0.35 | -0.022 | concordancia |
| V022a | bishop | fija | 1.1600 | 1.4 | 1.1586 | 1.1585 | -0.13 | -0.014 | concordancia |
| V022b | bishop | fija | 1.1850 | 1.0 | 1.1780 | 1.1770 | -0.67 | -0.081 | concordancia |
| V024 | bishop | fija | 1.5630 | 1.0 | 1.5723 | 1.5721 | +0.58 | -0.016 | concordancia |
| V024 | spencer | fija | 1.5570 | 1.0 | 1.5629 | 1.5626 | +0.36 | -0.018 | concordancia |
| V024 | bishop | fija | 1.5700 | 1.3 | 1.5723 | 1.5721 | +0.13 | -0.016 | concordancia |
| V024 | bishop | fija | 1.5720 | 1.0 | 1.5723 | 1.5721 | +0.01 | -0.016 | concordancia |
| V025 | bishop | búsqueda | 1.1420 | 2.0 | 1.1328 | 1.1324 | -0.84 | -0.038 | diagnóstico |
| V025 | spencer | búsqueda | 1.1420 | 2.0 | 1.1330 | 1.1325 | -0.83 | -0.038 | diagnóstico |
| V026 | bishop | búsqueda | 1.2280 | 2.0 | 1.2213 | 1.2194 | -0.70 | -0.154 | diagnóstico |
| V026 | bishop | búsqueda | 1.2200 | 2.4 | 1.2213 | 1.2194 | -0.05 | -0.154 | diagnóstico |
| V026 | spencer | búsqueda | 1.1900 | 2.4 | 1.1965 | 1.1945 | +0.38 | -0.171 | diagnóstico |
| V027 | spencer | búsqueda | 1.1240 | 2.0 | 1.1369 | 1.1348 | +0.96 | -0.186 | diagnóstico |
| V028 | spencer | búsqueda | 1.1240 | 2.0 | 1.1250 | 1.1231 | -0.08 | -0.173 | diagnóstico |
| V029 | bishop | búsqueda | 1.1250 | 2.0 | 1.1201 | 1.1179 | -0.63 | -0.193 | diagnóstico |
| V029 | spencer | búsqueda | 1.1190 | 2.0 | 1.1201 | 1.1179 | -0.09 | -0.193 | diagnóstico |
| V030 | bishop | búsqueda | 1.4120 | 2.0 | 1.4129 | 1.4080 | -0.28 | -0.343 | diagnóstico |
| V030 | spencer | búsqueda | 1.4000 | 2.4 | 1.4028 | 1.3986 | -0.10 | -0.300 | diagnóstico |
| V031a | bishop | fija | 2.5490 | 1.0 | 2.5339 | 2.5336 | -0.60 | -0.011 | concordancia |
| V031a | spencer | fija | 2.5450 | 1.0 | 2.5309 | 2.5306 | -0.57 | -0.014 | concordancia |
| V031a | spencer | fija | 2.5600 | 1.2 | 2.5309 | 2.5306 | -1.15 | -0.014 | concordancia |
| V031b | bishop | fija | 1.3980 | 1.0 | 1.3895 | 1.3892 | -0.63 | -0.019 | concordancia |
| V031b | spencer | fija | 1.3590 | 1.0 | 1.3521 | 1.3519 | -0.53 | -0.015 | concordancia |
| V031b | spencer | fija | 1.3500 | 1.4 | 1.3521 | 1.3519 | +0.14 | -0.015 | concordancia |
| V032b | bishop | búsqueda | 1.1550 | 2.0 | 1.1547 | 1.1685 | +1.17 | +1.197 | diagnóstico |
| V032b | spencer | búsqueda | 1.1550 | 2.0 | 1.1547 | 1.1685 | +1.17 | +1.196 | diagnóstico |
| V032b | spencer | búsqueda | 1.1500 | 2.4 | 1.1547 | 1.1685 | +1.61 | +1.196 | diagnóstico |
| V033 | bishop | búsqueda | 1.5330 | 2.0 | 1.5217 | 1.5212 | -0.77 | -0.034 | diagnóstico |
| V033 | spencer | búsqueda | 1.5290 | 2.0 | 1.5336 | 1.5331 | +0.27 | -0.030 | diagnóstico |
| V034a | bishop | búsqueda | 1.3130 | 2.0 | 1.3062 | 1.3057 | -0.55 | -0.040 | diagnóstico |
| V034a | spencer | búsqueda | 1.2760 | 2.0 | 1.2768 | 1.2760 | -0.00 | -0.060 | diagnóstico |
| V034b | bishop | búsqueda | 1.3350 | 2.0 | 1.3304 | 1.3296 | -0.40 | -0.056 | diagnóstico |
| V034b | spencer | búsqueda | 1.3280 | 2.0 | 1.3286 | 1.3277 | -0.02 | -0.062 | diagnóstico |
| V036a | bishop | búsqueda | 0.7610 | 2.1 | 0.7604 | 0.7561 | -0.64 | -0.567 | diagnóstico |
| V036a | spencer | búsqueda | 0.7560 | 2.1 | 0.7564 | 0.7512 | -0.64 | -0.683 | diagnóstico |
| V036a | spencer | búsqueda | 0.7500 | 2.7 | 0.7564 | 0.7512 | +0.16 | -0.683 | diagnóstico |
| V036b | bishop | búsqueda | 0.9090 | 2.1 | 0.9083 | 0.9054 | -0.40 | -0.320 | diagnóstico |
| V036b | spencer | búsqueda | 0.8980 | 2.1 | 0.9011 | 0.8975 | -0.06 | -0.405 | diagnóstico |
| V036b | spencer | búsqueda | 0.9000 | 2.6 | 0.9011 | 0.8975 | -0.28 | -0.405 | diagnóstico |
| V036c | bishop | búsqueda | 1.0450 | 2.0 | 1.0424 | 1.0420 | -0.28 | -0.033 | diagnóstico |
| V036c | spencer | búsqueda | 1.0320 | 2.0 | 1.0287 | 1.0282 | -0.37 | -0.043 | diagnóstico |
| V036c | spencer | búsqueda | 1.0300 | 2.5 | 1.0287 | 1.0282 | -0.17 | -0.043 | diagnóstico |
| V036d | bishop | búsqueda | 1.1540 | 2.0 | 1.1519 | 1.1517 | -0.20 | -0.015 | diagnóstico |
| V036d | spencer | búsqueda | 1.1340 | 2.0 | 1.1317 | 1.1313 | -0.24 | -0.037 | diagnóstico |
| V036d | spencer | búsqueda | 1.1300 | 2.4 | 1.1317 | 1.1313 | +0.11 | -0.037 | diagnóstico |
| V038 | bishop | búsqueda | 1.0900 | 2.5 | 1.0958 | 1.0701 | -1.83 | -2.347 | diagnóstico |
| V038 | spencer | búsqueda | 1.1000 | 2.5 | 1.0994 | 1.0774 | -2.06 | -2.002 | diagnóstico |
| V038 | bishop | búsqueda | 1.0700 | 2.5 | 1.0958 | 1.0701 | +0.01 | -2.347 | diagnóstico |
| V038b | spencer | búsqueda | 1.1600 | 2.4 | 1.1663 | 1.1574 | -0.22 | -0.760 | diagnóstico |
| V040 | bishop | búsqueda | 1.4610 | 3.0 | 1.4630 | 1.4591 | -0.13 | -0.266 | diagnóstico |
| V041a | bishop | búsqueda | 1.6030 | 2.0 | 1.5977 | 1.5966 | -0.40 | -0.070 | diagnóstico |
| V041a | spencer | búsqueda | 1.5990 | 2.0 | 1.5958 | 1.5939 | -0.32 | -0.117 | diagnóstico |
| V041a | spencer | búsqueda | 1.6000 | 2.3 | 1.5958 | 1.5939 | -0.38 | -0.117 | diagnóstico |
| V041b | bishop | búsqueda | 1.6030 | 2.0 | 1.5972 | 1.5965 | -0.40 | -0.046 | diagnóstico |
| V041b | spencer | búsqueda | 1.5990 | 2.0 | 1.5953 | 1.5934 | -0.35 | -0.125 | diagnóstico |
| V041b | spencer | búsqueda | 1.6000 | 2.3 | 1.5953 | 1.5934 | -0.42 | -0.125 | diagnóstico |
| V042 | bishop | fija | 1.5840 | 1.0 | 1.5823 | 1.5821 | -0.12 | -0.013 | concordancia |
| V042 | spencer | fija | 1.6480 | 1.0 | 1.6495 | 1.6492 | +0.08 | -0.013 | concordancia |
| V044 | bishop | fija | 2.0800 | 1.2 | 2.0766 | 2.0757 | -0.21 | -0.040 | concordancia |
| V044 | spencer | fija | 2.0730 | 1.0 | 2.0728 | 2.0719 | -0.05 | -0.042 | concordancia |
| V044b | bishop | fija | 1.7660 | 1.0 | 1.7601 | 1.7593 | -0.38 | -0.044 | concordancia |
| V044b | spencer | fija | 1.7610 | 1.0 | 1.7582 | 1.7574 | -0.20 | -0.045 | concordancia |
| V045 | bishop | fija | 1.8340 | 1.0 | 1.8298 | 1.8289 | -0.28 | -0.052 | concordancia |
| V045 | spencer | fija | 1.8300 | 1.3 | 1.8284 | 1.8274 | -0.14 | -0.053 | concordancia |
| V046a | spencer | fija, polilínea | 1.3820 | 1.0 | 1.3793 | 1.3794 | -0.19 | +0.007 | concordancia |
| V046a | spencer | fija, polilínea | 1.3730 | 1.0 | 1.3793 | 1.3794 | +0.47 | +0.007 | concordancia |
| V046b | spencer | fija, polilínea | 1.2450 | 1.0 | 1.2416 | 1.2417 | -0.26 | +0.008 | concordancia |
| V046c | spencer | fija, polilínea | 1.1240 | 1.0 | 1.1221 | 1.1222 | -0.16 | +0.009 | concordancia |
| V046c | spencer | fija, polilínea | 1.1180 | 1.0 | 1.1221 | 1.1222 | +0.38 | +0.009 | concordancia |
| V047a | bishop | búsqueda | 0.9870 | 2.1 | 0.9851 | 0.9851 | -0.19 | -0.001 | diagnóstico |
| V047a | spencer | búsqueda | 0.9860 | 2.1 | 0.9841 | 0.9841 | -0.19 | -0.002 | diagnóstico |
| V047a | bishop | búsqueda | 0.9920 | 2.1 | 0.9851 | 0.9851 | -0.69 | -0.001 | diagnóstico |
| V047a | spencer | búsqueda | 1.0000 | 2.5 | 0.9841 | 0.9841 | -1.59 | -0.002 | diagnóstico |
| V049 | bishop | búsqueda | 1.4050 | 2.0 | 1.4031 | 1.4029 | -0.15 | -0.011 | diagnóstico |
| V049 | spencer | búsqueda | 1.3750 | 2.0 | 1.3724 | 1.3722 | -0.21 | -0.016 | diagnóstico |
| V049 | bishop | búsqueda | 1.4030 | 2.0 | 1.4031 | 1.4029 | -0.01 | -0.011 | diagnóstico |
| V050a | spencer | fija, polilínea | 1.2770 | 1.0 | 1.2762 | 1.2762 | -0.06 | +0.001 | concordancia |
| V052a | bishop | búsqueda | 1.9480 | 2.0 | 1.9574 | 1.8435 | -5.36 | -5.818 | diagnóstico |
| V052a | spencer | búsqueda | 1.9480 | 2.0 | 1.9574 | 1.8434 | -5.37 | -5.824 | diagnóstico |
| V052a | bishop | búsqueda | 1.9510 | 2.0 | 1.9574 | 1.8435 | -5.51 | -5.818 | diagnóstico |
| V052b | bishop | fija | 2.2080 | 1.0 | 2.2064 | 2.2064 | -0.07 | +0.001 | concordancia |
| V052b | spencer | fija | 2.2920 | 1.0 | 2.2900 | 2.2900 | -0.09 | +0.000 | concordancia |
| V055 | spencer | búsqueda | 1.4000 | 5.0 | 1.3665 | 1.3661 | -2.42 | -0.028 | diagnóstico |
| V055 | spencer | búsqueda | 1.3660 | 2.0 | 1.3665 | 1.3661 | +0.01 | -0.028 | diagnóstico |
| V057a | spencer | búsqueda | 1.4600 | 3.3 | 1.4772 | 1.4713 | +0.77 | -0.398 | diagnóstico |
| V057a | spencer | búsqueda | 1.4680 | 2.0 | 1.4772 | 1.4713 | +0.23 | -0.398 | diagnóstico |
| V057b | spencer | búsqueda | 2.0400 | 3.2 | 2.0276 | 2.0223 | -0.87 | -0.257 | diagnóstico |
| V057b | spencer | búsqueda | 2.0220 | 2.0 | 2.0276 | 2.0223 | +0.02 | -0.257 | diagnóstico |
| V058 | spencer | búsqueda | 1.9000 | 5.0 | 1.9168 | 1.9159 | +0.84 | -0.042 | diagnóstico |
| V058 | spencer | búsqueda | 1.9150 | 2.0 | 1.9168 | 1.9159 | +0.05 | -0.042 | diagnóstico |
| V060a | bishop | búsqueda | 2.5290 | 2.0 | 2.5302 | 1.8776 | -25.76 | -25.791 | diagnóstico |
| V060b | bishop | fija | 2.9730 | 1.0 | 2.9744 | 2.9739 | +0.03 | -0.017 | concordancia |
| V061 | spencer | fija, polilínea | 2.3830 | 1.0 | 2.3878 | 2.3879 | +0.20 | +0.002 | concordancia |
| V062a | bishop | fija | 2.5600 | 1.2 | 2.5486 | 2.5486 | -0.44 | +0.003 | concordancia |
| V062a | bishop | fija | 2.5510 | 1.0 | 2.5486 | 2.5486 | -0.09 | +0.003 | concordancia |
| V062b | bishop | fija | 2.8060 | 1.0 | 2.8158 | 2.8150 | +0.32 | -0.031 | concordancia |
| V062b | bishop | fija | 2.8200 | 1.2 | 2.8158 | 2.8150 | -0.18 | -0.031 | concordancia |
| V062c | bishop | fija | 2.7710 | 1.0 | 2.7796 | 2.7792 | +0.29 | -0.014 | concordancia |
| V062c | bishop | fija | 2.7770 | 1.0 | 2.7796 | 2.7792 | +0.08 | -0.014 | concordancia |
| V062d | bishop | fija | 2.5890 | 1.0 | 2.5767 | 2.5769 | -0.47 | +0.007 | concordancia |
| V062d | bishop | fija | 2.5830 | 1.0 | 2.5767 | 2.5769 | -0.24 | +0.007 | concordancia |
| V062e | bishop | fija | 2.7030 | 1.0 | 2.6900 | 2.6902 | -0.47 | +0.007 | concordancia |
| V062e | bishop | fija | 2.6920 | 1.0 | 2.6900 | 2.6902 | -0.07 | +0.007 | concordancia |
| V062f | bishop | fija | 2.6730 | 1.0 | 2.6735 | 2.6731 | +0.00 | -0.017 | concordancia |
| V062f | bishop | fija | 2.6720 | 1.0 | 2.6735 | 2.6731 | +0.04 | -0.017 | concordancia |
| V062g | bishop | fija | 3.5860 | 1.0 | 3.5926 | 3.5908 | +0.13 | -0.051 | concordancia |
| V062g | bishop | fija | 3.5980 | 1.0 | 3.5926 | 3.5908 | -0.20 | -0.051 | concordancia |
| V062h | bishop | fija | 6.0690 | 1.0 | 6.0650 | 6.0608 | -0.13 | -0.069 | concordancia |
| V062h | bishop | fija | 6.0740 | 1.0 | 6.0650 | 6.0608 | -0.22 | -0.069 | concordancia |
| V062i | bishop | fija | 11.5830 | 1.0 | 11.5708 | 11.5628 | -0.17 | -0.069 | concordancia |
| V063 | spencer | búsqueda | 2.4550 | 2.0 | 2.4513 | 2.4511 | -0.16 | -0.007 | diagnóstico |
| V063 | bishop | búsqueda | 2.4300 | 2.2 | 2.4530 | 2.4529 | +0.94 | -0.005 | diagnóstico |
| V067 | bishop | búsqueda | 1.4390 | 2.0 | 1.4527 | 1.4359 | -0.22 | -1.160 | diagnóstico |
| V069a | bishop | búsqueda | 1.2000 | 3.4 | 1.2037 | 1.2004 | +0.03 | -0.272 | diagnóstico |
| V069a | spencer | búsqueda | 1.2000 | 3.4 | 1.2093 | 1.2054 | +0.45 | -0.316 | diagnóstico |
| V069b | bishop | fija | 1.2120 | 1.0 | 1.2102 | 1.2101 | -0.16 | -0.010 | concordancia |
| V070 | bishop | búsqueda | 1.4170 | 2.0 | 1.4155 | 1.4152 | -0.12 | -0.018 | diagnóstico |
| V070 | bishop | búsqueda | 1.4100 | 3.4 | 1.4155 | 1.4152 | +0.37 | -0.018 | diagnóstico |
| V070 | spencer | búsqueda | 1.4220 | 2.0 | 1.4218 | 1.4215 | -0.03 | -0.017 | diagnóstico |
| V071a | bishop | fija | 1.2930 | 1.0 | 1.2906 | 1.2900 | -0.23 | -0.050 | concordancia |
| V071a | spencer | fija | 1.3000 | 1.4 | 1.2974 | 1.2968 | -0.25 | -0.051 | concordancia |
| V071b | bishop | búsqueda | 1.2930 | 2.0 | 1.2894 | 1.2886 | -0.34 | -0.059 | diagnóstico |
| V071b | spencer | búsqueda | 1.3000 | 2.4 | 1.2952 | 1.2947 | -0.41 | -0.043 | diagnóstico |
| V086e | spencer | búsqueda | 1.2190 | 2.0 | 1.2067 | 1.2026 | -1.35 | -0.338 | diagnóstico |
| V089 | bishop | fija | 2.7160 | 2.0 | 2.6992 | 2.6989 | -0.63 | -0.008 | concordancia |
| V089 | spencer | fija | 2.7360 | 2.0 | 2.7218 | 2.7215 | -0.53 | -0.009 | concordancia |
| V090 | bishop | fija | 1.3320 | 1.0 | 1.3207 | 1.3202 | -0.89 | -0.038 | concordancia |
| V090 | spencer | fija | 1.3280 | 1.0 | 1.3169 | 1.3164 | -0.87 | -0.039 | concordancia |
| V091 | bishop | fija | 1.2410 | 1.0 | 1.2374 | 1.2360 | -0.40 | -0.116 | concordancia |
| V091 | spencer | fija | 1.2410 | 1.0 | 1.2374 | 1.2360 | -0.40 | -0.113 | concordancia |
| V092 | bishop | fija | 2.0110 | 2.0 | 1.9914 | 1.9909 | -1.00 | -0.024 | concordancia |
| V092 | spencer | fija | 2.0260 | 2.0 | 2.0057 | 2.0052 | -1.03 | -0.026 | concordancia |
| V093 | bishop | búsqueda | 1.3440 | 2.0 | 1.3431 | 1.3426 | -0.11 | -0.036 | diagnóstico |
| V095a | bishop | fija | 1.1020 | 1.0 | 1.1010 | 1.1006 | -0.13 | -0.035 | concordancia |
| V096d | spencer | fija | 1.8360 | 2.0 | 1.8252 | 1.8238 | -0.66 | -0.076 | concordancia |
| V096e | spencer | fija | 1.2110 | 2.0 | 1.2137 | 1.2124 | +0.12 | -0.108 | concordancia |
| V098 | spencer | búsqueda | 1.3720 | 2.0 | 1.3724 | 1.3722 | +0.01 | -0.016 | diagnóstico |
| V101 | bishop | búsqueda | 1.3340 | 2.0 | 1.3339 | 1.3336 | -0.03 | -0.024 | diagnóstico |
| V101 | bishop | búsqueda | 1.3400 | 2.4 | 1.3339 | 1.3336 | -0.48 | -0.024 | diagnóstico |
| V101 | bishop | búsqueda | 1.3430 | 2.0 | 1.3339 | 1.3336 | -0.70 | -0.024 | diagnóstico |
| V104a | bishop | búsqueda | 2.3000 | 2.2 | 2.3058 | 2.4593 | +6.93 | +6.657 | diagnóstico |

## Errores

- V005 bishop#0 xslope: sin superficie admisible: la rejilla semilla de xslope no dio ningún círculo dentro de las ventanas
- V005 spencer#1 xslope: sin superficie admisible: la rejilla semilla de xslope no dio ningún círculo dentro de las ventanas

## Notas de conversión

- V001 (bishop#0, bishop#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V002 (bishop#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V003 (bishop#0, spencer#1, bishop#3): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V004a (spencer#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V004b (spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V005 (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V007b (spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V008a (spencer#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V008b (spencer#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V013a (bishop#0, bishop#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V019 (spencer#0, spencer#1, spencer#2, bishop#3): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V020 (spencer#0, spencer#1, spencer#2, bishop#3): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V021a (bishop#1, bishop#2): sand: undrained con Su = 0, como 'mc' con c = 0 y phi = 0 (el preflight de xslope rechaza 'cp' sin resistencia)
- V021b (bishop#1, bishop#2): sand: undrained con Su = 0, como 'mc' con c = 0 y phi = 0 (el preflight de xslope rechaza 'cp' sin resistencia)
- V021c (bishop#1, bishop#2): sand: undrained con Su = 0, como 'mc' con c = 0 y phi = 0 (el preflight de xslope rechaza 'cp' sin resistencia)
- V021d (bishop#1, bishop#2): sand: undrained con Su = 0, como 'mc' con c = 0 y phi = 0 (el preflight de xslope rechaza 'cp' sin resistencia)
- V021e (bishop#1, bishop#2): sand: undrained con Su = 0, como 'mc' con c = 0 y phi = 0 (el preflight de xslope rechaza 'cp' sin resistencia)
- V021f (bishop#1, bishop#2): sand: undrained con Su = 0, como 'mc' con c = 0 y phi = 0 (el preflight de xslope rechaza 'cp' sin resistencia)
- V021g (bishop#1): sand: undrained con Su = 0, como 'mc' con c = 0 y phi = 0 (el preflight de xslope rechaza 'cp' sin resistencia)
- V025 (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V026 (bishop#0, bishop#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V027 (spencer#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V028 (spencer#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V029 (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V030 (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V032b (bishop#0, spencer#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V033 (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V034a (bishop#0, spencer#1): clay: undrained con gradiente (cp=15, r_elev=30), con las bases bajo el datum
- V034a (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V034b (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V036a (bishop#0, spencer#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V036b (bishop#0, spencer#1, spencer#2): foundation: undrained con gradiente (cp=0.78544, r_elev=6.096), con las bases bajo el datum
- V036b (bishop#0, spencer#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V036c (bishop#0, spencer#1, spencer#2): foundation: undrained con gradiente (cp=1.57087, r_elev=6.096), con las bases bajo el datum
- V036c (bishop#0, spencer#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V036d (bishop#0, spencer#1, spencer#2): foundation: undrained con gradiente (cp=2.35631, r_elev=6.096), con las bases bajo el datum
- V036d (bishop#0, spencer#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V038 (bishop#0, spencer#1, bishop#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V038b (spencer#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V040 (bishop#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V041a (bishop#0, spencer#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V041b (bishop#0, spencer#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V047a (bishop#0, spencer#1, bishop#4, spencer#5): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V049 (bishop#0, spencer#1, bishop#4): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V052a (bishop#0, spencer#1, bishop#3): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V055 (spencer#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V057a (spencer#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V057b (spencer#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V058 (spencer#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V060a (bishop#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V063 (spencer#0, bishop#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V067 (bishop#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V069a (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V070 (bishop#0, bishop#1, spencer#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V071b (bishop#0, spencer#1): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V086e (spencer#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V093 (bishop#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V098 (spencer#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V101 (bishop#0, bishop#1, bishop#2): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs
- V104a (bishop#0): búsqueda: el generador de xslope (rejilla de 9 puntos y refinamiento), no la rejilla de ogs

## Reproducir

```
uv run -q --python 3.13 --no-project --with xslope==1.1.0 \
  python verification/xslope/run.py --ogs PATH_BINARIO_OGS
```
