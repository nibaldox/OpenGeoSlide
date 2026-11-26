# Pilotes de Ito-Matsui (lote F3I, formato v0.5): V013b a V013e

Generado por `verification/tools/import_cslope.py`. No editar a mano.
Fuente: cSlope (MIT License, Copyright (c) 2026 Zilan Ciftci), https://github.com/ZilanCiftci/cslope.

**4** casos con **4** checks de búsqueda de Bishop, en v0.5 con `lateral_pressure` (E15i-1). Esperan al motor de E15i (G3): hoy los excluye de `cases/` el motivo «Ito-Matsui» (el pilote no lleva `force`). Cada caso es el de `verification/cases/` de cSlope más el pilote: `lateral_pressure {model: "ito_matsui", diameter: 0.8, location: "centroid"}`, `application: passive` (la fuente), `direction: angle` con `angle: 0` (horizontal: perpendicular a un pilote vertical, E15i-6; cSlope toma `angle` 0 si la fuente no trae `direction`) y `location` `centroid` (el valor por defecto de cSlope, el de Cai y Ugai 2000, ecuación 9). Sin `capacity`: la fuente no trae capacidades. No se relaja ninguna tolerancia ni se toca ningún dato del problema.

La columna del oráculo sale de `harness/run.py --oracle-only` sobre este directorio (`report.json`, `REPORT.md`); la de ogs queda vacía hasta que el motor de E15i exista. El oráculo da entre +0,05 % y +0,50 % sobre el publicado (X22 §5.1).

| caso | D1/D | método | publicado | por | tol % | ogs | Δ ogs % | cSlope | Δ cSlope % |
|---|---:|---|---:|---|---:|---:|---:|---:|---:|
| V013b | 2 | bishop | 1.54 | Commercial program A | 2.32 | — | — | 1.5408 | +0.05 |
| V013c | 3 | bishop | 1.43 | Commercial program A | 2.35 | — | — | 1.4371 | +0.49 |
| V013d | 4 | bishop | 1.33 | Commercial program A | 2.38 | — | — | 1.3314 | +0.11 |
| V013e | 6 | bishop | 1.25 | Commercial program A | 2.40 | — | — | 1.2528 | +0.22 |

## Promoción a `verification/cases/` (la hace el integrador)

Cuando el motor de E15i está integrado (`ogs analyze` acepta `lateral_pressure` y el esquema 0.5 lo trae), desde la raíz del worktree:

```
export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch
cargo build --release -p ogs-cli
env -u PYTHONPATH -u PYTHONHOME uv run --python 3.13 --no-project --with shapely --with jsonschema python verification/tools/import_cslope.py --src $TMPDIR/cslope-src --promote-f3i
env -u PYTHONPATH -u PYTHONHOME uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely python verification/harness/run.py --cases verification/cases --ogs target/release/ogs --out verification
env -u PYTHONPATH -u PYTHONHOME uv run --python 3.13 --no-project --with shapely --with jsonschema python verification/tools/import_cslope.py --src $TMPDIR/cslope-src --promote-f3i
sed -i 's/^F3I_PROMOTED = False/F3I_PROMOTED = True/' verification/tools/import_cslope.py
```

La primera orden escribe los 4 casos en `verification/cases/` (y vacía este directorio); la segunda regenera `verification/report.json` y `REPORT.md` con el motor real; la tercera arma el `INDEX.md` de `cases/` con las cifras (sección «Pilotes de Ito-Matsui»); la cuarta deja la promoción como comportamiento por defecto del importador, para que una ejecución sin la opción no los borre. Después: `verification/cases` pasa de 147 a 151 casos y de 323 a 327 checks (la aceptación de Rust cuenta los checks por el directorio), y el informe de cSlope da 326 de 327 si el oráculo los reproduce (322 de 323 hoy).
