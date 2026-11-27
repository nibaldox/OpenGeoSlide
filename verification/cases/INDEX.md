# Casos de verificación v0.1 a v0.6 (desde cSlope)

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

Casos convertidos e incluidos: **167** (v0.1: **49**, v0.2 con sismo o cargas: **5**, v0.3: **53**, v0.4 con refuerzos: **23**, v0.5 con grieta de tracción: **21**, v0.6 con Hoek-Brown o búsqueda no circular: **16**), con **347** checks. Lote 0: todo lo que se convierte con la versión 0.1 o 0.2, sin tope ni selección. Lotes 1 y 2 (`undrained`, polilíneas fijas, Morgenstern-Price y Janbu): los casos v0.3, promovidos desde `verification/pending/F3` cuando el motor reproduce sus checks. Lotes R1 a R4: los casos v0.4 con refuerzos, promovidos desde `verification/pending/F3R` (sección «Casos con refuerzos»). Lote F3G: los casos con grieta de tracción (v0.5) y con agua embalsada (la versión mínima de sus campos si no tienen grieta), promovidos desde `verification/pending/F3G` (sección «Grieta de tracción y agua embalsada»). Lote F3B: los casos v0.6 con búsqueda no circular y Hoek-Brown, promovidos desde `verification/pending/F3B` (sección «Hoek-Brown y búsqueda no circular»). Casos no incluidos: **31** (motivo en cada fila). Los problemas de cSlope con sismo o cargas que no se pudieron convertir figuran en [`../pending/INDEX.md`](../pending/INDEX.md); los checks que el motor no reproduce, en [`../pending/lote0/INDEX.md`](../pending/lote0/INDEX.md); los lotes 1 y 2 (formato v0.3), en [`../pending/F3/INDEX.md`](../pending/F3/INDEX.md).

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
| V014 | Nailed wall, 14 rows, deep wedge | Caltrans soil nail reference manual. | SI | — | 0 / 1 / 0 / 0 / 2 | fixed | 0.4 |
| V084a | Soil-nailed wall in sand (Clouterre test wall) | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084b | Soil-nailed wall in sand (Clouterre test wall), 45° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084c | Soil-nailed wall in sand (Clouterre test wall), 50° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084d | Soil-nailed wall in sand (Clouterre test wall), 60° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084e | Soil-nailed wall in sand (Clouterre test wall), 65° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V084f | Soil-nailed wall in sand (Clouterre test wall), 70° plane | Sheahan & Ho (2003). | SI | carga lineal p = 13.2 en x = 11.7, ángulo 0° | 0 / 0 / 0 / 0 / 1 | fixed | 0.4 |
| V015 | Soldier-pile tieback wall | Caltrans soil nail reference manual. | SI | — | 0 / 0 / 0 / 1 / 1 | fixed | 0.4 |
| V095c | Homogeneous slope with a micro-pile row | Yamagami et al. (2000). | SI | — | 1 / 0 / 0 / 0 / 0 | fixed | 0.4 |
| V023 | LASH terminal trench, Duncan's Taylor series example | Duncan (2000), J. Geotech. Geoenviron. Eng. 126(4). | SI | — | 0 / 1 / 0 / 0 / 0 | fixed | 0.3 |
| V024 | Dam on a layered foundation with artesian uplift, piezometric line (D&W fig. 6.39) | Duncan & Wright, Soil Strength and Slope Stability, figs. 6.39–6.40. | SI | — | 3 / 1 / 0 / 0 / 0 | fixed | 0.1 |
| V038 | Homogeneous dam with a piezometric line (D&W fig. 7.19) | Duncan & Wright, Soil Strength and Slope Stability, fig. 7.19. | SI | — | 2 / 1 / 0 / 0 / 0 | search | 0.1 |
| V038b | Homogeneous dam with a piezometric line, Duncan & Wright's input | Duncan, J.M., Wright, S.G. & Brandon, T.L. (2014). Soil Strength and Slope Stability, 2nd ed., Wiley; §7.7, Figs. 7.30–7.36, Table 7.8. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.1 |
| V041a | Submerged slope, pool 30 ft above the crest (D&W fig. 6.27) | Duncan & Wright, Soil Strength and Slope Stability, fig. 6.27. | SI | — | 1 / 2 / 0 / 0 / 0 | search | 0.1 |
| V041b | Submerged slope, pool 60 ft above the crest (D&W fig. 6.27) | Duncan & Wright, Soil Strength and Slope Stability, fig. 6.27. | SI | — | 1 / 2 / 0 / 0 / 0 | search | 0.1 |
| V042 | Thick-core dam with a piezometric line (D&W fig. 7.24) | Duncan & Wright, Soil Strength and Slope Stability, fig. 7.24. | SI | — | 1 / 1 / 0 / 0 / 0 | fixed | 0.1 |
| V047b | ACADS tension crack, reference crack depth 3.6 m (results correspond to a dry crack) | Giam & Donald (1989), ACADS problem 1(b). | SI | — | 1 / 0 / 1 / 0 / 0 | search | 0.5 |
| V048 | ACADS 1(b), water-filled tension crack | Giam & Donald (1989), ACADS problem 1(b). | SI | — | 1 / 1 / 0 / 0 / 1 | search | 0.5 |
| V058 | Griffiths & Lane example 6, earth dam with full reservoir | Griffiths & Lane (1999), Géotechnique 49(3). | SI | — | 0 / 2 / 0 / 0 / 0 | search | 0.1 |
| V061 | Clarence Cannon Dam (Wolff & Harr), specified surface | Wolff & Harr (1987). | SI | — | 0 / 1 / 2 / 0 / 0 | fixed | 0.3 |
| V070 | Partial drawdown, B̄ = 1 (Morgenstern chart) | Morgenstern (1963). | SI | — | 2 / 1 / 0 / 0 / 0 | search | 0.1 |
| V072a | Pockoski & Duncan test slope 2, dry tension crack | Pockoski & Duncan (2000). | SI | — | 1 / 1 / 0 / 0 / 0 | fixed | 0.5 |
| V072b | Pockoski & Duncan slope 2, circular search | Pockoski & Duncan (2000). Verification manual of a commercial slope stability program. | SI | — | 1 / 1 / 0 / 1 / 0 | search | 0.5 |
| V073 | Pockoski & Duncan test slope 3, clay seam and dry crack | Pockoski & Duncan (2000). | SI | — | 1 / 1 / 0 / 0 / 0 | search | 0.5 |
| V079 | Priest (1993) rigid block on a plane, water-filled crack | Priest, S.D. (1993). Discontinuity Analysis for Rock Engineering. Chapman & Hall, London; example 8.1, pp. 224–225. | SI | — | 0 / 1 / 0 / 1 / 0 | fixed | 0.5 |
| V080 | Priest (1993) rigid block, reference geometry (60° face) | Priest, S.D. (1993). Discontinuity Analysis for Rock Engineering. Chapman & Hall, London; example 8.1, pp. 224–225. | SI | — | 0 / 1 / 1 / 0 / 0 | fixed | 0.5 |
| V082a | Sharma (1996) slope, 11 ft dry tension crack instead of the zero-strength cap | Sharma (1996); Malkawi et al. (2001). Verification manual of a commercial slope stability program. | SI | — | 1 / 1 / 1 / 0 / 1 | fixed | 0.5 |
| V082b | Sharma (1996) slope, 11 ft tension crack with 6 ft of water | Sharma (1996); Malkawi et al. (2001). Verification manual of a commercial slope stability program. | SI | — | 1 / 1 / 1 / 0 / 1 | fixed | 0.5 |
| V086b | Tandjiria embankment, clay fill, water-filled crack | Tandjiria, V., Low, B.K. & Teh, C.I. (2002). Effect of reinforcement force distribution on stability of embankments. Geotextiles and Geomembranes 20, 423–443. | SI | — | 0 / 1 / 1 / 0 / 0 | search | 0.5 |
| V086b-auto | Tandjiria embankment, clay fill, water-filled crack (auto) | Tandjiria, V., Low, B.K. & Teh, C.I. (2002). Effect of reinforcement force distribution on stability of embankments. Geotextiles and Geomembranes 20, 423–443. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.5 |
| V086c | Tandjiria embankment, sand fill, dry crack | Tandjiria, V., Low, B.K. & Teh, C.I. (2002). Effect of reinforcement force distribution on stability of embankments. Geotextiles and Geomembranes 20, 423–443. | SI | — | 0 / 1 / 1 / 0 / 0 | search | 0.5 |
| V086d | Tandjiria embankment, clay fill, the paper's geometry | Tandjiria, V., Low, B.K. & Teh, C.I. (2002). Effect of reinforcement force distribution on stability of embankments. Geotextiles and Geomembranes 20, 423–443; problem 1, Table 2. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.5 |
| V087 | USACE dam, chart-check properties (EM 1110-2-1902 fig. 4-3) | USACE EM 1110-2-1902 (2003), fig. 4-3. | SI | — | 0 / 0 / 0 / 0 / 1 | fixed | 0.3 |
| V088 | USACE dam, end of construction (EM 1110-2-1902 fig. 4-1) | USACE EM 1110-2-1902 (2003), fig. 4-1. | SI | — | 1 / 1 / 1 / 0 / 1 | fixed | 0.5 |
| V089 | USACE dam, upstream low pool (EM 1110-2-1902 fig. 4-2) | USACE EM 1110-2-1902 (2003), fig. 4-2. | SI | — | 1 / 1 / 1 / 0 / 1 | fixed | 0.3 |
| V091 | USACE example E-2 (fig. E-10), ponded water | USACE EM 1110-2-1902 (2003), appendix E, example E-2, fig. E-10. | SI | — | 1 / 1 / 1 / 0 / 1 | fixed | 0.3 |
| V092 | USACE example F-6, steady-seepage dam | USACE EM 1110-2-1902, example F-6. | SI | — | 1 / 1 / 1 / 0 / 1 | fixed | 0.3 |
| V096a | Zhu & Lee heterogeneous slope, dry, deep circle | Zhu, D.Y. & Lee, C.F. (2002). Explicit limit equilibrium solution for slope stability. Int. J. Numer. Anal. Meth. Geomech. 26(15), 1573–1590. | SI | — | 1 / 1 / 1 / 0 / 0 | search | 0.5 |
| V096b | Zhu & Lee heterogeneous slope with a water table, deep circle | Zhu, D.Y. & Lee, C.F. (2002). Explicit limit equilibrium solution for slope stability. Int. J. Numer. Anal. Meth. Geomech. 26(15), 1573–1590. | SI | — | 1 / 1 / 1 / 0 / 0 | search | 0.5 |
| V096c | Zhu & Lee slope, surface 3 (the reference circle), dry, 1 m crack | Zhu & Lee (2002), Int. J. Numer. Anal. Meth. Geomech. 26(15). Verification manual of a commercial slope stability program. | SI | — | 1 / 1 / 0 / 0 / 0 | fixed | 0.5 |
| V013b | Cai & Ugai slope, pile row D1/D = 2 | Cai & Ugai (2000), Soils and Foundations 40(1). | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.5 |
| V013c | Cai & Ugai slope, pile row D1/D = 3 | Cai & Ugai (2000), Soils and Foundations 40(1). | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.5 |
| V013d | Cai & Ugai slope, pile row D1/D = 4 | Cai & Ugai (2000), Soils and Foundations 40(1). | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.5 |
| V013e | Cai & Ugai slope, pile row D1/D = 6 | Cai & Ugai (2000), Soils and Foundations 40(1). | SI | — | 1 / 0 / 0 / 0 / 0 | search | 0.5 |
| V001-nc | Arai & Tagyo (1985) example 1, non-circular search | Arai & Tagyo (1985), example 1. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V026-nc | Duncan & Wright fig. 7.12, embankment on clay, non-circular search | Duncan & Wright, Soil Strength and Slope Stability, fig. 7.12. | imperial | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V033-nc | Duncan & Wright fig. 14.20a, water table, non-circular search | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.20a. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V034a-nc | Duncan & Wright fig. 14.20b, Su = 200 + 15·depth, non-circular search | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.20b. | imperial | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V034b-nc | Duncan & Wright fig. 14.20b, Su = 300 psf, non-circular search | Duncan & Wright, Soil Strength and Slope Stability, fig. 14.20b. | imperial | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V036a-nc | Embankment on an undrained foundation, cz = 0 (D&W fig. 15.9), non-circular search | Duncan & Wright, Soil Strength and Slope Stability, fig. 15.9. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V093-nc | Yamagami & Ueta (1988), non-circular search | Yamagami & Ueta (1988). | SI | — | 0 / 1 / 0 / 1 / 0 | search | 0.6 |
| V102a-nc | Loukidis et al. (2003) slope at its critical seismic coefficient, dry, non-circular search | Loukidis, D., Bandini, P. & Salgado, R. (2003). Stability of seismically loaded slopes using limit analysis. Géotechnique 53(5), 463–479. | SI | kh = 0.432, kv = 0 | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V102b-nc | Loukidis et al. (2003) slope at its critical seismic coefficient, rᵤ = 0.5, non-circular search | Loukidis, D., Bandini, P. & Salgado, R. (2003). Stability of seismically loaded slopes using limit analysis. Géotechnique 53(5), 463–479. | SI | kh = 0.132, kv = 0 | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V050b | ACADS 3(a), weak layer, non-circular search | Giam & Donald (1989), ACADS problem 3(a). | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V059a | Guo & Griffiths two-layer undrained slope, cu2/cu1 = 1.4 | Guo & Griffiths (2020), Can. Geotech. J. 57. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V059b | Guo & Griffiths two-layer undrained slope, cu2/cu1 = 1.5 | Guo & Griffiths (2020), Can. Geotech. J. 57. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V059c | Guo & Griffiths two-layer undrained slope, cu2/cu1 = 1.6 | Guo & Griffiths (2020), Can. Geotech. J. 57. | SI | — | 0 / 1 / 0 / 0 / 0 | search | 0.6 |
| V094 | Yamagami & Ueta (1988) four-layer slope, non-circular | Greco (1996) example 4; Yamagami & Ueta (1988). | SI | — | 0 / 1 / 1 / 0 / 0 | search | 0.6 |
| V103 | Spencer's slope, rᵤ = 0.5, non-circular critical surface | Fredlund, D.G. & Krahn, J. (1977), Can. Geotech. J. 14(3), Figs. 3 and 7; Baker, R. (1980). Determination of the critical slip surface in slope stability computations. Int. J. Numer. Anal. Meth. Geomech. 4, 333–359; Spencer (1969). | SI | — | 0 / 2 / 0 / 0 / 0 | search | 0.6 |
| HAM1 | Hammah et al. (2005), ejemplo 1 | Hammah et al. (2005), ARMA/USRMS 05-810 | SI | — | 1 / 1 / 0 / 0 / 0 | fixed | 0.6 |

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
- V041a: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.592): superficie no circular (nonCircularOptimization)
- V041b: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.59): superficie no circular (nonCircularOptimization)
- V046a: Bishop (Bishop simplified, Commercial program A, 1.382): Bishop no admite superficies polilínea (contrato F3.6)
- V046a: Bishop (Bishop simplified, Fredlund & Krahn, 1.377): Bishop no admite superficies polilínea (contrato F3.6)
- V046b: Bishop (Bishop simplified, Fredlund & Krahn, 1.248): Bishop no admite superficies polilínea (contrato F3.6)
- V046c: Bishop (Bishop simplified, Commercial program A, 1.124): Bishop no admite superficies polilínea (contrato F3.6)
- V046c: Bishop (Bishop simplified, Fredlund & Krahn, 1.124): Bishop no admite superficies polilínea (contrato F3.6)
- V102a: Morgenstern-Price (Spencer (M-P, constant f(x)), non-circular, Commercial program A (non-circular), 0.999): superficie no circular (nonCircularOptimization)
- V102b: Morgenstern-Price (Spencer (M-P, constant f(x)), non-circular, Commercial program A (non-circular), 0.997): superficie no circular (nonCircularOptimization)
- V073: Bishop (Bishop simplified, composite circle, Commercial program A (composite), 1.392): opción compositeBase=True
- V073: Morgenstern-Price (Spencer (M-P, constant f(x)), composite circle, Commercial program A (composite), 1.4): opción compositeBase=True
- V093: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.325): superficie no circular (nonCircularOptimization)
- V093: Janbu (Janbu simplified (uncorrected), Commercial program A (non-circular), 1.178): método no soportado
- V098: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.36): superficie no circular (nonCircularOptimization)
- V041a: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.592): superficie no circular (nonCircularOptimization)
- V041b: Morgenstern-Price (Spencer (M-P, constant f(x)), Commercial program A (non-circular), 1.59): superficie no circular (nonCircularOptimization)
- V073: Bishop (Bishop simplified, composite circle, Commercial program A (composite), 1.392): opción compositeBase=True
- V073: Morgenstern-Price (Spencer (M-P, constant f(x)), composite circle, Commercial program A (composite), 1.4): opción compositeBase=True

## Sentidos de deslizamiento fijados por el importador

- V026: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): terraplén simétrico sobre arcilla (ambos pies a y = 50) y sin rangos de búsqueda, así que auto no tiene pista; cSlope toma ltr con crestas iguales (infer_orientation_from_coordinates), el círculo crítico de Duncan & Wright, (500, 174) en el marco del modelo, está en la cara derecha (masa hacia +x) y, al ser la búsqueda simétrica, ogs y cSlope dan el mismo FS con ltr y con rtl.
- V063: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): auto no puede resolver el sentido en esta presa simétrica con entry == exit; la orientación ltr reproduce el círculo crítico de cSlope (centro ≈ (154.2, 76.6), r ≈ 69.4).
- V077: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): terreno plano y una polilínea simétrica con los dos extremos a la misma cota, así que auto no tiene pista; cSlope toma ltr con crestas iguales (infer_orientation_from_coordinates) y el oráculo da el mismo FS con ltr y con rtl.
- V038: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): presa con las dos coronas a la misma cota y sin rangos de búsqueda, así que auto no tiene pista; cSlope toma ltr con crestas iguales (infer_orientation_from_coordinates) y su círculo crítico está en el talud de aguas abajo (derecho). Medido con el oráculo (F3G-V): con ltr da 1,0693 (Bishop) y con rtl 2,0808 en el primer check, frente al publicado 1,09.
- V038b: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): presa con las dos coronas a la misma cota y sin rangos de búsqueda, así que auto no tiene pista; cSlope toma ltr con crestas iguales (infer_orientation_from_coordinates) y su círculo crítico está en el talud de aguas abajo (derecho). Medido con el oráculo (F3G-V): con ltr da 1,1578 (Spencer) y con rtl 1,9342 en el primer check, frente al publicado 1,16.
- V058: slope.direction fijado a left_to_right por el importador (DIRECTION_OVERRIDES): presa con las dos coronas a la misma cota y sin rangos de búsqueda, así que auto no tiene pista; cSlope toma ltr con crestas iguales (infer_orientation_from_coordinates) y su círculo crítico está en el talud de aguas abajo (derecho). Medido con el oráculo (F3G-V): con ltr da 1,9152 (Spencer) y con rtl 3,2688 en el primer check, frente al publicado 1,9.

## Problemas con peso saturado (`unitWeightSat`) no incluidos

En la fuente hay **10** problemas con `unitWeightSat` no nulo; **0** se incluyen. Casos incluidos con `unit_weight_sat` en el modelo: **4**. Ninguno de los no incluidos es convertible con las reglas actuales (contrato §1, §2). Motivo de cada uno (el primero que lo impide):

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
| V017a | contorno no válido (Self-intersection[13.8160684182133 100.095038741757]) |
| V017b | definition con clave que cambia el problema: reinforcements |
| V035b | definition con clave que cambia el problema: reinforcements |
| V039 | opción de check que cambia el problema: compositeBase |
| V043 | definition con clave que cambia el problema: customSurfaces |
| V051 | sin checks válidos |
| V099 | piezométrica sobre el terreno (agua embalsada) |
| V053 | sin checks válidos |
| V100 | material 'Clay' con modelo 'shear-normal' |
| V066d | definition con clave que cambia el problema: reinforcements, waterTables |
| V068 | material 'Lower' con modelo 's-f-datum' |
| V074 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V075 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V076 | definition con clave que cambia el problema: reinforcements |
| V082c | material 'Soil 2 (zero strength)' con modelo 'undrained' |
| V082d | material 'Soil 2 (zero strength)' con modelo 'undrained' |
| V083 | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V085 | opción de check que cambia el problema: tensionCrackDepth |
| V086a | definition con clave que cambia el problema: reinforcements |
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

**23** casos con **30** checks, promovidos desde `verification/pending/F3R` cuando el motor de los refuerzos reproduce el valor publicado dentro de su tolerancia. No se relajó ninguna tolerancia ni se tocó ningún dato del problema. Los lotes son los de F4.12: **R1** anclajes (V016b, V035a, V035b, V037); **R2** clavos y geosintéticos con development (V011a, V011b, V012, V064, V065, V066a, V066b, V066c, V066e); **R3** geosintéticos con interface y clavos de pared (V010, V010b, V014, V083, V084a, V084b, V084c, V084d, V084e, V084f); **R4** pilotes de fuerza constante (V015, V095c).

V013b a V013e (Ito-Matsui, sin `force`) no son de v0.4: son de v0.5 con `lateral_pressure` y están en el lote F3I.

**3** checks más (V035b ×2, V083) quedan retenidos en `verification/pending/F3R` (`HOLD.json`): su FS reproduce el publicado, pero el motor emite `negative_effective_normal_major` y el test de aceptación lo rechaza. Es una tracción real del modelo, presente también sin refuerzos; E14n-1 de §F4.17 (adoptada) solo elimina el aviso en V014, donde venía de dovelas finas de cruce.

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
| R3 | V014 | 14 | janbu_corrected | 1.46 | Program H | 1.34 | 1.4484 | -0.79 | 1.4482 | -0.81 | 8 / 8 |
| R3 | V014 | 14 | janbu_corrected | 1.448 | Program D | 1.03 | 1.4484 | +0.03 | 1.4482 | +0.02 | 8 / 8 |
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

## Grieta de tracción y agua embalsada (lote F3G, v0.5)

**31** casos con **80** checks, promovidos desde `verification/pending/F3G` cuando el motor de la grieta y del agua embalsada (F5.2 y F5.3) reproduce el valor publicado dentro de su tolerancia. Con grieta el caso es v0.5 (`analysis.tension_crack`); sin grieta lleva la versión mínima de sus campos (v0.1 a v0.3) y el agua embalsada la activa que la piezométrica pase sobre el terreno (F5.3). La grieta es un campo del modelo, no del check: los checks de V086b con otra grieta están en `V086b-auto`. La tolerancia es la del corpus de cSlope, leída como **relativa** (`|Δ|/publicado ≤ tolerancia`), la misma convención de los demás casos; no se relajó ninguna ni se tocó ningún dato.

**6** checks más (V009a, V009b, V085 ×4) quedan retenidos en `verification/pending/F3G` (`HOLD.json`), con los números y la causa medida.

| caso | v | grieta | agua embalsada | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % |
|---|---|---|---|---|---:|---|---:|---:|---:|---:|---:|
| V023 | 0.3 | — | sí | spencer | 1.145 | Program D | 1.04 | 1.1376 | -0.64 | 1.1381 | -0.60 |
| V024 | 0.1 | — | sí | bishop | 1.563 | Commercial program A | 1.03 | 1.5723 | +0.60 | 1.5717 | +0.56 |
| V024 | 0.1 | — | sí | spencer | 1.557 | Commercial program A | 1.03 | 1.5629 | +0.38 | 1.5622 | +0.33 |
| V024 | 0.1 | — | sí | bishop | 1.57 | Duncan & Wright | 1.32 | 1.5723 | +0.15 | 1.5717 | +0.11 |
| V024 | 0.1 | — | sí | bishop | 1.572 | Program D | 1.03 | 1.5723 | +0.02 | 1.5717 | -0.02 |
| V038 | 0.1 | — | sí | bishop | 1.09 | Commercial program A | 2.46 | 1.0958 | +0.53 | 1.0693 | -1.90 |
| V038 | 0.1 | — | sí | spencer | 1.1 | Commercial program A | 2.45 | 1.0994 | -0.05 | 1.0771 | -2.09 |
| V038 | 0.1 | — | sí | bishop | 1.07 | Program D | 2.47 | 1.0958 | +2.41 | 1.0693 | -0.06 |
| V038b | 0.1 | — | sí | spencer | 1.16 | Duncan & Wright | 2.43 | 1.1663 | +0.54 | 1.1578 | -0.19 |
| V041a | 0.1 | — | sí | bishop | 1.603 | Commercial program A | 2.03 | 1.5977 | -0.33 | 1.5965 | -0.40 |
| V041a | 0.1 | — | sí | spencer | 1.599 | Commercial program A | 2.03 | 1.5958 | -0.20 | 1.5937 | -0.33 |
| V041a | 0.1 | — | sí | spencer | 1.6 | Duncan & Wright (reference) | 2.31 | 1.5958 | -0.27 | 1.5937 | -0.39 |
| V041b | 0.1 | — | sí | bishop | 1.603 | Commercial program A | 2.03 | 1.5972 | -0.36 | 1.5964 | -0.41 |
| V041b | 0.1 | — | sí | spencer | 1.599 | Commercial program A | 2.03 | 1.5953 | -0.23 | 1.5931 | -0.37 |
| V041b | 0.1 | — | sí | spencer | 1.6 | Duncan & Wright (reference) | 2.31 | 1.5953 | -0.29 | 1.5931 | -0.43 |
| V042 | 0.1 | — | sí | bishop | 1.584 | Commercial program A | 1.03 | 1.5823 | -0.11 | 1.5820 | -0.13 |
| V042 | 0.1 | — | sí | spencer | 1.648 | Commercial program A | 1.03 | 1.6495 | +0.09 | 1.6492 | +0.07 |
| V047b | 0.5 | 3.6 m, water_fill 0 | no | bishop | 1.664 | Commercial program B | 2.03 | 1.6590 | -0.30 | 1.6591 | -0.30 |
| V047b | 0.5 | 3.6 m, water_fill 0 | no | morgenstern_price | 1.66 | Commercial program B | 2.30 | 1.6559 | -0.25 | 1.6560 | -0.24 |
| V048 | 0.5 | 4 m, water_fill 1 | no | bishop | 1.596 | Commercial program A | 2.03 | 1.5869 | -0.57 | 1.5869 | -0.57 |
| V048 | 0.5 | 4 m, water_fill 1 | no | spencer | 1.592 | Commercial program A | 2.03 | 1.5825 | -0.60 | 1.5824 | -0.60 |
| V048 | 0.5 | 4 m, water_fill 1 | no | janbu_corrected | 1.489 | Commercial program A | 2.03 | 1.4752 | -0.93 | 1.4748 | -0.95 |
| V058 | 0.1 | — | sí | spencer | 1.9 | Griffiths & Lane (FE) | 5.00 | 1.9168 | +0.88 | 1.9152 | +0.80 |
| V058 | 0.1 | — | sí | spencer | 1.915 | Program D | 2.03 | 1.9168 | +0.09 | 1.9152 | +0.01 |
| V061 | 0.3 | — | sí | morgenstern_price | 2.36 | Wolff & Harr | 1.21 | 2.3483 | -0.50 | 2.3483 | -0.49 |
| V061 | 0.3 | — | sí | morgenstern_price | 2.343 | Commercial program B | 1.02 | 2.3483 | +0.22 | 2.3483 | +0.23 |
| V061 | 0.3 | — | sí | spencer | 2.383 | Commercial program A | 1.02 | 2.3878 | +0.20 | 2.3879 | +0.21 |
| V070 | 0.1 | — | sí | bishop | 1.417 | Commercial program A | 2.04 | 1.4155 | -0.11 | 1.4147 | -0.17 |
| V070 | 0.1 | — | sí | bishop | 1.41 | Morgenstern chart | 3.35 | 1.4155 | +0.39 | 1.4147 | +0.33 |
| V070 | 0.1 | — | sí | spencer | 1.422 | Program D | 2.04 | 1.4218 | -0.02 | 1.4210 | -0.07 |
| V072a | 0.5 | 1.6764 m, water_fill 0 | no | bishop | 1.285 | Commercial program A | 1.04 | 1.2828 | -0.17 | 1.2821 | -0.23 |
| V072a | 0.5 | 1.6764 m, water_fill 0 | no | spencer | 1.29 | Commercial program A | 1.39 | 1.2883 | -0.13 | 1.2875 | -0.19 |
| V072b | 0.5 | 1.6764 m, water_fill 0 | no | bishop | 1.285 | Commercial program A | 2.04 | 1.2822 | -0.22 | 1.2815 | -0.27 |
| V072b | 0.5 | 1.6764 m, water_fill 0 | no | spencer | 1.29 | Commercial program A | 2.39 | 1.2879 | -0.16 | 1.2871 | -0.22 |
| V072b | 0.5 | 1.6764 m, water_fill 0 | no | janbu_simplified | 1.141 | Commercial program A | 2.04 | 1.1365 | -0.39 | 1.1352 | -0.51 |
| V073 | 0.5 | 1.8288 m, water_fill 0 | no | bishop | 1.417 | Commercial program A (circles) | 2.04 | 1.4278 | +0.77 | 1.4099 | -0.50 |
| V073 | 0.5 | 1.8288 m, water_fill 0 | no | spencer | 1.422 | Commercial program A (circles) | 2.04 | 1.4304 | +0.59 | 1.4146 | -0.52 |
| V079 | 0.5 | 15 m, water_fill 0.25 | no | janbu_simplified | 1.049 | Commercial program A, commercial program C, Priest | 1.05 | 1.0483 | -0.07 | 1.0483 | -0.07 |
| V079 | 0.5 | 15 m, water_fill 0.25 | no | spencer | 1.049 | Commercial program A, commercial program C, Priest | 1.05 | 1.0483 | -0.07 | 1.0483 | -0.07 |
| V080 | 0.5 | 15 m, water_fill 0.25 | no | morgenstern_price | 1.049 | Commercial program B | 1.05 | 1.0490 | +0.00 | 1.0490 | -0.00 |
| V080 | 0.5 | 15 m, water_fill 0.25 | no | spencer | 1.049 | Priest | 1.05 | 1.0490 | +0.00 | 1.0490 | -0.00 |
| V082a | 0.5 | 3.3528 m, water_fill 0 | no | bishop | 1.532 | Commercial program A | 2.03 | 1.5206 | -0.74 | 1.5204 | -0.76 |
| V082a | 0.5 | 3.3528 m, water_fill 0 | no | spencer | 1.532 | Commercial program A | 2.03 | 1.5199 | -0.79 | 1.5196 | -0.81 |
| V082a | 0.5 | 3.3528 m, water_fill 0 | no | morgenstern_price | 1.532 | Commercial program A | 2.03 | 1.5199 | -0.79 | 1.5196 | -0.81 |
| V082a | 0.5 | 3.3528 m, water_fill 0 | no | janbu_corrected | 1.544 | Commercial program A | 2.03 | 1.5336 | -0.68 | 1.5333 | -0.69 |
| V082b | 0.5 | 3.3528 m, water_fill 0.54545 | no | bishop | 1.511 | Commercial program A | 2.03 | 1.4996 | -0.75 | 1.4994 | -0.77 |
| V082b | 0.5 | 3.3528 m, water_fill 0.54545 | no | spencer | 1.51 | Commercial program A | 2.33 | 1.4988 | -0.74 | 1.4985 | -0.76 |
| V082b | 0.5 | 3.3528 m, water_fill 0.54545 | no | morgenstern_price | 1.51 | Commercial program A | 2.33 | 1.4988 | -0.74 | 1.4986 | -0.76 |
| V082b | 0.5 | 3.3528 m, water_fill 0.54545 | no | janbu_corrected | 1.52 | Commercial program A | 2.33 | 1.5090 | -0.72 | 1.5088 | -0.74 |
| V086b | 0.5 | 2 m, water_fill 1 | no | spencer | 0.975 | Commercial program A | 2.05 | 0.9690 | -0.61 | 0.9683 | -0.69 |
| V086b | 0.5 | 2 m, water_fill 1 | no | morgenstern_price | 0.975 | Commercial program A | 2.05 | 0.9690 | -0.61 | 0.9683 | -0.69 |
| V086b-auto | 0.5 | auto, water_fill 1 | no | spencer | 0.975 | Commercial program A | 2.05 | 0.9672 | -0.80 | 0.9665 | -0.88 |
| V086c | 0.5 | 2 m, water_fill 0 | no | spencer | 1.209 | Commercial program A | 2.04 | 1.2100 | +0.08 | 1.2064 | -0.21 |
| V086c | 0.5 | 2 m, water_fill 0 | no | morgenstern_price | 1.218 | Commercial program A | 2.04 | 1.2185 | +0.04 | 1.2151 | -0.23 |
| V086d | 0.5 | auto, water_fill 1 | no | spencer | 0.981 | Tandjiria, Low & Teh | 2.05 | 0.9740 | -0.71 | 0.9730 | -0.82 |
| V087 | 0.3 | — | sí | janbu_corrected | 2.29 | Commercial program A | 2.22 | 2.2487 | -1.80 | 2.2476 | -1.85 |
| V088 | 0.5 | 2.1336 m, water_fill 0 | no | spencer | 2.445 | Commercial program A | 2.02 | 2.4419 | -0.13 | 2.4416 | -0.14 |
| V088 | 0.5 | 2.1336 m, water_fill 0 | no | bishop | 2.447 | Commercial program A | 2.02 | 2.4426 | -0.18 | 2.4423 | -0.19 |
| V088 | 0.5 | 2.1336 m, water_fill 0 | no | janbu_corrected | 2.43 | Commercial program A | 2.21 | 2.4443 | +0.59 | 2.4438 | +0.57 |
| V088 | 0.5 | 2.1336 m, water_fill 0 | no | morgenstern_price | 2.447 | Commercial program A | 2.02 | 2.4419 | -0.21 | 2.4416 | -0.22 |
| V089 | 0.3 | — | sí | bishop | 2.716 | Commercial program A | 2.02 | 2.6992 | -0.62 | 2.6982 | -0.65 |
| V089 | 0.3 | — | sí | spencer | 2.736 | Commercial program A | 2.02 | 2.7218 | -0.52 | 2.7208 | -0.56 |
| V089 | 0.3 | — | sí | janbu_corrected | 2.65 | Commercial program A | 2.19 | 2.6486 | -0.05 | 2.6473 | -0.10 |
| V089 | 0.3 | — | sí | morgenstern_price | 2.744 | Commercial program A | 2.02 | 2.7280 | -0.58 | 2.7270 | -0.62 |
| V091 | 0.3 | — | sí | bishop | 1.241 | Commercial program A | 1.04 | 1.2374 | -0.29 | 1.2364 | -0.37 |
| V091 | 0.3 | — | sí | spencer | 1.241 | Commercial program A | 1.04 | 1.2374 | -0.29 | 1.2364 | -0.37 |
| V091 | 0.3 | — | sí | morgenstern_price | 1.244 | Commercial program A (GLE) | 1.04 | 1.2374 | -0.53 | 1.2364 | -0.61 |
| V091 | 0.3 | — | sí | janbu_corrected | 1.385 | Commercial program A | 1.04 | 1.3896 | +0.33 | 1.3905 | +0.40 |
| V092 | 0.3 | — | sí | bishop | 2.011 | Commercial program A | 2.02 | 1.9914 | -0.97 | 1.9903 | -1.03 |
| V092 | 0.3 | — | sí | spencer | 2.026 | Commercial program A | 2.02 | 2.0057 | -1.00 | 2.0046 | -1.06 |
| V092 | 0.3 | — | sí | janbu_corrected | 1.83 | Commercial program A | 2.27 | 1.8247 | -0.29 | 1.8232 | -0.37 |
| V092 | 0.3 | — | sí | morgenstern_price | 2.027 | Commercial program A | 2.02 | 2.0058 | -1.04 | 2.0048 | -1.10 |
| V096a | 0.5 | 1.015 m, water_fill 0 | no | bishop | 1.804 | Commercial program A | 2.03 | 1.7977 | -0.35 | 1.7935 | -0.58 |
| V096a | 0.5 | 1.015 m, water_fill 0 | no | spencer | 1.804 | Commercial program A | 2.03 | 1.7993 | -0.26 | 1.7944 | -0.53 |
| V096a | 0.5 | 1.015 m, water_fill 0 | no | morgenstern_price | 1.79 | Commercial program A | 2.28 | 1.7842 | -0.32 | 1.7800 | -0.56 |
| V096b | 0.5 | 1.015 m, water_fill 0 | no | bishop | 1.176 | Commercial program A | 2.04 | 1.1751 | -0.07 | 1.1734 | -0.22 |
| V096b | 0.5 | 1.015 m, water_fill 0 | no | spencer | 1.189 | Commercial program A | 2.04 | 1.1902 | +0.10 | 1.1868 | -0.19 |
| V096b | 0.5 | 1.015 m, water_fill 0 | no | morgenstern_price | 1.174 | Commercial program A | 2.04 | 1.1745 | +0.04 | 1.1720 | -0.17 |
| V096c | 0.5 | 1.015 m, water_fill 0 | no | spencer | 1.804 | Commercial program A | 1.03 | 1.8000 | -0.22 | 1.7997 | -0.24 |
| V096c | 0.5 | 1.015 m, water_fill 0 | no | bishop | 1.804 | Commercial program A | 1.03 | 1.7996 | -0.25 | 1.7992 | -0.26 |

## Pilotes de Ito-Matsui (lote F3I, v0.5)

**4** casos con **4** checks (V013b a V013e, Cai y Ugai 2000, filas de D1/D = 2, 3, 4 y 6), promovidos desde `verification/pending/F3I` cuando el motor de E15i reproduce el valor publicado dentro de su tolerancia. Cada pilote lleva `lateral_pressure` (`ito_matsui`, `diameter`, `location`) y no `force`; la fuente no trae `direction` ni `location`, y se escriben los valores de cSlope (`angle` 0 y `centroid`). No se relajó ninguna tolerancia ni se tocó ningún dato del problema.

| caso | D1/D | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % |
|---|---:|---|---:|---|---:|---:|---:|---:|---:|
| V013b | 2 | bishop | 1.54 | Commercial program A | 2.32 | 1.5412 | +0.07 | 1.5408 | +0.05 |
| V013c | 3 | bishop | 1.43 | Commercial program A | 2.35 | 1.4374 | +0.52 | 1.4371 | +0.49 |
| V013d | 4 | bishop | 1.33 | Commercial program A | 2.38 | 1.3317 | +0.13 | 1.3314 | +0.11 |
| V013e | 6 | bishop | 1.25 | Commercial program A | 2.40 | 1.2530 | +0.24 | 1.2528 | +0.22 |

## Hoek-Brown y búsqueda no circular (lote F3B, v0.6)

**16** casos con **20** checks, promovidos desde `verification/pending/F3B` (F6.12) cuando el motor reproduce el valor publicado dentro de su tolerancia. Son los problemas de cSlope con `nonCircularOptimization` de la lista de F6.12 (con `analysis.search.non_circular` en sus valores por defecto: 3 semillas y 33 vértices) y el ejemplo 1 de Hammah et al. (2005), `HAM1`, con Hoek-Brown, geometría reconstruida, círculo fijo y tolerancia de 0,5 %. Los diez problemas que ya tienen un caso en este directorio con otros checks y otro modelo llevan el sufijo `-nc` (como `V086b-auto`): `V001-nc` es el check no circular del problema `V001`, y `V001` sigue con sus checks circulares. La tolerancia es la del corpus de cSlope, leída como **relativa** (`|Δ|/publicado ≤ tolerancia`); no se relajó ninguna ni se tocó ningún dato.

**2** check más (V002-nc, V009c) queda retenido en `verification/pending/F3B` (`HOLD.json`), con los números y la causa medida.

| caso | v | búsqueda | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % |
|---|---|---|---|---:|---|---:|---:|---:|---:|---:|
| HAM1 | 0.6 | círculo fijo | bishop | 1.153 | Hammah et al. (2005), tabla 2 | 0.50 | 1.1502 | -0.24 | 1.1518 | -0.10 |
| HAM1 | 0.6 | círculo fijo | spencer | 1.152 | Hammah et al. (2005), tabla 2 | 0.50 | 1.1521 | +0.00 | 1.1530 | +0.09 |
| V001-nc | 0.6 | no circular | spencer | 1.386 | Commercial program A (non-circular) | 2.04 | 1.3839 | -0.15 | 1.3837 | -0.16 |
| V026-nc | 0.6 | no circular | spencer | 1.19 | Commercial program A (non-circular) | 2.42 | 1.1731 | -1.42 | 1.1702 | -1.67 |
| V033-nc | 0.6 | no circular | spencer | 1.534 | Commercial program A (non-circular) | 2.03 | 1.5236 | -0.67 | 1.5219 | -0.79 |
| V034a-nc | 0.6 | no circular | spencer | 1.262 | Commercial program A (non-circular) | 2.04 | 1.2650 | +0.24 | 1.2649 | +0.23 |
| V034b-nc | 0.6 | no circular | spencer | 1.182 | Commercial program A (non-circular) | 2.04 | 1.1705 | -0.97 | 1.1685 | -1.14 |
| V036a-nc | 0.6 | no circular | spencer | 0.74 | Commercial program A (non-circular) | 2.68 | 0.7366 | -0.46 | 0.7360 | -0.54 |
| V050b | 0.6 | no circular | spencer | 1.246 | Commercial program A | 2.04 | 1.2388 | -0.58 | 1.2254 | -1.66 |
| V059a | 0.6 | no circular | spencer | 1.215 | Commercial program A (optimized) | 2.04 | 1.2145 | -0.04 | 1.2136 | -0.11 |
| V059b | 0.6 | no circular | spencer | 1.29 | Commercial program A (optimized) | 2.39 | 1.2898 | -0.02 | 1.2892 | -0.06 |
| V059c | 0.6 | no circular | spencer | 1.315 | Commercial program A (optimized) | 2.04 | 1.3148 | -0.02 | 1.3118 | -0.24 |
| V093-nc | 0.6 | no circular | spencer | 1.325 | Commercial program A (non-circular) | 2.04 | 1.3253 | +0.02 | 1.3227 | -0.17 |
| V093-nc | 0.6 | no circular | janbu_simplified | 1.178 | Commercial program A (non-circular) | 2.04 | 1.1776 | -0.03 | 1.1764 | -0.13 |
| V094 | 0.6 | no circular | spencer | 1.398 | Commercial program A (Monte Carlo) | 2.04 | 1.3997 | +0.12 | 1.4001 | +0.15 |
| V094 | 0.6 | no circular | morgenstern_price | 1.389 | Commercial program B | 2.04 | 1.3913 | +0.17 | 1.3886 | -0.03 |
| V102a-nc | 0.6 | no circular | spencer | 0.999 | Commercial program A (non-circular) | 2.05 | 0.9980 | -0.10 | 0.9978 | -0.12 |
| V102b-nc | 0.6 | no circular | spencer | 0.997 | Commercial program A (non-circular) | 2.05 | 0.9966 | -0.04 | 0.9965 | -0.05 |
| V103 | 0.6 | no circular | spencer | 1.02 | Baker (non-circular) | 2.49 | 1.0081 | -1.17 | 1.0078 | -1.20 |
| V103 | 0.6 | no circular | spencer | 1.01 | Commercial program A (non-circular) | 2.50 | 1.0081 | -0.19 | 1.0078 | -0.22 |
