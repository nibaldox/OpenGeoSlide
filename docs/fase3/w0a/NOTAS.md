# W0a: notas para el coordinador y para la ola 1

## Archivo ajeno tocado

`crates/ogs-core/src/methods/mod.rs` (de W1b): un solo brazo en `solve()`,
`MorgensternPrice | JanbuSimplified | JanbuCorrected => unimplemented!("F3-W1b")`.
Sin él el crate no compila con los métodos nuevos (el `match` es exhaustivo). El diff está en
`methods-mod-stub.patch` (`git apply --check` contra `a970984`). W1b reemplaza ese brazo.

## Interfaces congeladas

- `strength::resolve(&ResolvedMaterial, y_base_mid) -> (c, tan_phi)` (`pub(crate)`). `ResolvedMaterial` vive ahora en
  `strength.rs` y gana `profile: Option<SuProfile>`.
- `surface::Surface { Circle(Circle), Polyline(Polyline) }` con `from_spec`, `y_at`, `ground_crossings` (devuelve el
  `Tramo` del slicer), `break_points`, `fit_to_ground` (error = código de estado `Invalid`) y `to_report`. Todo `pub(crate)`
  salvo `from_spec` y `to_report`. La polilínea es `unimplemented!("F3-W1a")`.
- `surface::validate_polyline(points, Option<width>)` **no** es stub: el formato de F3.3 ya se valida.
- `report::SurfaceOut` (untagged). `MethodReport.correction_factor` e `.interslice` son opcionales; `lib.rs` rellena
  `interslice` (con `half_sine` por defecto) y deja `correction_factor: None` para W1b.
- `lib.rs::analyze_method` tiene el despacho de los stubs: polilínea fija sin búsqueda → `F3-W1a`; método nuevo → `F3-W1b`.
  El resto del cuerpo sigue trabajando con `Circle`: W1a lo recablea.

## Decisiones a revisar

1. **Texto de la compuerta**: `<campo>` es una ruta, por ejemplo `materials[0].model = "undrained"`,
   `materials[0].strength_datum`, `analysis.surface.type = "polyline"`, `analysis.methods = "morgenstern_price"`,
   `analysis.interslice`. Orden: material por material (modelo y luego sus campos), polilínea, métodos, `interslice`.
2. **Bishop + polilínea**: el error solo se da cuando la polilínea es la superficie que se analiza (sin `search`). Con
   `search`, la superficie fija se ignora y no se rechaza. El esquema JSON lo refleja igual.
3. **Un `null` cuenta como campo ausente** (serde `Option`): `strength_limit: null` en un 0.2, o `cohesion: null` en un
   `undrained`, se aceptan. El esquema 0.3 lo replica.
4. **`resolve_sliding` paso 3** sigue mirando solo el círculo fijo: una polilínea fija en un talud simétrico da hoy
   «indique slope.direction» y no el stub. Es el paso 3 de F3.3, tarea de W1a.
5. **`ogs bench --method all`** sigue siendo bishop + spencer; los métodos nuevos se piden por nombre (y el bench sube la
   versión del caso a 0.3 para ellos).
6. **`tests/f3_oracle.rs` queda en rojo a propósito** (14 de 17 fallan en el stub), así que `cargo test` completo falla
   hasta que W1a y W1b integren. Los demás binarios de test están en verde.
7. No incluí el criterio 2 de F3.8 (residuo global de M-P/Spencer/Janbu): el informe no expone las fuerzas entre
   dovelas, así que se prueba en la ola 1 con acceso a los internos.
8. `test_web_roundtrip.py` (no es mío) cuenta `== 21` casos con un literal: W1v debe leer el índice.
9. Mensajes de los estados `Invalid` nuevos y su alta en la lista E6 / `warnings.ts`: sin cambios aquí (contrato F3.7:
   mismo merge de integración). Las constantes `POLYLINE_NO_GROUND_CROSSING` y `POLYLINE_OUTSIDE_GROUND` están en
   `surface.rs`.
