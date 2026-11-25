import { describe, expect, it } from 'vitest';
import { documentTitle } from './docTitle';

describe('documentTitle (UX-11)', () => {
  it('un archivo con nombre sin título se rotula con el nombre del archivo', () => {
    expect(documentTitle({ fileName: 'talud.ogs.json', title: undefined, example: false })).toBe('talud.ogs.json');
    expect(documentTitle({ fileName: 'talud.ogs.json', title: '  ', example: false })).toBe('talud.ogs.json');
  });
  it('un archivo con título muestra el título del proyecto y el archivo entre paréntesis (panel Proyecto)', () => {
    expect(documentTitle({ fileName: 'talud.ogs.json', title: 'Talud norte', example: false })).toBe('Talud norte (talud.ogs.json)');
  });
  it('un ejemplo sin archivo se rotula «Ejemplo: …» con su título real', () => {
    expect(documentTitle({ fileName: null, title: 'ACADS 1(a)', example: true })).toBe('Ejemplo: ACADS 1(a)');
  });
  it('un modelo propio sin archivo usa el título del modelo', () => {
    expect(documentTitle({ fileName: null, title: 'Modelo nuevo', example: false })).toBe('Modelo nuevo');
  });
  it('sin título ni archivo: «Sin título»; con título en blanco también', () => {
    expect(documentTitle({ fileName: null, title: undefined, example: false })).toBe('Sin título');
    expect(documentTitle({ fileName: null, title: '   ', example: false })).toBe('Sin título');
    expect(documentTitle({ fileName: null, title: undefined, example: true })).toBe('Ejemplo');
  });
});
