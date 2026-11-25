#!/usr/bin/env bash
# Copia LICENSE y NOTICE de la raíz del repositorio a crates/ogs-py/ para que maturin los incluya en
# `*.dist-info/licenses/` (PEP 639, `license-files` en pyproject.toml). Ejecutar ANTES de `maturin build`.
# Las copias están en .gitignore: la fuente de verdad sigue siendo la raíz (no se edita el NOTICE).
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
root="$(cd "$here/../.." && pwd)"
cp -f "$root/LICENSE" "$here/LICENSE"
cp -f "$root/NOTICE" "$here/NOTICE"
echo "LICENSE y NOTICE copiados a $here"
