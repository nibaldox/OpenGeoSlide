# Contratos de la Fase 1 (normativo)

**Base:** `briefs/00_CONTRATOS.md`, que sigue vigente con todas sus enmiendas (E1-E11). Este archivo agrega las
enmiendas **E12**, que también son normativas.

- **Quién lo modifica:** solo el coordinador.
- **Desacuerdos:** si un escritor no está de acuerdo con algo, lo reporta con números. No lo improvisa.
- **Evidencia:** `docs/fase1/exploracion/X1.md` (sismo y cargas) y `docs/fase1/exploracion/X3.md` (editor).

---

## F1.1 Esquema `.ogs.json` v0.2 (enmienda E12a)

- **Versiones:**
  - el motor acepta `version: "0.1"` y `version: "0.2"`;
  - los campos `analysis.seismic` y `loads` **solo** se admiten con `"0.2"`. Con `"0.1"` dan
    `InvalidModel: los campos 'loads' y 'analysis.seismic' requieren version "0.2"`;
  - un modelo sin estos campos da **exactamente** el mismo resultado, bit a bit, en v0.1 y en v0.2.
- **Campos nuevos** (todos opcionales, con `deny_unknown_fields`):

```json
{
  "format": "opengeoslide", "version": "0.2",
  "loads": [
    { "type": "udl",  "id": "u1", "x1": 50.0, "x2": 70.0, "q": 20.0 },
    { "type": "line", "id": "l1", "x": 40.0, "p": 20.0, "angle": 10.0 }
  ],
  "analysis": { "seismic": { "kh": 0.1, "kv": 0.0 } }
}
```

- `loads`: lista, por defecto `[]`. Va en el nivel superior, después de `water` y antes de `slope`.
  - `type` es un tag serde (`#[serde(tag = "type", rename_all = "snake_case")]`) que vale `udl` o `line`.
  - `id` es opcional (`Option<String>`); si existe, no puede repetirse.
  - **`udl`:** carga distribuida vertical sobre el terreno entre `x1` y `x2`.
    - Exige `x1 < x2`, con ambos dentro del rango x del modelo.
    - `q ≥ 0`, en kPa (psf en unidades imperiales).
  - **`line`:** carga lineal aplicada en `(x, y_top(x))`.
    - `x` dentro del rango del modelo.
    - `p ≥ 0`, en kN/m (lbf/ft en unidades imperiales).
    - `angle` en grados, en el rango [−90, 90]. Se mide **desde la vertical hacia abajo**: el positivo inclina la carga
      hacia **+x del modelo**.
- `analysis.seismic`: objeto opcional. Si falta, equivale a `kh = kv = 0`.
  - `kh` en [0, 1): coeficiente horizontal. La fuerza `kh·W` actúa **en el sentido del deslizamiento**.
  - `kv` en (−1, 1): coeficiente vertical. Con `kv > 0`, la fuerza `kv·W` actúa **hacia abajo**.
  - `kh` y `kv` se aplican solo al **peso de suelo** de la dovela `W` (con γ o γsat según §1), nunca a las cargas.
- **Validación:** todos los valores deben ser finitos. Mensajes en español con el prefijo `InvalidModel:`, por ejemplo:
  - `InvalidModel: la carga 'u1' tiene x1 >= x2`;
  - `InvalidModel: analysis.seismic.kh debe estar en [0, 1)`.

**Tipos Rust** (`model.rs`):
- `Model.loads: Vec<Load>` con `#[serde(default)]`;
- `enum Load { Udl(UdlLoad), Line(LineLoad) }`;
- `AnalysisSettings.seismic: Option<SeismicSettings>`, con `SeismicSettings { kh: f64, kv: f64 }`. Ambos campos usan
  `#[serde(default)]` y valen 0.

**Tipos TS** (`apps/web/src/engine/types.ts`):
- `Model.version: '0.1' | '0.2'`;
- `Model.loads?: Load[]`;
- `type Load = UdlLoad | LineLoad`, discriminado por `type`;
- `AnalysisSettings.seismic?: { kh?: number; kv?: number } | null`.

## F1.2 Ecuaciones con sismo y cargas (enmienda E12b)

**Notación por dovela de suelo k:**
- `s = +1` para `left_to_right` y `s = −1` para `right_to_left`;
- `W_k`: peso de suelo;
- `ȳ_k`: ordenada del **centroide ponderado por peso** del suelo de la dovela (trapecios por material, exacto, no la
  semisuma);
- `O = (xc, yc)` y `R`: centro y radio del círculo.

1. **Slicer:**
   - **Puntos de quiebre adicionales** en `x1` y `x2` de cada `udl`, y en `x ± 1e-6·ancho del modelo` de cada `line`.
     Se aplican también al re-rebanado de E11d.
   - **Cargas por dovela.** Solo cuentan en las dovelas de suelo; en las aéreas o en las descartadas por E10a no
     cuentan.
     - `Q_k = Σ q·|[x_l, x_r] ∩ [x1, x2]|`.
     - Una carga lineal pertenece a la dovela con `x_l ≤ x < x_r`. Aporta `V_k += p·cos θ` y, en el sentido de
       deslizamiento, `H^P_k += s·p·sin θ`, y se aplica en `y_g = y_top(x)`.
   - **Peso vertical total:** `W*_k = W_k·(1 + kv) + Q_k + V_k`.
   - **Fuerza horizontal en el sentido del deslizamiento:** `H_k = kh·W_k + H^P_k`.
2. **Bishop simplificado (§4.2):**
   - `F = Σ [c_k b_k + (W*_k − u_k b_k) tan φ_k] / m_α,k  ÷  Σ [W*_k sin α_k + M_k]`;
   - `M_k = [kh·W_k·(yc − ȳ_k) + H^P_k·(yc − y_g,k)] / R`.
   - La fuerza horizontal **no** entra en N′; solo aparece en el momento. X1 lo verificó contra cSlope.
   - `Invalid("no_driving")` si `Σ[W* sin α + M] ≤ 1e-6·ΣW`.
   - El resto de §4.2 (intervalo admisible E4b y valor inicial) queda igual, con `W*` en lugar de `W`.
3. **Spencer (§4.3, E10c/E11a′):**
   - `W*` y `H` entran en el equilibrio de fuerzas de cada dovela y en la ecuación de momento por dovela de Zhu.
   - Brazos de H respecto al punto medio de la base: `ȳ_k − y_b,k` para la componente sísmica y `y_g,k − y_b,k` para
     la de las cargas lineales.
   - El escritor **deriva** la forma cerrada y la forma sin polo de N′. Los criterios de aceptación de abajo son los que
     deciden; la forma de X1 §3.2 es solo una guía.
   - Se mantienen la selección de raíz (E11a′), la admisibilidad (E11b) y el barrido.
4. **Criterios obligatorios** (tests de E12b):
   - (i) **Neutralidad:** con `kh = kv = 0` y sin cargas, todos los tests existentes, la aceptación 38/38 y la batería
     20/20 + 20/20 pasan sin cambiar ninguna expectativa.
   - (ii) **Equilibrio global con sismo y cargas:** con (F, λ) convergidos, el residuo del momento global respecto a O,
     calculado de forma independiente en el test e incluyendo H y las cargas, es menor que 1e-6 del momento motor.
     También `|Eₙ| ≤ 1e-6·ΣW`.
   - (iii) **Oráculo:** sobre el círculo fijo de V047a (el de X1 §2.2, con floats exactos), en los 6 escenarios de X1
     §2.3 y además en `kh = 0,2` con una `udl`. Tolerancia |Δ| ≤ 0,1 % frente a cSlope, Bishop frente a Bishop y
     Spencer frente a MP `constant`. Los valores de referencia los obtiene el escritor ejecutando el oráculo, no se
     copian de X1.
   - (iv) **Espejo:** con x → −x, la dirección invertida y el ángulo de la carga lineal con signo invertido, el FS es
     el mismo (≤ 1e-9 relativo).
   - (v) **Monotonía:** el FS decrece estrictamente con kh ∈ {0; 0,05; 0,1; 0,2} en V047a fijo, en ambos métodos.
5. **Nota informativa** `load_outside_mass`: en la superficie reportada, alguna carga declarada no aporta a ninguna
   dovela de suelo analizada.
   - Entra en `INFORMATIVE_WARNINGS` (tests de aceptación y validación) y en `apps/web/src/engine/warnings.ts`.
   - Se agrega a la lista de códigos de `00_CONTRATOS.md` §4.5 junto con este cambio.

## F1.3 Validación de regiones (enmienda E12c; cierra el hueco con §1 detectado en X3)

En `PreparedModel::new` (`geometry.rs`), con tolerancia `tol = 1e-9 · escala del modelo`:
- **Auto-intersección:** dos aristas **no adyacentes** del mismo polígono que se tocan o se cruzan, o dos aristas
  adyacentes colineales que se superponen (una espiga). Mensaje:
  `InvalidModel: la región k se auto-intersecta (aristas i y j)`.
- **Solape entre regiones a y b.** Cuenta como solape cualquiera de estos casos:
  - un cruce **propio**: los interiores de dos aristas se cortan en un punto y no son colineales;
  - un vértice de una región **estrictamente dentro** de la otra (a más de `tol` de su borde);
  - dos polígonos iguales, aunque tengan otro orden u orientación.

  Mensaje: `InvalidModel: las regiones a y b se solapan`.
- **Permitido:** aristas compartidas, tramos colineales compartidos y uniones en T (un vértice sobre una arista de la
  otra región).
- **Piezométrica:** las x deben ser estrictamente crecientes. Mensaje: `InvalidModel: la piezométrica debe tener x
  estrictamente creciente`. Si el motor ya lo exige, solo se agrega el test.
- **Neutralidad:** los 16 casos, los 10 diferenciales y todas las fixtures existentes siguen siendo válidos. Si alguna
  falla, el escritor se **detiene y reporta**.

## F1.4 Editor web: interfaces congelables (enmienda E12d; base X3 §2.1-§2.10)

**Decisiones:**
- **Render y librerías:**
  - SVG propio con React, sin Konva;
  - DXF con parser propio acotado, y `dxf-parser@1.1.2` solo como devDependency, de oráculo en los tests;
  - CSV con `papaparse@5.7.1`;
  - PDF con `jspdf@4.2.1` importado de forma diferida, con fuente TTF embebida de licencia libre (DejaVu Sans o Noto
    Sans) que cubra á, ñ, °, ³, φ, γ, ≤ y ≥. El archivo de licencia va junto a la fuente.
- **Sismo y cargas:** se editan desde el principio, porque el esquema v0.2 ya está congelado. No hay banderas
  `features` deshabilitadas.
- **Formato al abrir y guardar:**
  - el editor **abre** v0.1 y v0.2 y **guarda siempre** `version: "0.2"`;
  - el orden de claves canónico es el de `00_CONTRATOS.md` §1, con `loads` después de `water`;
  - redondeo a 6 decimales.
- **Validación con el motor:** el motor no tiene API de validación aislada, así que la validación con el motor se
  lanza con el botón «Comprobar», que ejecuta `analyze`. Después de una edición, el diagnóstico queda `stale`. La
  validación local es inmediata, con un antirrebote de 150 ms.
- **Advertencia profesional del informe** (aprobada): «Resultado de un cálculo de equilibrio límite con OpenGeoSlide
  <versión del motor>. No sustituye el juicio del profesional responsable. Revise los avisos antes de usar el
  resultado en un diseño.»

**Archivos de tipos congelados**, que el escritor F1-0 crea **literalmente** a partir de X3 §2.1, con estos cambios:
- `EditorUi` **no** tiene `features`.
- `EditorCommand` agrega:
  - `{ type: 'seismic/set'; seismic: { kh: number; kv: number } | null }`;
  - `{ type: 'loads/set'; loads: Load[] }`;
  - `{ type: 'load/upsert'; index: number | null; load: Load }`;
  - `{ type: 'load/remove'; index: number }`.
- `Selection` agrega `{ kind: 'load'; index: number }`.
- `Issue.code` local usa el prefijo `editor.`. Códigos mínimos:
  - `editor.self_intersection`, `editor.region_overlap`, `editor.too_few_vertices`;
  - `editor.duplicate_vertex`, `editor.missing_material`, `editor.duplicate_material`;
  - `editor.out_of_range`, `editor.piezo_order`, `editor.load_range`.
- `src/io/types.ts` y `src/report/types.ts` quedan como en X3 §2.1. `ReportInput.engineName` toma su valor de
  `engine` del reporte.

**Dueños** (X3 §2.2):
- **W1:** `src/editor/state/**`.
- **W2:** `src/editor/canvas/**`. Dibuja las cargas (flechas) y el sismo (indicador kh/kv), sin interacción con las
  cargas en v1.
- **W3:** `src/editor/panels/**`, que incluye `LoadsPanel.tsx` y `SeismicPanel.tsx`.
- **W4:** `src/io/**`, `src/report/**` y `public/fonts/**`.
- **Integrador (ola B):** `App.tsx`, `main.tsx` y `src/editor/EditorApp.tsx`.
- **Regla:** W2 y W3 solo usan `EditorStore`. Los tests van en `*.test.ts` con entorno `node`, y la lógica pura se
  separa de los componentes para poder probarla.

## F1.6 Selección de raíz de Spencer (enmienda E12e; reemplaza a E11a′; evidencia en `docs/fase1/exploracion/X5.md`)

- **Regla.** Se barre **todo** el rango λ ∈ [−0,5; 1,5] con el residuo sin divisor de E11a y se refina con Brent cada
  cambio de signo. Entre las raíces **admisibles** (E11b, con cierre de fuerzas), se elige la de **menor F**. Un empate
  dentro de 1e-9 relativo lo gana la raíz de menor |λ|.
- **Nota informativa `multiple_admissible_roots`:** se emite cuando hay más de una raíz admisible y sus F difieren en
  más del 1 %.
  - Entra en `INFORMATIVE_WARNINGS`, en `warnings.ts` y en la lista de §4.5.
- Se **mantiene** `negative_lambda` como nota cuando la raíz elegida tiene λ < 0.
- **Motivo:**
  - en el barrido bicapa de X5, la regla «menor |λ|» (E11a′) quedó 35 veces más de 1 % **por encima** de cSlope (no
    conservador, hasta +5,07 %; R4-01 da +3,47 %);
  - con «menor F», 0 casos por encima, D03 y R3-01a se mantienen y la aceptación 38/38 se conserva.
  - Es la convención conservadora: de dos soluciones que cumplen el equilibrio y la admisibilidad, se reporta la menor.
- **Costo esperado:** unas 1,6 veces más evaluaciones. Objetivo: ≤ 1,8× el tiempo de Spencer actual en V047a; si se
  supera, se reporta.
- **Fuera de alcance:** R4-02 (dos raíces dentro de un paso de 0,05). El sondeo del punto medio no lo cierra (X5 §3),
  así que queda en el backlog.

## F1.7 Enmiendas tras la revisión R5 (E12f-E12j; evidencia en `docs/reviews/R5_agy.md`, reproducida por el coordinador)

- **E12f (R5-01): cargas lineales en bordes.** Reemplaza la regla «`x_l ≤ x < x_r`» de E12b.
  - Una carga lineal en `x` actúa sobre las dovelas de **suelo** del bloque analizado cuyo intervalo **cerrado**
    `[x_l, x_r]` contiene `x`, con tolerancia `1e-9·ancho del modelo`.
  - Si `x` cae en una frontera **compartida** entre dos dovelas de suelo, la carga se reparte **50/50** entre ambas.
  - Si cae en el extremo de **entrada** o de **salida** del bloque, la recibe completa la dovela extrema.
  - Fuera del bloque se emite `load_outside_mass`.
  - **Motivo:** con un intervalo semiabierto, una carga justo en el punto de entrada se descartaba: FS 0,985 frente a
    cSlope 0,920, +7,1 % no conservador, y además se rompía la simetría espejo (iv).
  - **Criterios nuevos:** carga en el extremo derecho y en el extremo izquierdo, en `ltr` y en `rtl`, frente a cSlope
    (≤ 0,1 %); carga sobre un vértice del terreno o sobre una frontera de dovela, con espejo ≤ 1e-9.
- **E12g (R5-02): precisión del `.ogs.json`.**
  - La web **no redondea** números al abrir, al calcular ni al guardar. `saveOgsJson` serializa con la representación
    de ida y vuelta más corta de JS (`JSON.stringify`).
  - El redondeo cosmético queda solo para **mostrar** valores en la UI.
  - **Criterio:** los 21 casos y los 14 modelos de la batería, abiertos con `openOgsJson` y guardados con
    `saveOgsJson`, dan **bit a bit** el mismo reporte del motor que el archivo original. Esto vale también para los
    modelos de frontera de R5-02 (`min_m_alpha = 1e-7` y `kh`, `kv` o `ru` = 0,9999999).
- **E12h (R5-07): entradas estrictas en la web.**
  - `openOgsJson` **rechaza**, con el mismo criterio del motor (`deny_unknown_fields`):
    - los campos desconocidos;
    - `version: "0.1"` cuando `loads` no está vacío o `analysis.seismic` no es nulo.
  - Un `loads: []` o un `seismic: null` con `"0.1"` cuentan como ausentes, igual que en el motor. El JSON Schema
    v0.2 se alinea con esa regla y con las cotas de §4.5 del motor.
- **E12i (R5-03/R5-04): resultados en el informe y en CSV.**
  - Toda polilínea de superficie se arma en el orden de **x creciente**: `x_left` de cada dovela ordenada, más el
    `x_right` de la última.
  - El CSV de superficie trae la columna `estado` y solo exporta los métodos `converged`.
  - El CSV de resultados trae la columna `avisos`.
  - `lambda` solo se muestra si el método convergió. Las exportaciones se bloquean si el resultado no corresponde a la
    revisión actual.
  - El dibujo del PDF no se rotula «Superficie crítica» si ningún método convergió.
- **E12j (R5-10): paridad entre el editor y el motor.**
  - El motor rechaza `material.id` vacío.
  - El editor rechaza las regiones degeneradas (área ≤ 1e-12·escala², igual que el motor) y los modelos sin `surface`
    ni `search`. Para ello se agregan los códigos congelados `editor.degenerate_region` y `editor.no_surface`.
  - Un vértice consecutivo repetido es un **aviso** en el editor, no un error, porque el motor lo acepta.
- **R5-05 (E12e con N′ mayor):** se documenta como limitación conocida. Antes de cerrar la Fase 1 se evalúa una regla
  combinada: descartar las raíces `negative_effective_normal_major` si existe otra admisible y luego elegir la de menor
  F (exploración X7). La decisión la toma el coordinador con esos números.

## F1.5 Gates de la Fase 1 (además de §5 de `00_CONTRATOS.md`)

- **Motor:**
  - `cargo fmt --all --check`;
  - `cargo clippy --workspace --exclude ogs-py --all-targets -- -D warnings`;
  - `cargo test -p ogs-core --release --no-fail-fast`, y también con `--features parallel`;
  - aceptación 38/38 o más;
  - batería diferencial 20/20 + 20/20 o más.
- **Web:** `cd apps/web && pnpm install --frozen-lockfile && pnpm test && pnpm build`.
- **Python:**
  ```
  uv run --python 3.13 --no-project --with cslope==0.1.0 --with shapely --with jsonschema --with pytest python -m pytest -q verification
  ```
- **Visible:** URL local con `vite preview` y el WASM real, más una captura en Chrome headless. **No** se usa el puerto
  5180, que es la demo del coordinador. Los escritores usan 5182 a 5189.
