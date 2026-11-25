# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-25T03:29:33-03:00 · harness v1 · casos: `verification/cases` (21 casos, 51 checks)

## Motores

- **ogs**: binario `target/release/ogs` · versión: ogs-core 0.1.0
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | 51 | 0 | 0 | 0 |
| cSlope | 51 | 0 | 0 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **51/51** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V001 | bishop | search | 1.4090 | 1.4044 | -0.32 | 1.4041 | -0.35 | 2.04 | OK |
| V001 | bishop | search | 1.4170 | 1.4044 | -0.89 | 1.4041 | -0.91 | 2.04 | OK |
| V002 | bishop | search | 0.4200 | 0.4193 | -0.17 | 0.4192 | -0.18 | 3.19 | OK |
| V003 | bishop | search | 1.1180 | 1.1141 | -0.35 | 1.1130 | -0.44 | 2.04 | OK |
| V003 | spencer | search | 1.1180 | 1.1148 | -0.29 | 1.1138 | -0.38 | 2.04 | OK |
| V003 | bishop | search | 1.1120 | 1.1141 | +0.19 | 1.1130 | +0.09 | 2.04 | OK |
| V016a | bishop | fixed | 1.7870 | 1.7911 | +0.23 | 1.7905 | +0.19 | 1.03 | OK |
| V016a | spencer | fixed | 1.7910 | 1.7981 | +0.40 | 1.7975 | +0.36 | 1.03 | OK |
| V016a | bishop | fixed | 1.7900 | 1.7911 | +0.06 | 1.7905 | +0.03 | 1.28 | OK |
| V019 | spencer | search | 1.3800 | 1.3987 | +1.36 | 1.3985 | +1.34 | 2.36 | OK |
| V019 | spencer | search | 1.3830 | 1.3986 | +1.13 | 1.3985 | +1.12 | 2.04 | OK |
| V019 | spencer | search | 1.3980 | 1.3987 | +0.05 | 1.3985 | +0.04 | 2.04 | OK |
| V019 | bishop | search | 1.4010 | 1.4012 | +0.01 | 1.4009 | -0.00 | 2.04 | OK |
| V025 | bishop | search | 1.1420 | 1.1328 | -0.80 | 1.1323 | -0.85 | 2.04 | OK |
| V025 | spencer | search | 1.1420 | 1.1330 | -0.79 | 1.1325 | -0.83 | 2.04 | OK |
| V030 | bishop | search | 1.4120 | 1.4129 | +0.06 | 1.4083 | -0.26 | 2.04 | OK |
| V030 | spencer | search | 1.4000 | 1.4028 | +0.20 | 1.3989 | -0.08 | 2.36 | OK |
| V033 | bishop | search | 1.5330 | 1.5217 | -0.74 | 1.5209 | -0.79 | 2.03 | OK |
| V033 | spencer | search | 1.5290 | 1.5336 | +0.30 | 1.5328 | +0.25 | 2.03 | OK |
| V044 | bishop | fixed | 2.0800 | 2.0766 | -0.17 | 2.0760 | -0.19 | 1.24 | OK |
| V044 | spencer | fixed | 2.0730 | 2.0728 | -0.01 | 2.0721 | -0.04 | 1.02 | OK |
| V044b | bishop | fixed | 1.7660 | 1.7601 | -0.34 | 1.7595 | -0.37 | 1.03 | OK |
| V044b | spencer | fixed | 1.7610 | 1.7582 | -0.16 | 1.7576 | -0.19 | 1.03 | OK |
| V045 | bishop | fixed | 1.8340 | 1.8298 | -0.23 | 1.8290 | -0.27 | 1.03 | OK |
| V045 | spencer | fixed | 1.8300 | 1.8284 | -0.09 | 1.8275 | -0.14 | 1.27 | OK |
| V047a | bishop | search | 0.9870 | 0.9851 | -0.19 | 0.9851 | -0.19 | 2.05 | OK |
| V047a | spencer | search | 0.9860 | 0.9841 | -0.19 | 0.9841 | -0.19 | 2.05 | OK |
| V047a | bishop | search | 0.9920 | 0.9851 | -0.69 | 0.9851 | -0.70 | 2.05 | OK |
| V047a | spencer | search | 1.0000 | 0.9841 | -1.59 | 0.9841 | -1.59 | 2.50 | OK |
| V049 | bishop | search | 1.4050 | 1.4031 | -0.14 | 1.4029 | -0.15 | 2.04 | OK |
| V049 | spencer | search | 1.3750 | 1.3724 | -0.19 | 1.3721 | -0.21 | 2.04 | OK |
| V049 | bishop | search | 1.4030 | 1.4031 | +0.00 | 1.4029 | -0.01 | 2.04 | OK |
| V063 | spencer | search | 2.4550 | 2.4513 | -0.15 | 2.4511 | -0.16 | 2.02 | OK |
| V063 | bishop | search | 2.4300 | 2.4530 | +0.95 | 2.4528 | +0.94 | 2.21 | OK |
| V081a | bishop | fixed | 0.7640 | 0.7641 | +0.01 | 0.7641 | +0.01 | 1.07 | OK |
| V081b | bishop | fixed | 1.5040 | 1.5015 | -0.17 | 1.5012 | -0.19 | 1.03 | OK |
| V093 | bishop | search | 1.3440 | 1.3431 | -0.07 | 1.3427 | -0.10 | 2.04 | OK |
| V097a | bishop | fixed | 1.1730 | 1.1725 | -0.05 | 1.1721 | -0.08 | 1.04 | OK |
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

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Notas de conversión

- V001 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V002 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V003 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V019 (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V025 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V030 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V033 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V047a (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V049 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V063 (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V093 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V101 (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V102a (spencer/search, bishop/search): sismo pseudoestático kh=0.432, kv=0: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).
- V102a (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V102b (spencer/search, bishop/search): sismo pseudoestático kh=0.132, kv=0: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).
- V102b (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
