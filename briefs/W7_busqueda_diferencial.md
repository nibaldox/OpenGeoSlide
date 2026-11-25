# Brief W7: calidad de búsqueda frente al oráculo (E9a-E9c) y batería diferencial

**Lee primero:** `briefs/00_CONTRATOS.md`, en especial **§4.4.5-6 (E9a, E9b)** y **E9c** (§4.3). Responde en español.

## Contexto (medido por el coordinador en `main`)
Talud `[[0,0],[0,15],[15,15],[30,25],[60,25],[60,0]]`, γ = 20, c = 2, φ = 45°, ru = 0,65, búsqueda por defecto con 50
dovelas.

| | ogs | cSlope 0.1.0 (oráculo) |
|---|---|---|
| Bishop, búsqueda | 0,3408 | **0,3307** (sale en el vértice del pie (15, 15), entra en (30,7; 25), r = 29,3) |
| Spencer, búsqueda | 0,4132 | **0,3876** (sale en (15, 15), entra en (31,2; 25), r = 42,4) |
| Bishop, círculo crítico de ogs (10,7716; 39,6410; 24,6416) | 0,3408 | 0,3407 |
| Spencer, mismo círculo | 0,4322 | 0,4322 |

Los métodos coinciden con el oráculo; la diferencia está en la **búsqueda**, porque la grilla uniforme no alcanza el
vértice del pie. La diferencia Spencer/Bishop de ~27 % en este caso es **real**: cSlope da lo mismo. El antiguo
objetivo "Spencer ≤ 5 % de Bishop" queda **retirado**.

---

## W7a: núcleo (`opengeoslide-wt/w7a`, rama `w7a-busqueda`)
**Archivos:** `crates/ogs-core/src/search.rs`, `crates/ogs-core/src/methods/spencer.rs`,
`crates/ogs-core/tests/{search.rs,methods.rs,regression_r2.rs}`, `crates/ogs-core/tests/differential_r2_03.rs` (nuevo).

1. **E9a:**
   - candidatos con los vértices del terreno (± 1e-6·ancho) dentro de cada rango;
   - 10 semillas, con al menos 2 pares distintos;
   - para leer los vértices, `Ground` necesita exponerlos. Agrega al trait `fn ground_vertices_x(&self) -> Vec<f64>`
     con una **implementación por defecto vacía**, para no romper los `Ground` falsos de los tests, e impleméntalo en
     `PreparedModel` (en `geometry.rs`; **autorizado solo ese método**);
   - el determinismo serial = parallel se mantiene; los tests de `search.rs` siguen verdes.
2. **Test diferencial R2-03** (`differential_r2_03.rs`), con los valores del oráculo de la tabla de arriba fijados como
   constantes y citando su origen (cSlope 0.1.0, opciones del harness):
   - `FS_ogs_bishop ≤ 0,3307·1,01` y `FS_ogs_spencer ≤ 0,3876·1,01`.
   - Reemplaza `r2_03_search_spencer_within_5_percent_of_bishop` por este test (bórralo y explica el motivo en un
     comentario).
3. **E9c:**
   - presupuesto de Spencer con a lo sumo `max_iterations/2` para el punto fijo;
   - reactiva `r1_07a_negative_fos_iterate_is_not_a_root` esperando FS ≈ 0,746180, λ ≈ 0,191570, `Converged` y
     admisible.
4. **Rendimiento:** mide con `ogs bench verification/cases/V047a.json` (release) antes y después. Si el tiempo de
   búsqueda crece más de 2×, repórtalo.
5. **Aceptación 38/38** y todos los tests en verde (`cargo test -p ogs-core --release --no-fail-fast` y
   `--features parallel`). Reporta los FS de aceptación que cambien.

## W7b: batería diferencial (`opengeoslide-wt/w7b`, rama `w7b-diferencial`)
**Archivos:** `verification/differential/**` (nuevo). Reutiliza `verification/harness/to_cslope.py` **sin modificarlo**,
importándolo.

1. Script `verification/differential/build_cases.py`: genera **10 modelos sintéticos** `.ogs.json` con geometrías y
   condiciones de tipo minero y civil, cada uno con un comentario de intención:
   1. talud homogéneo 1:1, seco;
   2. el mismo con ru = 0,5;
   3. dos capas con una capa débil en la base;
   4. pared de rajo con 3 bancos (berma y cara);
   5. botadero, ángulo de reposo 37°, material granular c = 0;
   6. talud con piezométrica inclinada;
   7. arcilla φ = 0;
   8. presa simétrica con rangos de búsqueda;
   9. el talud de R2-03 (c = 2, φ = 45°, ru = 0,65);
   10. talud con c alto y φ bajo, círculo profundo.
   Todos en SI, γw = 9.807 (cSlope 0.1.0 ignora `waterUnitWeight`), 50 dovelas, búsqueda por defecto y una
   superficie fija representativa.
2. `verification/differential/run.py`:
   - para cada caso y método (bishop, spencer), FS de ogs (CLI `--ogs`) y de cSlope (`cslope==0.1.0`), en
     **búsqueda** y en **superficie fija**;
   - criterio **E9b**: búsqueda `FS_ogs ≤ FS_cSlope·1,01` y fija `|Δ| ≤ 0,5 %`;
   - genera `verification/differential/REPORT.md` (en español) y `report.json`, con el tiempo de cada motor;
   - sale con **exit 0 siempre**, salvo error de ejecución. El veredicto va en el reporte, porque W7a corre en paralelo
     y hoy algunos casos de búsqueda pueden fallar. Imprime un resumen `búsqueda OK n/N`, `fija OK n/N`.
3. Corre `run.py` con el binario de `main` (`/home/xodla/archivos/opengeoslide/target/release/ogs`) y deja el reporte
   como línea base.
4. `pytest` mínimo: los modelos generados pasan `ogs analyze` sin `InvalidModel`, y el conversor cSlope los acepta.

```
uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with pytest python ...
```

## Cierre (ambos)
- Commits pequeños en tu rama, con rutas explícitas. Sin push.
- **Resumen** en español, con gates, tablas y hashes.
- **Presupuesto:** ~50 iteraciones cada uno.
- `TMPDIR=/home/xodla/.hermes/profiles/open-geoslide/cache/scratch`. No uses el puerto 5180.
