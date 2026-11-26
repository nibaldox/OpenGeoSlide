# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-26T07:45:41-03:00 · harness v1 · casos: `verification/pending/F3` (1 casos, 1 checks)

## Motores

- **ogs**: binario `target/release/ogs` · versión: ogs-core 0.1.0
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | 1 | 0 | 0 | 0 |
| cSlope | 1 | 0 | 0 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **1/1** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V068 | bishop | fixed | 1.1400 | 1.1633 | +2.04 | 1.1429 | +0.25 | 2.44 | OK |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
