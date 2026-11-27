// F3B-W2: generación real del PDF (`report/pdf.ts`) con Hoek-Brown, SHANSEP, búsqueda no circular, anchos B-07 e identidad v0.5.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildReportContent, type ReportBlock } from './content';
import {
  hoekBrownFixture,
  nonCircularCircleWinsFixture,
  nonCircularPolylineWinsFixture,
  shansepFixture,
} from './f3bFixtures';
import { loadCaseDoc, sampleInput } from './fixtures';
import { CELL_PAD, buildReportPdfWith, registerFonts, tableColumnWidths, type FontLoader } from './pdf';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

function pdfObject(pdf: string, n: number): string {
  const m = new RegExp(`\\n${n} 0 obj\\n([\\s\\S]*?)endobj`).exec(pdf);
  if (!m) throw new Error(`objeto ${n} no encontrado`);
  return m[1] as string;
}

function parseToUnicode(stream: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of stream.matchAll(/beginbfchar\n([\s\S]*?)endbfchar/g)) {
    for (const m of (block[1] as string).matchAll(/<([0-9a-f]{4})><([0-9a-f]{4})>/g)) {
      map.set(parseInt(m[1] as string, 16), String.fromCharCode(parseInt(m[2] as string, 16)));
    }
  }
  return map;
}

function decodeText(pdf: string): string {
  const fontObj = new Map<string, number>();
  for (const m of pdf.matchAll(/\/(F\d+) (\d+) 0 R/g)) fontObj.set(m[1] as string, Number(m[2]));
  const maps = new Map<string, Map<number, string>>();
  const mapFor = (name: string): Map<number, string> => {
    const cached = maps.get(name);
    if (cached) return cached;
    const font = pdfObject(pdf, fontObj.get(name) as number);
    const toUni = /\/ToUnicode (\d+) 0 R/.exec(font);
    if (!toUni) throw new Error(`la fuente ${name} no tiene ToUnicode`);
    const map = parseToUnicode(pdfObject(pdf, Number(toUni[1])));
    maps.set(name, map);
    return map;
  };
  const out: string[] = [];
  let current = '';
  for (const m of pdf.matchAll(/\/(F\d+) [\d.]+ Tf|<([0-9a-fA-F]+)>\s*Tj/g)) {
    if (m[1]) {
      current = m[1];
      continue;
    }
    const hex = m[2] as string;
    const map = mapFor(current);
    let s = '';
    for (let i = 0; i < hex.length; i += 4) s += map.get(parseInt(hex.slice(i, i + 4), 16)) ?? '\ufffd';
    out.push(s);
  }
  return out.join(' ').replace(/\s+/g, ' ');
}

/** Normaliza los dos metadatos variables de jsPDF (`/CreationDate` e `/ID`) para comparar bytes deterministas del PDF. */
function normalizePdfMetadata(raw: string): string {
  return raw
    .replace(/\/CreationDate \(D:[^)]+\)/g, '/CreationDate (D:FIXED)')
    .replace(/\/ID \[\s*<[0-9a-fA-F]+>\s*<[0-9a-fA-F]+>\s*\]/g, '/ID [<FIXED> <FIXED>]');
}

describe('PDF F3B: Hoek-Brown, SHANSEP y búsqueda no circular', () => {
  it('renderiza Hoek-Brown con mb, s, a, pasadas del lazo, aviso de bajo confinamiento y nota fija (F6.8, Hoek 1994)', async () => {
    const blob = await buildReportPdfWith(hoekBrownFixture().input, { loadFont, compress: false });
    const text = decodeText(Buffer.from(await blob.arrayBuffer()).toString('latin1'));
    for (const needle of [
      'Materiales Hoek-Brown generalizado',
      'σci (kPa)',
      'Pasadas del lazo de Hoek-Brown',
      'envolvente completa',
      '0 % a −2,9 %',
      'Hoek (1994',
      'regla de bajo confinamiento',
    ]) {
      expect(text, needle).toContain(needle);
    }
    expect(text).not.toContain('\ufffd');
  });

  it('renderiza SHANSEP con sus fuentes de OCR y la nota de esfuerzo no positivo', async () => {
    const blob = await buildReportPdfWith(shansepFixture().input, { loadFont, compress: false });
    const text = decodeText(Buffer.from(await blob.arrayBuffer()).toString('latin1'));
    for (const needle of [
      'Materiales SHANSEP',
      'OCR constante',
      'POP (sobreconsolidación)',
      'OCR por cota',
      'resistencia SHANSEP se tomó como cero',
    ]) {
      expect(text, needle).toContain(needle);
    }
    expect(text).not.toContain('\ufffd');
  });

  it('renderiza búsqueda no circular tanto cuando gana la polilínea como cuando gana el círculo', async () => {
    const polyBlob = await buildReportPdfWith(nonCircularPolylineWinsFixture(true).input, { loadFont, compress: false });
    const polyText = decodeText(Buffer.from(await polyBlob.arrayBuffer()).toString('latin1'));
    for (const needle of [
      'Búsqueda no circular (refinamiento de semillas)',
      'Vértices de la polilínea crítica (búsqueda no circular)',
      'Polilínea',
      'más de un 15 % respecto del mejor círculo',
    ]) {
      expect(polyText, needle).toContain(needle);
    }

    const circBlob = await buildReportPdfWith(nonCircularCircleWinsFixture(false).input, { loadFont, compress: false });
    const circText = decodeText(Buffer.from(await circBlob.arrayBuffer()).toString('latin1'));
    expect(circText).toContain('Búsqueda no circular (refinamiento de semillas)');
    expect(circText).toContain('Círculo');
    expect(circText).not.toContain('Vértices de la polilínea crítica');
  });

  it('B-07: ninguna palabra de ninguna cabecera nueva de F3B queda más ancha que su columna en DejaVu Sans', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    registerFonts(doc, await loadFont('DejaVuSans.ttf'), await loadFont('DejaVuSans-Bold.ttf'));

    for (const fx of [hoekBrownFixture(), shansepFixture(), nonCircularPolylineWinsFixture(), nonCircularCircleWinsFixture()]) {
      const content = buildReportContent(fx.input);
      const allTables = content.sections.flatMap((s) => s.blocks).filter((b): b is Extract<ReportBlock, { kind: 'table' }> => b.kind === 'table');
      for (const t of allTables) {
        const size = t.header.length >= 11 ? 7 : 8.5;
        const widths = tableColumnWidths(doc, t.header, t.rows, size);
        doc.setFont('DejaVuSans', 'bold');
        doc.setFontSize(size);
        t.header.forEach((h, c) => {
          for (const word of h.split(/\s+/)) {
            expect(doc.getTextWidth(word) + CELL_PAD, `${t.title ?? ''} · ${h} → ${word}`).toBeLessThanOrEqual((widths[c] as number) + 1e-6);
          }
        });
      }
    }
  });

  it('ausente y null dan el mismo PDF: un modelo v0.5 con los campos v0.6 ausentes o null produce los mismos bytes (la identidad contra v0.4.0 la comprueba identity.f3b.mjs)', async () => {
    const doc = loadCaseDoc('V047a');
    doc.version = '0.5';
    doc.analysis.tension_crack = { depth: 1.8, water_fill: 1 };
    const v05Input = sampleInput({
      model: doc,
      engineName: 'ogs-core 0.4.0',
      results: sampleInput({ model: doc }).results.map((r) => ({ ...r, tension_crack: { x: 47.2, depth: 1.8, water_force: 15.89 } })),
    });
    const withNullV06 = structuredClone(v05Input);
    withNullV06.model.materials[0]!.ucs = null;
    withNullV06.model.materials[0]!.gsi = null;
    withNullV06.model.materials[0]!.mi = null;
    withNullV06.model.materials[0]!.disturbance = null;
    withNullV06.model.materials[0]!.shansep = null;
    if (withNullV06.model.analysis.search) withNullV06.model.analysis.search.non_circular = null;

    const pdfA = normalizePdfMetadata(Buffer.from(await (await buildReportPdfWith(v05Input, { loadFont, compress: false })).arrayBuffer()).toString('latin1'));
    const pdfB = normalizePdfMetadata(Buffer.from(await (await buildReportPdfWith(withNullV06, { loadFont, compress: false })).arrayBuffer()).toString('latin1'));
    expect(pdfB).toBe(pdfA);

    const decoded = decodeText(pdfA);
    expect(decoded).not.toContain('Hoek-Brown');
    expect(decoded).not.toContain('SHANSEP');
    expect(decoded).not.toContain('Búsqueda no circular');
  });
});
