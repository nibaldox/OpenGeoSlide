# W1a: notas para el coordinador y para el integrador

Rama `f3w1a-polilinea`, base `a77eb5c` (código de `b133003`). Archivos tocados: `crates/ogs-core/src/{surface,slicer,geometry,lib}.rs`
y `crates/ogs-core/tests/f3_polyline.rs` (nuevo). `methods/*` y `tests/f3_oracle.rs` sin cambios.

## Qué hace

- **`surface.rs`:** `y_at` (exacta en los vértices), `ground_crossings`, `break_points`, `below_base`, `moment_arm`,
  `fit_to_ground`. El terreno se corta en tramos rectos entre las abscisas de vértice del modelo (`GroundPiece`, con los
  límites laterales en cada abscisa, por las caras verticales).
- **Ajuste (F3.3):** cada extremo se ajusta por separado, el derecho por espejo (`x → −x`) del mismo código, así que el
  espejo es exacto por construcción.
  - bajo el terreno (`h < −1e-9·escala`): se prolonga por su tramo hasta el **primer** cruce;
  - sobre el terreno (`h > 1e-9·escala`): se recorta en el primer cruce de sobre a bajo, y se descartan los vértices de
    fuera;
  - sobre el terreno dentro de la tolerancia: se conserva tal cual.
  - Después, admisibilidad: vértices interiores estrictamente bajo el terreno (bajo el lado más bajo en una cara
    vertical) y dentro del modelo, y ningún tramo sobre el terreno (se admite rozar un vértice).
- **`slicer.rs`:** genérico sobre `Surface` (`slice_surface_of`). `slice_circle*` y `slice_surface*` conservan su firma y
  envuelven el círculo. El círculo ejecuta la misma aritmética de antes. En la polilínea: los vértices son nodos
  obligatorios (una división uniforme a menos de `min_width` de un vértice cede), `driving_extra` vale 0, y rigen E2,
  E10a, E11, `truncated_mass` y `water_above_ground`. La comprobación de extremos de bloque solo mira la base del
  modelo (no hay paredes laterales ni mitad superior).
- **`geometry.rs`:** `resolve_sliding`, paso 3, usa los extremos de la polilínea ajustada.
- **`lib.rs`:** sin los stubs de superficie. `opts.circular = false` si la superficie analizada es una polilínea fija sin
  `search`. El informe trae la polilínea ajustada. Un ajuste imposible da `Invalid` con la razón en `warnings`, sin
  dovelas y con la polilínea tal como se escribió.

## Decisiones a revisar

1. **Quité también el guard `F3-W1b` de `lib.rs`** (`if !matches!(method, Bishop | Spencer) { unimplemented!("F3-W1b") }`).
   W1b no puede tocar `lib.rs`; sin quitarlo, sus métodos nunca llegarían a `methods::solve`. El stub de
   `methods/mod.rs:239` queda: los 13 tests rojos de `f3_oracle.rs` fallan ahí (`not implemented: F3-W1b`), ninguno en
   `F3-W1a`.
2. **Un ajuste imposible es `Invalid`, no un error.** `polyline_no_ground_crossing` y `polyline_outside_ground` salen en
   `status: invalid`, `fos: null`, `warnings: [código]`. Un corte que falla después (por ejemplo, bajo la base del
   modelo) sí es `NoValidSurface: la polilínea sale del modelo`, como en el círculo. Con `direction: auto` y una
   polilínea que no se puede ajustar, el sentido sale de los extremos escritos, para que el informe diga la razón en
   lugar de «indique slope.direction».
3. **Primer cruce, a diferencia de cSlope.** cSlope exige que la recta prolongada esté sobre el terreno en la pared del
   modelo (`f(t_max) ≥ 0`) y rechaza si no. F3.3 pide el primer cruce. Con 300 polilíneas aleatorias sobre V047a (semilla 7)
   hay 8 casos que cSlope rechaza («the polyline does not pass through the soil») y OGS ajusta, todos por esta razón. En los
   66 que ambos aceptan, los extremos ajustados coinciden a 1e-6. Con otras 800 (semillas 11 y 12), 92 los aceptan ambos y
   en 83 convergen los dos: el FS de Spencer contra el de M-P `constant` de cSlope (200 dovelas) difiere en 1,6e-4 como
   máximo.
4. **Cara vertical.** Una polilínea que sale del suelo por una cara vertical y vuelve a entrar bajo el terreno inferior es
   `polyline_outside_ground` (F3.3: ningún tramo sobre el terreno). cSlope la corta en la cara y analiza el primer bloque.
   En un modelo con una cara de 10 m y 300 polilíneas aleatorias (semilla 3), cSlope acepta 15 que OGS rechaza por esta
   razón, y en 9 de los 20 que ambos aceptan la prolongación de cSlope atraviesa aire (por bisección, no por el primer
   cruce) y los extremos difieren; en los 11 restantes coinciden y el FS difiere en 7,6e-6 como máximo. Las polilíneas
   que están de un solo lado de la cara no tienen este problema, salvo la prolongación por aire.
5. **Vértices de la polilínea fuera del rango x del modelo:** un extremo fuera es `polyline_no_ground_crossing` (entra por
   la pared), uno interior es `polyline_outside_ground`.
6. **Una polilínea cuyo extremo está sobre el terreno y todos los demás vértices también** (por ejemplo, dos puntos sobre
   el terreno) no entra en suelo: `NoValidSurface: la polilínea no corta el terreno`.
7. **Una polilínea admisible no produce dovelas de aire.** Un vértice interior sobre el terreno ya es
   `polyline_outside_ground`. Las guardas E2, E10a, `truncated_mass` siguen en el slicer y se prueban con una polilínea sin
   ajustar (`a_polyline_over_the_notch_gives_air_slices_and_keeps_the_entry_block`).
8. **Spencer en polilínea arranca desde Bishop** (el código de `spencer.rs` no cambió): `driving_extra = 0` da un FS de
   Bishop bien definido como valor de arranque, y converge. W1b lo cambia a F₀ de Janbu (E13f).
9. **Visibilidad:** `fit_to_ground`, `break_points`, etc. siguen `pub(crate)`. Nuevo `pub`: `slicer::slice_surface_of`.
10. **Mensajes:** `surface_reason` dice «la polilínea …» cuando la superficie es una polilínea; los del círculo no cambian.
11. Los códigos `polyline_no_ground_crossing` y `polyline_outside_ground` siguen sin entrar en la lista E6 ni en
    `warnings.ts`: es del merge de integración (F3.7). `changelog.patch` agrega la entrada de la ola 1 a `CHANGELOG.md`.

## Polilínea inscrita en el círculo de V047a (criterio 6 de F3.8, con Spencer)

N cuerdas con los vértices sobre el arco inferior, entre los extremos del bloque principal (el arco vuelve a entrar en la
rampa en x = 30,0014, y sale en la cresta plana en x = 51,2911; el tramo previo, 29,09 < x < 29,99, es una lente de
0,0036 m de profundidad que el slicer descarta con `truncated_mass`). 2000 dovelas, `tolerance 1e-8`.
FS de Spencer en el círculo: 0,9840572410.

| N | FS | error contra el círculo | razón con el N anterior |
|---:|---:|---:|---:|
| 8 | 0,987042550387 | +2,9853e-3 | |
| 16 | 0,984789590320 | +7,3235e-4 | 4,076 |
| 32 | 0,984240479785 | +1,8324e-4 | 3,997 |
| 64 | 0,984103080315 | +4,5839e-5 | 3,997 |

Orden 2 (razón 4). El FS está por encima del círculo, como corresponde a cuerdas inscritas.

La polilínea de F3.8 con Spencer: **0,9991303317**, λ = 0,433513, 43 iteraciones. El oráculo no tiene Spencer, pero Spencer
es M-P `constant` (F3.4) y cSlope da 0,9991304877 para M-P `constant`: Δ = 1,6e-7 (relativo).

## Otros resultados

- **Equilibrio global (criterio 2), polilínea de F3.8, con extremos prolongados y inscrita N = 16, en los dos sentidos:**
  `E_n/ΣW`, `ΣFx/ΣW`, `ΣFy/ΣW` y el momento respecto de (20, 15) y de (75, 60) sobre el momento motor, todos ≤ 2,1e-12
  (el criterio pide 1e-6). Calculado con `spencer_interslice` y `spencer_direct_normals`, y con una comprobación de que
  el mismo cálculo con la cresta al lado equivocado da un residuo > 1e-3.
- **Espejo (criterio 4) con Spencer:** 4 polilíneas × (kh = 0 y 0,15), FS iguales a 1e-9 (iguales en todos los dígitos
  impresos) y la polilínea ajustada es la imagen del espejo.
- **Diferencial contra cSlope** (`diferencial/*.py`, necesitan el entorno del oráculo y los binarios de la rama): ver las
  decisiones 3 y 4.

## Hashes

Commits de la rama sobre `a77eb5c`:

- `e2487d3` operaciones de la polilínea en `surface.rs`
- `930cff5` slicer genérico, `resolve_sliding` y `lib.rs`
- `464894e` tests `f3_polyline.rs` y de slicer
- `7107212` tests de primer cruce y cara vertical
- el commit de estas notas, el parche del CHANGELOG y la identidad (último de la rama)

`identidad_sha256.txt` (sha256 de stdout + stderr + código de salida de cada modelo; los mismos 36 valores en el binario de
`b133003` y en el de la rama) y `identidad.py` (el script que los genera).
