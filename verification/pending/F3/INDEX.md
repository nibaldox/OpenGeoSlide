# Lotes 1 y 2 (formato v0.3): checks retenidos

Generado por `verification/tools/import_cslope.py` a partir de `HOLD.json`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

Los lotes 1 (`undrained` y `s-f-datum`) y 2 (polilíneas fijas, M-P y Janbu) están promovidos a `verification/cases/`: **47** casos (de ellos **31** nuevos) con **122** checks (del lote 0: 32, lote 1: **39**, lote 2: **51**). Aquí quedan solo los checks que el motor no reproduce, convertidos igual que los de `verification/cases/`. No se relaja ninguna tolerancia ni se toca ningún dato. Cuando el motor los reproduzca, el integrador los promueve quitándolos de `HOLD.json` y regenerando.

Checks retenidos: **1** en **1** casos.

| caso | método | publicado | por | tol % | ogs | cSlope | motivo y diagnóstico |
|---|---|---:|---|---:|---:|---:|---|
| V068 | bishop | 1.14 | Low (1989) | 2.44 | 1.1633 | 1.1429 | El FS reproduce el publicado (ogs 1.1633, +2.04 %, tol 2.44 %; cSlope 1.1429, +0.25 %) desde que el motor acepta un círculo cuyo arco termina tangente al terreno (centro a la cota de la cresta: xc + r = 33.557 sobre y = 16; antes NoValidSurface 'el círculo no corta el terreno'; corrección en slicer.rs, con test). Queda retenido por el mismo motivo que V027 y V028: el motor emite negative_effective_normal_major y la aceptación rechaza todo aviso que no sea informativo (E5). Medido: 3 de 55 dovelas con N' < 0, f = Σ\|N'<0\|/ΣW = 0.204 (umbral 0.05) y fracción de la longitud de base 0.183 (umbral 0.25): es la escarpa vertical del extremo superior, que cSlope también declara sensible al corte (slicingSensitive). Decisión del coordinador: tratar el aviso como informativo en este caso o dejarlo retenido. |

## Checks descartados en los casos de los lotes 1 y 2

- V001: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.386): superficie no circular (nonCircularOptimization)
- V034a: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.262): superficie no circular (nonCircularOptimization)
- V034b: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.182): superficie no circular (nonCircularOptimization)
- V036a: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 0.74): superficie no circular (nonCircularOptimization)
- V036c: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.018): superficie no circular (nonCircularOptimization)
- V036d: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.116): superficie no circular (nonCircularOptimization)
- V046a: Bishop (Bishop simplified, Commercial program A, 1.382): Bishop no admite superficies polilínea (contrato F3.6)
- V046a: Bishop (Bishop simplified, Fredlund & Krahn, 1.377): Bishop no admite superficies polilínea (contrato F3.6)
- V046b: Bishop (Bishop simplified, Fredlund & Krahn, 1.248): Bishop no admite superficies polilínea (contrato F3.6)
- V046c: Bishop (Bishop simplified, Commercial program A, 1.124): Bishop no admite superficies polilínea (contrato F3.6)
- V046c: Bishop (Bishop simplified, Fredlund & Krahn, 1.124): Bishop no admite superficies polilínea (contrato F3.6)

## Problemas que no entran

| id | motivo |
|---|---|
| V009a | opción de check que cambia el problema: tensionCrackDepth |
| V009b | opción de check que cambia el problema: tensionCrackDepth |
| V009c | opción de check que cambia el problema: tensionCrackDepth |
| V010 | definition con clave que cambia el problema: reinforcements |
| V010b | definition con clave que cambia el problema: reinforcements |
| V011a | definition con clave que cambia el problema: reinforcements |
| V011b | definition con clave que cambia el problema: reinforcements |
| V012 | definition con clave que cambia el problema: reinforcements |
| V013b | Ito-Matsui: pilote sin `force`; v0.5 con `lateral_pressure`, promovido a `verification/cases` (lote F3I) |
| V013c | Ito-Matsui: pilote sin `force`; v0.5 con `lateral_pressure`, promovido a `verification/cases` (lote F3I) |
| V013d | Ito-Matsui: pilote sin `force`; v0.5 con `lateral_pressure`, promovido a `verification/cases` (lote F3I) |
| V013e | Ito-Matsui: pilote sin `force`; v0.5 con `lateral_pressure`, promovido a `verification/cases` (lote F3I) |
| V014 | definition con clave que cambia el problema: reinforcements |
| V015 | definition con clave que cambia el problema: piles, reinforcements |
| V016b | definition con clave que cambia el problema: reinforcements |
| V017a | contorno no válido (Self-intersection[13.8160684182133 100.095038741757]) |
| V017b | definition con clave que cambia el problema: reinforcements |
| V023 | piezométrica sobre el terreno (agua embalsada) |
| V024 | piezométrica sobre el terreno (agua embalsada) |
| V035a | definition con clave que cambia el problema: reinforcements |
| V035b | definition con clave que cambia el problema: reinforcements |
| V037 | definition con clave que cambia el problema: reinforcements |
| V038 | piezométrica sobre el terreno (agua embalsada) |
| V038b | piezométrica sobre el terreno (agua embalsada) |
| V039 | opción de check que cambia el problema: compositeBase |
| V041a | piezométrica sobre el terreno (agua embalsada) |
| V041b | piezométrica sobre el terreno (agua embalsada) |
| V042 | piezométrica sobre el terreno (agua embalsada) |
| V043 | sin checks válidos |
| V047b | opción de check que cambia el problema: tensionCrackDepth |
| V048 | opción de check que cambia el problema: tensionCrackDepth |
| V050b | sin checks válidos |
| V051 | sin checks válidos |
| V099 | piezométrica sobre el terreno (agua embalsada) |
| V053 | sin checks válidos |
| V058 | piezométrica sobre el terreno (agua embalsada) |
| V059a | sin checks válidos |
| V059b | sin checks válidos |
| V059c | sin checks válidos |
| V061 | piezométrica sobre el terreno (agua embalsada) |
| V100 | material 'Clay' con modelo 'shear-normal' |
| V064 | definition con clave que cambia el problema: reinforcements |
| V065 | definition con clave que cambia el problema: reinforcements |
| V066a | definition con clave que cambia el problema: reinforcements |
| V066b | definition con clave que cambia el problema: reinforcements |
| V066c | definition con clave que cambia el problema: reinforcements |
| V066d | definition con clave que cambia el problema: reinforcements, waterTables |
| V066e | definition con clave que cambia el problema: reinforcements |
| V070 | piezométrica sobre el terreno (agua embalsada) |
| V072a | opción de check que cambia el problema: tensionCrackDepth |
| V072b | opción de check que cambia el problema: tensionCrackDepth |
| V073 | opción de check que cambia el problema: tensionCrackDepth |
| V074 | definition con clave que cambia el problema: reinforcements |
| V075 | definition con clave que cambia el problema: reinforcements |
| V076 | definition con clave que cambia el problema: reinforcements |
| V079 | opción de check que cambia el problema: tensionCrackDepth |
| V080 | opción de check que cambia el problema: tensionCrackDepth |
| V082a | opción de check que cambia el problema: tensionCrackDepth |
| V082b | opción de check que cambia el problema: tensionCrackDepth |
| V082c | sin checks válidos |
| V082d | sin checks válidos |
| V083 | definition con clave que cambia el problema: reinforcements |
| V084a | definition con clave que cambia el problema: reinforcements |
| V084b | definition con clave que cambia el problema: reinforcements |
| V084c | definition con clave que cambia el problema: reinforcements |
| V084d | definition con clave que cambia el problema: reinforcements |
| V084e | definition con clave que cambia el problema: reinforcements |
| V084f | definition con clave que cambia el problema: reinforcements |
| V085 | opción de check que cambia el problema: tensionCrackDepth |
| V103 | sin checks válidos |
| V086a | definition con clave que cambia el problema: reinforcements |
| V086b | opción de check que cambia el problema: tensionCrackDepth |
| V086c | opción de check que cambia el problema: tensionCrackDepth |
| V086d | opción de check que cambia el problema: tensionCrackAuto |
| V087 | piezométrica sobre el terreno (agua embalsada) |
| V088 | opción de check que cambia el problema: tensionCrackDepth |
| V089 | piezométrica sobre el terreno (agua embalsada) |
| V091 | piezométrica sobre el terreno (agua embalsada) |
| V092 | piezométrica sobre el terreno (agua embalsada) |
| V094 | sin checks válidos |
| V095c | definition con clave que cambia el problema: piles, reinforcements |
| V096a | opción de check que cambia el problema: tensionCrackDepth |
| V096b | opción de check que cambia el problema: tensionCrackDepth |
| V096c | opción de check que cambia el problema: tensionCrackDepth |
| V097b | opción de check que cambia el problema: partialFactors |
| V104b | material 'embankment' con propiedad no soportada: bBarLoad |
| V104c | material 'embankment' con propiedad no soportada: bBarLoad |
| V104d | material 'upper clay' con propiedad no soportada: bBar |
| V105a | material 'Peat, deep' con modelo 'shansep' |
| V105b | definition con clave que cambia el problema: earlierStage, waternet |
| V105c | definition con clave que cambia el problema: earlierStage, waternet |
| V105d | definition con clave que cambia el problema: earlierStage, waternet |
