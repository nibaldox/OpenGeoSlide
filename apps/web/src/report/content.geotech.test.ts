// R9-03c, R9-05 (a, b, c, d) y R9-12a en el contenido del informe: γw sin agua, convenciones de signo, avisos geotécnicos y la sección con
// cargas, sismo y cotas con unidad.
import { describe, expect, it } from 'vitest';
import type { ModelDoc } from '../editor/types';
import type { Load } from '../engine/types';
import { buildReportContent, buildSectionDrawing, conventionNotes, seismicDrawingLabel, waterUnitWeightText, type ReportSection } from './content';
import { loadCaseDoc, sampleInput } from './fixtures';

const section = (c: ReturnType<typeof buildReportContent>, id: string): ReportSection => c.sections.find((x) => x.id === id) as ReportSection;
const kv = (s: ReportSection): Record<string, string> => {
  const b = s.blocks.find((x) => x.kind === 'kv');
  return b && b.kind === 'kv' ? Object.fromEntries(b.rows) : {};
};
const bullets = (s: ReportSection): string[] => s.blocks.flatMap((b) => (b.kind === 'bullets' ? b.items : []));
const warningTexts = (c: ReturnType<typeof buildReportContent>): string[] =>
  section(c, 'warnings').blocks.flatMap((b) => (b.kind === 'list' ? b.items.map((i) => `${i.label}: ${i.text}`) : b.kind === 'paragraph' ? [b.text] : []));

function dry(units: string): ModelDoc {
  const doc = loadCaseDoc('V047a');
  delete doc.water;
  doc.units = units;
  return doc;
}

describe('R9-03c: γw del informe', () => {
  it('modelo sin agua, en SI o imperial: «Sin agua (no aplica)», nunca «9,81 pcf (por defecto)»', () => {
    for (const units of ['SI', 'imperial', 'Imperial']) {
      const c = buildReportContent(sampleInput({ model: dry(units) }));
      expect(kv(section(c, 'model'))['Peso unitario del agua']).toBe('Sin agua (no aplica)');
      expect(JSON.stringify(c)).not.toContain('9,81 pcf');
    }
  });
  it('con piezométrica: el valor o, si falta, el por defecto en SI y «no indicado» en imperial', () => {
    const doc = loadCaseDoc('V047a');
    doc.water = { unit_weight: 62.4, piezometric_line: [[0, 5], [80, 6]] };
    expect(waterUnitWeightText({ ...doc, units: 'imperial' }, 'pcf')).toBe('62,4 pcf');
    doc.water = { piezometric_line: [[0, 5], [80, 6]] };
    expect(waterUnitWeightText({ ...doc, units: 'SI' }, 'kN/m³')).toBe('9,81 kN/m³ (por defecto)');
    expect(waterUnitWeightText({ ...doc, units: 'Imperial' }, 'pcf')).toContain('no indicado');
    expect(waterUnitWeightText({ ...doc, units: 'Imperial' }, 'pcf')).not.toContain('9,81 pcf');
  });
});

describe('R9-05b: convenciones de signo en el informe', () => {
  it('con sismo y cargas de los dos tipos, el bloque «Convenciones de signo» las declara', () => {
    const doc = loadCaseDoc('V047a');
    doc.analysis.seismic = { kh: 0.1, kv: 0.05 };
    doc.loads = [
      { type: 'udl', id: 'q1', x1: 20, x2: 30, q: 20 },
      { type: 'line', id: 'p1', x: 25, p: 50, angle: 10 },
    ];
    const c = buildReportContent(sampleInput({ model: doc }));
    const model = section(c, 'model');
    const b = model.blocks.find((x) => x.kind === 'bullets');
    expect(b && b.kind === 'bullets' ? b.title : '').toBe('Convenciones de signo');
    const text = bullets(model).join('\n');
    expect(text).toContain('kh positivo actúa en el sentido del deslizamiento');
    expect(text).toContain('kv positivo actúa hacia abajo');
    expect(text).toContain('solo al peso del suelo, no a las sobrecargas');
    expect(text).toContain('desde la vertical hacia abajo y es positivo hacia +x');
    expect(text).toContain('Ejes: x aumenta hacia la derecha');
  });
  it('sin sismo ni cargas solo quedan los ejes', () => {
    expect(conventionNotes(dry('SI'))).toEqual(['Ejes: x aumenta hacia la derecha e y hacia arriba.']);
  });
});

describe('R9-05c/d y R9-12a: avisos geotécnicos en el PDF', () => {
  it('ru con piezométrica, piezométrica corta y γsat < γ salen en «Avisos y notas» con el texto de Diagnósticos', () => {
    const doc = loadCaseDoc('V047a');
    doc.materials[0] = { ...doc.materials[0]!, unit_weight: 20, unit_weight_sat: 19, ru: 0.2 };
    doc.water = { unit_weight: 9.81, piezometric_line: [[20, 25], [40, 30]] };
    const texts = warningTexts(buildReportContent(sampleInput({ model: doc })));
    expect(texts.some((t) => t.includes('no está verificado'))).toBe(false); // E15k: γsat ya está verificado, sin aviso
    expect(texts.some((t) => t.includes('ru tiene precedencia'))).toBe(true);
    expect(texts.some((t) => t.includes('extiende en horizontal hasta los bordes'))).toBe(true);
    expect(texts.some((t) => t.includes('γsat (19) es menor que γ (20)'))).toBe(true);
    expect(texts.filter((t) => t.startsWith('Modelo: '))).toHaveLength(3);
  });
  it('un modelo sin esas situaciones sigue diciendo «Sin avisos ni notas»', () => {
    expect(warningTexts(buildReportContent(sampleInput({ model: dry('SI'), results: [] })))).toEqual(['Sin avisos ni notas.']);
  });
});

describe('R9-05a: el dibujo de la sección incluye cargas, sismo y unidad', () => {
  const loaded = (): ModelDoc => {
    const doc = loadCaseDoc('V047a');
    doc.analysis.seismic = { kh: 0.1, kv: 0.05 };
    const loads: Load[] = [
      { type: 'udl', id: 'q1', x1: 56, x2: 66, q: 20 },
      { type: 'line', id: 'p1', x: 60, p: 50, angle: 10 },
    ];
    doc.loads = loads;
    return doc;
  };
  it('cargas situadas sobre el terreno, con rótulo y unidad (SI)', () => {
    const d = buildSectionDrawing(loaded(), []);
    expect(d.unit).toBe('m');
    expect(d.loads).toHaveLength(2);
    const udl = d.loads[0]!;
    expect(udl.kind === 'udl' && udl.ground.length >= 2 && udl.ground.every((p) => p[1] > 0)).toBe(true);
    expect(udl.label).toBe('q = 20 kPa');
    const line = d.loads[1]!;
    expect(line).toMatchObject({ kind: 'line', x: 60, angle: 10, label: 'p = 50 kN/m · 10°' });
    expect(line.kind === 'line' ? line.yTop : 0).toBeCloseTo(35, 9);
  });
  it('en imperial: ft, psf y lbf/ft', () => {
    const doc = { ...loaded(), units: 'Imperial' };
    const d = buildSectionDrawing(doc, []);
    expect(d.unit).toBe('ft');
    expect(d.loads.map((l) => l.label)).toEqual(['q = 20 psf', 'p = 50 lbf/ft · 10°']);
  });
  it('indicador sísmico con el signo dicho con palabras y el sentido del deslizamiento', () => {
    const d = buildSectionDrawing(loaded(), []);
    expect(d.seismic).toEqual({ kh: 0.1, kv: 0.05, dir: -1, label: 'Sismo: kh = 0,1 (sentido del deslizamiento) · kv = 0,05 (hacia abajo)' });
    expect(seismicDrawingLabel(0, -0.05)).toBe('Sismo: kh = 0 · kv = -0,05 (hacia arriba)');
  });
  it('sin cargas ni sismo, el dibujo no los trae', () => {
    const d = buildSectionDrawing(loadCaseDoc('V047a'), []);
    expect(d.loads).toEqual([]);
    expect(d.seismic).toBeNull();
  });
  it('la piezométrica corta lleva su tramo extrapolado y su elemento de leyenda', () => {
    const doc = loadCaseDoc('V047a');
    doc.water = { unit_weight: 9.81, piezometric_line: [[20, 25], [40, 30]] };
    const d = buildSectionDrawing(doc, []);
    expect(d.piezoExtension.length).toBeGreaterThan(0);
    expect(d.legend.map((l) => l.label)).toContain('Piezométrica (extrapolada)');
    doc.water = { unit_weight: 9.81, piezometric_line: [[0, 25], [80, 30]] };
    expect(buildSectionDrawing(doc, []).piezoExtension).toEqual([]);
  });
});
