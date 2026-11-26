# R11C: búsqueda circular con refuerzos (E14o-7, R11A-07)

Rama `f3r11c-busqueda`, base `3aa3369`. Escritor M-C. Archivos tocados: `crates/ogs-core/src/search.rs`, la generación de
candidatos en `crates/ogs-core/src/lib.rs`, `crates/ogs-core/tests/f3r11c_search.rs` y este documento.

## Resultado

Los criterios de E14o-7 se cumplen y se implementó:

| Criterio | Resultado |
|---|---|
| Brecha < 1 % frente a `60×60×40 + refine` en los dos contraejemplos, V037 y V084a | **Sí**: +7,154 % → −0,443 %, +2,059 % → −0,661 %, V037 0,000 %, V084a 0,000 % |
| Sin refuerzos, identidad byte a byte | **Sí**: `identity_vs_baseline.py`, 0 diferencias en 121 modelos sin refuerzos (5 variantes) |
| El tiempo con refuerzos no más que se duplica (`ogs bench`) | **Sí**: ×1,15 a ×1,45 en 10 escenarios (total ×1,31); ×1,34 a ×1,49 con 14 refuerzos |

## 1. Reproducción (binario de la base, `target/release/ogs`)

Modelo: V047a con `search` v0.4, Bishop. Las longitudes de los anclajes no están en R11A-07; se encontraron por
barrido hasta reproducir su cifra: ambos anclajes pasivos miden 25 m (cabezas en el terreno `(31; 25,5)` y `(40; 30)`).

| Caso | Búsqueda por defecto | `60×60×40 + refine` | Brecha |
|---|---|---|---|
| Dos anclajes pasivos, T = 400, entry [42, 68], exit [22, 38] | 1,684177 | 1,571733 | **+7,154 %** |
| Anclaje activo `(33; 26,5)-(48; 26,5)`, T = 300, entry [45, 65], exit [22, 35] | 0,962132 | 0,942722 | **+2,059 %** |
| `V047a_1anchor` (activo `(36; 28)-(52; 28)`, T = 100) | 1,062251 | 1,062007 | +0,023 % |

Observaciones:
- El tercero (`V047a_1anchor`) **no** reproduce la falla que cita el informe (`yc − r = 27,9968`, FS 1,0618 con dos
  cruces que se cancelan): en esta base la búsqueda converge a 1,0623 con 0 cruces. Ese fenómeno es la tangencia de
  E14o-1 (M-A) y no es de la búsqueda.
- Mecanismo en el primero: el mínimo real es una superficie que pasa **a 0,0007 m de la cabeza de A2** (justo fuera: el
  anclaje no cruza). La malla de 20×20×20 y el Hooke-Jeeves en los tres ejes `(x_e, x_s, ρ)` no siguen ese borde,
  porque el borde no es paralelo a ningún eje. En el segundo, el mínimo pasa a 0,0013 m **dentro** de la punta.
- En V037 y V084a la brecha base ya es 0 %: no hay nada que corregir, solo que no empeore (V084a es fija, un plano;
  se midió con una variante de búsqueda circular alrededor de su plano).

## 2. Barrido de generalización

Además de los casos citados, 40 modelos aleatorios (semilla 0 a 39, `rand_scen` en `$TMPDIR/r11c/lib.py`): V047a con 1 a 4
refuerzos (anchor, nail, geosynthetic, activos y pasivos, Bishop o Spencer, rangos por defecto o acotados), más seis
casos promovidos convertidos a búsqueda circular alrededor de su superficie fija (los demás casos con refuerzos no
dan ninguna superficie convergida con esa conversión, en la base y en la rama, y se omitieron).

| | Base | Rama |
|---|---|---|
| Modelos aleatorios con brecha > 1 % | 5 de 40 (+11,8 %, +20,8 %, +3,6 %, +2,1 %, +1,1 %) | **1 de 40** (r12, +1,55 %) |
| Peor brecha | +20,83 % (r34) | +1,55 % (r12) |
| Modelos con FS más de 0,05 % por debajo de la malla fina de la base | 2 | 6 de 40 (hasta −5,0 %) |

Tabla completa de las 51 filas: `scripts/bench_v3.log`; los scripts (`lib.py`, `bench_set.py`, `abl.py`, `cmp_cases.py`) están en `scripts/` y esperan `$TMPDIR/r11c/base-target/release/ogs` (base) y `target/release/ogs`.

Residuo (no es un criterio de E14o-7, se documenta):
- **r12** (+1,55 %, base +2,12 %) y **r5** (+0,89 %): valles estrechos con dos refuerzos activos. Incluso la malla
  `40×40×40` de la base se queda +1,6 % en r12: el paisaje es rugoso, no es falta de candidatos en las puntas.
- Con 14 refuerzos activos de poca capacidad hay modelos con FS ≈ 0,1 donde la brecha sigue en +14 % (semilla 100): el
  FS es casi cero y el problema está mal condicionado; no cambia con esta mejora.
- Quien necesite certeza para un modelo reforzado sigue teniendo la malla fina (`n_entry = n_exit = 60`,
  `n_radius = 40`, unos 4 s en V047a con 2 refuerzos en el motor nativo).

## 3. Alternativas medidas (todas con el binario de la base salvo que se diga otra cosa)

Brecha frente a `60×60×40 + refine` de la base y tiempo de la búsqueda:

| Alternativa | S1 (2 pasivos) | S2 (activo) | r0 | r22 | r34 | Tiempo |
|---|---|---|---|---|---|---|
| Base `20×20×20` | +7,15 % | +2,06 % | +3,57 % | +11,79 % | +20,83 % | 1× |
| Malla `30×30×20` | −0,32 % | +1,62 % | −0,07 % | +12,15 % | +20,78 % | ×1,7 a ×2,0 |
| Malla `40×40×20` | +0,03 % | **+1,21 %** | −0,01 % | +0,21 % | +20,76 % | ×2,5 a ×3,3 |
| Malla `60×60×40` | 0 | 0 | 0 | 0 | 0 | ×10 a ×14 |
| Solo semillas por cruces y 20 semillas (ablación B) | +7,15 % | +2,06 % | −0,03 % | +1,55 % | +20,83 % | ×1,16 |
| Solo candidatos por puntas y cabezas (ablación A) | −0,44 % | −0,66 % | +3,57 % | −0,01 % | −2,48 % | ×1,13 |
| **Las dos (implementado)** | −0,44 % | −0,66 % | −0,03 % | −0,01 % | −2,48 % | ×1,31 |

Conclusiones:
- Subir la malla no es una solución: no baja de 1 % en S2 aun con 40×40×20 ni en r34 con ninguna malla `≤ 40`, y ya
  cuesta el doble desde 30×30×20.
- Las dos piezas son necesarias y complementarias: los candidatos por puntas y cabezas resuelven S1, S2 y r34 (el
  mínimo está en un borde de salto); las semillas por cruces resuelven r0 y mejoran r22 y r12 (mínimos en una cuenca
  de otro número de cruces que el de los 10 mejores).
- Más semillas por sí solas (10 → 30) bajan r12 de 2,1 % a 1,55 % y r5 de 1,14 % a 0,69 %, pero no tocan S1 ni S2. Se
  adoptaron 20 semillas y hasta 8 extra por cruces.

## 4. Lo implementado

Solo con refuerzos (`!reinforcements.is_empty()`); sin ellos `search_circular_reinforced` con `ends = []` ejecuta
exactamente el camino anterior (`search_circular` lo envuelve y el test compara resultado y contadores).

1. **Candidatos por puntas y cabezas** (`search.rs`, fase 4). Para cada extremo de cada refuerzo (cabeza y punta, también
   en pilotes y tablestacas) se toman dos puntos sobre su eje: `extremo ± 1e-4·ancho·u`, fuera y dentro del
   elemento (`u` apunta hacia afuera). Para cada par `(x_e, x_s)` de las grillas de entrada y salida (submuestreadas,
   siempre incluyendo los extremos de la grilla, hasta como máximo la mitad del tamaño de la grilla en total) el
   radio **se despeja** para que el círculo pase por el punto: con el centro `C = M + D·n` sobre la mediatriz de la
   cuerda, `D = (|P − M|² − h²) / (2 (P − M)·n)` y `ρ = ln(√(D² + h²) / h)`. Cada candidato pasa por el mismo
   `Space::circle`, de modo que los rangos de entrada y salida, `min_width` y la validez no cambian.
   Los 6 mejores por FS y el mejor de cada número de cruces ausente (hasta 8) se refinan con Hooke-Jeeves **en
   `(x_e, x_s)` solamente**, con `ρ` despejado en cada paso: el círculo sigue pasando por el punto y recorre el borde,
   cosa que los tres ejes no hacen.
2. **Semillas por número de cruces** (`search.rs`, fase 3). Con refuerzos se refinan los 20 mejores (en vez de 10, con
   la regla de E9a de al menos dos pares entrada-salida) y, además, el mejor candidato de cada número de cruces que
   esas semillas no cubren, hasta 8. El número de cruces es la cantidad de nodos de `crossing_nodes` entre 2, calculada
   en `lib.rs` con el mismo cálculo que ya se hacía por candidato.
3. `lib.rs`: la evaluación devuelve `(FS, cruces)` y calcula `reinforcement_ends` solo para el reporte de la búsqueda. La
   ruta sin refuerzos no calcula nada nuevo.

Costo: 10 escenarios `ogs bench --reps 7`: ×1,15 a ×1,45 (total 2612 ms → 3415 ms, ×1,31); evaluaciones +10 a +30 %.
Peor caso teórico: 8000 de la grilla + 28 × 300 del refinamiento + 4000 de candidatos por puntas + 14 × 300 = unas
24 600 evaluaciones frente a 11 000 de la base (×2,2); no se observó nada por encima de ×1,5.

## 5. Identidad y efecto sobre los casos con refuerzos

- **Sin refuerzos:** `verification/tools/identity_vs_baseline.py --base $TMPDIR/f3r-base-target/release/ogs --new
  target/release/ogs` → **0 diferencias en 121 modelos sin refuerzos** (`own`, `search`, `fixed`, `search@0.4`, `fixed@0.4`;
  29 modelos con refuerzos saltados).
- **Con refuerzos, contra un binario de la base (`3aa3369`, worktree detached en `$TMPDIR`):** los 23 casos con superficie
  fija (`own`) dan la **misma salida byte a byte**: la búsqueda no interviene. V037 (el único con búsqueda propia) da el
  mismo FS, la misma superficie y las mismas fuerzas; solo cambian los contadores `search.evaluated` y `search.valid`
  (10 119 → 12 964 en Bishop, 10 249 → 13 226 en Spencer). En las variantes de búsqueda de los demás casos, el FS cambia
  solo en V011a (1,2063 con diferencia de 1,9e-7) y V011b (4,7e-9), por un círculo algo mejor; los contadores suben
  siempre.

## 6. Gates

- `cargo fmt --all --check`: sin diferencias.
- `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`: sin avisos.
- `cargo test -p ogs-core --release --no-fail-fast`: 515 pasan, 0 fallan; con `--features parallel`: 515 pasan, 0 fallan.
  La aceptación (`acceptance`) da 3 de 3 en ambos modos.
- Tests nuevos (`f3r11c_search.rs`, 9): los tres contraejemplos de brecha **fallan contra la base** (+7,15 %, +2,06 % y
  +11,8 %, verificado compilando el archivo en el worktree de la base) y pasan en la rama; V037, V084a e identidad
  pasan en ambas; 4 tests unitarios con el suelo simulado (sin extremos = búsqueda plana; los candidatos pasan por los
  dos lados de cada extremo; las clases raras reciben su refinamiento).

## 7. Pendiente para otros escritores y el coordinador

- E14o-1 (M-A) cambiará qué cruces cuentan: las cifras de FS de esta nota pueden moverse al integrar. Conviene volver
  a correr `bench_set.py` (o los tests de `f3r11c_search.rs`) después de la integración; los tests usan referencias de
  la base y toleran 1 %.
- Las cifras de `docs/limitaciones.md` (V): la búsqueda con refuerzos hace ×1,15 a ×1,5 del tiempo anterior.
