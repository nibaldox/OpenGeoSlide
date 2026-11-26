# Parches de W1v para archivos de otros escritores

Los dos dependen de que `verification/cases/` tenga los casos del lote 0 completo (61 casos, 120 checks). Se aplican en
el mismo merge que ese lote. Ambos están verificados con `git apply --check` sobre la base `a970984`.

| parche | archivo | por qué |
|---|---|---|
| `test_schema.patch` | `verification/tools/test_schema.py` (W0a) | dos pruebas cuentan los casos con un literal (21 y 16); ahora leen el índice (`INDEX.md`) |
| `exampleTitles.patch` | `apps/web/src/examples/exampleTitles.ts` | la prueba «hay un nombre para cada caso publicado y ninguno de más» exige una entrada en español por cada caso de `verification/cases/`: faltan los 40 casos nuevos |
