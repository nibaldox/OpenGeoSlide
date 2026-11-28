# D-1: FS absurdos de Spencer en polilíneas (rama `f3d1-spencer`, base `a64718b`)

## 1. Veredicto

**No es un error de código.** Es una **solución matemáticamente válida (cierre y momento global exactos) pero estáticamente
inadmisible**: la masa se sostiene casi solo con fuerzas entre dovelas (cortante entre dovelas `X = λE` 5 a 100 veces mayor que
el que el suelo puede movilizar en esas caras al mismo F). El motor no corrige nada; el contrato no impone esa condición.
Por eso **no se modificó ningún archivo de `crates/ogs-core/src`** (la identidad byte a byte con `b2e0a62` es trivial) y la
decisión sobre un criterio es del coordinador (sección 6).

- No es una raíz espuria: es la **única** raíz del barrido de λ, admisible, y la que elige E12e.
- No hay tracción entre dovelas (E ≤ 0 en todas), no hay N′ negativos, no hay polos (`m_α(F)` 0,41 a 0,97).
- Janbu simplificado coincide con cSlope a 1e-9 en los tres casos; Morgenstern-Price de cSlope no converge en los tres ni en
  ninguno de los 10 puntos del barrido de cohesión.
- La causa: el momento global se anula en un λ que cae **sobre el flanco casi vertical de `F_f(λ)`** (la curva de F que cierra
  las fuerzas). Ahí F ya no depende de la resistencia: con c = 0,5 kPa F ya es 81, con c = 10 es 130,6.

## 2. Reproducción

Desde la raíz del worktree (`export TMPDIR=<directorio temporal>`; Python siempre con
`env -u PYTHONPATH -u PYTHONHOME`; binario `target/release/ogs` de `a64718b`, sin cambios de motor):

```
cargo build --release -p ogs-cli
# 1. Barrido con semilla fija (talud simple de dos estratos y su variante homogénea "mc"; 1500 polilíneas por semilla)
for s in 1 2 3; do for v in two mc; do
  python3 docs/fase3/d1/tools/gen_cases.py $s 1500 $v $TMPDIR/d1_${v}_$s.json; done; done
# 2. Diagnóstico independiente del solver (recurrencia, cierre, momento, N', línea de empuje, raíces) y tabla de los 3 casos
cargo test -p ogs-core --release --test d1_spencer_absurd_fs -- --nocapture --test-threads=1
# 3. Oráculo y barrido de cohesión (cSlope 0.1.0)
env -u PYTHONPATH -u PYTHONHOME $TMPDIR/oracle-venv/bin/python docs/fase3/d1/tools/oracle.py '[[9.63,9.95],[21.796,-2.571],[26.067,-0.05]]'
env -u PYTHONPATH -u PYTHONHOME OGS=target/release/ogs $TMPDIR/oracle-venv/bin/python docs/fase3/d1/tools/scale_sweep.py '[[9.63,9.95],[21.796,-2.571],[26.067,-0.05]]'
# 4. Efecto del criterio candidato: los 93 casos + pending + batería + acads1a, y el barrido aleatorio
env -u PYTHONPATH -u PYTHONHOME OGS=target/release/ogs $TMPDIR/oracle-venv/bin/python docs/fase3/d1/tools/run_sets.py $TMPDIR/d1_sets.json
for v in mc two; do env -u PYTHONPATH -u PYTHONHOME OGS=target/release/ogs $TMPDIR/oracle-venv/bin/python docs/fase3/d1/tools/rv_random.py $v $TMPDIR/d1rv_$v.json 1 2 3; done
```

`gen_cases.py` reproduce el generador de C-M (`poly_rand.py`): talud 1:1 de 10 m, suelo c = 10, φ = 30, γ = 20 sobre un
estrato no drenado (variante `two`) o todo el suelo (`mc`), 50 dovelas, polilíneas de 3 a 8 vértices que parten del terreno.
Herramientas: `docs/fase3/d1/tools/{gen_cases,diag,admiss,oracle,scale_sweep,batch_metrics,run_sets,rv_random}.py`.

## 3. Alcance del fenómeno

| Variante | Polilíneas (3 semillas × 1500) | Spencer y Janbu convergidos | `FS_Spencer > 3·F₀_Janbu` | FS máximo de Spencer |
|---|---|---|---|---|
| `two` | 4500 | 1735 | **198** (11 %) | 130,6 |
| `mc` | 4500 | 1761 | **281** (16 %) | 130,6 |

Los casos del hallazgo (73 a 450) son la cola de esta distribución. En los 479 casos, λ está entre 0,16 y 1,02 y el único aviso
es `negative_effective_normal` (nota) en 130 de 198 (`two`) y 151 de 281 (`mc`), con N′<0 de a lo sumo 2,1e-4·ΣW.

## 4. Los tres casos (variante `mc`, 50 dovelas; el test los fija en espejo, `right_to_left`)

| Caso | Polilínea | F Spencer | λ | F₀ Janbu (ogs / cSlope) | M-P `constant` | M-P `half_sine` | cSlope M-P |
|---|---|---|---|---|---|---|---|
| A | (9,63; 9,95) (21,796; −2,571) (26,067; −0,05) | **130,578** | 0,6338 | 4,9268 / 4,926756 | 130,578 | 54,26 | no converge |
| B | (8,091; 9,95) (24,156; −5,734) (33,598; −0,05) | **49,270** | 0,4421 | 4,4315 / 4,431487 | 49,270 | no converge | no converge |
| C | 7 vértices, (13,132; 6,818) … (31,391; −0,05) | **126,550** | 0,2907 | 5,0444 / 5,044386 | 126,550 | no converge | no converge |

Janbu corregido: A 5,310; B 4,822; C 5,443. Las tres son polilíneas en V: un tramo largo y empinado (44° a 66°) paralelo al
talud, que deja una losa delgada (0,7 m en A) en el flanco activo, y un tramo corto que sube hacia el pie (α = −31° a −39°).

### Verificaciones independientes (`spencer_interslice`, test `d1_spencer_absurd_fs.rs`)

| Caso | Cierre `E_n/ΣW` | Momento global, punto 1 | Momento global, punto 2 | E máx (tracción) | N′<0 / ΣW |
|---|---|---|---|---|---|
| A | −7,5e-13 | 2,0e-14 | 2,5e-12 | 0 | 0 |
| B | −2,4e-15 | 3,7e-10 | 9,9e-10 | 0 | 0 |
| C | −1,5e-11 | 1,6e-9 | 4,6e-9 | 0 | 0 |

(Residuos de momento respecto de (0; 20) y (−30; 35), normalizados por `Σ|W·r|`; el umbral del contrato es 1e-6.) Con ese
mismo `E`, `M-P constant` da F idéntico a 1e-10 y el barrido de λ (`spencer_roots`) tiene **una sola raíz, admisible**:
A (0,63383; 130,578), B (0,44214; 49,2702), C (0,29072; 126,5497). E12e no tuvo nada que elegir.

### Signos, α, m_α y fuerzas entre dovelas

| Caso | α (rango) | `m_α(F)` | E mín (compresión) | `max|X|` = λ·`max|E|` | `max|X|`/ΣW | N′ mín | cortante basal movilizado / ΣW |
|---|---|---|---|---|---|---|---|
| A | −30,6° a 45,8° | 0,700 a 0,859 | −108 | 68,5 | 24 % | 0,02 | 1,2 % |
| B | −31,0° a 44,3° | 0,724 a 0,851 | −468 | 207 | 17 % | 0,02 | 2,0 % |
| C | −39,4° a 66,0° | 0,412 a 0,966 | −591 | 172 | 13 % | 0,02 | 0,8 % |

E es de compresión en toda la masa y N′ > 0: no hay dovelas que se tiren unas de otras. Lo que sí hay es que el cortante
basal movilizado, `Σ(c·l + N′ tan φ)/F`, es **1 % de ΣW**: la losa y la cuña pasiva se equilibran entre sí por empuje (E hasta
591 kN con ΣW = 1363 kN) y la resistencia de la base apenas interviene.

**Línea de empuje** (momento de cada dovela respecto del punto medio de su base, validada con el residuo de la última
dovela, 4e-5 de la escala, y con el signo opuesto de X, que da 0,4): fuera de la masa en 27 de 49 caras (A), 13 de 48 (B) y 0
de 49 (C). **No discrimina**: en el barrido, 59 de 198 absurdos (`two`) la tienen fuera frente a 1058 de 1537 del resto, así
que no se propone como criterio.

### Cómo sale F = 130 (caso A)

`F_f(λ)` es el F que cierra las fuerzas con un λ dado; `ρ(λ)` es el residuo de momento (normalizado por `ΣW·Σb`) evaluado en ese F:

| λ | 0 | 0,1 | 0,2 | 0,3 | 0,4 | 0,5 | 0,6 | 0,63 | **0,6338** |
|---|---|---|---|---|---|---|---|---|---|
| `F_f(λ)` | 4,93 (= Janbu) | 5,76 | 6,98 | 8,90 | 12,3 | 20,2 | 55,0 | 113,1 | **130,6** |
| ρ | −0,123 | −0,110 | −0,094 | −0,076 | −0,055 | −0,032 | −0,0083 | −0,00095 | **0** |

La rama de `F_f` crece sin cota hacia λ ≈ 0,64; el momento global se anula justo antes (0,6338). Con resistencia nula, la
condición `Σ W sin α /(cos α + λ sin α) = 0` (equilibrio de los pesos sin resistencia basal) da λ∞ = 0,6586: la geometría en
V admite un estado autoequilibrado de empuje sin resistencia de la base, y la raíz de Spencer queda a 4 % de él. Barrido de
cohesión (φ = 30, `scale_sweep.py`): F_Spencer = 81,5; 84,0; 89,2; 94,4; 99,5; 104,7; 109,9; 120,2; 130,6; 156,5 para
c = 0,5; 1; 2; 3; 4; 5; 6; 8; 10; 15, con **λ = 0,636 a 0,633 en todos**; F₀ de Janbu va de 2,46 a 6,25 y coincide con cSlope
en los 10 puntos. F depende de c casi como `79 + 5,2·c`: el término dominante no es resistencia.

### Qué hace cSlope

Janbu simplificado coincide (arriba). M-P `constant` devuelve «the solver did not converge» en A, B, C y en los 10 puntos del
barrido de cohesión. Su solver por defecto (`solvers.rs`, `analyse_morgenstern_price`) itera F_m y F_f con secante y extrapolación
de λ con paso acotado; con F_f creciendo de 5 a más de 100 en 0,03 de λ, no llega a un par (λ, F) cerrado. Es una inferencia
de la lectura del código: no se instrumentó el solver compilado.

## 5. Diagnóstico

| Hipótesis del brief | Resultado |
|---|---|
| Error de código | **Descartado.** Cierre 1e-11 y momento global 1e-9 con el `E` de `spencer_interslice`, independiente del solver; M-P `constant` igual a 1e-10; Janbu igual a cSlope a 1e-9. |
| Raíz espuria del sistema | **Descartado.** Una sola raíz en el barrido, admisible (`Φ/F` y `m_α` ≥ 0,2). |
| E < 0 generalizado (dovelas que tiran) | **Descartado.** E ≤ 0 (compresión) y N′ > 0 en toda la masa. |
| Solución válida pero físicamente inadmisible | **Confirmado**, por la restricción sobre el cortante entre dovelas (sección 6): `r_v` = 122 (A), 34 (B), 53 (C). |

Interpretación: Spencer deja `X = λE` libre. Cuando la geometría en V permite equilibrar los pesos con empuje, el momento se
anula con λ cerca del polo de `F_f` y F no mide resistencia. Es la «no unicidad» de los métodos con función de fuerzas entre
dovelas descrita por Chen y Morgenstern (1983): las soluciones deben pasar condiciones de admisibilidad física, que el motor
no verifica (solo verifica base: `Φ/F`, `m_α`).

## 6. Propuesta de criterio (no implementada; decide el coordinador)

**Fuente.** Zhu, Lee y Jiang (2003), *Géotechnique* 53(4): 377-395, criterio (d) de «razonabilidad estática» (ecs. 59-61): el FS
local de las caras verticales entre dovelas no debe ser menor que el de la superficie de deslizamiento. Es la restricción de
Chen y Morgenstern (1983), *Can. Geotech. J.* 20(1): 104-119 (ec. 5: «el cortante en la cara vertical no debe exceder la
resistencia movilizable», `F_v = [E′ tan φ′ + c′h]/X ≥ F`). Los mismos autores (Zhu et al.) lo listan con otros tres (N′ ≥ 0, línea de empuje
dentro de la masa, E′ ≥ 0) y advierten que juntos «son demasiado estrictos para la mayoría de problemas prácticos»; se usan
como diagnóstico. Lo leí de los fragmentos publicados por los repositorios de los autores; no pude descargar los PDF.

**Definición medida** (`admiss.py`, post-proceso sobre las dovelas del informe, mismas fuerzas que el solver):

```
r_v = max_caras  |X|·F / ( c_v·h + max(E′, 0)·tan φ_v ),   X = λ·f·E,   E′ = −E − P_w  (compresión > 0)
```

`h` = altura de la cara (base → terreno); `c_v` es ∫c dy y `tan φ_v` el promedio en altura de los materiales que cruza la cara
(Su para no drenado); `P_w` = resultante del agua sobre la cara (piezométrica o ru). Solo caras con |E| ≥ 2 % de max|E| y E′ > 0
(las de tracción son el criterio (c), no este). El criterio se cumple si `r_v ≤ 1`.

**Efecto medido.**

| Conjunto | n | `r_v` mediana | `r_v` > 1 | > 1,5 | > 3 | máx. |
|---|---|---|---|---|---|---|
| 93 casos + pending + batería + acads1a, Spencer | 119 resultados | 0,70 | 18 | 10 | 9 | ∞ (V021) |
| ídem, M-P `half_sine` | 120 | 0,75 | 32 | 9 | 9 | ∞ (V021) |
| Barrido `mc`, `FS > 3·F₀` | 281 | 9,18 | **281** | 281 | 281 | 122 |
| Barrido `mc`, el resto | 1480 | 2,09 | 1432 | – | 356 | 11,0 |
| Barrido `two`, `FS > 3·F₀` | 198 | 8,34 | **198** | 198 | 198 | 122 |
| Barrido `two`, el resto | 1537 | 1,90 | 1464 | – | 292 | 9,7 |

- Los 9 resultados > 3 de los casos de referencia son **todos V021a-g** (∞): el material «sand» es un no drenado con Su = 0,
  así que la cara vertical no tiene resistencia alguna y `r_v = ∞` aunque F = 1,06 a 2,25 sea el publicado. Sin V021, el máximo
  es 1,63 (D13 Spencer).
- Con umbral 1 (el de las fuentes) el criterio rechazaría 18 de 119 resultados de Spencer y 32 de 120 de M-P que hoy reproducen
  el valor publicado (por ejemplo V047a M-P medio seno 1,09). **No sirve como guarda dura.**
- Con umbral 5, rechazaría 272/281 (`mc`) y 182/198 (`two`) de los absurdos, y 60/1480 y 45/1537 del resto; con umbral 10, 131/281
  y 78/198 de los absurdos y 1/1480 y 0/1537 del resto. Un valor entre 1,63 y 3,88 (mínimo de los absurdos) separa los 479 absurdos de los
  casos de referencia, pero **ese umbral no tiene fuente**: sería calibrado con estos datos.
- El resto de polilíneas aleatorias también tiene `r_v` alto (mediana ≈ 2): son superficies no críticas y no son una referencia de
  admisibilidad; solo muestran que un umbral estricto cambiaría el resultado de muchas polilíneas de usuario.

**Opciones para el coordinador** (en orden de riesgo creciente):

1. **Aviso informativo**, sin rechazo: nota `interslice_shear_exceeds_strength` con `r_v > 1` y aviso mayor con `r_v > 3`
   (las dos clases de N′ de E7d, mismo patrón). El FS no se retiene como convergido sin que el informe lo marque.
2. **Rechazo** (`NotConverged("inadmissible_interslice_shear")`) con `r_v > 3` y excepción para las caras sin resistencia
   (`c_v·h + E′ tan φ_v = 0`, V021). Convierte en «sin solución» los 281 (`mc`) y 198 (`two`) absurdos y también 24 % (`mc`) y 19 % (`two`) de las
   polilíneas aleatorias corrientes (`r_v` > 3: 356/1480 y 292/1537); no cambia ningún caso ni batería (con la excepción de V021), pero el umbral 3 es calibrado, no citado.
3. No hacer nada y documentarlo en la Ayuda: «Spencer y M-P con polilíneas en V pueden dar FS no físicos; compare con Janbu».

Recomendación del diagnosticador: la opción 1 (es la que la bibliografía respalda tal cual); la 2 solo con decisión explícita
del umbral. No se recomienda `FS_Spencer > k·F₀_Janbu` (no tiene fuente y un F ≈ 1 en M-P con función no constante puede
legítimamente diferir de Janbu) ni la línea de empuje (no discrimina).

## 7. Archivos

- `crates/ogs-core/tests/d1_spencer_absurd_fs.rs`: 3 tests que fijan los números de las secciones 4 y 6 (cierre, momento global
  en dos puntos, signos, N′, una sola raíz, `r_v` > 3); no cambian ningún comportamiento.
- `docs/fase3/d1/tools/*.py`: generador, diagnóstico, criterio, oráculo y barridos.
- Sin cambios en `crates/ogs-core/src`, `verification/` ni `briefs/`.
