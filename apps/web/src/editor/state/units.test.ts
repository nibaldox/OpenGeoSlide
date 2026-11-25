// Conversión de unidades (R8 A-02): ida y vuelta SI ⇄ imperial y, sobre todo, que el FS no cambia (verificado con el motor).
import { describe, expect, it } from 'vitest';
import { simpleSlope, slopeFormDefaults, slopeFromForm, type SlopeInput } from '../app/newModel';
import type { ModelDoc } from '../types';
import { createEditorStore } from './store';
import { applyCommand } from './reducer';
import { OGS_BIN, engineRun, haveEngine } from './engineRun.testutil';
import { UNIT_FACTORS, convertDocUnits } from './units';
import { validateLocal } from './validateLocal';

const slope = (over: Partial<SlopeInput> = {}): SlopeInput => ({
  units: 'SI',
  height: 10,
  slope: { kind: 'angle', degrees: 30 },
  crownWidth: 10,
  toeWidth: 20,
  depth: 10,
  material: { name: 'Arcilla', unit_weight: 19, cohesion: 30, friction_angle: 28 },
  water: 'toe',
  lower: { material: { name: 'Roca', unit_weight: 23, cohesion: 60, friction_angle: 38 }, contact: { kind: 'depth', depth: 4 } },
  ...over,
});

/** Modelo con agua, dos cargas, sismo, una búsqueda con rangos y γsat / ru: todo lo que el factor de unidades toca. */
function fullModel(): ModelDoc {
  const doc = simpleSlope(slope());
  doc.materials[0] = { ...doc.materials[0]!, unit_weight_sat: 20.5 };
  doc.materials[1] = { ...doc.materials[1]!, ru: 0.1 };
  doc.loads = [
    { type: 'udl', id: 'q1', x1: 4, x2: 9, q: 25 },
    { type: 'line', id: 'p1', x: 12, p: 80, angle: 10 },
  ];
  doc.analysis = {
    ...doc.analysis,
    methods: ['bishop', 'spencer'],
    seismic: { kh: 0.1, kv: 0.05 },
    search: { type: 'circular_entry_exit', entry: [0, 12], exit: [18, 40], n_entry: 12, n_exit: 12, n_radius: 12, min_width: 3 },
  };
  return doc;
}

function fixedSurfaceModel(): ModelDoc {
  const doc = fullModel();
  // Círculo de la superficie crítica de la búsqueda del modelo completo (calculada con el motor en SI).
  doc.analysis = { ...doc.analysis, search: null, surface: { type: 'circle', xc: 22.1, yc: 17.4, r: 19.55 } };
  return doc;
}

const relErr = (a: number, b: number): number => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);

function numbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === 'number') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => numbers(v, out));
  else if (value !== null && typeof value === 'object') Object.values(value).forEach((v) => numbers(v, out));
  return out;
}

describe('factores (fuente: ft = 0,3048 m y lbf = 4,4482216152605 N, definiciones exactas)', () => {
  it('coinciden con los valores tabulados del brief a 7 cifras', () => {
    expect(UNIT_FACTORS.length).toBeCloseTo(3.280840, 6);
    expect(UNIT_FACTORS.unitWeight).toBeCloseTo(6.365880, 6); // 1 kN/m³ en pcf
    expect(UNIT_FACTORS.stress).toBeCloseTo(20.885434, 6); // 1 kPa en psf
    expect(UNIT_FACTORS.lineForce).toBeCloseTo(68.521766, 5); // 1 kN/m en lbf/ft
  });
  it('son coherentes entre sí: fuerza/longitud³, /longitud², /longitud', () => {
    expect(relErr(UNIT_FACTORS.unitWeight, UNIT_FACTORS.stress / UNIT_FACTORS.length)).toBeLessThan(1e-15);
    expect(relErr(UNIT_FACTORS.stress, UNIT_FACTORS.lineForce / UNIT_FACTORS.length)).toBeLessThan(1e-15);
  });
});

describe('convertDocUnits: qué se convierte y qué no', () => {
  const si = fullModel();
  const imp = convertDocUnits(si, 'imperial');

  it('cambia la etiqueta y no toca el documento original', () => {
    expect(imp.units).toBe('imperial');
    expect(si.units).toBe('SI');
    expect(imp).not.toBe(si);
  });
  it('longitudes: coordenadas, piezométrica, círculo, rangos de la búsqueda, min_width y x de las cargas', () => {
    const f = UNIT_FACTORS.length;
    expect(imp.regions[0]!.polygon[1]).toEqual([si.regions[0]!.polygon[1]![0] * f, si.regions[0]!.polygon[1]![1] * f]);
    expect(imp.water!.piezometric_line![0]![0]).toBeCloseTo(si.water!.piezometric_line![0]![0] * f, 12);
    const s = imp.analysis.search!;
    expect(s.entry).toEqual([0, 12 * f]);
    expect(s.exit).toEqual([18 * f, 40 * f]);
    expect(s.min_width).toBeCloseTo(3 * f, 12);
    expect(s.n_entry).toBe(12);
    expect(imp.loads![0]).toMatchObject({ type: 'udl', x1: 4 * f, x2: 9 * f });
    expect(imp.loads![1]).toMatchObject({ type: 'line', x: 12 * f });
    const c = convertDocUnits(fixedSurfaceModel(), 'imperial').analysis.surface!;
    expect(c).toMatchObject({ xc: 22.1 * f, yc: 17.4 * f, r: 19.55 * f });
  });
  it('γ, γsat, γw (1 kN/m³ = 6,365880 pcf), c y q (1 kPa = 20,885434 psf) y p (1 kN/m = 68,521766 lbf/ft)', () => {
    const m = imp.materials[0]!;
    expect(m.unit_weight).toBeCloseTo(19 * 6.36588, 4);
    expect(m.unit_weight_sat).toBeCloseTo(20.5 * 6.36588, 4);
    expect(m.cohesion).toBeCloseTo(30 * 20.885434, 4);
    expect(imp.water!.unit_weight).toBeCloseTo(9.81 * 6.36588, 4);
    expect(imp.loads![0]).toMatchObject({ q: expect.closeTo(25 * 20.885434, 4) });
    expect(imp.loads![1]).toMatchObject({ p: expect.closeTo(80 * 68.521766, 3) });
  });
  it('no cambian φ, ru, kh, kv, el ángulo de la carga, el número de intentos ni la tolerancia', () => {
    const m = imp.materials[0]!;
    expect(m.friction_angle).toBe(28);
    expect(imp.materials[1]!.ru).toBe(0.1);
    expect(imp.analysis.seismic).toEqual({ kh: 0.1, kv: 0.05 });
    expect(imp.loads![1]).toMatchObject({ angle: 10 });
    expect(imp.analysis.tolerance).toBe(si.analysis.tolerance);
    expect(imp.analysis.slices).toBe(si.analysis.slices);
    expect(imp.slope).toEqual(si.slope);
    expect(imp.meta).toEqual(si.meta);
  });
  it('γw: 9,81 kN/m³ se vuelve 62,45 pcf (no 62,4) para que el FS no cambie; sin γw explícito y con piezométrica se escribe 62,45', () => {
    expect(imp.water!.unit_weight!.toFixed(2)).toBe('62.45');
    const noGamma = fullModel();
    noGamma.water = { piezometric_line: noGamma.water!.piezometric_line };
    const c = convertDocUnits(noGamma, 'imperial');
    expect(c.water!.unit_weight!.toFixed(2)).toBe('62.45');
    // Sin piezométrica no hay nada que escribir.
    const dry = fullModel();
    dry.water = null;
    expect(convertDocUnits(dry, 'imperial').water).toBeNull();
    // De imperial a SI sin γw explícito: el motor usa 9,81 kN/m³, que ya es lo correcto en SI.
    const back = convertDocUnits(c, 'SI');
    expect(back.water!.unit_weight).toBeCloseTo(9.81, 12);
  });
  it('mismas unidades: devuelve el mismo documento; un documento sin `units` cuenta como SI', () => {
    expect(convertDocUnits(si, 'SI')).toBe(si);
    expect(convertDocUnits(imp, 'imperial')).toBe(imp);
    const { units: _u, ...rest } = si;
    void _u;
    expect(convertDocUnits(rest as ModelDoc, 'imperial').units).toBe('imperial');
  });
  it('el resultado del documento convertido pasa la validación local (sin errores)', () => {
    expect(validateLocal(imp).filter((i) => i.severity === 'error')).toEqual([]);
    expect(validateLocal(convertDocUnits(imp, 'SI')).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('ida y vuelta SI → imperial → SI', () => {
  it.each([['con búsqueda', fullModel], ['con superficie fija', fixedSurfaceModel]])('error relativo < 1e-9 en cada número (%s)', (_n, make) => {
    const si = make();
    const back = convertDocUnits(convertDocUnits(si, 'imperial'), 'SI');
    expect(back.units).toBe('SI');
    const a = numbers(si);
    const b = numbers(back);
    expect(b).toHaveLength(a.length);
    for (let i = 0; i < a.length; i += 1) expect(relErr(a[i]!, b[i]!), `número ${i}: ${a[i]} → ${b[i]}`).toBeLessThan(1e-9);
  });
  it('imperial → SI → imperial también', () => {
    const imp = convertDocUnits(fullModel(), 'imperial');
    const back = convertDocUnits(convertDocUnits(imp, 'SI'), 'imperial');
    const a = numbers(imp);
    const b = numbers(back);
    for (let i = 0; i < a.length; i += 1) expect(relErr(a[i]!, b[i]!)).toBeLessThan(1e-9);
  });
});

describe('units/convert: un solo paso deshacible', () => {
  it('el reductor lo aplica, sube la revisión una vez y un Deshacer restaura el documento', () => {
    const store = createEditorStore(fullModel(), 'm.ogs.json');
    store.markSaved('m.ogs.json');
    const before = store.getState().doc;
    store.dispatch({ type: 'units/convert', units: 'imperial' });
    const s = store.getState();
    expect(s.doc.units).toBe('imperial');
    expect(s.history.past).toEqual([before]);
    expect(s.revision).toBe(1);
    expect(s.file.name).toBe('m.ogs.json'); // conserva el archivo y queda «con cambios sin guardar»
    expect(s.revision).not.toBe(s.file.savedRevision);
    store.undo();
    expect(store.getState().doc).toBe(before);
    expect(store.getState().history.future).toHaveLength(1);
  });
  it('unidades no válidas o iguales: se ignora (mismo estado)', () => {
    const doc = fullModel();
    expect(applyCommand(doc, { type: 'units/convert', units: 'furlongs' as never })).toBeNull();
    const store = createEditorStore(doc, null);
    const before = store.getState();
    store.dispatch({ type: 'units/convert', units: 'SI' });
    expect(store.getState()).toBe(before);
  });
});

describe.skipIf(!haveEngine)(`el FS no cambia al convertir (motor: ${OGS_BIN})`, () => {
  const fos = (doc: ModelDoc): Record<string, number> => {
    const r = engineRun(doc);
    expect(r.code, r.out).toBe(0);
    for (const x of r.results) expect(x.status, `${x.method} debe converger`).toBe('converged');
    return Object.fromEntries(r.results.map((x) => [x.method, x.fos as number]));
  };

  it.each([
    ['búsqueda, agua, cargas y sismo', fullModel],
    ['superficie fija, agua, cargas y sismo', fixedSurfaceModel],
    ['sin agua ni cargas', () => ({ ...fullModel(), water: null, loads: [], analysis: { ...fullModel().analysis, seismic: null } })],
  ])('Bishop y Spencer dan el mismo FS en SI y convertido a imperial (%s)', (_name, make) => {
    const si = make() as ModelDoc;
    const imp = convertDocUnits(si, 'imperial');
    const a = fos(si);
    const b = fos(imp);
    expect(Object.keys(a).sort()).toEqual(['bishop', 'spencer']);
    for (const method of ['bishop', 'spencer']) {
      expect(Number.isFinite(a[method]), `${method} SI`).toBe(true);
      expect(Math.abs(a[method]! - b[method]!), `${method}: SI ${a[method]} vs imperial ${b[method]}`).toBeLessThan(1e-6);
    }
  });

  it('el agua pesa: con γw = 62,4 (en vez de 62,45) el FS sí cambia (por eso se convierte sin redondear)', () => {
    const si = fixedSurfaceModel();
    const imp = convertDocUnits(si, 'imperial');
    const rounded: ModelDoc = { ...imp, water: { ...imp.water!, unit_weight: 62.4 } };
    expect(Math.abs(fos(si).bishop! - fos(rounded).bishop!)).toBeGreaterThan(1e-7);
  });

  it('con γw = 9,81 sin convertir en un modelo imperial (el defecto de R8) el FS queda del lado inseguro', () => {
    const si = fixedSurfaceModel();
    const imp = convertDocUnits(si, 'imperial');
    const wrong: ModelDoc = { ...imp, water: { ...imp.water!, unit_weight: 9.81 } };
    expect(fos(wrong).bishop!).toBeGreaterThan(fos(imp).bishop!);
  });

  it('ida y vuelta: el FS del modelo devuelto a SI es el original', () => {
    const si = fullModel();
    const back = convertDocUnits(convertDocUnits(si, 'imperial'), 'SI');
    expect(Math.abs(fos(si).spencer! - fos(back).spencer!)).toBeLessThan(1e-9);
  });
});

describe('Talud simple imperial: γw explícito', () => {
  it('escribe 62,4 pcf y el modelo no queda bloqueado', () => {
    const r = slopeFromForm({ ...slopeFormDefaults('imperial'), water: 'toe' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const doc = simpleSlope(r.value);
    expect(doc.water?.unit_weight).toBe(62.4);
    expect(validateLocal(doc).filter((i) => i.severity === 'error')).toEqual([]);
  });
});
