# Brief F3B-XP: prototipos de Hoek-Brown, búsqueda no circular y SHANSEP contra el oráculo

Responde en **español neutro, sin voseo**.

## Contexto

- **Bloque F3B** de OpenGeoSlide: plan en `docs/fase3/PLAN_FASE3B.md`. La exploración ya está hecha:
  - `docs/fase3/exploracion/X23.md`: casos y oráculo;
  - `X24.md`: búsqueda no circular (§6, la propuesta de algoritmo y los criterios A1 a A9);
  - `X25.md`: Hoek-Brown (§1, ecuaciones; §2.3, la iteración de cSlope; §3.4, σ′n ≤ 0);
  - `X26.md`: SHANSEP (§5, el subconjunto recomendado);
  - `X27.md`: motor, formato y web (§1.4, el lazo exterior recomendado; §1.5, dónde entra σ′v).
- **Método a seguir:** los prototipos X21 y X22 trabajaron **sobre las dovelas del motor**. Sus herramientas sirven y
  se pueden copiar a tu carpeta:
  - `docs/fase3/exploracion/X21_proto/`: `engine.py` (lanza `ogs analyze` y lee las dovelas), `solvers.py` (los cinco
    métodos en Python), `oracle.py`, `equilibrium.py`, `proto.py` y `rows_def.py`;
  - `docs/fase3/exploracion/X22_proto/`.
- **Nota del coordinador sobre X23.** X23 informa que `waterTable` no cambia el FS en el oráculo. Lo más probable es un
  error de conversión: el material tiene que apuntar a la línea de agua. **Convierte siempre los modelos al oráculo con
  `verification/harness/to_cslope.py`**, que la batería diferencial usa desde la Fase 3 con piezométrica. Si la anomalía
  persiste con el conversor, mídela y repórtala.
- **Nota del coordinador sobre SHANSEP.** X23 da V105a por bloqueado porque necesita agua embalsada. **El motor tiene
  agua embalsada automática desde la v0.4.0.** X30 debe comprobar si V105a entra.

## Campos provisionales del formato v0.6

Escribe las filas de aceptación con estos nombres. El contrato los va a congelar así; si encuentras una razón para
cambiar alguno, dila con evidencia.

```json
{ "id": "roca", "model": "hoek_brown", "unit_weight": 26.0, "ucs": 30000.0, "gsi": 50.0, "mi": 10.0, "disturbance": 0.7 }
```

- `ucs` es σci en la unidad de esfuerzo del modelo (kPa en SI). `disturbance` es D, **obligatorio**, sin valor por
  defecto. `unit_weight_sat` y `ru` se permiten como en Mohr-Coulomb.

```json
{ "id": "arcilla", "model": "shansep", "unit_weight": 18.0,
  "shansep": { "ratio": 0.25, "exponent": 0.8, "pop": 30.0 } }
```

- `exponent` es opcional, con 0,8 por defecto. Exactamente uno de `ocr` (número ≥ 1), `pop` (≥ 0) u
  `ocr_by_elevation` (tabla `[[y, OCR], …]`, con y creciente).

```json
"search": { "type": "circular_entry_exit", "non_circular": { "seeds": 3, "max_vertices": 33 } }
```

- Los dos campos de `non_circular` son opcionales, con 3 y 33 por defecto. Con `non_circular`, Bishop no se ofrece.
- Todo modelo con un campo nuevo lleva `"version": "0.6"`.

## Reglas comunes

- **Solo lectura del repo**, salvo tu carpeta. Escribes:
  - un archivo de hallazgos, `docs/fase3/exploracion/X<n>.md`;
  - tus scripts en `docs/fase3/exploracion/X<n>_proto/`;
  - tus filas de aceptación en `docs/fase3/exploracion/X<n>_filas/`.

  Todo en `/home/xodla/archivos/opengeoslide`, rama `main`. Escribe el `.md` **temprano** y refínalo. **No commitees.**
- **Instrumentación pesada** en `$TMPDIR/f3b-x<n>/`, con
  `export TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. **No compiles en el checkout principal**:
  usa `target/release/ogs` (0.4.0).
- Python siempre con `env -u PYTHONPATH -u PYTHONHOME`. Oráculo: `$TMPDIR/oracle-venv/bin/python` (cslope 0.1.0; en
  Hoek-Brown σci va en `ucs`, en kPa). Clon de cSlope: `$TMPDIR/cslope-src` (`0f07e7a`); se lee y se cita, no se copia.
- **Cada afirmación lleva su marca** `[verificado]` (comando y salida) o `[inferido]`. **Nada de cifras inventadas.**
- **Cada fila de aceptación** es un archivo JSON con:
  - `id`, `descripcion` y `grupo`;
  - `model`: el modelo completo en el formato v0.6 provisional, con superficie fija o búsqueda;
  - `oracle`: la cifra del oráculo por método, con 6 decimales, y su configuración (el documento del oráculo o el
    comando);
  - `proto`: la cifra de tu prototipo por método;
  - `tolerancia`: la relativa que propones para el test;
  - `nota`, si hace falta.

  Agrega un `resultados.json` con la tabla de todas las filas.
- **Presupuesto:** unas 80 iteraciones. Escribe primero las filas que deciden el contrato.
- **Cierre:** tu respuesta final resume en 15 líneas o menos las convenciones que el contrato debe congelar, con sus
  cifras, y las rutas de tus archivos.

## X28: Hoek-Brown sobre las dovelas del motor

Prototipo del lazo exterior de X27 §1.4: el motor da las dovelas con un material Mohr-Coulomb de reemplazo con el mismo
γ; tu código reescribe c y tanφ de cada dovela de roca y vuelve a resolver.

1. **Punto fijo contra el oráculo.** Con el esquema de cSlope (X25 §2.3: σ′n₀ = γ·(y_terreno − y_base)·cos²α,
   30 pasadas, tolerancia relativa 1e-4 en F, promedio de c y tanφ con la pasada anterior), reproduce el oráculo a
   ≤ 0,1 % en círculo fijo, en los cinco métodos (Bishop, Spencer, M-P `constant`, Janbu simplificado y corregido). Usa:
   - el modelo de X25 §4.1;
   - el ejemplo 1 de Hammah (X23 y X25 §6), con sus supuestos explícitos;
   - los sintéticos SA y SB de X23 §4.
2. **Convergencia:**
   - pasadas necesarias con tolerancia 1e-4, 1e-6 y 1e-8;
   - si el F convergido depende del estado inicial o del promedio (sin promedio, con 0,5, con otro factor);
   - si hay ciclos;
   - recomienda tolerancia, máximo de pasadas y promedio, con números.
3. **σ′n ≤ sn(σ3 = 0).** La regla de cSlope es la tangente en σ3 = 0 (X25 §3.4). Compárala, en un caso con dovelas de
   la cresta en tracción, con dos alternativas: c = 0 con φ de la tangente en σ3 = 0, y el corte en σt = −s·σci/mb.
   Da el FS de cada regla y su diferencia con el oráculo. Recomienda la regla con el criterio de conservadurismo del
   proyecto: ante la duda, la que no sobreestima el FS, siempre que el oráculo la pueda confirmar o la diferencia quede
   declarada.
4. **N′ de cada método.** Qué N′ entra en σ′n = N′/l en cada método (Bishop con su F; Spencer y M-P con F y λ; Janbu
   con F₀), y si así coincide con el oráculo.
5. **Agua:** con piezométrica y con `ru`. Convierte con `to_cslope.py` (nota del coordinador).
6. **Identidades:**
   - con a = 0,5, s = 1 y mb = mi (GSI 100 y D 0), el criterio de Hoek-Brown original;
   - si todas las dovelas tienen la misma σ′n, el FS es el de Mohr-Coulomb con la c y la φ de la tangente;
   - espejo;
   - equilibrio global con las c y φ finales, menor que 1e-6;
   - monotonía: el FS sube con GSI y con σci, y baja con D.
7. **Costo en la búsqueda.** Pasadas por candidato en una búsqueda (el círculo crítico del oráculo y vecinos) y el
   multiplicador de tiempo estimado frente a Mohr-Coulomb.
8. **Búsqueda contra el oráculo:** el círculo crítico del oráculo con Hoek-Brown, pasado a tu prototipo como superficie
   fija, en SA y en Hammah.

Escribe `X28.md`, `X28_proto/` y `X28_filas/`.

## X29: búsqueda no circular sobre el motor

Prototipo del refinamiento de X24 §6.1, evaluando cada polilínea con el motor real.

- **Evaluador.** Para no pagar un proceso por evaluación, instala el wheel 0.4.0 en un venv propio
  (`$TMPDIR/f3b-x29/venv`) desde el Release
  (`https://github.com/nibaldox/OpenGeoSlide/releases/download/v0.4.0/opengeoslide-0.4.0-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl`)
  y usa `opengeoslide.analyze`. Cada candidato es una polilínea fija con Spencer o M-P `constant`.

1. **Semillas.** Cómo obtener los 3 mejores círculos distintos de la búsqueda circular del motor (que hoy solo devuelve
   el mejor): por ejemplo, rehacer la malla de entrada, salida y radio con superficies fijas, o restringir los rangos.
   Mide si las semillas del motor y las del oráculo coinciden.
2. **Refinamiento.** Implementa la variación alterna de X24 §6.1: 9 → 17 → 33 vértices, paso inicial 0,1 del segmento
   más corto, 6 pasos y 6 rondas, presupuesto de 1500 evaluaciones por semilla, desempate por (FS, índice). Aplica la
   admisibilidad de X24 §6.2, con la concavidad de 1°.
3. **Contra el oráculo** (criterios A1 a A8 de X24 §6.3) en V001, V034a y V036a, y en tantos de los 16 casos de X23
   que entran solo con búsqueda no circular como te permita el presupuesto. Para cada caso:
   - FS circular, FS no circular, el FS de cSlope no circular y el publicado;
   - vértices, evaluaciones y tiempo;
   - la polilínea final de cSlope pasada al motor como superficie fija, que separa el error del evaluador del error de
     la búsqueda.
4. **Parámetros.** Qué parámetros cambian el resultado y cuáles no. Si 9 → 17 → 33 basta o hace falta otra cosa.
5. **Determinismo:** dos corridas bit a bit iguales.
6. **Filas de aceptación** en el formato v0.6 provisional: el modelo con `search.non_circular`, el FS de cSlope, el
   publicado y la cota que propones (por ejemplo, `FS_ogs ≤ 1,01·FS_cSlope` y el publicado dentro de su tolerancia).

Escribe `X29.md`, `X29_proto/` y `X29_filas/`.

## X30: SHANSEP sobre las dovelas del motor

1. **σ′v en la base** contra el oráculo: `σ′v = (W + cargas)/b − u` en el punto medio de la base. Mide qué entra:
   - el peso del agua embalsada (cSlope recalcula SHANSEP con el agua libre, X11 §1.3);
   - las cargas `udl` y `line`;
   - el sismo: si kv o kh cambian σ′v en el oráculo;
   - `ru`.
2. **Las tres fuentes de OCR** (`ocr`, `pop`, `ocr_by_elevation`) contra el oráculo en círculo fijo, en los cinco
   métodos. Usa V047a (seco y con piezométrica, convertido con `to_cslope.py`) y V105a.
3. **V105a con el motor actual**, que ya tiene agua embalsada: ¿entra? Da la cifra y el publicado.
4. **Su negativo o nulo:** qué pasa con σ′v ≤ 0 (dovelas sobre el agua o en la cresta) y qué hace el oráculo.
5. **Resistencia en las caras** para el aviso `interslice_shear_exceeds_strength` (E13k): propón cómo integrar
   `Su(σ′v(z))` en una cara vertical y mide si el aviso cambia en V047a.
6. **Búsqueda:** el círculo profundo de radio 270 m de X26 §5.4. ¿Lo da también el motor con el prototipo? ¿Qué
   advertencia correspondería?
7. **Identidades:** con `ocr = 1`, Su = ratio·σ′v en cada dovela, comprobado dovela por dovela contra las dovelas del
   oráculo; espejo; monotonía con `ratio` y con OCR.

Escribe `X30.md`, `X30_proto/` y `X30_filas/`.
