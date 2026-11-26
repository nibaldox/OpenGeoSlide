// Aviso `ito_matsui_spacing_range` (E15i-8) y la nota `structural_checks_not_covered` con Ito-Matsui.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ENGINE_WARNING_CODES, describeWarning, describeWarnings, itoMatsuiRangeText, warningPath } from './warnings';

describe('ito_matsui_spacing_range', () => {
  it('es un código del motor, un aviso y apunta a los refuerzos', () => {
    expect(ENGINE_WARNING_CODES).toContain('ito_matsui_spacing_range');
    expect(describeWarning('ito_matsui_spacing_range').severity).toBe('aviso');
    expect(warningPath('ito_matsui_spacing_range')).toBe('/reinforcements');
  });

  it('el texto es el del contrato: el rango 2 a 8, el sentido del error, la fuente y la acción', () => {
    const t = describeWarning('ito_matsui_spacing_range').text;
    expect(t).toBe(
      'Pilote Ito-Matsui con S/D fuera de 2 a 8: la fórmula pierde validez (sobrestima la fuerza con S/D pequeño y la subestima con S/D grande; Ukritchon y Keawsawasvong 2017). Revise el espaciamiento.',
    );
    expect(t).not.toMatch(/\bvos\b|\bpodés\b|\btenés\b|\brevisá\b/);
  });

  it('con el valor de S/D en el texto: «con S/D = 1,5 fuera de 2 a 8»', () => {
    expect(itoMatsuiRangeText(1.5)).toContain('Pilote Ito-Matsui con S/D = 1,5 fuera de 2 a 8: la fórmula pierde validez');
    expect(itoMatsuiRangeText(12)).toContain('con S/D = 12 fuera de 2 a 8');
    expect(itoMatsuiRangeText()).toContain('con S/D fuera de 2 a 8');
    expect(itoMatsuiRangeText(Number.NaN)).toContain('con S/D fuera de 2 a 8');
  });

  it('no se repite y convive con la nota de límite estructural', () => {
    const list = describeWarnings(['structural_checks_not_covered', 'ito_matsui_spacing_range', 'ito_matsui_spacing_range']);
    expect(list.map((w) => w.code)).toEqual(['structural_checks_not_covered', 'ito_matsui_spacing_range']);
  });
});

describe('structural_checks_not_covered con Ito-Matsui', () => {
  it('ya no dice que nunca calcula el empuje: lo calcula en el pilote con presión del suelo', () => {
    const t = describeWarning('structural_checks_not_covered').text;
    expect(t).toContain('Ito-Matsui');
    expect(t).toContain('empotramiento');
    expect(t).toContain('momento flector');
    expect(t).toContain('deflexión');
  });
});

describe('E6 de briefs/00_CONTRATOS.md', () => {
  // Integrado (F3G, I-G): el contrato ya trae el código; el test deja de saltarse.
  const contract = readFileSync(fileURLToPath(new URL('../../../../briefs/00_CONTRATOS.md', import.meta.url)), 'utf8');
  it('la lista de E6 trae el código nuevo', () => {
    expect(contract).toContain('`ito_matsui_spacing_range`');
  });
});
