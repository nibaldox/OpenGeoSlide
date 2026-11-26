// R9-11c: todo diálogo modal propio devuelve el foco con `restoreFocus` (ui/focusReturn.ts), que nunca lo deja en <body>.
// El patrón anterior, `if (previous?.isConnected) previous.focus()`, no hacía nada si el disparador ya no existía o estaba oculto
// (elemento de un menú cerrado) y dependía por accidente del `requestAnimationFrame` de `DropdownMenu`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe.each(['editor/app/ImportDialogs.tsx', 'ui/HelpDialog.tsx', 'ui/ConfirmDialog.tsx'])('%s', (file) => {
  const text = code(read(file));
  it('devuelve el foco con restoreFocus', () => {
    expect(text).toMatch(/import\s*\{[^}]*\brestoreFocus\b[^}]*\}\s*from\s*'[^']*focusReturn'/);
    expect(text).toMatch(/\brestoreFocus\(/);
  });
  it.skipIf(file === 'ui/ConfirmDialog.tsx')('no desplaza la página al devolver el foco (preventScroll)', () => {
    expect(text).toMatch(/restoreFocus\(null, previous, \{ preventScroll: true \}\)/);
  });
  it('no usa previous?.isConnected && previous.focus()', () => {
    expect(text).not.toMatch(/previous\??\.isConnected/);
    expect(text).not.toMatch(/previous\??\.focus\(\)/);
  });
});
