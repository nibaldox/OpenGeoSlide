// R15B-03, R15B-05, R15B-12 y E16x en el informe: aviso combinado, avisos por (código, ruta) con unidades activas, nota SHANSEP y nota sin refinamiento.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { convertDocUnits } from '../editor/state/units';
import { geotechAdvisories } from '../editor/state/geotech';
import { SHANSEP_REPORT_NOTE, buildReportContent, type ReportContent, type ReportSection } from './content';
import { hoekBrownFixture, nonCircularPolylineWinsFixture, shansepFixture } from './f3bFixtures';
import { buildReportPdfWith, type FontLoader } from './pdf';
import type { ReportInput } from './types';

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


const sec = (c: ReportContent, id: string): ReportSection => c.sections.find((s) => s.id === id)!;
const warningItems = (c: ReportContent): { severity: string; label: string; text: string }[] => {
  const block = sec(c, 'warnings').blocks[0]!;
  return block.kind === 'list' ? [...block.items] : [];
};
const texts = (c: ReportContent): string[] => warningItems(c).map((i) => i.text);

function twoRocks(ucs1: number, ucs2: number): ReportInput {
  const { input } = hoekBrownFixture();
  const rock = input.model.materials[1]!;
  input.model.materials = [input.model.materials[0]!, { ...rock, id: 'roca1', ucs: ucs1 }, { ...rock, id: 'roca2', ucs: ucs2 }];
  input.results = input.results.map((r) => ({ ...r, warnings: [] }));
  return input;
}

describe('R15B-05: avisos geotécnicos del PDF por (código, ruta)', () => {
  it('dos rocas Hoek-Brown con σci en MPa dan dos avisos, uno por material', () => {
    const input = twoRocks(30, 45);
    expect(geotechAdvisories(input.model).filter((a) => a.code === 'editor.hoek_brown_ucs').map((a) => a.path)).toEqual(['/materials/1/ucs', '/materials/2/ucs']);
    const t = texts(buildReportContent(input));
    expect(t.filter((x) => x.includes('σci'))).toHaveLength(2);
    expect(t.some((x) => x.includes('«roca1»') && x.includes('σci = 30 kPa'))).toBe(true);
    expect(t.some((x) => x.includes('«roca2»') && x.includes('σci = 45 kPa'))).toBe(true);
  });

  it('el mismo aviso sobre la misma ruta no se repite', () => {
    const input = twoRocks(30, 30000);
    expect(texts(buildReportContent(input)).filter((x) => x.includes('σci'))).toHaveLength(1);
    const dup = twoRocks(30, 45);
    dup.model.materials[2]!.id = 'roca2';
    expect(texts(buildReportContent(dup)).filter((x) => x.includes('σci'))).toHaveLength(2);
  });

  it('con γsat < γ en dos materiales, también salen dos avisos', () => {
    const input = twoRocks(30000, 30000);
    input.model.materials.forEach((m) => { m.unit_weight = 20; m.unit_weight_sat = 18; });
    expect(texts(buildReportContent(input)).filter((x) => x.includes('γsat'))).toHaveLength(3);
  });

  it('el texto de σci usa kPa y MPa en SI', () => {
    const text = geotechAdvisories(twoRocks(30, 45).model)[0]!.text;
    expect(text).toBe(
      'Material «roca1»: σci = 30 kPa está fuera del intervalo habitual de 1000 a 300 000 kPa (1 a 300 MPa); revise si escribió un valor en MPa en lugar de la unidad de esfuerzo del modelo. No bloquea el cálculo.',
    );
  });

  it('en imperial usa psf y psi, no kPa', () => {
    const input = twoRocks(30000, 30000);
    input.model.materials[1]!.ucs = 30; // 30 kPa
    const imperial = convertDocUnits(input.model, 'imperial');
    const adv = geotechAdvisories(imperial).find((a) => a.code === 'editor.hoek_brown_ucs')!;
    expect(adv.text).toContain('σci = 626,563 psf');
    expect(adv.text).toContain('20 885 a 6 265 630 psf (145 a 43 511 psi)');
    expect(adv.text).not.toMatch(/kPa/);
    expect(adv.text).not.toMatch(/\d MPa/);
    const pdfTexts = texts(buildReportContent({ ...input, model: imperial }));
    expect(pdfTexts.some((x) => x.includes('psf (145 a 43 511 psi)'))).toBe(true);
  });
});

describe('R15B-12: nota de convención de SHANSEP', () => {
  it('el bloque de SHANSEP trae Su = S·σ′v·OCR^m con σ′v estático y sin sismo', () => {
    const { input } = shansepFixture();
    input.model.analysis.seismic = { kh: 0.1, kv: 0.05 };
    const content = buildReportContent(input);
    const blocks = sec(content, 'materials').blocks;
    const i = blocks.findIndex((x) => x.kind === 'table' && x.title === 'Materiales SHANSEP');
    expect(i).toBeGreaterThan(-1);
    expect(blocks[i + 1]).toEqual({ kind: 'paragraph', text: SHANSEP_REPORT_NOTE });
    expect(SHANSEP_REPORT_NOTE).toContain('Su = S·σ′v·OCR^m');
    expect(SHANSEP_REPORT_NOTE).toContain('no lleva término sísmico');
    expect(SHANSEP_REPORT_NOTE).toMatch(/ni kh ni kv/);
    // la convención sísmica sigue diciendo W·(1 + kv): la nota aclara que no aplica a σ′v
    expect(sec(content, 'model').blocks.some((x) => JSON.stringify(x).includes('W·(1 + kv)'))).toBe(true);
  });

  it('un informe sin SHANSEP no la lleva', () => {
    expect(JSON.stringify(buildReportContent(hoekBrownFixture().input))).not.toContain('Convención SHANSEP');
  });

  it('el PDF real la imprime', async () => {
    const blob = await buildReportPdfWith(shansepFixture().input, { loadFont, compress: false });
    const text = decodeText(Buffer.from(await blob.arrayBuffer()).toString('latin1'));
    expect(text).toContain('Convención SHANSEP');
    expect(text).toContain('Su = S·σ′v·OCR^m');
    expect(text).toContain('no lleva término sísmico');
    expect(text).not.toContain('\ufffd');
  });
});

describe('R15B-03 y E16x en el PDF', () => {
  function nc(): ReportInput {
    const { input } = nonCircularPolylineWinsFixture();
    input.results = input.results.map((r) => ({ ...r, lambda: -0.5, warnings: ['negative_lambda', 'negative_effective_normal_major'] }));
    return input;
  }

  it('la sección de avisos trae el aviso combinado como aviso, con Janbu', () => {
    const items = warningItems(buildReportContent(nc()));
    const combined = items.find((i) => i.text.startsWith('Aviso combinado'));
    expect(combined).toBeDefined();
    expect(combined!.severity).toBe('aviso');
    expect(combined!.text).toContain('En la búsqueda no circular');
    expect(combined!.text).toContain('compare con Janbu');
    expect(items.some((i) => /compare con Bishop/.test(i.text))).toBe(false);
  });

  it('un resultado no circular sin refinar muestra la nota informativa', () => {
    const { input } = nonCircularPolylineWinsFixture();
    input.results[0]!.warnings = ['non_circular_not_refined'];
    const item = warningItems(buildReportContent(input)).find((i) => i.text.startsWith('La búsqueda no circular no encontró'));
    expect(item).toEqual({
      severity: 'nota',
      label: 'Spencer',
      text: 'La búsqueda no circular no encontró ninguna polilínea admisible: el resultado es el círculo de la búsqueda circular.',
    });
  });

  it('el PDF imprime el aviso combinado sin glifos perdidos', async () => {
    const blob = await buildReportPdfWith(nc(), { loadFont, compress: false });
    const text = decodeText(Buffer.from(await blob.arrayBuffer()).toString('latin1'));
    expect(text).toContain('Aviso combinado');
    expect(text).toContain('rama de equilibrio con tracción');
    expect(text).toContain('compare con Janbu');
    expect(text).not.toContain('\ufffd');
  });
});
