# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-24T20:02:30-03:00 · harness v1 · casos: `/home/xodla/archivos/opengeoslide-wt/w0b/verification/cases` (16 casos, 38 checks)

## Motores

- **ogs**: binario `/home/xodla/archivos/opengeoslide-wt/w1e/target/release/ogs` · versión: — · error: binario ogs no encontrado: /home/xodla/archivos/opengeoslide-wt/w1e/target/release/ogs
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | 0 | 0 | 38 | 0 |
| cSlope | 36 | 0 | 2 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **36/38** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V001 | bishop | search | 1.4090 | — | — | 1.4041 | -0.35 | 2.04 | sin dato |
| V001 | bishop | search | 1.4170 | — | — | 1.4041 | -0.91 | 2.04 | sin dato |
| V002 | bishop | search | 0.4200 | — | — | 0.4192 | -0.18 | 3.19 | sin dato |
| V003 | bishop | search | 1.1180 | — | — | 1.1130 | -0.44 | 2.04 | sin dato |
| V003 | spencer | search | 1.1180 | — | — | 1.1138 | -0.38 | 2.04 | sin dato |
| V003 | bishop | search | 1.1120 | — | — | 1.1130 | +0.09 | 2.04 | sin dato |
| V016a | bishop | fixed | 1.7870 | — | — | 1.7905 | +0.19 | 1.03 | sin dato |
| V016a | spencer | fixed | 1.7910 | — | — | 1.7975 | +0.36 | 1.03 | sin dato |
| V016a | bishop | fixed | 1.7900 | — | — | 1.7905 | +0.03 | 1.28 | sin dato |
| V019 | spencer | search | 1.3800 | — | — | 1.3985 | +1.34 | 2.36 | sin dato |
| V019 | spencer | search | 1.3830 | — | — | 1.3985 | +1.12 | 2.04 | sin dato |
| V019 | spencer | search | 1.3980 | — | — | 1.3985 | +0.04 | 2.04 | sin dato |
| V019 | bishop | search | 1.4010 | — | — | 1.4009 | -0.00 | 2.04 | sin dato |
| V025 | bishop | search | 1.1420 | — | — | 1.1323 | -0.85 | 2.04 | sin dato |
| V025 | spencer | search | 1.1420 | — | — | 1.1325 | -0.83 | 2.04 | sin dato |
| V030 | bishop | search | 1.4120 | — | — | 1.4083 | -0.26 | 2.04 | sin dato |
| V030 | spencer | search | 1.4000 | — | — | 1.3989 | -0.08 | 2.36 | sin dato |
| V033 | bishop | search | 1.5330 | — | — | 1.5209 | -0.79 | 2.03 | sin dato |
| V033 | spencer | search | 1.5290 | — | — | 1.5328 | +0.25 | 2.03 | sin dato |
| V044 | bishop | fixed | 2.0800 | — | — | 2.0760 | -0.19 | 1.24 | sin dato |
| V044 | spencer | fixed | 2.0730 | — | — | 2.0721 | -0.04 | 1.02 | sin dato |
| V044b | bishop | fixed | 1.7660 | — | — | 1.7595 | -0.37 | 1.03 | sin dato |
| V044b | spencer | fixed | 1.7610 | — | — | 1.7576 | -0.19 | 1.03 | sin dato |
| V045 | bishop | fixed | 1.8340 | — | — | 1.8290 | -0.27 | 1.03 | sin dato |
| V045 | spencer | fixed | 1.8300 | — | — | 1.8275 | -0.14 | 1.27 | sin dato |
| V047a | bishop | search | 0.9870 | — | — | 0.9851 | -0.19 | 2.05 | sin dato |
| V047a | spencer | search | 0.9860 | — | — | 0.9841 | -0.19 | 2.05 | sin dato |
| V047a | bishop | search | 0.9920 | — | — | 0.9851 | -0.70 | 2.05 | sin dato |
| V047a | spencer | search | 1.0000 | — | — | 0.9841 | -1.59 | 2.50 | sin dato |
| V049 | bishop | search | 1.4050 | — | — | 1.4029 | -0.15 | 2.04 | sin dato |
| V049 | spencer | search | 1.3750 | — | — | 1.3721 | -0.21 | 2.04 | sin dato |
| V049 | bishop | search | 1.4030 | — | — | 1.4029 | -0.01 | 2.04 | sin dato |
| V063 | spencer | search | 2.4550 | — | — | — | — | 2.02 | sin dato · cSlope sin dato |
| V063 | bishop | search | 2.4300 | — | — | — | — | 2.21 | sin dato · cSlope sin dato |
| V093 | bishop | search | 1.3440 | — | — | 1.3427 | -0.10 | 2.04 | sin dato |
| V101 | bishop | search | 1.3340 | — | — | 1.3337 | -0.02 | 2.04 | sin dato |
| V101 | bishop | search | 1.3400 | — | — | 1.3337 | -0.47 | 2.37 | sin dato |
| V101 | bishop | search | 1.3430 | — | — | 1.3337 | -0.69 | 2.04 | sin dato |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Errores

- V063 bishop/search cSlope: EngineError: No valid slip surface was found. Check the search limits, the geometry and the material strengths.
- V063 spencer/search cSlope: EngineError: No valid slip surface was found. Check the search limits, the geometry and the material strengths.
- ogs: binario ogs no encontrado: /home/xodla/archivos/opengeoslide-wt/w1e/target/release/ogs

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

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
