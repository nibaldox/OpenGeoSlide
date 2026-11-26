#!/usr/bin/env bash
# Compila una copia de la web con el gancho temporal `window.__ogsStore` (lo usa w1f_canvas.mjs) en $TMPDIR/f3iw-hook-dist y deja
# EditorApp.tsx como estaba: el gancho NO se commitea. Después:
#   (cd apps/web && pnpm exec vite preview --outDir $TMPDIR/f3iw-hook-dist --port 5187 --strictPort --host 127.0.0.1)
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
f="$repo/apps/web/src/editor/EditorApp.tsx"
cp "$f" "$f.orig"
trap 'mv "$f.orig" "$f"' EXIT
sed -i 's|^  const \[store\] = useState<EditorStoreWithSave>(() => createEditorStore(initialDoc().doc, null));|&\n  (window as unknown as { __ogsStore?: unknown }).__ogsStore = store;|' "$f"
grep -q '__ogsStore' "$f"
cd "$repo/apps/web"
pnpm exec vite build --outDir "${TMPDIR:?}/f3iw-hook-dist" --emptyOutDir
