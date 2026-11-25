import { describe, expect, it } from 'vitest';
import { engineErrorCode, humanizeEngineError } from './errors';

describe('humanizeEngineError', () => {
  it('traduce cada código de E6 a un mensaje en español', () => {
    expect(humanizeEngineError('NoSurface: no hay superficie definida; indique analysis.surface o analysis.search')).toBe(
      'Modelo incompleto: no hay superficie definida; indique analysis.surface o analysis.search',
    );
    expect(humanizeEngineError('NoValidSurface: la búsqueda con bishop no encontró ninguna superficie')).toMatch(
      /^No hay ninguna superficie de deslizamiento válida: la búsqueda/,
    );
    expect(humanizeEngineError('InvalidModel: sin materiales')).toBe('Modelo no válido: sin materiales');
    expect(humanizeEngineError('Json: unexpected token')).toBe('JSON no válido: unexpected token');
  });

  it('muestra un texto sin código conocido como error genérico, sin ocultarlo', () => {
    expect(humanizeEngineError('algo raro')).toBe('Error del motor: algo raro');
    expect(humanizeEngineError('InvalidModelo: typo')).toBe('Error del motor: InvalidModelo: typo');
  });

  it('ignora espacios alrededor del mensaje', () => {
    expect(humanizeEngineError('  InvalidModel: x  ')).toBe('Modelo no válido: x');
  });
});

describe('engineErrorCode', () => {
  it('devuelve el código del prefijo, o null si no hay uno conocido', () => {
    expect(engineErrorCode('NoValidSurface: x')).toBe('NoValidSurface');
    expect(engineErrorCode('Json: x')).toBe('Json');
    expect(engineErrorCode('no surface defined: x')).toBeNull();
    expect(engineErrorCode('invalid model: x')).toBeNull();
  });
});
