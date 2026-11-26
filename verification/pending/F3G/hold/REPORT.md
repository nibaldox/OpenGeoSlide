# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-26T17:34:20-03:00 · harness v1 · casos: `verification/pending/F3G/hold` (3 casos, 5 checks)

## Motores

- **ogs**: no se ejecutó (`--oracle-only`): estos casos esperan al motor; se verifica solo que cSlope reproduzca el valor publicado.
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | — | — | — (no aplica: solo oráculo) | — |
| cSlope | 5 | 0 | 0 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **5/5** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V009b | spencer | fixed | 1.9100 | — | — | 1.8817 | -1.48 | 2.26 | cSlope reproduce |
| V087 | janbu_corrected | fixed | 2.2900 | — | — | 2.2476 | -1.85 | 2.22 | cSlope reproduce |
| V092 | bishop | fixed | 2.0110 | — | — | 1.9903 | -1.03 | 2.02 | cSlope reproduce |
| V092 | spencer | fixed | 2.0260 | — | — | 2.0046 | -1.06 | 2.02 | cSlope reproduce |
| V092 | morgenstern_price | fixed | 2.0270 | — | — | 2.0048 | -1.10 | 2.02 | cSlope reproduce |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Notas de conversión

- V092 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
