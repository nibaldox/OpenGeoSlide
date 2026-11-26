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
  it('no usa previous?.isConnected && previous.focus()', () => {
    expect(text).not.toMatch(/previous\??\.isConnected/);
    expect(text).not.toMatch(/previous\??\.focus\(\)/);
  });
});

// `#main-content` es alto: enfocarlo sin `preventScroll` sube la página hasta su inicio (rompía el toque de «Dividir región» en u4m_split_touch).
describe.each(['editor/app/ImportDialogs.tsx', 'ui/HelpDialog.tsx'])('%s: no desplaza la página', (file) => {
  it('devuelve el foco con preventScroll', () => {
    expect(code(read(file))).toMatch(/restoreFocus\(null, previous, \{ preventScroll: true \}\)/);
  });
});
