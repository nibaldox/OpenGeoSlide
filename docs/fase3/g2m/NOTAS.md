# M-D30 (G2): D30 fija, ogs −15 % frente a cSlope

Rama `f3g2m-d30`, base `5aa0edb` (f3g-integracion). Commits: `66e1d61` (test RED), `2a49716` (corrección).
Todo medido con `target/release/ogs` y cSlope 0.1.0 (`$TMPDIR/oracle-venv`), conversor `verification/harness/to_cslope.py`.

## 1. Las cuatro cifras (antes de la corrección)

Círculo de cSlope (xc 27,076448878025104; yc 13,339637575128545; r 13,656246640307726), 50 dovelas:

| modelo | método | ogs | cSlope | Δ |
|---|---|---|---|---|
| con piezométrica y = 8 | Bishop | 1,28072 | 1,51426 | −15,42 % |
| con piezométrica y = 8 | Spencer | 1,28092 | 1,51280 | −15,33 % |
| seco | Bishop | 1,19867 | 1,38050 | −13,17 % |
| seco | Spencer | 1,18946 | 1,38230 | −13,95 % |

Las cuatro reproducidas. Aviso de ogs en todas: `truncated_mass`.

## 2. Tabla de dovelas y primera divergencia

| | cSlope | ogs (antes) |
|---|---|---|
| dovelas | 57 = 18 bajo la banqueta (x 24,1529 → 30) + 39 (x 30 → 40,6668) | 50, todas en x 30 → 40,6668 |
| Σ peso (seco) en x ≥ 30 | 1757,53 | 1756,93 (0,03 %, por la partición) |
| Σ longitud de base en x ≥ 30 | 17,1628 | 17,1617 |

Las 39 dovelas de x ≥ 30 coinciden en base y peso. La divergencia es la **primera dovela de ogs: x_left = 30,0** (cSlope empieza en 24,1529, el punto de salida). La franja que ogs no tiene: 18 dovelas de 0,325 m, ΣW = 23,48 kN/m, base 5,893 m, **Σ c·l = 117,86 kN/m**, u ≈ 78–82 kPa. La hipótesis del coordinador sobre la franja y su cohesión (≈117) se confirma.

## 3. Causa (con una precisión sobre la hipótesis)

No es que ogs «tome el cruce en el pie como salida». El arco pasa a **3,56e-7 m por encima** del vértice (30, 0) (y(30) = 3,559942e-7) y cruza y = 0 en x = 29,9999984. Entre 29,9999984 y 30 el arco está sobre el terreno inferior: un tramo de aire de 1,6e-6 m de ancho y 3,6e-7 de alto (5 tol; tol = 1e-9·70 = 7e-8).

1. `slicer.rs:703` (`slice_span`): la dovela [29,9999984, 30] tiene `y_top_mid − y_base_mid ≤ tol` → dovela de aire.
2. `slicer.rs:204` `main_block_range`, llamada en `slicer.rs:463` (`slice_surface_cracked`): el aire interior parte la masa en dos bloques; se conserva solo el de la entrada (E10a″) y se descarta la franja bajo la banqueta (nota `truncated_mass`).

Este es el defecto de ogs: una dovela de aire de 1,6e-6 m decide 15 % del FS.

## 4. Continuidad (círculos vecinos y pie inclinado)

FS Bishop con r = r0 + d (el arco en x = 30 sube 1,024·|d| por debajo de d):

| d | ogs (antes) | cSlope |
|---|---|---|
| −1e-2, −1e-3, −1e-5 | 1,28075 / 1,28072 / 1,28072 | 1,28005 / 1,28002 / 1,28002 |
| −1e-6 … +2e-7 (incl. r0) | 1,28072 | **1,51426** |
| +5e-7, +1e-6, +1e-3, +1e-2 | 1,51627 / 1,51627 / 1,51648 / 1,51832 | 1,51426 / 1,51426 / 1,51446 / 1,51630 |

Pie (30, δ) en lugar de (30, 0): δ = −1e-2, −1e-3 → ogs 1,28072, cSlope 1,28002; δ = −1e-6 → ogs 1,28072, cSlope 1,51426; δ = +1e-6, +1e-3, +1e-2 → ogs 1,5163 / 1,5165 / 1,5182, cSlope 1,5143 / 1,5145 / 1,5162. En seco, lo mismo (1,1987 / 1,3815 ogs, 1,1983 / 1,3805 cSlope).

Bisección del salto (en seco): **ogs salta con el arco a 1,5e-8 sobre el vértice** (≈ tol); **cSlope salta a 3,0e-6**. Ambos motores son discontinuos (con 1,28 de un lado y 1,516 del otro, y a ambos lados coinciden dentro de 0,13 %), y la discontinuidad física es real (con hueco la franja es otro bloque; sin hueco está conectada). El círculo crítico de cSlope, a 3,6e-7, cae entre los dos umbrales: cSlope lo trata como contacto, ogs como hueco. Por tanto la diferencia viene de la tolerancia de contacto con el vértice, no del conversor ni de las cargas (el agua da la misma diferencia en seco).

## 5. Corrección

`slicer.rs:167-170, 854, 881` (`drop_hairline_air`, `clearance_above_ground`, llamada en `slicer.rs:848`, al final de `slice_span`): un tramo de aire **interior** (suelo a ambos lados) cuyo ancho total ≤ 1e-6·ancho del modelo y cuyo arco queda como mucho a **10 tol** sobre el terreno en el peor extremo de cada dovela, se trata como contacto: sus dovelas se quitan y los dos bloques quedan adyacentes. Un tramo mayor sigue siendo un hueco.

Intentos descartados (medidos, no hipotéticos):
- Umbral 1e-6·ancho de altura (la escala de los nodos que la búsqueda pone alrededor de un vértice): cambia 152 salidas en 68 modelos, porque los círculos de la propia búsqueda a vértice ± 1e-6·ancho caen dentro de la banda. Descartado.
- Sin cota de ancho: rompe `f3r10_geometry::report_surface_is_cut_to_the_analysed_range_e13l7` (una polilínea que va **por** el terreno en el fondo de una muesca no es un contacto). La cota de ancho lo corrige.

Con la corrección (D30 fija): con agua Bishop 1,51627 (+0,13 %), Spencer 1,51456 (+0,12 %); seco Bishop 1,38154 (+0,075 %), Spencer 1,38316 (+0,06 %). El umbral de ogs sigue siendo discontinuo (ahora a ≈ 7e-7 de hueco, cSlope a 3e-6): un círculo con el arco entre 7e-7 y 3e-6 sobre el vértice seguiría difiriendo de cSlope. No se hace coincidir con el de cSlope a propósito (es una tolerancia propia de ese motor).

Test `crates/ogs-core/tests/f3g2m_d30_hairline.rs` (4 tests; 2 en RED antes de la corrección: la masa completa y la continuidad; los otros 2 protegen que un hueco real sigue separando la franja, d = −1e-5 … −1e-2, y la simetría especular a ≤ 1e-9).

## 6. Identidad

- `identity_vs_baseline.py --normalize-version --include-reinforced` contra `$TMPDIR/f3g-base-target` (anterior a la integración): 95 diferencias en modelos sin agua (141 en la primera versión con umbral 1e-6·ancho). **93 ya existen sin mi cambio** (el mismo script con el binario de 5aa0edb contra la misma base da 93; en el control 5aa0edb contra sí mismo salen 46 por las variantes @0.4 de modelos v0.5, que no son del motor). El resto es atribuible a la corrección: V019 `search`, `search@0.4` (solo el contador `search.evaluated/valid` de Janbu simplificado: 10040/7451 → 10088/7499).
- Binario de 5aa0edb contra el nuevo (el control correcto): 50 diferencias, 46 son el ruido anterior; las 4 nuevas: V019 `search`/`search@0.4` (contador) y D32 `own`/`search` (`search.valid` −1 en las cinco métodos). **FS, superficie crítica, avisos y dovelas, idénticos al bit** en todos los modelos sin agua sobre el terreno.
- Con agua sobre el terreno (excepción F5.1), el único modelo que cambia por la corrección es **D30** (`fixed`, `fixed@0.4`: ahora 1,5163 en vez de 1,2807).
- Esos tres modelos (V019, D32, D30) son los de «círculo por el vértice del terreno»: el contador cambia porque un candidato de la búsqueda pasa a estar dentro de la banda.

## 7. Gates (con la corrección final)

- `cargo fmt --all --check`: exit 0.
- `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`: exit 0.
- `cargo test -p ogs-core --release --no-fail-fast`: 617 tests pasan, 0 fallos (48 binarios); con `--features parallel`: 617 / 0.
- Aceptación: `cargo test -p ogs-core --release --test acceptance -- --nocapture`: **243 checks, 0 fallos** (el 323 del encargo no coincide con lo que imprime el test en este árbol; 3 tests ok).
- Diferencial completo (`run.py --ogs target/release/ogs --require-f3r`, exit 0): fase 3a 71/71 (1 por «ambos sin solución», como antes), refuerzos 12/12, búsqueda 28/28, fija 28/28, v0.5 46/48 con 2 «sin dato» (D39 Bishop fija, sin solución de cSlope; no tocado por esta corrección).

## 8. Observaciones que no se tocan

- La **búsqueda** de D30 coincide solo en el criterio (ogs ≤ cSlope·1,01): Bishop con agua 0,8248 frente a 1,5143 (−45,5 %), Spencer 0,9702 frente a 1,5128; en seco 0,7131 y 0,8217. Son mecanismos truncados (`truncated_mass`, `effective_ends_outside_range`); cSlope devuelve 1,5143 en su búsqueda aunque sus círculos con hueco (r−1e-5) dan 1,2800, así que su búsqueda no los visita. La corrección no cambia esas cifras.
- Los círculos de la búsqueda de ogs a vértice ± 1e-6·ancho dejan el arco a ~1e-4 sobre el terreno (V001: 7e-5), muy por encima de 10 tol: conservan su rebanado. Solo un círculo que pasa por el vértice casi exacto usa la banda; por eso, en toda la batería, solo cambian contadores de búsqueda en V019 y D32.
