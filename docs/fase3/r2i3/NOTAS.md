# R2-I3: documentación y bindings del bloque de refuerzos

Escritor I3, rama `f3r2i3-docs`, base `5c63019`. Cifras leídas de `X17.md`, del contrato o de `ogs analyze` y `ogs-py` sobre
los mismos modelos; ninguna escrita de memoria.

## Qué se documentó

| Archivo | Contenido |
|---|---|
| `docs/formato-ogs-json.md` | Formato v0.4 completo: cinco tipos, `pullout` (`bond`, `interface`, `development`), activo y pasivo, dirección (E14m-1) y regla de compresión, ejemplo con el anclaje activo, 11 fragmentos por tipo y estado, tablestaca anclada, `reinforcement_forces` con los cuatro `status`, las tres notas y 13 rechazos |
| `docs/limitaciones.md` | Límite estructural de F4.8 destacado, lo pospuesto (F4.1), `no_capacity`, activo comprimido (E14m-1) frente al oráculo instalado, discretización de `interface`, VP 58, búsqueda con refuerzos |
| `docs/tools/validar_ejemplos.py` | Esquema 0.4 por defecto; marcas nuevas `fuerzas=` y `avisos=` (y `fos=` en fragmentos) |
| `docs/desarrollo.md` | Esquema 0.4, validador y pruebas de `ogs-py` con maturin en `$TMPDIR` |
| `CHANGELOG.md` | «Unreleased» del bloque, E14a a E14m |
| `README.md` | Solo «Qué es», «Limitaciones conocidas» e «In English» |
| `apps/web/src/onboarding/helpContent.ts` | Cuatro entradas de glosario y cuatro limitaciones de refuerzos; test nuevo `helpContent.v04.test.ts` |
| `crates/ogs-py/` | Docstring, README y `tests/test_v04.py` |
| `crates/ogs-cli/src/main.rs` | Solo `USAGE` |

## Hallazgo: la búsqueda esquiva el refuerzo

Con la búsqueda por defecto de ACADS 1(a) (`examples/acads1a.ogs.json`, versión 0.4) y el anclaje activo de 100 kN de
F4.13-1, Bishop da 1,0623 con la nota `reinforcement_outside_mass` y **sin ninguna fuerza** en `reinforcement_forces`: el
círculo crítico (xc 36,61, yc 46,55, r 18,54) no cruza el anclaje. Sin refuerzos da 0,9851. Con una tablestaca activa de
120 kN por metro en x = 40, Bishop da 1,1553 y el elemento queda `outside_mass`, frente a 1,4557 con el círculo fijo. Está
en `docs/limitaciones.md`, en la Ayuda y en un test de `ogs-py`. Es una consecuencia de F4.4 y no un error, pero un
usuario que dibuja un refuerzo y ejecuta la búsqueda por defecto puede no ver ningún efecto.

## Pendientes fuera de mi alcance

- `README.md`, sección «CLI» (no mía): dice «El formato del modelo (v0.1 a v0.3)». Debe decir v0.1 a v0.4 al publicar.
- La tabla de verificación del README y `docs/verificacion.md` son de I1.
- El texto de Ayuda dice que el panel propone `end1_capacity = tensile_capacity` al crear un anclaje: ya lo hace
  `reinforcementForm.ts:156`.
