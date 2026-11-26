# Casos con refuerzos (lotes R1 a R4, formato v0.4): publicado frente a cSlope

Generado por `verification/tools/import_cslope.py`; la tabla sale de `report.json`, que escribe `verification/harness/run.py --oracle-only` en este directorio. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

**25** casos con **33** checks. Esperan al motor de refuerzos (R1-C y R1-M) y a la integración: mientras tanto solo se comparan el valor publicado y el oráculo (`--oracle-only`). No se relaja ninguna tolerancia ni se toca ningún dato del problema.

Los lotes son los de F4.12: **R1** anclajes (V016b, V035a, V035b, V037); **R2** clavos y geosintéticos con development (V011a, V011b, V012, V064, V065, V066a, V066b, V066c, V066e); **R3** geosintéticos con interface y clavos de pared (V010, V010b, V014, V083, V084a, V084b, V084c, V084d, V084e, V084f); **R4** pilotes de fuerza constante (V015, V095c).

cSlope reproduce el valor publicado, dentro de su tolerancia, en **33** de **33** checks. Quedan **retenidos 0** checks: el oráculo no los reproduce, así que no pueden ser el criterio de aceptación del motor, y se listan con su número.

| lote | caso | refuerzos | método | publicado | por | tol % | cSlope | Δ % | fuerzas del oráculo | estado |
|---|---|---:|---|---:|---|---:|---:|---:|---:|---|
| R1 | V016b | 3 | bishop | 1.835 | Commercial program A | 1.03 | 1.8302 | -0.26 | 0 de 3 | cSlope reproduce |
| R1 | V016b | 3 | spencer | 1.839 | Commercial program A | 1.03 | 1.8354 | -0.20 | 0 de 3 | cSlope reproduce |
| R1 | V016b | 3 | bishop | 1.83 | Program D | 1.27 | 1.8302 | +0.01 | 0 de 3 | cSlope reproduce |
| R1 | V035a | 1 | morgenstern_price | 1.575 | Commercial program A (GLE) | 1.03 | 1.5682 | -0.43 | 1 de 1 | cSlope reproduce |
| R1 | V035b | 1 | bishop | 1.324 | Commercial program A | 1.04 | 1.3206 | -0.26 | 1 de 1 | cSlope reproduce |
| R1 | V035b | 1 | bishop | 1.32 | Duncan & Wright | 1.38 | 1.3206 | +0.04 | 1 de 1 | cSlope reproduce |
| R1 | V037 | 5 | bishop | 1.629 | Commercial program A | 2.03 | 1.6134 | -0.96 | 5 de 5 | cSlope reproduce |
| R1 | V037 | 5 | spencer | 1.62 | Commercial program A | 2.31 | 1.6073 | -0.78 | 5 de 5 | cSlope reproduce |
| R2 | V011a | 1 | bishop | 1.23 | Commercial program A | 1.41 | 1.2198 | -0.83 | 1 de 1 | cSlope reproduce |
| R2 | V011b | 1 | bishop | 1.22 | Commercial program A | 1.41 | 1.2167 | -0.27 | 1 de 1 | cSlope reproduce |
| R2 | V012 | 1 | bishop | 0.98 | Commercial program A | 1.51 | 0.9818 | +0.18 | 1 de 1 | cSlope reproduce |
| R2 | V064 | 15 | bishop | 1.02 | Program D | 1.49 | 1.0172 | -0.28 | 15 de 15 | cSlope reproduce |
| R2 | V065 | 15 | spencer | 0.964 | Commercial program A | 1.05 | 0.9585 | -0.57 | 2 de 15 | cSlope reproduce |
| R2 | V066a | 15 | bishop | 1.04 | Commercial program A | 1.48 | 1.0306 | -0.90 | 15 de 15 | cSlope reproduce |
| R2 | V066b | 15 | spencer | 1.011 | Program D | 1.05 | 1.0111 | +0.01 | 9 de 15 | cSlope reproduce |
| R2 | V066c | 15 | bishop | 1 | Leshchinsky & Han (2004) | 1.50 | 1.0116 | +1.16 | 15 de 15 | cSlope reproduce |
| R2 | V066e | 15 | bishop | 0.958 | Commercial program A | 1.05 | 0.9612 | +0.33 | 15 de 15 | cSlope reproduce |
| R3 | V010 | 1 | morgenstern_price | 1.171 | Commercial program B | 2.04 | 1.1627 | -0.71 | 1 de 1 | cSlope reproduce |
| R3 | V010 | 1 | bishop | 1.17 | Commercial program B | 2.43 | 1.1640 | -0.51 | 1 de 1 | cSlope reproduce |
| R3 | V010b | 1 | bishop | 1.15 | Borges & Cardoso | 2.43 | 1.1588 | +0.76 | 1 de 1 | cSlope reproduce |
| R3 | V014 | 14 | janbu_corrected | 1.46 | Program H | 1.34 | 1.4482 | -0.81 | 8 de 14 | cSlope reproduce |
| R3 | V014 | 14 | janbu_corrected | 1.448 | Program D | 1.03 | 1.4482 | +0.02 | 8 de 14 | cSlope reproduce |
| R3 | V014 | 14 | spencer | 1.576 | Program D | 1.03 | 1.5755 | -0.03 | 8 de 14 | cSlope reproduce |
| R3 | V083 | 2 | janbu_corrected | 0.89 | Commercial program A | 1.56 | 0.8845 | -0.62 | 2 de 2 | cSlope reproduce |
| R3 | V084a | 7 | janbu_corrected | 0.989 | Commercial program A | 1.05 | 0.9884 | -0.07 | 7 de 7 | cSlope reproduce |
| R3 | V084b | 7 | janbu_corrected | 1.123 | Commercial program A | 1.04 | 1.1243 | +0.11 | 7 de 7 | cSlope reproduce |
| R3 | V084c | 7 | janbu_corrected | 1.043 | Commercial program A | 1.05 | 1.0435 | +0.05 | 7 de 7 | cSlope reproduce |
| R3 | V084d | 7 | janbu_corrected | 0.945 | Commercial program A | 1.05 | 0.9443 | -0.08 | 7 de 7 | cSlope reproduce |
| R3 | V084e | 7 | janbu_corrected | 0.922 | Commercial program A | 1.05 | 0.9199 | -0.22 | 7 de 7 | cSlope reproduce |
| R3 | V084f | 7 | janbu_corrected | 0.923 | Commercial program A | 1.05 | 0.9206 | -0.26 | 7 de 7 | cSlope reproduce |
| R4 | V015 | 3 | janbu_corrected | 1.479 | Commercial program A | 1.03 | 1.4764 | -0.18 | 3 de 3 | cSlope reproduce |
| R4 | V015 | 3 | janbu_simplified | 1.446 | Commercial program A | 1.03 | 1.4418 | -0.29 | 3 de 3 | cSlope reproduce |
| R4 | V095c | 1 | bishop | 1.193 | Commercial program A | 1.04 | 1.1957 | +0.23 | 1 de 1 | cSlope reproduce |

## Checks en los que el oráculo no aplica ninguna fuerza

La columna «fuerzas del oráculo» cuenta las fuerzas que cSlope aplica en su superficie crítica. Con 0 el valor de cSlope es el del talud sin refuerzo, así que el acuerdo con el publicado **no prueba nada sobre los refuerzos**; el binario instalado (`a80f9a0`) descarta los activos con `along > 0`, que ogs aplica (E14m-1). El motor no debe usar estos checks como criterio de las fuerzas: V016b (bishop, 1.835), V016b (spencer, 1.839), V016b (bishop, 1.83).

## Checks descartados en la conversión

Ninguno.

## Problemas de los lotes que no entran

Ninguno.

V013b a V013e (Ito-Matsui, sin `force`) quedan fuera de v0.4 y siguen sin importarse.
