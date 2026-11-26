# Casos de verificación v0.1 y v0.2 (desde cSlope)

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

Casos convertidos e incluidos: **61** (v0.1: **56**, v0.2 con sismo o cargas: **5**), con **120** checks. Es el lote 0: todo lo que se convierte hoy, sin tope ni selección. Casos no incluidos: **126** (motivo en cada fila). Los problemas de cSlope con sismo o cargas que no se pudieron convertir figuran en [`../pending/INDEX.md`](../pending/INDEX.md); los checks que el motor no reproduce, en [`../pending/lote0/INDEX.md`](../pending/lote0/INDEX.md); los lotes 1 y 2 (formato v0.3), en [`../pending/F3/INDEX.md`](../pending/F3/INDEX.md).

| id | título | referencia | unidades | sismo y cargas | checks (bishop/spencer) | tipo |
|---|---|---|---|---|---|---|
| V001 | Arai & Tagyo (1985) example 1 | Arai & Tagyo (1985), example 1. | SI | — | 2 / 0 | search |
| V002 | Arai & Tagyo (1985) example 2, three layers | Arai & Tagyo (1985), example 2. | SI | — | 1 / 0 | search |
| V003 | Arai & Tagyo (1985) example 3, water table | Arai & Tagyo (1985), Soils and Foundations 25(1). | SI | — | 2 / 1 | search |
| V004a | 4:1 slope, Mohr-Coulomb fit | Verification manual of a commercial slope stability program. | SI | — | 0 / 1 | search |
| V004b | Baker (2003) ex. 2 slope, Mohr-Coulomb iteration parameters | Verification manual of a commercial slope stability program. | SI | — | 0 / 1 | search |
| V005 | Baker (1993) dam, end of construction, infinite-slope face | Baker, R., Frydman, S. & Talesnick, M. (1993). Slope stability analysis for undrained loading conditions. Int. J. Numer. Anal. Meth. Geomech. 17, 15–43. | SI | — | 1 / 1 | search |
| V007b | Baker (2003) ex. 1 slope, Mohr-Coulomb iteration parameters | Verification manual of a commercial slope stability program. | SI | — | 0 / 1 | search |
| V008a | Baker (2003) example 1, Mohr-Coulomb fit | Baker (2003), example 1. | SI | — | 0 / 1 | search |
| V008b | Baker (2003) London clay slope, Mohr-Coulomb fit | Baker (2003) example 3. | SI | — | 0 / 1 | search |
| V013a | Cai & Ugai (2000) slope, no pile (see V013b, V013c, V013d and V013e for the pile rows) | Cai & Ugai (2000), Soils and Foundations 40(1). | SI | — | 2 / 0 | search |
| V016a | Stepped gabion wall, equivalent cohesion | Cao et al. (2016); Grodecki (2017). | SI | — | 2 / 1 | fixed |
| V016c | Gabion wall with weak joint layers | Cao et al. (2016); Grodecki (2017). | SI | — | 1 / 0 | fixed |
| V019 | Cheng et al. 11 m homogeneous slope | Cheng, Y.M., Lansivaara, T. & Wei, W.B. (2007). Two-dimensional slope stability analysis by limit equilibrium and strength reduction methods. Computers and Geotechnics 34(3), 137–150. | SI | — | 1 / 3 | search |
| V020 | Cheng et al. benched slope, global minimum | Cheng, Y.M., Lansivaara, T. & Wei, W.B. (2007). Two-dimensional slope stability analysis by limit equilibrium and strength reduction methods. Computers and Geotechnics 34(3), 137–150. | SI | — | 1 / 3 | search |
| V025 | Duncan & Wright fig. 6.38, piezometric line | Duncan & Wright, Soil Strength and Slope Stability, fig. 6.38. | SI | — | 1 / 1 | search |
| V027 | Duncan & Wright fig. 14.3, undrained clay | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.3. | imperial | — | 0 / 1 | search |
| V028 | Duncan & Wright fig. 14.3, undrained clay on a 46.5 ft foundation | Verification manual of a commercial slope stability program. | imperial | — | 0 / 1 | search |
| V029 | Duncan & Wright fig. 14.3, undrained clay on a 60 ft foundation | Verification manual of a commercial slope stability program. | imperial | — | 1 / 1 | search |
| V030 | Duncan & Wright fig. 14.4 | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.4. | imperial | — | 1 / 1 | search |
| V031a | Duncan & Wright fig. 14.5, R = 87 ft | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.5. | imperial | — | 1 / 2 | fixed |
| V031b | Duncan & Wright fig. 14.5, R = 102 ft | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.5. | imperial | — | 1 / 2 | fixed |
| V032b | Duncan & Wright fig. 14.7, infinite-slope mechanism | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.7. Verification manual of a commercial slope stability program. | imperial | — | 1 / 2 | search |
| V033 | Duncan & Wright fig. 14.20a, water table | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.20a. | SI | — | 1 / 1 | search |
| V044 | Fredlund & Krahn (1977), dry | Fredlund, D.G. & Krahn, J. (1977). Comparison of slope stability methods of analysis. Can. Geotech. J. 14(3). | imperial | — | 1 / 1 | fixed |
| V044b | Fredlund & Krahn (1977), rᵤ = 0.25 | Fredlund, D.G. & Krahn, J. (1977). Comparison of slope stability methods of analysis. Can. Geotech. J. 14(3), 429–439. | imperial | — | 1 / 1 | fixed |
| V045 | Fredlund & Krahn (1977), with water table | Fredlund, D.G. & Krahn, J. (1977). Can. Geotech. J. 14(3). | SI | — | 1 / 1 | fixed |
| V047a | ACADS 1(a), homogeneous slope, dry | Giam & Donald (1989). | SI | — | 2 / 2 | search |
| V049 | ACADS 1(c), three-layer slope | Giam & Donald (1989), ACADS slope stability programs review. | SI | — | 2 / 1 | search |
| V052a | Talbingo Dam, end of construction | Giam & Donald (1989), ACADS slope stability programs review. | SI | — | 2 / 1 | search |
| V052b | Talbingo Dam, specified circle | Giam & Donald (1989), ACADS slope stability programs review. | SI | — | 1 / 1 | fixed |
| V054 | Greco (1996) example 5 / Chen & Shao (1988) | Greco (1996), example 5; Chen & Shao (1988). | SI | — | 1 / 1 | search |
| V055 | Griffiths & Lane example 2, slope with a foundation layer | Griffiths & Lane (1999), Géotechnique 49(3). | SI | — | 0 / 2 | search |
| V060a | Cannon Dam end of construction (Hassan & Wolff), critical circle | Hassan & Wolff (1999), J. Geotech. Geoenviron. Eng. 125(4). | SI | — | 1 / 0 | search |
| V060b | Cannon Dam end of construction (Hassan & Wolff), reliability on the minimum-β circle | Hassan & Wolff (1999), J. Geotech. Geoenviron. Eng. 125(4). | SI | — | 1 / 0 | fixed |
| V062a | Clarence Cannon Dam, surface 7A | Hassan & Wolff (1999). | SI | — | 2 / 0 | fixed |
| V062b | Clarence Cannon Dam, surface 7B | Hassan & Wolff (1999). | SI | — | 2 / 0 | fixed |
| V062c | Clarence Cannon Dam, surface 7C | Hassan & Wolff (1999). | SI | — | 2 / 0 | fixed |
| V062d | Clarence Cannon Dam, surface 7D | Hassan & Wolff (1999). | SI | — | 2 / 0 | fixed |
| V062e | Clarence Cannon Dam, surface 7E | Hassan & Wolff (1999). | SI | — | 2 / 0 | fixed |
| V062f | Clarence Cannon Dam, surface 8B | Hassan & Wolff (1999). | SI | — | 2 / 0 | fixed |
| V062g | Clarence Cannon Dam, surface 8F | Hassan & Wolff (1999). | SI | — | 2 / 0 | fixed |
| V062h | Clarence Cannon Dam, surface 8G | Hassan & Wolff (1999). | SI | — | 2 / 0 | fixed |
| V062i | Clarence Cannon Dam, surface 8H | Hassan & Wolff (1999). | SI | — | 1 / 0 | fixed |
| V063 | Huang & Jia earth dam, dry | Huang, M. & Jia, C.-Q. (2009). Strength reduction FEM in stability analysis of soil slopes subjected to transient unsaturated seepage. Computers and Geotechnics 36(1–2), 93–101. | SI | — | 1 / 1 | search |
| V101 | Li & Lumb (1987) homogeneous slope, rᵤ = 0.2 | Li, K.S. & Lumb, P. (1987). Probabilistic design of slopes. Can. Geotech. J. 24(4), 520–535; Hassan, A.M. & Wolff, T.F. (1999). J. Geotech. Geoenviron. Eng. 125(4), 301–308. | SI | — | 3 / 0 | search |
| V102a | Loukidis et al. (2003) slope at its critical seismic coefficient, dry | Loukidis, D., Bandini, P. & Salgado, R. (2003). Stability of seismically loaded slopes using limit analysis. Géotechnique 53(5), 463–479. | SI | kh = 0.432, kv = 0 | 2 / 3 | search |
| V102b | Loukidis et al. (2003) slope at its critical seismic coefficient, rᵤ = 0.5 | Loukidis, D., Bandini, P. & Salgado, R. (2003). Stability of seismically loaded slopes using limit analysis. Géotechnique 53(5), 463–479. | SI | kh = 0.132, kv = 0 | 2 / 3 | search |
| V069a | Morgenstern (1963) complete drawdown, 3:1 | Morgenstern, N. (1963). Stability charts for earth slopes during rapid drawdown. Géotechnique 13(2). | SI | — | 1 / 1 | search |
| V069b | Morgenstern complete drawdown, the reference circle | Morgenstern, N. (1963). Stability charts for earth slopes during rapid drawdown. Géotechnique 13(2). Verification manual of a commercial slope stability program. | SI | — | 1 / 0 | fixed |
| V071a | Pockoski & Duncan (2000) slope 1 | Pockoski & Duncan (2000), slope 1. | SI | — | 1 / 1 | fixed |
| V071b | Pockoski & Duncan slope 1, circular search | Pockoski & Duncan (2000), slope 1. Verification manual of a commercial slope stability program. | SI | — | 1 / 1 | search |
| V081a | Sharma (1996) reinforcement example, unreinforced | Sharma (1996). | SI | udl q = 40 en [17, 30] | 1 / 0 | fixed |
| V081b | Sharma (1996) slope with a reinforced zone (φ = 54.93°) | Sharma (1996). Verification manual of a commercial slope stability program. | SI | udl q = 40 en [17, 30] | 1 / 0 | fixed |
| V090 | USACE EM 1110-2-1902, example F-5 | US Army Corps of Engineers (2003). Slope Stability, EM 1110-2-1902, Appendix F. | imperial | — | 1 / 1 | fixed |
| V093 | Yamagami & Ueta (1988) | Yamagami & Ueta (1988). | SI | — | 1 / 0 | search |
| V095a | Yamagami micro-pile slope, no pile | Yamagami et al. (2000). | SI | — | 1 / 0 | fixed |
| V096d | Zhu & Lee slope, the paper's surface 3, dry | Zhu, D.Y. & Lee, C.F. (2002). Explicit limit equilibrium solution for slope stability. Int. J. Numer. Anal. Meth. Geomech. 26(15), 1573–1590. | SI | — | 0 / 1 | fixed |
| V096e | Zhu & Lee slope, the paper's surface 3, with the water table | Zhu, D.Y. & Lee, C.F. (2002). Explicit limit equilibrium solution for slope stability. Int. J. Numer. Anal. Meth. Geomech. 26(15), 1573–1590. | SI | — | 0 / 1 | fixed |
| V097a | Eurocode 7 cutting with surcharge | Verification manual of a commercial slope stability program. | SI | udl q = 35 en [52, 62] | 1 / 0 | fixed |
| V098 | Example slope without seismic load | Verification manual of a commercial slope stability program. | SI | — | 0 / 1 | search |
| V104a | Embankment on clay, no excess pore pressure (B-bar tutorial, step 1) | Tutorial of a commercial slope stability program: undrained loading by the B-bar method (its tutorial pages and the tutorial's project file). | SI | — | 1 / 0 | search |

## Checks descartados en casos convertidos

- V001: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program A (GLE), 1.414): método no soportado
- V001: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program B, 1.414): método no soportado
- V001: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.386): superficie no circular (nonCircularOptimization)
- V002: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 0.414): superficie no circular (nonCircularOptimization)
- V003: Janbu (Janbu corrected (f0), Commercial program A, 1.131): método no soportado
- V004a: Janbu (Janbu simplified (uncorrected), Commercial program A, 2.662): método no soportado
- V004b: Janbu (Janbu simplified (uncorrected), Commercial program A, 2.61): método no soportado
- V007b: Janbu (Janbu simplified (uncorrected), Commercial program A, 0.957): método no soportado
- V033: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.534): superficie no circular (nonCircularOptimization)
- V044: Morgenstern-Price (Morgenstern-Price (half-sine), Fredlund & Krahn, 2.076): método no soportado
- V044b: Morgenstern-Price (Morgenstern-Price (half-sine), Fredlund & Krahn, 1.764): método no soportado
- V045: Morgenstern-Price (Morgenstern-Price (half-sine), Fredlund & Krahn, 1.832): método no soportado
- V047a: Janbu (Janbu corrected (f0), Commercial program A, 0.99): método no soportado
- V047a: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program B, 0.991): método no soportado
- V049: Janbu (Janbu corrected (f0), Commercial program A, 1.357): método no soportado
- V049: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program B, 1.382): método no soportado
- V052a: Janbu (Janbu corrected (f0), Commercial program A, 1.949): método no soportado
- V052b: Janbu (Janbu corrected (f0), Commercial program A, 2.073): método no soportado
- V052b: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program B, 2.299): método no soportado
- V102a: Morgenstern-Price (Spencer (M-P, constant f(x)), non-circular, Commercial program A (non-circular), 0.999): superficie no circular (nonCircularOptimization)
- V102b: Morgenstern-Price (Spencer (M-P, constant f(x)), non-circular, Commercial program A (non-circular), 0.997): superficie no circular (nonCircularOptimization)
- V071b: Janbu (Janbu simplified (uncorrected), Commercial program A, 1.151): método no soportado
- V090: Janbu (Janbu corrected (f0), Commercial program A, 1.345): método no soportado
- V090: Morgenstern-Price (Morgenstern-Price (half-sine), Commercial program A, 1.327): método no soportado
- V093: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.325): superficie no circular (nonCircularOptimization)
- V093: Janbu (Janbu simplified (uncorrected), Commercial program A (non-circular), 1.178): método no soportado
- V096d: Morgenstern-Price (Morgenstern-Price (half-sine), Zhu & Lee (2002), 1.823): método no soportado
- V096e: Morgenstern-Price (Morgenstern-Price (half-sine), Zhu & Lee (2002), 1.197): método no soportado
- V098: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.36): superficie no circular (nonCircularOptimization)

## Sentidos de deslizamiento fijados por el importador

- V063: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): auto no puede resolver el sentido en esta presa simétrica con entry == exit; la orientación ltr reproduce el círculo crítico de cSlope (centro ≈ (154.2, 76.6), r ≈ 69.4).

## Problemas con peso saturado (`unitWeightSat`) no incluidos

En la fuente hay **10** problemas con `unitWeightSat` no nulo; **0** se incluyen. Casos incluidos con `unit_weight_sat` en el modelo: **0**. Ninguno de los no incluidos es convertible con las reglas actuales (contrato §1, §2). Motivo de cada uno (el primero que lo impide):

| id | motivo |
|---|---|
| V082a | opción de check que cambia el problema: tensionCrackDepth |
| V082b | opción de check que cambia el problema: tensionCrackDepth |
| V082c | material 'Soil 2 (zero strength)' con modelo 'undrained' |
| V082d | material 'Soil 2 (zero strength)' con modelo 'undrained' |
| V088 | opción de check que cambia el problema: tensionCrackDepth |
| V089 | piezométrica sobre el terreno (agua embalsada) |
| V105a | material 'Peat, deep' con modelo 'shansep' |
| V105b | definition con clave que cambia el problema: earlierStage, waternet |
| V105c | definition con clave que cambia el problema: customSurfaces, earlierStage, waternet |
| V105d | definition con clave que cambia el problema: customSurfaces, earlierStage, waternet |

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
| V017a | contorno no válido (Self-intersection[13.8160684182133 100.095038741757]) |
| V017b | definition con clave que cambia el problema: reinforcements |
| V018 | definition con clave que cambia el problema: customSurfaces |
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
| V051 | sin checks válidos |
| V099 | piezométrica sobre el terreno (agua embalsada) |
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
| V066e | definition con clave que cambia el problema: reinforcements |
| V067 | material 'A' con modelo 'undrained' |
| V068 | material 'Lower' con modelo 's-f-datum' |
| V070 | piezométrica sobre el terreno (agua embalsada) |
| V072a | opción de check que cambia el problema: tensionCrackDepth |
| V072b | opción de check que cambia el problema: tensionCrackDepth |
| V073 | opción de check que cambia el problema: tensionCrackDepth |
| V074 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V075 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V076 | definition con clave que cambia el problema: reinforcements |
| V077 | definition con clave que cambia el problema: customSurfaces |
| V078 | definition con clave que cambia el problema: customSurfaces |
| V079 | definition con clave que cambia el problema: customSurfaces |
| V080 | definition con clave que cambia el problema: customSurfaces |
| V082a | opción de check que cambia el problema: tensionCrackDepth |
| V082b | opción de check que cambia el problema: tensionCrackDepth |
| V082c | material 'Soil 2 (zero strength)' con modelo 'undrained' |
| V082d | material 'Soil 2 (zero strength)' con modelo 'undrained' |
| V083 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084a | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084b | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084c | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084d | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084e | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084f | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V085 | opción de check que cambia el problema: tensionCrackDepth |
| V103 | sin checks válidos |
| V086a | definition con clave que cambia el problema: reinforcements |
| V086b | opción de check que cambia el problema: tensionCrackDepth |
| V086c | opción de check que cambia el problema: tensionCrackDepth |
| V086d | opción de check que cambia el problema: tensionCrackAuto |
| V086e | material 'Soft clay' con modelo 'undrained' |
| V087 | piezométrica sobre el terreno (agua embalsada) |
| V088 | opción de check que cambia el problema: tensionCrackDepth |
| V089 | piezométrica sobre el terreno (agua embalsada) |
| V091 | material 'Soil 1' con modelo 'undrained' |
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
| V105c | definition con clave que cambia el problema: customSurfaces, earlierStage, waternet |
| V105d | definition con clave que cambia el problema: customSurfaces, earlierStage, waternet |
| V026 | todos sus checks están retenidos en verification/pending/lote0 (el motor no los reproduce) |
| V032a | todos sus checks están retenidos en verification/pending/lote0 (el motor no los reproduce) |
