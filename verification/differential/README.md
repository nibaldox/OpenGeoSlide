# Batería diferencial ogs vs cSlope (W7b)

Compara el FS de `ogs` (binario CLI) con el oráculo independiente cSlope 0.1.0 (MIT) en catorce modelos
sintéticos de tipo minero y civil: D01-D10 (esquema v0.1) y D11-D14 (esquema v0.2, con sismo y cargas); D15-D23 son los modelos v0.3, D24-D27 los de refuerzos (v0.4) y D28-D39 los de grieta de tracción y agua embalsada (v0.5). Compara motores entre sí: **no contiene valores publicados**.

## Archivos

- `build_cases.py`: genera `cases/D01.ogs.json` … `cases/D14.ogs.json` y `cases_f3/D15.ogs.json` … `cases_f3/D23.ogs.json` (contrato §1, SI, γw = 9.807,
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
  | D13 | talud civil de 10 m, 1,5H:1V, c = 15 kPa, φ = 26° | carga lineal de 100 kN/m en x = 6 m (corona), 15° hacia +x; búsqueda con `min_width = 5 m` |
  | D14 | terraplén de 12 m, 2H:1V, c = 12 kPa, φ = 30° | `kh = 0,1` y piezométrica inclinada |

- `test_differential.py`: pytest. Comprueba que los casos coinciden con el generador, que ogs acepta
  cada modelo (búsqueda y fija, sin `InvalidModel`), que cSlope valida cada documento, y las reglas de
  veredicto E9b.

## Fase 3a: M-P, Janbu, no drenado y polilínea (F3.8)

`run.py` agrega un bloque **después** del de Bishop y Spencer, sin cambiarlo (los 56 checks, su resumen y su tabla son los
de antes):

- **M-P `half_sine` y Janbu corregido** sobre el círculo fijo de cada uno de los 14 modelos, con el criterio de 0,5 % de E9b.
- **Tres modelos v0.3** en `cases_f3/` (aparte de `cases/`, porque los consumidores de `cases/` —las pruebas de Rust y de la web,
  la ida y vuelta y el esquema 0.2— aún no leen la versión 0.3):

  | caso | modelo | superficie y métodos |
  |---|---|---|
  | D15 | terraplén de 6 m sobre 12 m de arcilla blanda con Su lineal (15 kPa en la superficie, +1,5 kPa/m) | círculo: Bishop y Spencer en búsqueda y fija; M-P y Janbu corregido fijos |
  | D16 | depósito de relaves de 15 m, 2,5H:1V, con Su constante de 25 kPa sobre cimentación firme | ídem |
  | D17 | bloque sobre una capa débil delgada que aflora en el talud de 20 m | polilínea fija de tres puntos: Spencer, M-P y Janbu corregido (sin Bishop, F3.6) |

- **Pendiente, no falla.** Antes de correr, el runner sondea cada capacidad (`undrained`, `morgenstern_price`, `janbu_corrected`,
  `polyline`) con un modelo mínimo. Si el motor no la tiene, los checks que la necesitan quedan **pendiente** (con el mensaje
  del motor) y el valor de cSlope igual se calcula como línea base. El código de salida sigue siendo 0.
  Con `--require-f3` sale con código 3 si queda algo pendiente, con fallo o sin dato: úsese al integrar.
- `report.json` gana la clave `f3` (capacidades, resumen y checks); `REPORT.md` gana la sección «Fase 3a».

## F3G: grieta de tracción y agua embalsada, modelos D28 a D39 (v0.5)

Cuarto bloque de `run.py`, después de los tres anteriores y sin cambiarlos. Doce modelos sintéticos en `cases_f3g/`, cada uno en
**búsqueda** y en su **círculo fijo** (el crítico de la búsqueda de cSlope sobre ese mismo modelo, sin redondear), con Bishop y
Spencer y los criterios de E9b (48 checks). Los de agua sin grieta están en versión 0.1: el agua embalsada se aplica en todas
las versiones (D1). Los de grieta, en 0.5.

| caso | modelo | qué cubre |
|---|---|---|
| D28 | ACADS 1(a) con la piezométrica en y = 27 (2 m sobre el pie) | embalse al pie sobre la banqueta |
| D29 | ACADS 1(a), piezométrica en y = 31 | agua que corta el talud en x = 42: cuña sobre la cara y la banqueta |
| D30 | banco de 12 m con la cara vertical en x = 30 y un embalse de 8 m al pie | empuje sobre el paramento vertical (E4); entrada de la búsqueda detrás de la cara |
| D31 | presa homogénea con el embalse a 16 m en la cara de aguas arriba | agua sobre la cara y la banqueta, deslizamiento hacia −x |
| D32 | corte de 20 m, 2H:1V, c = 20, φ = 30° | grieta seca de 3 m |
| D33 | el mismo corte | grieta llena de 4 m (`water_fill` = 1, Pw = 78,5 kN/m) |
| D34 | relleno sobre arcilla, corte de 20 m | grieta automática en dos capas, llena a la mitad |
| D35 | la geometría de D34 con 25 kPa en la corona | grieta automática que resta q/γ |
| D36 | ACADS 1(a) con embalse de 2 m | embalse más grieta de 2 m llena |
| D37 | la presa de D31 | embalse más grieta automática llena en la corona |
| D38 | ACADS 1(a), kh = 0,10 | sismo, embalse y grieta: el sismo no actúa sobre el agua (E7) |
| D39 | arcilla no drenada (Su = 40 kPa), corte de 10 m | grieta automática z = 2·Su/γ (G7) llena |

- **Sonda.** Antes de correr, `probe_f3g` prueba cada capacidad (`ponded_water`, `tension_crack`) con V047a: el embalse de 2 m
  (fila X21-P01, Bishop 0,939017) y una grieta de 2 m llena al 25 % (X21-W025, Bishop 1,023189). Se acepta si Bishop da la cifra
  del oráculo a 0,1 %. Un motor que deja el agua fuera (la base v0.3.0 da 0,848) o que rechaza la versión 0.5 deja los checks que
  necesitan esa capacidad en **pendiente**, nunca en falla; el valor de cSlope se calcula igual y queda como línea base.
- **`--require-f3g`** sale con código 5 si algún check del bloque queda pendiente, con fallo o sin dato: úsese al integrar.
- `report.json` gana la clave `f3g` (capacidades, resumen y checks; `report_version` 5); `REPORT.md` gana la sección «v0.5».
- **Estado con el motor de la base de esta rama** (los stubs de G0): **0 de 48 OK, 48 pendientes** (la sonda del agua da 0,848 y
  la de la grieta ve el pánico `crack.rs`); cSlope resuelve los 48 (convergidos). El resto de la batería no cambia.
- `build_cases.py` escribe también `cases_f3g/`. Los círculos fijos de `FIXED_SURFACES_F3G` salen de la búsqueda de cSlope sobre cada
  modelo (oráculo `analyse` con el conversor de este directorio).

## R10: modelos D18 a D23 (E13l)

La revisión R10 (hallazgos R10A-02, R10A-04 y R10A-11) mostró cinco usos del formato v0.3 que ningún caso ni modelo
cubría. Los seis modelos nuevos están en `cases_f3/` y siguen el mismo plan que D15 a D17 (círculo: Bishop y Spencer en
búsqueda y fija, más M-P y Janbu corregido fijos; polilínea: los métodos de `analysis.methods`, fijos).

| caso | modelo | qué cubre |
|---|---|---|
| D18 | corte de 10 m, 2H:1V, en arcilla con Su = 70 kPa en la cota 10, gradiente de −2 kPa/m y piso de 25 kPa | `strength_gradient < 0` con `strength_limit`; el círculo fijo baja de la cota −12,5, donde empieza el piso (FS 1,207 con piso y 1,189 sin él) |
| D19 | talud de 20 m, 1,5H:1V, relleno sobre arcilla (arista a 6 m) | M-P con `clipped_sine` |
| D20 | la misma geometría de D19 | M-P con `trapezoidal` |
| D21 | corte de 20 m, 1:1, estrato fuerte sobre estrato débil, techo del débil en y = 10 m | polilínea de tres puntos cuyo tramo central corre sobre el contacto (E13l-5) |
| D22 | terreno horizontal (y = 10), Su = 50 kPa, polilínea simétrica de 5 m de profundidad, `kh = 0,3` | E3 en polilíneas (E13l-2): la única fuerza motriz es la inercia horizontal |
| D23 | igual que D22 con una carga lineal horizontal de 200 kN/m en lugar del sismo | E13l-2 con carga; solo Janbu, porque cSlope no converge en Spencer y su M-P da cuatro veces el de D22 |

**Estado sobre la base `420baf0` (antes de M1 y M2).** D18, D19 y D20 coinciden con cSlope (|Δ| ≤ 0,16 % en
superficie fija; la búsqueda de D18 da +0,56 %, dentro del 1 % de E9b). D21, D22 y D23 **fallan hasta que entren
E13l-2 y E13l-5**: en D21 ogs toma el material de arriba y da +85,6 % (Janbu) a +159,7 % (Spencer) sobre cSlope; en D22
y D23 ogs responde `invalid` con `no_driving` en los seis checks mientras cSlope da 3,333 (Janbu simplificado de D22) y
7,500 (Janbu simplificado de D23). El motor no se corrige aquí.

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
export TMPDIR="$(mktemp -d)"
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

- Tras F1-E: búsqueda **OK 28/28** y superficie fija **OK 28/28** (D13 con `min_width = 5 m`, ver más abajo).
  D01-D10 conservan sus valores de la línea base de W9.

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
- **Decisión (F1-E): D13 fija `analysis.search.min_width = 5.0`** (en ogs y en cSlope, mismo valor). Práctica: se exige
  un ancho mínimo de masa para excluir fallas superficiales locales bajo una carga puntual o lineal; el FS de esas
  superficies depende de m_α con carga lineal y no es un resultado fiable en ninguno de los dos motores. No es un
  ajuste de tolerancia: es una convención de la búsqueda, y la capacidad de soporte local se revisa aparte.
  Valores de D13:

  | | antes (`min_width` nulo) | después (`min_width = 5`) |
  |---|---|---|
  | Bishop, búsqueda | ogs 1,4599 · cSlope 0,6141 · +137,72 % · FALLA | ogs 1,4599 · cSlope 1,4595 · +0,03 % · OK |
  | Spencer, búsqueda | ogs 1,4504 · cSlope 0,4989 (no convergido) · FALLA | ogs 1,4504 · cSlope 1,4499 · +0,04 % · OK |
  | fija (Bishop / Spencer) | −0,21 % / −0,21 % · OK | −0,21 % / −0,21 % · OK |

- El aviso `multiple_admissible_roots` (E12e) es informativo en la batería, igual que en la aceptación
  (`OGS_INFORMATIVE_WARNINGS` en `run.py`): no aparece en la columna de avisos.

## v0.4: refuerzos, modelos D24 a D27 (F4.12)

`run.py` agrega un tercer bloque, después del de la Fase 3a y sin cambiarlo, con los cuatro modelos de `cases_f3r/` (aparte de
`cases/` y de `cases_f3/` por la misma razón: los consumidores de esos directorios aún no leen la versión 0.4). Cada modelo
lleva un círculo fijo que cruza los refuerzos, y se corre con Bishop, Morgenstern-Price (`half_sine`) y Janbu corregido, con el
criterio de 0,5 % de E9b, **12 checks**. No hay búsqueda: las fuerzas dependen de la superficie.

| caso | modelo | refuerzos | fuerzas del oráculo en el círculo |
|---|---|---|---|
| D24 | corte de 10 m, cara 5:1, c = 3 kPa, φ = 26° | cuatro hileras de clavos pasivos (`nail`, `axial`, `bond` 40 kN/m, T = 150 kN, spacing 1,5 m) | tres: el clavo de y = 8 queda corto |
| D25 | muro TEM de 8 m, relleno c = 3 kPa, φ = 34° sobre cimentación firme | ocho capas de geosintético pasivas, `axial` y `tangent` alternadas; cinco con `development` y tres con `interface` | cinco; la de y = 4,5 cruza casi en la punta |
| D26 | tablestaca anclada: excavación de 6 m, suelo c = 0, φ = 10°, sentido −x | `sheet_pile` pasiva de 120 kN/m y `anchor` activo de 120 kN/m (cruzado en su tramo libre: manda `end1_capacity`) | dos |
| D27 | talud de 10 m, 2H:1V, c = 4 kPa, φ = 20° | fila de pilotes (`pile` pasivo, `angle` 10°, 600 kN por pilote cada 2 m) | una |

- **Sonda de capacidad.** Antes de correr, `probe_f3r` ejecuta V047a con el círculo fijo y el anclaje horizontal de las filas 1 (activo)
  y 2 (pasivo) de F4.13, con Bishop, y exige la cifra del oráculo a 0,1 % (1,333661 y 1,248405). Un motor que no tiene las fuerzas
  (el stub de R0), o cuyos métodos no tienen aún los términos pasivos divididos por F, deja los checks que los necesitan
  **pendiente**, con el mensaje del motor o con el valor que dio; el valor de cSlope se calcula igual. El código de salida sigue en 0.
  Con `--require-f3r` sale con código 4 si algún check de v0.4 queda pendiente, con fallo o sin dato: úsese al integrar.
- `report.json` gana la clave `f3r` (capacidades, resumen y checks) y `REPORT.md` la sección «v0.4: refuerzos»; `report_version` pasa a 4.
- El oráculo instalado descarta los activos con `along > 0`, que ogs aplica (E14m-1): los modelos solo usan cruces con `along < 0`.
  La interface de D25 se integra exacta en ogs y en 200 pasos en cSlope (hasta 0,5 % en T, X17 §2.1).
- La comparación de las fuerzas cruce por cruce con las del oráculo (`report.reinforcement_forces`) está en el harness: `verification/harness/forces.py` y la sección «Comparación por cruce» de `verification/REPORT.md` (F3R-R2, 25 casos).

