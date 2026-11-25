# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-25T03:11:29-03:00 · harness v1 · casos: `verification/pending` (5 casos, 13 checks)

## Motores

- **ogs**: binario `target/release/ogs` · versión: — · error: exit 2: ogs: InvalidModel: el documento no coincide con el esquema: unknown field `loads`, expected one of `format`, `version`, `meta`, `units`, `materials`, `regions`, `water`, `slope`, `analysis` at line 53
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | 0 | 0 | 13 | 0 |
| cSlope | 13 | 0 | 0 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **13/13** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V081a | bishop | fixed | 0.7640 | — | — | 0.7641 | +0.01 | 1.07 | sin dato |
| V081b | bishop | fixed | 1.5040 | — | — | 1.5012 | -0.19 | 1.03 | sin dato |
| V097a | bishop | fixed | 1.1730 | — | — | 1.1721 | -0.08 | 1.04 | sin dato |
| V102a | spencer | search | 1.0000 | — | — | 1.0011 | +0.11 | 2.50 | sin dato |
| V102a | spencer | search | 1.0010 | — | — | 1.0011 | +0.01 | 2.05 | sin dato |
| V102a | spencer | search | 1.0010 | — | — | 1.0011 | +0.01 | 2.05 | sin dato |
| V102a | bishop | search | 0.9910 | — | — | 0.9912 | +0.02 | 2.05 | sin dato |
| V102a | bishop | search | 0.9930 | — | — | 0.9912 | -0.18 | 2.05 | sin dato |
| V102b | spencer | search | 1.0000 | — | — | 1.0006 | +0.06 | 2.50 | sin dato |
| V102b | spencer | search | 1.0010 | — | — | 1.0006 | -0.04 | 2.05 | sin dato |
| V102b | spencer | search | 1.0010 | — | — | 1.0006 | -0.04 | 2.05 | sin dato |
| V102b | bishop | search | 0.9870 | — | — | 0.9864 | -0.07 | 2.05 | sin dato |
| V102b | bishop | search | 0.9880 | — | — | 0.9864 | -0.17 | 2.05 | sin dato |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Errores

- ogs: exit 2: ogs: InvalidModel: el documento no coincide con el esquema: unknown field `loads`, expected one of `format`, `version`, `meta`, `units`, `materials`, `regions`, `water`, `slope`, `analysis` at line 53
- ogs: exit 2: ogs: InvalidModel: el documento no coincide con el esquema: unknown field `loads`, expected one of `format`, `version`, `meta`, `units`, `materials`, `regions`, `water`, `slope`, `analysis` at line 78
- ogs: exit 2: ogs: InvalidModel: el documento no coincide con el esquema: unknown field `loads`, expected one of `format`, `version`, `meta`, `units`, `materials`, `regions`, `water`, `slope`, `analysis` at line 88
- ogs: exit 2: ogs: InvalidModel: el documento no coincide con el esquema: unknown field `seismic`, expected one of `methods`, `slices`, `tolerance`, `max_iterations`, `min_m_alpha`, `surface`, `search` at line 64 c

## Notas de conversión

- V102a (spencer/search, bishop/search): sismo pseudoestático kh=0.432, kv=0: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).
- V102a (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V102b (spencer/search, bishop/search): sismo pseudoestático kh=0.132, kv=0: kh en el sentido del deslizamiento, kv>0 hacia abajo (misma convención en cSlope, ltr y rtl).
- V102b (spencer/search, bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
