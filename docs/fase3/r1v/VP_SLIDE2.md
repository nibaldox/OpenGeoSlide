# R1-V / R2-I1b: problemas de verificación (VP) de Slide2 y su cobertura

Fuente de las cifras: manual de verificación de Slide2 (`Slide_SlopeStabilityVerification.pdf`, Rocscience), leído por
F3R-R2/I1 (sección «Cifras del manual»), y `docs/fase3/exploracion/X15.md` §1.5 y `X17.md` §5. En el corpus de cSlope,
«Commercial program A» es Slide2: sus problemas se derivan de ese manual, y por eso la mayor parte de los VP de F4.12
entra por los lotes R1 a R4 (hoy en `verification/cases`; los 5 checks retenidos, en `verification/pending/F3R`). Esta
tabla no es un criterio de aceptación: documenta las cifras de Slide2, qué caso del corpus las cubre y por qué los demás
no se transcriben.

## Cifras del manual (leídas por I1)

| VP | Método (Slide2) | Cifra | Tabla de origen | Otro programa citado |
|---|---|---|---|---|
| 31 | Bishop, dos superficies | 1,18 y 1,16 | tabla de resultados del VP 31 (la de soporte es la Tabla 31.2; el número de la de resultados no se registró) | Borges y Cardoso: 1,19 y 1,15 |
| 50 | dos métodos | 1,577 y 1,417 | Tabla 50.2 (clavos, encabezada «Active») | SNAILZ: 1,60 y 1,46 |
| 59 | Spencer / Bishop / Janbu simplificado | 0,596 / 0,582 / 0,583 | Tabla 59.3 (cada método sobre su superficie crítica) | — |
| 87 | circular: Bishop / Spencer / GLE | 1,040 / 1,097 / 1,168 | Tabla 87.2 (X15 §1.5: geotextil, Ta = 10 kN/m, L = 6,3 m, pullout 80 %) | L&H: 0,99 (FDM) y 1,00 |
| 88 | φ = 25°, T = 22: Bishop / Spencer / GLE | 1,045 / 1,043 / 1,043 | tabla de resultados del VP 88 (número no registrado) | — |
| 94 | Bishop / Spencer / GLE | 1,040 / 1,129 / 1,194 | Tabla 94.3 (Bishop sobre la Fig. 94.2) | — |

Los números de tabla sin registrar no se inventan: hay que abrir el manual para fijarlos.

## Cotejo con el corpus

| VP | Caso del corpus | Qué coincide | Qué no, y por qué no se transcribe |
|---|---|---|---|
| 87 | **V066a** (`cases`; tres bancos de 3 m, geotextil cada 0,6 m, Ta = 10 kN/m, L = 6,3 m) | Bishop 1,040 es el valor publicado del check. ogs da 1,0306 (−0,9 %, tol 1,48 %); cSlope, 1,0306. | Spencer 1,097 y GLE 1,168 son sobre las superficies críticas de Spencer y de GLE de Slide2, que solo están en figuras. El círculo fijo del caso es el crítico de Bishop, y sobre él ogs no converge con Spencer ni con M-P (`not_converged`). Un check de 1,097 sobre el círculo de Bishop compararía superficies distintas; y «GLE» del manual no dice qué función entre dovelas usa. No se agrega. |
| 94 | **V064** (`cases`; cinco bancos de 1,8 m, Ta = 10,1 kN/m) | Bishop 1,040 es el de la Tabla 94.3 sobre el círculo de la Fig. 94.2 (centro (−5,537; 20,452), r = 18,45), que es el del caso. | El check del caso es 1,02 de Program D, no el de Slide2: cSlope da 1,017 (−2,2 %) y ogs 1,0172 (−2,2 % frente a 1,040; −0,3 % frente a 1,02). Según la nota de cSlope, el modelo de los bancos (extracción desde la interfaz al 80 %, conexión del paramento) es la causa probable, y por eso 1,040 no es check. Spencer 1,129 y GLE 1,194 son sobre superficies críticas propias, sin coordenadas en tablas; ogs no converge con Spencer ni M-P sobre el círculo de Bishop. |
| 88 | ninguno | — | φ = 25° y T = 22 kN/m no coinciden con ningún caso: V066a a V066e usan relleno de φ = 34°, fundación de c = 10 kPa y φ = 34° (V065: c = 0, φ = 18°) y Ta = 7,5 a 11,6 kN/m. Con φ y T de la tabla no se puede construir el caso: falta la geometría, que está en la figura. |
| 31 | probables **V010** (círculo A) y **V010b** (círculo B), «Borges & Cardoso embankment 2 (geosynthetic)» | V010b: el publicado es el de Borges y Cardoso, 1,15 (ogs 1,159). | No verificado contra el manual: el valor de Slide2 de V010 en el corpus es 1,17 y el leído por I1 es 1,18 (y 1,16); la diferencia de 0,01 no se explica sin abrir el manual. Borges 1,19 no es check del corpus. No se agrega nada. |
| 50 | **V014** («Nailed wall, 14 rows», lote R3) | 1,577 coincide con el Spencer de V014 (publicado 1,576 de Program D; ogs 1,5754). El 1,46 de SNAILZ coincide con el 1,46 de Program H (check de Janbu corregido). | El 1,417 de Slide2 es con los clavos «Active» de la Tabla 50.2; el corpus los trata pasivos (ogs 1,4484 con Janbu corregido, +2,2 % sobre 1,417). Los 2 checks de Janbu corregido están en `pending/F3R/HOLD.json` por el aviso `negative_effective_normal_major` (E14n-1). |
| 59 | **V075** (cSlope; **no** está en los lotes de F4.12 ni en `cases`) | Spencer 0,596 es el valor de Slide2 sobre su círculo crítico de Spencer. | Según la nota de cSlope, sobre esa superficie no existe solución de equilibrio completo (el momento exige F ≥ 0,600; el equilibrio de fuerzas da a lo sumo 0,583): 0,596 es un valor aceptado con una brecha. Bishop 0,582 y Janbu 0,583 son sobre sus propios círculos. El check de V075 en cSlope es el de Commercial program B, 0,57. |

## Qué cubre el corpus

**Ningún VP nuevo se transcribió como caso.** Un caso solo entra si sus datos están completos en tablas; no se inventó
ninguna geometría de figuras.

| VP | Tema | Estado | Dónde |
|---|---|---|---|
| 32 | terraplén reforzado, 3 círculos | cubierto: Slide2 1,23 / 1,22 / 0,98 | V011a, V011b, V012 |
| 47 | clavos pasivos, Janbu 0,890 | cubierto en el FS (ogs 0,8845, −0,62 %, tol 1,56 %); el check está **retenido** por el aviso mayor | V083 (`pending/F3R`) |
| 48 | Clouterre, planos de 45° a 70° | cubierto: 1,123 / 0,989 / 0,922 / 0,923 | V084a, V084b, V084e, V084f (V084c y V084d son los planos de 50° y 60°) |
| 54 | micropilote, Yamagami | cubierto: 1,193 | V095c |
| 85 | tieback, caso 1 activo | cubierto: GLE 1,575 | V035a |
| 86 | tieback | cubierto: Bishop 1,629, GLE 1,62 | V037 |
| 87 | geotextil, tres bancos | cubierto en Bishop: 1,040 | V066a |
| 94 | geotextil, cinco bancos | mismo círculo; Bishop 1,040 de Slide2 **no** es el check (el de V064 es 1,02) | V064 |
| 31 | terraplén reforzado | probable V010 / V010b, no verificado | — |
| 50 | clavos, superficie predefinida | Spencer 1,577 cubierto por V014; 1,417 con clavos activos, no | V014 |
| 59, 88, 58 | tieback con agua; geotextil φ = 25°; tieback de 8 estratos | no transcritos: geometría solo en figuras (X17 §5.2) | — |

**V016b no es un VP de la lista y no prueba los refuerzos:** sus tres elementos quedan dentro del círculo fijo (sin cruce),
y ni ogs ni el oráculo aplican fuerza (`verification/cases/INDEX.md`, sección «Casos con refuerzos», y
`docs/fase3/r1v/NOTAS.md`).
