// UX9-04: los ejemplos se muestran con nombre en español; los archivos de los casos y sus ids no cambian.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { VerificationCase } from '../engine/types';
import { docFromCase } from '../editor/app/docTemplates';
import { loadBuiltinCases } from '../cases';
import { exampleLabel, exampleTitle, exampleTitles } from './exampleTitles';

const dir = new URL('../../../../verification/cases/', import.meta.url);
const files = readdirSync(dir).filter((f) => /^V.*\.json$/.test(f));
const load = (f: string): VerificationCase => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as VerificationCase;

// El índice generado (verification/cases/INDEX.md) es la fuente del número de casos: nunca un literal.
const index = readFileSync(new URL('INDEX.md', dir), 'utf8');
const indexed = [...index.matchAll(/^\| (V\w+) \| .*\| (0\.[123]) \|$/gm)].map((m) => m[1]!);
const declared = Number(/Casos convertidos e incluidos: \*\*(\d+)\*\*/.exec(index)?.[1]);

describe('exampleTitles', () => {
  it('el índice declara los mismos casos que hay en verification/cases y cada uno tiene su título en español', () => {
    expect(Number.isInteger(declared)).toBe(true);
    expect(indexed.length).toBe(declared);
    expect(files.length).toBe(declared);
    expect([...indexed].sort()).toEqual(files.map((f) => load(f).id).sort());
    for (const id of indexed) expect(exampleTitles[id], `falta el título de ${id}`).toBeDefined();
  });

  it('hay un nombre para cada caso publicado y ninguno de más', () => {
    const ids = files.map((f) => load(f).id).sort();
    expect(ids.length).toBeGreaterThanOrEqual(21);
    expect(Object.keys(exampleTitles).sort()).toEqual(ids);
  });

  it('los nombres están en español: sin palabras inglesas del título original', () => {
    const english = /\b(slope|dry|water table|homogeneous|layer|wall|cutting|surcharge|earth dam|example|with)\b/i;
    for (const [id, e] of Object.entries(exampleTitles)) {
      expect(e.title, id).not.toMatch(english);
      expect(e.title.trim(), id).not.toBe('');
      expect(e.source.trim(), id).not.toBe('');
    }
    expect(exampleTitles.V047a?.title).toBe('ACADS 1(a): talud homogéneo seco');
  });

  it('el listado conserva el id y añade la fuente entre paréntesis', () => {
    expect(exampleLabel('V047a', 'x')).toBe('V047a: ACADS 1(a): talud homogéneo seco (Giam y Donald, 1989)');
    expect(exampleLabel('XYZ', 'Mi caso')).toBe('XYZ: Mi caso');
    expect(exampleTitle('XYZ', 'Mi caso')).toBe('Mi caso');
  });

  it('loadBuiltinCases rotula todos los casos con el nombre en español y mantiene sus ids y su contenido', () => {
    const entries = loadBuiltinCases();
    expect(entries.length).toBe(files.length);
    for (const e of entries) {
      expect(e.label).toBe(exampleLabel(e.caseData.id, e.caseData.title));
      expect(e.label).toContain(exampleTitles[e.caseData.id]!.title);
      const original = load(`${e.caseData.id}.json`);
      expect(e.caseData).toEqual(original); // el contenido del caso no se toca
    }
  });

  it('al abrir un ejemplo como modelo, su título es el nombre en español', () => {
    const r = docFromCase(load('V047a.json'));
    expect(r?.doc.meta?.title).toBe('ACADS 1(a): talud homogéneo seco');
    expect(r?.doc.meta?.id).toBe('V047a');
  });
});
