# Grieta de tracción y agua embalsada (F3G, formato v0.5): casos preparados

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

**32** casos con **81** checks que el oráculo cSlope reproduce dentro de la tolerancia de su fuente, listos para promover a `verification/cases/` cuando el motor tenga la grieta y el agua embalsada (los promueve el integrador). Otros **5** checks están retenidos (`HOLD.json`, carpeta `hold/`): X18 los dio por fuera de tolerancia (ver la nota de convención abajo). No se relaja ninguna tolerancia ni se toca ningún dato.

Un caso sin grieta se escribe en v0.3 (versión mínima de sus campos); con grieta, en v0.5. El agua embalsada no tiene campo: la activa que la piezométrica pase sobre el terreno (F5.3). La grieta es un campo del modelo, no del check: los checks de V086b con otra grieta van a `V086b-auto`.

| caso | v | grieta | agua embalsada | cota máx. de la piezométrica | checks | retenidos |
|---|---|---|---|---:|---:|---:|
| V009a | 0.5 | 5 m, water_fill 0 | sí | 30 | 1 | 0 |
| V009b | 0.5 | 5 m, water_fill 0 | sí | 30 | 0 | 1 |
| V023 | 0.3 | — | sí | 0 | 1 | 0 |
| V024 | 0.3 | — | sí | 92.0496 | 4 | 0 |
| V038 | 0.3 | — | sí | 12.192 | 3 | 0 |
| V038b | 0.3 | — | sí | 12.192 | 1 | 0 |
| V041a | 0.3 | — | sí | 22.86 | 3 | 0 |
| V041b | 0.3 | — | sí | 32.004 | 3 | 0 |
| V042 | 0.3 | — | sí | 96.012 | 2 | 0 |
| V047b | 0.5 | 3.6 m, water_fill 0 | no | — | 2 | 0 |
| V048 | 0.5 | 4 m, water_fill 1 | no | — | 3 | 0 |
| V058 | 0.3 | — | sí | 24.4 | 2 | 0 |
| V061 | 0.3 | — | sí | 169.774 | 3 | 0 |
| V070 | 0.3 | — | sí | 30.48 | 3 | 0 |
| V072a | 0.5 | 1.6764 m, water_fill 0 | no | 42.672 | 2 | 0 |
| V072b | 0.5 | 1.6764 m, water_fill 0 | no | 42.672 | 3 | 0 |
| V073 | 0.5 | 1.8288 m, water_fill 0 | no | 42.672 | 2 | 0 |
| V079 | 0.5 | 15 m, water_fill 0.25 | no | 18.75 | 2 | 0 |
| V080 | 0.5 | 15 m, water_fill 0.25 | no | 18.75 | 2 | 0 |
| V082a | 0.5 | 3.3528 m, water_fill 0 | no | 28.2854 | 4 | 0 |
| V082b | 0.5 | 3.3528 m, water_fill 0.54545 | no | 28.2854 | 4 | 0 |
| V085 | 0.5 | 11.4 m, water_fill 0 | no | — | 4 | 0 |
| V086b | 0.5 | 2 m, water_fill 1 | no | — | 2 | 0 |
| V086b-auto | 0.5 | auto, water_fill 1 | no | — | 1 | 0 |
| V086c | 0.5 | 2 m, water_fill 0 | no | — | 2 | 0 |
| V086d | 0.5 | auto, water_fill 1 | no | — | 1 | 0 |
| V087 | 0.3 | — | sí | 6.096 | 0 | 1 |
| V088 | 0.5 | 2.1336 m, water_fill 0 | no | 0 | 4 | 0 |
| V089 | 0.3 | — | sí | 6.096 | 4 | 0 |
| V091 | 0.3 | — | sí | 0 | 4 | 0 |
| V092 | 0.3 | — | sí | 30.48 | 1 | 3 |
| V096a | 0.5 | 1.015 m, water_fill 0 | no | — | 3 | 0 |
| V096b | 0.5 | 1.015 m, water_fill 0 | no | 10.269 | 3 | 0 |
| V096c | 0.5 | 1.015 m, water_fill 0 | no | — | 2 | 0 |

## Checks retenidos

La causa es la que diagnosticó X18 (`docs/fase3/exploracion/X18.md` §3.1). **Convención de tolerancia:** X18 compara |Δ %| con `tolerance/publicado` (toma la tolerancia como absoluta) y por eso los da por fuera; el harness y `acceptance.rs` usan `tolerance` como relativa (`|Δ|/publicado ≤ tolerance`), y con ella el oráculo reproduce estos cinco checks (columna «tol %» de abajo; [`hold/REPORT.md`](hold/REPORT.md) da 5/5). Se retienen por la decisión de F5.6 hasta que el integrador decida: promoverlos es quitarlos de `HOLD.json` y regenerar.

| caso | método | publicado | por | tol % | ogs | cSlope | motivo y diagnóstico |
|---|---|---:|---|---:|---:|---:|---|
| V009b | spencer | 1.91 | Baker & Leshchinsky | 2.26 | — | 1.8817 | Program D da 1,882 en la misma superficie (notes del corpus): el oráculo coincide con Program D; la diferencia está en el valor publicado (Baker & Leshchinsky). No es conversión. Convención de tolerancia: X18 §3.1 compara \|Δ %\| con tolerance/publicado (la toma como absoluta) y por eso lo marca fuera; el harness y acceptance.rs usan la tolerancia como relativa (\|Δ\|/publicado ≤ tolerance), y con ella el oráculo lo reproduce (-1.48 % frente a 2.26 %). Se retiene por la decisión de F5.6 hasta que el integrador lo promueva. |
| V087 | janbu_corrected | 2.29 | Commercial program A | 2.22 | — | 2.2476 | Radio 169,0 ft en vez de 169,1 (el 0,5 % de sensibilidad se cita en las notes del corpus); «los tres modelos de Program A llevan geometrías ligeramente distintas». Revisar la conversión del círculo. Convención de tolerancia: X18 §3.1 compara \|Δ %\| con tolerance/publicado (la toma como absoluta) y por eso lo marca fuera; el harness y acceptance.rs usan la tolerancia como relativa (\|Δ\|/publicado ≤ tolerance), y con ella el oráculo lo reproduce (-1.85 % frente a 2.22 %). Se retiene por la decisión de F5.6 hasta que el integrador lo promueva. |
| V092 | bishop | 2.011 | Commercial program A | 2.02 | — | 1.9903 | Línea piezométrica de la versión del programa, no la de la figura F-17a (publicNote del corpus): en la línea del manual, cSlope da Bishop 2,05–2,06 y MP 2,06–2,08. No se toca el dato. Convención de tolerancia: X18 §3.1 compara \|Δ %\| con tolerance/publicado (la toma como absoluta) y por eso lo marca fuera; el harness y acceptance.rs usan la tolerancia como relativa (\|Δ\|/publicado ≤ tolerance), y con ella el oráculo lo reproduce (-1.03 % frente a 2.02 %). Se retiene por la decisión de F5.6 hasta que el integrador lo promueva. |
| V092 | spencer | 2.026 | Commercial program A | 2.02 | — | 2.0046 | Línea piezométrica de la versión del programa, no la de la figura F-17a (publicNote del corpus): en la línea del manual, cSlope da Bishop 2,05–2,06 y MP 2,06–2,08. No se toca el dato. Convención de tolerancia: X18 §3.1 compara \|Δ %\| con tolerance/publicado (la toma como absoluta) y por eso lo marca fuera; el harness y acceptance.rs usan la tolerancia como relativa (\|Δ\|/publicado ≤ tolerance), y con ella el oráculo lo reproduce (-1.06 % frente a 2.02 %). Se retiene por la decisión de F5.6 hasta que el integrador lo promueva. |
| V092 | morgenstern_price | 2.027 | Commercial program A | 2.02 | — | 2.0048 | Línea piezométrica de la versión del programa, no la de la figura F-17a (publicNote del corpus): en la línea del manual, cSlope da Bishop 2,05–2,06 y MP 2,06–2,08. No se toca el dato. Convención de tolerancia: X18 §3.1 compara \|Δ %\| con tolerance/publicado (la toma como absoluta) y por eso lo marca fuera; el harness y acceptance.rs usan la tolerancia como relativa (\|Δ\|/publicado ≤ tolerance), y con ella el oráculo lo reproduce (-1.10 % frente a 2.02 %). Se retiene por la decisión de F5.6 hasta que el integrador lo promueva. |

## Problemas con grieta o agua embalsada que no entran en F3G

- V009c: sin checks válidos
- V017a: contorno no válido (Self-intersection[13.8160684182133 100.095038741757])
- V017b: definition con clave que cambia el problema: reinforcements
- V099: sin checks válidos
- V074: definition con clave que cambia el problema: reinforcements
- V086a: definition con clave que cambia el problema: reinforcements
- V105a: material 'Peat, deep' con modelo 'shansep'
- V105b: definition con clave que cambia el problema: earlierStage, waternet
- V105c: definition con clave que cambia el problema: earlierStage, waternet
- V105d: definition con clave que cambia el problema: earlierStage, waternet

## Checks descartados dentro de los casos

- V041a: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.592): superficie no circular (nonCircularOptimization)
- V041b: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.59): superficie no circular (nonCircularOptimization)
- V073: Bishop (Bishop simplified, composite circle, Commercial program A (composite), 1.392): opción compositeBase=True
- V073: Morgenstern-Price (Spencer (M-P, constant f(x)), composite circle, Commercial program A (composite), 1.4): opción compositeBase=True

El cotejo publicado frente a cSlope de cada check está en [`REPORT.md`](REPORT.md) (`verification/harness/run.py --oracle-only` sobre esta carpeta y sobre `hold/`).
