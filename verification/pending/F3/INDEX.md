# Casos de los lotes 1 y 2 (formato v0.3, esperan al motor)

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

Cada archivo es el **estado destino** del problema (versión `0.3`): trae todos los checks convertibles, también los del lote 0 que ya están en `verification/cases/`, así que promoverlo es reemplazar ese archivo. Los checks nuevos son los de métodos o modelos que el motor de `main` aún no admite (`morgenstern_price`, `janbu_simplified`, `janbu_corrected`, material `undrained`, superficie `polyline`). La verificación contra cSlope está en [`REPORT.md`](REPORT.md) (solo oráculo).

Casos: **48**; checks: **123** (de ellos del lote 0: 32, lote 1: **40**, lote 2: **51**).

| lote | contenido | checks | casos con checks del lote | casos nuevos (no estaban en los lotes anteriores) |
|---|---|---:|---:|---:|
| 1 | `undrained` y `s-f-datum` (Bishop y Spencer) | 40 | 21 | 21 |
| 2 | polilíneas fijas, M-P y Janbu | 51 | 36 | 11 |

Casos nuevos del lote 1 (21): V021a, V021b, V021c, V021d, V021e, V021f, V021g, V022a, V022b, V034a, V034b, V036a, V036b, V036c, V036d, V040, V057a, V057b, V067, V068, V086e.
Casos nuevos del lote 2 (11): V006, V007a, V007c, V018, V046a, V046b, V046c, V050a, V056, V077, V078.

| id | título | modelos | superficie | checks por lote (0/1/2) | métodos |
|---|---|---|---|---|---|
| V001 | Arai & Tagyo (1985) example 1 | mohr_coulomb | search | 2/0/2 | bishop, morgenstern_price |
| V003 | Arai & Tagyo (1985) example 3, water table | mohr_coulomb | search | 3/0/1 | bishop, spencer, janbu_corrected |
| V004a | 4:1 slope, Mohr-Coulomb fit | mohr_coulomb | search | 1/0/1 | spencer, janbu_simplified |
| V004b | Baker (2003) ex. 2 slope, Mohr-Coulomb iteration parameters | mohr_coulomb | search | 1/0/1 | spencer, janbu_simplified |
| V006 | Baker & Leshchinsky (2001) planar surface | mohr_coulomb | polyline | 0/0/2 | spencer, janbu_simplified |
| V007a | Baker (2003) ex. 1, Mohr-Coulomb, Janbu simplified on the reference circle | mohr_coulomb | circle | 0/0/1 | janbu_simplified |
| V007b | Baker (2003) ex. 1 slope, Mohr-Coulomb iteration parameters | mohr_coulomb | search | 1/0/1 | spencer, janbu_simplified |
| V007c | Baker (2003) ex. 3, Janbu simplified | mohr_coulomb | search | 0/0/1 | janbu_simplified |
| V018 | Chen & Shao (1988) frictionless 60° slope, Prandtl mechanism | mohr_coulomb | polyline | 0/0/3 | spencer, morgenstern_price |
| V021a | Chowdhury & Xu (1995) example 1, Congress Street cut, circle tangent to the base of clay 2 | mohr_coulomb, undrained | circle | 0/2/1 | bishop, morgenstern_price |
| V021b | Chowdhury & Xu (1995) example 1, Congress Street cut, circle tangent to the base of clay 3 | mohr_coulomb, undrained | circle | 0/2/1 | bishop, morgenstern_price |
| V021c | Chowdhury & Xu (1995) example 2, Congress Street cut, circle tangent to the base of clay 2 | mohr_coulomb, undrained | circle | 0/2/1 | bishop, morgenstern_price |
| V021d | Chowdhury & Xu (1995) example 2, Congress Street cut, circle tangent to the base of clay 3 | mohr_coulomb, undrained | circle | 0/2/1 | bishop, morgenstern_price |
| V021e | Chowdhury & Xu (1995) example 3, Congress Street cut, circle tangent to the base of clay 2 | mohr_coulomb, undrained | circle | 0/2/1 | bishop, morgenstern_price |
| V021f | Chowdhury & Xu (1995) example 3, Congress Street cut, circle tangent to the base of clay 3 | mohr_coulomb, undrained | circle | 0/2/1 | bishop, morgenstern_price |
| V021g | Chowdhury & Xu (1995) example 4, Congress Street cut, circle tangent to the base of clay 2 | mohr_coulomb, undrained | circle | 0/1/1 | bishop, morgenstern_price |
| V022a | Chowdhury & Xu (1995) example 5, embankment on soft clay, circle tangent to y = 15 | mohr_coulomb, undrained | circle | 0/2/1 | bishop, morgenstern_price |
| V022b | Chowdhury & Xu (1995) example 5, embankment on soft clay, circle tangent to y = 5 | mohr_coulomb, undrained | circle | 0/1/1 | bishop, morgenstern_price |
| V034a | Duncan & Wright fig. 14.20b, Su = 200 + 15·depth | mohr_coulomb, undrained | search | 0/2/0 | bishop, spencer |
| V034b | Duncan & Wright fig. 14.20b, Su = 300 psf | mohr_coulomb, undrained | search | 0/2/0 | bishop, spencer |
| V036a | Embankment on an undrained foundation, cz = 0 (D&W fig. 15.9) | mohr_coulomb, undrained | search | 0/3/0 | bishop, spencer |
| V036b | Embankment on an undrained foundation, cz = 5 psf/ft | mohr_coulomb, undrained | search | 0/3/0 | bishop, spencer |
| V036c | Embankment on an undrained foundation, cz = 10 psf/ft | mohr_coulomb, undrained | search | 0/3/0 | bishop, spencer |
| V036d | Embankment on an undrained foundation, cz = 15 psf/ft | mohr_coulomb, undrained | search | 0/3/0 | bishop, spencer |
| V040 | James Bay dyke, reference model (deterministic) | mohr_coulomb, undrained | search | 0/1/0 | bishop |
| V044 | Fredlund & Krahn (1977), dry | mohr_coulomb | circle | 2/0/1 | bishop, spencer, morgenstern_price |
| V044b | Fredlund & Krahn (1977), rᵤ = 0.25 | mohr_coulomb | circle | 2/0/1 | bishop, spencer, morgenstern_price |
| V045 | Fredlund & Krahn (1977), with water table | mohr_coulomb | circle | 2/0/1 | bishop, spencer, morgenstern_price |
| V046a | Fredlund & Krahn slope on a weak seam, composite surface | mohr_coulomb | polyline | 0/0/3 | spencer, morgenstern_price |
| V046b | Fredlund & Krahn slope on a weak seam, with a piezometric line | mohr_coulomb | polyline | 0/0/2 | spencer, morgenstern_price |
| V046c | Fredlund & Krahn slope on a weak seam, rᵤ = 0.25 | mohr_coulomb | polyline | 0/0/3 | spencer, morgenstern_price |
| V047a | ACADS 1(a), homogeneous slope, dry | mohr_coulomb | search | 4/0/2 | bishop, spencer, morgenstern_price, janbu_corrected |
| V049 | ACADS 1(c), three-layer slope | mohr_coulomb | search | 3/0/2 | bishop, spencer, morgenstern_price, janbu_corrected |
| V050a | ACADS 3(b), weak layer, specified non-circular surface | mohr_coulomb | polyline | 0/0/3 | spencer, morgenstern_price, janbu_corrected |
| V052a | Talbingo Dam, end of construction | mohr_coulomb | search | 3/0/1 | bishop, spencer, janbu_corrected |
| V052b | Talbingo Dam, specified circle | mohr_coulomb | circle | 2/0/2 | bishop, spencer, morgenstern_price, janbu_corrected |
| V056 | Griffiths & Lane example 3, thin weak layer, cu2/cu1 = 0.2 | undrained | polyline | 0/0/1 | janbu_corrected |
| V057a | Griffiths & Lane example 4, cu2/cu1 = 1 (deep base circle) | undrained | search | 0/2/0 | spencer |
| V057b | Griffiths & Lane example 4, cu2/cu1 = 2 (toe circle) | undrained | search | 0/2/0 | spencer |
| V067 | Low (1989), layered undrained clay | undrained | search | 0/1/0 | bishop |
| V068 | Low (1989), stiff crust over soft clays, published circle | mohr_coulomb, undrained | circle | 0/1/0 | bishop |
| V071b | Pockoski & Duncan slope 1, circular search | mohr_coulomb | search | 2/0/1 | bishop, spencer, janbu_simplified |
| V077 | Prandtl bearing capacity on level ground | undrained | polyline | 0/0/1 | spencer |
| V078 | Prandtl bearing capacity, fully specified Prandtl surface (reference values) | undrained | polyline | 0/0/1 | morgenstern_price |
| V086e | Tandjiria embankment, sand fill, the paper's geometry | mohr_coulomb, undrained | search | 0/1/0 | spencer |
| V090 | USACE EM 1110-2-1902, example F-5 | mohr_coulomb | circle | 2/0/2 | bishop, spencer, morgenstern_price, janbu_corrected |
| V096d | Zhu & Lee slope, the paper's surface 3, dry | mohr_coulomb | circle | 1/0/1 | spencer, morgenstern_price |
| V096e | Zhu & Lee slope, the paper's surface 3, with the water table | mohr_coulomb | circle | 1/0/1 | spencer, morgenstern_price |

## Checks descartados en estos casos

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
| V013b | definition con clave que cambia el problema: piles, reinforcements |
| V013c | definition con clave que cambia el problema: piles, reinforcements |
| V013d | definition con clave que cambia el problema: piles, reinforcements |
| V013e | definition con clave que cambia el problema: piles, reinforcements |
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
