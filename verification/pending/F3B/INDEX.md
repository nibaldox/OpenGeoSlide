# Hoek-Brown, SHANSEP y búsqueda no circular (F3B, formato v0.6): promovidos y retenidos

Generado por `verification/tools/import_cslope.py`. No editar a mano (`HOLD.json` sí: lo lee el generador).
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope, y Hammah et al. (2005) para HAM1.

**16** casos con **20** checks pasaron a [`../../cases/`](../../cases/INDEX.md) (sección «Hoek-Brown y búsqueda no circular», con la tabla del publicado, ogs y cSlope por check), salvo **2** checks retenidos aquí (`HOLD.json`); la tabla de abajo los lista con sus números y la causa medida.

Los casos de cSlope son los checks con `nonCircularOptimization` (F6.12). Los diez problemas que ya tenían un caso en `verification/cases` con otros checks y otro modelo se llaman `<id>-nc` (V001, V002, V026, V033, V034a, V034b, V036a, V093, V102a, V102b): es el mismo modelo y los mismos checks de la fuente, con otro nombre. Ninguna tolerancia, valor publicado ni modelo cambió al promover.

## Checks retenidos

Cada check retenido es uno que el motor o el oráculo no reproducen, con su causa. Se promueve quitándolo de `HOLD.json` y regenerando, cuando se reproduzca.

| caso | método | publicado | por | tol % | ogs | cSlope | motivo y diagnóstico |
|---|---|---:|---|---:|---:|---:|---|
| V002-nc | spencer | 0.414 | Commercial program A (non-circular) | 2.12 | 0.3864 | 0.4110 | Limitación conocida de E16u (F6.14): la búsqueda no circular de ogs con Spencer llega a una rama con tracción y da 0,3864 frente al publicado 0,414 ± 2,12 % (banda [0,40522; 0,42278]): −6,66 %, fuera de la tolerancia. Las notas son negative_lambda y negative_effective_normal_major (λ = −0,499 en el círculo crítico). En las mismas superficies cSlope da 0,432209 (círculo) y 0,415225 (polilínea): la diferencia de 7 % viene de la selección de raíz de E12e (la raíz admisible de menor F, en una rama con tracción), la limitación de F1.6/R5-05, no del algoritmo no circular. La polilínea de ogs, evaluada por cSlope, cae dentro de la banda y a +1,03 % de la óptima de cSlope. Se mantiene E12e por conservadora. Evidencia: docs/fase3/exploracion/X29_proto/v002_raices_coordinador.json. El caso es V002 de la fuente (en cases/ ya existe V002 con su check circular de Bishop). No se cambia ninguna tolerancia, valor publicado ni modelo. |
| V009c | spencer | 1.868 | Commercial program B (optimized non-circular) | 2.03 | 1.8669 | 1.8669 | FS reproducido, aviso no informativo. ogs 1.8669 (-0.06 %), cSlope 1.8669 (-0.06 %), publicado 1.868 (Commercial program B, optimizado no circular), tolerancia 2.03 % (relativa): el FS está dentro de la tolerancia. El motor emite `interslice_shear_exceeds_strength` (E13k) con λ = 0,2271 (además de `water_above_ground`, informativo), y el test de aceptación rechaza todo aviso que no es informativo (E5), como en V009a y V009b de F3G y en V035b y V083 de F3R. No se amplía `INFORMATIVE_WARNINGS`, no se cambia el umbral de 3 y no se toca la tolerancia. El arnés (`verification/harness/run.py`) sí lo da por reproducido (OK); el probe del coordinador (`pending_f3b_probe.txt`) tampoco aplicaba el filtro de avisos de `acceptance.rs`. Es la misma geometría de V009a y V009b (grieta seca de 5 m y embalse sobre el terreno) con la búsqueda no circular. |
| V105a | bishop | 1.285 | Commercial program J | — | 1.2524 | 1.2851 | La fuente usa aboveWater en Sand with clay, fuera de v0.6 (F6.3). M-SH informó Bishop 1.252417 sin aboveWater frente al publicado 1.285: no reproduce el caso. No se descarta ni se sustituye aboveWater en un caso convertible; retener hasta poder representarlo y verificarlo. |

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
