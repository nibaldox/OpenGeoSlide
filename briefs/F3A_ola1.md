# Brief F3A-1: ola 1 de la Fase 3a, cuatro escritores Sonnet en paralelo

Responde en **español neutro, sin voseo**. Identificadores en inglés.

**Lee primero, completos:**
- `briefs/02_CONTRATOS_FASE3.md`, normativo, con la enmienda de F3.4 sobre el código compartido de Spencer;
- `briefs/F3A_ola0.md`, cuyas reglas comunes siguen vigentes;
- `docs/fase3/exploracion/X12.md` y `X13.md`;
- `docs/fase3/w0a/NOTAS.md`.

**Base:** la rama `f3a-integracion`, en `b133003`. Contiene la ola 0 (W0a núcleo y W0b tipos web) y dos campos
congelados por el coordinador: `SolveOptions.circular` y `MethodResult.correction_factor`. Hoy fallan en rojo 14 tests
de `crates/ogs-core/tests/f3_oracle.rs`, por diseño, en los stubs `F3-W1a` y `F3-W1b`.

**Si el contrato no se puede cumplir, detente y repórtalo con números.** No ajustes tolerancias ni valores de
referencia.

## Reglas comunes
- Las de `briefs/F3A_ola0.md`: tu worktree, tus archivos, un test que falla antes de cada cambio, commits con rutas
  explícitas y **sin push**. Si necesitas un cambio en un archivo ajeno, déjalo como parche en `docs/fase3/<id>/`.
- **Identidad, que vale para todos:** los 36 modelos de referencia dan la misma salida de `ogs analyze`, **byte a
  byte**, que el binario de `b133003`. Son `verification/cases/*.json`, `verification/differential/cases/*.ogs.json` y
  `examples/acads1a.ogs.json`. Compáralos con `sha256sum` contra un binario compilado en un worktree separado y
  detached en `b133003`, y **bórralo al final**.
- **Los escritores web** todavía no tienen motor para polilíneas ni para los métodos nuevos, que llegan en el merge.
  Prueban la UI con informes falsos y validación local, y **no deben** pulsar «Comprobar» con esos modelos en Chrome.
  La prueba de extremo a extremo la hace el integrador.

---

## W1a: superficie polilínea en el motor (worktree `f3w1a`, rama `f3w1a-polilinea`)

**Archivos tuyos:**
- `crates/ogs-core/src/{surface.rs,slicer.rs,geometry.rs,lib.rs}`;
- tests nuevos `crates/ogs-core/tests/f3_polyline*.rs`.

**No toques** `methods/*`, que es de W1b.

**Tareas:**
1. **Operaciones de la polilínea en `surface.rs`:** `y_at`, cruces con el terreno, puntos de quiebre y
   `fit_to_ground`, con la prolongación y el recorte de F3.3. Tests unitarios de cada caso:
   - extremo bajo el terreno, que se prolonga;
   - extremo sobre el terreno, que se recorta;
   - extremo que no corta el terreno: `polyline_no_ground_crossing`;
   - vértice sobre el terreno: `polyline_outside_ground`;
   - roce exacto con un vértice del terreno, que se admite.
2. **`slicer.rs` genérico sobre `Surface`:**
   - los vértices ajustados son nodos obligatorios;
   - las bases son rectas, con α, `base_length` y `y_base_*` exactos;
   - `driving_extra` y los campos que dependen del centro valen 0 en la polilínea. Documenta por qué: Bishop no se
     ofrece en polilíneas, según F3.6;
   - todas las guardas de bloque y de método existentes siguen vigentes: E2, E11, `truncated_mass` y
     `water_above_ground`.
   - **El círculo no cambia ni un bit.**
3. **`resolve_sliding`, paso 3:** usa los extremos de la polilínea ajustada.
4. **`lib.rs`:**
   - quita los dos stubs (`lib.rs:340`, `343` y `372`);
   - corta y resuelve la polilínea fija con `opts.circular = false`;
   - el informe trae la polilínea ajustada.
   - **El stub de métodos de `methods/mod.rs` queda**, porque es de W1b.
5. **Tests:**
   - **Una polilínea inscrita en el círculo de V047a con N = 8, 16, 32 y 64 cuerdas.** Con **Spencer** (el único
     método disponible para ti), el FS tiende al de Spencer en el círculo con orden O(1/N²). Reporta la tabla: N, FS y
     error.
   - **Espejo** con Spencer sobre la polilínea de F3.8.
   - **Equilibrio global de Spencer** en una polilínea: residuo de momento respecto de dos puntos distintos menor que
     `1e-6` del momento motor, calculado con `spencer_interslice` de forma independiente (criterio 2 de F3.8).
   - La polilínea de F3.8 con Spencer. Se informa el valor; no hay referencia del oráculo para Spencer.
   - Los tests de polilínea de `f3_oracle.rs` dejan de fallar en `F3-W1a` y pasan a fallar en `F3-W1b`. Confírmalo.

**Presupuesto:** unas 90 iteraciones. Si no alcanza, el orden de prioridad es 1, 2, 4, 3, 5.

## W1b: Morgenstern-Price y Janbu (worktree `f3w1b`, rama `f3w1b-metodos`)

**Archivos tuyos:**
- `crates/ogs-core/src/methods/{mod.rs,spencer.rs,bishop.rs}`;
- nuevos: `methods/morgenstern_price.rs` (o un solver genérico en f dentro de `spencer.rs`) y `methods/janbu.rs`;
- tests nuevos `crates/ogs-core/tests/f3_methods*.rs`.

**No toques** `lib.rs` ni el slicer, que son de W1a.

**Tareas:**
1. **Morgenstern-Price** (E13d), con:
   - las cinco funciones y su ξ;
   - f congelada en los tramos aéreos;
   - el residuo ρ(λ) generalizado;
   - el barrido sobre λ·f̄;
   - la selección de raíz E12e y las guardas E4b, E7c y E9c con λ·f.
   - **Identidad:** M-P `constant` da el mismo F que Spencer, con `|ΔF| ≤ 1e-10`, y Spencer no cambia ni un bit.
2. **Janbu simplificado y corregido** (E13e):
   - F₀ con el cierre de fuerzas en λ = 0;
   - f₀ con d, L y b₁ globales, como en cSlope;
   - estado y guardas evaluados en F₀;
   - `MethodResult.correction_factor` en el corregido.
3. **E13f:**
   - con `opts.circular == false`, Spencer y M-P arrancan desde F₀ de Janbu simplificado, o desde 1 si F₀ no
     converge;
   - Bishop con `circular == false` da `Invalid`, como defensa, aunque la validación ya lo impide.
   - **Con `circular == true` nada cambia.**
4. **Despacho** en `methods/mod.rs`: quita el stub `F3-W1b`.
5. **Tests**, por la vía de `lib.rs` y no solo con dovelas sintéticas:
   - todos los valores de F3.8 **sobre el círculo**: M-P constante y medio seno, y Janbu simplificado y corregido;
   - identidad de M-P constante con Spencer en los 21 casos;
   - espejo;
   - equilibrio global de M-P con medio seno (momento respecto de dos puntos) y de Janbu (fuerza horizontal), con
     `1e-6`;
   - funciones de interfaz con valores conocidos en ξ = 0; 0,1; 0,2; 0,5; 0,8 y 1;
   - `data_points` con interpolación.

   Los tests de círculo de `f3_oracle.rs` deben pasar; los de polilínea siguen en `F3-W1a` hasta el merge. Agrega
   M-P y Janbu a `ogs bench --method all` **solo** si cabe en tus archivos; si no, déjalo como parche para
   `crates/ogs-cli`.

**Presupuesto:** unas 95 iteraciones. Si no alcanza, el orden de prioridad es 1, 2, 4, 3, 5.

---

## W1e: modelado y análisis en la web (worktree `f3w1e`, rama `f3w1e-modelado`, puerto 5186)

**Archivos tuyos:**
- `apps/web/src/editor/panels/{MaterialsPanel.tsx,AnalysisPanel.tsx,SurfacePanel.tsx,forms.ts}` y sus tests;
- `apps/web/src/editor/state/{validateLocal.ts,units.ts,geotech.ts}` y sus tests;
- `apps/web/src/io/ogsJson.ts`;
- `apps/web/src/App.tsx`: la vista Casos, `ALL_METHODS` y las etiquetas;
- `apps/web/src/onboarding/helpContent.ts`: glosario y limitaciones.

**Tareas:**
1. **Materiales:** selector de modelo «Mohr-Coulomb» o «No drenado (Su)».
   - Con «No drenado» se muestran Su y, opcionalmente, «Su variable con la cota»: cota de referencia, gradiente y
     límite.
   - Las unidades van en la etiqueta (kPa, m, kPa/m; psf, ft, psf/ft).
   - El cambio de modelo es un solo paso deshacible.
   - Los nombres accesibles son estables: «Material <id>: Su», etc.
2. **Análisis:**
   - los cinco métodos con las etiquetas de F3.9;
   - selector de función para M-P, con una tabla de puntos editable para «Definida por puntos», validada (ξ
     creciente de 0 a 1, f ≥ 0 y algún f > 0);
   - Bishop deshabilitado con una explicación visible cuando la superficie es una polilínea fija (F3.6).
3. **Superficie:** «Círculo» o «Polilínea».
   - Con «Polilínea», una tabla de puntos x, y editable: agregar, quitar y reordenar, con x estrictamente creciente.
   - Al pasar a polilínea, se propone una polilínea inicial razonable: la cuerda de 5 puntos del círculo actual, o
     una del pie a la cresta.
   - Se usa `surface/set` con `SurfaceSpec` polilínea.
4. **`validateLocal`:** las mismas reglas y mensajes que el motor (polilínea, `interslice`, no drenado, Bishop con
   polilínea), con un test por regla.
5. **`units.ts`:** convierte `undrained_strength` y `strength_limit` como esfuerzo, `strength_datum` como longitud,
   `strength_gradient` como esfuerzo por longitud, y los puntos de la polilínea.
   - Test de ida y vuelta.
   - La conversión debe dejar el FS invariante: compruébalo con el motor nativo **en un modelo no drenado con
     círculo**, que ya funciona en `b133003`.
6. **`ogsJson.ts`:**
   - abre 0.1, 0.2 y 0.3;
   - al guardar, usa `"0.2"` si no hay ningún campo de 0.3 y `"0.3"` si hay alguno (F3.9).
   - Test de ida y vuelta de los 21 casos, que deben seguir en 0.2 y bit a bit, y de un modelo 0.3.
7. **Casos:** los métodos nuevos en la tabla y en el selector.
8. **Ayuda:** glosario de M-P, función de interfaz, Janbu corregido y f₀, Su y polilínea, más la limitación «Bishop no
   se ofrece en superficies no circulares».

**Chrome** (sin calcular polilíneas):
- crear un material no drenado;
- calcular un modelo no drenado con círculo y Bishop, que sí funciona ya;
- pasar a polilínea y editar sus puntos;
- ver Bishop deshabilitado y la validación;
- axe en claro y oscuro.

Corre también los recorridos de regresión de `docs/fase2/ux/*-e2e/` que tocan tus paneles.

**Presupuesto:** unas 90 iteraciones.

## W1f: superficie en el lienzo y salidas (worktree `f3w1f`, rama `f3w1f-salidas`, puerto 5187)

**Archivos tuyos:**
- `apps/web/src/editor/canvas/*`: lienzo, tiradores, hitTest, gestos, teclas y layout;
- `apps/web/src/editor/EditorApp.tsx`;
- `apps/web/src/engine/surface.ts`, el puente de W0b;
- `apps/web/src/render/{scene.ts,drawSection.ts}`;
- `apps/web/src/ui/{ResultsTable.tsx,Legend.tsx,legendItems.ts}`;
- `apps/web/src/io/csv.ts`;
- `apps/web/src/report/**`.

**Tareas:**
1. **Lienzo del editor:**
   - dibuja la polilínea fija, del color de la superficie y con sus vértices como tiradores;
   - los vértices se arrastran con puntero y táctil y se recorren con `[`, `]` y flechas, como los demás tiradores
     (U2C y U6-K);
   - al arrastrar, se impide que la x cruce a la del vecino, con un aviso;
   - el resultado calculado se dibuja como la polilínea **ajustada** del informe.
   - Usa `surface/set`.
2. **Casos** (`scene.ts`, `drawSection.ts`): dibuja la superficie del informe, sea círculo o polilínea, y las dovelas.
3. **Salidas:**
   - **`ResultsTable`:** en la columna de superficie, «Polilínea (n puntos)» o el centro y el radio; muestra f₀ en
     Janbu corregido y la función en M-P.
   - **CSV de superficie:** en una polilínea, una fila por punto con las columnas `x_m`, `y_m` y `unidades`, compatible
     con RFC 4180.
   - **PDF:** describe la superficie, el método con su función y f₀, y dibuja la polilínea en la figura.
   - Reemplaza el puente `circleSpec()`/`reportCircle()` donde ya no haga falta, y documenta lo que quede.
4. **Leyenda:** «Superficie fija (polilínea)», si corresponde.

**Tests** con informes falsos que tengan superficie `{points}`, `correction_factor` e `interslice`.

**Chrome:**
- editar los vértices de una polilínea con puntero, teclado y táctil;
- Casos y PDF con un informe falso de polilínea, inyectado por el camino de importación que usa la vista Casos, o
  con un fixture;
- axe en claro y oscuro.

Corre también los recorridos de regresión de `docs/fase2/ux/*-e2e/` de lienzo y salida.

**Presupuesto:** unas 90 iteraciones.
