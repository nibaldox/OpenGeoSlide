// Ninguna confirmación nativa: `window.confirm` bloquea la pestaña y ignora el tema. Todo pasa por `useConfirm()` (ui/ConfirmDialog).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === 'wasm' ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('sin confirmaciones nativas', () => {
  const files = sourceFiles(SRC);
  it('recorre el código de la aplicación', () => {
    expect(files.length).toBeGreaterThan(50);
  });
  it('no queda ningún window.confirm / confirm( global / window.alert / window.prompt en src', () => {
    const offenders = files.flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      // Comentarios fuera: solo importa el código.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      return /\b(window|globalThis|self)\s*\.\s*(confirm|alert|prompt)\s*\(|(^|[^.\w$])(confirm|alert|prompt)\s*\(\s*['"`]/m.test(code) ? [f] : [];
    });
    expect(offenders).toEqual([]);
  });
});
