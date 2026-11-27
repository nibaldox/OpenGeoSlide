# Brief F3B-B0M: tipos, formato v0.6, validación, ganchos y stubs del motor

Responde en **español neutro, sin voseo**. Escritor: **Terra**.

## Objetivo

Congelar en el motor todo lo que no depende de la física de los prototipos: tipos, formato v0.6, validación, ganchos
en `lib.rs`, módulos nuevos con stubs, salida y esquema 0.6. **Sin lógica física nueva.** Un modelo sin campos v0.6
tiene que dar la misma salida byte a byte que la v0.4.0.

## Contexto

- Repo: tu worktree `~/archivos/opengeoslide-wt/f3b0m`, rama `f3b0m-motor`, creada desde `f3b-integracion`.
- **Contrato normativo:** `briefs/05_CONTRATOS_FASE3B.md`, secciones **F6.1 a F6.7**. Léelas completas antes de
  empezar. Las secciones F6.8 a F6.10 están marcadas como condicionales y **no** las implementas.
- Mapa del motor con `archivo:línea`: `docs/fase3/exploracion/X27.md` §1 y §2 (las líneas son de `0b9c984`; verifica).
- Otro escritor (Antigravity) hace en paralelo la parte web de B0 en su propio clon. No toques `apps/web`.
- **Mensaje de versión desconocida**, igual en Rust, Python y la web:
  `version debe ser "0.1", "0.2", "0.3", "0.4", "0.5" o "0.6", no "<x>"`.

## Archivos

**Tuyos:**
- `crates/ogs-core/src/`: `model.rs`, `strength.rs`, `loads.rs`, `lib.rs`, `report.rs`, `search.rs` (solo el campo
  `seeds` de `SearchResult`, vacío), `slicer.rs` (solo el paso de la resistencia de las caras por
  `strength::face_tau`, F6.6), y los módulos nuevos `hoek_brown.rs`, `strength_loop.rs`, `shansep.rs` y
  `noncircular.rs`, con sus firmas y sus stubs;
- `crates/ogs-core/tests/`: el nuevo `f3b_format.rs`; `acceptance.rs` (las tres notas en `INFORMATIVE_WARNINGS`);
  y los tests existentes que usan `"0.6"` como versión desconocida (`f3g_types.rs`, `v03_format.rs`, `f3r_types.rs`,
  `loads_seismic.rs`), que pasan a `"0.7"`, más cualquier test que compare el mensaje de la lista de versiones;
- `crates/ogs-cli/src/main.rs` (el texto de uso dice «v0.1 a v0.6» y nombra los campos nuevos) y `bench.rs` si hace
  falta;
- `crates/ogs-py/tests/` solo si algún test compara el mensaje de versión;
- `schema/ogs-0.6.schema.json` (nuevo, copia completa del 0.5 con los cambios) y `verification/tools/test_schema.py`
  (tablas de 0.6; la versión futura pasa a `"0.7"`).

**Protegidos:** `apps/web/**`, `verification/` (salvo `tools/test_schema.py`), `briefs/**`, `docs/**`,
`CHANGELOG.md`, `Cargo.toml`/`Cargo.lock` (no agregues dependencias).

## Qué hacer

1. **`model.rs`:** los tipos de F6.6, con `skip_serializing_if` en todo campo nuevo y `deny_unknown_fields` en los
   objetos nuevos. `FORMAT_VERSION_V06`.
2. **`loads.rs`:** la lista de versiones con 0.6, las puertas anteriores abiertas a 0.6 y `first_v06_field` con el
   orden de F6.1. Los rechazos de F6.5 (grieta `auto` e Ito-Matsui con materiales nuevos) y el de Bishop con
   `non_circular` (F6.4).
3. **`strength.rs`:** `StrengthLaw`, `HoekBrownParams` (con mb, s y a derivados por las ecs. 3 a 5 de F6.2; esto sí lo
   implementas, porque es una fórmula cerrada del contrato) y `ShansepParams`; la validación de F6.2 y F6.3 con los
   mensajes del contrato; `resolve` devuelve `(0, 0)` para las leyes nuevas; `face_tau` según F6.6.
4. **`slicer.rs`:** la resistencia de las caras pasa por `face_tau` para las leyes nuevas. Para `Linear`, la forma
   cerrada actual sin cambios.
5. **Módulos nuevos:** firmas públicas dentro del crate y stubs:
   - `hoek_brown::tau_at_normal(params, sigma_n) -> f64`: `todo!("F3B-M-HB")`;
   - `strength_loop::solve(...)`: sin dovelas `hoek_brown`, llama a `methods::solve_with` tal cual; con alguna,
     `todo!("F3B-M-HB")`;
   - `shansep::apply(...)`: sin dovelas `shansep`, no hace nada; con alguna, `todo!("F3B-M-SH")`;
     `shansep::su_at(...) -> f64`: `todo!("F3B-M-SH")`;
   - `noncircular::refine(...)`: `todo!("F3B-M-NC")`.

   Documenta cada firma con su sección del contrato. El escritor de B1 que la llene no podrá cambiarla sin enmienda,
   así que piensa los argumentos: `strength_loop::solve` necesita el modelo preparado, las dovelas, el método y sus
   opciones, y devuelve el `MethodResult` más el `StrengthReport`; `noncircular::refine` necesita las semillas, el
   modelo preparado, el método y un evaluador de polilíneas que haga los mismos pasos que hoy hace `lib.rs` con una
   superficie fija.
6. **`lib.rs`:** los tres ganchos de F6.6 en los dos caminos (búsqueda y superficie fija).
7. **`report.rs`:** `MethodReport.strength` y `SearchStats.non_circular`, omitidos si son `None`.
8. **Esquema 0.6** y sus tests en `test_schema.py`.
9. **Tests nuevos** en `f3b_format.rs`:
   - cada campo de F6.1 con una versión menor da su error, en el orden del contrato;
   - cada regla de F6.2, F6.3 y F6.4 (requeridos, prohibidos, rangos, exactamente uno de las fuentes de OCR,
     valores por defecto de los accesores, Bishop con `non_circular`);
   - los rechazos de F6.5;
   - ida y vuelta sin pérdida de `serde_json` para cada tipo nuevo, con los campos opcionales presentes y ausentes;
   - mb, s y a contra los valores de X25 §1.2 y §1.3 (p. ej., GSI 20, mi 10, D 1: mb 0,0329851, s 1,6196e-6,
     a 0,543721) y del ejemplo 1 de Hammah (GSI 5, mi 2, D 0: mb 0,067225, s 2,6048e-5, a 0,61921);
   - **tests de stub**: un modelo válido con Hoek-Brown, otro con SHANSEP y otro con `non_circular` llegan a su
     `todo!` (`#[should_panic(expected = "F3B-M-HB")]`, etc.). B1 los reemplaza;
   - un modelo v0.5 cualquiera de `verification/cases`, con `"version"` cambiado a `"0.6"`, da la misma salida.
10. **Identidad contra la v0.4.0** (gate abajo): 0 diferencias.

## Gates

Desde tu worktree, con `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch` y
`export CARGO_TARGET_DIR=$TMPDIR/f3b0m-target`:

```bash
cargo fmt --all --check
cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings
cargo test -p ogs-core --release --no-fail-fast
cargo test -p ogs-core --release --no-fail-fast --features parallel
cargo test -p ogs-core --release --test acceptance -- --nocapture | tail -3   # «<n> checks, 0 failures»
cargo test --workspace --exclude ogs-py --release
cargo build --release -p ogs-cli
env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  --with jsonschema --with pytest python -m pytest -q verification
env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project python \
  verification/tools/identity_vs_baseline.py --normalize-version --include-reinforced \
  --base $TMPDIR/f3b-base/ogs --new $CARGO_TARGET_DIR/release/ogs
```

- `$TMPDIR/f3b-base/ogs` es el binario de la v0.4.0, ya construido. **No lo reemplaces.**
- La identidad tiene que dar **0 diferencias** sin agregar entradas a `identity_exceptions.json`. Si da otra cosa,
  detente y repórtalo con los nombres de los modelos.
- Un gate que no imprime nada es una falla: revisa el código de salida.

## Reglas

- Commits en tu rama, con rutas explícitas (`git add <rutas>`), con la identidad del repo. **Sin push, sin tags, sin
  tocar `main` ni `f3b-integracion`.**
- Si un criterio del contrato no se puede cumplir, o el contrato es ambiguo, **detente y repórtalo** con la cita y la
  evidencia. No inventes una regla.
- No edites `CHANGELOG.md`: propón tus líneas en el informe.
- Prioridad si te quedas sin iteraciones: (1) tipos y validación con sus tests, (2) ganchos y stubs, (3) identidad,
  (4) esquema, (5) CLI.

## Informe final

- commits (hash y mensaje) y archivos tocados;
- la salida resumida de cada gate, con las cifras (tests, checks, diferencias de identidad);
- las firmas públicas nuevas, copiadas del código;
- decisiones que tomaste donde el contrato dejaba margen;
- líneas propuestas para el CHANGELOG.
