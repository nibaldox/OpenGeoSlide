# R1-V: problemas de verificación (VP) de Slide2 y su cobertura en `pending/F3R`

Fuente de las cifras del manual: `docs/fase3/exploracion/X15.md` §1.5 y `X17.md` §5 (`Slide_SlopeStabilityVerification.pdf`,
Rocscience). En el corpus de cSlope, «Commercial program A» es Slide2: sus problemas se derivan de ese manual, y por eso la
mayor parte de los VP de F4.12 **ya entra por los lotes R1 a R4** (`verification/pending/F3R/`), con la cifra de Slide2 como
valor publicado. La tabla se armó buscando, en `golden/verification.json`, los checks con refuerzos de «Commercial program A»
cuyo valor publicado coincide con la cifra del VP (a 5e-4).

**Estado: transcripción parcial.** No bajé el manual otra vez ni transcribí los VP 31, 50, 59 y 88: se acabó el presupuesto de
la tarea. Lo que sigue distingue lo verificado de lo pendiente.

| VP | Tema | Estado | Dónde |
|---|---|---|---|
| 32 | terraplén reforzado, 3 círculos | cubierto: Slide2 1,23 / 1,22 / 0,98 | V011a, V011b, V012 (R2) |
| 47 | clavos pasivos, Janbu 0,890 | cubierto | V083 (R3): el oráculo da **0,8845 (−0,62 %)**, tolerancia 1,56 %; mejor que la geometría digitalizada de X17 (0,902, +1,3 %) |
| 48 | Clouterre, planos de 45° a 70° | cubierto: 1,123 / 0,989 / 0,922 / 0,923 | V084a, V084b, V084e, V084f (R3); V084c y V084d son los planos de 50° y 60° |
| 54 | micropilote, Yamagami | cubierto: 1,193 | V095c (R4) |
| 85 | tieback, caso 1 activo | cubierto: GLE 1,575 | V035a (R1) |
| 86 | tieback | cubierto: Bishop 1,629, GLE 1,62 | V037 (R1) |
| 87, 94 | geotextil, Leshchinsky y Han | cubierto en parte: solo coincide Bishop 1,040 (VP 87 y VP 94) | V066a (R2); V064 a V066e son otras variantes de la serie y no se cotejaron con las demás cifras de esos VP |
| 31 | terraplén reforzado, 5 materiales (A 1,18; B 1,16) | **no transcrito** | sin caso en el corpus; datos de soporte en la Tabla 31.2, la geometría no se leyó |
| 50 | talud reforzado, superficie predefinida (1,577; 1,417) | **no transcrito** | sin caso en el corpus; Tabla 50.2 da el soporte, falta la geometría |
| 59 | tieback activo con agua (Spencer 0,596; Janbu 0,583) | **no transcrito** | V075 del corpus de cSlope lo cita (activo, `development`, 0,57 de otro programa); no está en los lotes de F4.12, y la nota de cSlope dice que con la geometría de las figuras no reproduce el 0,596 de Slide2 |
| 88 | geotextil, calidad del relleno | **no transcrito** | sin caso con las cifras del VP 88 |
| 58 | tieback activo, 8 estratos con agua | pendiente (X17 §5.2) | geometría solo en la Figura 58.1 |

Qué falta, en concreto: para los VP 31, 50, 59 y 88 hay que bajar el manual (`curl` y `pdftotext -layout`), leer las tablas
de materiales y soportes, y reconstruir la geometría; si esta solo está en una figura sin coordenadas rotuladas, queda como en
el VP 58 (X17 §5.2): no se inventa una cifra. Ningún VP de esta lista tiene hoy una cifra mía en el repositorio.

**Aviso sobre V016b** (no es un VP de la lista): el oráculo no aplica ninguna fuerza (ver `pending/F3R/INDEX.md`), así que su
acuerdo con lo publicado no prueba nada sobre los refuerzos.
