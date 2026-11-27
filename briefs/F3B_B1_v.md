# Brief F3B-B1 V: verificación (conversores, casos y batería diferencial)

Escritor: **Antigravity**. Lee primero `briefs/F3B_B1_comun.md` (dueños, reglas y gates) y el contrato
`briefs/05_CONTRATOS_FASE3B.md`, en especial **F6.2, F6.3, F6.4 y F6.12**.

## Objetivo

Preparar la verificación del bloque para que B2 solo tenga que promover:
- los conversores aprenden los campos v0.6;
- los casos publicados quedan en `verification/pending/F3B/`;
- se crea el bloque `F3B` de la batería diferencial.

**La física no existe en tu rama** (stubs `todo!()`): tus tests no pueden necesitar que el motor resuelva un modelo
v0.6. La comparación de ogs contra el oráculo la corre B2.

## Qué hacer

1. **`verification/harness/to_cslope.py`** (ogs → cSlope):
   - `hoek_brown`: `ucs`, `gsi`, `mi` y `disturbance`, siempre escrito;
   - `shansep`: `ratio`, `exponent`, `ocr`, `pop` y `ocr_by_elevation`, con los nombres de cSlope (X26 §2.1);
   - `analysis.search.non_circular`: `nonCircularOptimization` con lo que corresponda de `seeds` y `max_vertices`. Si
     cSlope no tiene un parámetro equivalente, déjalo en su valor por defecto y anótalo.

   Tests nuevos en `verification/harness/test_to_cslope.py`, o donde estén hoy los de ese conversor.
2. **`verification/tools/import_cslope.py`** (cSlope → ogs):
   - el material `shansep`. Sin fuente de OCR, el caso queda fuera con su motivo (F6.3: en ogs es un error);
   - el material Hoek-Brown;
   - los checks con `nonCircularOptimization`, que hoy se descartan (`import_cslope.py:531`), pasan a
     `verification/pending/F3B/` con `analysis.search.non_circular` y `version` `"0.6"`;
   - `aboveWater` sigue fuera, con su motivo (V105a).

   Actualiza `verification/pending/F3B/INDEX.md` y `HOLD.json` con el mismo generador y el mismo estilo de
   `pending/F3G`. Los casos **no** se promueven a `verification/cases/` (eso es de B2), y no cambies `cases/INDEX.md`.
   Lista de X23 §1 y X29 §8: V001, V002, V026, V033, V034a, V034b, V036a, V093, V102a y V102b, más los que el
   conversor pueda escribir de V009c, V050b, V059a-c, V094 y V103. Para cada caso que no entre, anota el motivo
   exacto.
3. **Hammah et al. (2005), ejemplo 1**, como caso propio en `verification/pending/F3B/` (`HAM1`, o el id que siga la
   convención del repo):
   - la geometría reconstruida de X23 §3.2, con sus supuestos escritos en el caso: cimentación, terreno seco y γ;
   - la fuente: ARMA 05-810, con la URL de X25 §6.1;
   - Bishop 1,153 y Spencer 1,152, con la tolerancia de 0,5 % que fija F6.12 para una geometría reconstruida, y la
     nota de la regla de la envolvente completa de F6.8.
4. **Batería diferencial, bloque `F3B`** (`verification/differential/`): los sintéticos SA y SB de X23 §4, y de 6 a 8
   modelos más de rajo con Hoek-Brown:
   - de 2 a 4 bancos, roca débil y competente, con D de 0 a 1;
   - con y sin piezométrica (convertida con `to_cslope.py`);
   - en búsqueda y en círculo fijo;
   - dos modelos con SHANSEP (V047a con OCR 1 y con POP) y dos con `non_circular` (V001 y V034a).

   Sigue el estilo de los bloques F3G y F3R: la entrada, la cifra del oráculo y la tolerancia. Como el motor de tu rama
   no tiene la física, el runner tiene que poder **saltar** el bloque F3B con una opción o una variable de entorno. B2
   lo activa.
5. **Python** (`crates/ogs-py/tests/test_v06.py`):
   - un modelo v0.6 con Hoek-Brown pasa la validación del wheel y llega al stub. En B2 ese test pasa a esperar el FS;
   - la versión mínima;
   - el mensaje de versión desconocida.

   No toques el código Rust de `ogs-py`.
6. **Gates** de `F3B_B1_comun.md`. En el informe, agrega:
   - cuántos casos quedaron en `pending/F3B` y con cuántos checks;
   - la lista de los que quedaron fuera, con su motivo;
   - cuántos modelos tiene el bloque F3B de la batería.

## Cierre

El informe de `F3B_B1_comun.md` §«Informe final».
