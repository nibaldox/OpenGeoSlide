# Casos de verificación v0.1 (desde cSlope)

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

Casos convertidos e incluidos: **16**. Casos no incluidos: **171** (no convertibles o convertibles pero fuera del conjunto mínimo; motivo en cada fila).

| id | título | referencia | unidades | checks (bishop/spencer) | tipo |
|---|---|---|---|---|---|
| V001 | Arai & Tagyo (1985) example 1 | Arai & Tagyo (1985), example 1. | SI | 2 / 0 | search |
| V002 | Arai & Tagyo (1985) example 2, three layers | Arai & Tagyo (1985), example 2. | SI | 1 / 0 | search |
| V003 | Arai & Tagyo (1985) example 3, water table | Arai & Tagyo (1985), Soils and Foundations 25(1). | SI | 2 / 1 | search |
| V016a | Stepped gabion wall, equivalent cohesion | Cao et al. (2016); Grodecki (2017). | SI | 2 / 1 | fixed |
| V019 | Cheng et al. 11 m homogeneous slope | Cheng, Y.M., Lansivaara, T. & Wei, W.B. (2007). Two-dimensional slope stability analysis by limit equilibrium and strength reduction methods. Computers and Geotechnics 34(3), 137–150. | SI | 1 / 3 | search |
| V025 | Duncan & Wright fig. 6.38, piezometric line | Duncan & Wright, Soil Strength and Slope Stability, fig. 6.38. | SI | 1 / 1 | search |
| V030 | Duncan & Wright fig. 14.4 | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.4. | imperial | 1 / 1 | search |
| V033 | Duncan & Wright fig. 14.20a, water table | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.20a. | SI | 1 / 1 | search |
| V044 | Fredlund & Krahn (1977), dry | Fredlund, D.G. & Krahn, J. (1977). Comparison of slope stability methods of analysis. Can. Geotech. J. 14(3). | imperial | 1 / 1 | fixed |
| V044b | Fredlund & Krahn (1977), rᵤ = 0.25 | Fredlund, D.G. & Krahn, J. (1977). Comparison of slope stability methods of analysis. Can. Geotech. J. 14(3), 429–439. | imperial | 1 / 1 | fixed |
| V045 | Fredlund & Krahn (1977), with water table | Fredlund, D.G. & Krahn, J. (1977). Can. Geotech. J. 14(3). | SI | 1 / 1 | fixed |
| V047a | ACADS 1(a), homogeneous slope, dry | Giam & Donald (1989). | SI | 2 / 2 | search |
| V049 | ACADS 1(c), three-layer slope | Giam & Donald (1989), ACADS slope stability programs review. | SI | 2 / 1 | search |
| V063 | Huang & Jia earth dam, dry | Huang, M. & Jia, C.-Q. (2009). Strength reduction FEM in stability analysis of soil slopes subjected to transient unsaturated seepage. Computers and Geotechnics 36(1–2), 93–101. | SI | 1 / 1 | search |
| V101 | Li & Lumb (1987) homogeneous slope, rᵤ = 0.2 | Li, K.S. & Lumb, P. (1987). Probabilistic design of slopes. Can. Geotech. J. 24(4), 520–535; Hassan, A.M. & Wolff, T.F. (1999). J. Geotech. Geoenviron. Eng. 125(4), 301–308. | SI | 3 / 0 | search |
| V093 | Yamagami & Ueta (1988) | Yamagami & Ueta (1988). | SI | 1 / 0 | search |

## Checks descartados en casos convertidos

- V001: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program A (GLE), 1.414): método no soportado
- V001: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program B, 1.414): método no soportado
- V001: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.386): superficie no circular (nonCircularOptimization)
- V002: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 0.414): superficie no circular (nonCircularOptimization)
- V003: Janbu (Janbu corrected (f0), Commercial program A, 1.131): método no soportado
- V033: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.534): superficie no circular (nonCircularOptimization)
- V044: Morgenstern-Price (Morgenstern-Price (half-sine), Fredlund & Krahn, 2.076): método no soportado
- V044b: Morgenstern-Price (Morgenstern-Price (half-sine), Fredlund & Krahn, 1.764): método no soportado
- V045: Morgenstern-Price (Morgenstern-Price (half-sine), Fredlund & Krahn, 1.832): método no soportado
- V047a: Janbu (Janbu corrected (f0), Commercial program A, 0.99): método no soportado
- V047a: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program B, 0.991): método no soportado
- V049: Janbu (Janbu corrected (f0), Commercial program A, 1.357): método no soportado
- V049: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program B, 1.382): método no soportado
- V093: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.325): superficie no circular (nonCircularOptimization)
- V093: Janbu (Janbu simplified (uncorrected), Commercial program A (non-circular), 1.178): método no soportado

## Casos no incluidos

| id | motivo |
|---|---|
| V006 | definition con clave que cambia el problema: customSurfaces |
| V007a | sin checks válidos |
| V007c | sin checks válidos |
| V009a | opción de check que cambia el problema: tensionCrackDepth |
| V009b | definition con clave que cambia el problema: customSurfaces |
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
| V014 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V015 | definition con clave que cambia el problema: customSurfaces, piles, reinforcements |
| V016b | definition con clave que cambia el problema: reinforcements |
| V017a | definition con clave que cambia el problema: udls |
| V017b | definition con clave que cambia el problema: reinforcements, udls |
| V018 | definition con clave que cambia el problema: customSurfaces, udls |
| V021a | material 'Sand' con modelo 'undrained' |
| V021b | material 'Sand' con modelo 'undrained' |
| V021c | material 'Sand' con modelo 'undrained' |
| V021d | material 'Sand' con modelo 'undrained' |
| V021e | material 'Sand' con modelo 'undrained' |
| V021f | material 'Sand' con modelo 'undrained' |
| V021g | material 'Sand' con modelo 'undrained' |
| V022a | material 'Layer 2' con modelo 'undrained' |
| V022b | material 'Layer 2' con modelo 'undrained' |
| V023 | material 'San Francisco Bay Mud' con modelo 'undrained' |
| V024 | piezométrica sobre el terreno (agua embalsada) |
| V034a | material 'Clay' con modelo 'undrained' |
| V034b | material 'Clay' con modelo 'undrained' |
| V035a | definition con clave que cambia el problema: reinforcements |
| V035b | definition con clave que cambia el problema: reinforcements |
| V036a | material 'Foundation' con modelo 'undrained' |
| V036b | material 'Foundation' con modelo 'undrained' |
| V036c | material 'Foundation' con modelo 'undrained' |
| V036d | material 'Foundation' con modelo 'undrained' |
| V037 | definition con clave que cambia el problema: reinforcements |
| V038 | piezométrica sobre el terreno (agua embalsada) |
| V038b | piezométrica sobre el terreno (agua embalsada) |
| V039 | opción de check que cambia el problema: compositeBase |
| V040 | material 'Clay crust' con modelo 'undrained' |
| V041a | piezométrica sobre el terreno (agua embalsada) |
| V041b | piezométrica sobre el terreno (agua embalsada) |
| V042 | piezométrica sobre el terreno (agua embalsada) |
| V043 | definition con clave que cambia el problema: customSurfaces |
| V046a | definition con clave que cambia el problema: customSurfaces |
| V046b | definition con clave que cambia el problema: customSurfaces |
| V046c | definition con clave que cambia el problema: customSurfaces |
| V047b | opción de check que cambia el problema: tensionCrackDepth |
| V048 | opción de check que cambia el problema: tensionCrackDepth |
| V050a | definition con clave que cambia el problema: customSurfaces |
| V050b | sin checks válidos |
| V051 | definition con clave que cambia el problema: udls |
| V099 | campo ausente en cSlope: 'regionAssignments' |
| V053 | sin checks válidos |
| V056 | definition con clave que cambia el problema: customSurfaces |
| V057a | material 'Slope clay' con modelo 'undrained' |
| V057b | material 'Slope clay' con modelo 'undrained' |
| V058 | piezométrica sobre el terreno (agua embalsada) |
| V059a | material 'Embankment' con modelo 'undrained' |
| V059b | material 'Embankment' con modelo 'undrained' |
| V059c | material 'Embankment' con modelo 'undrained' |
| V061 | definition con clave que cambia el problema: customSurfaces |
| V100 | material 'Clay' con modelo 'shear-normal' |
| V064 | definition con clave que cambia el problema: reinforcements |
| V065 | definition con clave que cambia el problema: reinforcements |
| V066a | definition con clave que cambia el problema: reinforcements |
| V066b | definition con clave que cambia el problema: reinforcements |
| V066c | definition con clave que cambia el problema: reinforcements |
| V066d | definition con clave que cambia el problema: reinforcements, waterTables |
| V066e | definition con clave que cambia el problema: reinforcements, udls |
| V102a | opción de check que cambia el problema: seismicHorizontal |
| V102b | opción de check que cambia el problema: seismicHorizontal |
| V067 | material 'A' con modelo 'undrained' |
| V068 | material 'Lower' con modelo 's-f-datum' |
| V070 | piezométrica sobre el terreno (agua embalsada) |
| V072a | opción de check que cambia el problema: tensionCrackDepth |
| V072b | opción de check que cambia el problema: tensionCrackDepth |
| V073 | opción de check que cambia el problema: tensionCrackDepth |
| V074 | definition con clave que cambia el problema: customSurfaces, reinforcements, udls |
| V075 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V076 | definition con clave que cambia el problema: reinforcements |
| V077 | definition con clave que cambia el problema: customSurfaces, udls |
| V078 | definition con clave que cambia el problema: customSurfaces, udls |
| V079 | definition con clave que cambia el problema: customSurfaces |
| V080 | definition con clave que cambia el problema: customSurfaces |
| V081a | definition con clave que cambia el problema: udls |
| V081b | definition con clave que cambia el problema: udls |
| V082a | opción de check que cambia el problema: tensionCrackDepth |
| V082b | opción de check que cambia el problema: tensionCrackDepth |
| V082c | material 'Soil 2 (zero strength)' con modelo 'undrained' |
| V082d | material 'Soil 2 (zero strength)' con modelo 'undrained' |
| V083 | definition con clave que cambia el problema: customSurfaces, lineLoads, reinforcements |
| V084a | definition con clave que cambia el problema: customSurfaces, lineLoads, reinforcements |
| V084b | definition con clave que cambia el problema: customSurfaces, lineLoads, reinforcements |
| V084c | definition con clave que cambia el problema: customSurfaces, lineLoads, reinforcements |
| V084d | definition con clave que cambia el problema: customSurfaces, lineLoads, reinforcements |
| V084e | definition con clave que cambia el problema: customSurfaces, lineLoads, reinforcements |
| V084f | definition con clave que cambia el problema: customSurfaces, lineLoads, reinforcements |
| V085 | opción de check que cambia el problema: tensionCrackDepth |
| V103 | sin checks válidos |
| V086a | definition con clave que cambia el problema: reinforcements |
| V086b | opción de check que cambia el problema: tensionCrackDepth |
| V086c | opción de check que cambia el problema: tensionCrackDepth |
| V086d | opción de check que cambia el problema: tensionCrackAuto |
| V086e | material 'Soft clay' con modelo 'undrained' |
| V087 | piezométrica sobre el terreno (agua embalsada) |
| V088 | opción de check que cambia el problema: tensionCrackDepth |
| V089 | cara sin material asignado |
| V091 | material 'Soil 1' con modelo 'undrained' |
| V092 | piezométrica sobre el terreno (agua embalsada) |
| V094 | sin checks válidos |
| V095c | definition con clave que cambia el problema: piles, reinforcements |
| V096a | opción de check que cambia el problema: tensionCrackDepth |
| V096b | opción de check que cambia el problema: tensionCrackDepth |
| V096c | opción de check que cambia el problema: tensionCrackDepth |
| V097a | definition con clave que cambia el problema: udls |
| V097b | definition con clave que cambia el problema: udls |
| V104b | material 'embankment' con propiedad no soportada: bBarLoad |
| V104c | definition con clave que cambia el problema: udls |
| V104d | definition con clave que cambia el problema: udls |
| V105a | material 'Peat, deep' con modelo 'shansep' |
| V105b | definition con clave que cambia el problema: earlierStage, udls, waternet |
| V105c | definition con clave que cambia el problema: customSurfaces, earlierStage, udls, waternet |
| V105d | definition con clave que cambia el problema: customSurfaces, earlierStage, udls, waternet |
| V004a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V004b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V005 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V007b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V008a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V008b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V013a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V016c | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V020 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V026 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V027 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V028 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V029 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V031a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V031b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V032a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V032b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V052a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V052b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V054 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V055 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V060a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V060b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062c | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062d | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062e | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062f | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062g | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062h | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V062i | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V069a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V069b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V071a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V071b | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V090 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V095a | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V096d | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V096e | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V098 | convertible, no incluido (el conjunto ya cumple los mínimos) |
| V104a | convertible, no incluido (el conjunto ya cumple los mínimos) |
