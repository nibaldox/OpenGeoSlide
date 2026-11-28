# xslope como columna informativa

Tercera columna del harness: el valor publicado, ogs y [xslope](https://github.com/njones61/xslope) 1.1.0 (Apache-2.0)
sobre los mismos checks. **No es un juez.** Los criterios de aceptación siguen siendo el publicado y ogs; xslope es una
segunda opinión independiente, en otro motor y con otro rebanado.

- `verification/harness/to_xslope.py`: convierte el `model` de un caso al diccionario de entrada de xslope y corre un
  check (`convert`, `solve`, `run_xslope`). Lo que no convierte levanta `Unsupported(<rasgo>)`.
- `run.py`: corre todos los checks de `verification/cases`, escribe `REPORT.md` y `REPORT.json` aquí.
- `test_to_xslope.py`: un test por regla de conversión, uno de `Unsupported`, uno de punta a punta con V044.

```bash
# informe (xslope==1.1.0 exacto; con otra versión sale con un error)
env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with xslope==1.1.0 \
  python verification/xslope/run.py --ogs target/release/ogs

# pruebas
env -u PYTHONPATH -u PYTHONHOME uv run -q --python 3.13 --no-project --with xslope==1.1.0 --with pytest \
  python -m pytest -q verification/xslope
```

## Qué se convierte

Solo `bishop` y `spencer`, con superficie fija (círculo o polilínea) o búsqueda circular con ventanas, materiales
`mohr_coulomb` y `undrained`, agua piezométrica, `ru` y `unit_weight_sat`. La tabla de reglas está en el docstring de
`to_xslope.py`. Lo demás (Morgenstern-Price, Janbu, búsqueda no circular, Hoek-Brown, `strength_limit`, cargas, sismo,
grieta, refuerzos) se cuenta en el informe por rasgo y no se corre.

Reglas que no son evidentes:

- **Agua embalsada.** Con una piezométrica se fija `water_loads = 'auto'`: solo así xslope carga el terreno con el peso y
  el empuje del agua donde la línea queda sobre él (en `'manual'` la ignora: de −7 % a −18 % en V089, V091 y V092).
- **`undrained` con gradiente.** ogs: `Su = max(0, Su0 + (datum − y)·g)`. xslope (`cp`): `Su = c + max(0, r_elev − y)·cp`.
  Coinciden solo con `y ≤ datum` y `g ≥ 0`, así que se convierte únicamente si ninguna base puede quedar sobre el datum
  (en búsqueda, si el material no llega sobre él dentro de la ventana). Si no, `Unsupported`.
- **`undrained` con Su = 0.** xslope rechaza `cp` sin resistencia en el preflight; se escribe como `mc` con `c = φ = 0`.
- **Parche del preflight.** `circular_search` exige un círculo de partida (`surface.none_defined`) aunque se pida la
  semilla de rejilla. `surface_supplied_preflight()` marca la superficie como suministrada solo durante la búsqueda;
  depende de un nombre interno de xslope y hay que volver a probarla con cada versión.

## Veredictos

- **Superficie fija:** `concordancia` si |xslope − ogs| / ogs ≤ 0,5 %, si no `discrepancia`.
- **Búsqueda:** solo `diagnóstico`. Cada motor halla su superficie; para las filas que difieren más de 0,5 % se evalúa
  cada motor, como superficie fija, sobre el círculo crítico del otro.
- `REPORT.json` es determinista: dos corridas dan el mismo archivo salvo `generated_at`.
