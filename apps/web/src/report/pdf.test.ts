import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sampleInput } from './fixtures';
import { buildReportPdf, buildReportPdfWith, type FontLoader } from './pdf';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

async function pdfText(input = sampleInput(), compress = false): Promise<string> {
  const blob = await buildReportPdfWith(input, { loadFont, compress });
  expect(blob.type).toBe('application/pdf');
  return Buffer.from(await blob.arrayBuffer()).toString('latin1');
}

/** Cuerpo del objeto `n` del PDF (sin flujo). */
function pdfObject(pdf: string, n: number): string {
  const m = new RegExp(`\\n${n} 0 obj\\n([\\s\\S]*?)endobj`).exec(pdf);
  if (!m) throw new Error(`objeto ${n} no encontrado`);
  return m[1] as string;
}

/** Mapa glifo → Unicode de un flujo ToUnicode. */
function parseToUnicode(stream: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const block of stream.matchAll(/beginbfchar\n([\s\S]*?)endbfchar/g)) {
    for (const m of (block[1] as string).matchAll(/<([0-9a-f]{4})><([0-9a-f]{4})>/g)) {
      map.set(parseInt(m[1] as string, 16), String.fromCharCode(parseInt(m[2] as string, 16)));
    }
  }
  return map;
}

/** Reconstruye el texto de todas las operaciones `<hex> Tj`, usando el ToUnicode de la fuente activa en cada una. */
function decodeText(pdf: string): string[] {
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
  return out;
}

const literalTj = /\((?:[^()\\]|\\.)*\)\s*Tj/g;

describe('buildReportPdf', () => {
  it('embebe la fuente TrueType con Identity-H y escribe todo el texto con ella (sin bytes WinAnsi)', async () => {
    const pdf = await pdfText();
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf.match(/\/FontFile2 \d+ 0 R/g)).toHaveLength(2); // Sans + Sans Bold
    expect(pdf).toContain('/Subtype /CIDFontType2');
    expect(pdf).toContain('/Subtype /Type0');
    expect(pdf).toContain('/Encoding /Identity-H');
    expect(pdf).toContain('/BaseFont /DejaVuSans');

    // Ninguna operación de texto es una cadena literal (que sería WinAnsi): todas son glifos en hexadecimal.
    expect(pdf.match(literalTj)).toBeNull();
    const hexOps = pdf.match(/<[0-9a-fA-F]+>\s*Tj/g) ?? [];
    expect(hexOps.length).toBeGreaterThan(100);

    // Y toda fuente seleccionada con Tf es una de las dos incrustadas (Type0), no una estándar.
    const used = new Set([...pdf.matchAll(/\/(F\d+) [\d.]+ Tf/g)].map((m) => m[1] as string));
    expect(used.size).toBe(2);
    for (const name of used) {
      const n = Number(new RegExp(`/${name} (\\d+) 0 R`).exec(pdf)?.[1]);
      expect(pdfObject(pdf, n)).toContain('/Subtype /Type0');
    }
  });

  it('φ, γ, ≤, ≥, á, ñ, ° y ³ llegan al PDF como los caracteres correctos', async () => {
    const text = decodeText(await pdfText()).join('\n');
    for (const needle of ['Arcilla φ ≤ 20°', 'γ (kN/m³)', 'φ (°)', 'γsat', 'Niño', 'áéíóú', 'ángulo']) {
      expect(text, needle).toContain(needle);
    }
    expect(text).toContain('φ ≥ 19,6°');
    expect(text).not.toContain('\ufffd');
    // Contenido del informe: portada, SHA-256 y advertencia profesional.
    expect(text).toContain('a'.repeat(32));
    expect(text.replace(/\n/g, ' ')).toContain('No sustituye el juicio del profesional responsable');
    expect(text).toMatch(/Página 1 de \d+/);
  });

  it('control negativo: la fuente estándar de jsPDF sí escribe φ como bytes literales fuera de WinAnsi', async () => {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ compress: false });
    doc.setFont('helvetica');
    doc.text('φ γ ≤', 10, 10);
    const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1');
    expect(raw.match(literalTj)).not.toBeNull();
    expect(raw).not.toContain('/Identity-H');
  });

  it('la sección se dibuja en vectorial: regiones, superficie crítica en rojo y dovelas', async () => {
    const pdf = await pdfText();
    expect(pdf).toMatch(/0\.73 0\.11 0\.11 RG/); // superficie crítica: PDF_PALETTE.surface (185, 28, 28)
    expect(pdf).toMatch(/\nB\n/); // región rellena con borde
    expect((pdf.match(/ l\n/g) ?? []).length).toBeGreaterThan(50);
    expect(pdf).not.toContain('/Subtype /Image');
  });

  it('con compresión el PDF es válido y mucho más pequeño', async () => {
    const plain = await pdfText(sampleInput(), false);
    const zipped = await pdfText(sampleInput(), true);
    expect(zipped.startsWith('%PDF-')).toBe(true);
    expect(zipped).toContain('/FlateDecode');
    expect(zipped).toContain('/FontFile2');
    expect(zipped.length).toBeLessThan(plain.length / 2);
  });

  it('genera varias páginas con un informe largo y con avisos', async () => {
    const input = sampleInput();
    const base = input.results[0]!;
    input.results = [{ ...base, warnings: ['m_alpha', 'truncated_mass', 'negative_effective_normal', 'water_above_ground'] }];
    input.model.materials = Array.from({ length: 60 }, (_, i) => ({ ...input.model.materials[0]!, id: `m${i}`, name: `Material ${i} φ=${i}°` }));
    const pdf = await pdfText(input);
    const pages = (pdf.match(/\/Type \/Page\n/g) ?? []).length;
    expect(pages).toBeGreaterThan(1);
    const text = decodeText(pdf).join('\n');
    expect(text).toContain('Material 59 φ=59°');
    expect(text).toContain(`Página ${pages} de ${pages}`);
  });

  it('si la fuente no se puede cargar, rechaza con el motivo (no genera un PDF con fuente estándar)', async () => {
    const failing: FontLoader = async (file) => {
      throw new Error(`sin ${file}`);
    };
    await expect(buildReportPdfWith(sampleInput(), { loadFont: failing })).rejects.toThrow('sin DejaVuSans');
  });

  it('buildReportPdf usa fetch para las fuentes y falla con un HTTP no válido', async () => {
    const real = globalThis.fetch;
    const urls: string[] = [];
    globalThis.fetch = (async (url: string) => {
      urls.push(String(url));
      return { ok: false, status: 404 } as Response;
    }) as typeof fetch;
    try {
      await expect(buildReportPdf(sampleInput())).rejects.toThrow('HTTP 404');
    } finally {
      globalThis.fetch = real;
    }
    expect(urls.some((u) => u.endsWith('fonts/DejaVuSans.ttf'))).toBe(true);
  });

  it('jspdf solo se importa de forma diferida y como tipo en pdf.ts', () => {
    const src = readFileSync(new URL('./pdf.ts', import.meta.url), 'utf8');
    const imports = [...src.matchAll(/^import .*$/gm)].map((m) => m[0]);
    expect(imports.filter((l) => l.includes("'jspdf'"))).toEqual(["import type { jsPDF } from 'jspdf';"]);
    expect(src).toContain("import('jspdf')");
  });
});
