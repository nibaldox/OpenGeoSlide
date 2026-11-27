# Hoek-Brown, SHANSEP y búsqueda no circular (F3B, formato v0.6): casos pendientes

Generado por `verification/tools/import_cslope.py --src $TMPDIR/cslope-src --f3b-only`. No editar a mano (`HOLD.json` sí: lo lee el generador).
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope, y Hammah et al. (2005) para HAM1.

**18** casos con **22** checks. Ninguno está promovido: el motor de este bloque no tiene aún la física v0.6, y B2 los pasa a [`../../cases/`](../../cases/INDEX.md) cuando el motor los reproduce, quitando de `HOLD.json` lo que corresponda y sin relajar ninguna tolerancia.

Los casos de cSlope son los checks con `nonCircularOptimization` (F6.12: los 16 casos de X23 §1 más V036a, X29 §8). Se escriben en la versión `0.6` con `analysis.search.non_circular` en sus valores por defecto (`seeds` 3, `max_vertices` 33): cSlope 0.1.0 no tiene esos parámetros en el documento y su motor usa 3 semillas y hasta 33 vértices (X24 §1), así que son los valores con los que corre el oráculo. HAM1 es el ejemplo 1 de Hammah et al. con su geometría reconstruida, círculo fijo y tolerancia de 0,5 % (F6.12).

## Casos y checks

| caso | método | superficie | publicado | por | tol % |
|---|---|---|---:|---|---:|
| V001 | spencer | search | 1.386 | Commercial program A (non-circular) | 2.04 |
| V002 | spencer | search | 0.414 | Commercial program A (non-circular) | 2.12 |
| V026 | spencer | search | 1.19 | Commercial program A (non-circular) | 2.42 |
| V033 | spencer | search | 1.534 | Commercial program A (non-circular) | 2.03 |
| V034a | spencer | search | 1.262 | Commercial program A (non-circular) | 2.04 |
| V034b | spencer | search | 1.182 | Commercial program A (non-circular) | 2.04 |
| V036a | spencer | search | 0.74 | Commercial program A (non-circular) | 2.68 |
| V093 | spencer | search | 1.325 | Commercial program A (non-circular) | 2.04 |
| V093 | janbu_simplified | search | 1.178 | Commercial program A (non-circular) | 2.04 |
| V102a | spencer | search | 0.999 | Commercial program A (non-circular) | 2.05 |
| V102b | spencer | search | 0.997 | Commercial program A (non-circular) | 2.05 |
| V009c | spencer | search | 1.868 | Commercial program B (optimized non-circular) | 2.03 |
| V050b | spencer | search | 1.246 | Commercial program A | 2.04 |
| V059a | spencer | search | 1.215 | Commercial program A (optimized) | 2.04 |
| V059b | spencer | search | 1.29 | Commercial program A (optimized) | 2.39 |
| V059c | spencer | search | 1.315 | Commercial program A (optimized) | 2.04 |
| V094 | spencer | search | 1.398 | Commercial program A (Monte Carlo) | 2.04 |
| V094 | morgenstern_price | search | 1.389 | Commercial program B | 2.04 |
| V103 | spencer | search | 1.02 | Baker (non-circular) | 2.49 |
| V103 | spencer | search | 1.01 | Commercial program A (non-circular) | 2.50 |
| HAM1 | bishop | fixed | 1.153 | Hammah et al. (2005), tabla 2 | 0.50 |
| HAM1 | spencer | fixed | 1.152 | Hammah et al. (2005), tabla 2 | 0.50 |

## Checks retenidos

Cada check retenido es uno que el motor o el oráculo no reproducen, con su causa. No se promueve hasta que se reproduzca.

| caso | método | publicado | por | ogs | cSlope | motivo y diagnóstico |
|---|---|---:|---|---:|---:|---|
| V105a | bishop | 1.285 | Commercial program J | 1.2524 | 1.2851 | La fuente usa aboveWater en Sand with clay, fuera de v0.6 (F6.3). M-SH informó Bishop 1.252417 sin aboveWater frente al publicado 1.285: no reproduce el caso. No se descarta ni se sustituye aboveWater en un caso convertible; retener hasta poder representarlo y verificarlo. |

## Casos de la lista que no se escriben

- V105a: material 'Sand with clay' con propiedad no soportada: aboveWater

## Otros casos con búsqueda no circular

El corpus de cSlope tiene más checks con `nonCircularOptimization`. No entran en F3B por el motivo de cada uno:

- V036c (1 check): fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo
- V036d (1 check): fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo
- V039 (2 checks): fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo
- V041a (1 check): fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo
- V041b (1 check): fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo
- V051 (1 check): fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo
- V053 (1 check): fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo
- V100 (3 checks): material 'Clay' con modelo 'shear-normal'
- V098 (1 check): fuera de la lista de F6.12 (X23 §1.4 y X29 §8): el conversor lo escribe, pero no se midió con el motor ni con el oráculo
