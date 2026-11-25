# Casos pendientes (esquema v0.2: sismo y cargas)

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

Estos casos usan `analysis.seismic` o `loads` (contrato F1.1) y el motor de la rama `main` no los acepta todavía: están aquí, y no en `verification/cases/`, para no romper la aceptación antes de integrar A1 (sismo y cargas en el motor). Al integrar A1 se mueven a `verification/cases/` y se regeneran los índices.

Problemas de cSlope con sismo o cargas: **26**. Casos incluidos: **5**.

El oráculo (cSlope 0.1.0, a través de `to_cslope.py`) reproduce los valores publicados de estos casos en `ORACLE_REPORT.md` (`verification/harness/run.py --cases verification/pending`). La columna de ogs queda «sin dato» hasta que el motor acepte la versión 0.2.

| id | título | referencia | unidades | sismo y cargas | checks (bishop/spencer) | tipo |
|---|---|---|---|---|---|---|
| V102a | Loukidis et al. (2003) slope at its critical seismic coefficient, dry | Loukidis, D., Bandini, P. & Salgado, R. (2003). Stability of seismically loaded slopes using limit analysis. Géotechnique 53(5), 463–479. | SI | kh = 0.432, kv = 0 | 2 / 3 | search |
| V102b | Loukidis et al. (2003) slope at its critical seismic coefficient, rᵤ = 0.5 | Loukidis, D., Bandini, P. & Salgado, R. (2003). Stability of seismically loaded slopes using limit analysis. Géotechnique 53(5), 463–479. | SI | kh = 0.132, kv = 0 | 2 / 3 | search |
| V081a | Sharma (1996) reinforcement example, unreinforced | Sharma (1996). | SI | udl q = 40 en [17, 30] | 1 / 0 | fixed |
| V081b | Sharma (1996) slope with a reinforced zone (φ = 54.93°) | Sharma (1996). Verification manual of a commercial slope stability program. | SI | udl q = 40 en [17, 30] | 1 / 0 | fixed |
| V097a | Eurocode 7 cutting with surcharge | Verification manual of a commercial slope stability program. | SI | udl q = 35 en [52, 62] | 1 / 0 | fixed |

## Checks descartados en los casos incluidos

- V102a: Morgenstern-Price (Spencer (M-P, constant f(x)), non-circular, Commercial program A (non-circular), 0.999): superficie no circular (nonCircularOptimization)
- V102b: Morgenstern-Price (Spencer (M-P, constant f(x)), non-circular, Commercial program A (non-circular), 0.997): superficie no circular (nonCircularOptimization)

## Motivo de inclusión o exclusión de cada problema

| id | estado | motivo |
|---|---|---|
| V017a | excluido | contorno no válido (Self-intersection[13.8160684182133 100.095038741757]) |
| V017b | excluido | definition con clave que cambia el problema: reinforcements |
| V018 | excluido | definition con clave que cambia el problema: customSurfaces |
| V051 | excluido | sin checks válidos |
| V066e | excluido | definition con clave que cambia el problema: reinforcements |
| V102a | incluido | Loukidis et al. (2003) slope at its critical seismic coefficient, dry: kh = 0.432, kv = 0; sin reforzamientos, superficies personalizadas, B̄, presión de exceso ni factores parciales |
| V102b | incluido | Loukidis et al. (2003) slope at its critical seismic coefficient, rᵤ = 0.5: kh = 0.132, kv = 0; sin reforzamientos, superficies personalizadas, B̄, presión de exceso ni factores parciales |
| V074 | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V077 | excluido | definition con clave que cambia el problema: customSurfaces |
| V078 | excluido | definition con clave que cambia el problema: customSurfaces |
| V081a | incluido | Sharma (1996) reinforcement example, unreinforced: udl q = 40 en [17, 30]; sin reforzamientos, superficies personalizadas, B̄, presión de exceso ni factores parciales |
| V081b | incluido | Sharma (1996) slope with a reinforced zone (φ = 54.93°): udl q = 40 en [17, 30]; sin reforzamientos, superficies personalizadas, B̄, presión de exceso ni factores parciales |
| V083 | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084a | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084b | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084c | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084d | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084e | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V084f | excluido | definition con clave que cambia el problema: customSurfaces, reinforcements |
| V097a | incluido | Eurocode 7 cutting with surcharge: udl q = 35 en [52, 62]; sin reforzamientos, superficies personalizadas, B̄, presión de exceso ni factores parciales |
| V097b | excluido | opción de check que cambia el problema: partialFactors |
| V104c | excluido | material 'embankment' con propiedad no soportada: bBarLoad |
| V104d | excluido | material 'upper clay' con propiedad no soportada: bBar |
| V105b | excluido | definition con clave que cambia el problema: earlierStage, waternet |
| V105c | excluido | definition con clave que cambia el problema: customSurfaces, earlierStage, waternet |
| V105d | excluido | definition con clave que cambia el problema: customSurfaces, earlierStage, waternet |
