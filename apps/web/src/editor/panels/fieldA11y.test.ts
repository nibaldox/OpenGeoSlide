import { describe, expect, it } from 'vitest';
import { describedByIds, errorRole, nextFieldAnnounce } from './fieldA11y';

describe('describedByIds', () => {
  const ids = { hintId: 'h', errorId: 'e' };
  it('la ayuda se enlaza siempre que exista, con o sin error', () => {
    expect(describedByIds(ids, { hint: true, error: false })).toBe('h');
    expect(describedByIds(ids, { hint: true, error: true })).toBe('h e');
  });
  it('el error solo mientras hay uno', () => {
    expect(describedByIds(ids, { hint: false, error: true })).toBe('e');
    expect(describedByIds(ids, { hint: false, error: false })).toBeUndefined();
  });
});

describe('anuncio del error de un campo', () => {
  it('teclear no anuncia; confirmar (blur o Intro) sí; volver a editar lo silencia', () => {
    expect(errorRole(nextFieldAnnounce('edit'))).toBeUndefined();
    expect(errorRole(nextFieldAnnounce('commit'))).toBe('alert');
    expect(errorRole(nextFieldAnnounce('reset'))).toBeUndefined();
  });
});
