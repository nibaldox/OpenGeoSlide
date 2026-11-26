# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-26T10:36:36-03:00 · harness v1 · casos: `verification/pending/F3R` (25 casos, 33 checks)

## Motores

- **ogs**: no se ejecutó (`--oracle-only`): estos casos esperan al motor; se verifica solo que cSlope reproduzca el valor publicado.
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | — | — | — (no aplica: solo oráculo) | — |
| cSlope | 33 | 0 | 0 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **33/33** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V010 | morgenstern_price | fixed | 1.1710 | — | — | 1.1627 | -0.71 | 2.04 | cSlope reproduce |
| V010 | bishop | fixed | 1.1700 | — | — | 1.1640 | -0.51 | 2.43 | cSlope reproduce |
| V010b | bishop | fixed | 1.1500 | — | — | 1.1588 | +0.76 | 2.43 | cSlope reproduce |
| V011a | bishop | fixed | 1.2300 | — | — | 1.2198 | -0.83 | 1.41 | cSlope reproduce |
| V011b | bishop | fixed | 1.2200 | — | — | 1.2167 | -0.27 | 1.41 | cSlope reproduce |
| V012 | bishop | fixed | 0.9800 | — | — | 0.9818 | +0.18 | 1.51 | cSlope reproduce |
| V014 | janbu_corrected | fixed | 1.4600 | — | — | 1.4482 | -0.81 | 1.34 | cSlope reproduce |
| V014 | janbu_corrected | fixed | 1.4480 | — | — | 1.4482 | +0.02 | 1.03 | cSlope reproduce |
| V014 | spencer | fixed | 1.5760 | — | — | 1.5755 | -0.03 | 1.03 | cSlope reproduce |
| V015 | janbu_corrected | fixed | 1.4790 | — | — | 1.4764 | -0.18 | 1.03 | cSlope reproduce |
| V015 | janbu_simplified | fixed | 1.4460 | — | — | 1.4418 | -0.29 | 1.03 | cSlope reproduce |
| V016b | bishop | fixed | 1.8350 | — | — | 1.8302 | -0.26 | 1.03 | cSlope reproduce |
| V016b | spencer | fixed | 1.8390 | — | — | 1.8354 | -0.20 | 1.03 | cSlope reproduce |
| V016b | bishop | fixed | 1.8300 | — | — | 1.8302 | +0.01 | 1.27 | cSlope reproduce |
| V035a | morgenstern_price | fixed | 1.5750 | — | — | 1.5682 | -0.43 | 1.03 | cSlope reproduce |
| V035b | bishop | fixed | 1.3240 | — | — | 1.3206 | -0.26 | 1.04 | cSlope reproduce |
| V035b | bishop | fixed | 1.3200 | — | — | 1.3206 | +0.04 | 1.38 | cSlope reproduce |
| V037 | bishop | search | 1.6290 | — | — | 1.6134 | -0.96 | 2.03 | cSlope reproduce |
| V037 | spencer | search | 1.6200 | — | — | 1.6073 | -0.78 | 2.31 | cSlope reproduce |
| V064 | bishop | fixed | 1.0200 | — | — | 1.0172 | -0.28 | 1.49 | cSlope reproduce |
| V065 | spencer | fixed | 0.9640 | — | — | 0.9585 | -0.57 | 1.05 | cSlope reproduce |
| V066a | bishop | fixed | 1.0400 | — | — | 1.0306 | -0.90 | 1.48 | cSlope reproduce |
| V066b | spencer | fixed | 1.0110 | — | — | 1.0111 | +0.01 | 1.05 | cSlope reproduce |
| V066c | bishop | fixed | 1.0000 | — | — | 1.0116 | +1.16 | 1.50 | cSlope reproduce |
| V066e | bishop | fixed | 0.9580 | — | — | 0.9612 | +0.33 | 1.05 | cSlope reproduce |
| V083 | janbu_corrected | fixed | 0.8900 | — | — | 0.8845 | -0.62 | 1.56 | cSlope reproduce |
| V084a | janbu_corrected | fixed | 0.9890 | — | — | 0.9884 | -0.07 | 1.05 | cSlope reproduce |
| V084b | janbu_corrected | fixed | 1.1230 | — | — | 1.1243 | +0.11 | 1.04 | cSlope reproduce |
| V084c | janbu_corrected | fixed | 1.0430 | — | — | 1.0435 | +0.05 | 1.05 | cSlope reproduce |
| V084d | janbu_corrected | fixed | 0.9450 | — | — | 0.9443 | -0.08 | 1.05 | cSlope reproduce |
| V084e | janbu_corrected | fixed | 0.9220 | — | — | 0.9199 | -0.22 | 1.05 | cSlope reproduce |
| V084f | janbu_corrected | fixed | 0.9230 | — | — | 0.9206 | -0.26 | 1.05 | cSlope reproduce |
| V095c | bishop | fixed | 1.1930 | — | — | 1.1957 | +0.23 | 1.04 | cSlope reproduce |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Notas de conversión

- V010 (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V010 (morgenstern_price/fixed, bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V010b (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V011a (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V011b (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V012 (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V014 (janbu_corrected/fixed, spencer/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V015 (janbu_corrected/fixed, janbu_simplified/fixed): pilotes y tablestacas: location "slip-surface" (sin efecto con fuerza constante, X17 §3); la tablestaca va con spacing 1, force por metro y wall true.
- V015 (janbu_corrected/fixed, janbu_simplified/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V016b (bishop/fixed, spencer/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V035a (morgenstern_price/fixed): Morgenstern-Price con la función interslice half-sine (kebab-case de cSlope).
- V035a (morgenstern_price/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V035b (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V037 (bishop/search, spencer/search): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V037 (bishop/search, spencer/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V064 (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V065 (spencer/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V066a (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V066b (spencer/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V066c (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V066e (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V083 (janbu_corrected/fixed): cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; cSlope espeja la geometría rtl y el ángulo internamente).
- V083 (janbu_corrected/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V084a (janbu_corrected/fixed): cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; cSlope espeja la geometría rtl y el ángulo internamente).
- V084a (janbu_corrected/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V084b (janbu_corrected/fixed): cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; cSlope espeja la geometría rtl y el ángulo internamente).
- V084b (janbu_corrected/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V084c (janbu_corrected/fixed): cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; cSlope espeja la geometría rtl y el ángulo internamente).
- V084c (janbu_corrected/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V084d (janbu_corrected/fixed): cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; cSlope espeja la geometría rtl y el ángulo internamente).
- V084d (janbu_corrected/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V084e (janbu_corrected/fixed): cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; cSlope espeja la geometría rtl y el ángulo internamente).
- V084e (janbu_corrected/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V084f (janbu_corrected/fixed): cargas lineales: el ángulo va sin cambio a cSlope (positivo hacia +x del modelo, también en rtl; cSlope espeja la geometría rtl y el ángulo internamente).
- V084f (janbu_corrected/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V095c (bishop/fixed): pilotes y tablestacas: location "slip-surface" (sin efecto con fuerza constante, X17 §3); la tablestaca va con spacing 1, force por metro y wall true.
- V095c (bishop/fixed): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
