# Verificación cruzada: publicado vs. ogs vs. cSlope

Generado: 2026-11-26T19:18:20-03:00 · harness v1 · casos: `verification/pending/F3I` (4 casos, 4 checks)

## Motores

- **ogs**: no se ejecutó (`--oracle-only`): estos casos esperan al motor; se verifica solo que cSlope reproduzca el valor publicado.
- **cSlope**: cslope 0.1.0 · motor 0.1.0+a80f9a024954 · esquema 0.1.0 · Python 3.13.14

## Resumen

| motor | OK | FALLA | sin dato | no convergido |
|---|---:|---:|---:|---:|
| ogs | — | — | — (no aplica: solo oráculo) | — |
| cSlope | 4 | 0 | 0 | 0 |

cSlope reproduce el valor publicado dentro de tolerancia en **4/4** checks.

## Tabla

| caso | método | tipo | publicado | ogs | err ogs % | cSlope | err cSlope % | tol % | estado |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| V013b | bishop | search | 1.5400 | — | — | 1.5408 | +0.05 | 2.32 | cSlope reproduce |
| V013c | bishop | search | 1.4300 | — | — | 1.4371 | +0.49 | 2.35 | cSlope reproduce |
| V013d | bishop | search | 1.3300 | — | — | 1.3314 | +0.11 | 2.38 | cSlope reproduce |
| V013e | bishop | search | 1.2500 | — | — | 1.2528 | +0.22 | 2.40 | cSlope reproduce |

Estado: veredicto de ogs (OK / FALLA / sin dato / no convergido). Si cSlope no reproduce el publicado, se añade «revisar conversión» (el fallo puede estar en el conversor, en el publicado o en el motor).

## Notas de conversión

- V013b (bishop/search): pilotes y tablestacas: location "slip-surface" (sin efecto con fuerza constante, X17 §3); la tablestaca va con spacing 1, force por metro y wall true.
- V013b (bishop/search): pilotes Ito-Matsui (E15i): diameter sin force, location centroid o slip-surface y las capacidades shearCapacity y momentCapacity por pilote; cSlope aplica el piso de φ = 0 y la tensión efectiva.
- V013b (bishop/search): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V013b (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V013c (bishop/search): pilotes y tablestacas: location "slip-surface" (sin efecto con fuerza constante, X17 §3); la tablestaca va con spacing 1, force por metro y wall true.
- V013c (bishop/search): pilotes Ito-Matsui (E15i): diameter sin force, location centroid o slip-surface y las capacidades shearCapacity y momentCapacity por pilote; cSlope aplica el piso de φ = 0 y la tensión efectiva.
- V013c (bishop/search): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V013c (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V013d (bishop/search): pilotes y tablestacas: location "slip-surface" (sin efecto con fuerza constante, X17 §3); la tablestaca va con spacing 1, force por metro y wall true.
- V013d (bishop/search): pilotes Ito-Matsui (E15i): diameter sin force, location centroid o slip-surface y las capacidades shearCapacity y momentCapacity por pilote; cSlope aplica el piso de φ = 0 y la tensión efectiva.
- V013d (bishop/search): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V013d (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).
- V013e (bishop/search): pilotes y tablestacas: location "slip-surface" (sin efecto con fuerza constante, X17 §3); la tablestaca va con spacing 1, force por metro y wall true.
- V013e (bishop/search): pilotes Ito-Matsui (E15i): diameter sin force, location centroid o slip-surface y las capacidades shearCapacity y momentCapacity por pilote; cSlope aplica el piso de φ = 0 y la tensión efectiva.
- V013e (bishop/search): refuerzos: fx y fy del oráculo en coordenadas del modelo; el binario cSlope 0.1.0 descarta también los activos comprimidos (along > 0), que ogs aplica (E14m-1): las filas de aceptación solo usan along < 0.
- V013e (bishop/search): search: cSlope's own search (not ogs' grid); iterations taken from the ogs grid size (8000); minFailureDist = min_width (cSlope measures entry-exit distance).

## Reproducir

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/harness/run.py --cases DIR --ogs PATH_BINARIO_OGS --out DIR
```
