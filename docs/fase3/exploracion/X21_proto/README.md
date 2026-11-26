# Prototipo X21: grieta de tracción y agua embalsada sobre las dovelas del motor

Solo biblioteca estándar (salvo `oracle.py`, `from_cslope.py`, `build_corpus_rows.py` y los `q*.py` marcados, que necesitan `cslope` y
`shapely` del venv del oráculo). No modifica el motor ni la web: usa `target/release/ogs analyze` (v0.3.0) para obtener las dovelas.

```
export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch ; mkdir -p $TMPDIR/f3g-x21/rows
cd docs/fase3/exploracion/X21_proto
PY="env -u PYTHONPATH -u PYTHONHOME python3" ; OR="env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python"
$PY run_rows.py                       # escribe rows/X21-{P,D,A,C,W,N}*.json (filas propias) y results_proto.json
$OR build_corpus_rows.py              # filas X21-CP-* desde el corpus de cSlope (shapely)
$OR q4_search.py                      # filas X21-S-* con el círculo crítico del oráculo
$OR make_report.py oracle             # cSlope sobre todas las filas -> results_oracle.json
$PY make_report.py proto              # prototipo + diferencias; copia las filas a ../X21_filas/ y escribe resultados.json
$PY summarize.py ; $PY render_tables.py     # resúmenes y la tabla de X21.md
$OR q3_depth.py ; $OR q5_monotonia.py ; $OR q7_ru.py ; $OR q9_reinforcement.py ; $PY q1_block.py   # preguntas 1, 3, 5, 6, 7 y 9
```

Archivos: `geometry.py` (terreno, piezométrica, superficie, grieta, Rankine), `engine.py` (lanza `ogs`, quita los campos X21), `terms.py`
(términos por dovela: agua embalsada, paramento vertical, agua en la grieta), `solvers.py` (Bishop, Janbu simplificado y corregido, Spencer = M-P
`constant`, reescritos de `methods/*.rs`), `equilibrium.py` (equilibrio global independiente), `proto.py` (el flujo), `oracle.py` (arma el
documento de cSlope con `to_cslope.ogs_to_cslope` y añade `tensionCrack*` y `freeWater`), `rows_def.py` (filas propias).
Las filas son documentos ogs v0.4 con dos campos propuestos para v0.5: `analysis.tension_crack = {depth, water}` y `water.free_water`.
