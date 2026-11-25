# Batería diferencial ogs vs cSlope (W7b)

Compara el FS de `ogs` (binario CLI) con el oráculo independiente cSlope 0.1.0 (MIT) en diez modelos
sintéticos de tipo minero y civil. Compara motores entre sí: **no contiene valores publicados**.

## Archivos

- `build_cases.py`: genera `cases/D01.ogs.json` … `cases/D10.ogs.json` (contrato §1, SI, γw = 9.807,
  50 dovelas, búsqueda por defecto o con rangos explícitos, y una superficie fija representativa).
  Cada modelo lleva su intención en `meta.notes` y un comentario en el código.
- `run.py`: para cada caso y método (bishop, spencer) compara búsqueda y superficie fija. Escribe
  `REPORT.md` y `report.json`. Reutiliza `harness/to_cslope.py` (conversor) y las funciones
  `run_ogs` / `run_cslope` de `harness/run.py` sin copiarlas ni modificarlas.
- `test_differential.py`: pytest. Comprueba que los casos coinciden con el generador, que ogs acepta
  cada modelo (búsqueda y fija, sin `InvalidModel`), que cSlope valida cada documento, y las reglas de
  veredicto E9b.

## Criterio (E9b, briefs/00_CONTRATOS.md §4.4.6)

- **Búsqueda**: `FS_ogs ≤ FS_cSlope · 1,01`, mismo método, dovelas y rangos. Un FS menor de ogs es
  más exhaustivo y se acepta.
- **Superficie fija**: `|FS_ogs − FS_cSlope| / FS_cSlope ≤ 0,5 %`.
- Un método de ogs que no converge (`status` distinto de `converged`) es **FALLA**, aunque devuelva un número.
- Un error de motor o un FS de cSlope no convergido es **sin dato**, no aprobado.
- **Concordancia (W9)**: en la superficie fija, si ogs declara el método sin solución (`not_converged` o
  `invalid`) **y** cSlope también (`EngineError`, «no valid slip surface»), el veredicto es
  `OK (concordancia: ambos sin solución)`. Cuenta como acierto en el resumen y se desglosa aparte.
  Si solo uno de los dos motores declara sin solución, es **FALLA**. Un error de ejecución de ogs nunca
  cuenta como declaración: sigue siendo sin dato. La regla no se aplica a la búsqueda.
- El veredicto no detiene la batería: sale con código 0 si puede ejecutarse.

## Ejecución

Desde la raíz del worktree, tras `cargo build --release -p ogs-cli`:

```
export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch
uv run --python 3.13 --no-project --with shapely python verification/differential/build_cases.py
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely \
  python verification/differential/run.py [--ogs PATH] [--cases DIR] [--out DIR]
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with pytest \
  python -m pytest verification/differential -q
```

`--ogs` por defecto es `$OGS_BIN` o `target/release/ogs` de este worktree (relativo al archivo). Los tests
fallan (no se saltan) si el binario no existe.

## Decisiones de diseño

- **Superficies fijas sin redondear.** Son el crítico de la búsqueda por defecto de ogs (main). Ese
  círculo pasa por el vértice del pie por construcción. Con 4 decimales el arco sale del vértice y el
  círculo deja de cortar el terreno dos veces: ogs da `NoValidSurface` y cSlope `EngineError`. D09 es el
  círculo citado en el brief W7.
- **γw = 9,807** en todos los modelos, porque cSlope 0.1.0 ignora `waterUnitWeight`.
- La regla `auto` de sentido se ejercita en tres ramas: rangos de búsqueda (D08, búsqueda), coronamiento
  (D09) y círculo fijo (D08, superficie fija).

## Línea base (ver `REPORT.md`)

- Tras W9: búsqueda OK 20/20, fija OK 20/20 (incluida 1 concordancia «ambos sin solución»).
- D03 spencer en superficie fija: ogs devuelve `not_converged` (sin FS finito) y cSlope rechaza la superficie
  («entrada a 90°»: la dovela del pie necesita tracción). Ambos motores declaran el círculo sin solución: concordancia.
- Diagnóstico manual, fuera de la batería: la superficie crítica de cSlope para D03 spencer (r ≈ 4,1
  en el pie) da en ogs un FS fijo de 0,5572 (+1,9 % frente a cSlope). En la búsqueda, ogs da para D03 spencer
  0,5497 frente a 0,5467 de cSlope (+0,56 %), dentro del criterio. Ese círculo concreto sigue sin comparación fiable.
