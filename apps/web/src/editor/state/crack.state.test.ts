// Grieta de tracción (v0.5, F5.2, F5.7) en el estado del editor: el reductor sube la versión a 0.5, la conversión de unidades escala
// `depth` y deja `water_fill` y «auto», y la validación local usa el texto del motor con las palabras de la interfaz.
import { describe, expect, it } from 'vitest';
import type { TensionCrack } from '../../engine/types';
import type { EditorCommand, ModelDoc } from '../types';
import { minimalVersion } from '../../io/ogsJson';
import { applyCommand } from './reducer';
import { anchor } from './reinforcementFixtures';
import { baseDoc } from './testFixtures';
import { UNIT_FACTORS, convertDocUnits } from './units';
import { crackDepthText, crackWaterFillText, validateLocal } from './validateLocal';

const patch = (tension_crack: TensionCrack | undefined): EditorCommand => ({ type: 'analysis/patch', patch: { tension_crack } });
const withCrack = (c: TensionCrack, over: Partial<ModelDoc> = {}): ModelDoc => ({ ...baseDoc(), version: '0.5', analysis: { ...baseDoc().analysis, tension_crack: c }, ...over });
const errs = (d: ModelDoc) => validateLocal(d).filter((i) => i.severity === 'error');

describe('reductor: la grieta sube la versión a 0.5', () => {
  it('analysis/patch con tension_crack sube 0.1, 0.2, 0.3 y 0.4 a 0.5', () => {
    for (const version of ['0.1', '0.2', '0.3', '0.4'] as const) {
      const next = applyCommand({ ...baseDoc(), version }, patch({ depth: 2, water_fill: 1 }));
      expect(next?.analysis.tension_crack, version).toEqual({ depth: 2, water_fill: 1 });
      expect(next?.version, version).toBe('0.5');
    }
  });

  it('quitar la grieta (undefined) borra la clave y el guardado vuelve a la versión mínima', () => {
    const doc = applyCommand(baseDoc(), patch({ depth: 'auto', water_fill: 0 })) as ModelDoc;
    const without = applyCommand(doc, patch(undefined)) as ModelDoc;
    expect('tension_crack' in without.analysis).toBe(false);
    expect(minimalVersion(without)).toBe('0.2');
    expect(minimalVersion(doc)).toBe('0.5');
  });

  it('un valor no finito en la grieta es un comando inválido', () => {
    expect(applyCommand(baseDoc(), patch({ depth: Number.NaN, water_fill: 1 }))).toBeNull();
    expect(applyCommand(baseDoc(), patch({ depth: 2, water_fill: Number.POSITIVE_INFINITY }))).toBeNull();
  });

  it('los refuerzos no bajan un documento 0.5 a 0.4', () => {
    const doc = withCrack({ depth: 2, water_fill: 1 });
    const next = applyCommand(doc, { type: 'reinforcement/upsert', index: null, reinforcement: anchor() });
    expect(next?.reinforcements).toEqual([anchor()]);
    expect(next?.version).toBe('0.5');
  });

  it('un documento 0.2 con refuerzos y luego grieta termina en 0.5', () => {
    const a = applyCommand(baseDoc(), { type: 'reinforcement/upsert', index: null, reinforcement: anchor() }) as ModelDoc;
    expect(a.version).toBe('0.4');
    expect(applyCommand(a, patch({ depth: 1, water_fill: 1 }))?.version).toBe('0.5');
  });
});

describe('conversión de unidades de la grieta (F5.7)', () => {
  it('SI → imperial escala `depth` con el factor de longitud y deja `water_fill`', () => {
    const out = convertDocUnits(withCrack({ depth: 2, water_fill: 0.5 }), 'imperial');
    expect(out.analysis.tension_crack).toEqual({ depth: 2 * UNIT_FACTORS.length, water_fill: 0.5 });
  });

  it('«auto» queda igual y la ida y vuelta devuelve el valor (1e-12)', () => {
    expect(convertDocUnits(withCrack({ depth: 'auto', water_fill: 1 }), 'imperial').analysis.tension_crack).toEqual({ depth: 'auto', water_fill: 1 });
    const back = convertDocUnits(convertDocUnits(withCrack({ depth: 3.7, water_fill: 0.25 }), 'imperial'), 'SI');
    const c = back.analysis.tension_crack as { depth: number; water_fill: number };
    expect(Math.abs(c.depth - 3.7)).toBeLessThan(1e-12);
    expect(c.water_fill).toBe(0.25);
  });

  it('no cambia la grieta del documento de origen (sin mutar)', () => {
    const doc = withCrack({ depth: 2, water_fill: 1 });
    convertDocUnits(doc, 'imperial');
    expect(doc.analysis.tension_crack).toEqual({ depth: 2, water_fill: 1 });
  });

  it('sin grieta no aparece una clave nueva', () => {
    expect('tension_crack' in convertDocUnits(baseDoc(), 'imperial').analysis).toBe(false);
  });
});

describe('validación local de la grieta (E15b)', () => {
  it('una grieta correcta no da errores; «auto» y water_fill 0 y 1 son válidos', () => {
    for (const c of [{ depth: 2, water_fill: 1 }, { depth: 'auto', water_fill: 0 }, { depth: 0.001, water_fill: 0.5 }] as TensionCrack[]) {
      expect(errs(withCrack(c)), JSON.stringify(c)).toEqual([]);
    }
  });

  it('depth ≤ 0 o no finito: error con la ruta y el texto del motor', () => {
    for (const d of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const e = errs(withCrack({ depth: d, water_fill: 1 })).filter((i) => i.path === '/analysis/tension_crack/depth');
      expect(e, String(d)).toHaveLength(1);
      expect(e[0]?.text).toBe(`${crackDepthText(d)}.`);
      expect(e[0]?.text).toContain('debe ser finito y mayor que 0 (o «Automática»)');
    }
    expect(crackDepthText(-1.5)).toBe('Grieta de tracción, profundidad: debe ser finito y mayor que 0 (o «Automática»), no -1,5');
  });

  it('water_fill fuera de [0, 1] o no finito: error con la ruta y el texto del motor', () => {
    for (const w of [-0.1, 1.0001, 2, Number.NaN]) {
      const e = errs(withCrack({ depth: 2, water_fill: w })).filter((i) => i.path === '/analysis/tension_crack/water_fill');
      expect(e, String(w)).toHaveLength(1);
      expect(e[0]?.text).toBe(`${crackWaterFillText(w)}.`);
    }
    expect(crackWaterFillText(2)).toBe('Grieta de tracción, fracción de agua: debe ser finito y estar en [0, 1], no 2');
  });

  it('un campo ausente es un error (water_fill es obligatoria y no tiene valor por defecto)', () => {
    const noFill = withCrack({ depth: 2 } as unknown as TensionCrack);
    const e = errs(noFill).find((i) => i.path === '/analysis/tension_crack/water_fill');
    expect(e?.text).toContain('obligatoria');
    const noDepth = withCrack({ water_fill: 1 } as unknown as TensionCrack);
    expect(errs(noDepth).find((i) => i.path === '/analysis/tension_crack/depth')?.text).toContain('obligatoria');
  });

  it('con una versión menor que 0.5, error como el del motor, con la palabra de la interfaz', () => {
    for (const version of ['0.1', '0.2', '0.3', '0.4'] as const) {
      const doc = { ...withCrack({ depth: 2, water_fill: 1 }), version };
      const e = errs(doc).find((i) => i.code === 'editor.crack_version');
      expect(e, version).toBeDefined();
      expect(e?.path).toBe('/version');
      expect(e?.text).toContain('la grieta de tracción requiere el formato 0.5');
      expect(e?.text).toContain(`declara el ${version}`);
    }
    expect(errs(withCrack({ depth: 2, water_fill: 1 })).some((i) => i.code === 'editor.crack_version')).toBe(false);
  });

  it('sin la grieta, la 0.5 no da error de versión; con refuerzos y 0.5 tampoco', () => {
    expect(errs({ ...baseDoc(), version: '0.5' })).toEqual([]);
    const r = errs({ ...withCrack({ depth: 2, water_fill: 1 }), reinforcements: [anchor()] });
    expect(r.filter((i) => i.code.includes('version'))).toEqual([]);
  });

  it('una versión 0.5 no dispara el aviso de la 0.3 ni el de la 0.4 por campos que ya admite', () => {
    const doc: ModelDoc = { ...withCrack({ depth: 2, water_fill: 1 }), analysis: { ...baseDoc().analysis, methods: ['spencer', 'janbu_simplified'], tension_crack: { depth: 2, water_fill: 1 } } };
    expect(errs(doc).filter((i) => i.path === '/version')).toEqual([]);
  });
});
