# Casos de verificación v0.1 a v0.4 (desde cSlope)

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

Casos convertidos e incluidos: **116** (v0.1: **41**, v0.2 con sismo o cargas: **5**, v0.3: **47**, v0.4 con refuerzos: **23**), con **241** checks. Lote 0: todo lo que se convierte con la versión 0.1 o 0.2, sin tope ni selección. Lotes 1 y 2 (`undrained`, polilíneas fijas, Morgenstern-Price y Janbu): los casos v0.3, promovidos desde `verification/pending/F3` cuando el motor reproduce sus checks. Lotes R1 a R4: los casos v0.4 con refuerzos, promovidos desde `verification/pending/F3R` (sección «Casos con refuerzos»). Casos no incluidos: **94** (motivo en cada fila). Los problemas de cSlope con sismo o cargas que no se pudieron convertir figuran en [`../pending/INDEX.md`](../pending/INDEX.md); los checks que el motor no reproduce, en [`../pending/lote0/INDEX.md`](../pending/lote0/INDEX.md); los lotes 1 y 2 (formato v0.3), en [`../pending/F3/INDEX.md`](../pending/F3/INDEX.md).

Checks por método: Bishop / Spencer / Morgenstern-Price / Janbu simplificado / Janbu corregido.

| id | título | referencia | unidades | sismo y cargas | checks (B/S/MP/JS/JC) | tipo | versión |
|---|---|---|---|---|---|---|---|
| V001 | Arai & Tagyo (1985) example 1 | Arai & Tagyo (1985), example 1. | SI | — | 2 / 0 / 2 / 0 / 0 | search | 0.3 |
| V002 | Arai & Tagyo (1985) example 2, three layers | Arai & Tagyo (1985), example 2. | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.1 |
| V003 | Arai & Tagyo (1985) example 3, water table | Arai & Tagyo (1985), Soils and Foundations 25(1). | SI | — | 2 / 1 / 0 / 0 / 1 | search | 0.3 |
| V004a | 4:1 slope, Mohr-Coulomb fit | Verification manual of a commercial slope stability program. | SI | — | 0 / 1 / 0 / 1 / 0 | search | 0.3 |
| V004b | Baker (2003) ex. 2 slope, Mohr-Coulomb iteration parameters | Verification manual of a commercial slope stability program. | SI | — | 0 / 1 / 0 / 1 / 0 | search | 0.3 |
| V005 | Baker (1993) dam, end of construction, infinite-slope face | Baker, R., Frydman, S. & Talesnick, M. (1993). Slope stability analysis for undrained loading conditions. Int. J. Numer. Anal. Meth. Geomech. 17, 15–43. | SI | — | 1 / 1 / 0 / 0 / 0 | search | 0.1 |
| V006 | Baker & Leshchinsky (2001) planar surface | Baker, R. & Leshchinsky, D. (2001). Spatial distribution of safety factors. J. Geotech. Geoenviron. Eng. 127(2), 135–145. | SI | — | 0 / 1 / 0 / 1 / 0 | fixed | 0.3 |
| V007a | Baker (2003) ex. 1, Mohr-Coulomb, Janbu simplified on the reference circle | Verification manual of a commercial slope stability program. | SI | — | 0 / 0 / 0 / 1 / 0 | fixed | 0.3 |
| V007b | Baker (2003) ex. 1 slope, Mohr-Coulomb iteration parameters | Verification manual of a commercial slope stability program. | SI | — | 0 / 1 / 0 / 1 / 0 | search | 0.3 |
| V007c | Baker (2003) ex. 3, Janbu simplified | Verification manual of a commercial slope stability program. | SI | — | 0 / 0 / 0 / 1 / 0 | search | 0.3 |
| V008a | Baker (2003) example 1, Mohr-Coulomb fit | Baker (2003), example 1. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.1 |
| V008b | Baker (2003) London clay slope, Mohr-Coulomb fit | Baker (2003) example 3. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.1 |
| V013a | Cai & Ugai (2000) slope, no pile (see V013b, V013c, V013d and V013e for the pile rows) | Cai & Ugai (2000), Soils and Foundations 40(1). | SI | — | 2 / 0 / 0 / 0 / 0 | search | 0.1 |
| V016a | Stepped gabion wall, equivalent cohesion | Cao et al. (2016); Grodecki (2017). | SI | — | 2 / 1 / 0 / 0 / 0 | fixed | 0.1 |
| V016c | Gabion wall with weak joint layers | Cao et al. (2016); Grodecki (2017). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V018 | Chen & Shao (1988) frictionless 60° slope, Prandtl mechanism | Chen, Z. & Shao, C. (1988). Evaluation of minimum factor of safety in slope stability analysis. Can. Geotech. J. 25(4), 735–748. | SI | udl q = 149.31 en [5.7735, 15.7735] | 0 / 1 / 2 / 0 / 0 | fixed | 0.3 |
| V019 | Cheng et al. 11 m homogeneous slope | Cheng, Y.M., Lansivaara, T. & Wei, W.B. (2007). Two-dimensional slope stability analysis by limit equilibrium and strength reduction methods. Computers and Geotechnics 34(3), 137–150. | SI | — | 1 / 3 / 0 / 0 / 0 | search | 0.1 |
| V020 | Cheng et al. benched slope, global minimum | Cheng, Y.M., Lansivaara, T. & Wei, W.B. (2007). Two-dimensional slope stability analysis by limit equilibrium and strength reduction methods. Computers and Geotechnics 34(3), 137–150. | SI | — | 1 / 3 / 0 / 0 / 0 | search | 0.1 |
| V021a | Chowdhury & Xu (1995) example 1, Congress Street cut, circle tangent to the base of clay 2 | Chowdhury & Xu (1995); Ireland (1954). | SI | — | 2 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V021b | Chowdhury & Xu (1995) example 1, Congress Street cut, circle tangent to the base of clay 3 | Chowdhury & Xu (1995); Ireland (1954). | SI | — | 2 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V021c | Chowdhury & Xu (1995) example 2, Congress Street cut, circle tangent to the base of clay 2 | Chowdhury & Xu (1995); Ireland (1954). | SI | — | 2 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V021d | Chowdhury & Xu (1995) example 2, Congress Street cut, circle tangent to the base of clay 3 | Chowdhury & Xu (1995); Ireland (1954). | SI | — | 2 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V021e | Chowdhury & Xu (1995) example 3, Congress Street cut, circle tangent to the base of clay 2 | Chowdhury & Xu (1995); Ireland (1954). | SI | — | 2 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V021f | Chowdhury & Xu (1995) example 3, Congress Street cut, circle tangent to the base of clay 3 | Chowdhury & Xu (1995); Ireland (1954). | SI | — | 2 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V021g | Chowdhury & Xu (1995) example 4, Congress Street cut, circle tangent to the base of clay 2 | Chowdhury & Xu (1995); Ireland (1954). | SI | — | 1 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V022a | Chowdhury & Xu (1995) example 5, embankment on soft clay, circle tangent to y = 15 | Chowdhury & Xu (1995). | SI | — | 2 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V022b | Chowdhury & Xu (1995) example 5, embankment on soft clay, circle tangent to y = 5 | Chowdhury & Xu (1995). | SI | — | 1 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V025 | Duncan & Wright fig. 6.38, piezometric line | Duncan & Wright, Soil Strength and Slope Stability, fig. 6.38. | SI | — | 1 / 1 / 0 / 0 / 0 | search | 0.1 |
| V026 | Duncan & Wright fig. 7.12, embankment on clay | Duncan & Wright, Soil Strength and Slope Stability, fig. 7.12. | imperial | — | 2 / 1 / 0 / 0 / 0 | search | 0.1 |
| V027 | Duncan & Wright fig. 14.3, undrained clay | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.3. | imperial | — | 0 / 1 / 0 / 0 / 0 | search | 0.1 |
| V028 | Duncan & Wright fig. 14.3, undrained clay on a 46.5 ft foundation | Verification manual of a commercial slope stability program. | imperial | — | 0 / 1 / 0 / 0 / 0 | search | 0.1 |
| V029 | Duncan & Wright fig. 14.3, undrained clay on a 60 ft foundation | Verification manual of a commercial slope stability program. | imperial | — | 1 / 1 / 0 / 0 / 0 | search | 0.1 |
| V030 | Duncan & Wright fig. 14.4 | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.4. | imperial | — | 1 / 1 / 0 / 0 / 0 | search | 0.1 |
| V031a | Duncan & Wright fig. 14.5, R = 87 ft | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.5. | imperial | — | 1 / 2 / 0 / 0 / 0 | fixed | 0.1 |
| V031b | Duncan & Wright fig. 14.5, R = 102 ft | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.5. | imperial | — | 1 / 2 / 0 / 0 / 0 | fixed | 0.1 |
| V032b | Duncan & Wright fig. 14.7, infinite-slope mechanism | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.7. Verification manual of a commercial slope stability program. | imperial | — | 1 / 2 / 0 / 0 / 0 | search | 0.1 |
| V033 | Duncan & Wright fig. 14.20a, water table | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.20a. | SI | — | 1 / 1 / 0 / 0 / 0 | search | 0.1 |
| V034a | Duncan & Wright fig. 14.20b, Su = 200 + 15·depth | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.20b. | imperial | — | 1 / 1 / 0 / 0 / 0 | search | 0.3 |
| V034b | Duncan & Wright fig. 14.20b, Su = 300 psf | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.20b. | imperial | — | 1 / 1 / 0 / 0 / 0 | search | 0.3 |
| V036a | Embankment on an undrained foundation, cz = 0 (D&W fig. 15.9) | Duncan & Wright, Soil Strength and Slope Stability, fig. 15.9. | SI | — | 1 / 2 / 0 / 0 / 0 | search | 0.3 |
| V036b | Embankment on an undrained foundation, cz = 5 psf/ft | Duncan & Wright, Soil Strength and Slope Stability, fig. 15.9. | SI | — | 1 / 2 / 0 / 0 / 0 | search | 0.3 |
| V036c | Embankment on an undrained foundation, cz = 10 psf/ft | Duncan & Wright, Soil Strength and Slope Stability, fig. 15.9. | SI | — | 1 / 2 / 0 / 0 / 0 | search | 0.3 |
| V036d | Embankment on an undrained foundation, cz = 15 psf/ft | Duncan & Wright, Soil Strength and Slope Stability, fig. 15.9. | SI | — | 1 / 2 / 0 / 0 / 0 | search | 0.3 |
| V040 | James Bay dyke, reference model (deterministic) | El-Ramly et al. (2002); Duncan & Wright fig. 7.16. | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.3 |
| V044 | Fredlund & Krahn (1977), dry | Fredlund, D.G. & Krahn, J. (1977). Comparison of slope stability methods of analysis. Can. Geotech. J. 14(3). | imperial | — | 1 / 1 / 1 / 0 / 0 | fixed | 0.3 |
| V044b | Fredlund & Krahn (1977), rᵤ = 0.25 | Fredlund, D.G. & Krahn, J. (1977). Comparison of slope stability methods of analysis. Can. Geotech. J. 14(3), 429–439. | imperial | — | 1 / 1 / 1 / 0 / 0 | fixed | 0.3 |
| V045 | Fredlund & Krahn (1977), with water table | Fredlund, D.G. & Krahn, J. (1977). Can. Geotech. J. 14(3). | SI | — | 1 / 1 / 1 / 0 / 0 | fixed | 0.3 |
| V046a | Fredlund & Krahn slope on a weak seam, composite surface | Fredlund, D.G. & Krahn, J. (1977). Can. Geotech. J. 14(3). | imperial | — | 0 / 2 / 1 / 0 / 0 | fixed | 0.3 |
| V046b | Fredlund & Krahn slope on a weak seam, with a piezometric line | Fredlund, D.G. & Krahn, J. (1977). Can. Geotech. J. 14(3). | SI | — | 0 / 1 / 1 / 0 / 0 | fixed | 0.3 |
| V046c | Fredlund & Krahn slope on a weak seam, rᵤ = 0.25 | Fredlund, D.G. & Krahn, J. (1977). Can. Geotech. J. 14(3), 429–439. | imperial | — | 0 / 2 / 1 / 0 / 0 | fixed | 0.3 |
| V047a | ACADS 1(a), homogeneous slope, dry | Giam & Donald (1989). | SI | — | 2 / 2 / 1 / 0 / 1 | search | 0.3 |
| V049 | ACADS 1(c), three-layer slope | Giam & Donald (1989), ACADS slope stability programs review. | SI | — | 2 / 1 / 1 / 0 / 1 | search | 0.3 |
| V050a | ACADS 3(b), weak layer, specified non-circular surface | Giam & Donald (1989), ACADS problem 3(b). | SI | — | 0 / 1 / 1 / 0 / 1 | fixed | 0.3 |
| V052a | Talbingo Dam, end of construction | Giam & Donald (1989), ACADS slope stability programs review. | SI | — | 2 / 1 / 0 / 0 / 1 | search | 0.3 |
| V052b | Talbingo Dam, specified circle | Giam & Donald (1989), ACADS slope stability programs review. | SI | — | 1 / 1 / 1 / 0 / 1 | fixed | 0.3 |
| V054 | Greco (1996) example 5 / Chen & Shao (1988) | Greco (1996), example 5; Chen & Shao (1988). | SI | — | 1 / 1 / 0 / 0 / 0 | search | 0.1 |
| V055 | Griffiths & Lane example 2, slope with a foundation layer | Griffiths & Lane (1999), Géotechnique 49(3). | SI | — | 0 / 2 / 0 / 0 / 0 | search | 0.1 |
| V056 | Griffiths & Lane example 3, thin weak layer, cu2/cu1 = 0.2 | Griffiths & Lane (1999), Géotechnique 49(3). | SI | — | 0 / 0 / 0 / 0 / 1 | fixed | 0.3 |
| V057a | Griffiths & Lane example 4, cu2/cu1 = 1 (deep base circle) | Griffiths & Lane (1999), Géotechnique 49(3). | SI | — | 0 / 2 / 0 / 0 / 0 | search | 0.3 |
| V057b | Griffiths & Lane example 4, cu2/cu1 = 2 (toe circle) | Griffiths & Lane (1999), Géotechnique 49(3). | SI | — | 0 / 2 / 0 / 0 / 0 | search | 0.3 |
| V060a | Cannon Dam end of construction (Hassan & Wolff), critical circle | Hassan & Wolff (1999), J. Geotech. Geoenviron. Eng. 125(4). | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.1 |
| V060b | Cannon Dam end of construction (Hassan & Wolff), reliability on the minimum-β circle | Hassan & Wolff (1999), J. Geotech. Geoenviron. Eng. 125(4). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062a | Clarence Cannon Dam, surface 7A | Hassan & Wolff (1999). | SI | — | 2 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062b | Clarence Cannon Dam, surface 7B | Hassan & Wolff (1999). | SI | — | 2 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062c | Clarence Cannon Dam, surface 7C | Hassan & Wolff (1999). | SI | — | 2 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062d | Clarence Cannon Dam, surface 7D | Hassan & Wolff (1999). | SI | — | 2 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062e | Clarence Cannon Dam, surface 7E | Hassan & Wolff (1999). | SI | — | 2 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062f | Clarence Cannon Dam, surface 8B | Hassan & Wolff (1999). | SI | — | 2 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062g | Clarence Cannon Dam, surface 8F | Hassan & Wolff (1999). | SI | — | 2 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062h | Clarence Cannon Dam, surface 8G | Hassan & Wolff (1999). | SI | — | 2 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V062i | Clarence Cannon Dam, surface 8H | Hassan & Wolff (1999). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V063 | Huang & Jia earth dam, dry | Huang, M. & Jia, C.-Q. (2009). Strength reduction FEM in stability analysis of soil slopes subjected to transient unsaturated seepage. Computers and Geotechnics 36(1–2), 93–101. | SI | — | 1 / 1 / 0 / 0 / 0 | search | 0.1 |
| V101 | Li & Lumb (1987) homogeneous slope, rᵤ = 0.2 | Li, K.S. & Lumb, P. (1987). Probabilistic design of slopes. Can. Geotech. J. 24(4), 520–535; Hassan, A.M. & Wolff, T.F. (1999). J. Geotech. Geoenviron. Eng. 125(4), 301–308. | SI | — | 3 / 0 / 0 / 0 / 0 | search | 0.1 |
| V102a | Loukidis et al. (2003) slope at its critical seismic coefficient, dry | Loukidis, D., Bandini, P. & Salgado, R. (2003). Stability of seismically loaded slopes using limit analysis. Géotechnique 53(5), 463–479. | SI | kh = 0.432, kv = 0 | 2 / 3 / 0 / 0 / 0 | search | 0.2 |
| V102b | Loukidis et al. (2003) slope at its critical seismic coefficient, rᵤ = 0.5 | Loukidis, D., Bandini, P. & Salgado, R. (2003). Stability of seismically loaded slopes using limit analysis. Géotechnique 53(5), 463–479. | SI | kh = 0.132, kv = 0 | 2 / 3 / 0 / 0 / 0 | search | 0.2 |
| V067 | Low (1989), layered undrained clay | Low (1989). | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.3 |
| V069a | Morgenstern (1963) complete drawdown, 3:1 | Morgenstern, N. (1963). Stability charts for earth slopes during rapid drawdown. Géotechnique 13(2). | SI | — | 1 / 1 / 0 / 0 / 0 | search | 0.1 |
| V069b | Morgenstern complete drawdown, the reference circle | Morgenstern, N. (1963). Stability charts for earth slopes during rapid drawdown. Géotechnique 13(2). Verification manual of a commercial slope stability program. | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V071a | Pockoski & Duncan (2000) slope 1 | Pockoski & Duncan (2000), slope 1. | SI | — | 1 / 1 / 0 / 0 / 0 | fixed | 0.1 |
| V071b | Pockoski & Duncan slope 1, circular search | Pockoski & Duncan (2000), slope 1. Verification manual of a commercial slope stability program. | SI | — | 1 / 1 / 0 / 1 / 0 | search | 0.3 |
| V077 | Prandtl bearing capacity on level ground | Prandtl (1920). Über die Härte plastischer Körper. Nachr. Ges. Wiss. Göttingen, Math.-phys. Kl., 74–85. | SI | udl q = 102.83 en [-5, 5] | 0 / 1 / 0 / 0 / 0 | fixed | 0.3 |
| V078 | Prandtl bearing capacity, fully specified Prandtl surface (reference values) | Prandtl (1920). Über die Härte plastischer Körper. Nachr. Ges. Wiss. Göttingen, Math.-phys. Kl., 74–85. | SI | udl q = 102.83 en [0, 10] | 0 / 0 / 1 / 0 / 0 | fixed | 0.3 |
| V081a | Sharma (1996) reinforcement example, unreinforced | Sharma (1996). | SI | udl q = 40 en [17, 30] | 1 / 0 / 0 / 0 / 0 | fixed | 0.2 |
| V081b | Sharma (1996) slope with a reinforced zone (φ = 54.93°) | Sharma (1996). Verification manual of a commercial slope stability program. | SI | udl q = 40 en [17, 30] | 1 / 0 / 0 / 0 / 0 | fixed | 0.2 |
| V086e | Tandjiria embankment, sand fill, the paper's geometry | Tandjiria, V., Low, B.K. & Teh, C.I. (2002). Effect of reinforcement force distribution on stability of embankments. Geotextiles and Geomembranes 20, 423–443; problem 2. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.3 |
| V090 | USACE EM 1110-2-1902, example F-5 | US Army Corps of Engineers (2003). Slope Stability, EM 1110-2-1902, Appendix F. | imperial | — | 1 / 1 / 1 / 0 / 1 | fixed | 0.3 |
| V093 | Yamagami & Ueta (1988) | Yamagami & Ueta (1988). | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.1 |
| V095a | Yamagami micro-pile slope, no pile | Yamagami et al. (2000). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.1 |
| V096d | Zhu & Lee slope, the paper's surface 3, dry | Zhu, D.Y. & Lee, C.F. (2002). Explicit limit equilibrium solution for slope stability. Int. J. Numer. Anal. Meth. Geomech. 26(15), 1573–1590. | SI | — | 0 / 1 / 1 / 0 / 0 | fixed | 0.3 |
| V096e | Zhu & Lee slope, the paper's surface 3, with the water table | Zhu, D.Y. & Lee, C.F. (2002). Explicit limit equilibrium solution for slope stability. Int. J. Numer. Anal. Meth. Geomech. 26(15), 1573–1590. | SI | — | 0 / 1 / 1 / 0 / 0 | fixed | 0.3 |
| V097a | Eurocode 7 cutting with surcharge | Verification manual of a commercial slope stability program. | SI | udl q = 35 en [52, 62] | 1 / 0 / 0 / 0 / 0 | fixed | 0.2 |
| V098 | Example slope without seismic load | Verification manual of a commercial slope stability program. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.1 |
| V104a | Embankment on clay, no excess pore pressure (B-bar tutorial, step 1) | Tutorial of a commercial slope stability program: undrained loading by the B-bar method (its tutorial pages and the tutorial's project file). | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.1 |
| V016b | Stepped gabion wall, mesh as geosynthetic supports | Cao et al. (2016); Grodecki (2017). | SI | — | 2 / 1 / 0 / 0 / 0 | fixed | 0.4 |
| V035a | Duncan & Wright tieback, active | Duncan & Wright, Soil Strength and Slope Stability, fig. 6.34. | SI | — | 0 / 0 / 1 / 0 / 0 | fixed | 0.4 |
| V037 | Geogrid-reinforced fill on rock (D&W fig. 7.28) | Duncan & Wright, Soil Strength and Slope Stability, fig. 7.28. | SI | — | 1 / 1 / 0 / 0 / 0 | search | 0.4 |
| V011a | Borges & Cardoso embankment 3, H = 7 m, circle A | Borges, J.L. & Cardoso, A.S. (2002). Overall stability of geosynthetic-reinforced embankments on soft soils. Geotextiles and Geomembranes 20, 395–421. | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V011b | Borges & Cardoso embankment 3, H = 7 m, circle B | Borges, J.L. & Cardoso, A.S. (2002). Overall stability of geosynthetic-reinforced embankments on soft soils. Geotextiles and Geomembranes 20, 395–421. | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V012 | Borges & Cardoso embankment 3, H = 8.75 m, circle C | Borges, J.L. & Cardoso, A.S. (2002). Overall stability of geosynthetic-reinforced embankments on soft soils. Geotextiles and Geomembranes 20, 395–421. | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V064 | Leshchinsky & Han MSE wall, five tiers | Leshchinsky & Han (2004), J. Geotech. Geoenviron. Eng. 130(12). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V065 | Leshchinsky & Han MSE wall, weak foundation | Leshchinsky & Han (2004), J. Geotech. Geoenviron. Eng. 130(12). | SI | — | 0 / 1 / 0 / 0 / 0 | fixed | 0.4 |
| V066a | Leshchinsky & Han three-tier MSE wall, baseline | Leshchinsky & Han (2004), J. Geotech. Geoenviron. Eng. 130(12). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V066b | Leshchinsky & Han MSE wall, L = 4.2 m | Leshchinsky & Han (2004), J. Geotech. Geoenviron. Eng. 130(12). | SI | — | 0 / 1 / 0 / 0 / 0 | fixed | 0.4 |
| V066c | Leshchinsky & Han MSE wall, two reinforcement types | Leshchinsky & Han (2004), J. Geotech. Geoenviron. Eng. 130(12). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V066e | Leshchinsky & Han MSE wall, surcharge | Leshchinsky & Han (2004), J. Geotech. Geoenviron. Eng. 130(12). | SI | udl q = 20 en [8.7, 24] | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V010 | Borges & Cardoso embankment 2 (geosynthetic) | Borges, J.L. & Cardoso, A.S. (2002). Overall stability of geosynthetic-reinforced embankments on soft soils. Geotextiles and Geomembranes 20, 395–421. | SI | — | 1 / 0 / 1 / 0 / 0 | fixed | 0.4 |
| V010b | Borges & Cardoso embankment 2 (geosynthetic), the paper's circle B | Borges, J.L. & Cardoso, A.S. (2002). Overall stability of geosynthetic-reinforced embankments on soft soils. Geotextiles and Geomembranes 20, 395–421; case 2, Table 11, Fig. 14. | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V014 | Nailed wall, 14 rows, deep wedge | Caltrans soil nail reference manual. | SI | — | 0 / 1 / 0 / 0 / 0 | fixed | 0.4 |
| V084a | Soil-nailed wall in sand (Clouterre test wall) | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084b | Soil-nailed wall in sand (Clouterre test wall), 45° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084c | Soil-nailed wall in sand (Clouterre test wall), 50° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084d | Soil-nailed wall in sand (Clouterre test wall), 60° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084e | Soil-nailed wall in sand (Clouterre test wall), 65° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084f | Soil-nailed wall in sand (Clouterre test wall), 70° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V015 | Soldier-pile tieback wall | Caltrans soil nail reference manual. | SI | — | 0 / 0 / 0 / 1 / 1 | fixed | 0.4 |
| V095c | Homogeneous slope with a micro-pile row | Yamagami et al. (2000). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |

## Checks descartados en casos convertidos

- V001: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.386): superficie no circular (nonCircularOptimization)
- V002: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 0.414): superficie no circular (nonCircularOptimization)
- V026: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.19): superficie no circular (nonCircularOptimization)
- V033: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.534): superficie no circular (nonCircularOptimization)
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
- V102a: Morgenstern-Price (Spencer (M-P, constant f(x)), non-circular, Commercial program A (non-circular), 0.999): superficie no circular (nonCircularOptimization)
- V102b: Morgenstern-Price (Spencer (M-P, constant f(x)), non-circular, Commercial program A (non-circular), 0.997): superficie no circular (nonCircularOptimization)
- V093: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.325): superficie no circular (nonCircularOptimization)
- V093: Janbu (Janbu simplified (uncorrected), Commercial program A (non-circular), 1.178): método no soportado
- V098: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.36): superficie no circular (nonCircularOptimization)

## Sentidos de deslizamiento fijados por el importador

- V026: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): terraplén simétrico sobre arcilla (ambos pies a y = 50) y sin rangos de búsqueda, así que auto no tiene pista; cSlope toma ltr con crestas iguales (infer_orientation_from_coordinates), el círculo crítico de Duncan & Wright, (500, 174) en el marco del modelo, está en la cara derecha (masa hacia +x) y, al ser la búsqueda simétrica, ogs y cSlope dan el mismo FS con ltr y con rtl.
- V063: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): auto no puede resolver el sentido en esta presa simétrica con entry == exit; la orientación ltr reproduce el círculo crítico de cSlope (centro ≈ (154.2, 76.6), r ≈ 69.4).
- V077: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): terreno plano y una polilínea simétrica con los dos extremos a la misma cota, así que auto no tiene pista; cSlope toma ltr con crestas iguales (infer_orientation_from_coordinates) y el oráculo da el mismo FS con ltr y con rtl.

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
| V023 | material 'San Francisco Bay Mud' con modelo 'undrained' |
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
| V043 | definition con clave que cambia el problema: customSurfaces |
| V047b | opción de check que cambia el problema: tensionCrackDepth |
| V048 | opción de check que cambia el problema: tensionCrackDepth |
| V050b | sin checks válidos |
| V051 | sin checks válidos |
| V099 | piezométrica sobre el terreno (agua embalsada) |
| V053 | sin checks válidos |
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
| V068 | material 'Lower' con modelo 's-f-datum' |
| V070 | piezométrica sobre el terreno (agua embalsada) |
| V072a | opción de check que cambia el problema: tensionCrackDepth |
| V072b | opción de check que cambia el problema: tensionCrackDepth |
| V073 | opción de check que cambia el problema: tensionCrackDepth |
| V074 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V075 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V076 | definition con clave que cambia el problema: reinforcements |
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
| V032a | todos sus checks están retenidos en verification/pending/lote0 (el motor no los reproduce) |

## Casos con refuerzos (v0.4, lotes R1 a R4)

**23** casos con **28** checks, promovidos desde `verification/pending/F3R` cuando el motor de los refuerzos reproduce el valor publicado dentro de su tolerancia. No se relajó ninguna tolerancia ni se tocó ningún dato del problema. Los lotes son los de F4.12: **R1** anclajes (V016b, V035a, V035b, V037); **R2** clavos y geosintéticos con development (V011a, V011b, V012, V064, V065, V066a, V066b, V066c, V066e); **R3** geosintéticos con interface y clavos de pared (V010, V010b, V014, V083, V084a, V084b, V084c, V084d, V084e, V084f); **R4** pilotes de fuerza constante (V015, V095c).

V013b a V013e (Ito-Matsui, sin `force`) quedan fuera de v0.4 y siguen sin importarse.

**5** checks más (V014 ×2, V035b ×2, V083) quedan retenidos en `verification/pending/F3R` (`HOLD.json`): su FS reproduce el publicado, pero el motor emite `negative_effective_normal_major` y el test de aceptación lo rechaza (E14n-1 de §F4.17, criterio 2 no cumplido).

| lote | caso | refuerzos | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % | cruces ogs / oráculo |
|---|---|---:|---|---:|---|---:|---:|---:|---:|---:|---|
| R1 | V016b | 3 | bishop | 1.835 | Commercial program A | 1.03 | 1.8305 | -0.24 | 1.8302 | -0.26 | 0 / 0 |
| R1 | V016b | 3 | spencer | 1.839 | Commercial program A | 1.03 | 1.8358 | -0.18 | 1.8354 | -0.20 | 0 / 0 |
| R1 | V016b | 3 | bishop | 1.83 | Program D | 1.27 | 1.8305 | +0.03 | 1.8302 | +0.01 | 0 / 0 |
| R1 | V035a | 1 | morgenstern_price | 1.575 | Commercial program A (GLE) | 1.03 | 1.5687 | -0.40 | 1.5682 | -0.43 | 1 / 1 |
| R1 | V037 | 5 | bishop | 1.629 | Commercial program A | 2.03 | 1.6135 | -0.95 | 1.6134 | -0.96 | 5 / 5 |
| R1 | V037 | 5 | spencer | 1.62 | Commercial program A | 2.31 | 1.6079 | -0.75 | 1.6073 | -0.78 | 5 / 5 |
| R2 | V011a | 1 | bishop | 1.23 | Commercial program A | 1.41 | 1.2219 | -0.66 | 1.2198 | -0.83 | 1 / 1 |
| R2 | V011b | 1 | bishop | 1.22 | Commercial program A | 1.41 | 1.2167 | -0.27 | 1.2167 | -0.27 | 1 / 1 |
| R2 | V012 | 1 | bishop | 0.98 | Commercial program A | 1.51 | 0.9817 | +0.18 | 0.9818 | +0.18 | 1 / 1 |
| R2 | V064 | 15 | bishop | 1.02 | Program D | 1.49 | 1.0172 | -0.27 | 1.0172 | -0.28 | 15 / 15 |
| R2 | V065 | 15 | spencer | 0.964 | Commercial program A | 1.05 | 0.9604 | -0.38 | 0.9585 | -0.57 | 2 / 2 |
| R2 | V066a | 15 | bishop | 1.04 | Commercial program A | 1.48 | 1.0306 | -0.90 | 1.0306 | -0.90 | 15 / 15 |
| R2 | V066b | 15 | spencer | 1.011 | Program D | 1.05 | 1.0111 | +0.01 | 1.0111 | +0.01 | 9 / 9 |
| R2 | V066c | 15 | bishop | 1 | Leshchinsky & Han (2004) | 1.50 | 1.0116 | +1.16 | 1.0116 | +1.16 | 15 / 15 |
| R2 | V066e | 15 | bishop | 0.958 | Commercial program A | 1.05 | 0.9612 | +0.33 | 0.9612 | +0.33 | 15 / 15 |
| R3 | V010 | 1 | morgenstern_price | 1.171 | Commercial program B | 2.04 | 1.1646 | -0.55 | 1.1627 | -0.71 | 1 / 1 |
| R3 | V010 | 1 | bishop | 1.17 | Commercial program B | 2.43 | 1.1658 | -0.36 | 1.1640 | -0.51 | 1 / 1 |
| R3 | V010b | 1 | bishop | 1.15 | Borges & Cardoso | 2.43 | 1.1590 | +0.78 | 1.1588 | +0.76 | 1 / 1 |
| R3 | V014 | 14 | spencer | 1.576 | Program D | 1.03 | 1.5754 | -0.04 | 1.5755 | -0.03 | 8 / 8 |
| R3 | V084a | 7 | janbu_corrected | 0.989 | Commercial program A | 1.05 | 0.9892 | +0.03 | 0.9884 | -0.07 | 7 / 7 |
| R3 | V084b | 7 | janbu_corrected | 1.123 | Commercial program A | 1.04 | 1.1250 | +0.18 | 1.1243 | +0.11 | 7 / 7 |
| R3 | V084c | 7 | janbu_corrected | 1.043 | Commercial program A | 1.05 | 1.0443 | +0.12 | 1.0435 | +0.05 | 7 / 7 |
| R3 | V084d | 7 | janbu_corrected | 0.945 | Commercial program A | 1.05 | 0.9452 | +0.03 | 0.9443 | -0.08 | 7 / 7 |
| R3 | V084e | 7 | janbu_corrected | 0.922 | Commercial program A | 1.05 | 0.9210 | -0.11 | 0.9199 | -0.22 | 7 / 7 |
| R3 | V084f | 7 | janbu_corrected | 0.923 | Commercial program A | 1.05 | 0.9218 | -0.13 | 0.9206 | -0.26 | 7 / 7 |
| R4 | V015 | 3 | janbu_corrected | 1.479 | Commercial program A | 1.03 | 1.4767 | -0.16 | 1.4764 | -0.18 | 3 / 3 |
| R4 | V015 | 3 | janbu_simplified | 1.446 | Commercial program A | 1.03 | 1.4418 | -0.29 | 1.4418 | -0.29 | 3 / 3 |
| R4 | V095c | 1 | bishop | 1.193 | Commercial program A | 1.04 | 1.1956 | +0.22 | 1.1957 | +0.23 | 1 / 1 |

### Checks en los que ningún motor aplica fuerza

Con 0 / 0 cruces la superficie fija no corta ningún elemento (en V016b, los tres quedan dentro del círculo), así que el FS es el del talud sin refuerzo y el acuerdo con el publicado **no prueba nada sobre los refuerzos**: V016b (bishop, 1.835), V016b (spencer, 1.839), V016b (bishop, 1.83).


La comparación por cruce de las fuerzas (posición, fuerza y dirección de ogs y del oráculo) está en [`../REPORT.md`](../REPORT.md), sección «Comparación por cruce».
