# Batería diferencial ogs vs cSlope (W7b)

Compara el FS de `ogs` (binario CLI) con el oráculo independiente cSlope 0.1.0 (MIT) en catorce modelos
sintéticos de tipo minero y civil: D01-D10 (esquema v0.1) y D11-D14 (esquema v0.2, con sismo y cargas). Compara motores entre sí: **no contiene valores publicados**.

## Archivos

- `build_cases.py`: genera `cases/D01.ogs.json` … `cases/D14.ogs.json` (contrato §1, SI, γw = 9.807,
  50 dovelas, búsqueda por defecto o con rangos explícitos, y una superficie fija representativa).
  Cada modelo lleva su intención en `meta.notes` y un comentario en el código.
- `run.py`: para cada caso y método (bishop, spencer) compara búsqueda y superficie fija. Escribe
  `REPORT.md` y `report.json`. Reutiliza `harness/to_cslope.py` (conversor) y las funciones
  `run_ogs` / `run_cslope` de `harness/run.py` sin copiarlas ni modificarlas.
- Casos con sismo y cargas (`version: "0.2"`, F1.1):

  | caso | modelo | sismo y cargas |
  |---|---|---|
  | D11 | rajo de 3 bancos (geometría de D04), c = 40 kPa, φ = 32° | `kh = 0,15` |
  | D12 | botadero de 25 m, c = 2 kPa, φ = 35° | `udl` de 50 kPa en la corona (x de 0 a 10 m), `kv = −0,05` |
  | D13 | talud civil de 10 m, 1,5H:1V, c = 15 kPa, φ = 26° | carga lineal de 100 kN/m en x = 6 m (corona), 15° hacia +x |
  | D14 | terraplén de 12 m, 2H:1V, c = 12 kPa, φ = 30° | `kh = 0,1` y piezométrica inclinada |

- `test_differential.py`: pytest. Comprueba que los casos coinciden con el generador, que ogs acepta
  cada modelo (búsqueda y fija, sin `InvalidModel`), que cSlope valida cada documento, y las reglas de
  veredicto E9b.

## Criterio (E9b, briefs/00_CONTRATOS.md §4.4.6)

- **Búsqueda**: `FS_ogs ≤ FS_cSlope · 1,01`, mismo método, dovelas y rangos. Un FS menor de ogs es
  más exhaustivo y se acepta.
- **Superficie fija**: `|FS_ogs − FS_cSlope| / FS_cSlope ≤ 0,5 %`.
- Un método de ogs que no converge (`status` distinto de `converged`) es **FALLA**, aunque devuelva un número.
- Un error de ejecución del motor, de conversión o de validación de cSlope es **sin dato**, no aprobado.
- **cSlope sin solución (X6)**: un `EngineError` o un resultado con `criticalSurface.converged: false` (el `minFOS` es
  el par Fm/Ff más cercano, no una raíz; p. ej. R3-01b: 0,0830 no convergido frente a la raíz real 0,2685) es un
  **oráculo sin solución**: nunca es valor de referencia. Con ogs también sin solución, en superficie fija, es
  concordancia; si solo uno de los dos no tiene solución, es **FALLA**.
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
  círculo deja de cortar el terreno dos veces: ogs da `NoValidSurface` y cSlope `EngineError`. En D11-D14 la superficie fija es el crítico de la búsqueda Bishop de ogs con
  sismo y cargas, también sin redondear. D09 es el
  círculo citado en el brief W7.
- **γw = 9,807** en todos los modelos, porque cSlope 0.1.0 ignora `waterUnitWeight`.
- La regla `auto` de sentido se ejercita en tres ramas: rangos de búsqueda (D08, búsqueda), coronamiento
  (D09) y círculo fijo (D08, superficie fija).

## Línea base (ver `REPORT.md`)

- Tras B2 (D11-D14): ver el resumen de `REPORT.md` y el hallazgo de D13 más abajo. D01-D10 conservan sus
  valores de la línea base de W9.

- Tras W9: búsqueda OK 20/20, fija OK 20/20 (incluida 1 concordancia «ambos sin solución»).
- D03 spencer en superficie fija: ogs devuelve `not_converged` (sin FS finito) y cSlope rechaza la superficie
  («entrada a 90°»: la dovela del pie necesita tracción). Ambos motores declaran el círculo sin solución: concordancia.
- Diagnóstico manual, fuera de la batería: la superficie crítica de cSlope para D03 spencer (r ≈ 4,1
  en el pie) da en ogs un FS fijo de 0,5572 (+1,9 % frente a cSlope). En la búsqueda, ogs da para D03 spencer
  0,5497 frente a 0,5467 de cSlope (+0,56 %), dentro del criterio. Ese círculo concreto sigue sin comparación fiable.

## Hallazgo de D13 (carga lineal): búsqueda de cSlope sobre un círculo degenerado

En la superficie fija, D13 concuerda (Bishop −0,21 %, Spencer −0,21 %). En la búsqueda, cSlope no converge al mismo
mínimo que ogs, y por eso D13 queda **FALLA** en Bishop y en Spencer (en Spencer, cSlope devuelve `converged: false`, un oráculo sin solución, mientras ogs converge a 1,4504). Diagnóstico
con la receta de la batería (el crítico del oráculo como superficie fija en ogs); script en la sesión B2, valores
reales:

| | círculo crítico de cSlope | ogs en ese círculo fijo | cSlope en ese círculo |
|---|---|---|---|
| Bishop | centro (6,336; 10,306), r = 0,455, entrada x = 5,9999, salida x = 6,672 (ancho 0,67 m) | `invalid` (`m_alpha`) con `min_m_alpha = 0,2`; **0,6083** con `min_m_alpha = 0,05`, 0,01 o 1e-4 | **0,6141** |
| Spencer | r = 0,382, entrada x = 5,999, salida x = 6,525 | `not_converged` (`no_lambda_root`) con 0,2 y 0,05; **0,6093** con 0,01 y 1e-4 | 0,4989, `not_converged` |

- El mínimo de cSlope (FS 0,6141 Bishop, 0,4989 Spencer) es un **círculo diminuto en la corona**, justo bajo la carga
  lineal de x = 6 m: una masa de 0,67 m de ancho que recibe 100 kN/m. cSlope lo acepta (avisa `low-m-alpha`: «el FS puede
  no ser fiable»); ogs lo rechaza por la regla de validez `min_m_alpha = 0,2` (contrato §4.2).
- Con la regla relajada, ogs reproduce a cSlope en esa superficie: 0,6083 frente a 0,6141 (−0,95 %) en Bishop. Las
  ecuaciones con carga lineal concuerdan; la diferencia está en qué superficies admite cada motor, no en el cálculo.
- Si la búsqueda excluye esas superficies (`search.min_width` de 5 m o 10 m en los dos motores; no es la configuración
  de la batería), cSlope converge al mismo mínimo que ogs: Bishop 1,4595 frente a 1,4599 (+0,03 %) y Spencer 1,4499
  frente a 1,4504 (+0,03 %). Con `min_width = 2 m` cSlope sigue en círculos de 2 m bajo la carga (1,0010 y 1,0407).
- El caso se conserva tal cual, con su veredicto.
