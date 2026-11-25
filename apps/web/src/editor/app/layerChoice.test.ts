import { describe, expect, it } from 'vitest';
import { NEW_MATERIAL, SKIP_LAYER } from './importPlan';
import { layerChoice } from './layerChoice';

describe('layerChoice (valor del select de capas, R5-06c)', () => {
  it('devuelve lo mapeado', () => {
    expect(layerChoice({ SUELO: 'soil', ROCA: NEW_MATERIAL }, 'SUELO')).toBe('soil');
    expect(layerChoice({ SUELO: 'soil', ROCA: NEW_MATERIAL }, 'ROCA')).toBe(NEW_MATERIAL);
  });

  it('una capa no mapeada se omite', () => {
    expect(layerChoice({ SUELO: 'soil' }, 'OTRA')).toBe(SKIP_LAYER);
    expect(layerChoice({}, 'OTRA')).toBe(SKIP_LAYER);
  });

  it('una capa mapeada a «omitir» se omite', () => {
    expect(layerChoice({ SUELO: SKIP_LAYER }, 'SUELO')).toBe(SKIP_LAYER);
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', 'valueOf', '__proto__'])(
    'la capa «%s» sin mapear no hereda de Object.prototype',
    (name) => {
      const value = layerChoice({}, name);
      expect(typeof value).toBe('string');
      expect(value).toBe(SKIP_LAYER);
    },
  );

  it('una capa «constructor» mapeada explícitamente conserva su elección', () => {
    const mapping = JSON.parse('{"constructor":"soil"}') as Record<string, string>;
    expect(layerChoice(mapping, 'constructor')).toBe('soil');
  });
});
