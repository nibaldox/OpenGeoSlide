// F3-W1f: el PDF con polilínea, función de M-P y f₀: el texto llega con los glifos correctos (f₀, ξ, λ) y no revienta con la polilínea.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { MethodReport } from '../engine/types';
import { loadCaseDoc, sampleInput } from './fixtures';
import { buildReportPdfWith, type FontLoader } from './pdf';

const loadFont: FontLoader = async (file) => new Uint8Array(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)));

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


const FITTED: [number, number][] = [[30, 25], [35, 25.520953], [40, 26.973391], [45, 29.525055], [51.29111842105263, 35]];
const slice = (i: number) => ({
  x_left: FITTED[i]![0], x_right: FITTED[i + 1]![0], y_base_left: FITTED[i]![1], y_base_right: FITTED[i + 1]![1], y_top_mid: 33, width: 5, alpha: 0.2, base_length: 5.1,
  weight: 100, cohesion: 5, tan_phi: 0.3, pore_pressure: 0, material: 0, weight_extra: 0, h_force: 0, h_moment_base: 0, driving_extra: 0, y_centroid: 0,
});
const rep = (o: Partial<MethodReport>): MethodReport =>
  ({ method: 'morgenstern_price', fos: 0.9991, status: 'converged', iterations: 6, lambda: 0.31, surface: { points: FITTED }, slices: [0, 1, 2, 3].map(slice), search: null, warnings: [], ...o }) as MethodReport;

function polyInput() {
  const model: ModelDoc = loadCaseDoc('V047a');
  model.version = '0.3';
  model.analysis = { ...model.analysis, search: null, methods: ['morgenstern_price', 'janbu_corrected'], surface: { type: 'polyline', points: FITTED } };
  const results = [rep({ interslice: { function: 'half_sine' } }), rep({ method: 'janbu_corrected', lambda: null, fos: 0.9993, correction_factor: 1.0482 })];
  return sampleInput({ model, results, engineName: 'ogs-core 0.1.0', checks: [] });
}

describe('PDF con polilínea, función de M-P y f₀', () => {
  it('describe la superficie, el método con su función y f₀, con los glifos correctos', async () => {
    const blob = await buildReportPdfWith(polyInput(), { loadFont, compress: false });
    // Las celdas largas se parten en varias líneas de texto: se leen unidas por espacios.
    const text = decodeText(Buffer.from(await blob.arrayBuffer()).toString('latin1')).join(' ').replace(/\s+/g, ' ');
    for (const needle of [
      'Polilínea fija',
      'Puntos de la polilínea',
      'Polilínea fija de falla (puntos del modelo)',
      'Función entre dovelas (Morgenstern-Price)',
      'Medio seno',
      'Parámetros por método',
      'Factor de corrección f₀',
      'Superficie fija',
      'Polilínea (5 puntos)',
      'Superficie fija, polilínea (Morgenstern-Price)',
    ]) {
      expect(text, needle).toContain(needle);
    }
    expect(text).not.toContain('\ufffd');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Centro (xc; yc)');
  });
  it('un informe con círculo no cambia: sigue con centro y radio', async () => {
    const blob = await buildReportPdfWith(sampleInput(), { loadFont, compress: false });
    const text = decodeText(Buffer.from(await blob.arrayBuffer()).toString('latin1')).join('\n');
    expect(text).toContain('Centro (xc; yc) (m)');
    expect(text).not.toContain('Parámetros por método');
  });
});
