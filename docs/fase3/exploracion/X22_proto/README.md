# Prototipo X22: fuerza de pilote de Ito-Matsui sobre las dovelas del motor

Solo biblioteca estándar (salvo `oracle.py`, `circles.py`, `run_oracle.py`, `q_variantes.py`, que necesitan `cslope` y `shapely` del venv del oráculo).
No modifica el motor ni la web: usa `target/release/ogs analyze` (el binario del árbol principal, `ogs 0.3.0`, acepta `reinforcements` v0.4) para obtener las dovelas
de la superficie fija con dos nodos en `x_p ± 1e-6·ancho` (E14d.2), y les agrega las fuerzas del pilote con las convenciones de E14f (activa) y E14g (pasiva, ÷ F).

```
export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch ; mkdir -p $TMPDIR/x22
cd docs/fase3/exploracion/X22_proto
PY="env -u PYTHONPATH -u PYTHONHOME python3" ; OR="env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python"
python3 im.py 2.4 0.8 20             # coeficientes A1, A2: forma del artículo (ecs. 13/14/23) y forma de cSlope
$OR circles.py                       # círculos críticos de cSlope en V013a-e -> circles.json (ya incluido)
python3 rows.py                      # escribe ../X22_filas/X22-*.json (28 filas)
python3 run_proto.py                 # prototipo -> $TMPDIR/x22/results_proto_0.05.json   (run_proto.py 0.002: paso fino)
$OR run_oracle.py                    # cSlope -> $TMPDIR/x22/results_oracle.json
python3 report.py                    # une y escribe ../X22_filas/resultados.json (6 decimales) + criterios
python3 render_tables.py             # tablas de X22.md
$OR q_variantes.py                   # búsqueda Bishop V013b-e con application x direction x location (-> variantes_busqueda_oraculo.json)
python3 t_validate.py                # prototipo con `force` dada contra el motor (neutralidad de los términos activos y pasivos)
```

Archivos:
- `im.py`: `coeffs_paper` (ecs. 13, 14 y 23 del artículo, notación D1/D2), `coeffs` (con el piso de φ = 0 de cSlope) y `cslope_form` (R, E, F de cSlope).
- `pile.py`: columna de suelo (γ, γsat, u, ru, capas por polígonos de región), perfil `z, F(z), Q(z)` con rejilla de 0,05 m, fuerza y brazo de la resultante en el cruce.
- `solvers.py`: Bishop, Janbu simplificado y corregido, Spencer = M-P `constant`, con términos activos (`V, H, Mb, Dx`) y pasivos (`pV, pH, pMb, pDx`, ÷ F en cada evaluación);
  Bishop con respaldo por bisección. Sin pasivos es el `solvers.py` de X21.
- `equilibrium.py`: equilibrio global independiente (fuerzas y momentos con cada fuerza en su punto; las pasivas ÷ F).
- `proto.py`: validación de la propuesta v0.5 (`validate_pile`), cruce, fuerza (`location`, `direction`, `capacity`), ensamble en las dovelas, resolución.
- `engine.py`: lanza `ogs analyze` (copia de X21 con modelo limpio sin pilotes de presión).
- `oracle.py`: arma el documento de cSlope con `verification/harness/to_cslope.py` y le agrega a mano los pilotes de Ito-Matsui (`diameter`, sin `force`, `location`, capacidades).
- `rows.py`: definición de las 28 filas; `report.py`, `render_tables.py`: salida.

Formato de las filas: documentos ogs v0.4 con una propuesta v0.5 en `reinforcements[].lateral_pressure` y `capacity` (ver `X22.md` §6).
