// DXF de texto → pares (código de grupo, valor). Parser propio acotado (X3 §2.7).

import type { ImportIssue } from '../types';

export const DXF_MAX_BYTES = 2 * 1024 * 1024;

export interface DxfPair {
  code: number;
  /** Valor sin espacios en los extremos. */
  value: string;
  /** Línea (desde 1) del código de grupo. */
  line: number;
}

export interface TokenizeResult {
  pairs: DxfPair[];
  issues: ImportIssue[];
}

/** Tamaño en bytes UTF-8 del texto. */
export function utf8Size(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * Convierte el texto en pares. Se detiene en `0 EOF`. Un código no entero, un archivo binario o un número impar de
 * líneas producen una incidencia de severidad `error`; los pares leídos hasta ese punto se devuelven igualmente.
 */
export function tokenizeDxf(text: string): TokenizeResult {
  const issues: ImportIssue[] = [];
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (src.startsWith('AutoCAD Binary DXF')) {
    issues.push({ severity: 'error', text: 'El DXF es binario; exporte un DXF de texto (ASCII).' });
    return { pairs: [], issues };
  }

  const lines = src.split(/\r\n|\r|\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const pairs: DxfPair[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const codeText = (lines[i] ?? '').trim();
    if (!/^-?\d+$/.test(codeText)) {
      issues.push({ severity: 'error', line: i + 1, text: `Línea ${i + 1}: se esperaba un código de grupo entero y se encontró «${codeText.slice(0, 20)}».` });
      return { pairs, issues };
    }
    const value = lines[i + 1];
    if (value === undefined) {
      issues.push({ severity: 'error', line: i + 1, text: `Línea ${i + 1}: el archivo termina sin el valor del código ${codeText} (archivo truncado).` });
      return { pairs, issues };
    }
    const pair: DxfPair = { code: Number(codeText), value: value.trim(), line: i + 1 };
    if (pair.code === 0 && pair.value === 'EOF') {
      pairs.push(pair);
      break;
    }
    pairs.push(pair);
  }
  return { pairs, issues };
}
