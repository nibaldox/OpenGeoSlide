# Problemas con sismo o cargas excluidos (esquema v0.2)

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

Los problemas de cSlope con `seismicHorizontal`, `seismicVertical`, `udls` o `lineLoads` que se pueden convertir al esquema v0.2 (contrato F1.1) están en `verification/cases/` desde que el motor acepta la versión 0.2: **8** casos (V018, V102a, V102b, V077, V078, V081a, V081b, V097a). V051 pasó a `verification/cases` en CM (F7.6) con una versión mayor, con la búsqueda no circular que antes no tenían (sección «Búsqueda no circular y global (lote CM, v0.6 y v0.7)» de [`../cases/INDEX.md`](../cases/INDEX.md)). Aquí quedan los **17** excluidos, de un total de **26** problemas con sismo o cargas, con el motivo de cada uno.

| id | estado | motivo |
|---|---|---|
| V017a | excluido | contorno no válido (Self-intersection[13.8160684182133 100.095038741757]) |
| V017b | excluido | definition con clave que cambia el problema: reinforcements |
| V066e | excluido | definition con clave que cambia el problema: reinforcements |
| V074 | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V083 | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084a | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084b | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084c | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084d | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084e | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084f | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V097b | excluido | opción de check que cambia el problema: partialFactors |
| V104c | excluido | material 'embankment' con propiedad no soportada: bBarLoad |
| V104d | excluido | material 'upper clay' con propiedad no soportada: bBar |
| V105b | excluido | definition con clave que cambia el problema: earlierStage, waternet |
| V105c | excluido | definition con clave que cambia el problema: customSurfaces, earlierStage, waternet |
| V105d | excluido | definition con clave que cambia el problema: customSurfaces, earlierStage, waternet |

## Checks retenidos en total

Hay **18** checks retenidos en `verification/pending` (el motor o el oráculo no los reproducen; cada uno está en el `HOLD.json` de su lote, con el diagnóstico en el `INDEX.md` del lote):

| lote | checks retenidos |
|---|---:|
| [lote0](lote0/INDEX.md) | 5 |
| [F3](F3/INDEX.md) | 1 |
| [F3R](F3R/INDEX.md) | 3 |
| [F3G](F3G/INDEX.md) | 6 |
| [F3B](F3B/INDEX.md) | 3 |
| [CM](CM/INDEX.md) | 0 |
