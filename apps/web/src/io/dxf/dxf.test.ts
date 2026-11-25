import { readFileSync } from 'node:fs';
import DxfParser from 'dxf-parser';
import { describe, expect, it } from 'vitest';
import type { Point } from '../../engine/types';
import { DXF_MAX_ENTITIES, parseDxf, type DxfEntity } from './entities';
import { suggestMaterialId, unitsFromInsunits } from './layers';
import { DXF_MAX_BYTES, tokenizeDxf } from './tokenize';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

interface Norm {
  type: string;
  layer: string;
  points: Point[];
  closed: boolean;
}

/** Entidades soportadas según el oráculo `dxf-parser` 1.1.2, en el mismo formato que las nuestras. */
function oracle(text: string): Norm[] {
  const dxf = new DxfParser().parseSync(text);
  if (!dxf) throw new Error('dxf-parser no devolvió documento');
  const out: Norm[] = [];
  for (const e of dxf.entities as unknown as {
    type: string;
    layer: string;
    shape?: boolean;
    vertices?: { x: number | null; y: number | null; z?: number; bulge?: number }[];
  }[]) {
    if (e.type !== 'LINE' && e.type !== 'LWPOLYLINE' && e.type !== 'POLYLINE') continue;
    out.push({
      type: e.type,
      layer: e.layer,
      points: (e.vertices ?? []).map((v) => [v.x as number, v.y as number] as Point),
      closed: e.type === 'LINE' ? false : e.shape === true,
    });
  }
  return out;
}

const ours = (entities: DxfEntity[]): Norm[] => entities.map(({ type, layer, points, closed }) => ({ type, layer, points, closed }));

describe('tokenizeDxf', () => {
  it('lee pares con LF, CRLF y CR, y se detiene en EOF', () => {
    for (const eol of ['\n', '\r\n', '\r']) {
      const t = tokenizeDxf(['0', 'SECTION', '2', ' HEADER ', '0', 'EOF', '0', 'MAS'].join(eol) + eol);
      expect(t.issues).toEqual([]);
      expect(t.pairs.map((p) => [p.code, p.value])).toEqual([[0, 'SECTION'], [2, 'HEADER'], [0, 'EOF']]);
    }
  });

  it('numera las líneas desde 1 (la del código)', () => {
    expect(tokenizeDxf('0\nSECTION\n2\nHEADER\n').pairs.map((p) => p.line)).toEqual([1, 3]);
  });

  it('código no entero → error con la línea; archivo truncado → error; binario → error', () => {
    const bad = tokenizeDxf('0\nSECTION\nabc\nHEADER\n');
    expect(bad.issues[0]).toMatchObject({ severity: 'error', line: 3 });
    expect(bad.pairs).toHaveLength(1);
    expect(tokenizeDxf('0\nSECTION\n2').issues[0]?.text).toContain('truncado');
    expect(tokenizeDxf('AutoCAD Binary DXF\r\n\x1a\x00').issues[0]?.text).toContain('binario');
  });
});

describe('layers', () => {
  it('unitsFromInsunits', () => {
    expect([1, 2, 4, 5, 6].map(unitsFromInsunits)).toEqual(['in', 'ft', 'mm', 'cm', 'm']);
    expect([0, 3, 14, 99, null].map(unitsFromInsunits)).toEqual([null, null, null, null, null]);
  });

  it('suggestMaterialId: id antes que nombre, sin distinguir mayúsculas', () => {
    const mats = [{ id: 'arcilla', name: 'Arcilla blanda' }, { id: 'roca', name: 'SUELO_1' }];
    expect(suggestMaterialId('ARCILLA', mats)).toBe('arcilla');
    expect(suggestMaterialId('suelo_1', mats)).toBe('roca');
    expect(suggestMaterialId('otra', mats)).toBeNull();
    expect(suggestMaterialId('  ', mats)).toBeNull();
  });
});

describe('parseDxf frente a dxf-parser 1.1.2', () => {
  it('terraplen.dxf: mismas entidades soportadas (tipos, capas, vértices, cierre)', () => {
    const text = fixture('terraplen.dxf');
    const r = parseDxf(text);
    expect(r.ok).toBe(true);
    expect(ours(r.entities)).toEqual(oracle(text));
    expect(r.entities.map((e) => e.type)).toEqual(['LWPOLYLINE', 'LWPOLYLINE', 'LINE', 'LWPOLYLINE']);
  });

  it('terraplen.dxf: regiones, capas, unidades, ignoradas y avisos', () => {
    const r = parseDxf(fixture('terraplen.dxf'), {
      materials: [{ id: 'suelo', name: 'Suelo_1' }, { id: 'ARCILLA', name: 'Arcilla' }],
    });
    expect(r.regions.map((x) => x.layer)).toEqual(['SUELO_1', 'arcilla']);
    expect(r.regions[0]?.polygon).toEqual([[20, 20], [20, 25], [30.5, 25], [50, 35.25], [70, 35], [70, 20]]);
    expect(r.unitsFromHeader).toBe('m');
    expect(r.layers).toEqual([
      { name: '0', suggestedMaterialId: null },
      { name: 'SUELO_1', suggestedMaterialId: 'suelo' },
      { name: 'arcilla', suggestedMaterialId: 'ARCILLA' },
      { name: 'TERRENO', suggestedMaterialId: null },
    ]);
    expect(r.unsupported).toEqual([
      { type: 'SPLINE', count: 1 },
      { type: 'CIRCLE', count: 1 },
      { type: 'ARC', count: 1 },
      { type: 'TEXT', count: 2 },
    ]);
    expect(r.entityCount).toBe(9);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.issues.some((i) => i.text.includes('abierta'))).toBe(true);
  });

  it('polyline2d_crlf.dxf: POLYLINE con VERTEX y SEQEND, CRLF, unidades mm', () => {
    const text = fixture('polyline2d_crlf.dxf');
    expect(text).toContain('\r\n');
    const r = parseDxf(text);
    expect(r.ok).toBe(true);
    expect(ours(r.entities)).toEqual(oracle(text));
    expect(r.entities.map((e) => [e.type, e.closed])).toEqual([['POLYLINE', true], ['POLYLINE', false]]);
    expect(r.regions).toEqual([{ layer: 'ROCA', polygon: [[0, 0], [1000, 0], [1000, 500], [0, 500]] }]);
    expect(r.unitsFromHeader).toBe('mm');
  });

  it('bulge ≠ 0: dxf-parser lo conserva; el parser propio rechaza esa entidad con aviso', () => {
    const text = fixture('bulge.dxf');
    const dxf = new DxfParser().parseSync(text);
    const bulged = (dxf?.entities[0] as unknown as { vertices: { bulge?: number }[] }).vertices.some((v) => v.bulge === 0.5);
    expect(bulged).toBe(true);
    const r = parseDxf(text);
    expect(r.ok).toBe(true);
    expect(r.entities.map((e) => e.layer)).toEqual(['B']);
    expect(r.regions.map((x) => x.layer)).toEqual(['B']);
    const w = r.issues.find((i) => i.entity === 'LWPOLYLINE' && i.severity === 'aviso');
    expect(w?.text).toContain('bulge');
    expect(w?.line).toBeGreaterThan(0);
    expect(ours(r.entities)).toEqual(oracle(text).filter((e) => e.layer === 'B'));
  });

  it('coordenadas no finitas: dxf-parser las deja pasar (NaN/null); el parser propio las rechaza', () => {
    const text = fixture('nonfinite.dxf');
    const dxf = new DxfParser().parseSync(text);
    const line = dxf?.entities[0] as unknown as { vertices: { x: number | null }[] };
    expect(Number.isFinite(line.vertices[0]?.x)).toBe(false);
    const r = parseDxf(text);
    expect(r.entities.map((e) => e.layer)).toEqual(['B']);
    expect(r.issues.filter((i) => i.severity === 'aviso' && i.text.includes('no numéricas o no finitas'))).toHaveLength(2);
    expect(ours(r.entities)).toEqual(oracle(text).filter((e) => e.layer === 'B'));
  });

  it('3D: POLYLINE 3D, LINE con Z y LWPOLYLINE con cota se rechazan; la 2D pasa', () => {
    const r = parseDxf(fixture('polyline3d.dxf'));
    expect(r.entities.map((e) => e.layer)).toEqual(['D']);
    const reasons = r.issues.filter((i) => i.severity === 'aviso' && i.entity).map((i) => `${i.entity}:${i.text.includes('3D') ? '3D' : '?'}`);
    expect(reasons).toEqual(['POLYLINE:3D', 'LINE:3D', 'LWPOLYLINE:3D']);
  });

  it('solo entidades ignoradas → ok false con recuento', () => {
    const r = parseDxf(fixture('solo_ignoradas.dxf'));
    expect(r.ok).toBe(false);
    expect(r.unsupported).toEqual([{ type: 'CIRCLE', count: 1 }, { type: 'ARC', count: 1 }]);
    expect(r.issues.some((i) => i.severity === 'error')).toBe(true);
  });

  it('capa 0 con aviso; extremos coincidentes tratados como cerrada; unidades en pies', () => {
    const text = fixture('capa0_pies.dxf');
    const r = parseDxf(text);
    expect(ours(r.entities)).toEqual(oracle(text));
    expect(r.unitsFromHeader).toBe('ft');
    expect(r.regions).toHaveLength(2);
    expect(r.regions[0]?.polygon).toEqual([[0, 0], [100, 0], [100, 30], [0, 30]]);
    expect(r.issues.some((i) => i.text.includes('capa 0'))).toBe(true);
    expect(r.issues.some((i) => i.text.includes('extremos coincidentes'))).toBe(true);
  });
});

describe('parseDxf: límites y archivos no válidos', () => {
  it('texto que no es DXF → error (dxf lo dejaría pasar como documento vacío)', () => {
    const r = parseDxf('esto no es un DXF\nsino texto\n');
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.severity).toBe('error');
    expect(parseDxf('').ok).toBe(false);
    expect(parseDxf('0\nSECTION\n2\nCLASSES\n0\nENDSEC\n0\nEOF\n').issues[0]?.text).toContain('HEADER ni ENTITIES');
  });

  it('DXF binario y truncado', () => {
    expect(parseDxf('AutoCAD Binary DXF\r\n\x1a\x00').issues[0]?.text).toContain('binario');
    expect(parseDxf('0\nSECTION\n2\nENTITIES\n0\nLINE\n8').ok).toBe(false);
  });

  it('más de 2 MB → error', () => {
    const big = `999\n${'x'.repeat(DXF_MAX_BYTES)}\n`;
    const r = parseDxf(big);
    expect(r.ok).toBe(false);
    expect(r.issues[0]?.text).toContain('2 MB');
  });

  it('10 000 entidades pasan; 10 001 se rechazan', () => {
    const mk = (n: number): string => `0\nSECTION\n2\nENTITIES\n${'0\nLINE\n8\nA\n10\n0\n20\n0\n11\n1\n21\n1\n'.repeat(n)}0\nENDSEC\n0\nEOF\n`;
    const okR = parseDxf(mk(DXF_MAX_ENTITIES));
    expect(okR.ok).toBe(true);
    expect(okR.entities).toHaveLength(DXF_MAX_ENTITIES);
    const bad = parseDxf(mk(DXF_MAX_ENTITIES + 1));
    expect(bad.ok).toBe(false);
    expect(bad.entityCount).toBe(DXF_MAX_ENTITIES + 1);
    expect(bad.issues[0]?.text).toContain('límite');
  });

  it('LWPOLYLINE con recuento 90 incoherente o con una sola coordenada se rechaza', () => {
    const body = (extra: string): string => `0\nSECTION\n2\nENTITIES\n${extra}0\nENDSEC\n0\nEOF\n`;
    const mismatch = parseDxf(body('0\nLWPOLYLINE\n8\nA\n90\n4\n70\n1\n10\n0\n20\n0\n10\n1\n20\n0\n10\n1\n20\n1\n'));
    expect(mismatch.entities).toEqual([]);
    expect(mismatch.issues.some((i) => i.text.includes('declara 4'))).toBe(true);
    const noY = parseDxf(body('0\nLWPOLYLINE\n8\nA\n70\n1\n10\n0\n20\n0\n10\n1\n'));
    expect(noY.entities).toEqual([]);
  });
});

// R5-06: extrusión OCS, cota Z de la cabecera de POLYLINE y recuento de coincidentes (datos de R5).
describe('parseDxf: R5-06 extrusión, cota Z de cabecera y recuento', () => {
  const body = (extra: string): string => `0\nSECTION\n2\nENTITIES\n${extra}0\nENDSEC\n0\nEOF\n`;
  const square = '10\n0\n20\n0\n10\n4\n20\n0\n10\n4\n20\n3\n10\n0\n20\n3\n';
  const lw = (extrusion: string): string => `0\nLWPOLYLINE\n8\nA\n90\n4\n70\n1\n${square}${extrusion}`;
  const poly = (header: string): string =>
    `0\nPOLYLINE\n8\nA\n66\n1\n${header}70\n1\n` +
    [[0, 0], [4, 0], [4, 3], [0, 3]].map(([x, y]) => `0\nVERTEX\n8\nA\n10\n${x}\n20\n${y}\n`).join('') +
    '0\nSEQEND\n8\nA\n';

  it('LWPOLYLINE espejada (230 = -1) se rechaza con aviso; con (0, 0, 1) explícito pasa', () => {
    const bad = parseDxf(body(lw('210\n0\n220\n0\n230\n-1\n')));
    expect(bad.entities).toEqual([]);
    expect(bad.regions).toEqual([]);
    expect(bad.issues.some((i) => i.severity === 'aviso' && i.entity === 'LWPOLYLINE' && i.text.includes('extrusión'))).toBe(true);
    const good = parseDxf(body(lw('210\n0\n220\n0\n230\n1\n')));
    expect(good.regions).toHaveLength(1);
    expect(good.issues.filter((i) => i.text.includes('extrusión'))).toEqual([]);
    // Sin los códigos 210/220/230 equivale a (0, 0, 1).
    expect(parseDxf(body(lw(''))).regions).toHaveLength(1);
  });

  it('plano inclinado (210 o 220 ≠ 0) y vector no numérico también se rechazan', () => {
    for (const ext of ['210\n0.5\n220\n0\n230\n0.866\n', '220\n-1\n', '210\n0\n220\n0\n230\nabc\n']) {
      const r = parseDxf(body(lw(ext)));
      expect(r.entities, ext).toEqual([]);
      expect(r.issues.some((i) => i.severity === 'aviso' && i.entity === 'LWPOLYLINE'), ext).toBe(true);
    }
  });

  it('POLYLINE espejada (230 = -1 en la cabecera) y LINE espejada se rechazan', () => {
    const r = parseDxf(body(poly('210\n0\n220\n0\n230\n-1\n')));
    expect(r.entities).toEqual([]);
    expect(r.issues.some((i) => i.entity === 'POLYLINE' && i.text.includes('extrusión'))).toBe(true);
    const line = parseDxf(body('0\nLINE\n8\nA\n10\n0\n20\n0\n11\n1\n21\n1\n210\n0\n220\n0\n230\n-1\n'));
    expect(line.entities).toEqual([]);
    expect(line.issues.some((i) => i.entity === 'LINE' && i.text.includes('extrusión'))).toBe(true);
  });

  it('POLYLINE con cota Z de cabecera (30 = 25) se rechaza como 3D; con 30 = 0 pasa', () => {
    const bad = parseDxf(body(poly('10\n0\n20\n0\n30\n25\n')));
    expect(bad.entities).toEqual([]);
    expect(bad.issues.some((i) => i.entity === 'POLYLINE' && i.text.includes('3D'))).toBe(true);
    expect(parseDxf(body(poly('10\n0\n20\n0\n30\n0\n'))).regions).toHaveLength(1);
    expect(parseDxf(body(poly('10\n0\n20\n0\n30\nabc\n'))).entities).toEqual([]);
  });

  it('polilínea abierta con extremos coincidentes: se promueve a región y no se cuenta como abierta', () => {
    const pts = [[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]].map(([x, y]) => `10\n${x}\n20\n${y}\n`).join('');
    const r = parseDxf(body(`0\nLWPOLYLINE\n8\nA\n90\n5\n70\n0\n${pts}`));
    expect(r.regions).toHaveLength(1);
    expect(r.issues.some((i) => i.text.includes('extremos coincidentes'))).toBe(true);
    expect(r.issues.some((i) => i.text.includes('abierta(s)'))).toBe(false);
    // Una abierta de verdad junto a la coincidente: se cuenta solo esa.
    const two = parseDxf(body(`0\nLWPOLYLINE\n8\nA\n90\n5\n70\n0\n${pts}0\nLWPOLYLINE\n8\nB\n90\n2\n70\n0\n10\n0\n20\n0\n10\n1\n20\n1\n`));
    expect(two.issues.find((i) => i.text.includes('abierta(s)'))?.text).toMatch(/^1 polilínea\(s\) abierta\(s\)/);
  });
});
