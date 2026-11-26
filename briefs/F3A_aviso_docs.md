# Brief F3A-K: aviso E13k y documentación de la Fase 3a (dos escritores Sonnet en paralelo)

Responde en **español neutro, sin voseo**.

**Lee primero:**
- `briefs/02_CONTRATOS_FASE3.md`, normativo, en particular **F3.10b (E13j-6 a E13k)**;
- `docs/fase3/d1/DIAGNOSTICO.md`, que trae la definición de `r_v` y las herramientas de `docs/fase3/d1/tools/`
  (`admiss.py`).

**Base:** `f3a-integracion`, en el commit que creó tu worktree.

**Reglas:**
- Un test RED antes de cada cambio.
- Commits con rutas explícitas y **sin push**.
- `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y Python siempre con
  `env -u PYTHONPATH -u PYTHONHOME`.

## K-1: aviso E13k (worktree `f3k1`, rama `f3k1-aviso`)

**Archivos tuyos:**
- `crates/ogs-core/src/methods/{mod.rs,spencer.rs,morgenstern_price.rs}`, y `slicer.rs` solo si hace falta exponer la
  altura de la cara;
- `crates/ogs-core/tests/*` nuevos;
- `briefs/00_CONTRATOS.md`, **solo** para agregar `interslice_shear_exceeds_strength` a la lista E6;
- `apps/web/src/engine/warnings.ts` y su test.

**Tareas:**
1. **Implementa `r_v` según E13k**, con una función pura testeable, y emite el aviso cuando `r_v > 3` en Spencer y en
   M-P.
   - El valor de `r_v` de tu implementación debe coincidir con el de `admiss.py` de D-1 a 1e-6 relativo en los casos A,
     B y C de `crates/ogs-core/tests/d1_spencer_absurd_fs.rs` y en V047a.
   - Agrega tests de la exclusión de caras sin resistencia (V021).
2. **Efecto medido:** corre todos los modelos (93 casos, `pending`, la batería D01 a D17 y `acads1a`) con todos sus
   métodos, en búsqueda y en superficie fija.
   - **Ninguno** debe recibir el aviso.
   - La salida debe ser idéntica byte a byte a la de un binario de la base, compilado en un worktree detached en
     `$TMPDIR` que borras al final.
   - Si alguno cambia, **detente** y repórtalo.
3. **Web:** `warnings.ts`, con el texto exacto de E13k, severidad `aviso` y la ruta `/analysis/surface`; y la lista E6
   de `00_CONTRATOS.md`. `warnings.test.ts` debe pasar.

**Gates:**
- `fmt`;
- `clippy -D warnings`;
- `cargo test -p ogs-core --release --no-fail-fast`, también con `--features parallel`;
- aceptación;
- `pnpm --dir apps/web exec vitest run src/engine`.

**Presupuesto:** unas 70 iteraciones.

## K-2: documentación de la Fase 3a (worktree `f3k2`, rama `f3k2-docs`)

**Archivos tuyos:**
- `docs/formato-ogs-json.md`, `docs/limitaciones.md`, `docs/verificacion.md` y `docs/desarrollo.md`;
- `CHANGELOG.md`;
- `README.md`, solo en la sección de verificación, con cifras leídas de los informes, y en la de limitaciones, en
  resumen.

**Tareas:**
1. **`docs/formato-ogs-json.md`:** el formato v0.3 completo, con ejemplos que validen contra
   `schema/ogs-0.3.schema.json`.
   - Cubre el material `undrained` con sus cuatro campos, la polilínea, los métodos, `interslice` con sus cinco
     funciones, `correction_factor` en el informe y la compuerta de versión.
   - Valida cada ejemplo con un script: `jsonschema` y `target/release/ogs analyze`.
2. **`docs/limitaciones.md`:**
   - Bishop solo en círculos;
   - la búsqueda sigue siendo circular, porque la no circular es F3b;
   - el ajuste de la polilínea al terreno por primer cruce, y la cara vertical como `polyline_outside_ground`;
   - ξ sobre el bloque de suelo, y el espejo solo con f simétrica;
   - la guarda m_α en tramos empinados de polilínea;
   - el aviso E13k y lo que significa;
   - **V032a**: la búsqueda encuentra un mínimo superficial real, más conservador, que cSlope confirma sobre el mismo
     círculo, y que sale de los rangos efectivos;
   - V027, V028 y V068 retenidos por `negative_effective_normal_major`;
   - lo que queda para F3b (búsqueda no circular, Hoek-Brown y SHANSEP) y para el bloque de refuerzos (tablestacas,
     pilotes, anclajes, clavos y geosintéticos; ver `docs/fase3/PLAN_REFUERZOS.md`).
3. **`docs/verificacion.md` y README:**
   - cifras **leídas** de `verification/REPORT.md`, `verification/differential/REPORT.md` y `bench/RESULTS.md`;
   - número de casos y checks por versión y por método;
   - la batería con los métodos nuevos;
   - la tabla corta del README actualizada.
4. **`CHANGELOG.md`:** la sección «Unreleased» completa de F3a, con E13a a E13k.

**Verificación:**
- todos los enlaces relativos existen;
- los ejemplos validan;
- `python3 /home/xodla/.hermes/profiles/open-geoslide/skills/beautify-github-readme/scripts/audit_readme.py README.md`
  da OK.

**Presupuesto:** unas 60 iteraciones.
